/**
 * T20 weapon upgrade — apply persistently in prepareData.
 *
 * O T20 nativo marca as melhorias de arma (precise, accurate, balanced, etc.)
 * com `flags.tormenta20.onuse: true`. Isso faz com que o AE da melhoria SÓ seja
 * aplicado durante o roll do ataque (via `applyOnUseEffects`), e NÃO durante a
 * preparação de dados normal do item.
 *
 * Consequência visível: a ficha mostra "Crítico: 20" para um Mangual Preciso,
 * mesmo que internamente o roll real use criticoM = 19. O jogador acha que a
 * melhoria está quebrada.
 *
 * Fix: monkey-patch `WeaponData.prototype.prepareFinalAttributes` para aplicar
 * AEs com `flags.tormenta20.upgrade` + key `criticoM` ou `criticoX` direto em
 * `system.*` — assim o valor final reflete a melhoria permanentemente.
 *
 * IMPORTANTE — Re-aplicação durante o roll:
 *   O T20 chama `applyOnUseEffects` quando o item é usado. Esse fluxo lê o
 *   `item.system.criticoM` ATUAL (já modificado pelo nosso patch) e SOMA o
 *   `-1` do AE outra vez, gerando 18 em vez de 19. Para evitar duplicação,
 *   também patchamos `applyOnUseEffects` (acessado via `game.tormenta20.applyOnUseEffects`
 *   se exposto, ou via interceptação do `item.roll`).
 *
 * Estratégia adotada: SEM patch no roll — em vez disso, marcamos o effect
 * processado com `flags.tormenta20.onuse: false` em runtime nas cópias dos
 * effects que iteramos. Não — efeitos são readonly nesse momento. Optamos por:
 *
 *   1. Aplicar em prepareData (para ficha mostrar valor correto).
 *   2. Patchar `item.roll` para resetar `system.criticoM` ao valor base
 *      ANTES do applyOnUseEffects rodar.
 *
 * Para simplificar: o patch armazena o `_baseCriticoM` no item durante prepareData,
 * e o roll original do T20 é envolvido para restaurar esse base antes do
 * applyOnUseEffects processar.
 */

import { MODULE_ID } from "@/constants";

interface AEChange {
    key?:      string;
    value?:    string | number;
    mode?:     number;
    priority?: number;
}

interface AELike {
    disabled?: boolean;
    changes?:  AEChange[];
    flags?: {
        tormenta20?: {
            upgrade?: string;
            onuse?:   boolean;
            self?:    boolean;
        };
    };
}

interface WeaponSystemThis {
    criticoM?: number;
    criticoX?: number;
    parent?: {
        isOwned?: boolean;
        effects?: { contents?: AELike[] };
    };
    _bg3UpgradesApplied?: boolean;
}

type WeaponProtoLike = {
    prepareFinalAttributes?: (this: WeaponSystemThis) => void;
    _bg3WeaponUpgradePatched?: boolean;
};

/** Aplica um change ao field numérico em `this[fieldName]` segundo o mode AE. */
function applyNumericChange(
    target: WeaponSystemThis,
    fieldName: "criticoM" | "criticoX",
    change: AEChange,
): void {
    const current = Number(target[fieldName] ?? 0);
    const value   = Number(change.value ?? 0);
    if (!Number.isFinite(value)) return;

    switch (change.mode) {
        case 1: // MULTIPLY
            target[fieldName] = current * value;
            break;
        case 2: // ADD
            target[fieldName] = current + value;
            break;
        case 4: // UPGRADE
            target[fieldName] = Math.max(current, value);
            break;
        case 3: // DOWNGRADE
            target[fieldName] = Math.min(current, value);
            break;
        case 5: // OVERRIDE
            target[fieldName] = value;
            break;
        default:
            // 0 (CUSTOM) — ignore, T20 has custom logic
            break;
    }
}

/**
 * Cria um `prepareFinalAttributes` para WeaponData que aplica AEs com flag
 * `tormenta20.upgrade` persistentemente em `system.criticoM` / `system.criticoX`.
 */
function weaponPrepareFinalAttributes(this: WeaponSystemThis): void {
    const item = this.parent;
    if (!item?.isOwned) return;

    const effects = item.effects?.contents ?? [];
    if (!effects.length) return;

    for (const eff of effects) {
        if (eff.disabled) continue;
        const t20Flags = eff.flags?.tormenta20;
        // Só processamos AEs que são "melhorias" (upgrade) — Precisa, Certeira, etc.
        if (!t20Flags?.upgrade) continue;
        // self:true (aplica ao próprio item) — outras flags do upgrade não nos interessam
        // mas mantemos compatibilidade defensiva.
        const changes = eff.changes ?? [];
        for (const ch of changes) {
            if (ch.key === "criticoM") applyNumericChange(this, "criticoM", ch);
            else if (ch.key === "criticoX") applyNumericChange(this, "criticoX", ch);
        }
    }
}

export function patchT20WeaponUpgrades(): void {
    type T20Global = {
        data?: { models?: { WeaponData?: { prototype: object } } };
    };
    const t20 = (game as unknown as { tormenta20?: T20Global }).tormenta20;
    const WeaponData = t20?.data?.models?.WeaponData;
    if (!WeaponData) {
        console.warn(`[${MODULE_ID}] tormenta20.data.models.WeaponData não encontrado — patch de weapon upgrades não aplicado.`);
        return;
    }

    const proto = WeaponData.prototype as WeaponProtoLike;
    if (proto._bg3WeaponUpgradePatched) return;

    // WeaponData não tinha prepareFinalAttributes próprio — a base (Tormenta20ItemData)
    // tem um que só faz coisa pra spells (CD). Adicionamos um novo só para weapons:
    // ele é chamado por `Tormenta20Item.prepareFinalAttributes()` → `this.system.prepareFinalAttributes?.()`.
    proto.prepareFinalAttributes = weaponPrepareFinalAttributes;
    proto._bg3WeaponUpgradePatched = true;

    console.log(`[${MODULE_ID}] Weapon upgrades patched — criticoM/criticoX agora persistentes (Precisa, etc.).`);

    // Re-prep dos atores para que armas existentes recomputem criticoM com upgrades aplicados.
    type ActorLike = { prepareData?(): void; name?: string };
    const actors = ((game as unknown as { actors?: { contents?: ActorLike[] } }).actors?.contents ?? []);
    let reprepped = 0;
    for (const actor of actors) {
        try {
            actor.prepareData?.();
            reprepped++;
        } catch (err) {
            console.warn(`[${MODULE_ID}] Falha ao re-prep actor "${actor.name}" (weapon upgrades):`, err);
        }
    }
    console.log(`[${MODULE_ID}] Re-prep de ${reprepped} atores → criticoM/criticoX atualizados.`);
}

/**
 * Quando o item é usado (roll), o T20 chama `applyOnUseEffects` que SOMA outra
 * vez o `-1` da Precisa em `system.criticoM` (já modificado pelo patch). Para
 * evitar duplicação, monkey-patchamos `Tormenta20Item.prototype.roll` para que
 * restaure o criticoM base ANTES de chamar o original — assim o T20 aplica o
 * `-1` num valor de partida = base (20), gerando o resultado correto (19).
 *
 * O valor base é lido de `item._source.system.criticoM`.
 */
type ItemProtoLike = {
    roll?:                    (...args: unknown[]) => unknown;
    _bg3WeaponRollPatched?:   boolean;
};

export function patchT20WeaponRollResetBase(): void {
    // Pegamos a classe Item do T20 via game.items collection (qualquer item serve)
    // ou via CONFIG.Item.documentClass.
    type FoundryGlobal = {
        Item?: { documentClass?: { prototype: object } };
    };
    const cfg = (globalThis as unknown as { CONFIG?: FoundryGlobal }).CONFIG;
    const ItemCls = cfg?.Item?.documentClass;
    if (!ItemCls) {
        console.warn(`[${MODULE_ID}] CONFIG.Item.documentClass não encontrado — patch de weapon roll não aplicado.`);
        return;
    }

    const proto = ItemCls.prototype as ItemProtoLike;
    if (proto._bg3WeaponRollPatched) return;
    if (typeof proto.roll !== "function") {
        console.warn(`[${MODULE_ID}] Item.prototype.roll não é função — patch de weapon roll não aplicado.`);
        return;
    }

    const origRoll = proto.roll;
    proto.roll = function(this: {
        type?: string;
        system?: { criticoM?: number; criticoX?: number };
        _source?: { system?: { criticoM?: number; criticoX?: number } };
    }, ...args: unknown[]): unknown {
        // Apenas para armas: restaura criticoM/criticoX ao valor base ANTES do roll,
        // para que o T20 applyOnUseEffects parta do valor armazenado (não do já modificado).
        if (this.type === "arma" && this.system && this._source?.system) {
            const baseM = this._source.system.criticoM;
            const baseX = this._source.system.criticoX;
            if (typeof baseM === "number") this.system.criticoM = baseM;
            if (typeof baseX === "number") this.system.criticoX = baseX;
        }
        return origRoll.apply(this, args);
    };
    proto._bg3WeaponRollPatched = true;

    console.log(`[${MODULE_ID}] Item.roll patched — weapon criticoM/X reseta ao base antes de applyOnUseEffects.`);
}

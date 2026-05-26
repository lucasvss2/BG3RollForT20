/**
 * Kiai Divino — Dano Máximo
 *
 * Texto: "Uma vez por rodada, quando faz um ataque corpo a corpo, você pode
 * pagar 3 PM. Se acertar o ataque, causa dano máximo, sem necessidade de
 * rolar dados."
 *
 * Estratégia escolhida (v1.20.3+): AE vive APENAS em `actor.effects`.
 *
 *   Histórico:
 *   - v1.20.0: AE só no item com transfer:true. Em Foundry v13, criar AE com
 *     transfer:true em item já owned NÃO clona automaticamente em actor.effects
 *     na hora — a propagação acontece em algum prepareData posterior. Resultado:
 *     dialog do T20 (que itera `item.actor.effects.filter(...)` linha 6193) não
 *     vê a AE e Kiai parece não fazer nada.
 *   - v1.20.2: AE em AMBOS item E actor (padrão T20 `_createEffect`). Mas o
 *     transfer:true acabou propagando depois → duas entradas "Kiai Divino" no
 *     AbilityUseDialog, e só a segunda (a manual) ligada ao id certo funcionava.
 *   - v1.20.3 (este arquivo): AE só no actor, com transfer:false explícito e
 *     `origin: poder.uuid` ligando ao item para cleanup. Migração apaga
 *     residuais no item E duplicatas no actor.
 *
 *   Não precisa do AE no item: a única razão pra estar lá seria cleanup
 *   automático via cascata de delete — substituímos por hook `deleteItem`
 *   explícito.
 *
 *   AE config:
 *     disabled: true   → checkbox desmarcado no dialog HBS
 *                        ({{#unless ap.disabled}}checked{{/unless}}).
 *                        T20 só consulta `disabled` em filtros passivos;
 *                        marcar no dialog injeta a AE em `onUseEffects` igual.
 *     transfer: false  → não propaga, evitando duplicação.
 *     flags.tormenta20: { onuse, attack, custo: "3", durationScene: false }
 *     changes: [{ key:"dano", value:"max", mode:0 (CUSTOM) }]
 *     origin: poder.uuid → vínculo com o item; usado pra cleanup.
 *
 *   T20 `applyRollChanges` detecta mode:0 + value:"max" em key matching /dano/
 *   → seta `options.minmax = "max"` → `damageRoll` → `roll.evaluate({maximize:true})`.
 *   3 PM debitados via `consumeMana` do T20 (fluxo nativo, sem intervenção).
 */

import { MODULE_ID } from "@/constants";
import { normalizeCondName } from "@/spell-resistance/index";
import { log } from "@/utils/logging";

// ── Constantes ────────────────────────────────────────────────────────────────

const KIAI_FLAG = "kiai";
const KIAI_PODER_NAME = "kiai divino";

// ── Helpers de tipos ──────────────────────────────────────────────────────────

interface WithCreateEmbedded {
    createEmbeddedDocuments(type: string, data: unknown[], options?: Record<string, unknown>): Promise<unknown>;
    deleteEmbeddedDocuments(type: string, ids: string[], options?: Record<string, unknown>): Promise<unknown>;
}

interface WithUuid { uuid: string; }
interface WithId   { id: string; }
interface WithOrigin { origin?: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function isKiaiDivinoPoder(item: FoundryItem): boolean {
    if (item.type !== "poder") return false;
    return normalizeCondName(item.name).includes(KIAI_PODER_NAME);
}

function isKiaiAE(ae: { flags?: unknown }): boolean {
    const flags = ae.flags as Record<string, Record<string, unknown>> | undefined;
    return Boolean(flags?.[MODULE_ID]?.[KIAI_FLAG]);
}

function buildKiaiAEData(itemUuid: string): Record<string, unknown> {
    return {
        name: "Kiai Divino",
        icon: "systems/tormenta20/icons/svg/skills.svg",
        origin: itemUuid,
        disabled: true,
        // transfer: false explícito — não queremos auto-propagação para o item.
        // Vivemos somente em actor.effects pra evitar duplicação no dialog.
        transfer: false,
        changes: [
            { key: "dano", value: "max", mode: 0, priority: 20 },
        ],
        flags: {
            tormenta20: {
                onuse: true,
                durationScene: false,
                attack: true,
                custo: "3",
            },
            [MODULE_ID]: {
                [KIAI_FLAG]: true,
            },
        },
    };
}

async function deleteIds(target: unknown, ids: string[], label: string): Promise<void> {
    if (!ids.length) return;
    try {
        await (target as WithCreateEmbedded)
            .deleteEmbeddedDocuments("ActiveEffect", ids, { render: false });
    } catch (err) {
        console.warn(`[${MODULE_ID}] Kiai Divino: falha ao deletar ${label}:`, err);
    }
}

/**
 * Garante exatamente UMA Kiai AE em `actor.effects` ligada ao poder via
 * `origin: poder.uuid`. Também limpa AEs legacy no item (de versões antigas)
 * e duplicatas no actor (caso transfer:true tenha propagado em algum momento).
 */
async function ensureKiaiAE(item: FoundryItem): Promise<void> {
    const actor = (item as unknown as { actor?: FoundryActor }).actor;
    if (!actor) return;
    const itemUuid = (item as unknown as WithUuid).uuid;
    if (!itemUuid) return;

    // (1) Limpa AEs legacy no item (v1.20.0/v1.20.2 deixavam Kiai AE embedded).
    const itemAEs = (item.effects?.contents ?? []).filter(isKiaiAE);
    if (itemAEs.length) {
        const ids = itemAEs.map(e => (e as unknown as WithId).id).filter(Boolean);
        await deleteIds(item, ids, "AE legacy no item");
    }

    // (2) Encontra todas as Kiai AEs no actor ligadas a este poder.
    const actorAEs = (actor.effects?.contents ?? []).filter(e => {
        const origin = (e as unknown as WithOrigin).origin;
        return isKiaiAE(e) && origin === itemUuid;
    });

    // (3) Se há duplicatas no actor, mantém a primeira e deleta o resto.
    if (actorAEs.length > 1) {
        const extras = actorAEs.slice(1);
        const ids = extras.map(e => (e as unknown as WithId).id).filter(Boolean);
        await deleteIds(actor, ids, "AEs duplicadas no actor");
    }

    // (4) Se nenhuma AE existe no actor, cria.
    if (actorAEs.length === 0) {
        try {
            const effectData = buildKiaiAEData(itemUuid);
            await (actor as unknown as WithCreateEmbedded)
                .createEmbeddedDocuments("ActiveEffect", [effectData], { render: false });
            log(`Kiai Divino: AE criada em ${actor.name} (poder "${item.name}").`);
        } catch (err) {
            console.warn(`[${MODULE_ID}] Kiai Divino: falha ao criar AE no ator:`, err);
        }
    }
}

/**
 * Remove a Kiai AE do actor quando o poder correspondente é deletado.
 * Sem este hook, a AE no actor ficaria órfã (origin apontando pra uuid morto).
 */
async function cleanupKiaiAE(item: FoundryItem): Promise<void> {
    const actor = (item as unknown as { actor?: FoundryActor; parent?: FoundryActor }).actor
        ?? (item as unknown as { parent?: FoundryActor }).parent;
    if (!actor) return;
    const itemUuid = (item as unknown as WithUuid).uuid;
    if (!itemUuid) return;

    const stale = (actor.effects?.contents ?? []).filter(e => {
        const origin = (e as unknown as WithOrigin).origin;
        return isKiaiAE(e) && origin === itemUuid;
    });
    if (!stale.length) return;

    const ids = stale.map(e => (e as unknown as WithId).id).filter(Boolean);
    await deleteIds(actor, ids, "AE residual no actor (poder deletado)");
}

// ── Entrada pública ───────────────────────────────────────────────────────────

export function setupKiaiDivino(): void {
    // ready: cada usuário processa SEUS atores controlados (owner level ≥ 3).
    // GM faz fallback pra atores sem owner explícito.
    Hooks.once("ready", () => {
        const myId = game.user?.id;
        if (!myId) return;
        for (const actorLike of game.actors?.contents ?? []) {
            const actor = actorLike as FoundryActor;
            const ownLevel = (actor.ownership as Record<string, number> | undefined)?.[myId] ?? 0;
            const isOwner = ownLevel >= 3;
            const isFallbackGM = game.user?.isGM && ownLevel === 0;
            if (!isOwner && !isFallbackGM) continue;
            for (const item of actor.items?.contents ?? []) {
                if (isKiaiDivinoPoder(item)) {
                    void ensureKiaiAE(item);
                }
            }
        }
    });

    // createItem: novo poder adicionado a um ator (drag&drop, importação).
    // userId-gated: só quem disparou processa pra evitar duplicação por cliente.
    Hooks.on("createItem", (...args: unknown[]) => {
        const item   = args[0] as FoundryItem;
        const userId = args[2] as string | undefined;

        if (!userId || userId !== game.user?.id) return;
        if (!(item as unknown as { parent?: unknown }).parent) return;
        if (!isKiaiDivinoPoder(item)) return;

        void ensureKiaiAE(item);
    });

    // deleteItem: cleanup da AE residual no ator.
    Hooks.on("deleteItem", (...args: unknown[]) => {
        const item   = args[0] as FoundryItem;
        const userId = args[2] as string | undefined;

        if (!userId || userId !== game.user?.id) return;
        if (!isKiaiDivinoPoder(item)) return;

        void cleanupKiaiAE(item);
    });
}

/**
 * Kiai Divino — Dano Máximo
 *
 * Texto: "Uma vez por rodada, quando faz um ataque corpo a corpo, você pode
 * pagar 3 PM. Se acertar o ataque, causa dano máximo, sem necessidade de
 * rolar dados."
 *
 * Implementação via AE nativa do T20:
 *   - Detecta o poder "Kiai Divino" no inventário de qualquer ator.
 *   - Injeta um AE embedded no item do poder com:
 *       transfer: true  → Foundry propaga automaticamente ao ator
 *       disabled: true  → não pre-checked no dialog, não auto-aplicado
 *       flags.tormenta20.onuse: true, attack: true, custo: "3"
 *       changes: [{key:"dano", value:"max", mode:0}]
 *   - T20 trata `value:"max"` com mode CUSTOM setando `options.minmax = "max"`
 *     em applyRollChanges → damageRoll recebe minmax:"max" → evaluate({maximize:true}).
 *   - O custo de 3 PM é debitado automaticamente pelo mecanismo de consumeMana do T20.
 *
 * Não é necessário monkey-patch nenhum: é 100% T20-nativo.
 */

import { MODULE_ID } from "@/constants";
import { normalizeCondName } from "@/spell-resistance/index";
import { log } from "@/utils/logging";

// ── Constantes ────────────────────────────────────────────────────────────────

const KIAI_FLAG = "kiai";
const KIAI_PODER_NAME = "kiai divino";

// ── GM election ───────────────────────────────────────────────────────────────

function isActiveGM(): boolean {
    const myId = game.user?.id;
    if (!myId || !game.user?.isGM) return false;
    const activeGMs = (game.users?.contents ?? [])
        .filter(u => u.isGM && u.active)
        .map(u => u.id)
        .sort();
    return activeGMs[0] === myId;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isKiaiDivinoPoder(item: FoundryItem): boolean {
    if (item.type !== "poder") return false;
    return normalizeCondName(item.name).includes(KIAI_PODER_NAME);
}

function hasKiaiAE(item: FoundryItem): boolean {
    return (item.effects?.contents ?? []).some(e => {
        const flags = (e.flags as Record<string, Record<string, unknown>>)?.[MODULE_ID];
        return Boolean(flags?.[KIAI_FLAG]);
    });
}

function buildKiaiAEData(): Record<string, unknown> {
    return {
        name: "Kiai Divino",
        icon: "systems/tormenta20/icons/svg/skills.svg",
        // disabled: true → checkbox desmarcado por default no AbilityUseDialog
        //   ({{#unless ap.disabled}}checked{{/unless}} no template HBS do T20)
        // Impede auto-aplicação quando o dialog não abre (branch sem configureDialog
        //   usa `!ef.disabled` como filtro) e não aplica passivamente ao ator.
        disabled: true,
        // transfer: true → Foundry propaga cópia deste AE ao ator automaticamente
        // quando o item é adicionado, e remove quando o item é deletado.
        transfer: true,
        changes: [
            // mode 0 = CHANGEMODES.CUSTOM. Em applyRollChanges do T20, value "max"
            // aciona `options.minmax = "max"`, que depois passa para
            // damageRoll({ ..., minmax: "max" }) → roll.evaluate({ maximize: true }).
            // key "dano" casa com r.key.match(/dano/) cobrindo "dano0", "dano1", etc.
            // Para item.type="arma", ch.key==="roll" é excluído; usamos "dano".
            { key: "dano", value: "max", mode: 0, priority: 20 },
        ],
        flags: {
            tormenta20: {
                onuse: true,
                durationScene: false,
                // attack: true → aparece no AbilityUseDialog de armas
                // (actor.effects.filter(ae => filterAE(ae, ["onuse","attack"])))
                attack: true,
                // custo: "3" → mostrado no dialog como "3 PM"; T20 acumula em
                // item.system.ativacao.custo e debita via consumeMana.
                custo: "3",
            },
            [MODULE_ID]: {
                [KIAI_FLAG]: true,
            },
        },
    };
}

async function ensureKiaiAE(item: FoundryItem): Promise<void> {
    if (hasKiaiAE(item)) return;
    type ItemWithCreate = FoundryItem & {
        createEmbeddedDocuments(type: string, data: unknown[]): Promise<unknown>;
    };
    try {
        await (item as ItemWithCreate).createEmbeddedDocuments("ActiveEffect", [buildKiaiAEData()]);
        log(`Kiai Divino: AE adicionado ao poder "${item.name}" (ator: ${(item as unknown as { parent?: { name?: string } }).parent?.name ?? "?"})`);
    } catch (err) {
        console.warn(`[${MODULE_ID}] Kiai Divino: falha ao adicionar AE em "${item.name}":`, err);
    }
}

// ── Entrada pública ───────────────────────────────────────────────────────────

export function setupKiaiDivino(): void {
    // ready: GM primary sincroniza todos os atores existentes.
    // Isso cobre personagens que já tinham o poder antes do módulo ser instalado
    // ou atualizado.
    Hooks.once("ready", () => {
        if (!isActiveGM()) return;
        for (const actorLike of game.actors?.contents ?? []) {
            const actor = actorLike as FoundryActor;
            for (const item of actor.items?.contents ?? []) {
                if (isKiaiDivinoPoder(item)) {
                    void ensureKiaiAE(item);
                }
            }
        }
    });

    // createItem: quando o poder é adicionado ao ator (drag & drop ou importação).
    // args[2] = userId — apenas quem criou o item processa, evitando duplicatas
    // quando múltiplos clientes recebem o hook simultaneamente.
    Hooks.on("createItem", (...args: unknown[]) => {
        const item   = args[0] as FoundryItem;
        const userId = args[2] as string | undefined;

        if (!userId || userId !== game.user?.id) return;
        if (!(item as unknown as { parent?: unknown }).parent) return; // não é owned
        if (!isKiaiDivinoPoder(item)) return;

        void ensureKiaiAE(item);
    });
}

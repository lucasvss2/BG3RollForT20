/**
 * Kiai Divino — Dano Máximo
 *
 * Texto: "Uma vez por rodada, quando faz um ataque corpo a corpo, você pode
 * pagar 3 PM. Se acertar o ataque, causa dano máximo, sem necessidade de
 * rolar dados."
 *
 * Implementação via AE nativa do T20:
 *   - Detecta o poder "Kiai Divino" no inventário de qualquer ator.
 *   - Cria a mesma AE em DUAS coleções (padrão T20, ver tormenta20.mjs:15248-15249):
 *       (1) item.effects do poder      → para limpeza quando o item é removido
 *       (2) actor.effects do ator      → necessário pois AbilityUseDialog do T20
 *                                         (linha 6193) filtra `item.actor.effects`
 *                                         para coletar aprimoramentos.
 *     Em Foundry v13 `transfer: true` NÃO clona automaticamente o AE em
 *     `actor.effects` — só fica acessível via `actor.allApplicableEffects()`.
 *     T20 ignora esse último e itera direto a coleção, então a cópia precisa
 *     ser criada manualmente.
 *   - AE config:
 *       disabled: true   → checkbox desmarcado no dialog ({{#unless ap.disabled}}checked{{/unless}}).
 *                          T20 só consulta `disabled` para filtros passivos; AEs disabled
 *                          que o jogador selecionar no dialog SÃO processadas em onUseEffects.
 *       transfer: true   → mantido por convenção T20; não afeta nada porque criamos manual.
 *       flags.tormenta20: { onuse, attack, custo: "3", durationScene: false }
 *       changes: [{key:"dano", value:"max", mode:0 (CUSTOM)}]
 *       origin: item.uuid → vincula AE do actor ao poder; usado na limpeza.
 *   - applyRollChanges (T20) detecta `mode:0` + `value:"max"` em key matching
 *     `/dano/` → seta `options.minmax = "max"` → damageRoll evaluate({maximize:true}).
 *   - 3 PM debitados automaticamente via mecanismo `consumeMana` do T20.
 */

import { MODULE_ID } from "@/constants";
import { normalizeCondName } from "@/spell-resistance/index";
import { log } from "@/utils/logging";

// ── Constantes ────────────────────────────────────────────────────────────────

const KIAI_FLAG = "kiai";
const KIAI_PODER_NAME = "kiai divino";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface WithCreateEmbedded {
    createEmbeddedDocuments(type: string, data: unknown[], options?: Record<string, unknown>): Promise<unknown>;
    deleteEmbeddedDocuments(type: string, ids: string[], options?: Record<string, unknown>): Promise<unknown>;
}

interface WithUuid {
    uuid: string;
}

function isKiaiDivinoPoder(item: FoundryItem): boolean {
    if (item.type !== "poder") return false;
    return normalizeCondName(item.name).includes(KIAI_PODER_NAME);
}

function isKiaiAE(ae: { flags?: unknown }): boolean {
    const flags = ae.flags as Record<string, Record<string, unknown>> | undefined;
    return Boolean(flags?.[MODULE_ID]?.[KIAI_FLAG]);
}

function hasKiaiAEOnItem(item: FoundryItem): boolean {
    return (item.effects?.contents ?? []).some(isKiaiAE);
}

function hasKiaiAEOnActor(actor: FoundryActor, itemUuid: string): boolean {
    return (actor.effects?.contents ?? []).some(e => {
        const origin = (e as unknown as { origin?: string }).origin;
        return isKiaiAE(e) && origin === itemUuid;
    });
}

function buildKiaiAEData(itemUuid: string): Record<string, unknown> {
    return {
        name: "Kiai Divino",
        icon: "systems/tormenta20/icons/svg/skills.svg",
        origin: itemUuid,
        disabled: true,
        transfer: true,
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

async function ensureKiaiAE(item: FoundryItem): Promise<void> {
    const actor = (item as unknown as { actor?: FoundryActor }).actor;
    if (!actor) return;
    const itemUuid = (item as unknown as WithUuid).uuid;
    if (!itemUuid) return;

    const needsItem  = !hasKiaiAEOnItem(item);
    const needsActor = !hasKiaiAEOnActor(actor, itemUuid);
    if (!needsItem && !needsActor) return;

    const effectData = buildKiaiAEData(itemUuid);

    try {
        if (needsItem) {
            await (item as unknown as WithCreateEmbedded)
                .createEmbeddedDocuments("ActiveEffect", [effectData], { render: false });
        }
        if (needsActor) {
            await (actor as unknown as WithCreateEmbedded)
                .createEmbeddedDocuments("ActiveEffect", [effectData], { render: false });
        }
        log(`Kiai Divino: AE garantido em "${item.name}" (ator: ${actor.name}) — item=${needsItem ? "criado" : "ok"}, actor=${needsActor ? "criado" : "ok"}`);
    } catch (err) {
        console.warn(`[${MODULE_ID}] Kiai Divino: falha ao garantir AE em "${item.name}":`, err);
    }
}

async function cleanupKiaiAE(item: FoundryItem): Promise<void> {
    const actor = (item as unknown as { actor?: FoundryActor; parent?: FoundryActor }).actor
        ?? (item as unknown as { parent?: FoundryActor }).parent;
    if (!actor) return;
    const itemUuid = (item as unknown as WithUuid).uuid;
    if (!itemUuid) return;

    const stale = (actor.effects?.contents ?? []).filter(e => {
        const origin = (e as unknown as { origin?: string }).origin;
        return isKiaiAE(e) && origin === itemUuid;
    });
    if (!stale.length) return;

    const ids = stale.map(e => (e as unknown as { id: string }).id).filter(Boolean);
    if (!ids.length) return;

    try {
        await (actor as unknown as WithCreateEmbedded)
            .deleteEmbeddedDocuments("ActiveEffect", ids, { render: false });
    } catch (err) {
        console.warn(`[${MODULE_ID}] Kiai Divino: falha ao limpar AE do ator (poder deletado):`, err);
    }
}

// ── Entrada pública ───────────────────────────────────────────────────────────

export function setupKiaiDivino(): void {
    // ready: cada usuário processa SEUS atores controlados (owner level 3).
    // Election por owner evita race entre múltiplos GMs e cobre o caso comum
    // do jogador controlando seu próprio PC.
    Hooks.once("ready", () => {
        const myId = game.user?.id;
        if (!myId) return;
        for (const actorLike of game.actors?.contents ?? []) {
            const actor = actorLike as FoundryActor;
            const ownLevel = (actor.ownership as Record<string, number> | undefined)?.[myId] ?? 0;
            // 3 = OWNER. Apenas o owner processa para evitar dups.
            // Fallback: GM processa atores sem owner explícito.
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

    // createItem: quando o poder é adicionado ao ator (drag & drop ou importação).
    // userId-gated: apenas quem disparou processa.
    Hooks.on("createItem", (...args: unknown[]) => {
        const item   = args[0] as FoundryItem;
        const userId = args[2] as string | undefined;

        if (!userId || userId !== game.user?.id) return;
        if (!(item as unknown as { parent?: unknown }).parent) return;
        if (!isKiaiDivinoPoder(item)) return;

        void ensureKiaiAE(item);
    });

    // deleteItem: limpa AE residual do actor quando o poder é removido.
    // Sem este hook, a AE no ator persistiria órfã (origin apontando para
    // item.uuid que não existe mais).
    Hooks.on("deleteItem", (...args: unknown[]) => {
        const item   = args[0] as FoundryItem;
        const userId = args[2] as string | undefined;

        if (!userId || userId !== game.user?.id) return;
        if (!isKiaiDivinoPoder(item)) return;

        void cleanupKiaiAE(item);
    });
}

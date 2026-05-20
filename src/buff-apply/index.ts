/**
 * Power buff auto-apply
 *
 * Quando um PODER (poder/habilidade de classe, talento, etc.) com efeitos de
 * buff é usado e o lançador tem tokens marcados com T, este módulo aplica
 * automaticamente TODOS os grupos de ActiveEffect a cada alvo marcado.
 *
 * NÃO se aplica a magias (tipo arc/div/uni) — essas são tratadas pelo modal
 * unificado em spell-resistance/index.ts.
 *
 * Requisitos para o auto-apply disparar:
 *  1. O usuário é o AUTOR da mensagem (garante alvos T corretos).
 *  2. A mensagem possui ao menos 1 grupo de efeito em flags.tormenta20.effects.
 *  3. A mensagem tem itemData e NÃO é magia (tipo ≠ arc/div/uni).
 *  4. Ao menos 1 token T-marcado.
 *  5. O item tem flag MODULE_ID.autoApplyItems[itemId] = true (GM liga via ⚡ na ficha).
 *  6. Sem roll de dano ou ataque (poder ofensivo vai pelo fluxo normal).
 *
 * Player → GM: se o user não for GM, delega via socket ao GM (que tem
 * permissão de modificar atores arbitrários).
 */

import { MODULE_ID } from "@/constants";
import { autoApplyBuffEffects, extractItemId, getMsgAuthorId } from "@/spell-resistance/index";

// ── Constantes ────────────────────────────────────────────────────────────────

const SPELL_TIPOS = ["arc", "div", "uni"] as const;

// ── Lógica principal ──────────────────────────────────────────────────────────

async function processBuffMessage(message: ChatMessage): Promise<void> {
    // 1. Apenas o autor processa
    if (getMsgAuthorId(message) !== game.user?.id) return;

    // 2. Deve ter grupos de efeito
    type EffectData = Record<string, unknown>;
    const effectGroups = message.getFlag("tormenta20", "effects") as EffectData[][] | undefined;
    if (!effectGroups?.length) return;

    // 3. Deve ter itemData e NÃO ser magia
    const itemData = message.getFlag("tormenta20", "itemData") as Record<string, unknown> | undefined;
    if (!itemData) return;
    const tipo = itemData["tipo"] as string | undefined;
    if (tipo && (SPELL_TIPOS as readonly string[]).includes(tipo)) return;

    // 4. Alvos T-marcados
    const targets = game.user?.targets as Set<FoundryToken> | undefined;
    if (!targets?.size) return;
    const allTargets = Array.from(targets) as FoundryToken[];

    // 5. Flag autoApply ligada para este item (ID extraído do HTML do card)
    const casterActorId = message.speaker?.actor ?? "";
    const casterActor   = game.actors?.get(casterActorId);
    const itemId        = extractItemId(message);
    type ActorWithFlags = FoundryActor & { getFlag(scope: string, key: string): unknown };
    const autoApplyMap  = (casterActor as ActorWithFlags | undefined)?.getFlag(MODULE_ID, "autoApplyItems") as Record<string, boolean> | undefined;
    if (!itemId || !autoApplyMap?.[itemId]) return;

    // 6. Sem roll de dano ou ataque
    const rolls = message.rolls ?? [];
    const hasDamageRoll = rolls.some(r => (r.options as Record<string, unknown>)?.["type"] === "damage");
    const hasAttackRoll = rolls.some(r => (r.options as Record<string, unknown>)?.["type"] === "attack");
    if (hasDamageRoll || hasAttackRoll) return;

    const casterName = message.speaker?.alias ?? "Lançador";
    await autoApplyBuffEffects(effectGroups, allTargets, casterName);
}

// ── Entrada pública ───────────────────────────────────────────────────────────

export function setupBuffApply(): void {
    Hooks.on("createChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;
        void processBuffMessage(message);
    });
}

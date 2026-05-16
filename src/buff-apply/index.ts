/**
 * Power buff auto-apply
 *
 * Quando um PODER (poder/habilidade de classe, talento, etc.) com efeitos de
 * buff é usado e o lançador tem tokens marcados com T, este módulo aplica
 * automaticamente TODOS os grupos de ActiveEffect a cada alvo amigável marcado.
 *
 * NÃO se aplica a magias (tipo arc/div/uni) — essas são tratadas pelo modal
 * unificado em spell-resistance/index.ts.
 *
 * Requisitos para o auto-apply disparar:
 *  1. O usuário atual é o autor da mensagem.
 *  2. O usuário é GM (único com permissão de aplicar efeitos em atores arbitrários).
 *  3. A mensagem possui ao menos 1 grupo de efeito em flags.tormenta20.effects.
 *  4. A mensagem tem itemData e NÃO é magia (tipo ≠ arc/div/uni).
 *  5. Ao menos 1 token T-marcado.
 *  5b. O item específico tem flag MODULE_ID.autoApply = true (desligado por padrão; GM liga via ⚡ na ficha).
 *  6. Todos os alvos T são amigáveis (disposition >= 1 ou o próprio lançador).
 *  7. Sem roll de dano ou ataque (poder ofensivo vai pelo fluxo normal).
 */

import { MODULE_ID } from "@/constants";

// ── Constantes ────────────────────────────────────────────────────────────────

const SPELL_TIPOS = ["arc", "div", "uni"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMsgAuthorId(message: ChatMessage): string {
    const m = message as unknown as { author?: { id: string }; user?: { id: string } | string };
    return m.author?.id ?? (typeof m.user === "object" ? m.user?.id : m.user) ?? "";
}

// ── Lógica principal ──────────────────────────────────────────────────────────

async function processBuffMessage(message: ChatMessage): Promise<void> {
    // 1. Somente o autor da mensagem dispara o auto-apply
    if (getMsgAuthorId(message) !== game.user?.id) return;

    // 2. Somente o GM pode aplicar efeitos a atores arbitrários
    if (!game.user?.isGM) return;

    // 3. Deve ter grupos de efeito (botões chat-apply-ae)
    type EffectData = Record<string, unknown>;
    const effectGroups = message.getFlag("tormenta20", "effects") as EffectData[][] | undefined;
    if (!effectGroups?.length) return;

    // 4. Deve ter itemData e NÃO pode ser magia
    const itemData = message.getFlag("tormenta20", "itemData") as Record<string, unknown> | undefined;
    if (!itemData) return;

    const tipo = itemData["tipo"] as string | undefined;
    if (tipo && (SPELL_TIPOS as readonly string[]).includes(tipo)) return; // é magia → modal cuida

    // 5. Deve ter alvos T-marcados
    const targets = game.user?.targets;
    if (!targets?.size) return;
    const allTargets = Array.from(targets);

    // 5b. Verifica flag de auto-apply no item específico (por item, não por ator)
    const casterActorId = message.speaker?.actor ?? "";
    const casterActor   = game.actors?.get(casterActorId);
    const itemId        = itemData["_id"] as string | undefined;
    type ItemWithFlags  = FoundryItem & { getFlag(scope: string, key: string): unknown };
    const item          = itemId ? (casterActor?.items?.get(itemId) as ItemWithFlags | undefined) : undefined;
    const autoApply     = (item?.getFlag(MODULE_ID, "autoApply") as boolean | undefined) ?? false;
    if (!autoApply) return;

    // 6. Todos os alvos precisam ser amigáveis (buff de aliado, não ataque)
    const allTargetsFriendly = allTargets.every(token => {
        if (token.actor?.id === casterActorId) return true; // auto-buff
        const tDoc = (token as unknown as { document?: { disposition?: number } }).document;
        return (tDoc?.disposition ?? 0) >= 1;
    });
    if (!allTargetsFriendly) return;

    // 7. Sem roll de dano ou ataque (poder ofensivo → não auto-aplica)
    const rolls = message.rolls ?? [];
    const hasDamageRoll = rolls.some(r => (r.options as Record<string, unknown>)?.["type"] === "damage");
    const hasAttackRoll  = rolls.some(r => (r.options as Record<string, unknown>)?.["type"] === "attack");
    if (hasDamageRoll || hasAttackRoll) return;

    // ── Aplica todos os grupos de efeito a todos os alvos ─────────────────────
    let appliedCount = 0;

    for (const effectGroup of effectGroups) {
        if (!Array.isArray(effectGroup) || !effectGroup.length) continue;

        for (const token of allTargets) {
            const actor = token.actor;
            if (!actor) continue;

            // Deep-clone para não mutar os flags da mensagem
            const effectData: EffectData[] = JSON.parse(JSON.stringify(effectGroup)) as EffectData[];

            // Define startTime para efeitos com duração em segundos
            const firstDur = effectData[0]?.["duration"] as Record<string, unknown> | undefined;
            if (firstDur?.["seconds"]) {
                const g = game as unknown as { time?: { worldTime: number } };
                firstDur["startTime"] = g.time?.worldTime ?? 0;
            }

            try {
                // Apenas a primeira chamada envia notificação no chat (toChat: true)
                await actor.createEmbeddedDocuments("ActiveEffect", effectData, {
                    toChat: appliedCount === 0,
                });
                appliedCount++;
            } catch (err) {
                console.warn(`[${MODULE_ID}] Falha ao aplicar poder em ${actor.name}:`, err);
            }
        }
    }

    if (appliedCount > 0) {
        const names = allTargets
            .filter(t => t.actor)
            .map(t => t.actor!.name)
            .join(", ");
        ui.notifications?.info(`Poder aplicado automaticamente: ${names}`);
    }
}

// ── Entrada pública ───────────────────────────────────────────────────────────

export function setupBuffApply(): void {
    Hooks.on("createChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;
        void processBuffMessage(message);
    });
}

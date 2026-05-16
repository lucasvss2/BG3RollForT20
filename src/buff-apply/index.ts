/**
 * Buff auto-apply
 *
 * When a buff spell/power is cast (one with `chat-apply-ae` effect buttons in the
 * chat card) and the caster already has tokens targeted with T, this module
 * automatically applies all of the spell's ActiveEffect groups to every targeted
 * actor — mirroring exactly what clicking each `chat-apply-ae` button would do.
 *
 * The manual buttons in the chat card remain untouched so the GM can still apply
 * effects to tokens that were not targeted beforehand.
 *
 * Only runs for the GM (who has permission to apply effects to any actor).
 * Spells already handled by the spell-resistance dialog (those with resistência
 * text or a damage roll) are ignored here.
 */

import { MODULE_ID } from "@/constants";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMsgAuthorId(message: ChatMessage): string {
    const m = message as unknown as { author?: { id: string }; user?: { id: string } | string };
    return m.author?.id ?? (typeof m.user === "object" ? m.user?.id : m.user) ?? "";
}

// ── Core auto-apply logic ─────────────────────────────────────────────────────

async function processBuffMessage(message: ChatMessage): Promise<void> {
    // Only the message author triggers auto-apply
    if (getMsgAuthorId(message) !== game.user?.id) return;

    // Only the GM can apply effects to arbitrary actors
    if (!game.user?.isGM) return;

    // Must have T20 effect groups for chat-apply-ae buttons
    type EffectData = Record<string, unknown>;
    const effectGroups = message.getFlag("tormenta20", "effects") as EffectData[][] | undefined;
    if (!effectGroups?.length) return;

    // Spells with MULTIPLE buttons (e.g. Oração: Bônus + Penalidade, Concentração de
    // Combate) require the GM to choose which button to press — skip auto-apply.
    if (effectGroups.length !== 1) return;

    // Must have T-targeted tokens
    const targets = game.user?.targets;
    if (!targets?.size) return;

    const allTargets = Array.from(targets);

    // Determine if every T-target is friendly (or is the caster itself).
    // Self/ally buffs like Santuário carry a `resistencia.txt` (e.g. "Vontade
    // anula") that refers to ATTACKERS testing against the protected target —
    // it is not a resistance the target of the buff makes.  We use disposition
    // to differentiate: when all targets are friendly to the caster, auto-apply
    // regardless of resistTxt.  For hostile/mixed targets, fall back to the
    // spell-resistance pipeline.
    const casterActorId = message.speaker?.actor ?? "";
    const allTargetsFriendly = allTargets.every(token => {
        if (token.actor?.id === casterActorId) return true;        // self-cast
        const tDoc = (token as unknown as { document?: { disposition?: number } }).document;
        return (tDoc?.disposition ?? 0) >= 1;                       // friendly
    });

    // Skip spells already handled by the spell-resistance / auto-damage dialogs
    const itemData = message.getFlag("tormenta20", "itemData") as Record<string, unknown> | undefined;
    if (itemData) {
        // Always skip damaging or attacking spells (handled elsewhere)
        const hasDamageRoll = (message.rolls ?? []).some(
            r => (r.options as Record<string, unknown>)?.["type"] === "damage",
        );
        if (hasDamageRoll) return;
        const hasAttackRoll = (message.rolls ?? []).some(
            r => (r.options as Record<string, unknown>)?.["type"] === "attack",
        );
        if (hasAttackRoll) return;

        // Only skip on resistTxt when at least one target is NOT friendly.
        // For Santuário-style ally buffs, resistTxt refers to attackers, not the
        // buff's target — proceed with auto-apply.
        if (!allTargetsFriendly) {
            const resistTxt = ((itemData["resistencia"] as { txt?: string } | undefined)?.txt ?? "").trim();
            if (resistTxt) return;
        }
    }

    // For non-GM users (e.g. a player casting a self-buff), only apply effects to
    // actors the player owns (level 3 = OWNER). Unowned targets still have the
    // manual chat button as fallback.
    const effectTargets = game.user?.isGM
        ? allTargets
        : allTargets.filter(token => {
            const actor = token.actor;
            if (!actor) return false;
            const ownershipLevel = (actor.ownership as Record<string, number>)[game.user!.id] ?? 0;
            return ownershipLevel >= 3;
        });
    if (!effectTargets.length) return;

    let appliedCount = 0;

    for (const effectGroup of effectGroups) {
        if (!Array.isArray(effectGroup) || !effectGroup.length) continue;

        for (const token of effectTargets) {
            const actor = token.actor;
            if (!actor) continue;

            // Deep-clone so we don't mutate the flags stored on the message
            const effectData: EffectData[] = JSON.parse(JSON.stringify(effectGroup)) as EffectData[];

            // Set startTime when effect has a seconds-based duration
            // (mirrors the T20 _onChatCardApplyEffect handler)
            const firstDur = effectData[0]?.["duration"] as Record<string, unknown> | undefined;
            if (firstDur?.["seconds"]) {
                const g = game as unknown as { time?: { worldTime: number } };
                firstDur["startTime"] = g.time?.worldTime ?? 0;
            }

            try {
                // Only the very first createEmbeddedDocuments call gets toChat:true
                // so that exactly one status notification card appears in chat.
                await actor.createEmbeddedDocuments("ActiveEffect", effectData, {
                    toChat: appliedCount === 0,
                });
                appliedCount++;
            } catch (err) {
                console.warn(`[${MODULE_ID}] Falha ao aplicar buff em ${actor.name}:`, err);
            }
        }
    }

    if (appliedCount > 0) {
        const names = effectTargets
            .filter(t => t.actor)
            .map(t => t.actor!.name)
            .join(", ");
        ui.notifications?.info(`Buffs aplicados automaticamente: ${names}`);
    }
}

// ── Public entry point ────────────────────────────────────────────────────────

export function setupBuffApply(): void {
    Hooks.on("createChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;
        void processBuffMessage(message);
    });
}

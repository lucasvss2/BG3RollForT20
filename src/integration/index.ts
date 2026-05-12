/**
 * Integration layer: connects the T20 parser to the BG3 cinematic overlay.
 *
 * The module ships its own overlay (BG3Overlay) and works fully standalone —
 * aeris-bg3-rolls is NOT required.
 *
 * Roll interception flow:
 *   1. createChatMessage  → parse roll, register as "pending"
 *   2. diceSoNice:rollComplete → show overlay AFTER the 3D dice animation
 *      (if Dice So Nice is not active, show immediately at step 1)
 *
 * If aeris-bg3-rolls is somehow active, we additionally register the T20
 * parser with it (strategies 1–3) so both overlays are aware of T20 rolls.
 */

import { parseT20 } from "@/parser/t20";
import {
    BG3_MODULE_ID,
    BG3_ALERT_HOOK,
    BG3_REGISTER_HOOK,
    BG3_READY_HOOK,
    MODULE_ID,
    SYSTEM_ID,
} from "@/constants";
import { log } from "@/utils/logging";
import { BG3Overlay } from "@/overlay/BG3Overlay";

// ── Public entry point ────────────────────────────────────────────────────────

export function setupIntegration(): void {
    installOverlayHook();

    const bg3 = game.modules.get(BG3_MODULE_ID);
    if (!bg3?.active) {
        log(`"${BG3_MODULE_ID}" não está ativo — modo standalone.`);
        return;
    }

    log("aeris-bg3-rolls detectado e ativo — registrando parser T20…");

    Hooks.on(BG3_READY_HOOK, (...args: unknown[]) => {
        const api = args[0] as AerisBG3RollsAPI | undefined;
        if (typeof api?.registerParser === "function") {
            api.registerParser(SYSTEM_ID, parseT20);
            log("Parser T20 registrado via aeris-bg3-rolls.ready hook.");
        }
    });

    Hooks.callAll(BG3_REGISTER_HOOK, SYSTEM_ID, parseT20);

    Hooks.once("ready", () => {
        if (tryGlobalApiRegistration()) return;
        tryLibWrapperPatch();
    });
}

// ── Core overlay hook ─────────────────────────────────────────────────────────

/** Pending overlays waiting for the Dice So Nice animation to complete. */
const pendingOverlays = new Map<string, { meta: RollMeta; roll: Roll }>();

function installOverlayHook(): void {
    // Intercept after the ChatMessage has been persisted (all data available)
    Hooks.on("createChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;

        if (game.system.id !== SYSTEM_ID) return;

        // Accept any message that carries rolls — do not gate on message.isRoll
        // because some systems set the message type differently
        if (!message.rolls?.length) return;

        const flavor = resolveFlavorText(message);
        log(`Roll detectado — flavor: "${flavor}"`);

        const rollMeta = parseT20({ flavor });
        if (!rollMeta) {
            log(`Tipo não reconhecido (${flavor || "sem flavor"}) — ignorado.`);
            return;
        }

        const roll = message.rolls[0];
        if (!roll) return;

        // If Dice So Nice is active, wait for its animation before showing
        const dicesonice = game.modules.get("dice-so-nice");
        if (dicesonice?.active) {
            pendingOverlays.set(message.id, { meta: rollMeta, roll });
            // Safety net: show after 8 s even if the completion hook never fires
            setTimeout(() => showPending(message.id), 8000);
        } else {
            BG3Overlay.show(rollMeta, roll);
        }

        // If aeris-bg3-rolls is somehow active, fire its orchestrator hook too
        const bg3 = game.modules.get(BG3_MODULE_ID);
        if (bg3?.active) {
            Hooks.callAll(BG3_ALERT_HOOK, {
                message,
                rollMeta,
                roll,
                userId: args[2] as string,
            });
        }
    });

    // Show overlay after the Dice So Nice 3D animation completes
    Hooks.on("diceSoNice:rollComplete", (...args: unknown[]): void => {
        const messageId = args[0] as string;
        showPending(messageId);
    });

    log("Overlay cinemático T20 instalado.");
}

function showPending(messageId: string): void {
    const pending = pendingOverlays.get(messageId);
    if (!pending) return;
    pendingOverlays.delete(messageId);
    BG3Overlay.show(pending.meta, pending.roll);
}

/**
 * Resolve the flavor text for a ChatMessage.
 * Tries three sources in order:
 *   1. message.flavor (set by most systems on the message or first roll)
 *   2. First <h1>–<h6> element in the message content HTML
 *   3. First plain-text line of the message content
 */
function resolveFlavorText(message: ChatMessage): string {
    const direct = message.flavor?.trim();
    if (direct) return direct;

    const content = message.content ?? "";

    const headingMatch = content.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i);
    if (headingMatch?.[1]) return headingMatch[1].trim();

    const textOnly = content
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return textOnly.slice(0, 200);
}

// ── Strategy 2: game.bg3rolls global API ─────────────────────────────────────

function tryGlobalApiRegistration(): boolean {
    const api = game.bg3rolls;
    if (typeof api?.registerParser !== "function") return false;
    api.registerParser(SYSTEM_ID, parseT20);
    log("Parser T20 registrado via game.bg3rolls.registerParser().");
    return true;
}

// ── Strategy 3: libWrapper ────────────────────────────────────────────────────

function tryLibWrapperPatch(): boolean {
    if (typeof libWrapper === "undefined") return false;

    const target = `game.modules.get("${BG3_MODULE_ID}").api.parseRollMeta`;
    try {
        libWrapper.register(
            MODULE_ID,
            target,
            function (this: unknown, wrapped, ...args: unknown[]) {
                const chatMessage = args[0] as ChatMessage;
                if (game.system.id !== SYSTEM_ID) {
                    return (wrapped as (msg: ChatMessage) => RollMeta | null)(chatMessage);
                }
                return (
                    parseT20({ flavor: chatMessage.flavor }) ??
                    (wrapped as (msg: ChatMessage) => RollMeta | null)(chatMessage)
                );
            },
            "MIXED",
        );
        log("parseRollMeta do aeris-bg3-rolls sobrescrito via libWrapper.");
        return true;
    } catch {
        return false;
    }
}

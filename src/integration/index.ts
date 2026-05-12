/**
 * Integration layer: connects the T20 parser to the BG3 cinematic overlay.
 *
 * The module ships its own overlay (BG3Overlay) and works fully standalone —
 * aeris-bg3-rolls is NOT required.  If aeris-bg3-rolls happens to be active
 * (e.g. the user forced it on), we additionally try to register our parser
 * with it so both overlays are aware of T20 rolls.
 *
 * Strategy 1 — Hook API (aeris-bg3-rolls optional)
 *   If aeris-bg3-rolls fires "aeris-bg3-rolls.ready" or listens for
 *   "aeris-bg3-rolls.registerParser", we register there too.
 *
 * Strategy 2 — Global API (aeris-bg3-rolls optional)
 *   Use game.bg3rolls.registerParser if available.
 *
 * Strategy 3 — libWrapper (aeris-bg3-rolls optional)
 *   MIXED-wrap parseRollMeta on the bg3 module API.
 *
 * Strategy 4 — preCreateChatMessage (primary / always active)
 *   Intercepts every T20 roll message, shows the BG3Overlay, and lets the
 *   chat message through normally so the roll is still recorded in chat.
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
    // Always install the standalone overlay hook first
    installOverlayHook();

    const bg3 = game.modules.get(BG3_MODULE_ID);
    if (!bg3?.active) {
        log(
            `"${BG3_MODULE_ID}" não está ativo — usando overlay próprio (modo standalone).`,
        );
        return;
    }

    log("aeris-bg3-rolls detectado e ativo — registrando parser T20…");

    // Strategy 1a: respond to the ready hook
    Hooks.on(BG3_READY_HOOK, (...args: unknown[]) => {
        const api = args[0] as AerisBG3RollsAPI | undefined;
        if (typeof api?.registerParser === "function") {
            api.registerParser(SYSTEM_ID, parseT20);
            log("Parser T20 registrado via aeris-bg3-rolls.ready hook.");
        }
    });

    // Strategy 1b: fire registration hook (catches early-init registrations)
    Hooks.callAll(BG3_REGISTER_HOOK, SYSTEM_ID, parseT20);

    // Strategies 2 & 3 run after bg3 finishes its own setup
    Hooks.once("ready", () => {
        if (tryGlobalApiRegistration()) return;
        tryLibWrapperPatch();
    });
}

// ── Strategy 4: standalone overlay (always installed) ─────────────────────────

function installOverlayHook(): void {
    Hooks.on("preCreateChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;

        if (game.system.id !== SYSTEM_ID) return;
        if (!message.isRoll || !message.rolls?.length) return;

        const rollMeta = parseT20({ flavor: message.flavor });
        if (!rollMeta) return;

        const roll = message.rolls[0];
        if (!roll) return;

        // Show our cinematic overlay
        BG3Overlay.show(rollMeta, roll);

        // If aeris-bg3-rolls is somehow also active, fire its orchestrator hook
        // so it can render its own overlay in parallel (user enabled it manually)
        const bg3 = game.modules.get(BG3_MODULE_ID);
        if (bg3?.active) {
            const userId = args[3] as string;
            Hooks.callAll(BG3_ALERT_HOOK, { message, rollMeta, roll, userId });
        }

        // Chat message is NOT suppressed — rolls remain in the chat log
    });

    log("Overlay cinemático T20 instalado.");
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

/**
 * Integration layer: connects our T20 parser to aeris-bg3-rolls.
 *
 * aeris-bg3-rolls internally dispatches to system parsers via a PARSERS
 * registry keyed by game.system.id. Because the registry lives inside the
 * bundled module, we use a prioritised strategy chain to reach it:
 *
 * Strategy 1 — Hook API
 *   aeris-bg3-rolls may fire "aeris-bg3-rolls.ready" with its API object or
 *   listen for "aeris-bg3-rolls.registerParser". If so, we call registerParser
 *   directly from there. This is the cleanest path.
 *
 * Strategy 2 — Global API
 *   aeris-bg3-rolls exposes `game.bg3rolls` globally (confirmed in its
 *   main.tsx). If that object has a registerParser method we use it.
 *
 * Strategy 3 — libWrapper
 *   If libWrapper is installed, we MIXED-wrap the parseRollMeta function
 *   exposed on the module API. For T20 messages we run our parser first; for
 *   any other system we fall through to the original.
 *
 * Strategy 4 — preCreateChatMessage interception (guaranteed fallback)
 *   We register our own Foundry hook, parse T20 flavor text, fire the
 *   aeris-bg3-rolls orchestrator hook directly, and suppress the plain chat
 *   message so it doesn't appear twice.
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
import { log, warn, notifyWarn } from "@/utils/logging";

// ── Public entry point ────────────────────────────────────────────────────────

export function setupIntegration(): void {
    const bg3 = game.modules.get(BG3_MODULE_ID);
    if (!bg3?.active) {
        warn(
            `O módulo "${BG3_MODULE_ID}" não está ativo. ` +
            `Instale e ative "Aeris BG3 Rolls" para habilitar a sobreposição cinemática de dados.`,
        );
        notifyWarn(
            `BG3RollForT20: instale e ative o módulo "Aeris BG3 Rolls" para que a sobreposição funcione.`,
        );
        return;
    }

    log("Setting up aeris-bg3-rolls integration for Tormenta20…");

    // Strategy 1a: respond to the ready hook (fires after init)
    Hooks.on(BG3_READY_HOOK, (...args: unknown[]) => {
        const api = args[0] as AerisBG3RollsAPI | undefined;
        if (typeof api?.registerParser === "function") {
            api.registerParser(SYSTEM_ID, parseT20);
            log("Registered T20 parser via aeris-bg3-rolls.ready hook.");
        }
    });

    // Strategy 1b: call the registration hook ourselves (in case bg3 already fired)
    Hooks.callAll(BG3_REGISTER_HOOK, SYSTEM_ID, parseT20);

    // Strategies 2 & 3 run after bg3 finishes its own setup
    Hooks.once("ready", () => {
        if (tryGlobalApiRegistration()) return;
        if (tryLibWrapperPatch()) return;
        // Strategy 4: always install as safety net (idempotent)
        installChatHookFallback();
    });

    // Also install the chat-hook fallback unconditionally; it guards against
    // races where strategies 1-3 succeed but an edge-case message slips through.
    installChatHookFallback();
}

// ── Strategy 2: game.bg3rolls global API ─────────────────────────────────────

function tryGlobalApiRegistration(): boolean {
    const api = game.bg3rolls;
    if (typeof api?.registerParser !== "function") return false;

    api.registerParser(SYSTEM_ID, parseT20);
    log("Registered T20 parser via game.bg3rolls.registerParser().");
    return true;
}

// ── Strategy 3: libWrapper ────────────────────────────────────────────────────

function tryLibWrapperPatch(): boolean {
    if (typeof libWrapper === "undefined") return false;

    // The most likely path the function is exposed under; adjust if bg3 changes.
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
        log("Patched aeris-bg3-rolls parseRollMeta via libWrapper.");
        return true;
    } catch {
        // Function path may not exist in this version of bg3 — fall through
        return false;
    }
}

// ── Strategy 4: preCreateChatMessage fallback ─────────────────────────────────

/**
 * Fire the aeris-bg3-rolls orchestrator hook directly for T20 roll messages.
 *
 * aeris-bg3-rolls' orchestrator listens for "aeris-bg3-rolls.alertChatMessage"
 * and groups the roll into the BG3 overlay. By firing it ourselves we bypass
 * the need to touch the internal PARSERS registry.
 *
 * The hook runs BEFORE the message is persisted. We suppress the plain chat
 * message only when we successfully parse a recognized T20 roll type; all
 * other messages (damage, unrecognized flavors, etc.) pass through normally.
 */
function installChatHookFallback(): void {
    Hooks.on(
        "preCreateChatMessage",
        (...args: unknown[]): boolean | void => {
            const message = args[0] as ChatMessage;
            const userId = args[3] as string;

            // Only intercept when we are the active system
            if (game.system.id !== SYSTEM_ID) return;

            // Only handle messages that carry at least one roll
            if (!message.isRoll || !message.rolls?.length) return;

            // If strategies 1-3 already registered the parser, bg3 will handle
            // the message natively; skip our hook to avoid double-processing.
            if (isAlreadyHandledByBg3(message)) return;

            const rollMeta = parseT20({ flavor: message.flavor });
            if (!rollMeta) return; // Unrecognized roll type — show in chat normally

            const roll = message.rolls[0];
            if (!roll) return;

            // Fire the orchestrator hook with the shape bg3 expects
            Hooks.callAll(BG3_ALERT_HOOK, {
                message,
                rollMeta,
                roll,
                userId,
            });

            // Suppress the plain chat message; the BG3 overlay takes over
            return false;
        },
    );

    log("Installed preCreateChatMessage fallback for T20 roll interception.");
}

/**
 * Heuristic: if bg3 already set its internal flag on this message it has
 * handled it via its own preCreateChatMessage hook. We skip our fallback to
 * avoid firing the orchestrator hook twice.
 */
function isAlreadyHandledByBg3(message: ChatMessage): boolean {
    const flags = message.flags?.[BG3_MODULE_ID];
    return flags !== undefined && flags !== null;
}

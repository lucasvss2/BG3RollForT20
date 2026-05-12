/**
 * aeris-bg3-rolls-t20 — main entry point
 *
 * Adds Tormenta20 (system id "t20") support to the aeris-bg3-rolls module so
 * that the BG3-style cinematic dice overlay works for T20 roll types
 * (perícias, resistências, ataques, iniciativa).
 *
 * Compatible content modules (Suplementos de Arton, Bestiário de Arton, etc.)
 * do not change roll mechanics and require no extra handling.
 */

import { MODULE_ID, SYSTEM_ID } from "./constants";
import { setupIntegration } from "./integration/index";
import { log, warn } from "./utils/logging";

// ── Init: sanity checks ───────────────────────────────────────────────────────

Hooks.once("init", () => {
    log(`Initializing v${getModuleVersion()}`);

    if (game.system.id !== SYSTEM_ID) {
        warn(
            `This module is designed for the "${SYSTEM_ID}" system, ` +
                `but the active system is "${game.system.id}". ` +
                `The module will remain inactive.`,
        );
        return;
    }
});

// ── Setup: wire up the aeris-bg3-rolls integration ────────────────────────────

Hooks.once("setup", () => {
    if (game.system.id !== SYSTEM_ID) return;
    setupIntegration();
});

// ── Ready: confirm everything loaded ─────────────────────────────────────────

Hooks.once("ready", () => {
    if (game.system.id !== SYSTEM_ID) return;
    log("Ready — Tormenta20 BG3 roll overlay active.");
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getModuleVersion(): string {
    return game.modules.get(MODULE_ID)?.version ?? "unknown";
}

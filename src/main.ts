/**
 * aeris-bg3-rolls-t20 — main entry point
 *
 * Standalone BG3-style cinematic dice overlay for the Tormenta20 system.
 * Intercepts T20 roll messages (perícias, resistências, ataques, iniciativa)
 * and displays a full-screen animated overlay with the roll result.
 *
 * aeris-bg3-rolls is recommended but NOT required — the module ships its own
 * overlay and works in any Foundry world running the t20 system.
 */

import { MODULE_ID, SYSTEM_ID } from "./constants";
import { setupIntegration } from "./integration/index";
import { setupDialogStyling } from "./dialogs/bg3-dialog";
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

// ── Setup: wire up roll integration and dialog styling ────────────────────────

Hooks.once("setup", () => {
    if (game.system.id !== SYSTEM_ID) return;
    setupIntegration();
    setupDialogStyling();
});

// ── Ready: confirm everything loaded ─────────────────────────────────────────

Hooks.once("ready", () => {
    if (game.system.id !== SYSTEM_ID) return;
    log("Pronto — overlay cinemático de dados Tormenta20 ativo.");
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getModuleVersion(): string {
    return game.modules.get(MODULE_ID)?.version ?? "unknown";
}

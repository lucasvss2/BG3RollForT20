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
import { setupTheme } from "./theme/index";
import { setupIntegration } from "./integration/index";
import { setupDialogStyling } from "./dialogs/bg3-dialog";
import { setupChatStyling } from "./chat/chatStyles";
import { setupHiddenTest } from "./hidden-test/index";
import { setupAutoDamage } from "./auto-damage/index";
import { setupSpellResistance } from "./spell-resistance/index";
import { setupBuffApply } from "./buff-apply/index";
import { setupWeaponAETransfer } from "./weapon-ae-transfer/index";
import { setupAreaSpells } from "./area-spells/index";
import { setupSkillsMenu } from "./ui/skills-menu";
import { setupSheetRedesign } from "./sheet/index";
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
    setupTheme();           // PRIMEIRO — tokens CSS disponíveis para os demais
    setupIntegration();
    setupDialogStyling();
    setupChatStyling();
    setupHiddenTest();
    setupAutoDamage();
    setupSpellResistance();
    setupBuffApply();
    setupWeaponAETransfer();
    setupSkillsMenu();   // antes de area-spells: estes registram ações no menu
    setupAreaSpells();
    setupSheetRedesign();
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

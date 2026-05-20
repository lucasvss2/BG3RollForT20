import { MODULE_ID } from "@/constants";
import { BG3Overlay } from "@/overlay/BG3Overlay";
import { onSocketReady } from "@/socket";
import { openHiddenTestGMDialog } from "./HiddenTestGMDialog";
import { openHiddenTestPlayerDialog } from "./HiddenTestPlayerDialog";
import type { HiddenTestFlag, HiddenTestRequest } from "./types";

/** Name used to register the player-side dialog handler on socketlib. */
export const SOCKET_HIDDEN_TEST_REQUEST = "hidden-test/request";

// ── CSS ───────────────────────────────────────────────────────────────────────

const HIDDEN_TEST_STYLES_ID = "bg3-t20-hidden-test-styles";

const HIDDEN_TEST_STYLES = `
/* ── Hidden test chat card ─────────────────────────────────────────────── */

.aeris-hidden-test-card {
    background: radial-gradient(ellipse at top, #1a1005 0%, #080503 100%);
    border: 1px solid #6a4e18;
    border-radius: 5px;
    box-shadow: 0 0 0 1px #0a0704, 0 0 0 3px #4a360e, 0 4px 20px rgba(0,0,0,0.8);
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    overflow: hidden;
    padding: 0;
}
.aeris-hidden-test-card .htc-header {
    background: linear-gradient(to right, transparent, rgba(106,78,24,0.2), transparent);
    border-bottom: 1px solid rgba(106,78,24,0.4);
    padding: 8px 14px 6px;
    text-align: center;
}
.aeris-hidden-test-card .htc-header-top {
    display: flex;
    justify-content: center;
    margin-bottom: 2px;
}
.aeris-hidden-test-card .htc-actor-name {
    color: #8a7a5a;
    font-size: 0.65rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}
.aeris-hidden-test-card .htc-applied-bonus {
    color: #b09060;
    font-size: 0.70rem;
    letter-spacing: 0.06em;
    margin-top: 3px;
}
.aeris-hidden-test-card .htc-skill-name {
    color: #c8a96e;
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-shadow: 0 0 14px rgba(200,169,110,0.55);
    text-transform: uppercase;
}
.aeris-hidden-test-card .htc-subtitle {
    color: #7a6e5a;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-top: 2px;
}
.aeris-hidden-test-card .htc-divider {
    background: linear-gradient(to right, transparent, rgba(200,169,110,0.5), transparent);
    height: 1px;
    margin: 0;
}
.aeris-hidden-test-card .htc-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 14px 12px;
    gap: 3px;
}
.aeris-hidden-test-card .htc-formula {
    color: #a89880;
    font-family: monospace;
    font-size: 0.78rem;
    letter-spacing: 0.04em;
}
.aeris-hidden-test-card .htc-dice-result {
    color: #c8b88a;
    font-family: monospace;
    font-size: 0.92rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-bottom: 2px;
}
.aeris-hidden-test-card .htc-dice-dropped {
    color: #7a6a4a;
    font-size: 0.80rem;
    font-weight: 400;
}
.aeris-hidden-test-card .htc-total {
    color: #f0ebe0;
    font-size: 3.2rem;
    font-weight: 900;
    line-height: 1;
    margin: 2px 0;
    text-shadow: 0 0 30px rgba(255,255,255,0.12);
}
.aeris-hidden-test-card .htc-outcome {
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    margin-top: 1px;
}
/* Outcome colour states */
.htc-crit    { color: #ffd700 !important; text-shadow: 0 0 12px rgba(255,215,0,0.7); }
.htc-success { color: #6ecf7a !important; text-shadow: 0 0 12px rgba(110,207,122,0.6); }
.htc-failure { color: #c8a070 !important; }
.htc-fumble  { color: #cc4444 !important; text-shadow: 0 0 12px rgba(204,68,68,0.6); }

/* ── Strip Foundry's default chat message wrapper ──────────────────────── */

.chat-message:has(.aeris-hidden-test-card) {
    background: transparent !important;
    background-image: none !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
}
.chat-message:has(.aeris-hidden-test-card) header,
.chat-message:has(.aeris-hidden-test-card) .message-header {
    display: none !important;
}
.chat-message:has(.aeris-hidden-test-card) .message-content {
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    background: transparent !important;
    background-image: none !important;
}

/* ── GM/Player dialog inner layout ────────────────────────────────────── */

.htg-body {
    padding: 4px 0 2px;
}
.htg-target-row {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 16px;
}
.htg-targets-list {
    padding: 4px 16px 0;
}
.htg-target-check-row {
    display: grid;
    grid-template-columns: 22px 1fr auto;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
}
.htg-target-check-row input[type="checkbox"] {
    width: 14px;
    height: 14px;
    cursor: pointer;
}
.htg-label-sm {
    color: #8a7450;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    flex: 0 0 auto;
}
.htg-value-lg {
    color: #e8d8a8;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.06em;
}
.htg-player-tag {
    color: #7a6e5a;
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    margin-left: auto;
}
.htg-divider {
    background: linear-gradient(to right, transparent, rgba(200,169,110,0.4), transparent);
    height: 1px;
    margin: 4px 16px;
}
.htg-request-banner {
    padding: 10px 16px 6px;
    text-align: center;
}
.htg-skill-name-lg {
    color: #c8a96e;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    font-size: clamp(1.4rem, 3vw, 1.9rem);
    font-weight: 700;
    letter-spacing: 0.18em;
    text-shadow: 0 0 20px rgba(200,169,110,0.6);
    text-transform: uppercase;
    margin: 4px 0 8px;
}
.htg-bonus-display {
    color: #e8d8a8;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    font-size: 1.3rem;
    font-weight: 700;
    flex: 1 1 auto;
    text-align: right;
    padding-right: 4px;
}
/* ── Powers list ───────────────────────────────────────────────────────── */

.htg-powers-section {
    padding: 2px 16px 0;
}
.htg-powers-header {
    display: grid;
    grid-template-columns: 26px 38px 1fr auto;
    gap: 6px;
    padding: 4px 0 2px;
}
.htg-power-row {
    display: grid;
    grid-template-columns: 26px 38px 1fr auto;
    gap: 6px;
    align-items: center;
    padding: 3px 0;
}
.htg-pm-cost {
    color: #c8a96e;
    font-family: monospace;
    font-size: 0.8rem;
    font-weight: 700;
}
.htg-power-name {
    color: #e8d8a8;
    font-size: 0.88rem;
}
.htg-col-bonus {
    text-align: right;
}
.htg-power-bonus {
    font-family: monospace;
    font-size: 0.82rem;
    text-align: right;
    min-width: 48px;
}
.htg-bonus-known {
    color: #8ecf8e;
}
.htg-bonus-advantage {
    color: #c8d870;
}
.htg-bonus-unknown {
    color: #aaa;
    font-style: italic;
}
.htg-pm-total-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-top: 1px solid rgba(200,169,110,0.2);
    margin-top: 5px;
    padding: 5px 0 2px;
}
.htg-pm-display {
    color: #c8a96e;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    font-size: 1.1rem;
    font-weight: 700;
}

/* ── Dialog button spacing ─────────────────────────────────────────────── */

.bg3-dialog .dialog-buttons,
.bg3-dialog footer.form-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
`;

function ensureHiddenTestStyles(): void {
    if (!document.getElementById(HIDDEN_TEST_STYLES_ID)) {
        const el = document.createElement("style");
        el.id = HIDDEN_TEST_STYLES_ID;
        el.textContent = HIDDEN_TEST_STYLES;
        document.head.appendChild(el);
    }
}

// ── Socket handler ────────────────────────────────────────────────────────────

function setupSocket(): void {
    onSocketReady((socket) => {
        socket.register(SOCKET_HIDDEN_TEST_REQUEST, (...args: unknown[]) => {
            const req = args[0] as HiddenTestRequest;
            // socketlib's executeAsUser already targets a single user — no
            // need to filter by targetUserId here. Keep the field on the
            // payload for chat/debug context.
            openHiddenTestPlayerDialog(req);
        });
    });
}

// ── createChatMessage hook: show overlay for hidden tests ─────────────────────

function setupChatHook(): void {
    Hooks.on("createChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;

        const flag = message.getFlag(MODULE_ID, "hiddenTest") as HiddenTestFlag | undefined;
        if (!flag) return;

        // In Foundry v13, message.rolls contains deserialized Roll instances.
        const rolls = message.rolls as Roll[] | undefined;
        if (!rolls?.length) return;

        const roll = rolls[0];

        const meta = { category: `Teste de ${flag.skillLabel}` };
        setTimeout(() => BG3Overlay.show(meta, roll, flag.outcome), 1000);
    });
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function injectToolbarButton(): void {
    if (!game.user?.isGM) return;
    if (document.getElementById("bg3-t20-hidden-test-btn")) return;

    // Foundry v13: <aside id="scene-controls"> > <menu id="scene-controls-layers"> > <li> > <button>
    const menu =
        document.querySelector("menu#scene-controls-layers") ??
        document.querySelector("aside#scene-controls menu") ??
        document.querySelector("#ui-left menu");

    if (!menu) return;

    const btn = document.createElement("button");
    btn.id = "bg3-t20-hidden-test-btn";
    btn.type = "button";
    btn.className = "control ui-control layer icon fa-solid fa-dice-d20";
    btn.setAttribute("data-tooltip", "Solicitar Teste Secreto de Perícia");
    btn.setAttribute("aria-label", "Solicitar Teste Secreto de Perícia");
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openHiddenTestGMDialog();
    });

    const li = document.createElement("li");
    li.appendChild(btn);
    menu.appendChild(li);
}

function setupToolbarButton(): void {
    Hooks.on("renderSceneControls", () => injectToolbarButton());
    // Also try immediately in case the hook already fired
    Hooks.once("ready", () => injectToolbarButton());
}

// ── Public entry ──────────────────────────────────────────────────────────────

export function setupHiddenTest(): void {
    ensureHiddenTestStyles();
    setupSocket();
    setupChatHook();
    setupToolbarButton();
}

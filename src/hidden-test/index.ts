import { MODULE_ID } from "@/constants";
import { BG3Overlay } from "@/overlay/BG3Overlay";
import { openHiddenTestGMDialog } from "./HiddenTestGMDialog";
import { openHiddenTestPlayerDialog } from "./HiddenTestPlayerDialog";
import type { HiddenTestFlag, HiddenTestRequest, HiddenTestSocketData } from "./types";

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
    padding: 10px 14px 8px;
    text-align: center;
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
.htg-roll-hint {
    color: #5a5040;
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-align: center;
    padding: 6px 16px 8px;
    text-transform: uppercase;
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
    game.socket?.on(`module.${MODULE_ID}`, (raw: unknown) => {
        const data = raw as HiddenTestSocketData;
        if (data?.type !== "hidden-test-request") return;
        const req = data as HiddenTestRequest;
        if (req.targetUserId !== game.user?.id) return;
        openHiddenTestPlayerDialog(req);
    });
}

// ── createChatMessage hook: show overlay for hidden tests ─────────────────────

function setupChatHook(): void {
    Hooks.on("createChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;

        const flag = message.getFlag(MODULE_ID, "hiddenTest") as HiddenTestFlag | undefined;
        if (!flag) return;

        // In Foundry v13, message.rolls contains deserialized Roll instances;
        // _source.rolls stores them as JSON strings and is unreliable — always use message.rolls.
        const rolls = message.rolls as Roll[] | undefined;
        if (!rolls?.length) return;

        let roll: Roll | null = null;
        if (rolls[0] instanceof Roll) {
            roll = rolls[0];
        } else {
            try {
                const data = typeof rolls[0] === "string"
                    ? (JSON.parse(rolls[0] as unknown as string) as Record<string, unknown>)
                    : (rolls[0] as unknown as Record<string, unknown>);
                roll = Roll.fromData(data);
            } catch { return; }
        }

        const meta = { category: `Teste de ${flag.skillLabel}` };
        setTimeout(() => BG3Overlay.show(meta, roll!, flag.outcome), 1000);
    });
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function setupToolbarButton(): void {
    Hooks.on("getSceneControlButtons", (controls: unknown[]) => {
        if (!game.user?.isGM) return;

        const tokenGroup = controls.find(
            (c) => (c as Record<string, unknown>)["name"] === "token",
        ) as Record<string, unknown> | undefined;

        if (!tokenGroup) return;

        const tool = {
            name: "hidden-test",
            title: "Solicitar Teste Secreto de Perícia",
            icon: "fa-solid fa-dice-d20",
            button: true,
            visible: true,
            onClick: () => openHiddenTestGMDialog(),
        };

        const tools = tokenGroup["tools"];
        if (Array.isArray(tools)) {
            tools.push(tool);
        }
    });

    // DOM fallback: inject into the rendered toolbar if hook didn't add the button
    Hooks.on("renderSceneControls", (...args: unknown[]) => {
        if (!game.user?.isGM) return;
        if (document.getElementById("bg3-t20-hidden-test-btn")) return;

        // Try to find the controls list (v13 uses <ol class="main-controls">)
        const ol =
            document.querySelector("ol.main-controls") ??
            document.querySelector("#ui-left ol") ??
            document.querySelector(".control-tools ol");

        if (!ol) return;

        const li = document.createElement("li");
        li.id = "bg3-t20-hidden-test-btn";
        li.className = "scene-control";
        li.title = "Solicitar Teste Secreto de Perícia";
        li.setAttribute("data-control", "hidden-test");
        li.setAttribute("aria-label", "Solicitar Teste Secreto de Perícia");
        li.innerHTML = `<i class="fa-solid fa-dice-d20"></i>`;
        li.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openHiddenTestGMDialog();
        });
        ol.appendChild(li);

        const args0 = args[0];
        void args0;
    });
}

// ── Public entry ──────────────────────────────────────────────────────────────

export function setupHiddenTest(): void {
    ensureHiddenTestStyles();
    setupSocket();
    setupChatHook();
    setupToolbarButton();
}

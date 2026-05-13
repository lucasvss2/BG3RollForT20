/**
 * BG3-style restyling for Tormenta20 chat roll cards.
 * Injects CSS and fixes missing attribute labels via renderChatMessage hook.
 */

import { parseT20 } from "@/parser/t20";
import { resolveFlavorText } from "@/integration/index";
import { log } from "@/utils/logging";

const CHAT_STYLES_ID = "bg3-t20-chat-styles";

// ── Roll type fallback labels ─────────────────────────────────────────────────

const ROLL_TYPE_LABELS: Record<string, string> = {
    attack:     "Ataque",
    damage:     "Dano",
    initiative: "Iniciativa",
    skill:      "Perícia",
    save:       "Resistência",
};

// ── CSS ───────────────────────────────────────────────────────────────────────

const CHAT_STYLES = `
/* ── BG3 Chat Card ──────────────────────────────────────────────────────── */

.chat-message:has(.tormenta20.chat-card.item-card) {
    background: transparent !important;
    border-color: transparent !important;
    box-shadow: none !important;
    padding: 2px 0 !important;
}
.chat-message:has(.tormenta20.chat-card.item-card) .message-header {
    background: transparent !important;
    border: none !important;
    padding: 1px 6px !important;
}
.chat-message:has(.tormenta20.chat-card.item-card) .message-sender {
    color: #9a8e7a !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.68rem !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
}
.chat-message:has(.tormenta20.chat-card.item-card) .message-metadata,
.chat-message:has(.tormenta20.chat-card.item-card) .message-timestamp,
.chat-message:has(.tormenta20.chat-card.item-card) .message-delete {
    color: #3a2e22 !important;
    font-size: 0.62rem !important;
}
.chat-message:has(.tormenta20.chat-card.item-card) .message-delete:hover {
    color: #cc4444 !important;
}

/* ── Card base ───────────────────────────────────────────────────────────── */

.tormenta20.chat-card.item-card {
    background: radial-gradient(ellipse at top, #1c1209 0%, #090604 100%) !important;
    border: 1px solid rgba(106, 78, 24, 0.45) !important;
    border-radius: 4px !important;
    box-shadow: 0 0 0 1px #2a1e08, 0 4px 18px rgba(0, 0, 0, 0.75) !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    padding: 0 !important;
    overflow: hidden !important;
}

/* ── Card header (item / skill name) ────────────────────────────────────── */

.tormenta20.chat-card.item-card .card-header {
    background: linear-gradient(to right, transparent, rgba(106, 78, 24, 0.14), transparent) !important;
    border-bottom: 1px solid rgba(106, 78, 24, 0.4) !important;
    padding: 8px 12px !important;
    gap: 8px !important;
    align-items: center !important;
}
.tormenta20.chat-card.item-card .card-header img {
    border: 1px solid rgba(106, 78, 24, 0.4) !important;
    border-radius: 3px !important;
    width: 32px !important;
    height: 32px !important;
    flex-shrink: 0 !important;
}
.tormenta20.chat-card.item-card .item-name,
.tormenta20.chat-card.item-card .item-name div {
    color: #c8a96e !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 1.05rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.1em !important;
    text-transform: uppercase !important;
    text-shadow: 0 0 14px rgba(200, 169, 110, 0.35) !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    line-height: 1.2 !important;
}

/* ── Spell / ability info (school, circle, attributes) ───────────────────── */

.tormenta20.chat-card.item-card .card-item-header {
    border-top: 1px solid rgba(106, 78, 24, 0.2) !important;
    padding: 5px 12px !important;
}
.tormenta20.chat-card.item-card .card-item-header h4 {
    color: #9a8e7a !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.72rem !important;
    font-weight: normal !important;
    letter-spacing: 0.1em !important;
    margin: 0 0 3px !important;
    text-transform: uppercase !important;
}
.tormenta20.chat-card.item-card .card-item-header p {
    color: #c0b49a !important;
    font-size: 0.74rem !important;
    line-height: 1.5 !important;
    margin: 0 !important;
}
.tormenta20.chat-card.item-card .card-item-header b {
    color: #c8a96e !important;
    font-weight: normal !important;
}

/* ── Spell description (expandable) ─────────────────────────────────────── */

.tormenta20.chat-card.item-card .card-content {
    padding: 6px 12px !important;
    border-top: 1px solid rgba(106, 78, 24, 0.15) !important;
}
.tormenta20.chat-card.item-card .card-content p {
    color: #b8ad9a !important;
    font-family: "Palatino Linotype", "Book Antiqua", serif !important;
    font-size: 0.76rem !important;
    line-height: 1.55 !important;
    margin: 0 0 4px !important;
}
.tormenta20.chat-card.item-card .card-content em {
    color: #9a8e7a !important;
}
.tormenta20.chat-card.item-card .card-content a {
    color: #c8a96e !important;
}

/* ── Roll type label (Ataque, Dano) ─────────────────────────────────────── */

.tormenta20.chat-card.item-card > .row {
    color: #7a6e5a !important;
    font-size: 0.68rem !important;
    letter-spacing: 0.14em !important;
    text-transform: uppercase !important;
    padding: 5px 12px 1px !important;
    border-top: 1px solid rgba(106, 78, 24, 0.18) !important;
    margin: 0 !important;
}

/* ── Dice roll ───────────────────────────────────────────────────────────── */

.tormenta20.chat-card.item-card .dice-roll {
    padding: 4px 12px 10px !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
}
.tormenta20.chat-card.item-card .dice-result {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 2px !important;
}
.tormenta20.chat-card.item-card .dice-formula {
    color: #c8b896 !important;
    font-family: monospace !important;
    font-size: 0.78rem !important;
    background: rgba(0, 0, 0, 0.3) !important;
    border: 1px solid rgba(106, 78, 24, 0.25) !important;
    border-radius: 3px !important;
    padding: 2px 10px !important;
    text-align: center !important;
}

/* ── Dice total ──────────────────────────────────────────────────────────── */

.tormenta20.chat-card.item-card .dice-total {
    color: #f0ebe0 !important;
    background: transparent !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 2.6rem !important;
    font-weight: 900 !important;
    line-height: 1 !important;
    text-shadow: 0 0 20px rgba(255, 255, 255, 0.08) !important;
    border: none !important;
    padding: 4px 8px 2px !important;
    margin: 0 !important;
}
.tormenta20.chat-card.item-card .dice-total.critical {
    color: #6ecf7a !important;
    background: transparent !important;
    text-shadow: 0 0 24px rgba(110, 207, 122, 0.6) !important;
}
.tormenta20.chat-card.item-card .dice-total.fumble {
    color: #cc4444 !important;
    background: transparent !important;
    text-shadow: 0 0 24px rgba(204, 68, 68, 0.6) !important;
}

/* ── Dice tooltip (expandable breakdown) ────────────────────────────────── */

.tormenta20.chat-card.item-card .dice-tooltip {
    background: rgba(10, 6, 2, 0.85) !important;
    border-top: 1px solid rgba(106, 78, 24, 0.25) !important;
    margin-top: 4px !important;
    padding: 6px 0 4px !important;
}
.tormenta20.chat-card.item-card .dice-tooltip .part-header {
    background: rgba(106, 78, 24, 0.12) !important;
    border-bottom: 1px solid rgba(106, 78, 24, 0.2) !important;
    padding: 3px 8px !important;
    margin-bottom: 4px !important;
}
.tormenta20.chat-card.item-card .dice-tooltip .part-formula {
    color: #a89880 !important;
    font-family: monospace !important;
    font-size: 0.72rem !important;
}
.tormenta20.chat-card.item-card .dice-tooltip .part-flavor {
    color: #7a6e5a !important;
    font-style: italic !important;
    font-size: 0.7rem !important;
}
.tormenta20.chat-card.item-card .dice-tooltip .part-total {
    color: #e8e0d0 !important;
    background: rgba(0, 0, 0, 0.3) !important;
    font-weight: 700 !important;
    font-size: 0.78rem !important;
    padding: 0 6px !important;
    border-radius: 2px !important;
}
.tormenta20.chat-card.item-card .dice-tooltip .dice-rolls {
    list-style: none !important;
    padding: 2px 8px 4px !important;
    margin: 0 !important;
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 4px !important;
}
.tormenta20.chat-card.item-card .dice-tooltip .roll.die {
    color: #e8e0d0 !important;
    background: rgba(30, 20, 8, 0.9) !important;
    border: 1px solid rgba(106, 78, 24, 0.4) !important;
    border-radius: 3px !important;
    padding: 2px 6px !important;
    font-size: 0.78rem !important;
    min-width: 22px !important;
    text-align: center !important;
}
.tormenta20.chat-card.item-card .dice-tooltip .roll.die.max {
    color: #6ecf7a !important;
    border-color: rgba(110, 207, 122, 0.5) !important;
}
.tormenta20.chat-card.item-card .dice-tooltip .roll.die.min {
    color: #cc4444 !important;
    border-color: rgba(204, 68, 68, 0.5) !important;
}

/* ── Enhancements / upgrades list ───────────────────────────────────────── */

.tormenta20.chat-card.item-card .card-upgrades {
    border-top: 1px solid rgba(106, 78, 24, 0.2) !important;
    padding: 4px 10px !important;
}
.tormenta20.chat-card.item-card .card-upgrades ul {
    list-style: none !important;
    margin: 0 !important;
    padding: 0 !important;
}
.tormenta20.chat-card.item-card .card-upgrades .row {
    color: #7a6e5a !important;
    font-size: 0.74rem !important;
    padding: 1px 4px !important;
    border: none !important;
    letter-spacing: 0.06em !important;
}
.tormenta20.chat-card.item-card .card-upgrades b {
    color: #a89880 !important;
}

/* ── Effect apply buttons ────────────────────────────────────────────────── */

.tormenta20.chat-card.item-card .card-item-effects {
    border-top: 1px solid rgba(106, 78, 24, 0.2) !important;
    padding: 4px 8px !important;
}
.tormenta20.chat-card.item-card .chat-apply-ae {
    background: rgba(106, 78, 24, 0.15) !important;
    border: 1px solid rgba(106, 78, 24, 0.4) !important;
    color: #c8a96e !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.74rem !important;
    letter-spacing: 0.06em !important;
    border-radius: 3px !important;
    padding: 3px 8px !important;
    gap: 6px !important;
    cursor: pointer !important;
}
.tormenta20.chat-card.item-card .chat-apply-ae img {
    width: 16px !important;
    height: 16px !important;
    border: none !important;
    border-radius: 0 !important;
}
.tormenta20.chat-card.item-card .chat-apply-ae:hover {
    background: rgba(106, 78, 24, 0.32) !important;
}

/* ── Mana button ─────────────────────────────────────────────────────────── */

.tormenta20.chat-card.item-card .chat-spend-mana {
    background: rgba(106, 78, 24, 0.18) !important;
    border: 1px solid rgba(106, 78, 24, 0.45) !important;
    color: #c8a96e !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.72rem !important;
    border-radius: 3px !important;
    padding: 2px 8px !important;
}
.tormenta20.chat-card.item-card .chat-spend-mana:hover {
    background: rgba(106, 78, 24, 0.4) !important;
}

/* ── Damage apply buttons ────────────────────────────────────────────────── */

.tormenta20.chat-card.item-card .dice-btn button {
    background: rgba(106, 78, 24, 0.15) !important;
    border: 1px solid rgba(106, 78, 24, 0.35) !important;
    color: #9a8e7a !important;
    border-radius: 3px !important;
}
.tormenta20.chat-card.item-card .dice-btn button:hover {
    background: rgba(106, 78, 24, 0.35) !important;
    color: #c8a96e !important;
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureChatStyles(): void {
    if (!document.getElementById(CHAT_STYLES_ID)) {
        const el = document.createElement("style");
        el.id = CHAT_STYLES_ID;
        el.textContent = CHAT_STYLES;
        document.head.appendChild(el);
    }
}

function rollTypeLabel(message: ChatMessage): string {
    const rolls = message.rolls ?? [];
    const first = rolls[0] as (Roll & { options?: Record<string, unknown> }) | undefined;
    const type = first?.options?.["type"];
    if (typeof type === "string" && type in ROLL_TYPE_LABELS) {
        return ROLL_TYPE_LABELS[type] ?? "";
    }
    return "";
}

function fixEmptyItemName(message: ChatMessage, root: HTMLElement): void {
    const nameDiv = root.querySelector<HTMLElement>(
        ".tormenta20.chat-card.item-card .item-name div"
    );
    if (!nameDiv || nameDiv.textContent?.trim()) return;

    // Try flavor → parseT20
    const flavor = resolveFlavorText(message);
    if (flavor) {
        const meta = parseT20({ flavor });
        if (meta) {
            nameDiv.textContent = meta.subcategory
                ? `${meta.category} — ${meta.subcategory}`
                : meta.category;
            return;
        }
    }

    // Fallback: roll options type
    const label = rollTypeLabel(message);
    if (label) nameDiv.textContent = label;
}

// ── Public entry point ────────────────────────────────────────────────────────

export function setupChatStyling(): void {
    ensureChatStyles();

    Hooks.on("renderChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;
        const htmlArg = args[1] as HTMLElement[] | { 0?: HTMLElement };
        const root = Array.isArray(htmlArg) ? htmlArg[0] : htmlArg[0];
        if (!root) return;
        fixEmptyItemName(message, root);
    });

    log("Chat card styling ativo.");
}

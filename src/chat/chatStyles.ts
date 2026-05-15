/**
 * BG3-style restyling for Tormenta20 chat roll cards.
 * Injects CSS and fixes missing attribute labels via renderChatMessage hook.
 */

import { MODULE_ID } from "@/constants";
import { parseT20 } from "@/parser/t20";
import { resolveFlavorText } from "@/integration/index";
import { log } from "@/utils/logging";

const CHAT_STYLES_ID = "bg3-t20-chat-styles";

// ── T20 attribute key → display label ────────────────────────────────────────

const ATTR_LABELS: Record<string, string> = {
    for: "Força",
    des: "Destreza",
    con: "Constituição",
    int: "Inteligência",
    sab: "Sabedoria",
    car: "Carisma",
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
    color: #d4c4a0 !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.68rem !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
    text-shadow:
        -1px -1px 0 rgba(0,0,0,0.85),
         1px -1px 0 rgba(0,0,0,0.85),
        -1px  1px 0 rgba(0,0,0,0.85),
         1px  1px 0 rgba(0,0,0,0.85),
        0 0 6px rgba(0,0,0,0.9) !important;
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
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    overflow: hidden !important;
    position: relative !important;
    background: rgba(106, 78, 24, 0.15) !important;
    border: 1px solid rgba(106, 78, 24, 0.4) !important;
    color: #c8a96e !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.74rem !important;
    letter-spacing: 0.06em !important;
    border-radius: 3px !important;
    padding: 3px 8px !important;
    cursor: pointer !important;
}
.tormenta20.chat-card.item-card .chat-apply-ae img {
    position: static !important;
    display: inline-block !important;
    width: 18px !important;
    height: 18px !important;
    margin: 0 !important;
    flex-shrink: 0 !important;
    border: none !important;
    border-radius: 2px !important;
    object-fit: contain !important;
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

/* ── Resistance roll messages (flag: MODULE_ID.resistanceRoll) ───────────── */
/* Class added by renderChatMessage hook when flag is present.               */

.bg3-resistance-roll {
    background: transparent !important;
    border-color: rgba(106, 78, 24, 0.3) !important;
    box-shadow: none !important;
    padding: 2px 0 !important;
}
.bg3-resistance-roll .message-header {
    background: transparent !important;
    border: none !important;
    padding: 1px 6px !important;
}
.bg3-resistance-roll .message-sender {
    color: #d4c4a0 !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.68rem !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
    text-shadow:
        -1px -1px 0 rgba(0,0,0,0.85),
         1px -1px 0 rgba(0,0,0,0.85),
        -1px  1px 0 rgba(0,0,0,0.85),
         1px  1px 0 rgba(0,0,0,0.85),
        0 0 6px rgba(0,0,0,0.9) !important;
}
.bg3-resistance-roll .message-metadata,
.bg3-resistance-roll .message-timestamp,
.bg3-resistance-roll .message-delete {
    color: #3a2e22 !important;
    font-size: 0.62rem !important;
}
.bg3-resistance-roll .message-delete:hover { color: #cc4444 !important; }
.bg3-resistance-roll .message-content {
    padding: 0 !important;
}
.bg3-resistance-roll .dice-roll {
    background: radial-gradient(ellipse at top, #1c1209 0%, #090604 100%) !important;
    border: 1px solid rgba(106, 78, 24, 0.45) !important;
    border-radius: 4px !important;
    box-shadow: 0 0 0 1px #2a1e08, 0 4px 18px rgba(0,0,0,0.75) !important;
    padding: 4px 12px 10px !important;
}
.bg3-resistance-roll .flavor-text {
    color: #8ab4e8 !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.78rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.06em !important;
    text-align: center !important;
    margin: 4px 0 8px !important;
    padding: 0 !important;
    border: none !important;
}
.bg3-resistance-roll .dice-result {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 2px !important;
}
.bg3-resistance-roll .dice-formula {
    color: #c8b896 !important;
    font-family: monospace !important;
    font-size: 0.78rem !important;
    background: rgba(0,0,0,0.3) !important;
    border: 1px solid rgba(106,78,24,0.25) !important;
    border-radius: 3px !important;
    padding: 2px 10px !important;
    text-align: center !important;
}
.bg3-resistance-roll .dice-total {
    color: #f0ebe0 !important;
    background: transparent !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 2.4rem !important;
    font-weight: 900 !important;
    line-height: 1 !important;
    text-shadow: 0 0 20px rgba(255,255,255,0.08) !important;
    border: none !important;
    padding: 4px 8px 2px !important;
    margin: 0 !important;
}
.bg3-resistance-roll .dice-tooltip {
    background: rgba(10,6,2,0.85) !important;
    border-top: 1px solid rgba(106,78,24,0.25) !important;
    margin-top: 4px !important;
    padding: 6px 0 4px !important;
}
.bg3-resistance-roll .dice-tooltip .part-header {
    background: rgba(106,78,24,0.12) !important;
    border-bottom: 1px solid rgba(106,78,24,0.2) !important;
    padding: 3px 8px !important;
}
.bg3-resistance-roll .dice-tooltip .part-formula { color: #a89880 !important; font-family: monospace !important; font-size: 0.72rem !important; }
.bg3-resistance-roll .dice-tooltip .part-total  { color: #e8e0d0 !important; background: rgba(0,0,0,0.3) !important; font-weight: 700 !important; font-size: 0.78rem !important; }
.bg3-resistance-roll .dice-tooltip .dice-rolls  { list-style: none !important; padding: 2px 8px 4px !important; margin: 0 !important; display: flex !important; flex-wrap: wrap !important; gap: 4px !important; }
.bg3-resistance-roll .dice-tooltip .roll.die {
    color: #e8e0d0 !important;
    background: rgba(30,20,8,0.9) !important;
    border: 1px solid rgba(106,78,24,0.4) !important;
    border-radius: 3px !important;
    padding: 2px 6px !important;
    font-size: 0.78rem !important;
    min-width: 22px !important;
    text-align: center !important;
}
.bg3-resistance-roll .dice-tooltip .roll.die.max { color: #6ecf7a !important; border-color: rgba(110,207,122,0.5) !important; }
.bg3-resistance-roll .dice-tooltip .roll.die.min { color: #cc4444 !important; border-color: rgba(204,68,68,0.5) !important; }

/* ── T20 condition-card descendants (class added by JS) ──────────────────── */
/* The background is overridden via JS setProperty to handle DOMPurify        */
/* normalization. CSS here themes only descendant text content.               */

.bg3-t20-condition-message {
    background: transparent !important;
    border-color: rgba(106, 78, 24, 0.3) !important;
    box-shadow: none !important;
}
.bg3-t20-condition-message .message-header {
    background: transparent !important;
    border: none !important;
    padding: 1px 6px !important;
}
.bg3-t20-condition-message .message-sender {
    color: #d4c4a0 !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.68rem !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
    text-shadow: -1px -1px 0 rgba(0,0,0,0.85), 1px -1px 0 rgba(0,0,0,0.85),
                 -1px  1px 0 rgba(0,0,0,0.85), 1px  1px 0 rgba(0,0,0,0.85),
                 0 0 6px rgba(0,0,0,0.9) !important;
}
.bg3-t20-condition-card h1,
.bg3-t20-condition-card h2,
.bg3-t20-condition-card h3,
.bg3-t20-condition-card h4 {
    color: #c8a96e !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 1.0rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.08em !important;
    text-transform: uppercase !important;
    border: none !important;
    margin: 0 0 2px !important;
    padding: 0 !important;
}
.bg3-t20-condition-card p {
    color: #b8ad9a !important;
    font-family: "Palatino Linotype", "Book Antiqua", serif !important;
    font-size: 0.76rem !important;
    line-height: 1.55 !important;
    margin: 0 0 4px !important;
}
.bg3-t20-condition-card li {
    color: #b8ad9a !important;
    font-family: "Palatino Linotype", "Book Antiqua", serif !important;
    font-size: 0.76rem !important;
    line-height: 1.5 !important;
}
.bg3-t20-condition-card ul,
.bg3-t20-condition-card ol {
    margin: 2px 0 4px !important;
    padding-left: 18px !important;
}
.bg3-t20-condition-card b,
.bg3-t20-condition-card strong { color: #c8a96e !important; }
.bg3-t20-condition-card em,
.bg3-t20-condition-card i     { color: #9a8e7a !important; }
.bg3-t20-condition-card hr {
    border: none !important;
    border-top: 1px solid rgba(106, 78, 24, 0.4) !important;
    margin: 4px 0 !important;
}
/* Journal content-link buttons inside condition cards */
.bg3-t20-condition-card .content-link {
    background: rgba(138,180,232,0.1) !important;
    border: 1px solid rgba(138,180,232,0.35) !important;
    color: #8ab4e8 !important;
    border-radius: 3px !important;
    padding: 1px 5px !important;
    font-family: "Modesto Condensed", serif !important;
    font-size: 0.76rem !important;
}
.bg3-t20-condition-card .content-link:hover { background: rgba(138,180,232,0.2) !important; }
.bg3-t20-condition-card a {
    color: #8ab4e8 !important;
    text-decoration: none !important;
}
.bg3-t20-condition-card a:hover { color: #aacdf0 !important; text-decoration: underline !important; }
`;

// ── Condition-card theme (JS override) ───────────────────────────────────────

/**
 * T20 calls `game.tormenta20.macros.msgFromJournal()` whenever a condition is
 * applied.  It creates a ChatMessage whose content is:
 *   <div style="position:relative; background: #ddd9d5; margin-left:-7px; ...">
 *     [journal page HTML]
 *   </div>
 *
 * CSS attribute selectors are unreliable here because DOMPurify may normalise
 * the colour string (`#ddd9d5` → `rgb(221,217,213)`).  We instead detect the
 * card in the `renderChatMessage` hook and override the inline style directly
 * via `element.style.setProperty(…, 'important')`, which is the only reliable
 * way to beat an inline style in JavaScript.
 */
function applyConditionCardTheme(root: HTMLElement): void {
    const msgContent = root.querySelector(".message-content");
    if (!msgContent) return;

    // Walk direct children (and one level deeper for safety) looking for the
    // T20 condition card div.  Identifying markers:
    //   • style contains "ddd9d5" (original or normalised)
    //   • style contains "margin-left:-7px" (T20-specific negative bleed margin)
    const candidates = msgContent.querySelectorAll<HTMLElement>("div[style]");
    for (const el of Array.from(candidates)) {
        const s = (el.getAttribute("style") ?? "").toLowerCase();
        if (!s.includes("ddd9d5") && !s.includes("margin-left:-7px")) continue;

        // Direct style override — setProperty with 'important' beats inline styles
        el.style.setProperty("background", "radial-gradient(ellipse at top, #1c1209 0%, #090604 100%)", "important");
        el.style.setProperty("border",        "1px solid rgba(106, 78, 24, 0.45)", "important");
        el.style.setProperty("border-radius", "4px",                               "important");
        el.style.setProperty("box-shadow",    "0 0 0 1px #2a1e08, 0 4px 18px rgba(0,0,0,0.75)", "important");
        el.style.setProperty("color",         "#c0b49a",                           "important");

        // CSS class for descendant text styling (no !important needed there)
        el.classList.add("bg3-t20-condition-card");
        root.classList.add("bg3-t20-condition-message");
        break; // only one condition card per message
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureChatStyles(): void {
    if (!document.getElementById(CHAT_STYLES_ID)) {
        const el = document.createElement("style");
        el.id = CHAT_STYLES_ID;
        el.textContent = CHAT_STYLES;
        document.head.appendChild(el);
    }
}

type RollTermExt = {
    constructor?: { name?: string };
    number?: number;
};

function inferAttrLabel(message: ChatMessage, card: HTMLElement): string {
    // Only applies when there is no linked item (pure attribute test)
    if (card.dataset["itemId"]) return "";

    const roll = message.rolls?.[0] as (Roll & { terms?: RollTermExt[] }) | undefined;
    if (!roll) return "";

    // Extract the first numeric bonus after the d20
    let foundDie = false;
    let attrBonus: number | null = null;
    for (const term of roll.terms ?? []) {
        if (term.constructor?.name === "Die") { foundDie = true; continue; }
        if (foundDie && term.constructor?.name === "NumericTerm" && term.number !== undefined) {
            attrBonus = term.number;
            break;
        }
    }
    if (attrBonus === null) return "";

    // Match bonus against actor's atributos
    const actorId = message.speaker?.actor;
    if (!actorId) return "";
    const actor = game.actors?.get(actorId);
    const atributos = (actor?.system?.["atributos"]) as Record<string, { value?: number }> | undefined;
    if (!atributos) return "";

    const matches = Object.entries(atributos).filter(
        ([key, attr]) => (attr as { value?: number }).value === attrBonus && key in ATTR_LABELS
    );

    // Only resolve when unambiguous
    if (matches.length === 1) return ATTR_LABELS[matches[0]![0]] ?? "";
    if (matches.length > 1) return "Teste de Atributo";
    return "";
}

function fixEmptyItemName(message: ChatMessage, root: HTMLElement): void {
    const card = root.querySelector<HTMLElement>(".tormenta20.chat-card.item-card");
    if (!card) return;
    const nameDiv = card.querySelector<HTMLElement>(".item-name div");
    if (!nameDiv || nameDiv.textContent?.trim()) return;

    // Try flavor → parseT20 first
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

    // Infer attribute from actor data (only for no-item rolls)
    const label = inferAttrLabel(message, card);
    if (label) nameDiv.textContent = label;
}

// ── Public entry point ────────────────────────────────────────────────────────

export function setupChatStyling(): void {
    ensureChatStyles();

    Hooks.on("renderChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;
        const htmlArg = args[1] as unknown;
        let root: HTMLElement | undefined;
        if (htmlArg instanceof HTMLElement) {
            root = htmlArg;
        } else if (Array.isArray(htmlArg)) {
            root = htmlArg[0] as HTMLElement | undefined;
        } else if (htmlArg && typeof htmlArg === "object") {
            root = (htmlArg as Record<string, unknown>)[0] as HTMLElement | undefined;
        }
        if (!root) return;

        // Resistance roll messages — add class for CSS theming
        if (message.getFlag(MODULE_ID, "resistanceRoll")) {
            root.classList.add("bg3-resistance-roll");
        }

        // T20 condition notification cards — override inline style via JS
        applyConditionCardTheme(root);

        fixEmptyItemName(message, root);
    });

    log("Chat card styling ativo.");
}

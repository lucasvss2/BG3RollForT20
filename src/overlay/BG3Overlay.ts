/**
 * Standalone BG3-style cinematic roll overlay for Tormenta20.
 * Injects its own CSS and renders a full-screen overlay when a T20 roll
 * is intercepted. No dependency on aeris-bg3-rolls.
 */

import type { TestOutcome } from "@/hidden-test/types";

// ── CSS ───────────────────────────────────────────────────────────────────────

const STYLES_ID = "bg3-t20-styles";
const OVERLAY_ID = "bg3-t20-overlay";
const DISMISS_DELAY_MS = 3000;

const STYLES = `
#${OVERLAY_ID} {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: radial-gradient(ellipse at center,
        rgba(20, 10, 5, 0.88) 0%,
        rgba(0, 0, 0, 0.94) 100%
    );
    animation: bg3t20-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
    font-family: "Modesto Condensed", "Palatino Linotype", "Book Antiqua", serif;
    color: #e8e0d0;
    user-select: none;
}
#${OVERLAY_ID}.leaving {
    animation: bg3t20-out 0.45s ease forwards;
    pointer-events: none;
}
.bg3-t20-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    max-width: 520px;
    padding: 0 24px;
    animation: bg3t20-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.bg3-t20-category {
    font-size: clamp(1.2rem, 2.5vw, 1.9rem);
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #c8a96e;
    text-shadow: 0 0 28px rgba(200, 169, 110, 0.7);
    line-height: 1.2;
}
.bg3-t20-subcategory {
    font-size: clamp(0.85rem, 1.4vw, 1.1rem);
    color: #9a9080;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}
.bg3-t20-divider {
    width: 260px;
    height: 1px;
    background: linear-gradient(to right,
        transparent, rgba(200, 169, 110, 0.6), transparent);
    margin: 10px 0;
}
.bg3-t20-total {
    font-size: clamp(5rem, 13vw, 9rem);
    line-height: 1;
    font-weight: 900;
    color: #f0ebe0;
    text-shadow:
        0 0 40px rgba(255, 255, 255, 0.18),
        0 0 80px rgba(200, 169, 110, 0.15);
    margin: 4px 0;
}
.bg3-t20-total.is-crit {
    color: #ffd700;
    text-shadow:
        0 0 40px rgba(255, 215, 0, 0.85),
        0 0 90px rgba(255, 165, 0, 0.5);
}
.bg3-t20-total.is-fumble {
    color: #cc4444;
    text-shadow: 0 0 40px rgba(204, 68, 68, 0.85);
}
.bg3-t20-total.is-success {
    color: #6ecf7a;
    text-shadow: 0 0 40px rgba(110, 207, 122, 0.8), 0 0 80px rgba(80, 180, 90, 0.4);
}
.bg3-t20-total.is-failure {
    color: #c8a070;
    text-shadow: 0 0 30px rgba(200, 160, 112, 0.6);
}
.bg3-t20-crit-label {
    font-size: clamp(0.9rem, 1.5vw, 1.2rem);
    letter-spacing: 0.28em;
    text-transform: uppercase;
    font-weight: 700;
    margin-top: 2px;
}
.bg3-t20-crit-label.is-crit     { color: #ffd700; }
.bg3-t20-crit-label.is-fumble   { color: #cc4444; }
.bg3-t20-crit-label.is-success  { color: #6ecf7a; }
.bg3-t20-crit-label.is-failure  { color: #c8a070; }
.bg3-t20-formula {
    font-size: 0.82rem;
    color: #a89880;
    letter-spacing: 0.06em;
    margin-top: 6px;
    font-family: monospace;
}
.bg3-t20-hint {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.7rem;
    color: #3a3028;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
}
@keyframes bg3t20-in {
    from { opacity: 0; }
    to   { opacity: 1; }
}
@keyframes bg3t20-out {
    from { opacity: 1; }
    to   { opacity: 0; }
}
@keyframes bg3t20-rise {
    from { opacity: 0; transform: translateY(44px) scale(0.94); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureStyles(): void {
    if (!document.getElementById(STYLES_ID)) {
        const el = document.createElement("style");
        el.id = STYLES_ID;
        el.textContent = STYLES;
        document.head.appendChild(el);
    }
}

function esc(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function naturalD20(roll: Roll): number | null {
    const d20 = roll.dice?.find((d) => d.faces === 20);
    return d20?.results?.find((r) => r.active)?.result ?? null;
}

const OUTCOME_TOTAL_CLASS: Record<TestOutcome, string> = {
    critico:       "is-crit",
    sucesso:       "is-success",
    falha:         "is-failure",
    falha_critica: "is-fumble",
};

const OUTCOME_LABEL: Record<TestOutcome, string> = {
    critico:       "SUCESSO CRÍTICO!",
    sucesso:       "SUCESSO",
    falha:         "FALHA",
    falha_critica: "FALHA CRÍTICA",
};

function buildHtml(meta: RollMeta, roll: Roll, outcome?: TestOutcome): string {
    const total = roll.total ?? 0;

    let totalClass: string;
    let resultHtml: string;

    if (outcome) {
        totalClass = ` ${OUTCOME_TOTAL_CLASS[outcome]}`;
        resultHtml = `<div class="bg3-t20-crit-label ${OUTCOME_TOTAL_CLASS[outcome]}">${OUTCOME_LABEL[outcome]}</div>`;
    } else {
        const d20 = naturalD20(roll);
        const isCrit   = d20 === 20;
        const isFumble = d20 === 1;
        totalClass = isCrit ? " is-crit" : isFumble ? " is-fumble" : "";
        resultHtml = isCrit
            ? `<div class="bg3-t20-crit-label is-crit">Acerto Crítico!</div>`
            : isFumble
              ? `<div class="bg3-t20-crit-label is-fumble">Falha Crítica</div>`
              : "";
    }

    const subHtml = meta.subcategory
        ? `<div class="bg3-t20-subcategory">${esc(meta.subcategory)}</div>`
        : "";

    const formulaHtml = roll.formula
        ? `<div class="bg3-t20-formula">${esc(roll.formula)} = ${total}</div>`
        : "";

    return `
        <div class="bg3-t20-card">
            <div class="bg3-t20-category">${esc(meta.category)}</div>
            ${subHtml}
            <div class="bg3-t20-divider"></div>
            <div class="bg3-t20-total${totalClass}">${total}</div>
            ${resultHtml}
            ${formulaHtml}
        </div>
        <div class="bg3-t20-hint">clique para fechar</div>
    `;
}

// ── Overlay singleton ─────────────────────────────────────────────────────────

class BG3OverlaySingleton {
    private el: HTMLElement | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;

    show(meta: RollMeta, roll: Roll, outcome?: TestOutcome): void {
        this.dismiss(true);
        ensureStyles();

        const el = document.createElement("div");
        el.id = OVERLAY_ID;
        el.innerHTML = buildHtml(meta, roll, outcome);
        el.addEventListener("click", () => this.dismiss());
        document.body.appendChild(el);
        this.el = el;

        this.timer = setTimeout(() => this.dismiss(), DISMISS_DELAY_MS);
    }

    dismiss(immediate = false): void {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        const el = this.el;
        if (!el) return;
        this.el = null;

        if (immediate) {
            el.remove();
            return;
        }

        el.classList.add("leaving");
        el.addEventListener("animationend", () => el.remove(), { once: true });
        setTimeout(() => el.remove(), 600);
    }
}

export const BG3Overlay = new BG3OverlaySingleton();

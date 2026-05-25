/**
 * Standalone BG3-style cinematic roll overlay for Tormenta20.
 * Injects its own CSS and renders a full-screen overlay when a T20 roll
 * is intercepted.
 */

import type { TestOutcome } from "@/hidden-test/types";
import STYLES from "./bg3-overlay.css?inline";

// ── CSS ───────────────────────────────────────────────────────────────────────

const STYLES_ID = "bg3-t20-styles";
const OVERLAY_ID = "bg3-t20-overlay";
const DISMISS_DELAY_MS = 3000;
const OVERLAY_Z = 99999;



// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureStyles(): void {
    if (!document.getElementById(STYLES_ID)) {
        const el = document.createElement("style");
        el.id = STYLES_ID;
        el.textContent = STYLES
            .replace(/\$\{OVERLAY_ID\}/g, OVERLAY_ID)
            .replace(/\$\{OVERLAY_Z\}/g, String(OVERLAY_Z));
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
        const d20 = roll.dice?.find((d) => d.faces === 20)?.results?.find((r) => r.active)?.result ?? null;
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

// Selectors for 3D dice canvases that should always appear above the overlay
const DICE_CANVAS_SELECTORS = ["#dice-box-canvas", "#dice-box", "canvas.dsn-canvas"];

class BG3OverlaySingleton {
    private el: HTMLElement | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private diceElevations: Array<{ el: HTMLElement; original: string }> = [];

    private elevateDice(): void {
        this.diceElevations = [];
        for (const sel of DICE_CANVAS_SELECTORS) {
            document.querySelectorAll<HTMLElement>(sel).forEach((canvas) => {
                this.diceElevations.push({ el: canvas, original: canvas.style.zIndex });
                canvas.style.zIndex = String(Number(OVERLAY_Z) + 1);
            });
        }
    }

    private restoreDice(): void {
        for (const { el, original } of this.diceElevations) {
            el.style.zIndex = original;
        }
        this.diceElevations = [];
    }

    show(meta: RollMeta, roll: Roll, outcome?: TestOutcome): void {
        this.dismiss(true);
        ensureStyles();

        const el = document.createElement("div");
        el.id = OVERLAY_ID;
        el.innerHTML = buildHtml(meta, roll, outcome);
        el.addEventListener("click", () => this.dismiss());
        document.body.appendChild(el);
        this.el = el;

        this.elevateDice();
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
        this.restoreDice();

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

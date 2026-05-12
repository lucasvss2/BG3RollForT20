/**
 * BG3-style visual restyling for Tormenta20 roll dialogs.
 *
 * Hooks into renderAbilityUseDialog (and the generic renderDialog fallback)
 * to inject a CSS class that transforms the dialog into a dark, gold-accented
 * BG3-inspired card. No functionality is altered — only the presentation.
 */

const DIALOG_STYLES_ID = "bg3-t20-dialog-styles";

// ── CSS ───────────────────────────────────────────────────────────────────────

const DIALOG_STYLES = `
/* ── BG3-style roll dialog ───────────────────────────────────────────────── */

.window-app.bg3-dialog {
    background: radial-gradient(ellipse at top, #1c1209 0%, #090604 100%) !important;
    border: none !important;
    border-radius: 6px !important;
    box-shadow:
        0 0 0 1px #6a4e18,
        0 0 0 3px #0a0704,
        0 0 0 5px #6a4e18,
        0 0 0 7px #0a0704,
        0 0 0 8px #4a360e,
        0 0 40px rgba(0, 0, 0, 0.95),
        inset 0 0 60px rgba(0, 0, 0, 0.5) !important;
    font-family: "Modesto Condensed", "Palatino Linotype", "Book Antiqua", serif !important;
    min-width: 480px !important;
    width: auto !important;
    height: auto !important;
}

/* Remove scroll — let the dialog grow to fit its content */
.window-app.bg3-dialog .window-content {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
}

/* Corner decorations via pseudo-element overlay */
.window-app.bg3-dialog::before {
    content: "";
    position: absolute;
    inset: 8px;
    border: 1px solid rgba(106, 78, 24, 0.25);
    border-radius: 3px;
    pointer-events: none;
    z-index: 0;
}

/* ── Header ────────────────────────────────────────────────────────────────── */

.window-app.bg3-dialog .window-header {
    background: linear-gradient(
        to right,
        transparent,
        rgba(106, 78, 24, 0.18),
        transparent
    ) !important;
    border-bottom: 1px solid rgba(106, 78, 24, 0.5) !important;
    padding: 6px 10px !important;
    position: relative;
    z-index: 1;
}

.window-app.bg3-dialog .window-title {
    color: #c8a96e !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.95rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.14em !important;
    text-transform: uppercase !important;
    text-shadow: 0 0 14px rgba(200, 169, 110, 0.55) !important;
}

.window-app.bg3-dialog .header-button,
.window-app.bg3-dialog .window-header > a {
    color: #705830 !important;
    transition: color 0.15s !important;
}
.window-app.bg3-dialog .header-button:hover,
.window-app.bg3-dialog .window-header > a:hover {
    color: #c8a96e !important;
}

/* ── Skill name banner (injected by JS) ─────────────────────────────────── */

.bg3-skill-banner {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 16px 10px;
    text-align: center;
    position: relative;
    z-index: 1;
}

.bg3-skill-name {
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    font-size: clamp(1.5rem, 4vw, 2.2rem);
    font-weight: 700;
    color: #c8a96e;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    text-shadow: 0 0 20px rgba(200, 169, 110, 0.65);
    line-height: 1.1;
}

.bg3-skill-divider {
    width: 180px;
    height: 1px;
    background: linear-gradient(to right, transparent, rgba(200, 169, 110, 0.55), transparent);
    margin: 8px 0 0;
}

/* ── Form body ──────────────────────────────────────────────────────────── */

.window-app.bg3-dialog .window-content,
.window-app.bg3-dialog form,
.window-app.bg3-dialog .dialog-content {
    background: transparent !important;
    color: #d0c4a8 !important;
    position: relative;
    z-index: 1;
}

.window-app.bg3-dialog .form-group {
    border-bottom: 1px solid rgba(106, 78, 24, 0.15) !important;
    padding: 6px 16px !important;
    margin: 0 !important;
    display: flex;
    align-items: center;
    gap: 8px;
}

.window-app.bg3-dialog .form-group:last-of-type {
    border-bottom: none !important;
}

.window-app.bg3-dialog .form-group label {
    color: #8a7450 !important;
    font-size: 0.78rem !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
    white-space: nowrap;
    flex: 0 0 auto;
}

.window-app.bg3-dialog input[type="text"],
.window-app.bg3-dialog input[type="number"],
.window-app.bg3-dialog select {
    background: rgba(0, 0, 0, 0.55) !important;
    border: 1px solid #3a2a0e !important;
    border-radius: 3px !important;
    color: #e8d8a8 !important;
    font-family: "Palatino Linotype", serif !important;
    font-size: 0.9rem !important;
    padding: 3px 8px !important;
    transition: border-color 0.2s, box-shadow 0.2s !important;
    flex: 1 1 auto;
}

.window-app.bg3-dialog input:focus,
.window-app.bg3-dialog select:focus {
    border-color: #8b6914 !important;
    box-shadow: 0 0 8px rgba(139, 105, 20, 0.4) !important;
    outline: none !important;
}

.window-app.bg3-dialog select option {
    background: #12100a !important;
    color: #e8d8a8 !important;
}

/* ── Footer / submit button ─────────────────────────────────────────────── */

.window-app.bg3-dialog footer,
.window-app.bg3-dialog .dialog-buttons {
    background: linear-gradient(to top, rgba(0,0,0,0.4), transparent) !important;
    border-top: 1px solid rgba(106, 78, 24, 0.3) !important;
    padding: 12px 16px !important;
    position: relative;
    z-index: 1;
}

.window-app.bg3-dialog footer button,
.window-app.bg3-dialog .dialog-buttons button {
    background: linear-gradient(to bottom, #5c3a10, #3a2208) !important;
    border: 1px solid #7a5818 !important;
    border-radius: 4px !important;
    color: #f0e0b0 !important;
    cursor: pointer !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 1rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.2em !important;
    padding: 9px 16px !important;
    text-shadow: 0 0 12px rgba(255, 200, 100, 0.5) !important;
    text-transform: uppercase !important;
    transition: all 0.15s !important;
    width: 100% !important;
    box-shadow:
        0 0 16px rgba(139, 105, 20, 0.3),
        inset 0 1px rgba(255, 220, 150, 0.15) !important;
}

.window-app.bg3-dialog footer button:hover,
.window-app.bg3-dialog .dialog-buttons button:hover {
    background: linear-gradient(to bottom, #7c5218, #5a3210) !important;
    border-color: #c8a96e !important;
    box-shadow:
        0 0 24px rgba(200, 169, 110, 0.55),
        inset 0 1px rgba(255, 220, 150, 0.25) !important;
    color: #fff8e8 !important;
}

.window-app.bg3-dialog footer button i,
.window-app.bg3-dialog .dialog-buttons button i {
    margin-right: 6px !important;
    color: inherit !important;
}

/* ── Universal text visibility (WCAG AA/AAA) ────────────────────────────── */
/*
 * The tormenta20 system sets dark colors on many inline elements which become
 * invisible against our near-black background.  We force readable colors on
 * every text-bearing element inside the dialog content.
 *
 * Contrast targets (background ≈ #090604, luminance 0.003):
 *   #c8bfa0  →  luminance 0.57  →  contrast ~11:1  (WCAG AAA)
 *   #a09878  →  luminance 0.36  →  contrast  ~7:1  (WCAG AAA)
 *   #9a8a6a  →  luminance 0.27  →  contrast  ~5.8:1 (WCAG AA)
 *   #8a7450  →  luminance 0.20  →  contrast  ~4.8:1 (WCAG AA — labels/hints)
 */

/* Primary body text — descriptions, notes, cell content */
.window-app.bg3-dialog .window-content p,
.window-app.bg3-dialog .window-content span,
.window-app.bg3-dialog .window-content small,
.window-app.bg3-dialog .window-content li,
.window-app.bg3-dialog .window-content div:not([class*="banner"]):not([class*="divider"]) {
    color: #c8bfa0 !important;
}

/* Table cells and all their descendants */
.window-app.bg3-dialog td,
.window-app.bg3-dialog td p,
.window-app.bg3-dialog td span,
.window-app.bg3-dialog td small,
.window-app.bg3-dialog td div,
.window-app.bg3-dialog td label,
.window-app.bg3-dialog td a {
    color: #c8bfa0 !important;
}

/* Secondary / muted text (costs, hints, categories) */
.window-app.bg3-dialog .hint,
.window-app.bg3-dialog .notes,
.window-app.bg3-dialog .cost,
.window-app.bg3-dialog .pm,
.window-app.bg3-dialog .mana,
.window-app.bg3-dialog [class*="pm"],
.window-app.bg3-dialog [class*="mana"],
.window-app.bg3-dialog [class*="cost"] {
    color: #9a8a6a !important;
}

/* Inline text after checkboxes / counters that show "1 PM", "2 PM" etc. */
.window-app.bg3-dialog .form-group span,
.window-app.bg3-dialog .form-group small,
.window-app.bg3-dialog .form-group p {
    color: #9a8a6a !important;
}

/* ── Placeholders — WCAG AA (≥ 4.5:1 contrast vs dark bg) ──────────────── */

.window-app.bg3-dialog input::placeholder,
.window-app.bg3-dialog textarea::placeholder {
    color: #9a8a6a !important;   /* contrast ~5.8:1 vs #090604 bg */
    opacity: 1 !important;
}

/* ── Checkboxes — dark theme ────────────────────────────────────────────── */

.window-app.bg3-dialog input[type="checkbox"] {
    appearance: none !important;
    -webkit-appearance: none !important;
    background: rgba(0, 0, 0, 0.7) !important;
    border: 1px solid #4a3a18 !important;
    border-radius: 2px !important;
    cursor: pointer !important;
    flex-shrink: 0 !important;
    height: 14px !important;
    transition: all 0.15s !important;
    vertical-align: middle !important;
    width: 14px !important;
}

.window-app.bg3-dialog input[type="checkbox"]:checked {
    background:
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M2 7l3.5 3.5L12 4' stroke='%23f0e0b0' stroke-width='2.2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
        center / 80% no-repeat,
        linear-gradient(to bottom, #6a4212, #3e2008) !important;
    border-color: #c8a96e !important;
}

.window-app.bg3-dialog input[type="checkbox"]:hover {
    border-color: #8b6914 !important;
    box-shadow: 0 0 6px rgba(139, 105, 20, 0.35) !important;
}

/* ── Counter (+ / −) buttons inside form groups ─────────────────────────── */
/* Targets all small action buttons within the form area excluding footer    */

.window-app.bg3-dialog .window-content a,
.window-app.bg3-dialog .window-content button:not([data-action]):not([type="submit"]) {
    /* Base reset — let specific selectors below override */
}

/* t20 counter / step buttons (various class names the system may use) */
.window-app.bg3-dialog .minus,
.window-app.bg3-dialog .plus,
.window-app.bg3-dialog .decrease,
.window-app.bg3-dialog .increase,
.window-app.bg3-dialog .counter-down,
.window-app.bg3-dialog .counter-up,
.window-app.bg3-dialog [data-action="decrease"],
.window-app.bg3-dialog [data-action="increase"],
.window-app.bg3-dialog .form-group > a,
.window-app.bg3-dialog .form-group > button:not([type="submit"]),
.window-app.bg3-dialog .counter > a,
.window-app.bg3-dialog .counter > button {
    background: linear-gradient(to bottom, #5c3a10, #3a2208) !important;
    border: 1px solid #7a5818 !important;
    border-radius: 3px !important;
    box-shadow:
        0 0 8px rgba(139, 105, 20, 0.25),
        inset 0 1px rgba(255, 220, 150, 0.12) !important;
    color: #f0e0b0 !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex: 0 0 auto !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.9rem !important;
    font-weight: 700 !important;
    line-height: 1 !important;
    min-height: 24px !important;
    min-width: 24px !important;
    padding: 3px 8px !important;
    text-shadow: 0 0 8px rgba(255, 200, 100, 0.4) !important;
    transition: all 0.15s !important;
}

.window-app.bg3-dialog .minus:hover,
.window-app.bg3-dialog .plus:hover,
.window-app.bg3-dialog .decrease:hover,
.window-app.bg3-dialog .increase:hover,
.window-app.bg3-dialog .counter-down:hover,
.window-app.bg3-dialog .counter-up:hover,
.window-app.bg3-dialog [data-action="decrease"]:hover,
.window-app.bg3-dialog [data-action="increase"]:hover,
.window-app.bg3-dialog .form-group > a:hover,
.window-app.bg3-dialog .form-group > button:not([type="submit"]):hover,
.window-app.bg3-dialog .counter > a:hover,
.window-app.bg3-dialog .counter > button:hover {
    background: linear-gradient(to bottom, #7c5218, #5a3210) !important;
    border-color: #c8a96e !important;
    box-shadow:
        0 0 14px rgba(200, 169, 110, 0.45),
        inset 0 1px rgba(255, 220, 150, 0.2) !important;
    color: #fff8e8 !important;
}

/* ── Bonus table (item list with checkboxes + counters) ─────────────────── */

.window-app.bg3-dialog table {
    background: transparent !important;
    border-collapse: collapse !important;
    color: #d0c4a8 !important;
    width: 100% !important;
}

.window-app.bg3-dialog thead th {
    border-bottom: 1px solid rgba(106, 78, 24, 0.4) !important;
    color: #8a7450 !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.75rem !important;
    letter-spacing: 0.1em !important;
    padding: 4px 8px !important;
    text-transform: uppercase !important;
}

.window-app.bg3-dialog tbody tr {
    border-bottom: 1px solid rgba(106, 78, 24, 0.1) !important;
}

.window-app.bg3-dialog tbody tr:last-child {
    border-bottom: none !important;
}

.window-app.bg3-dialog tbody td {
    color: #d0c4a8 !important;
    font-size: 0.82rem !important;
    padding: 4px 8px !important;
    vertical-align: middle !important;
}

/* ── Tormenta20 themed overrides ────────────────────────────────────────── */

.window-app.bg3-dialog.tormenta20 .window-content {
    padding: 0 !important;
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
}

/* Ensure the inner form also doesn't create a nested scroll */
.window-app.bg3-dialog form {
    overflow: visible !important;
    height: auto !important;
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDialogStyles(): void {
    if (!document.getElementById(DIALOG_STYLES_ID)) {
        const el = document.createElement("style");
        el.id = DIALOG_STYLES_ID;
        el.textContent = DIALOG_STYLES;
        document.head.appendChild(el);
    }
}

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Extract the skill/ability name from the dialog window title. */
function extractLabel(title: string): string {
    const colonIdx = title.lastIndexOf(":");
    if (colonIdx !== -1) return title.slice(colonIdx + 1).trim();
    return title.trim();
}

/**
 * Add the BG3 class + inject a skill-name banner into the dialog's form.
 * Works with V1 Application (jQuery html arg) and V2 (HTMLElement arg).
 */
function stylizeDialog(
    app: { options?: { title?: string }; title?: string },
    htmlArg: unknown,
): void {
    // Resolve the root HTMLElement from whatever Foundry passes
    let el: HTMLElement | null = null;
    if (htmlArg instanceof HTMLElement) {
        el = htmlArg;
    } else if (htmlArg && typeof htmlArg === "object") {
        // jQuery object: {0: HTMLElement, ...}
        el = (htmlArg as Record<string, unknown>)[0] as HTMLElement | null;
    }
    if (!el) return;

    el.classList.add("bg3-dialog");

    // Inject skill-name banner once (guard against double-render)
    if (el.querySelector(".bg3-skill-banner")) return;

    const rawTitle: string = app.title ?? app.options?.title ?? "";
    const label = extractLabel(rawTitle);
    if (!label) return;

    const banner = document.createElement("div");
    banner.className = "bg3-skill-banner";
    banner.innerHTML = `
        <div class="bg3-skill-name">${esc(label)}</div>
        <div class="bg3-skill-divider"></div>
    `;

    // Prepend inside the form (or window-content if no form)
    const target =
        el.querySelector("form") ??
        el.querySelector(".window-content") ??
        el;
    target.prepend(banner);
}

// ── Public setup ──────────────────────────────────────────────────────────────

export function setupDialogStyling(): void {
    ensureDialogStyles();

    // Primary: AbilityUseDialog (perícias, resistências, ataques)
    Hooks.on("renderAbilityUseDialog", (...args: unknown[]): void => {
        stylizeDialog(
            args[0] as { options?: { title?: string }; title?: string },
            args[1],
        );
    });

    // Fallback: any tormenta20 Dialog that contains a roll form
    Hooks.on("renderDialog", (...args: unknown[]): void => {
        const htmlArg = args[1];
        let el: HTMLElement | null = null;
        if (htmlArg instanceof HTMLElement) el = htmlArg;
        else if (htmlArg && typeof htmlArg === "object")
            el = (htmlArg as Record<string, unknown>)[0] as HTMLElement | null;

        if (!el) return;
        if (
            !el.classList.contains("tormenta20") &&
            !el.querySelector(".tormenta20")
        )
            return;

        stylizeDialog(
            args[0] as { options?: { title?: string }; title?: string },
            htmlArg,
        );
    });
}

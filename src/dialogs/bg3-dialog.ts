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
    min-width: 320px !important;
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

/* ── Tormenta20 themed overrides ────────────────────────────────────────── */

.window-app.bg3-dialog.tormenta20 .window-content {
    padding: 0 !important;
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

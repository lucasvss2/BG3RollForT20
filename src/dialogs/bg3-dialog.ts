/**
 * BG3-style visual restyling for Tormenta20 roll dialogs.
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

.window-app.bg3-dialog .window-content {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
}

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
    background: linear-gradient(to right, transparent, rgba(106, 78, 24, 0.18), transparent) !important;
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

/* ── Skill name banner ───────────────────────────────────────────────────── */

.bg3-skill-banner {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 16px 10px;
    text-align: center;
    position: relative;
    z-index: 1;
}

.bg3-banner-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
}

.bg3-skill-img {
    border: 1px solid rgba(200, 169, 110, 0.5);
    border-radius: 4px;
    box-shadow: 0 0 14px rgba(200, 169, 110, 0.35);
    flex-shrink: 0;
    height: 56px;
    object-fit: cover;
    width: 56px;
}

.bg3-skill-name {
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    font-size: clamp(1.5rem, 4vw, 2.2rem);
    font-weight: 700;
    color: #c8a96e !important;
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

/* Direct-child labels = field names ("BÔNUS NO TESTE", "ROLL MODE") */
.window-app.bg3-dialog .form-group > label {
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

/* ── Footer / submit buttons ─────────────────────────────────────────────── */

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
    align-items: center !important;
    background: linear-gradient(to bottom, #5c3a10, #3a2208) !important;
    border: 1px solid #7a5818 !important;
    border-radius: 4px !important;
    box-shadow: 0 0 16px rgba(139, 105, 20, 0.3), inset 0 1px rgba(255, 220, 150, 0.15) !important;
    color: #f0e0b0 !important;
    cursor: pointer !important;
    display: inline-flex !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 1rem !important;
    font-weight: 700 !important;
    justify-content: center !important;
    letter-spacing: 0.2em !important;
    padding: 9px 16px !important;
    text-align: center !important;
    text-shadow: 0 0 12px rgba(255, 200, 100, 0.5) !important;
    text-transform: uppercase !important;
    transition: all 0.15s !important;
    width: 100% !important;
}

.window-app.bg3-dialog footer button:hover,
.window-app.bg3-dialog .dialog-buttons button:hover {
    background: linear-gradient(to bottom, #7c5218, #5a3210) !important;
    border-color: #c8a96e !important;
    box-shadow: 0 0 24px rgba(200, 169, 110, 0.55), inset 0 1px rgba(255, 220, 150, 0.25) !important;
    color: #fff8e8 !important;
}

.window-app.bg3-dialog footer button i,
.window-app.bg3-dialog .dialog-buttons button i {
    margin-right: 6px !important;
    color: inherit !important;
}

/* ── Shared mixin for all small action buttons (counter +/-) ─────────────── */

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
.window-app.bg3-dialog .counter > button,
/* t20 aprimoramento +/- buttons (class numCtrl inside .item-cost) */
.window-app.bg3-dialog .numCtrl,
.window-app.bg3-dialog .item-cost > button,
.window-app.bg3-dialog li.item button,
/* Buttons / anchors inside table cells */
.window-app.bg3-dialog tbody td > button,
.window-app.bg3-dialog tbody td > a {
    background: linear-gradient(to bottom, #5c3a10, #3a2208) !important;
    border: 1px solid #7a5818 !important;
    border-radius: 3px !important;
    box-shadow: 0 0 8px rgba(139, 105, 20, 0.25), inset 0 1px rgba(255, 220, 150, 0.12) !important;
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
.window-app.bg3-dialog .counter > button:hover,
.window-app.bg3-dialog .numCtrl:hover,
.window-app.bg3-dialog .item-cost > button:hover,
.window-app.bg3-dialog li.item button:hover,
.window-app.bg3-dialog tbody td > button:hover,
.window-app.bg3-dialog tbody td > a:hover {
    background: linear-gradient(to bottom, #7c5218, #5a3210) !important;
    border-color: #c8a96e !important;
    box-shadow: 0 0 14px rgba(200, 169, 110, 0.45), inset 0 1px rgba(255, 220, 150, 0.2) !important;
    color: #fff8e8 !important;
}

/* ── t20 enhancement list (ul.aprimoramentos-list) ──────────────────────── */

.window-app.bg3-dialog .aprimoramentos-list {
    list-style: none !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
}

/* Header row */
.window-app.bg3-dialog .aprimoramentos-list .items-header {
    background: transparent !important;
    border: none !important;
    border-bottom: 1px solid rgba(106, 78, 24, 0.4) !important;
    margin: 0 !important;
    padding: 4px 8px !important;
}

.window-app.bg3-dialog .aprimoramentos-list .items-header h3 {
    color: #8a7450 !important;
    font-family: "Modesto Condensed", "Palatino Linotype", serif !important;
    font-size: 0.75rem !important;
    font-weight: normal !important;
    letter-spacing: 0.1em !important;
    margin: 0 !important;
    text-transform: uppercase !important;
}

/* Each enhancement row */
.window-app.bg3-dialog .aprimoramentos-list li.item {
    align-items: flex-start !important;
    border-bottom: 1px solid rgba(106, 78, 24, 0.12) !important;
    min-height: 28px !important;
    padding: 5px 8px !important;
}

.window-app.bg3-dialog .aprimoramentos-list li.item:last-child {
    border-bottom: none !important;
}

/* Left column: keep it compact, vertically center its own content */
.window-app.bg3-dialog .aprimoramentos-list .item-cost {
    align-items: center !important;
    flex-shrink: 0 !important;
    flex-wrap: nowrap !important;
    gap: 4px !important;
    min-height: 20px !important;
}

/* Right column: item description */
.window-app.bg3-dialog .aprimoramentos-list h4.item-name {
    font-size: 0.82rem !important;
    font-weight: normal !important;
    line-height: 1.4 !important;
    margin: 0 !important;
    padding: 0 !important;
}

/* ── Bonus table (enhancement list) ─────────────────────────────────────── */

.window-app.bg3-dialog table {
    background: transparent !important;
    border-collapse: collapse !important;
    color: #c8bfa0 !important;
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
    color: #c8bfa0 !important;
    font-size: 0.82rem !important;
    padding: 4px 8px !important;
    vertical-align: middle !important;
}

/* ── Placeholders ───────────────────────────────────────────────────────── */

.window-app.bg3-dialog input::placeholder,
.window-app.bg3-dialog textarea::placeholder {
    color: #9a8a6a !important;
    opacity: 1 !important;
}

/* ── Checkboxes ─────────────────────────────────────────────────────────── */

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

/* ── Tormenta20 overrides ────────────────────────────────────────────────── */

.window-app.bg3-dialog.tormenta20 .window-content {
    padding: 0 !important;
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
}

.window-app.bg3-dialog form {
    overflow: visible !important;
    height: auto !important;
}
`;

// ── Attribute / ability name table (t20 keys → Portuguese display names) ─────

const T20_ABILITY_LABELS: Record<string, string> = {
    // Atributos
    for: "Força",   str: "Força",
    des: "Destreza", dex: "Destreza",
    con: "Constituição",
    int: "Inteligência",
    sab: "Sabedoria", wis: "Sabedoria",
    car: "Carisma",   cha: "Carisma",
    // Resistências
    fort: "Fortitude",
    ref:  "Reflexos",
    vont: "Vontade",  will: "Vontade",
};

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

function extractLabel(title: string): string {
    const colonIdx = title.lastIndexOf(":");
    if (colonIdx !== -1) return title.slice(colonIdx + 1).trim();
    return title.trim();
}

function isValidName(v: unknown): v is string {
    return typeof v === "string" && v.trim().length > 0 && v.trim().toLowerCase() !== "undefined";
}

const PLACEHOLDER_IMGS = [
    "icons/svg/mystery-man.svg",
    "icons/svg/item-bag.svg",
    "icons/svg/coin.svg",
];

/**
 * Try to map an ability key (e.g. "for", "fort") to its display name.
 * Returns empty string when no match is found.
 */
function abilityKeyToLabel(key: unknown): string {
    if (typeof key !== "string" || !key) return "";
    return T20_ABILITY_LABELS[key.toLowerCase()] ?? "";
}

/**
 * Look for an attribute/ability key in every plausible location on the app
 * object or in the rendered DOM, then return the Portuguese display name.
 */
function resolveAbilityName(app: AppLike, el: HTMLElement): string {
    const a = app as Record<string, unknown>;
    const opts = a.options as Record<string, unknown> | undefined;

    // t20 AbilityUseDialog: item.id is the raw attribute key (e.g. "des", "for")
    // item.parts is a dice parts array like ["1d20", "@des"] — join and parse the @key
    const appItem = app.item;
    if (appItem) {
        const label = abilityKeyToLabel(appItem.id);
        if (label) return label;

        const rawParts = appItem.parts;
        const parts = Array.isArray(rawParts) ? rawParts.join(",") : (rawParts ?? "");
        const atMatch = parts.match(/@([a-z]+)/i);
        if (atMatch) {
            const fromParts = abilityKeyToLabel(atMatch[1]);
            if (fromParts) return fromParts;
        }
    }

    // Direct properties and options
    for (const v of [
        a.ability, a.attribute, a.save, a.skill, a.type,
        opts?.ability, opts?.attribute, opts?.save, opts?.skill, opts?.itemType,
    ]) {
        const label = abilityKeyToLabel(v);
        if (label) return label;
    }

    // Hidden inputs — t20 often serialises the ability key into the form
    for (const inp of el.querySelectorAll<HTMLInputElement>("input[type=hidden]")) {
        const label = abilityKeyToLabel(inp.value) || abilityKeyToLabel(inp.name);
        if (label) return label;
    }

    // Data-attribute shortcuts on arbitrary elements
    for (const attr of ["data-ability", "data-attribute", "data-save", "data-skill"]) {
        const val = el.querySelector(`[${attr}]`)?.getAttribute(attr);
        if (val) {
            const label = abilityKeyToLabel(val);
            if (label) return label;
        }
    }

    return "";
}

/**
 * Force readable text color on all text-bearing descendants of the dialog.
 * Uses inline style with priority "important" to beat any system !important rule.
 * Called immediately on render AND scheduled for 200 ms later to cover any
 * post-render DOM mutations performed by the t20 system.
 */
function forceTextVisibility(el: HTMLElement): void {
    el.querySelectorAll<HTMLElement>(
        "td, td *, tr td *, p, span, small, li, h1, h2, h3, h4, h5, h6, label"
    ).forEach((node) => {
        if (node.matches(
            "input, select, button, " +
            ".bg3-skill-name, .bg3-skill-divider, .bg3-skill-banner, .bg3-banner-row, .bg3-skill-img"
        )) return;
        node.style.setProperty("color", "#c8bfa0", "important");
    });

    // Restore muted gold for form-row field-name labels
    el.querySelectorAll<HTMLElement>(".form-group > label").forEach((node) => {
        node.style.setProperty("color", "#8a7450", "important");
    });

    // Restore gold for the banner name
    el.querySelectorAll<HTMLElement>(".bg3-skill-name").forEach((node) => {
        node.style.setProperty("color", "#c8a96e", "important");
    });
}

type AppLike = {
    options?: { title?: string };
    title?: string;
    object?: { name?: string; img?: string };
    item?: { name?: string; img?: string; id?: string; parts?: string | string[] };
};

/**
 * Add the BG3 class + inject a skill-name banner (with optional image).
 * Accepts optional template data from hook args[2].
 */
function stylizeDialog(
    app: AppLike,
    htmlArg: unknown,
    templateData?: Record<string, unknown>,
): void {
    let el: HTMLElement | null = null;
    if (htmlArg instanceof HTMLElement) {
        el = htmlArg;
    } else if (htmlArg && typeof htmlArg === "object") {
        el = (htmlArg as Record<string, unknown>)[0] as HTMLElement | null;
    }
    if (!el) return;

    el.classList.add("bg3-dialog");

    // Apply immediately and again after 200 ms to catch any post-render DOM updates
    forceTextVisibility(el);
    const elRef = el;
    setTimeout(() => forceTextVisibility(elRef), 200);

    if (el.querySelector(".bg3-skill-banner")) return;

    // ── Resolve item name ────────────────────────────────────────────────────

    const tdItem = templateData?.["item"] as { name?: string; img?: string } | undefined;
    const opts = (app as Record<string, unknown>).options as Record<string, unknown> | undefined;
    const optsItem = opts?.["item"] as { name?: string; img?: string } | undefined;

    const nameSources: unknown[] = [
        app.object?.name, app.item?.name,
        tdItem?.name, optsItem?.name,
        opts?.["ability"], opts?.["skill"],
    ];
    let itemName = (nameSources.find(isValidName) as string | undefined) ?? "";

    // ── Resolve item image ───────────────────────────────────────────────────

    const imgSources = [app.object?.img, app.item?.img, tdItem?.img, optsItem?.img];
    const itemImg =
        imgSources.find(
            (s): s is string =>
                typeof s === "string" &&
                s.length > 0 &&
                !PLACEHOLDER_IMGS.some((p) => s.includes(p)),
        ) ?? "";

    // ── Resolve display label ────────────────────────────────────────────────

    const rawTitle: string = app.title ?? app.options?.title ?? "";
    const titleLabel = extractLabel(rawTitle);

    let label = isValidName(titleLabel) ? titleLabel : itemName;

    // Last resort for attribute rolls: scan the app object and DOM for ability key
    if (!label) {
        label = resolveAbilityName(app, el);
    }

    if (!label) return;

    // ── Fix window title if t20 left "undefined" in it ──────────────────────
    const titleEl = el.querySelector<HTMLElement>(".window-title");
    const titleTextNode = titleEl?.childNodes[0];
    if (titleTextNode && titleEl?.textContent?.toLowerCase().includes("undefined")) {
        titleTextNode.textContent = titleEl.textContent.replace("undefined", label);
    }

    // ── Build and inject banner ──────────────────────────────────────────────

    const imgHtml = itemImg
        ? `<img class="bg3-skill-img" src="${itemImg}" alt="" />`
        : "";

    const banner = document.createElement("div");
    banner.className = "bg3-skill-banner";
    banner.innerHTML = `
        <div class="bg3-banner-row">
            ${imgHtml}
            <div class="bg3-skill-name">${esc(label)}</div>
        </div>
        <div class="bg3-skill-divider"></div>
    `;

    const target =
        el.querySelector("form") ??
        el.querySelector(".window-content") ??
        el;
    target.prepend(banner);
}

// ── Public setup ──────────────────────────────────────────────────────────────

export function setupDialogStyling(): void {
    ensureDialogStyles();

    Hooks.on("renderAbilityUseDialog", (...args: unknown[]): void => {
        stylizeDialog(
            args[0] as AppLike,
            args[1],
            args[2] as Record<string, unknown> | undefined,
        );
    });

    Hooks.on("renderDialog", (...args: unknown[]): void => {
        const htmlArg = args[1];
        let el: HTMLElement | null = null;
        if (htmlArg instanceof HTMLElement) el = htmlArg;
        else if (htmlArg && typeof htmlArg === "object")
            el = (htmlArg as Record<string, unknown>)[0] as HTMLElement | null;

        if (!el) return;
        if (!el.classList.contains("tormenta20") && !el.querySelector(".tormenta20")) return;

        stylizeDialog(
            args[0] as AppLike,
            htmlArg,
            args[2] as Record<string, unknown> | undefined,
        );
    });
}

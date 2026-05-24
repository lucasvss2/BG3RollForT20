/**
 * Design tokens — fonte única da verdade para cores do tema BG3-T20.
 *
 * Para usar:
 *  - Em CSS (dentro de strings injetadas): `color: var(--bg3-accent);`
 *  - Em TypeScript (quando precisa da cor pura, ex: chat-render): `COLORS.accent`
 *
 * Princípios:
 *  - Nomes SEMÂNTICOS, não posicionais (`accent`, não `gold-1`).
 *  - Limite de variantes por alpha — não criar uma var nova para cada novo valor;
 *    arredondar para o token mais próximo. Se faltar uma variante essencial, adicionar
 *    aqui ANTES de hardcoded no módulo.
 *  - Cada hex listado em tokens deve aparecer em pelo menos 2 módulos diferentes,
 *    ou ser uma cor estruturalmente importante (estado de erro, sucesso, etc.).
 */

export const COLORS = {
    // ── Backgrounds ──────────────────────────────────────────────────────────
    bgDeepest:  "#0c0907",
    bgDark:     "#1a1108",
    bgMid:      "#2a1e08",
    bgOverlay:  "rgba(0,0,0,0.85)",

    // ── Accent (BG3 gold) ────────────────────────────────────────────────────
    accent:        "#c9a76a",   // primary gold
    accentBright:  "#e8d8a8",   // highlight / hover (cream tint)
    accentGold:    "#e6c987",   // vivid bright gold — charname, stat values, hover highlights
    accentMuted:   "#8a7450",   // muted gold
    accentRgb:     "201,167,106", // for rgba() compositions

    // ── Borders / dividers ───────────────────────────────────────────────────
    borderAmbient: "#6a4e18",            // solid 1px amber border for cards
    border:        "rgba(201,167,106,0.25)",
    borderStrong:  "rgba(201,167,106,0.4)",
    divider:       "rgba(106, 78, 24, 0.4)",
    dividerMed:    "rgba(106, 78, 24, 0.2)",
    dividerSoft:   "rgba(106, 78, 24, 0.12)",

    // ── Accent tint layers (background washes / overlays) ────────────────────
    tintSubtle:  "rgba(201,167,106,0.08)",
    tintSoft:    "rgba(201,167,106,0.12)",
    tintMed:     "rgba(201,167,106,0.2)",
    tintStrong:  "rgba(201,167,106,0.3)",
    tintBold:    "rgba(201,167,106,0.45)",

    // ── Text ─────────────────────────────────────────────────────────────────
    textBright:    "#e8e0d0",
    textPrimary:   "#c8bda8",
    textSecondary: "#c0b4a0",
    textMuted:     "#9a8e7a",
    textDisabled:  "#6a5e48",

    // ── Semantic — estados ────────────────────────────────────────────────────
    success:     "#6ecf7a",  // healing, pass
    successRgb:  "110,207,122",
    danger:      "#cc4444",  // damage, fail
    dangerRgb:   "204,68,68",
    info:        "#8ab4e8",  // spell info, hint
    infoRgb:     "138,180,232",
    colorCrit:   "#ffd700",  // crítico (20 natural)
    colorCritRgb:"255,215,0",
    colorFailure:"#c8a070",  // falha não-crítica (outcome de perícia/teste secreto)

    // ── Button gradient (used by .numCtrl, action buttons) ───────────────────
    btnBgTop:    "#5c3a10",
    btnBgBottom: "#3a2208",
    btnBorder:   "#7a5818",
    btnText:     "#f0e0b0",
    btnTextHover: "#fff8e8",
} as const;

/**
 * CSS gerado a partir de COLORS. Injetar uma única vez no boot (setupTheme).
 * Aplicado em :root para que `var(--bg3-*)` esteja disponível em qualquer
 * seletor descendente — incluindo dentro de dialogs/sheets do Foundry.
 */
export const THEME_CSS = `
:root {
    /* Backgrounds */
    --bg3-bg-deepest:  ${COLORS.bgDeepest};
    --bg3-bg-dark:     ${COLORS.bgDark};
    --bg3-bg-mid:      ${COLORS.bgMid};
    --bg3-bg-overlay:  ${COLORS.bgOverlay};

    /* Accent */
    --bg3-accent:         ${COLORS.accent};
    --bg3-accent-bright:  ${COLORS.accentBright};
    --bg3-accent-gold:    ${COLORS.accentGold};
    --bg3-accent-muted:   ${COLORS.accentMuted};
    --bg3-accent-rgb:     ${COLORS.accentRgb};

    /* Borders / dividers */
    --bg3-border-ambient: ${COLORS.borderAmbient};
    --bg3-border:         ${COLORS.border};
    --bg3-border-strong:  ${COLORS.borderStrong};
    --bg3-divider:        ${COLORS.divider};
    --bg3-divider-med:    ${COLORS.dividerMed};
    --bg3-divider-soft:   ${COLORS.dividerSoft};

    /* Accent tints */
    --bg3-tint-subtle:  ${COLORS.tintSubtle};
    --bg3-tint-soft:    ${COLORS.tintSoft};
    --bg3-tint-med:     ${COLORS.tintMed};
    --bg3-tint-strong:  ${COLORS.tintStrong};
    --bg3-tint-bold:    ${COLORS.tintBold};

    /* Text */
    --bg3-text-bright:    ${COLORS.textBright};
    --bg3-text-primary:   ${COLORS.textPrimary};
    --bg3-text-secondary: ${COLORS.textSecondary};
    --bg3-text-muted:     ${COLORS.textMuted};
    --bg3-text-disabled:  ${COLORS.textDisabled};

    /* Semantic */
    --bg3-color-success:     ${COLORS.success};
    --bg3-color-success-rgb: ${COLORS.successRgb};
    --bg3-color-danger:      ${COLORS.danger};
    --bg3-color-danger-rgb:  ${COLORS.dangerRgb};
    --bg3-color-info:        ${COLORS.info};
    --bg3-color-info-rgb:    ${COLORS.infoRgb};
    --bg3-color-crit:        ${COLORS.colorCrit};
    --bg3-color-crit-rgb:    ${COLORS.colorCritRgb};
    --bg3-color-failure:     ${COLORS.colorFailure};

    /* Button gradient */
    --bg3-btn-bg-top:     ${COLORS.btnBgTop};
    --bg3-btn-bg-bottom:  ${COLORS.btnBgBottom};
    --bg3-btn-border:     ${COLORS.btnBorder};
    --bg3-btn-text:       ${COLORS.btnText};
    --bg3-btn-text-hover: ${COLORS.btnTextHover};
}
`;

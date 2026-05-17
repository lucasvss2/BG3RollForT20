/**
 * Theme setup — injeta as CSS custom properties dos tokens uma única vez
 * no documento. Chamado MUITO cedo no boot (antes de qualquer outro setup),
 * para que módulos descendentes possam usar `var(--bg3-*)` em seus estilos.
 */

import { THEME_CSS } from "./tokens";

const THEME_STYLE_ID = "bg3-t20-theme-tokens";

export function setupTheme(): void {
    if (document.getElementById(THEME_STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = THEME_STYLE_ID;
    el.textContent = THEME_CSS;
    document.head.appendChild(el);
}

export { COLORS } from "./tokens";

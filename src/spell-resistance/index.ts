import { MODULE_ID } from "@/constants";
import { computeSkillTotal, computeSkillBreakdown } from "@/hidden-test/skills";
import { getAuraAntimagiaContextForActor } from "@/area-spells/aura-sagrada";
import { getSocket, onSocketReady } from "@/socket";
import {
    getActivatableItems,
    type ActivatableItem,
} from "@/hidden-test/HiddenTestPlayerDialog";
import type {
    SpellResistPreRollRequest,
    ResistSkill,
    ResistOutcome,
} from "./types";

// ── socketlib handler names ──────────────────────────────────────────────────

const SOCKET_PRE_ROLL    = "spell-resist/preroll";
const SOCKET_AUTO_APPLY  = "spell-resist/auto-apply-buff";
const SOCKET_PURIFY      = "spell-resist/purification";

// ── Constantes ────────────────────────────────────────────────────────────────

const SPELL_TIPOS = ["arc", "div", "uni"] as const;

const SKILL_LABELS: Record<ResistSkill, string> = {
    fort: "Fortitude",
    refl: "Reflexos",
    vont: "Vontade",
};

// ── CSS ───────────────────────────────────────────────────────────────────────

const SPELL_RESIST_STYLES_ID = "bg3-t20-spell-resist-styles";

const SPELL_RESIST_STYLES = `
/* ── Unified Spell Modal (smf-) ─────────────────────────────────────────── */

.smf-body {
    padding: 0;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
}
.smf-banner {
    padding: 12px 16px 8px;
    text-align: center;
    background: linear-gradient(180deg, rgba(138,180,232,0.08) 0%, transparent 100%);
}
.smf-label-sm {
    color: #8a7450;
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    flex: 0 0 auto;
}
.smf-spell-name {
    color: #8ab4e8;
    font-size: clamp(1.2rem, 2.8vw, 1.65rem);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-shadow: 0 0 18px rgba(138,180,232,0.55);
    text-transform: uppercase;
    margin: 4px 0 2px;
}
.smf-caster-name {
    color: #c8a96e;
    font-size: 0.88rem;
    font-weight: 600;
    letter-spacing: 0.06em;
}
.smf-target-name {
    color: #e8d8a8;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    margin-top: 2px;
}
.smf-divider {
    background: linear-gradient(to right, transparent, rgba(138,180,232,0.3), transparent);
    height: 1px;
    margin: 0 12px;
}

/* ── Seções ──────────────────────────────────────────────────────────────── */

.smf-section {
    padding: 6px 14px 8px;
}
.smf-section-title {
    color: #8a7450;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 5px;
}
.smf-section-title i { color: #8ab4e8; }
.smf-na-text {
    color: #5a5040;
    font-size: 0.82rem;
    font-style: italic;
}

/* ── Seção Resistência ───────────────────────────────────────────────────── */

.smf-resist-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 6px;
    flex-wrap: wrap;
}
.smf-resist-bonus {
    color: #6ecf7a;
    font-size: 1.1rem;
    font-weight: 900;
}
.smf-bonus-tooltip-host {
    cursor: help;
    border-bottom: 1px dotted rgba(110, 207, 122, 0.4);
}
.smf-bonus-tooltip-host:hover,
.smf-bonus-tooltip-host:focus {
    border-bottom-color: rgba(110, 207, 122, 0.9);
    outline: none;
}
.smf-resist-outcome {
    color: #c8a96e;
    font-size: 0.82rem;
    font-style: italic;
    margin-left: auto;
}
.smf-powers-section {
    margin-bottom: 6px;
}
.smf-powers-header {
    display: grid;
    grid-template-columns: 20px 30px 1fr 60px;
    gap: 4px;
    align-items: center;
    color: #8a7450;
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding-bottom: 3px;
    border-bottom: 1px solid rgba(200,169,110,0.2);
    margin-bottom: 3px;
}
.smf-power-row {
    display: grid;
    grid-template-columns: 20px 30px 1fr 60px;
    gap: 4px;
    align-items: center;
    padding: 2px 0;
    font-size: 0.83rem;
    color: #e8d8a8;
}
.smf-power-row:hover { background: rgba(138,180,232,0.06); }
.smf-power-check { accent-color: #8ab4e8; width: 13px; height: 13px; cursor: pointer; }
.smf-pm-cost { color: #8ab4e8; font-weight: 700; text-align: center; font-size: 0.78rem; }
.smf-power-bonus-known { color: #6ecf7a; font-weight: 700; text-align: right; font-size: 0.83rem; }
.smf-power-bonus-adv   { color: #f0c060; font-weight: 700; text-align: right; font-size: 0.83rem; }
.smf-pm-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0 2px;
    border-top: 1px solid rgba(200,169,110,0.2);
    margin-top: 3px;
    font-size: 0.78rem;
}
.smf-pm-display { color: #8ab4e8; font-weight: 700; font-size: 0.95rem; }
.smf-extra-input {
    width: 100%;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(200,169,110,0.3);
    border-radius: 3px;
    color: #e8d8a8;
    font-family: "Modesto Condensed", monospace;
    font-size: 0.9rem;
    padding: 3px 8px;
    margin-bottom: 6px;
    box-sizing: border-box;
}
.smf-extra-input:focus { outline: none; border-color: rgba(138,180,232,0.6); }
.smf-action-btn {
    width: 100%;
    padding: 5px 10px;
    background: rgba(138,180,232,0.12);
    border: 1px solid rgba(138,180,232,0.4);
    border-radius: 3px;
    color: #8ab4e8;
    cursor: pointer;
    font-family: "Modesto Condensed", serif;
    font-size: 0.88rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-bottom: 4px;
}
.smf-action-btn:hover    { background: rgba(138,180,232,0.22); }
.smf-action-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.smf-resist-result {
    background: rgba(0,0,0,0.2);
    border: 1px solid rgba(138,180,232,0.2);
    border-radius: 4px;
    padding: 6px 10px;
    margin-top: 4px;
    display: none;
}
.smf-rr-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
}
.smf-rr-pass { color: #6ecf7a; font-size: 1.3rem; font-weight: 900; }
.smf-rr-fail { color: #cc4444; font-size: 1.3rem; font-weight: 900; }
.smf-rr-badge-pass {
    background: rgba(110,207,122,0.15); color: #6ecf7a;
    border: 1px solid rgba(110,207,122,0.4); border-radius: 3px;
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em;
    padding: 1px 8px; margin-left: auto;
}
.smf-rr-badge-fail {
    background: rgba(204,68,68,0.15); color: #cc4444;
    border: 1px solid rgba(204,68,68,0.4); border-radius: 3px;
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em;
    padding: 1px 8px; margin-left: auto;
}
.smf-rr-outcome {
    font-size: 0.8rem; color: #c8a96e; margin-top: 3px;
}
.smf-applied-powers { margin-top: 3px; }
.smf-applied-power  { font-size: 0.76rem; color: #8ab4e8; font-style: italic; line-height: 1.4; }

/* ── Seção Dano / Cura ───────────────────────────────────────────────────── */

.smf-dmg-number {
    color: #cc4444; font-size: 2.8rem; font-weight: 900; line-height: 1;
    text-shadow: 0 0 24px rgba(204,68,68,0.55); text-align: center; margin: 2px 0 6px;
}
.smf-heal-number {
    color: #6ecf7a; font-size: 2.8rem; font-weight: 900; line-height: 1;
    text-shadow: 0 0 24px rgba(110,207,122,0.55); text-align: center; margin: 2px 0 6px;
}
.smf-dmg-btns { display: flex; flex-direction: column; gap: 4px; }
.smf-dmg-btn {
    padding: 5px 10px;
    background: rgba(204,68,68,0.1); border: 1px solid rgba(204,68,68,0.35);
    border-radius: 3px; color: #e8a8a8; cursor: pointer;
    font-family: "Modesto Condensed", serif; font-size: 0.88rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    transition: background 0.15s; display: flex; align-items: center; gap: 6px;
}
.smf-dmg-btn:hover { background: rgba(204,68,68,0.2); }
.smf-dmg-btn.smf-spent { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
.smf-heal-btn {
    padding: 5px 10px;
    background: rgba(110,207,122,0.1); border: 1px solid rgba(110,207,122,0.35);
    border-radius: 3px; color: #a8e8b8; cursor: pointer;
    font-family: "Modesto Condensed", serif; font-size: 0.88rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    transition: background 0.15s; display: flex; align-items: center; gap: 6px;
}
.smf-heal-btn:hover { background: rgba(110,207,122,0.2); }
.smf-heal-btn.smf-spent { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
.smf-consagrar-label {
    display: flex; align-items: center; gap: 6px; cursor: pointer;
    color: #e8c46e; font-size: 0.82rem; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; margin: 0 0 4px; user-select: none;
}
.smf-consagrar-label input[type="checkbox"] { accent-color: #e8c46e; width: 14px; height: 14px; }
.smf-consagrar-label i { color: #e8c46e; }
.smf-consagrar-max { color: #8a7450; font-size: 0.78rem; font-weight: 400; }
.smf-undead-label {
    display: flex; align-items: center; gap: 6px; cursor: pointer;
    color: #b06080; font-size: 0.82rem; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; margin: 0 0 6px; user-select: none;
}
.smf-undead-label input[type="checkbox"] { accent-color: #b06080; width: 14px; height: 14px; }
.smf-undead-label i { color: #b06080; }
.smf-undead-dmg-btn {
    padding: 5px 10px;
    background: rgba(160,60,90,0.12); border: 1px solid rgba(160,60,90,0.4);
    border-radius: 3px; color: #d890a8; cursor: pointer; width: 100%;
    font-family: inherit; font-size: 0.8rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    transition: background 0.15s; display: flex; align-items: center; gap: 6px;
}
.smf-undead-dmg-btn:hover { background: rgba(160,60,90,0.25); }
.smf-undead-dmg-btn.smf-spent { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
.smf-feedback {
    font-size: 0.82rem; color: #6ecf7a; text-align: center;
    padding: 3px 0; display: none;
}

/* ── Seção Buff ──────────────────────────────────────────────────────────── */

.smf-buff-btns { display: flex; flex-direction: column; gap: 4px; }
.smf-buff-btn {
    padding: 5px 10px;
    background: rgba(200,169,110,0.1); border: 1px solid rgba(200,169,110,0.3);
    border-radius: 3px; color: #e8d8a8; cursor: pointer;
    font-family: "Modesto Condensed", serif; font-size: 0.88rem; font-weight: 700;
    letter-spacing: 0.05em; transition: background 0.15s;
    display: flex; align-items: center; gap: 8px;
}
.smf-buff-btn img  { width: 16px; height: 16px; object-fit: contain; border: none; }
.smf-buff-btn:hover { background: rgba(200,169,110,0.2); }
.smf-buff-btn.smf-spent {
    background: rgba(110,207,122,0.1); border-color: rgba(110,207,122,0.4);
    color: #6ecf7a; cursor: default; pointer-events: none;
}

/* ── Seção Condições ─────────────────────────────────────────────────────── */

.smf-cond-filter {
    width: 100%; background: rgba(0,0,0,0.3);
    border: 1px solid rgba(200,169,110,0.3); border-radius: 3px;
    color: #e8d8a8; font-family: "Modesto Condensed", monospace;
    font-size: 0.88rem; padding: 3px 8px; margin-bottom: 6px; box-sizing: border-box;
}
.smf-cond-filter:focus { outline: none; border-color: rgba(138,180,232,0.6); }
.smf-cond-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 2px 6px; max-height: 200px; overflow-y: auto; margin-bottom: 6px;
}
.smf-cond-item {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.82rem; color: #e8d8a8; cursor: pointer;
    padding: 2px 3px; border-radius: 2px; user-select: none;
}
.smf-cond-item:hover  { background: rgba(138,180,232,0.08); }
.smf-cond-item.smf-hidden { display: none; }
.smf-cond-item input  { accent-color: #8ab4e8; width: 11px; height: 11px; cursor: pointer; flex-shrink: 0; }
.smf-cond-icon        { width: 16px; height: 16px; object-fit: contain; border: none; flex-shrink: 0; }
.smf-cond-ph          { width: 16px; height: 16px; flex-shrink: 0; }
.smf-cond-apply-btn {
    width: 100%; padding: 4px 10px;
    background: rgba(138,180,232,0.1); border: 1px solid rgba(138,180,232,0.35);
    border-radius: 3px; color: #8ab4e8; cursor: pointer;
    font-family: "Modesto Condensed", serif; font-size: 0.82rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    transition: background 0.15s; display: flex; align-items: center;
    justify-content: center; gap: 5px;
}
.smf-cond-apply-btn:hover { background: rgba(138,180,232,0.2); }

/* ── Collapse toggle ─────────────────────────────────────────────────────── */

.smf-section-title { cursor: pointer; }
/* Especificidade dupla pra sobrepor o "width: 100%" default que o Foundry
   aplica em buttons dentro de .dialog/.window-app form. */
.smf-section-title > .smf-collapse-btn,
.smf-dialog .smf-collapse-btn {
    margin-left: auto;
    background: none;
    border: none;
    color: #8a7450;
    cursor: pointer;
    padding: 2px;
    width: auto;
    height: auto;
    min-width: 0;
    line-height: 1;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: content-box;
    font-size: 0.75rem;
    transition: color 0.15s;
}
.smf-collapse-btn > i {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    line-height: 0.75rem;
    text-align: center;
    transition: transform 0.2s;
}
.smf-collapse-btn:hover { color: #c8a96e; }
.smf-section.smf-collapsed > .smf-section-body { display: none; }
.smf-section.smf-collapsed .smf-collapse-btn > i { transform: rotate(-90deg); }
.smf-sub-section-title {
    color: #8a7450;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin: 6px 0 4px;
    display: flex;
    align-items: center;
    gap: 5px;
    opacity: 0.8;
}
.smf-sub-section-title i { color: #8ab4e8; }

/* ── Dialog footer ───────────────────────────────────────────────────────── */

.smf-dialog .dialog-buttons,
.smf-dialog footer.form-footer {
    display: flex;
    gap: 8px;
}

/* ── Aura Antimagia badge ────────────────────────────────────────────────── */
.smf-aura-antimagia-badge {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0 6px;
    padding: 10px 12px;
    background: linear-gradient(90deg, rgba(106, 78, 24, 0.22), rgba(106, 78, 24, 0.08));
    border: 1px solid rgba(200, 169, 110, 0.55);
    border-left: 3px solid #ffd86b;
    border-radius: 4px;
    color: #f0ebe0;
}
.smf-aura-antimagia-badge > i {
    font-size: 1.3rem;
    color: #ffd86b;
    flex: 0 0 auto;
    filter: drop-shadow(0 0 4px rgba(255, 216, 107, 0.6));
}
.smf-aura-antimagia-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.smf-aura-antimagia-title {
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    font-size: 0.92rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #ffd86b;
}
.smf-aura-antimagia-sub {
    color: #d0c4a8;
    font-family: "Palatino Linotype", serif;
    font-size: 0.85rem;
    line-height: 1.35;
}
.smf-aura-antimagia-sub b { color: #ffd86b; font-weight: 700; }
`;

function ensureStyles(): void {
    if (!document.getElementById(SPELL_RESIST_STYLES_ID)) {
        const el = document.createElement("style");
        el.id = SPELL_RESIST_STYLES_ID;
        el.textContent = SPELL_RESIST_STYLES;
        document.head.appendChild(el);
    }
}

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Parsing de resistência ────────────────────────────────────────────────────

interface ResistInfo {
    skill: ResistSkill | null;
    outcome: ResistOutcome;
}

export function parseResistance(txt: string): ResistInfo {
    if (!txt || txt.trim() === "" || txt.toLowerCase() === "nenhuma") {
        return { skill: null, outcome: "none" };
    }
    const lower = txt.toLowerCase();
    const skill: ResistSkill | null =
        lower.includes("vontade") ? "vont" :
        lower.includes("reflexos") ? "refl" :
        lower.includes("fortitude") ? "fort" :
        null;
    const outcome: ResistOutcome =
        lower.includes("anula") ? "anula" :
        (lower.includes("reduz") && lower.includes("metade")) ? "metade" :
        lower.includes("metade") ? "metade" :
        lower.includes("parcial") ? "parcial" :
        lower.includes("desacredita") ? "parcial" :
        lower.includes("veja texto") ? "texto" :
        skill != null ? "texto" :
        "none";
    return { skill, outcome };
}

// ── Extração de dados do chat ─────────────────────────────────────────────────

export function extractCD(message: ChatMessage): number {
    const match = message.content?.match(/CD\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Calcula a CD de magia do lançador: attributes.cd (base, ex. 15) + valor do
 * atributo de conjuração (ex. Sabedoria do clérigo). Inclui automaticamente
 * qualquer bônus já aplicado no atributo (racial, item, etc.).
 *
 * Para Curar Ferimentos sem resistência o chat card não tem "CD X" explícito,
 * então usamos isso como fallback quando extractCD retorna 0.
 */
function computeCasterSpellCD(actor: FoundryActor | null | undefined): number {
    if (!actor) return 0;
    type T20Sys = {
        attributes?: { cd?: number; conjuracao?: string };
        atributos?:  Record<string, { value?: number } | undefined>;
    };
    const sys  = actor.system as T20Sys | undefined;
    const base = sys?.attributes?.cd ?? 0;
    const conj = sys?.attributes?.conjuracao;
    const mod  = (conj ? sys?.atributos?.[conj]?.value : undefined) ?? 0;
    return base + mod;
}

export function extractSpellName(message: ChatMessage): string {
    const actorId = message.content?.match(/data-actor-id="([^"]+)"/)?.[1];
    const itemId  = message.content?.match(/data-item-id="([^"]+)"/)?.[1];
    if (actorId && itemId) {
        const actor = game.actors?.get(actorId) as (FoundryActor & { items?: { get(id: string): FoundryItem | null } }) | undefined;
        const item  = actor?.items?.get(itemId);
        if (item?.name) return item.name;
    }
    const titleMatch = message.content?.match(/<img[^>]+title="([^"]+)"/);
    return titleMatch?.[1] ?? "Magia";
}

/**
 * Extrai o ID do item da mensagem de chat parseando o atributo data-item-id
 * do HTML do card. O T20 não inclui esse ID nos flags da mensagem, apenas no DOM.
 */
export function extractItemId(message: ChatMessage): string | undefined {
    return message.content?.match(/data-item-id="([^"]+)"/)?.[1];
}

/**
 * Aplica efeitos de buff nos alvos automaticamente. Se o usuário for GM, aplica
 * diretamente; caso contrário (player), delega ao GM via socket (necessário
 * porque players não têm permissão para modificar atores de terceiros).
 */
export async function autoApplyBuffEffects(
    effectGroups: Record<string, unknown>[][],
    targets: FoundryToken[],
    casterName: string,
): Promise<void> {
    type EffectData = Record<string, unknown>;

    // GM: aplica diretamente
    if (game.user?.isGM) {
        let appliedCount = 0;
        for (const group of effectGroups) {
            if (!Array.isArray(group) || !group.length) continue;
            for (const token of targets) {
                const actor = token.actor;
                if (!actor) continue;
                const data: EffectData[] = JSON.parse(JSON.stringify(group)) as EffectData[];
                const firstDur = data[0]?.["duration"] as Record<string, unknown> | undefined;
                if (firstDur?.["seconds"]) {
                    const g = game as unknown as { time?: { worldTime: number } };
                    firstDur["startTime"] = g.time?.worldTime ?? 0;
                }
                try {
                    await (actor as FoundryActor & {
                        createEmbeddedDocuments(t: string, d: unknown[], o?: Record<string, unknown>): Promise<unknown>;
                    }).createEmbeddedDocuments("ActiveEffect", data, { toChat: appliedCount === 0 });
                    appliedCount++;
                } catch (err) {
                    console.warn(`[t20-theme-overhaul] Auto-apply em ${actor.name}:`, err);
                }
            }
        }
        if (appliedCount > 0) {
            const names = targets.filter(t => t.actor).map(t => t.actor!.name).join(", ");
            ui.notifications?.info(`Buff aplicado automaticamente: ${names}`);
        }
        return;
    }

    // Player: delega ao GM via socket
    const gm = findActiveGM();
    if (!gm) {
        ui.notifications?.warn("Auto-apply: GM precisa estar online");
        return;
    }
    const targetUuids = targets.map(t => t.actor?.uuid).filter(Boolean) as string[];
    if (!targetUuids.length) return;

    const req: import("./types").AutoApplyBuffRequest = {
        type:         "auto-apply-buff",
        casterName,
        effectGroups,
        targetUuids,
    };
    void getSocket()?.executeAsGM(SOCKET_AUTO_APPLY, req);
    ui.notifications?.info(`Buff auto-aplicado via GM em ${targets.length} alvo(s)`);
}

/** Handler GM-side do socket auto-apply-buff. */
async function handleAutoApplyBuffSocket(req: import("./types").AutoApplyBuffRequest): Promise<void> {
    if (!game.user?.isGM) return;
    type EffectData = Record<string, unknown>;
    let appliedCount = 0;
    const appliedNames: string[] = [];

    for (const uuid of req.targetUuids) {
        const actor = fromUuidSync(uuid) as FoundryActor | null;
        if (!actor) continue;
        for (const group of req.effectGroups) {
            if (!Array.isArray(group) || !group.length) continue;
            const data: EffectData[] = JSON.parse(JSON.stringify(group)) as EffectData[];
            const firstDur = data[0]?.["duration"] as Record<string, unknown> | undefined;
            if (firstDur?.["seconds"]) {
                const g = game as unknown as { time?: { worldTime: number } };
                firstDur["startTime"] = g.time?.worldTime ?? 0;
            }
            try {
                await (actor as FoundryActor & {
                    createEmbeddedDocuments(t: string, d: unknown[], o?: Record<string, unknown>): Promise<unknown>;
                }).createEmbeddedDocuments("ActiveEffect", data, { toChat: appliedCount === 0 });
                appliedCount++;
                if (!appliedNames.includes(actor.name)) appliedNames.push(actor.name);
            } catch (err) {
                console.warn(`[t20-theme-overhaul] Auto-apply GM-socket em ${actor.name}:`, err);
            }
        }
    }
    if (appliedCount > 0) {
        ui.notifications?.info(`${req.casterName}: buff aplicado em ${appliedNames.join(", ")}`);
    }
}

// ── Purificação ───────────────────────────────────────────────────────────────

/** Condições removíveis pela magia Purificação (do livro do jogador). */
const PURIFICATION_CONDITIONS: ReadonlySet<string> = new Set([
    "abalado", "apavorado", "alquebrado", "atordoado", "cego", "confuso",
    "debilitado", "enjoado", "envenenado", "esmorecido", "exausto",
    "fascinado", "fatigado", "fraco", "frustrado", "lento", "ofuscado",
    "paralisado", "pasmo", "surdo",
]);

/** Normaliza nome de condição: minúsculo + sem acentos, para matching robusto. */
export function normalizeCondName(s: string): string {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Encontra ActiveEffects no ator que correspondem a condições purificáveis. */
function findPurifiableEffects(actor: FoundryActor): { id: string; name: string }[] {
    type EffectLike = { id: string; name?: string; statuses?: Set<string> | string[] };
    const effects = ((actor as unknown as { effects?: { contents?: EffectLike[] } }).effects?.contents) ?? [];
    const out: { id: string; name: string }[] = [];

    for (const eff of effects) {
        let matched: string | undefined;

        // 1. Via statuses (Foundry v11+)
        const statuses = eff.statuses;
        if (statuses) {
            const arr = Array.isArray(statuses) ? statuses : Array.from(statuses);
            for (const sid of arr) {
                if (PURIFICATION_CONDITIONS.has(normalizeCondName(sid))) {
                    matched = sid;
                    break;
                }
            }
        }
        // 2. Via nome do effect (fallback)
        if (!matched && eff.name && PURIFICATION_CONDITIONS.has(normalizeCondName(eff.name))) {
            matched = eff.name;
        }

        if (matched) out.push({ id: eff.id, name: eff.name ?? matched });
    }
    return out;
}

/** Handler principal da Purificação: remove condições matching dos alvos T. */
async function handlePurification(_message: ChatMessage, casterName: string): Promise<void> {
    const targets = Array.from(game.user?.targets ?? []) as FoundryToken[];
    if (!targets.length) {
        ui.notifications?.info("Purificação: nenhum alvo selecionado (T)");
        return;
    }

    type TargetInfo = { token: FoundryToken; matches: { id: string; name: string }[] };
    const targetsWithMatches: TargetInfo[] = [];
    for (const token of targets) {
        if (!token.actor) continue;
        const matches = findPurifiableEffects(token.actor);
        if (matches.length > 0) targetsWithMatches.push({ token, matches });
    }

    if (targetsWithMatches.length === 0) {
        ui.notifications?.info("Purificação: nenhum alvo tem condições purificáveis");
        return;
    }

    // GM: aplica direto. Player: delega via socket.
    if (game.user?.isGM) {
        for (const { token, matches } of targetsWithMatches) {
            const ids = matches.map(m => m.id);
            try {
                await (token.actor! as FoundryActor & {
                    deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>;
                }).deleteEmbeddedDocuments("ActiveEffect", ids);
                ui.notifications?.info(`Purificação: removida(s) ${matches.map(m => m.name).join(", ")} de ${token.actor!.name}`);
            } catch (err) {
                console.warn(`[t20-theme-overhaul] Purificação em ${token.actor!.name}:`, err);
            }
        }
        return;
    }

    const gm = findActiveGM();
    if (!gm) {
        ui.notifications?.warn("Purificação: GM precisa estar online para remover condições de alvos não-próprios");
        return;
    }

    const req: import("./types").PurificationRequest = {
        type:        "purification",
        casterName,
        targets:     targetsWithMatches.map(({ token, matches }) => ({
            actorUuid:   token.actor!.uuid,
            effectIds:   matches.map(m => m.id),
            effectNames: matches.map(m => m.name),
        })),
    };
    void getSocket()?.executeAsGM(SOCKET_PURIFY, req);
    const totalCond = targetsWithMatches.reduce((s, t) => s + t.matches.length, 0);
    ui.notifications?.info(`Purificação: ${totalCond} condição(ões) enviada(s) ao GM para remoção`);
}

/** Handler GM-side do socket purification. */
async function handlePurificationSocket(req: import("./types").PurificationRequest): Promise<void> {
    if (!game.user?.isGM) return;
    for (const t of req.targets) {
        const actor = fromUuidSync(t.actorUuid) as FoundryActor | null;
        if (!actor || !t.effectIds.length) continue;
        try {
            await (actor as FoundryActor & {
                deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>;
            }).deleteEmbeddedDocuments("ActiveEffect", t.effectIds);
            ui.notifications?.info(`Purificação (${req.casterName}): removida(s) ${t.effectNames.join(", ")} de ${actor.name}`);
        } catch (err) {
            console.warn(`[t20-theme-overhaul] Purificação GM-socket em ${actor.name}:`, err);
        }
    }
}

// ── Helpers de cálculo ────────────────────────────────────────────────────────

/**
 * Calcula o valor máximo possível de uma rolagem mantendo os modificadores
 * constantes intocados. Para 3d6+4 rolando 13: max = 18 + 4 = 22.
 */
function computeMaxRoll(roll: Roll): number {
    type DieLike = { number?: number; faces?: number; total?: number };
    const dice = (roll.dice ?? []) as unknown as DieLike[];
    const maxDice    = dice.reduce((s, d) => s + (d.number ?? 0) * (d.faces ?? 0), 0);
    const actualDice = dice.reduce((s, d) => s + (d.total ?? 0), 0);
    const constPart  = (roll.total ?? 0) - actualDice;
    return Math.max(0, maxDice + constPart);
}

// ── Resolução de ator ─────────────────────────────────────────────────────────

function resolveTargetActor(uuid: string | undefined, fallbackId: string): FoundryActor | null {
    if (uuid) {
        const a = fromUuidSync(uuid);
        if (a) return a;
    }
    return game.actors?.get(fallbackId) ?? null;
}

// ── Aplicação de efeitos ──────────────────────────────────────────────────────

async function applySpellDamage(actorUuid: string, actorId: string, amount: number): Promise<void> {
    const actor = resolveTargetActor(actorUuid, actorId);
    if (!actor) return;
    const pv          = actor.system?.attributes?.pv;
    const currentTemp = pv?.temp  ?? 0;
    const currentHp   = pv?.value ?? 0;
    let remaining = Math.max(0, amount);
    let newTemp   = currentTemp;
    if (newTemp > 0) {
        const used = Math.min(newTemp, remaining);
        remaining -= used;
        newTemp   -= used;
    }
    await actor.update({
        "system.attributes.pv.temp":  newTemp,
        "system.attributes.pv.value": Math.max(0, currentHp - remaining),
    });
}

async function applySpellHeal(actorUuid: string, actorId: string, amount: number): Promise<void> {
    const actor = resolveTargetActor(actorUuid, actorId);
    if (!actor) return;
    const pv  = actor.system?.attributes?.pv;
    const cur = pv?.value ?? 0;
    const max = pv?.max   ?? cur;
    await actor.update({ "system.attributes.pv.value": Math.min(max, cur + amount) });
}

async function applyCondition(actorUuid: string, actorId: string, statusId: string): Promise<void> {
    type ActorWithToggle = FoundryActor & {
        toggleStatusEffect(id: string, opts?: Record<string, unknown>): Promise<void>;
    };
    const actor = resolveTargetActor(actorUuid, actorId) as ActorWithToggle | null;
    if (!actor?.toggleStatusEffect) return;
    await actor.toggleStatusEffect(statusId, { active: true });
}

/**
 * Remove uma instância de condição de Fadiga (Fatigado) do ator alvo.
 * Usado pelo aprimoramento de Curar Ferimentos. Procura por ActiveEffect
 * com status "fatigado" ou nome "Fatigado"/"Fadiga" e remove o primeiro.
 */
async function removeFadigaCondition(actorUuid: string, actorId: string): Promise<boolean> {
    const actor = resolveTargetActor(actorUuid, actorId);
    if (!actor) return false;

    type EffectLike = { id: string; name?: string; statuses?: Set<string> | string[] };
    const effects = ((actor as unknown as { effects?: { contents?: EffectLike[] } }).effects?.contents) ?? [];

    let toRemove: string | undefined;
    for (const eff of effects) {
        let matched = false;
        const statuses = eff.statuses;
        if (statuses) {
            const arr = Array.isArray(statuses) ? statuses : Array.from(statuses);
            for (const sid of arr) {
                const n = normalizeCondName(sid);
                if (n === "fatigado" || n === "fadiga") { matched = true; break; }
            }
        }
        if (!matched && eff.name) {
            const n = normalizeCondName(eff.name);
            if (n === "fatigado" || n === "fadiga") matched = true;
        }
        if (matched) { toRemove = eff.id; break; }
    }

    if (!toRemove) return false;
    try {
        await (actor as FoundryActor & {
            deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>;
        }).deleteEmbeddedDocuments("ActiveEffect", [toRemove]);
        return true;
    } catch (err) {
        console.warn(`[t20-theme-overhaul] Falha ao remover Fadiga:`, err);
        return false;
    }
}

async function applyBuffEffect(messageId: string, effectIndex: number, actor: FoundryActor): Promise<void> {
    type ActorWithCreate = FoundryActor & {
        createEmbeddedDocuments(type: string, data: unknown[], opts?: Record<string, unknown>): Promise<unknown>;
    };
    type EffectEntry = {
        duration?: { seconds?: number; startTime?: number };
        [key: string]: unknown;
    };
    const msg = game.messages?.get(messageId);
    if (!msg || !actor) return;
    const allEffects = msg.getFlag("tormenta20", "effects") as EffectEntry[][] | undefined;
    const chatEffect = allEffects?.[effectIndex];
    if (!chatEffect?.length) return;
    const toApply = chatEffect.map(e => {
        if (e.duration?.seconds) {
            return { ...e, duration: { ...e.duration, startTime: (game as Record<string, unknown>)["time"] != null ? ((game as Record<string, unknown>)["time"] as { worldTime: number }).worldTime : 0 } };
        }
        return { ...e };
    });
    await (actor as ActorWithCreate).createEmbeddedDocuments("ActiveEffect", toApply, { toChat: true });
}

// ── Modal unificado de magia ──────────────────────────────────────────────────

function openUnifiedSpellModal(preReq: SpellResistPreRollRequest): void {
    ensureStyles();

    const targetActor = resolveTargetActor(preReq.targetActorUuid, preReq.targetActorId);
    const targetName  = targetActor?.name ?? "Alvo";

    // ── Seção 1: Resistência ──────────────────────────────────────────────────

    const skillKey   = preReq.resistSkill;
    const skillLabel = skillKey ? SKILL_LABELS[skillKey] : "";
    const breakdown  = (targetActor && skillKey) ? computeSkillBreakdown(targetActor, skillKey) : null;
    const baseBonus  = breakdown?.total ?? 0;
    const bonusStr   = baseBonus >= 0 ? `+${baseBonus}` : `${baseBonus}`;
    // Tooltip detalhado: mostra a composição do bônus. Quando T20 já consolidou
    // em .value (fromValue:true), mostramos os componentes individuais como
    // "(consolidado pelo sistema)" — não duplicamos a soma.
    const bonusTooltip = (() => {
        if (!breakdown) return "";
        const lines: string[] = [];
        const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
        if (breakdown.fromValue) {
            lines.push(`Total: ${fmt(breakdown.total)} (consolidado pelo T20)`);
            if (breakdown.halfLevel) lines.push(`  Meio nível: ${fmt(breakdown.halfLevel)}`);
            if (breakdown.treino)    lines.push(`  Treino: ${fmt(breakdown.treino)}`);
            if (breakdown.attrKey)   lines.push(`  ${breakdown.attrKey.toUpperCase()}: ${fmt(breakdown.attrMod)}`);
            if (breakdown.outros)    lines.push(`  Outros: ${fmt(breakdown.outros)}`);
            if (breakdown.condi)     lines.push(`  Condição: ${fmt(breakdown.condi)}`);
        } else {
            lines.push(`Total: ${fmt(breakdown.total)} (não treinado — soma manual)`);
            if (breakdown.halfLevel) lines.push(`  Meio nível: ${fmt(breakdown.halfLevel)}`);
            if (breakdown.attrKey)   lines.push(`  ${breakdown.attrKey.toUpperCase()}: ${fmt(breakdown.attrMod)}`);
            if (breakdown.outros)    lines.push(`  Outros: ${fmt(breakdown.outros)}`);
            if (breakdown.condi)     lines.push(`  Condição: ${fmt(breakdown.condi)}`);
        }
        return lines.join("\n");
    })();
    const pmActual   = targetActor?.system?.attributes?.pm?.value ?? 0;

    const powers: ActivatableItem[] = (targetActor && skillKey
        ? getActivatableItems(targetActor, skillLabel).filter(p => p.itemType !== "tesouro")
        : []
    );

    let resistBodyHtml: string;

    if (preReq.isHeal) {
        resistBodyHtml = `<div class="smf-na-text">Magia de cura — sem teste de resistência.</div>`;
    } else if (!skillKey) {
        const txt = preReq.resistTxt || "Sem resistência";
        resistBodyHtml = `<div class="smf-na-text">${esc(txt)}</div>`;
    } else {
        const outcomeHint =
            preReq.resistOutcome === "anula"   ? "Passa → sem efeito" :
            preReq.resistOutcome === "metade"  ? "Passa → metade do dano" :
            preReq.resistOutcome === "parcial" ? "Passa → metade + sem condições" :
            "Veja texto da magia";

        const powersHtml = powers.length > 0 ? `
            <div class="smf-powers-section" id="smf-powers-wrap">
                <div class="smf-powers-header">
                    <span></span><span>PM</span><span>PODER / HABILIDADE</span><span>BÔNUS</span>
                </div>
                ${powers.map(p => `
                <div class="smf-power-row">
                    <input type="checkbox" class="smf-power-check"
                        data-pm="${p.pm}"
                        data-bonus="${esc(p.bonusFormula)}"
                        data-advantage="${p.isAdvantage}"
                        data-label="${esc(p.bonusLabel)}"
                        data-name="${esc(p.name)}"
                        ${p.pm > pmActual ? "disabled title='PM insuficiente'" : ""}>
                    <span class="smf-pm-cost">${p.pm > 0 ? p.pm : "—"}</span>
                    <span>${esc(p.name)}</span>
                    <span class="${p.isAdvantage ? "smf-power-bonus-adv" : "smf-power-bonus-known"}">${esc(p.bonusLabel)}</span>
                </div>`).join("")}
                <div class="smf-pm-total-row">
                    <span class="smf-label-sm">PM a gastar (disponível: ${pmActual})</span>
                    <span class="smf-pm-display" id="smf-pm-total">0</span>
                </div>
            </div>
        ` : "";

        resistBodyHtml = `
            <div class="smf-resist-info">
                <span class="smf-label-sm" title="${esc(bonusTooltip)}">BÔNUS BASE</span>
                <span class="smf-resist-bonus smf-bonus-tooltip-host" title="${esc(bonusTooltip)}" tabindex="0">${bonusStr}</span>
                <span class="smf-resist-outcome">${esc(outcomeHint)}</span>
            </div>
            ${powersHtml}
            <div id="smf-extra-wrap">
                <div class="smf-label-sm" style="padding-bottom:4px;">BÔNUS EXTRA (opcional)</div>
                <input type="text" class="smf-extra-input" name="bonusExtra" placeholder="+1d4 ou +2" />
            </div>
            <button class="smf-action-btn" id="smf-roll-resist">
                <i class="fas fa-dice-d20"></i> Rolar ${esc(skillLabel)} (CD ${preReq.cd})
            </button>
            <div id="smf-resist-result" class="smf-resist-result"></div>
        `;
    }

    // Aura Antimagia (Paladino): se o alvo está dentro de uma aura sagrada
    // ativa cujo caster tem o aprimoramento "Aura Antimagia", mostra uma badge
    // dourada informativa avisando que o re-roll já permitido pelo dialog
    // (botão "Rerolar" após a primeira tentativa) é gratuito por esse motivo.
    const antimagiaContexts = targetActor
        ? getAuraAntimagiaContextForActor((targetActor as unknown as { id?: string }).id ?? "")
        : [];
    const antimagiaBadgeHtml = antimagiaContexts.length > 0 ? `
        <div class="smf-aura-antimagia-badge" title="Aura Antimagia permite ${esc(targetName)} rolar novamente o teste de resistência contra a magia sem custo adicional.">
            <i class="fas fa-sparkles"></i>
            <div class="smf-aura-antimagia-text">
                <div class="smf-aura-antimagia-title">Aura Antimagia disponível</div>
                <div class="smf-aura-antimagia-sub">
                    ${antimagiaContexts.length === 1
                        ? `<b>${esc(antimagiaContexts[0].casterName)}</b> permite re-roll deste teste`
                        : `${antimagiaContexts.map(c => `<b>${esc(c.casterName)}</b>`).join(" e ")} permitem re-roll`}
                </div>
            </div>
        </div>
    ` : "";

    const resistSectionHtml = `
        <div class="smf-section-title">
            <i class="fas fa-shield-halved"></i>
            RESISTÊNCIA${skillKey ? ` — ${esc(skillLabel.toUpperCase())} (CD ${preReq.cd})` : ""}
            <button class="smf-collapse-btn" title="Minimizar"><i class="fas fa-chevron-down"></i></button>
        </div>
        <div class="smf-section-body">
            ${antimagiaBadgeHtml}
            ${resistBodyHtml}
        </div>
    `;

    // ── Seção 2: Dano / Cura ──────────────────────────────────────────────────

    const halfDmg = Math.floor(preReq.damageTotal / 2);
    let damageSectionHtml: string;

    if (preReq.isHeal && preReq.damageTotal > 0) {
        const showConsagrar = preReq.maxHealValue > preReq.damageTotal;
        const consagrarHtml = showConsagrar ? `
            <label class="smf-consagrar-label" title="Maximiza o valor da cura com os dados rolados.">
                <input type="checkbox" id="smf-consagrar" />
                <i class="fas fa-sun"></i> Consagrar
                <span class="smf-consagrar-max">(máx: ${preReq.maxHealValue})</span>
            </label>
        ` : "";
        const halfHeal = Math.floor(preReq.damageTotal / 2);
        const cdLabel  = preReq.cd > 0 ? `CD ${preReq.cd}` : "CD ?";
        const healHeaderHtml = preReq.truqueAtivo
            ? `<div class="smf-section-title"><i class="fas fa-bolt"></i> TRUQUE — DANO DE LUZ<button class="smf-collapse-btn" title="Minimizar"><i class="fas fa-chevron-down"></i></button></div>`
            : `<div class="smf-section-title"><i class="fas fa-heart"></i> CURA<button class="smf-collapse-btn" title="Minimizar"><i class="fas fa-chevron-down"></i></button></div>`;
        damageSectionHtml = `
            ${healHeaderHtml}
            <div class="smf-section-body">
            <div class="smf-heal-number" id="smf-heal-number">${preReq.damageTotal}</div>
            ${consagrarHtml}
            <label class="smf-undead-label" title="Magia de cura causa dano sagrado em mortos-vivos. O alvo rola Vontade ${cdLabel} — passa: metade do dano.">
                <input type="checkbox" id="smf-morto-vivo" />
                <i class="fas fa-skull"></i> Morto-Vivo
            </label>
            <div class="smf-dmg-btns">
                <button class="smf-heal-btn" id="smf-heal-full" data-heal-base="${preReq.damageTotal}" data-heal-max="${preReq.maxHealValue}">
                    <i class="fas fa-heart"></i> Curar (${preReq.damageTotal})${preReq.removeFadiga ? " e Remover Fadiga" : ""}
                </button>
                <button class="smf-dmg-btn" id="smf-no-heal">
                    <i class="fas fa-ban"></i> Não Aplicar
                </button>
            </div>
            <div class="smf-feedback" id="smf-dmg-feedback"></div>

            <div id="smf-undead-section" style="display:none; margin-top:8px; border-top:1px solid rgba(138,102,68,0.3); padding-top:8px;">
                <div class="smf-section-title" style="margin-bottom:4px;">
                    <i class="fas fa-skull-crossbones"></i> DANO SAGRADO — VONTADE ${cdLabel}
                </div>
                <button class="smf-action-btn" id="smf-undead-roll">
                    <i class="fas fa-dice-d20"></i> Rolar Vontade (${cdLabel})
                </button>
                <div id="smf-undead-result" class="smf-resist-result" style="display:none;"></div>
                <div id="smf-undead-dmg-btns" class="smf-dmg-btns" style="display:none; margin-top:6px;">
                    <button class="smf-undead-dmg-btn" id="smf-undead-full">
                        <i class="fas fa-skull-crossbones"></i> Dano Completo (${preReq.damageTotal})
                    </button>
                    <button class="smf-undead-dmg-btn" id="smf-undead-half">
                        <i class="fas fa-shield-halved"></i> Metade do Dano (${halfHeal})
                    </button>
                    <button class="smf-undead-dmg-btn" id="smf-undead-none">
                        <i class="fas fa-ban"></i> Não Aplicar
                    </button>
                </div>
                <div class="smf-feedback" id="smf-undead-feedback"></div>
            </div>
            </div>
        `;
    } else if (!preReq.isHeal && preReq.damageTotal > 0) {
        damageSectionHtml = `
            <div class="smf-section-title"><i class="fas fa-burst"></i> DANO<button class="smf-collapse-btn" title="Minimizar"><i class="fas fa-chevron-down"></i></button></div>
            <div class="smf-section-body">
            <div class="smf-dmg-number">${preReq.damageTotal}</div>
            <div class="smf-dmg-btns">
                <button class="smf-dmg-btn" data-dmg="${preReq.damageTotal}" id="smf-dmg-full">
                    <i class="fas fa-bolt"></i> Aplicar Integral (${preReq.damageTotal})
                </button>
                <button class="smf-dmg-btn" data-dmg="${halfDmg}" id="smf-dmg-half">
                    <i class="fas fa-shield-halved"></i> Aplicar Metade (${halfDmg})
                </button>
                <button class="smf-dmg-btn" data-dmg="0" id="smf-dmg-none">
                    <i class="fas fa-ban"></i> Não Aplicar
                </button>
            </div>
            <div class="smf-feedback" id="smf-dmg-feedback"></div>
            </div>
        `;
    } else {
        damageSectionHtml = `
            <div class="smf-section-title"><i class="fas fa-burst"></i> DANO / CURA<button class="smf-collapse-btn" title="Minimizar"><i class="fas fa-chevron-down"></i></button></div>
            <div class="smf-section-body">
            <div class="smf-na-text">Sem dano ou cura direto para esta magia.</div>
            </div>
        `;
    }

    // ── Seção 3: Buff ─────────────────────────────────────────────────────────

    type EffectMeta = { name?: string; icon?: string; flags?: Record<string, unknown>; disabled?: boolean };
    const allMsgEffects = (
        (game.messages?.get(preReq.messageId)?.getFlag("tormenta20", "effects")) as EffectMeta[][] | undefined
    ) ?? [];

    // Exibe todos os grupos de efeitos (igual ao chat card original)
    const validEffects = allMsgEffects.filter(
        effArr => Array.isArray(effArr) && effArr.length > 0 && !effArr[0]?.disabled,
    );

    let buffSectionHtml: string;
    if (validEffects.length > 0) {
        const btns = validEffects.map((effArr, i) => {
            const eff  = effArr[0];
            const name = eff.name ?? `Efeito ${i + 1}`;
            const iconPart = eff.icon
                ? `<img src="${esc(eff.icon)}" width="16" height="16" />`
                : `<i class="fas fa-star"></i>`;
            return `<button class="smf-buff-btn" data-effect-index="${i}">${iconPart} ${esc(name)}</button>`;
        }).join("");
        buffSectionHtml = `
            <div class="smf-sub-section-title"><i class="fas fa-wand-magic-sparkles"></i> EFEITOS / BUFF</div>
            <div class="smf-buff-btns">${btns}</div>
            <div class="smf-feedback" id="smf-buff-feedback"></div>
        `;
    } else {
        buffSectionHtml = `
            <div class="smf-sub-section-title"><i class="fas fa-wand-magic-sparkles"></i> EFEITOS / BUFF</div>
            <div class="smf-na-text">Sem efeitos de buff nesta mensagem de chat.</div>
        `;
    }

    // ── Seção 4: Condições ────────────────────────────────────────────────────

    type StatusEntry = { id: string; name: string; icon?: string };
    const allStatuses = (
        (typeof CONFIG !== "undefined"
            ? (CONFIG as Record<string, unknown>).statusEffects
            : undefined) as StatusEntry[] | undefined
    ) ?? [];
    const sorted = [...allStatuses].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    const condItemsHtml = sorted.map(s => {
        const iconPart = s.icon
            ? `<img src="${esc(s.icon)}" class="smf-cond-icon" />`
            : `<span class="smf-cond-ph"></span>`;
        return `
            <label class="smf-cond-item" data-name="${esc(s.name.toLowerCase())}">
                <input type="checkbox" value="${esc(s.id)}" />
                ${iconPart}
                <span>${esc(s.name)}</span>
            </label>
        `;
    }).join("");

    const condSectionHtml = `
        <div class="smf-sub-section-title"><i class="fas fa-list-check"></i> CONDIÇÕES</div>
        <input type="text" class="smf-cond-filter" id="smf-cond-filter" placeholder="Filtrar condições..." autocomplete="off" />
        <div class="smf-cond-grid">${condItemsHtml}</div>
        <button class="smf-cond-apply-btn" id="smf-cond-apply">
            <i class="fas fa-check-circle"></i> Aplicar Condições Selecionadas
        </button>
        <div class="smf-feedback" id="smf-cond-feedback"></div>
    `;

    // ── Conteúdo final ────────────────────────────────────────────────────────
    // Para magias de cura: Buff e Condições são omitidos (não fazem sentido)

    const buffAndCondHtml = preReq.isHeal ? "" : `
            <div class="smf-divider"></div>
            <div class="smf-section" id="smf-sect-effects">
                <div class="smf-section-title">
                    <i class="fas fa-sparkles"></i> EFEITOS / CONDIÇÕES
                    <button class="smf-collapse-btn" title="Minimizar"><i class="fas fa-chevron-down"></i></button>
                </div>
                <div class="smf-section-body">
                    ${buffSectionHtml}
                    <div class="smf-divider" style="margin: 8px -14px;"></div>
                    ${condSectionHtml}
                </div>
            </div>
    `;

    const content = `
        <div class="smf-body">
            <div class="smf-banner">
                <div class="smf-label-sm">VOCÊ ESTÁ SENDO ALVO DE UMA MAGIA</div>
                <div class="smf-spell-name">${esc(preReq.spellName)}</div>
                <div class="smf-caster-name">por ${esc(preReq.casterName)}</div>
                <div class="smf-target-name">Alvo: ${esc(targetName)}</div>
            </div>
            <div class="smf-divider"></div>
            <div class="smf-section">${resistSectionHtml}</div>
            <div class="smf-divider"></div>
            <div class="smf-section">${damageSectionHtml}</div>
            ${buffAndCondHtml}
        </div>
    `;

    // ── Dialog ────────────────────────────────────────────────────────────────

    new Dialog(
        {
            title:   `${preReq.spellName} — ${targetName}`,
            content,
            buttons: {
                finalize: {
                    icon:  '<i class="fas fa-check"></i>',
                    label: "Finalizar",
                    callback: () => { /* todos os efeitos já foram aplicados inline */ },
                },
            },
            default: "finalize",
            render: ($html: JQuery) => {

                // ── Collapse sections ─────────────────────────────────────────
                // Apenas títulos com chevron filho são clicáveis para colapsar.
                // Isso evita que sub-títulos internos (ex.: "DANO SAGRADO"
                // dentro da seção de CURA) disparem o toggle da seção pai.
                $html.find(".smf-section-title").filter(function () {
                    return $(this).children(".smf-collapse-btn").length > 0;
                }).on("click", function () {
                    $(this).closest(".smf-section").toggleClass("smf-collapsed");
                });

                // ── PM total ──────────────────────────────────────────────────
                $html.find(".smf-power-check").on("change", () => {
                    const total = $html.find(".smf-power-check:checked").toArray()
                        .reduce((s, el) => s + parseInt((el as HTMLElement).dataset["pm"] ?? "0", 10), 0);
                    $html.find("#smf-pm-total").text(String(total));
                });

                // ── Rolar Resistência (suporta reroll) ────────────────────────
                let hasRolledResist = false;
                $html.find("#smf-roll-resist").on("click", function () {
                    const rollBtn = $(this);
                    rollBtn.prop("disabled", true);

                    const bonusExtra = ($html.find('[name="bonusExtra"]').val() as string ?? "").trim();
                    const selected = $html.find(".smf-power-check:checked").toArray().map(el => ({
                        pm:         parseInt((el as HTMLElement).dataset["pm"]        ?? "0", 10),
                        bonus:      (el as HTMLElement).dataset["bonus"]     ?? "",
                        advantage:  (el as HTMLElement).dataset["advantage"] === "true",
                        bonusLabel: (el as HTMLElement).dataset["label"]     ?? "",
                        name:       (el as HTMLElement).dataset["name"]      ?? "",
                    }));

                    // Monta fórmula
                    const hasAdvantage = selected.some(p => p.advantage);
                    const parts: string[] = [hasAdvantage ? "2d20kh1" : "1d20"];
                    if (baseBonus !== 0) {
                        parts.push(baseBonus > 0 ? `+ ${baseBonus}` : `- ${Math.abs(baseBonus)}`);
                    }
                    for (const p of selected) {
                        if (!p.bonus || p.bonus === "kh") continue;
                        const b = p.bonus.trim();
                        parts.push(b.startsWith("+") || b.startsWith("-") ? b : `+ ${b}`);
                    }
                    if (bonusExtra) {
                        const b = bonusExtra.trim();
                        parts.push(b.startsWith("+") || b.startsWith("-") ? b : `+ ${b}`);
                    }

                    void (async () => {
                        const roll = new Roll(parts.join(" "));
                        await roll.evaluate({ async: true });

                        // Desconta PM apenas na PRIMEIRA rolagem; rerolls são livres
                        if (!hasRolledResist) {
                            const totalPm = selected.reduce((s, p) => s + p.pm, 0);
                            if (totalPm > 0 && targetActor) {
                                const cur = targetActor.system?.attributes?.pm?.value ?? 0;
                                await targetActor.update({ "system.attributes.pm.value": Math.max(0, cur - totalPm) });
                            }
                        }

                        const d20Res = (roll.dice?.[0] as { results?: { active?: boolean; result?: number }[] } | undefined)
                            ?.results?.find(r => r.active)?.result ?? 0;
                        const total  = roll.total ?? 0;
                        // d20=1 → falha crítica (sempre falha); d20=20 → sucesso crítico (sempre passa)
                        const critFail = d20Res === 1;
                        const critPass = d20Res === 20;
                        const passed   = critPass || (!critFail && total >= preReq.cd);
                        const sl       = skillKey ? SKILL_LABELS[skillKey] : "Resistência";

                        const appliedLabels: string[] = selected.map(p => {
                            const pmStr = p.pm > 0 ? ` (${p.pm} PM)` : "";
                            return `${p.bonusLabel} · ${p.name}${pmStr}`;
                        });
                        if (bonusExtra) appliedLabels.push(`${bonusExtra} (manual)`);

                        // Publica no chat
                        const chatBadge = critPass ? "✦ SUCESSO CRÍTICO" : critFail ? "☠ FALHA CRÍTICA" : (passed ? "✓ PASSOU" : "✗ FALHOU");
                        await ChatMessage.create({
                            content: await roll.render({
                                flavor: `Resistência — ${sl} (${targetName}) vs CD ${preReq.cd} ${chatBadge}`,
                            }),
                            rolls:   [roll.toJSON()],
                            type:    5,
                            speaker: ChatMessage.getSpeaker({ actor: targetActor ?? null }),
                            flags:   { [MODULE_ID]: { resistanceRoll: true } },
                        });

                        // Resultado no outcome
                        const outcomeText = passed
                            ? (preReq.resistOutcome === "anula"   ? "Sem efeito (passou)" :
                               preReq.resistOutcome === "metade"  ? "Metade do dano (passou)" :
                               preReq.resistOutcome === "parcial" ? "Metade + sem condições (passou)" :
                               "Passou — veja texto da magia")
                            : "Falhou — efeito completo";

                        const passClass   = passed ? "smf-rr-pass"       : "smf-rr-fail";
                        const badgeClass  = passed ? "smf-rr-badge-pass" : "smf-rr-badge-fail";
                        const badgeText   = critPass ? "SUCESSO CRÍTICO"
                                          : critFail ? "FALHA CRÍTICA"
                                          : (passed ? "PASSOU" : "FALHOU");

                        const powersHtmlResult = appliedLabels.length > 0
                            ? `<div class="smf-applied-powers">${appliedLabels.map(l => `<div class="smf-applied-power">✦ ${esc(l)}</div>`).join("")}</div>`
                            : "";

                        $html.find("#smf-resist-result").html(`
                            <div class="smf-rr-row">
                                <span class="smf-label-sm">${esc(sl.toUpperCase())}</span>
                                <span class="${passClass}">${total}</span>
                                <span class="smf-label-sm">d20: ${d20Res} + ${baseBonus}</span>
                                <span class="smf-label-sm">CD ${preReq.cd}</span>
                                <span class="${badgeClass}">${badgeText}</span>
                            </div>
                            ${powersHtmlResult}
                            <div class="smf-rr-outcome">${esc(outcomeText)}</div>
                        `).show();

                        // Esconde form de poderes (PM já descontado); mantém botão como "Rerolar"
                        $html.find("#smf-powers-wrap").hide();
                        if (!hasRolledResist) {
                            rollBtn.html(`<i class="fas fa-rotate"></i> Rerolar ${esc(skillLabel)} (CD ${preReq.cd})`);
                            hasRolledResist = true;
                        }
                        rollBtn.prop("disabled", false);
                    })();
                });

                // ── Consagrar (maximiza cura) ─────────────────────────────────
                $html.find("#smf-consagrar").on("change", function () {
                    const checked = $(this).is(":checked");
                    const healBtn = $html.find("#smf-heal-full");
                    const baseVal = parseInt(healBtn.data("heal-base") as string, 10) || preReq.damageTotal;
                    const maxVal  = parseInt(healBtn.data("heal-max")  as string, 10) || preReq.damageTotal;
                    const val     = checked ? maxVal : baseVal;
                    const halfU   = Math.floor(val / 2);
                    $html.find("#smf-heal-number").text(String(val));
                    healBtn.data("heal-current", val);
                    healBtn.html(`<i class="fas fa-heart"></i> Curar (${val})${preReq.removeFadiga ? " e Remover Fadiga" : ""}`);
                    // Atualiza labels dos botões de dano sagrado
                    $html.find("#smf-undead-full").html(`<i class="fas fa-skull-crossbones"></i> Dano Completo (${val})`);
                    $html.find("#smf-undead-half").html(`<i class="fas fa-shield-halved"></i> Metade do Dano (${halfU})`);
                });

                // ── Auto-marca Consagrar se o alvo está em área de Consagrar ──
                // Detecta o flag consagrarHealingBoost no ator alvo (criado pelo
                // template de Consagrar). Se presente, marca o checkbox e dispara
                // o change para aplicar o boost imediatamente.
                if (preReq.isHeal && targetActor) {
                    const hasBoost = (targetActor.effects?.contents ?? []).some(e => {
                        const f = e.flags?.[MODULE_ID] as Record<string, unknown> | undefined;
                        return f?.["consagrarHealingBoost"] === true;
                    });
                    if (hasBoost) {
                        const $cb = $html.find("#smf-consagrar");
                        if ($cb.length && !$cb.is(":checked")) {
                            $cb.prop("checked", true).trigger("change");
                            // Marca visualmente que veio do template (tooltip)
                            $cb.closest(".smf-consagrar-label").attr("title", "Alvo está em área de Consagrar — bônus auto-aplicado");
                        }
                    }
                }

                // ── Morto-Vivo (ativa seção de resistência e dano sagrado) ────
                $html.find("#smf-morto-vivo").on("change", function () {
                    $html.find("#smf-undead-section").toggle($(this).is(":checked"));
                });

                // ── Truque de Curar Ferimentos: dano de luz vs morto-vivo ─────
                // Auto-marca Morto-Vivo, esconde checkbox Consagrar e botão Curar.
                if (preReq.truqueAtivo) {
                    $html.find("#smf-consagrar").closest(".smf-consagrar-label").hide();
                    $html.find("#smf-heal-full").hide();
                    const $mv = $html.find("#smf-morto-vivo");
                    $mv.prop("checked", true).prop("disabled", true);
                    $mv.closest(".smf-undead-label").attr("title", "Truque: alvo já é morto-vivo (1d8 dano de luz)");
                    $html.find("#smf-undead-section").show();
                }

                // ── Rolar Vontade (resistência do morto-vivo) ─────────────────
                $html.find("#smf-undead-roll").on("click", function () {
                    const rollBtn  = $(this);
                    rollBtn.prop("disabled", true);
                    const vontBonus = targetActor ? computeSkillTotal(targetActor, "vont") : 0;
                    const bonusStr  = vontBonus >= 0 ? `+${vontBonus}` : `${vontBonus}`;
                    void (async () => {
                        const roll = new Roll(`1d20 ${bonusStr}`);
                        await roll.evaluate({ async: true } as never);
                        const d20Res = (roll.dice?.[0] as { results?: { active?: boolean; result?: number }[] } | undefined)
                            ?.results?.find(r => r.active)?.result ?? 0;
                        const total  = roll.total ?? 0;
                        // d20=1 → falha crítica (sempre falha); d20=20 → sucesso crítico (sempre passa)
                        const critFail = d20Res === 1;
                        const critPass = d20Res === 20;
                        const passed   = critPass || (!critFail && preReq.cd > 0 && total >= preReq.cd);
                        const cdLabel  = preReq.cd > 0 ? `CD ${preReq.cd}` : "CD ?";

                        const chatBadge = critPass ? "✦ SUCESSO CRÍTICO" : critFail ? "☠ FALHA CRÍTICA" : (passed ? "✓ PASSOU" : "✗ FALHOU");
                        await ChatMessage.create({
                            content: await roll.render({
                                flavor: `Resistência Vontade (${targetName}) vs ${cdLabel} — ${chatBadge}`,
                            }),
                            rolls:   [roll.toJSON()],
                            type:    5,
                            speaker: ChatMessage.getSpeaker({ actor: targetActor ?? null }),
                            flags:   { [MODULE_ID]: { resistanceRoll: true } },
                        });

                        const passClass  = passed ? "smf-rr-pass"       : "smf-rr-fail";
                        const badgeClass = passed ? "smf-rr-badge-pass" : "smf-rr-badge-fail";
                        const badgeText  = critPass ? "SUCESSO CRÍTICO"
                                         : critFail ? "FALHA CRÍTICA"
                                         : (passed ? "PASSOU" : "FALHOU");
                        const outcome    = passed ? "Metade do dano (passou)" : "Dano completo (falhou)";
                        $html.find("#smf-undead-result").html(`
                            <div class="smf-rr-row">
                                <span class="smf-label-sm">VONTADE</span>
                                <span class="${passClass}">${total}</span>
                                <span class="smf-label-sm">d20 + ${vontBonus}</span>
                                <span class="smf-label-sm">${cdLabel}</span>
                                <span class="${badgeClass}">${badgeText}</span>
                            </div>
                            <div class="smf-rr-outcome">${esc(outcome)}</div>
                        `).show();
                        rollBtn.hide();
                        $html.find("#smf-undead-dmg-btns").show();
                    })();
                });

                // ── Dano sagrado ao morto-vivo ────────────────────────────────
                $html.find(".smf-undead-dmg-btn").on("click", async function () {
                    const btn = $(this);
                    const id  = btn.attr("id");
                    // Respeita Consagrar: lê o valor atual do número de cura exibido
                    const curHeal = parseInt($html.find("#smf-heal-number").text(), 10) || preReq.damageTotal;
                    const halfU   = Math.floor(curHeal / 2);
                    let amt   = 0;
                    let label = "";
                    if (id === "smf-undead-full") {
                        amt   = curHeal;
                        label = `✓ ${amt} de dano sagrado aplicado`;
                    } else if (id === "smf-undead-half") {
                        amt   = halfU;
                        label = `✓ ${amt} de dano sagrado (metade) aplicado`;
                    } else {
                        label = "✓ Dano sagrado não aplicado";
                    }
                    if (amt > 0) {
                        await applySpellDamage(preReq.targetActorUuid, preReq.targetActorId, amt);
                    }
                    $html.find(".smf-undead-dmg-btn").addClass("smf-spent");
                    $html.find("#smf-undead-feedback").text(label).show();
                });

                // ── Dano / Cura ───────────────────────────────────────────────
                $html.find(".smf-dmg-btn, .smf-heal-btn").on("click", async function () {
                    const btn = $(this);
                    const id  = btn.attr("id");
                    let label = "";

                    if (id === "smf-heal-full") {
                        // Usa valor Consagrado se checkbox marcado, senão o total rolado
                        const healAmt = parseInt(btn.data("heal-current") as string, 10)
                            || preReq.damageTotal;
                        await applySpellHeal(preReq.targetActorUuid, preReq.targetActorId, healAmt);
                        label = `✓ Cura de ${healAmt} aplicada`;
                        // Aprimoramento: também remove uma condição de Fadiga do alvo
                        if (preReq.removeFadiga) {
                            const removed = await removeFadigaCondition(preReq.targetActorUuid, preReq.targetActorId);
                            label += removed ? " · Fadiga removida" : " · sem Fadiga para remover";
                        }
                    } else if (id === "smf-no-heal" || id === "smf-dmg-none") {
                        label = "✓ Não aplicado";
                    } else {
                        const amt = parseInt(btn.data("dmg") as string, 10) || 0;
                        if (amt > 0) {
                            await applySpellDamage(preReq.targetActorUuid, preReq.targetActorId, amt);
                        }
                        label = amt > 0 ? `✓ ${amt} de dano aplicado` : "✓ Não aplicado";
                    }

                    $html.find(".smf-dmg-btn, .smf-heal-btn").addClass("smf-spent");
                    $html.find("#smf-dmg-feedback").text(label).show();
                });

                // ── Buff ──────────────────────────────────────────────────────
                $html.find(".smf-buff-btn").on("click", async function () {
                    if (!targetActor) return;
                    const btn = $(this);
                    const idx = parseInt(btn.data("effect-index") as string, 10);
                    if (isNaN(idx)) return;
                    await applyBuffEffect(preReq.messageId, idx, targetActor);
                    btn.addClass("smf-spent").append(" ✓");
                    $html.find("#smf-buff-feedback").text("✓ Efeito aplicado").show();
                });

                // ── Filtro de condições ───────────────────────────────────────
                $html.find("#smf-cond-filter").on("input", function () {
                    const q = ($(this).val() as string).toLowerCase().trim();
                    $html.find(".smf-cond-item").each((_, el) => {
                        const name = (el as HTMLElement).dataset["name"] ?? "";
                        $(el).toggleClass("smf-hidden", q.length > 0 && !name.includes(q));
                    });
                });

                // ── Aplicar condições ─────────────────────────────────────────
                $html.find("#smf-cond-apply").on("click", () => {
                    const checked: string[] = [];
                    $html.find(".smf-cond-grid input:checked").each((_, el) => {
                        const val = (el as HTMLInputElement).value;
                        if (val) {
                            void applyCondition(preReq.targetActorUuid, preReq.targetActorId, val);
                            checked.push(val);
                        }
                    });
                    if (checked.length > 0) {
                        $html.find("#smf-cond-feedback")
                            .text(`✓ ${checked.length} condição(ões) aplicada(s)`)
                            .show();
                        $html.find(".smf-cond-grid input:checked").prop("checked", false);
                    }
                });
            },
        },
        {
            classes: ["bg3-dialog", "smf-dialog"],
            width:   480,
            id:      `spell-modal-${preReq.requestId}`,
        },
    ).render(true);
}

// ── Socket ────────────────────────────────────────────────────────────────────

function setupSocket(): void {
    onSocketReady((socket) => {
        // Target-side: open the unified resist modal. socketlib already
        // routes via executeAsUser so no targetUserId filtering needed.
        socket.register(SOCKET_PRE_ROLL, (...args: unknown[]) => {
            openUnifiedSpellModal(args[0] as SpellResistPreRollRequest);
        });
        // GM-side: apply buffs / purify conditions on behalf of a player.
        socket.register(SOCKET_AUTO_APPLY, (...args: unknown[]) => {
            void handleAutoApplyBuffSocket(args[0] as import("./types").AutoApplyBuffRequest);
        });
        socket.register(SOCKET_PURIFY, (...args: unknown[]) => {
            void handlePurificationSocket(args[0] as import("./types").PurificationRequest);
        });
    });
}

// ── Helpers de usuário / ator ─────────────────────────────────────────────────

export function getMsgAuthorId(message: ChatMessage): string {
    const m = message as unknown as { author?: { id: string }; user?: { id: string } | string };
    return m.author?.id ?? (typeof m.user === "object" ? m.user?.id : m.user) ?? "";
}

function findPlayerOwner(actor: FoundryActor): FoundryUser | undefined {
    const owners = Object.entries(actor.ownership ?? {})
        .filter(([, level]) => (level as number) >= 3)
        .map(([userId]) => userId);
    return (game.users?.contents ?? []).find(u => !u.isGM && u.active && owners.includes(u.id));
}

function findActiveGM(): FoundryUser | undefined {
    return (game.users?.contents ?? []).find(u => u.isGM && u.active);
}

export function getTargetUserId(actor: FoundryActor): string | null {
    return findPlayerOwner(actor)?.id ?? findActiveGM()?.id ?? null;
}

/**
 * Dispatch público — usado por handlers de magias de área (bola-de-fogo, etc.)
 * para abrir o modal de resistência num alvo. Se o alvo é o usuário atual,
 * abre direto; senão envia via socketlib pro cliente do dono do ator.
 */
export function dispatchSpellResistanceToTarget(preReq: SpellResistPreRollRequest): void {
    if (preReq.targetUserId === game.user?.id) {
        openUnifiedSpellModal(preReq);
    } else {
        void getSocket()?.executeAsUser(SOCKET_PRE_ROLL, preReq.targetUserId, preReq);
    }
}

// ── createChatMessage hook ────────────────────────────────────────────────────

async function processSpellMessage(message: ChatMessage): Promise<void> {
    // Parseia dados comuns (sem verificação de autor ainda — o GM também precisa)
    const itemData = message.getFlag("tormenta20", "itemData") as Record<string, unknown> | undefined;
    if (!itemData) return;

    const tipo = itemData["tipo"] as string | undefined;
    if (!tipo || !(SPELL_TIPOS as readonly string[]).includes(tipo)) return;

    const rolls = message.rolls ?? [];

    // Ignora se tiver roll de ataque (tratado pelo auto-damage)
    if (rolls.some(r => (r.options as Record<string, unknown>)?.["type"] === "attack")) return;

    // ── Purificação: handler especial (apenas o autor processa) ──────────────
    if (getMsgAuthorId(message) === game.user?.id) {
        const spellName = extractSpellName(message);
        if (normalizeCondName(spellName) === "purificacao") {
            await handlePurification(message, message.speaker?.alias ?? "Lançador");
            return;
        }
    }

    // ── Magias de área que NÃO devem abrir o modal de spell-resist ──────────
    // (Consagrar tem effects no item mas é magia de área persistente — alvos
    // são tokens DENTRO da área, não T-targets; o handler dedicado deve cuidar.)
    {
        const sn = normalizeCondName(extractSpellName(message));
        if (sn === "consagrar") return;
        if (sn === "bola de fogo") return;
    }

    const damageRoll = rolls.find(r => (r.options as Record<string, unknown>)?.["type"] === "damage");

    // Detecta Truque cedo — o roll de cura original foi suprimido em preCreate,
    // então não podemos depender de damageRoll para determinar isHeal nesse caso.
    const spellNameEarly = extractSpellName(message);
    const truqueAtivo    =
        normalizeCondName(spellNameEarly) === "curar ferimentos"
        && /truque/i.test(message.content ?? "")
        && /1d8/i.test(message.content ?? "");
    const isHeal      = truqueAtivo
        || (damageRoll != null && (damageRoll.formula ?? "").includes("curapv"));
    const resistTxt   = ((itemData["resistencia"] as { txt?: string } | undefined)?.txt ?? "").trim();
    const damageTotal = damageRoll?.total ?? 0;

    const { skill: resistSkill, outcome: resistOutcome } = parseResistance(resistTxt);

    // Verifica se há efeitos de buff/condição na mensagem
    const hasMsgEffects = ((message.getFlag("tormenta20", "effects") as unknown[] | undefined)?.length ?? 0) > 0;

    // Abre o modal se tiver algo relevante para o alvo
    const shouldOpen = isHeal || resistSkill !== null || damageTotal > 0 || hasMsgEffects;
    if (!shouldOpen) return;

    const casterActorId = message.speaker?.actor ?? "";
    const isPureBuff    = !isHeal && resistSkill === null && damageTotal === 0 && hasMsgEffects;

    // Resolve flag do item para auto-apply (ID extraído do HTML, não dos flags)
    const casterActor  = game.actors?.get(casterActorId);
    const spellItemId   = extractItemId(message);
    type ActorWithFlags = FoundryActor & { getFlag(scope: string, key: string): unknown };
    const autoApplyMap  = (casterActor as ActorWithFlags | undefined)?.getFlag(MODULE_ID, "autoApplyItems") as Record<string, boolean> | undefined;
    const autoEnabled   = Boolean(spellItemId && autoApplyMap?.[spellItemId]);

    // ── Apenas o autor da mensagem processa (garante que os alvos T são corretos) ─
    if (getMsgAuthorId(message) !== game.user?.id) return;

    // ── Resolver alvos ────────────────────────────────────────────────────────
    const tTargets = Array.from(game.user?.targets ?? []);
    let effectiveTargets: FoundryToken[];

    if (tTargets.length > 0) {
        effectiveTargets = tTargets;
    } else {
        const cvs = canvas as unknown as { tokens?: { controlled?: FoundryToken[] } };
        const controlled = cvs.tokens?.controlled ?? [];
        effectiveTargets = controlled.filter(t => t.actor != null && t.actor.id !== casterActorId);
        if (effectiveTargets.length === 0) return;
    }

    // ── Auto-apply buff puro (sem modal) — GM aplica direto; player delega ao GM ─
    if (isPureBuff && autoEnabled && effectiveTargets.length > 0) {
        type EffectData = Record<string, unknown>;
        const effectGroups = (message.getFlag("tormenta20", "effects") as EffectData[][] | undefined) ?? [];
        const casterName   = message.speaker?.alias ?? "Lançador";
        await autoApplyBuffEffects(effectGroups, effectiveTargets, casterName);
        return;
    }

    const damageFormula = damageRoll?.formula ?? "";
    const casterName    = message.speaker?.alias ?? "Lançador";
    const casterUserId  = game.user?.id ?? "";
    const spellName     = extractSpellName(message);
    // CD: se o chat tiver "CD X" usa esse valor (já inclui modificadores do modal de configuração);
    // caso contrário (Curar Ferimentos sem resistência), calcula do ator lançador.
    const extractedCD = extractCD(message);
    const cd          = extractedCD > 0
        ? extractedCD
        : computeCasterSpellCD(game.actors?.get(message.speaker?.actor ?? "") ?? null);
    // Detecta o aprimoramento de Curar Ferimentos "+2 PM: remove uma condição de fadiga do alvo"
    const removeFadiga  = isHeal
        && normalizeCondName(spellName) === "curar ferimentos"
        && /fadiga/i.test(message.content ?? "");

    // truqueAtivo já foi calculado no topo de processSpellMessage.
    // O roll de 2d8+2 já foi suprimido pelo preCreate hook quando Truque está ativo.
    let effectiveDamage  = damageTotal;
    let effectiveMaxHeal = (isHeal && damageRoll) ? computeMaxRoll(damageRoll) : 0;

    if (truqueAtivo) {
        // Aprimoramento "Energético" (0 PM): adiciona +1d6 ao dano do Truque
        const energeticoAtivo = /energ[eé]tico/i.test(message.content ?? "");
        const formula  = energeticoAtivo ? "1d8 + 1d6" : "1d8";
        const dRoll    = new Roll(formula);
        await dRoll.evaluate({ async: true } as never);
        effectiveDamage  = dRoll.total ?? 0;
        effectiveMaxHeal = energeticoAtivo ? 14 : 8;
        const flavorSuffix = energeticoAtivo ? " · Energético (+1d6)" : "";
        await ChatMessage.create({
            content: await dRoll.render({
                flavor: `Curar Ferimentos — Truque · Dano de Luz vs Morto-Vivo (Vontade reduz à metade)${flavorSuffix}`,
            }),
            rolls:   [dRoll.toJSON()],
            type:    5,
            speaker: message.speaker,
        });
    }

    for (const token of effectiveTargets) {
        const targetActor = token.actor;
        if (!targetActor) continue;

        const targetUserId = getTargetUserId(targetActor);
        if (!targetUserId) {
            ui.notifications.warn(`Nenhum usuário ativo para "${spellName}" em ${targetActor.name}.`);
            continue;
        }

        const preReq: SpellResistPreRollRequest = {
            type:            "spell-resist-preroll",
            requestId:       randomID(),
            targetUserId,
            casterUserId,
            targetActorId:   targetActor.id,
            targetActorUuid: targetActor.uuid,
            casterName,
            spellName,
            resistTxt,
            resistSkill:     resistSkill ?? null,
            resistOutcome,
            cd,
            messageId:       message.id,
            damageTotal:     effectiveDamage,
            damageFormula:   truqueAtivo ? (/energ[eé]tico/i.test(message.content ?? "") ? "1d8 + 1d6" : "1d8") : damageFormula,
            isHeal,
            maxHealValue:    effectiveMaxHeal,
            removeFadiga,
            truqueAtivo,
            conditions:      [],
            customEffectNames: [],
        };

        if (targetUserId === game.user?.id) {
            openUnifiedSpellModal(preReq);
        } else {
            void getSocket()?.executeAsUser(SOCKET_PRE_ROLL, targetUserId, preReq);
        }
    }
}

function setupCreateChatHook(): void {
    Hooks.on("createChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;
        void processSpellMessage(message);
    });
}

/**
 * Intercepta a mensagem ANTES de ser criada para remover o roll original de
 * cura (2d8+2 de Curar Ferimentos) quando o aprimoramento Truque está ativo —
 * o Truque substitui a cura por 1d8 de dano de luz, então a rolagem original
 * não deve aparecer no chat. Roda apenas no cliente do autor.
 */
function setupTruquePreCreateHook(): void {
    Hooks.on("preCreateChatMessage", (...args: unknown[]): void => {
        type DocLike = { updateSource(changes: Record<string, unknown>): void };
        const doc      = args[0] as DocLike;
        const data     = args[1] as Record<string, unknown>;
        const userId   = args[3] as string;
        if (userId !== game.user?.id) return;

        const content = (data["content"] as string | undefined) ?? "";
        if (!content) return;

        // Detecta Truque em Curar Ferimentos no conteúdo do card
        if (!/truque/i.test(content)) return;
        if (!/1d8/i.test(content)) return;
        if (!/curar\s+ferimentos/i.test(content)) return;

        // Remove rolls do tipo "damage" (que é o roll de cura 2d8+2)
        const rolls = data["rolls"] as unknown[] | undefined;
        if (!Array.isArray(rolls) || !rolls.length) return;
        const filtered = rolls.filter(r => {
            try {
                const rd = typeof r === "string" ? JSON.parse(r) as Record<string, unknown> : r as Record<string, unknown>;
                const opts = rd["options"] as Record<string, unknown> | undefined;
                return opts?.["type"] !== "damage";
            } catch {
                return true;
            }
        });
        if (filtered.length === rolls.length) return; // nada a remover
        doc.updateSource({ rolls: filtered });
    });
}

// ── Entrada pública ───────────────────────────────────────────────────────────

export function setupSpellResistance(): void {
    ensureStyles();
    setupSocket();
    setupTruquePreCreateHook();
    setupCreateChatHook();
}

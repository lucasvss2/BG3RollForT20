import { MODULE_ID } from "@/constants";
import { computeSkillTotal } from "@/hidden-test/skills";
import {
    getActivatableItems,
    type ActivatableItem,
} from "@/hidden-test/HiddenTestPlayerDialog";
import type {
    SpellResistPreRollRequest,
    SpellResistRequest,
    SpellResistSocketData,
    SpellConditionData,
    ResistSkill,
    ResistOutcome,
} from "./types";

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
/* ── Spell resistance — pre-roll dialog ─────────────────────────────────── */

.srp-body {
    padding: 4px 0 2px;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
}
.srp-banner {
    padding: 10px 16px 8px;
    text-align: center;
}
.srp-spell-name {
    color: #8ab4e8;
    font-size: clamp(1.2rem, 2.8vw, 1.65rem);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-shadow: 0 0 18px rgba(138,180,232,0.55);
    text-transform: uppercase;
    margin: 4px 0 2px;
}
.srp-caster-name {
    color: #c8a96e;
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: 0.06em;
}
.srp-label-sm {
    color: #8a7450;
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    flex: 0 0 auto;
}
.srp-divider {
    background: linear-gradient(to right, transparent, rgba(138,180,232,0.35), transparent);
    height: 1px;
    margin: 4px 16px;
}
.srp-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 5px 16px;
    flex-wrap: wrap;
}
.srp-value-lg {
    color: #e8d8a8;
    font-size: 1.0rem;
    font-weight: 700;
    flex: 1 1 auto;
    text-align: right;
}
.srp-cd-val {
    color: #cc4444;
    font-size: 1.2rem;
    font-weight: 900;
}
.srp-bonus-display {
    color: #6ecf7a;
    font-size: 1.15rem;
    font-weight: 900;
    text-align: right;
    flex: 1 1 auto;
}
.srp-powers-section {
    padding: 4px 16px 6px;
}
.srp-powers-header {
    display: grid;
    grid-template-columns: 20px 32px 1fr 60px;
    gap: 6px;
    align-items: center;
    color: #8a7450;
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(200,169,110,0.2);
    margin-bottom: 4px;
}
.srp-power-row {
    display: grid;
    grid-template-columns: 20px 32px 1fr 60px;
    gap: 6px;
    align-items: center;
    padding: 3px 0;
    font-size: 0.85rem;
    color: #e8d8a8;
}
.srp-power-row:hover { background: rgba(138,180,232,0.06); }
.srp-power-check { accent-color: #8ab4e8; width: 13px; height: 13px; cursor: pointer; }
.srp-pm-cost { color: #8ab4e8; font-weight: 700; text-align: center; font-size: 0.8rem; }
.srp-power-name { color: #e8d8a8; }
.srp-power-bonus { text-align: right; font-weight: 700; }
.srp-bonus-known    { color: #6ecf7a; }
.srp-bonus-advantage { color: #f0c060; }
.srp-pm-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0 2px;
    border-top: 1px solid rgba(200,169,110,0.2);
    margin-top: 4px;
    font-size: 0.8rem;
}
.srp-pm-display {
    color: #8ab4e8;
    font-weight: 700;
    font-size: 1rem;
}
.srp-extra-bonus {
    padding: 4px 16px 6px;
}
.srp-extra-bonus input {
    width: 100%;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(200,169,110,0.35);
    border-radius: 3px;
    color: #e8d8a8;
    font-family: "Modesto Condensed", monospace;
    font-size: 0.95rem;
    padding: 3px 8px;
}
.srp-extra-bonus input:focus {
    outline: none;
    border-color: rgba(138,180,232,0.6);
}
.srp-dialog .dialog-buttons,
.srp-dialog footer.form-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* ── Spell resistance — result dialog ───────────────────────────────────── */

.srd-body {
    padding: 4px 0 2px;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
}
.srd-banner { padding: 10px 16px 8px; text-align: center; }
.srd-spell-name {
    color: #8ab4e8;
    font-size: clamp(1.2rem, 2.8vw, 1.65rem);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-shadow: 0 0 18px rgba(138,180,232,0.55);
    text-transform: uppercase;
    margin: 4px 0 2px;
}
.srd-target-name { color: #c8a96e; font-size: 1rem; font-weight: 700; letter-spacing: 0.06em; }
.srd-label-sm {
    color: #8a7450;
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    flex: 0 0 auto;
}
.srd-divider {
    background: linear-gradient(to right, transparent, rgba(138,180,232,0.35), transparent);
    height: 1px;
    margin: 4px 16px;
}
.srd-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 5px 16px;
    flex-wrap: wrap;
}
.srd-value-lg { color: #e8d8a8; font-size: 1.0rem; font-weight: 700; flex: 1 1 auto; text-align: right; }
.srd-roll-val { font-size: 1.2rem; font-weight: 900; letter-spacing: 0.04em; }
.srd-roll-pass { color: #6ecf7a; }
.srd-roll-fail { color: #cc4444; }
.srd-cd-val { color: #c8a96e; font-size: 1.05rem; font-weight: 700; }
.srd-damage-display { display: flex; flex-direction: column; align-items: center; padding: 6px 16px 4px; gap: 2px; }
.srd-damage-total { font-size: 3.2rem; font-weight: 900; line-height: 1; }
.srd-damage-total.srd-dmg  { color: #cc4444; text-shadow: 0 0 28px rgba(204,68,68,0.6); }
.srd-damage-total.srd-heal { color: #6ecf7a; text-shadow: 0 0 28px rgba(110,207,122,0.6); }
.srd-result-badge {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 2px 10px;
    border-radius: 3px;
    margin-left: auto;
}
.srd-result-badge.srd-pass { background: rgba(110,207,122,0.15); color: #6ecf7a; border: 1px solid rgba(110,207,122,0.4); }
.srd-result-badge.srd-fail { background: rgba(204,68,68,0.15); color: #cc4444; border: 1px solid rgba(204,68,68,0.4); }
.srd-applied-powers { padding: 2px 16px 4px; }
.srd-applied-power {
    font-size: 0.78rem;
    color: #8ab4e8;
    font-style: italic;
    line-height: 1.4;
}
.srd-conditions { padding: 4px 16px 8px; }
.srd-condition-list { margin-top: 4px; display: flex; flex-direction: column; gap: 3px; }
.srd-condition-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: #e8d8a8;
    cursor: pointer;
    user-select: none;
}
.srd-condition-item input[type="checkbox"] { accent-color: #8ab4e8; width: 13px; height: 13px; }
.srd-dialog .dialog-buttons,
.srd-dialog footer.form-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
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

function parseResistance(txt: string): ResistInfo {
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

function extractCD(message: ChatMessage): number {
    const match = message.content?.match(/CD\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

function extractSpellName(message: ChatMessage): string {
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

function extractConditions(message: ChatMessage): SpellConditionData[] {
    type RawEffect = {
        name?: string;
        disabled?: boolean;
        duration?: { rounds?: number | null; seconds?: number | null };
        flags?: { tormenta20?: Record<string, unknown> };
    };
    type StatusEntry = { id: string; name: string };

    const effects = message.getFlag("tormenta20", "effects") as RawEffect[][] | undefined;
    if (!effects?.length) return [];

    const statusEffects = (
        (typeof CONFIG !== "undefined" ? (CONFIG as Record<string, unknown>).statusEffects : undefined) as StatusEntry[] | undefined
    ) ?? [];

    const conditions: SpellConditionData[] = [];
    const seen = new Set<string>();

    function resolveStatus(label: string): { statusId: string; resolvedLabel: string } {
        let statusEntry = statusEffects.find((e) => e.name?.toLowerCase() === label.toLowerCase());
        if (!statusEntry) {
            const guessedId = label
                .toLowerCase()
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .replace(/\s+/g, "");
            statusEntry = statusEffects.find((e) => e.id === guessedId);
        }
        return {
            statusId:      statusEntry?.id ?? label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, ""),
            resolvedLabel: statusEntry?.name ?? label,
        };
    }

    for (const effArray of effects) {
        if (!Array.isArray(effArray)) continue;
        for (const eff of effArray) {
            if (!eff.name) continue;

            const t20 = (eff.flags?.tormenta20 ?? {}) as Record<string, unknown>;

            // Caso 1 — padrão "NomeMagia (NomeCondição)": extrai o que está entre parênteses
            const condMatch = eff.name.match(/\(([^)]+)\)/);
            if (condMatch) {
                const condLabel = condMatch[1].trim();
                if (seen.has(condLabel.toLowerCase())) continue;
                seen.add(condLabel.toLowerCase());
                const { statusId, resolvedLabel } = resolveStatus(condLabel);
                conditions.push({
                    statusId,
                    label:           resolvedLabel,
                    durationRounds:  eff.duration?.rounds  != null ? eff.duration.rounds  : undefined,
                    durationSeconds: eff.duration?.seconds != null ? eff.duration.seconds : undefined,
                });
                continue;
            }

            // Caso 2 — efeito direto sem parênteses (ex: "Sono"):
            // deve estar ativo (disabled: false) e não ser um efeito de uso manual (onuse: false)
            // nem uma melhoria de lançamento (self: true costuma indicar aumenta do lançador)
            if (eff.disabled) continue;
            if (t20["onuse"] || t20["self"]) continue;

            const label = eff.name.trim();
            if (seen.has(label.toLowerCase())) continue;
            seen.add(label.toLowerCase());

            const { statusId, resolvedLabel } = resolveStatus(label);
            conditions.push({
                statusId,
                label:           resolvedLabel,
                durationRounds:  eff.duration?.rounds  != null ? eff.duration.rounds  : undefined,
                durationSeconds: eff.duration?.seconds != null ? eff.duration.seconds : undefined,
            });
        }
    }
    return conditions;
}

// ── Aplicação de dano / cura / condição ──────────────────────────────────────

async function applySpellDamage(actorId: string, amount: number): Promise<void> {
    const actor = game.actors?.get(actorId);
    if (!actor) return;
    const pv         = actor.system?.attributes?.pv;
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

async function applySpellHeal(actorId: string, amount: number): Promise<void> {
    const actor = game.actors?.get(actorId);
    if (!actor) return;
    const pv  = actor.system?.attributes?.pv;
    const cur = pv?.value ?? 0;
    const max = pv?.max   ?? cur;
    await actor.update({ "system.attributes.pv.value": Math.min(max, cur + amount) });
}

async function applyCondition(actorId: string, statusId: string): Promise<void> {
    type ActorWithToggle = FoundryActor & {
        toggleStatusEffect(id: string, opts?: Record<string, unknown>): Promise<void>;
    };
    const actor = game.actors?.get(actorId) as ActorWithToggle | undefined;
    if (!actor?.toggleStatusEffect) return;
    await actor.toggleStatusEffect(statusId, { active: true });
}

function applyCheckedConditions($html: JQuery, actorId: string): void {
    $html.find('input[type="checkbox"][data-status-id]:checked').each((_, el) => {
        const statusId = (el as HTMLInputElement).dataset["statusId"];
        if (statusId) void applyCondition(actorId, statusId);
    });
}

// ── Dialog de resultado (pós-roll) ────────────────────────────────────────────

function openSpellResistDialog(req: SpellResistRequest): void {
    ensureStyles();

    const targetActor = game.actors?.get(req.targetActorId);
    const targetName  = targetActor?.name ?? "Alvo";
    const halfDmg     = Math.floor(req.damageTotal / 2);

    // Magia de puro status: sem roll de dano (damageTotal === 0)
    const isConditionOnly = !req.isHeal && req.damageTotal === 0;

    // Seção de resistência
    let resistSection = "";
    if (!req.isHeal && req.resistSkill && req.cd > 0) {
        const passedClass = req.passed ? "srd-pass" : "srd-fail";
        const rollClass   = req.passed ? "srd-roll-pass" : "srd-roll-fail";
        const passedLabel = req.passed ? "PASSOU" : "FALHOU";
        const skillLabel  = SKILL_LABELS[req.resistSkill];
        const outcomeLabel =
            req.resistOutcome === "anula"   ? "anula todo o efeito" :
            req.resistOutcome === "metade"  ? "reduz dano à metade" :
            req.resistOutcome === "parcial" ? (isConditionOnly ? "evita as condições" : "reduz dano à metade e evita condições") :
            "veja texto da magia";

        const powersHtml = req.appliedPowerLabels.length > 0 ? `
            <div class="srd-applied-powers">
                ${req.appliedPowerLabels.map(l => `<div class="srd-applied-power">✦ ${esc(l)}</div>`).join("")}
            </div>
        ` : "";

        resistSection = `
            <div class="srd-divider"></div>
            <div class="srd-row">
                <span class="srd-label-sm">TESTE DE ${esc(skillLabel.toUpperCase())}</span>
                <span class="srd-roll-val ${rollClass}">${req.resistRollTotal}</span>
                <span class="srd-label-sm">(d20: ${req.d20Result} + ${req.resistBonus})</span>
                <span class="srd-label-sm">vs CD</span>
                <span class="srd-cd-val">${req.cd}</span>
                <span class="srd-result-badge ${passedClass}">${passedLabel}</span>
            </div>
            ${powersHtml}
            <div class="srd-row">
                <span class="srd-label-sm">SE PASSAR</span>
                <span class="srd-value-lg">${esc(outcomeLabel)}</span>
            </div>
        `;
    } else if (!req.isHeal && req.resistTxt) {
        resistSection = `
            <div class="srd-divider"></div>
            <div class="srd-row">
                <span class="srd-label-sm">RESISTÊNCIA</span>
                <span class="srd-value-lg">${esc(req.resistTxt)}</span>
            </div>
        `;
    }

    // Seção de dano / cura — omitida para magias de puro status (damageTotal === 0)
    const dmgClass  = req.isHeal ? "srd-heal" : "srd-dmg";
    const dmgLabel  = req.isHeal ? "CURA" :
                      req.passed && req.resistOutcome !== "anula" ? `DANO  (metade: ${halfDmg})` :
                      "DANO";

    const valueSection = isConditionOnly ? "" : `
        <div class="srd-divider"></div>
        <div class="srd-damage-display">
            <div class="srd-label-sm">${dmgLabel}</div>
            <div class="srd-damage-total ${dmgClass}">${req.damageTotal}</div>
        </div>
    `;

    // Seção de condições
    const condDefault = req.isHeal ? true : !req.passed;
    const conditionsSection = req.conditions.length > 0 ? `
        <div class="srd-divider"></div>
        <div class="srd-conditions">
            <div class="srd-label-sm">CONDIÇÕES A APLICAR</div>
            <div class="srd-condition-list">
                ${req.conditions.map((c, i) => `
                    <label class="srd-condition-item">
                        <input type="checkbox" name="cond-${i}"
                               data-status-id="${esc(c.statusId)}"
                               ${condDefault ? "checked" : ""} />
                        ${esc(c.label)}
                        ${c.durationRounds != null ? `<span style="color:#8a7450;font-size:0.75rem;">(${c.durationRounds}r)</span>` : ""}
                    </label>
                `).join("")}
            </div>
        </div>
    ` : "";

    const content = `
        <div class="srd-body">
            <div class="srd-banner">
                <div class="srd-label-sm">${req.isHeal ? "ALVO CURADO POR MAGIA" : "ALVO ATINGIDO POR MAGIA"}</div>
                <div class="srd-spell-name">${esc(req.spellName)}</div>
                <div class="srd-target-name">${esc(targetName)}</div>
            </div>
            <div class="srd-divider"></div>
            <div class="srd-row">
                <span class="srd-label-sm">LANÇADOR</span>
                <span class="srd-value-lg">${esc(req.casterName)}</span>
            </div>
            ${resistSection}
            ${valueSection}
            ${conditionsSection}
        </div>
    `;

    // Botões
    const buttons: Record<string, DialogButtonConfig> = {};

    if (req.isHeal) {
        buttons.heal = {
            icon:  '<i class="fas fa-heart"></i>',
            label: `Curar (${req.damageTotal})`,
            callback: ($html: JQuery) => {
                void applySpellHeal(req.targetActorId, req.damageTotal);
                applyCheckedConditions($html, req.targetActorId);
            },
        };
        buttons.cancel = { icon: '<i class="fas fa-ban"></i>', label: "Não Aplicar", callback: () => { /**/ } };
    } else if (isConditionOnly) {
        // Magia de puro status — sem dano para aplicar
        const hasConditions = req.conditions.length > 0;
        // Se passou na resistência com outcome que anula ou parcial, o efeito é evitado
        const effectAvoided = req.passed && (req.resistOutcome === "anula" || req.resistOutcome === "parcial");
        if (!effectAvoided || req.resistOutcome === "texto") {
            buttons.apply = {
                icon:  '<i class="fas fa-check-circle"></i>',
                label: hasConditions ? "Aplicar Condições" : "Confirmar Efeito",
                callback: ($html: JQuery) => { applyCheckedConditions($html, req.targetActorId); },
            };
        }
        buttons.none = { icon: '<i class="fas fa-ban"></i>', label: "Sem Efeito", callback: () => { /**/ } };
    } else {
        const showFull = !req.resistSkill || !req.passed || req.resistOutcome === "texto";
        const showHalf = req.resistSkill != null &&
                         (req.resistOutcome === "metade" || req.resistOutcome === "parcial" || req.resistOutcome === "texto");
        const showNone = req.resistSkill != null &&
                         (req.resistOutcome === "anula"  || req.resistOutcome === "texto");

        if (showFull) {
            buttons.full = {
                icon:  '<i class="fas fa-bolt"></i>',
                label: `Aplicar Dano Integral (${req.damageTotal})`,
                callback: ($html: JQuery) => {
                    void applySpellDamage(req.targetActorId, req.damageTotal);
                    applyCheckedConditions($html, req.targetActorId);
                },
            };
        }
        if (showHalf) {
            buttons.half = {
                icon:  '<i class="fas fa-shield-halved"></i>',
                label: `Aplicar Metade (${halfDmg})`,
                callback: ($html: JQuery) => {
                    void applySpellDamage(req.targetActorId, halfDmg);
                    applyCheckedConditions($html, req.targetActorId);
                },
            };
        }
        if (showNone || !req.resistSkill) {
            buttons.none = { icon: '<i class="fas fa-ban"></i>', label: "Não Aplicar", callback: () => { /**/ } };
        }
    }

    let defaultBtn: string =
        req.isHeal                                           ? "heal" :
        isConditionOnly && req.passed &&
            (req.resistOutcome === "anula" ||
             req.resistOutcome === "parcial")               ? "none" :
        isConditionOnly                                      ? "apply" :
        req.passed && req.resistOutcome === "anula"          ? "none" :
        req.passed                                           ? "half" :
        "full";
    if (!buttons[defaultBtn]) defaultBtn = Object.keys(buttons)[0] ?? "none";

    new Dialog(
        {
            title:   `${req.isHeal ? "Cura" : "Magia"} — ${targetName}`,
            content,
            buttons,
            default: defaultBtn,
        },
        { classes: ["bg3-dialog", "srd-dialog"], width: 420, id: `spell-resist-${req.requestId}` },
    ).render(true);
}

// ── Dialog de pré-roll (alvo escolhe poderes) ─────────────────────────────────

function openSpellResistPreRollDialog(preReq: SpellResistPreRollRequest): void {
    ensureStyles();

    const targetActor = game.actors?.get(preReq.targetActorId);
    const targetName  = targetActor?.name ?? "Alvo";

    // Para curas, pula direto para o result dialog
    if (preReq.isHeal) {
        const req: SpellResistRequest = {
            type:              "spell-resist-request",
            requestId:         preReq.requestId,
            targetUserId:      preReq.targetUserId,
            casterUserId:      preReq.casterUserId,
            targetActorId:     preReq.targetActorId,
            casterName:        preReq.casterName,
            spellName:         preReq.spellName,
            resistTxt:         "",
            resistSkill:       null,
            resistOutcome:     "none",
            cd:                0,
            resistRollTotal:   0,
            resistBonus:       0,
            resistFormula:     "—",
            d20Result:         0,
            appliedPowerLabels: [],
            damageTotal:       preReq.damageTotal,
            damageFormula:     preReq.damageFormula,
            isHeal:            true,
            conditions:        preReq.conditions,
            passed:            true,
        };
        openSpellResistDialog(req);
        return;
    }

    const skillKey   = preReq.resistSkill;
    const skillLabel = skillKey ? SKILL_LABELS[skillKey] : "Resistência";
    const baseBonus  = targetActor && skillKey ? computeSkillTotal(targetActor, skillKey) : 0;
    const bonusStr   = baseBonus >= 0 ? `+${baseBonus}` : `${baseBonus}`;

    // Poderes ativáveis: busca pelo label da perícia (ex: "Fortitude")
    // items=="" em poderes como Audácia → aparece em qualquer perícia
    // Filtra itens de tipo "tesouro": são objetos físicos (ex: Lupa), não habilidades de resistência
    const powers: ActivatableItem[] = (targetActor
        ? getActivatableItems(targetActor, skillLabel)
        : []
    ).filter(p => p.itemType !== "tesouro");

    const pmActual = targetActor?.system?.attributes?.pm?.value ?? 0;

    const powersHtml = powers.length > 0 ? `
        <div class="srp-divider"></div>
        <div class="srp-powers-section">
            <div class="srp-powers-header">
                <span></span>
                <span>PM</span>
                <span>PODER / HABILIDADE</span>
                <span>BÔNUS</span>
            </div>
            ${powers.map(p => `
            <div class="srp-power-row">
                <input type="checkbox" class="srp-power-check"
                    data-pm="${p.pm}"
                    data-bonus="${esc(p.bonusFormula)}"
                    data-advantage="${p.isAdvantage}"
                    data-label="${esc(p.bonusLabel)}"
                    data-name="${esc(p.name)}"
                    ${p.pm > pmActual ? "disabled title='PM insuficiente'" : ""}>
                <span class="srp-pm-cost">${p.pm > 0 ? p.pm : "—"}</span>
                <span class="srp-power-name">${esc(p.name)}</span>
                <span class="srp-power-bonus ${p.isAdvantage ? "srp-bonus-advantage" : "srp-bonus-known"}">${esc(p.bonusLabel)}</span>
            </div>`).join("")}
            <div class="srp-pm-total-row">
                <span class="srp-label-sm">CUSTO DE MANA (disponível: ${pmActual})</span>
                <span class="srp-pm-display" id="srp-pm-total">0</span>
            </div>
        </div>
    ` : "";

    const content = `
        <div class="srp-body">
            <div class="srp-banner">
                <div class="srp-label-sm">VOCÊ ESTÁ SENDO ALVO DE UMA MAGIA</div>
                <div class="srp-spell-name">${esc(preReq.spellName)}</div>
                <div class="srp-caster-name">por ${esc(preReq.casterName)}</div>
            </div>
            <div class="srp-divider"></div>
            <div class="srp-row">
                <span class="srp-label-sm">ALVO</span>
                <span class="srp-value-lg">${esc(targetName)}</span>
            </div>
            <div class="srp-row">
                <span class="srp-label-sm">TESTE DE ${esc(skillLabel.toUpperCase())}</span>
                <span class="srp-label-sm">vs CD</span>
                <span class="srp-cd-val">${preReq.cd}</span>
            </div>
            <div class="srp-row">
                <span class="srp-label-sm">BÔNUS BASE</span>
                <span class="srp-bonus-display">${bonusStr}</span>
            </div>
            ${powersHtml}
            <div class="srp-divider"></div>
            <div class="srp-extra-bonus">
                <div class="srp-label-sm" style="padding-bottom:4px;">BÔNUS EXTRA (opcional)</div>
                <input type="text" name="bonusExtra" placeholder="ex: +1d4 ou +2" />
            </div>
        </div>
    `;

    new Dialog(
        {
            title: `Resistência — ${targetName}`,
            content,
            buttons: {
                roll: {
                    icon:  '<i class="fas fa-dice-d20"></i>',
                    label: "Rolar Resistência",
                    callback: ($html: JQuery) => {
                        const bonusExtra = (($html.find('[name="bonusExtra"]').val() as string) ?? "").trim();
                        const selected = $html.find(".srp-power-check:checked").toArray().map(el => ({
                            pm:         parseInt((el as HTMLElement).dataset["pm"]        ?? "0", 10),
                            bonus:      (el as HTMLElement).dataset["bonus"]     ?? "",
                            advantage:  (el as HTMLElement).dataset["advantage"] === "true",
                            bonusLabel: (el as HTMLElement).dataset["label"]     ?? "",
                            name:       (el as HTMLElement).dataset["name"]      ?? "",
                        }));
                        void executeSpellResistRoll(preReq, targetActor, targetName, baseBonus, bonusExtra, selected);
                    },
                },
            },
            default: "roll",
            render: ($html: JQuery) => {
                // Atualiza total de PM ao marcar/desmarcar
                $html.find(".srp-power-check").on("change", () => {
                    const total = $html.find(".srp-power-check:checked").toArray()
                        .reduce((s, el) => s + parseInt((el as HTMLElement).dataset["pm"] ?? "0", 10), 0);
                    $html.find("#srp-pm-total").text(String(total));
                });
            },
        },
        { classes: ["bg3-dialog", "srp-dialog"], width: 440, id: `spell-resist-preroll-${preReq.requestId}` },
    ).render(true);
}

// ── Execução do roll de resistência ──────────────────────────────────────────

async function executeSpellResistRoll(
    preReq:   SpellResistPreRollRequest,
    actor:    FoundryActor | undefined,
    actorName: string,
    baseBonus: number,
    extraBonus: string,
    selected: Array<{ pm: number; bonus: string; advantage: boolean; bonusLabel: string; name: string }>,
): Promise<void> {
    const hasAdvantage = selected.some(p => p.advantage);

    // Monta fórmula: (2d20kh1 ou 1d20) + baseBonus + poderes + extra
    const parts: string[] = [hasAdvantage ? "2d20kh1" : "1d20"];

    if (baseBonus !== 0) {
        parts.push(baseBonus > 0 ? `+ ${baseBonus}` : `- ${Math.abs(baseBonus)}`);
    }
    for (const p of selected) {
        if (!p.bonus || p.bonus === "kh") continue;
        const b = p.bonus.trim();
        parts.push(b.startsWith("+") || b.startsWith("-") ? b : `+ ${b}`);
    }
    if (extraBonus) {
        const b = extraBonus.trim();
        parts.push(b.startsWith("+") || b.startsWith("-") ? b : `+ ${b}`);
    }

    const roll = new Roll(parts.join(" "));
    await roll.evaluate({ async: true });

    // Desconta PM dos poderes ativados
    const totalPm = selected.reduce((s, p) => s + p.pm, 0);
    if (totalPm > 0 && actor) {
        const currentPm = actor.system?.attributes?.pm?.value ?? 0;
        await actor.update({ "system.attributes.pm.value": Math.max(0, currentPm - totalPm) });
    }

    const d20Term    = roll.dice?.[0];
    const d20Result  = d20Term?.results?.find(r => r.active)?.result ?? 0;
    const rollTotal  = roll.total ?? 0;
    const passed     = rollTotal >= preReq.cd;
    const skillLabel = preReq.resistSkill ? SKILL_LABELS[preReq.resistSkill] : "Resistência";

    // Labels dos poderes aplicados para exibição no dialog de resultado
    const appliedPowerLabels: string[] = selected.map(p => {
        const pmStr = p.pm > 0 ? ` (${p.pm} PM)` : "";
        return `${p.bonusLabel} · ${p.name}${pmStr}`;
    });
    if (extraBonus) appliedPowerLabels.push(`${extraBonus} (manual)`);

    // Publica o roll no chat para todos verem
    await ChatMessage.create({
        content: await roll.render({
            flavor: `Resistência — ${skillLabel} (${actorName}) vs CD ${preReq.cd} ${passed ? "✓ PASSOU" : "✗ FALHOU"}`,
        }),
        rolls:   [roll.toJSON()],
        type:    5,
        speaker: ChatMessage.getSpeaker({ actor: actor ?? null }),
    });

    // Abre o dialog de resultado
    const req: SpellResistRequest = {
        type:              "spell-resist-request",
        requestId:         preReq.requestId,
        targetUserId:      preReq.targetUserId,
        casterUserId:      preReq.casterUserId,
        targetActorId:     preReq.targetActorId,
        casterName:        preReq.casterName,
        spellName:         preReq.spellName,
        resistTxt:         preReq.resistTxt,
        resistSkill:       preReq.resistSkill,
        resistOutcome:     preReq.resistOutcome,
        cd:                preReq.cd,
        resistRollTotal:   rollTotal,
        resistBonus:       baseBonus,
        resistFormula:     roll.formula,
        d20Result,
        appliedPowerLabels,
        damageTotal:       preReq.damageTotal,
        damageFormula:     preReq.damageFormula,
        isHeal:            false,
        conditions:        preReq.conditions,
        passed,
    };

    openSpellResistDialog(req);
}

// ── Socket ────────────────────────────────────────────────────────────────────

function setupSocket(): void {
    game.socket?.on(`module.${MODULE_ID}`, (raw: unknown) => {
        const data = raw as SpellResistSocketData;

        if (data?.type === "spell-resist-preroll") {
            if (data.targetUserId !== game.user?.id) return;
            openSpellResistPreRollDialog(data);
            return;
        }

        // spell-resist-request: apenas para compatibilidade futura ou uso interno
        if (data?.type === "spell-resist-request") {
            if (data.targetUserId !== game.user?.id) return;
            openSpellResistDialog(data);
        }
    });
}

// ── Helpers de usuário / ator ─────────────────────────────────────────────────

function getMsgAuthorId(message: ChatMessage): string {
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

function getTargetUserId(actor: FoundryActor): string | null {
    return findPlayerOwner(actor)?.id ?? findActiveGM()?.id ?? null;
}

// ── createChatMessage hook ────────────────────────────────────────────────────

async function processSpellMessage(message: ChatMessage): Promise<void> {
    if (getMsgAuthorId(message) !== game.user?.id) return;

    const itemData = message.getFlag("tormenta20", "itemData") as Record<string, unknown> | undefined;
    if (!itemData) return;

    const tipo = itemData["tipo"] as string | undefined;
    if (!tipo || !(SPELL_TIPOS as readonly string[]).includes(tipo)) return;

    const rolls = message.rolls ?? [];

    // Ignora se tiver roll de ataque (tratado pelo auto-damage)
    if (rolls.some(r => (r.options as Record<string, unknown>)?.["type"] === "attack")) return;

    const damageRoll = rolls.find(r => (r.options as Record<string, unknown>)?.["type"] === "damage");

    // Magias de puro status não têm roll de dano — ainda precisam do dialog de resistência
    const isHeal    = damageRoll != null && (damageRoll.formula ?? "").includes("curapv");
    const resistTxt = ((itemData["resistencia"] as { txt?: string } | undefined)?.txt ?? "").trim();

    // Precisa ter resistência (ou ser cura) para prosseguir
    if (!isHeal && !resistTxt) return;

    const { skill: resistSkill, outcome: resistOutcome } = parseResistance(resistTxt);
    if (!isHeal && resistOutcome === "none") return;

    const targets = game.user?.targets;
    if (!targets?.size) return;

    // damageTotal = 0 para magias de puro status (sem roll de dano)
    const damageTotal   = damageRoll?.total ?? 0;
    const damageFormula = damageRoll?.formula ?? "";
    const casterName    = message.speaker?.alias ?? "Lançador";
    const casterUserId  = game.user?.id ?? "";
    const spellName     = extractSpellName(message);
    const cd            = isHeal ? 0 : extractCD(message);
    const conditions    = extractConditions(message);

    for (const token of targets) {
        const targetActor = token.actor;
        if (!targetActor) continue;

        const targetUserId = getTargetUserId(targetActor);
        if (!targetUserId) {
            ui.notifications.warn(`Nenhum usuário ativo para "${spellName}" em ${targetActor.name}.`);
            continue;
        }

        const preReq: SpellResistPreRollRequest = {
            type:          "spell-resist-preroll",
            requestId:     randomID(),
            targetUserId,
            casterUserId,
            targetActorId: targetActor.id,
            casterName,
            spellName,
            resistTxt,
            resistSkill:   resistSkill ?? null,
            resistOutcome,
            cd,
            damageTotal,
            damageFormula,
            isHeal,
            conditions,
        };

        if (targetUserId === game.user?.id) {
            openSpellResistPreRollDialog(preReq);
        } else {
            game.socket?.emit(`module.${MODULE_ID}`, preReq);
        }
    }
}

function setupCreateChatHook(): void {
    Hooks.on("createChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;
        void processSpellMessage(message);
    });
}

// ── Entrada pública ───────────────────────────────────────────────────────────

export function setupSpellResistance(): void {
    ensureStyles();
    setupSocket();
    setupCreateChatHook();
}

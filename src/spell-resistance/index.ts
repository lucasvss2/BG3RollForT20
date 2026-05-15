import { MODULE_ID } from "@/constants";
import { computeSkillTotal } from "@/hidden-test/skills";
import type {
    SpellResistRequest,
    SpellResistSocketData,
    SpellConditionData,
    ResistSkill,
    ResistOutcome,
} from "./types";

// ── Constantes ────────────────────────────────────────────────────────────────

/** tipos de magia reconhecidos pelo sistema tormenta20 */
const SPELL_TIPOS = ["arc", "div", "uni"] as const;

// ── CSS ───────────────────────────────────────────────────────────────────────

const SPELL_RESIST_STYLES_ID = "bg3-t20-spell-resist-styles";

const SPELL_RESIST_STYLES = `
/* ── Spell resistance dialog ────────────────────────────────────────────── */

.srd-body {
    padding: 4px 0 2px;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
}
.srd-banner {
    padding: 10px 16px 8px;
    text-align: center;
}
.srd-spell-name {
    color: #8ab4e8;
    font-size: clamp(1.2rem, 2.8vw, 1.65rem);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-shadow: 0 0 18px rgba(138,180,232,0.55);
    text-transform: uppercase;
    margin: 4px 0 2px;
}
.srd-target-name {
    color: #c8a96e;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.06em;
}
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
.srd-value-lg {
    color: #e8d8a8;
    font-size: 1.0rem;
    font-weight: 700;
    flex: 1 1 auto;
    text-align: right;
}
.srd-roll-val {
    font-size: 1.2rem;
    font-weight: 900;
    letter-spacing: 0.04em;
}
.srd-roll-pass { color: #6ecf7a; }
.srd-roll-fail { color: #cc4444; }
.srd-cd-val {
    color: #c8a96e;
    font-size: 1.05rem;
    font-weight: 700;
}
.srd-damage-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 16px 4px;
    gap: 2px;
}
.srd-damage-total {
    font-size: 3.2rem;
    font-weight: 900;
    line-height: 1;
}
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
.srd-result-badge.srd-pass {
    background: rgba(110,207,122,0.15);
    color: #6ecf7a;
    border: 1px solid rgba(110,207,122,0.4);
}
.srd-result-badge.srd-fail {
    background: rgba(204,68,68,0.15);
    color: #cc4444;
    border: 1px solid rgba(204,68,68,0.4);
}
.srd-conditions {
    padding: 4px 16px 8px;
}
.srd-condition-list {
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.srd-condition-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: #e8d8a8;
    cursor: pointer;
    user-select: none;
}
.srd-condition-item input[type="checkbox"] {
    accent-color: #8ab4e8;
    width: 13px;
    height: 13px;
}
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

/**
 * Extrai a perícia e o tipo de resultado do campo resistencia.txt.
 * Exemplos de txt encontrados em jogo:
 *   "Vontade parcial", "Reflexos reduz à metade", "Fortitude (veja texto)",
 *   "Reflexos anula", "Vontade anula (veja texto)", "nenhuma", ""
 */
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

const SKILL_LABELS: Record<ResistSkill, string> = {
    fort: "Fortitude",
    refl: "Reflexos",
    vont: "Vontade",
};

// ── Extração de dados do chat ─────────────────────────────────────────────────

/** Extrai a CD da magia do HTML do card (já inclui bônus de poderes). */
function extractCD(message: ChatMessage): number {
    const match = message.content?.match(/CD\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

/** Extrai o nome do item via data-actor-id + data-item-id no HTML do card. */
function extractSpellName(message: ChatMessage): string {
    const actorId = message.content?.match(/data-actor-id="([^"]+)"/)?.[1];
    const itemId  = message.content?.match(/data-item-id="([^"]+)"/)?.[1];
    if (actorId && itemId) {
        const actor = game.actors?.get(actorId) as (FoundryActor & { items?: { get(id: string): FoundryItem | null } }) | undefined;
        const item  = actor?.items?.get(itemId);
        if (item?.name) return item.name;
    }
    // Fallback: título da imagem no card
    const titleMatch = message.content?.match(/<img[^>]+title="([^"]+)"/);
    return titleMatch?.[1] ?? "Magia";
}

/**
 * Extrai condições de status dos effects da mensagem.
 * O sistema T20 nomeia os effects como "NomeDaMagia (NomeDaCondição)".
 * Fazemos o match da condição extraída com CONFIG.statusEffects.
 */
function extractConditions(message: ChatMessage): SpellConditionData[] {
    type RawEffect = {
        name?: string;
        duration?: { rounds?: number | null; seconds?: number | null };
    };
    type StatusEntry = {
        id: string;
        name: string;
        duration?: { rounds?: number };
    };

    const effects = message.getFlag("tormenta20", "effects") as RawEffect[][] | undefined;
    if (!effects?.length) return [];

    const statusEffects = (
        (typeof CONFIG !== "undefined" ? (CONFIG as Record<string, unknown>).statusEffects : undefined) as StatusEntry[] | undefined
    ) ?? [];

    const conditions: SpellConditionData[] = [];
    const seen = new Set<string>();

    for (const effArray of effects) {
        if (!Array.isArray(effArray)) continue;
        for (const eff of effArray) {
            if (!eff.name) continue;

            // Extrai o texto entre parênteses: "Adaga Mental (Atordoado)" → "Atordoado"
            const condMatch = eff.name.match(/\(([^)]+)\)/);
            if (!condMatch) continue;

            const condLabel = condMatch[1].trim();
            if (seen.has(condLabel.toLowerCase())) continue;
            seen.add(condLabel.toLowerCase());

            // Tenta encontrar pelo nome exato (case-insensitive)
            let statusEntry = statusEffects.find(
                (e) => e.name?.toLowerCase() === condLabel.toLowerCase(),
            );

            // Fallback: converte para ID candidato ("Atordoado" → "atordoado", "Em Chamas" → "emchamas")
            if (!statusEntry) {
                const guessedId = condLabel
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[̀-ͯ]/g, "")
                    .replace(/\s+/g, "");
                statusEntry = statusEffects.find((e) => e.id === guessedId);
            }

            const statusId = statusEntry?.id ?? condLabel
                .toLowerCase()
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .replace(/\s+/g, "");

            const label = statusEntry?.name ?? condLabel;

            conditions.push({
                statusId,
                label,
                durationRounds:  (eff.duration?.rounds  != null ? eff.duration.rounds  : undefined),
                durationSeconds: (eff.duration?.seconds != null ? eff.duration.seconds : undefined),
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

    const newHp = Math.max(0, currentHp - remaining);
    await actor.update({
        "system.attributes.pv.temp":  newTemp,
        "system.attributes.pv.value": newHp,
    });
}

async function applySpellHeal(actorId: string, amount: number): Promise<void> {
    const actor = game.actors?.get(actorId);
    if (!actor) return;

    const pv       = actor.system?.attributes?.pv;
    const current  = pv?.value ?? 0;
    const max      = pv?.max   ?? current;
    const newHp    = Math.min(max, current + amount);

    await actor.update({ "system.attributes.pv.value": newHp });
}

async function applyCondition(actorId: string, statusId: string): Promise<void> {
    type ActorWithToggle = FoundryActor & {
        toggleStatusEffect(id: string, opts?: Record<string, unknown>): Promise<void>;
    };
    const actor = game.actors?.get(actorId) as ActorWithToggle | undefined;
    if (!actor?.toggleStatusEffect) {
        ui.notifications.warn(`toggleStatusEffect não disponível para ${actorId}`);
        return;
    }
    await actor.toggleStatusEffect(statusId, { active: true });
}

/** Aplica todas as condições cujos checkboxes estejam marcados no dialog. */
function applyCheckedConditions($html: JQuery, actorId: string): void {
    $html.find('input[type="checkbox"][data-status-id]:checked').each((_, el) => {
        const statusId = (el as HTMLInputElement).dataset["statusId"];
        if (statusId) void applyCondition(actorId, statusId);
    });
}

// ── Dialog ────────────────────────────────────────────────────────────────────

function openSpellResistDialog(req: SpellResistRequest): void {
    ensureStyles();

    const targetActor = game.actors?.get(req.targetActorId);
    const targetName  = targetActor?.name ?? "Alvo";
    const halfDmg     = Math.floor(req.damageTotal / 2);

    // ── Seção de teste de resistência ──────────────────────────────────────────
    let resistSection = "";
    if (!req.isHeal && req.resistSkill && req.cd > 0) {
        const passedClass = req.passed ? "srd-pass" : "srd-fail";
        const rollClass   = req.passed ? "srd-roll-pass" : "srd-roll-fail";
        const passedLabel = req.passed ? "PASSOU" : "FALHOU";

        const skillLabel   = SKILL_LABELS[req.resistSkill];
        const outcomeLabel =
            req.resistOutcome === "anula"   ? "anula todo o efeito" :
            req.resistOutcome === "metade"  ? "reduz dano à metade" :
            req.resistOutcome === "parcial" ? "reduz dano à metade e evita condições" :
            "veja texto da magia";

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
            <div class="srd-row">
                <span class="srd-label-sm">SE PASSAR</span>
                <span class="srd-value-lg">${esc(outcomeLabel)}</span>
            </div>
        `;
    } else if (!req.isHeal && req.resistTxt && req.resistTxt !== "") {
        // Tem resistência mas sem skill identificada (veja texto)
        resistSection = `
            <div class="srd-divider"></div>
            <div class="srd-row">
                <span class="srd-label-sm">RESISTÊNCIA</span>
                <span class="srd-value-lg">${esc(req.resistTxt)}</span>
            </div>
        `;
    }

    // ── Seção de dano / cura ───────────────────────────────────────────────────
    const dmgClass    = req.isHeal ? "srd-heal" : "srd-dmg";
    const dmgLabel    = req.isHeal ? "CURA" :
                        req.passed && req.resistOutcome !== "anula" ? `DANO  (metade: ${halfDmg})` :
                        "DANO";

    const valueSection = `
        <div class="srd-divider"></div>
        <div class="srd-damage-display">
            <div class="srd-label-sm">${dmgLabel}</div>
            <div class="srd-damage-total ${dmgClass}">${req.damageTotal}</div>
        </div>
    `;

    // ── Seção de condições ─────────────────────────────────────────────────────
    // Pré-seleciona se o alvo falhou (ou se for uma condição positiva de cura)
    const condDefault = req.isHeal ? true : !req.passed;
    const conditionsSection = req.conditions.length > 0 ? `
        <div class="srd-divider"></div>
        <div class="srd-conditions">
            <div class="srd-label-sm">CONDIÇÕES A APLICAR</div>
            <div class="srd-condition-list">
                ${req.conditions.map((c, i) => `
                    <label class="srd-condition-item">
                        <input type="checkbox"
                               name="cond-${i}"
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

    // ── Botões ─────────────────────────────────────────────────────────────────
    const buttons: Record<string, DialogButtonConfig> = {};

    if (req.isHeal) {
        // Magia de cura
        buttons.heal = {
            icon:  '<i class="fas fa-heart"></i>',
            label: `Curar (${req.damageTotal})`,
            callback: ($html: JQuery) => {
                void applySpellHeal(req.targetActorId, req.damageTotal);
                applyCheckedConditions($html, req.targetActorId);
            },
        };
        buttons.cancel = {
            icon:  '<i class="fas fa-ban"></i>',
            label: "Não Aplicar",
            callback: () => { /* noop */ },
        };
    } else {
        // Magia de dano
        const showFull = !req.resistSkill || !req.passed ||
                         req.resistOutcome === "texto";
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
            buttons.none = {
                icon:  '<i class="fas fa-ban"></i>',
                label: "Não Aplicar",
                callback: () => { /* noop */ },
            };
        }
    }

    // Botão default: reflete o resultado automático mais provável
    let defaultBtn: string;
    if (req.isHeal) {
        defaultBtn = "heal";
    } else if (req.passed) {
        defaultBtn = req.resistOutcome === "anula" ? "none" : "half";
    } else {
        defaultBtn = "full";
    }
    // Garante que o botão default existe
    if (!buttons[defaultBtn]) defaultBtn = Object.keys(buttons)[0] ?? "none";

    new Dialog(
        {
            title:   `${req.isHeal ? "Cura" : "Magia"} — ${targetName}`,
            content,
            buttons,
            default: defaultBtn,
        },
        {
            classes: ["bg3-dialog", "srd-dialog"],
            width:   420,
            id:      `spell-resist-${req.requestId}`,
        },
    ).render(true);
}

// ── Socket ────────────────────────────────────────────────────────────────────

function setupSocket(): void {
    game.socket?.on(`module.${MODULE_ID}`, (raw: unknown) => {
        const data = raw as SpellResistSocketData;
        if (data?.type !== "spell-resist-request") return;
        if (data.targetUserId !== game.user?.id) return;
        openSpellResistDialog(data);
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
    return (game.users?.contents ?? []).find(
        (u) => !u.isGM && u.active && owners.includes(u.id),
    );
}

function findActiveGM(): FoundryUser | undefined {
    return (game.users?.contents ?? []).find((u) => u.isGM && u.active);
}

function getTargetUserId(actor: FoundryActor): string | null {
    const player = findPlayerOwner(actor);
    if (player) return player.id;
    return findActiveGM()?.id ?? null;
}

// ── createChatMessage hook ────────────────────────────────────────────────────

async function processSpellMessage(message: ChatMessage): Promise<void> {
    // Só processa mensagens do próprio usuário
    if (getMsgAuthorId(message) !== game.user?.id) return;

    const itemData = message.getFlag("tormenta20", "itemData") as Record<string, unknown> | undefined;
    if (!itemData) return;

    // Confirma que é magia (tipo arc, div ou uni)
    const tipo = itemData["tipo"] as string | undefined;
    if (!tipo || !(SPELL_TIPOS as readonly string[]).includes(tipo)) return;

    const rolls = message.rolls;
    if (!rolls?.length) return;

    // Ignora se tiver roll de ataque (tratado pelo auto-damage existente)
    const hasAttackRoll = rolls.some(
        (r) => (r.options as Record<string, unknown>)?.["type"] === "attack",
    );
    if (hasAttackRoll) return;

    // Precisa ter um roll de dano (ou cura)
    const damageRoll = rolls.find(
        (r) => (r.options as Record<string, unknown>)?.["type"] === "damage",
    );
    if (!damageRoll) return;

    const isHeal = (damageRoll.formula ?? "").includes("curapv");

    const resistencia = itemData["resistencia"] as { txt?: string } | undefined;
    const resistTxt   = resistencia?.txt?.trim() ?? "";

    // Se não é cura e não tem resistência, não há o que fazer
    if (!isHeal && !resistTxt) return;

    // Parse da resistência
    const { skill: resistSkill, outcome: resistOutcome } = parseResistance(resistTxt);

    // Se não é cura e a resistência foi "none" após parsing, pula
    if (!isHeal && resistOutcome === "none") return;

    const targets = game.user?.targets;
    if (!targets?.size) return;

    const damageTotal   = damageRoll.total ?? 0;
    const damageFormula = damageRoll.formula ?? "";
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
            ui.notifications.warn(
                `Nenhum usuário ativo para receber o efeito de "${spellName}" em ${targetActor.name}.`,
            );
            continue;
        }

        // ── Rola resistência (se aplicável) ───────────────────────────────────
        let resistRollTotal = 0;
        let resistBonus     = 0;
        let resistFormula   = "—";
        let d20Result       = 0;
        let passed          = false;

        if (!isHeal && resistSkill && cd > 0) {
            resistBonus   = computeSkillTotal(targetActor, resistSkill);
            resistFormula = `1d20 + ${resistBonus}`;

            const roll = new Roll(resistFormula);
            await roll.evaluate({ async: true });

            resistRollTotal = roll.total ?? 0;
            // Extrai o resultado do d20 (primeiro dado da expressão)
            const d20Term = roll.dice?.[0];
            d20Result = d20Term?.results?.[0]?.result ?? (resistRollTotal - resistBonus);
            passed = resistRollTotal >= cd;

            // Envia o roll ao chat para os jogadores verem
            await ChatMessage.create({
                content: await roll.render({ flavor: `Resistência — ${SKILL_LABELS[resistSkill]} (${targetActor.name}) vs CD ${cd}` }),
                rolls:   [roll.toJSON()],
                type:    5, // ROLL
                speaker: ChatMessage.getSpeaker({ actor: targetActor }),
            });
        } else if (isHeal) {
            passed = true;
        }

        const payload: SpellResistRequest = {
            type:           "spell-resist-request",
            requestId:      randomID(),
            targetUserId,
            casterUserId,
            targetActorId:  targetActor.id,
            casterName,
            spellName,
            resistTxt,
            resistSkill:    resistSkill ?? null,
            resistOutcome,
            cd,
            resistRollTotal,
            resistBonus,
            resistFormula,
            d20Result,
            damageTotal,
            damageFormula,
            isHeal,
            conditions,
            passed,
        };

        if (targetUserId === game.user?.id) {
            openSpellResistDialog(payload);
        } else {
            game.socket?.emit(`module.${MODULE_ID}`, payload);
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

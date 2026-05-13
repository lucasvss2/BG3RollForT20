import { MODULE_ID } from "@/constants";
import { computeSkillTotal } from "./skills";
import type { HiddenTestFlag, HiddenTestRequest, TestOutcome } from "./types";

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Power bonus extraction ────────────────────────────────────────────────────

interface ActivatableItem {
    id: string;
    name: string;
    pm: number;
    bonusFormula: string;  // e.g. "+9", "+1d4", "" = unknown/complex
    bonusLabel: string;    // e.g. "+9 CAR", "dobrar treino", "?"
}

// Map attribute keys to display labels and regex patterns in Portuguese
const ATTR_BONUS_PATTERNS: Array<{ regex: RegExp; key: string; short: string }> = [
    { regex: /carisma/i,              key: "car", short: "CAR" },
    { regex: /for[çc]a/i,             key: "for", short: "FOR" },
    { regex: /destreza/i,             key: "des", short: "DES" },
    { regex: /sabedoria/i,            key: "sab", short: "SAB" },
    { regex: /intelig[eê]ncia/i,      key: "int", short: "INT" },
    { regex: /constitui[çc][aã]o/i,   key: "con", short: "CON" },
];

function extractPowerBonus(
    item: FoundryItem,
    actor: FoundryActor,
    skillKey: string,
): { formula: string; label: string } {
    const desc = stripHtml((item.system.description as Record<string, string>)?.value ?? "");

    // "somar seu/sua {Atributo}" — e.g. Audácia, Canalização, etc.
    if (/somar.{1,20}(seu|sua)/i.test(desc)) {
        for (const { regex, key, short } of ATTR_BONUS_PATTERNS) {
            if (regex.test(desc)) {
                const val = (actor.system?.atributos as Record<string, { value?: number }>)?.[key]?.value ?? 0;
                const sign = val >= 0 ? "+" : "";
                return { formula: `${sign}${val}`, label: `${sign}${val} ${short}` };
            }
        }
    }

    // "dobrar (seu) bônus de treinamento" — e.g. Especialista
    if (/dobrar.{1,20}treina(mento|do)/i.test(desc)) {
        const pericias = actor.system?.pericias;
        const skill = pericias?.[skillKey];
        const base = skill?.value ?? 0;
        const attrMod = skill?.atributo
            ? ((actor.system?.atributos as Record<string, { value?: number }>)?.[skill.atributo]?.value ?? 0)
            : 0;
        const halfLevel = Math.floor((actor.system?.nivel?.value ?? 0) / 2);
        // training rank = total - attrMod - halfLevel
        const trainingRank = Math.max(0, base - attrMod - halfLevel);
        if (trainingRank > 0) {
            return { formula: `+${trainingRank}`, label: `+${trainingRank} treino×2` };
        }
        return { formula: "", label: "dobrar treino" };
    }

    // Fixed numeric bonus: "+2 no teste" / "bônus de +4"
    const numMatch = desc.match(/b[oô]nus\s+(?:de\s+)?\+(\d+)/i)
                  ?? desc.match(/\+(\d+)\s+(?:ao?|no?)\s+teste/i);
    if (numMatch) {
        return { formula: `+${numMatch[1]}`, label: `+${numMatch[1]}` };
    }

    return { formula: "", label: "?" };
}

function getActivatableItems(actor: FoundryActor, skillKey: string): ActivatableItem[] {
    const items = actor.items?.contents ?? [];
    return items.flatMap((item) => {
        if (item.type !== "poder") return [];
        const ativacao = (item.system.ativacao as Record<string, unknown>) ?? {};
        const custo = (ativacao.custo as number) ?? 0;
        if (custo <= 0) return [];
        const { formula, label } = extractPowerBonus(item, actor, skillKey);
        if (label === "?") return [];
        return [{ id: item.id, name: item.name, pm: custo, bonusFormula: formula, bonusLabel: label }];
    });
}

// ── Chat card HTML ────────────────────────────────────────────────────────────

function buildHiddenTestCardHtml(skillLabel: string, roll: Roll, outcome: TestOutcome): string {
    const total = roll.total ?? 0;
    const formula = roll.formula ?? "1d20";

    const outcomeLabel: Record<TestOutcome, string> = {
        critico:       "SUCESSO CRÍTICO",
        sucesso:       "SUCESSO",
        falha:         "FALHA",
        falha_critica: "FALHA CRÍTICA",
    };
    const outcomeCss: Record<TestOutcome, string> = {
        critico:       "htc-crit",
        sucesso:       "htc-success",
        falha:         "htc-failure",
        falha_critica: "htc-fumble",
    };

    return `
        <div class="aeris-hidden-test-card">
            <div class="htc-header">
                <div class="htc-skill-name">${esc(skillLabel)}</div>
                <div class="htc-subtitle">Teste de Perícia</div>
            </div>
            <div class="htc-divider"></div>
            <div class="htc-body">
                <div class="htc-formula">${esc(formula)}</div>
                <div class="htc-total ${outcomeCss[outcome]}">${total}</div>
                <div class="htc-outcome ${outcomeCss[outcome]}">${outcomeLabel[outcome]}</div>
            </div>
        </div>
    `.trim();
}

// ── Player dialog ─────────────────────────────────────────────────────────────

export function openHiddenTestPlayerDialog(request: HiddenTestRequest): void {
    const actor = game.actors?.get(request.actorId);
    const actorName = actor?.name ?? "Personagem";
    const skillTotal = actor ? computeSkillTotal(actor, request.skillKey) : 0;
    const bonusStr = skillTotal >= 0 ? `+${skillTotal}` : `${skillTotal}`;
    const powers = actor ? getActivatableItems(actor, request.skillKey) : [];

    const powersHtml = powers.length > 0 ? `
        <div class="htg-divider"></div>
        <div class="htg-powers-section">
            <div class="htg-powers-header">
                <span class="htg-label-sm">APLICAR</span>
                <span class="htg-label-sm">PM</span>
                <span class="htg-label-sm">PODER</span>
                <span class="htg-label-sm htg-col-bonus">BÔNUS</span>
            </div>
            ${powers.map((p) => `
            <div class="htg-power-row">
                <input type="checkbox" class="htg-power-check"
                    data-pm="${p.pm}"
                    data-bonus="${esc(p.bonusFormula)}">
                <span class="htg-pm-cost">${p.pm}</span>
                <span class="htg-power-name">${esc(p.name)}</span>
                <span class="htg-power-bonus ${p.bonusFormula ? "htg-bonus-known" : "htg-bonus-unknown"}">${esc(p.bonusLabel)}</span>
            </div>`).join("")}
            <div class="htg-pm-total-row">
                <span class="htg-label-sm">CUSTO DE MANA TOTAL</span>
                <span class="htg-pm-display" id="htg-pm-total">0</span>
            </div>
        </div>` : "";

    const content = `
        <div class="htg-body">
            <div class="htg-request-banner">
                <div class="htg-label-sm">O MESTRE SOLICITA</div>
                <div class="htg-skill-name-lg">${esc(request.skillLabel)}</div>
                <div class="htg-divider"></div>
            </div>
            <div class="htg-target-row">
                <span class="htg-label-sm">PERSONAGEM</span>
                <span class="htg-value-lg">${esc(actorName)}</span>
            </div>
            <div class="form-group">
                <label>BÔNUS DE PERÍCIA</label>
                <span class="htg-bonus-display">${bonusStr}</span>
            </div>
            ${powersHtml}
            <div class="htg-divider"></div>
            <div class="form-group">
                <label>BÔNUS NO TESTE</label>
                <input type="text" name="bonusExtra" value="" placeholder="ex. +1d4 ou -3" />
            </div>
        </div>
    `;

    new Dialog(
        {
            title: "Teste",
            content,
            buttons: {
                roll: {
                    icon: '<i class="fas fa-dice-d20"></i>',
                    label: "Rolar Teste",
                    callback: ($html: JQuery) => {
                        const bonusExtra = (($html.find('[name="bonusExtra"]').val() as string) ?? "").trim();
                        const selected = $html.find(".htg-power-check:checked").toArray().map((el) => ({
                            pm:    parseInt((el as HTMLElement).dataset["pm"]    ?? "0", 10),
                            bonus: (el as HTMLElement).dataset["bonus"] ?? "",
                        }));
                        void executeHiddenTestRoll(request, skillTotal, bonusExtra, selected);
                    },
                },
            },
            default: "roll",
            render: ($html: JQuery) => {
                $html.find(".htg-power-check").on("change", () => {
                    const totalPm = $html.find(".htg-power-check:checked").toArray()
                        .reduce((s, el) => s + parseInt((el as HTMLElement).dataset["pm"] ?? "0", 10), 0);
                    $html.find("#htg-pm-total").text(String(totalPm));
                });
            },
        },
        { classes: ["bg3-dialog"], width: 440, id: "hidden-test-player" },
    ).render(true);
}

// ── Roll execution ────────────────────────────────────────────────────────────

async function executeHiddenTestRoll(
    request: HiddenTestRequest,
    skillTotal: number,
    extraBonus: string,
    selectedPowers: Array<{ pm: number; bonus: string }>,
): Promise<void> {
    const gmBonus = request.gmBonus ?? 0;
    const baseBonus = skillTotal + gmBonus;

    const parts: string[] = ["1d20"];
    if (baseBonus !== 0) parts.push(baseBonus > 0 ? `+ ${baseBonus}` : `- ${Math.abs(baseBonus)}`);

    for (const p of selectedPowers) {
        if (!p.bonus) continue;
        const b = p.bonus.trim();
        parts.push(b.startsWith("+") || b.startsWith("-") ? b : `+ ${b}`);
    }

    if (extraBonus) {
        const b = extraBonus.trim();
        parts.push(b.startsWith("+") || b.startsWith("-") ? b : `+ ${b}`);
    }

    const roll = new Roll(parts.join(" "));
    await roll.evaluate({ async: true });

    // Deduct PM from actor for selected powers
    const totalPm = selectedPowers.reduce((s, p) => s + p.pm, 0);
    if (totalPm > 0) {
        const actor = game.actors?.get(request.actorId);
        if (actor) {
            const currentPm = actor.system?.attributes?.pm?.value ?? 0;
            await actor.update({ "system.attributes.pm.value": Math.max(0, currentPm - totalPm) });
        }
    }

    const nat   = roll.dice[0]?.results?.find((r) => r.active)?.result ?? 0;
    const total = roll.total ?? 0;

    const outcome: TestOutcome =
        nat === 1  ? "falha_critica"
        : nat === 20 ? "critico"
        : total >= request.dc ? "sucesso"
        : "falha";

    const flag: HiddenTestFlag = { outcome, skillLabel: request.skillLabel };

    await ChatMessage.create({
        content: buildHiddenTestCardHtml(request.skillLabel, roll, outcome),
        flavor: `Teste de ${request.skillLabel}`,
        speaker: ChatMessage.getSpeaker({ actor: game.actors?.get(request.actorId) ?? null }),
        rolls: [roll.toJSON()],
        type: 5,
        flags: { [MODULE_ID]: { hiddenTest: flag } },
    });
}

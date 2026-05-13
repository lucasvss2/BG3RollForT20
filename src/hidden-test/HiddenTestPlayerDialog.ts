import { MODULE_ID } from "@/constants";
import { computeSkillTotal } from "./skills";
import type { HiddenTestFlag, HiddenTestRequest, TestOutcome } from "./types";

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Activatable items (poderes with PM cost) ──────────────────────────────────

interface ActivatableItem {
    id: string;
    name: string;
    pm: number;
}

function getActivatableItems(actor: FoundryActor): ActivatableItem[] {
    const items = actor.items?.contents ?? [];
    return items.flatMap((item) => {
        if (item.type !== "poder") return [];
        const ativacao = (item.system.ativacao as Record<string, unknown>) ?? {};
        const custo = (ativacao.custo as number) ?? 0;
        if (custo <= 0) return [];
        return [{ id: item.id, name: item.name, pm: custo }];
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
    const powers = actor ? getActivatableItems(actor) : [];

    const powersHtml = powers.length > 0 ? `
        <div class="htg-divider"></div>
        <div class="htg-powers-section">
            <div class="htg-powers-header">
                <span class="htg-label-sm">APLICAR</span>
                <span class="htg-label-sm">PM</span>
                <span class="htg-label-sm">PODER</span>
            </div>
            ${powers.map((p) => `
            <div class="htg-power-row">
                <input type="checkbox" class="htg-power-check" data-pm="${p.pm}">
                <span class="htg-pm-cost">${p.pm}</span>
                <span class="htg-power-name">${esc(p.name)}</span>
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
                        void executeHiddenTestRoll(request, skillTotal, bonusExtra);
                    },
                },
            },
            default: "roll",
            render: ($html: JQuery) => {
                $html.find(".htg-power-check").on("change", () => {
                    const total = $html
                        .find(".htg-power-check:checked")
                        .toArray()
                        .reduce(
                            (sum, el) => sum + parseInt((el as HTMLElement).dataset["pm"] ?? "0", 10),
                            0,
                        );
                    $html.find("#htg-pm-total").text(String(total));
                });
            },
        },
        { classes: ["bg3-dialog"], width: 420, id: "hidden-test-player" },
    ).render(true);
}

// ── Roll execution ────────────────────────────────────────────────────────────

async function executeHiddenTestRoll(
    request: HiddenTestRequest,
    skillTotal: number,
    extraBonus: string,
): Promise<void> {
    const gmBonus = request.gmBonus ?? 0;
    const baseBonus = skillTotal + gmBonus;

    let formula = baseBonus !== 0 ? `1d20 + ${baseBonus}` : "1d20";
    if (extraBonus) {
        const trimmed = extraBonus.trim();
        formula += (trimmed.startsWith("+") || trimmed.startsWith("-")) ? ` ${trimmed}` : ` + ${trimmed}`;
    }

    const roll = new Roll(formula);
    await roll.evaluate({ async: true });

    const nat = roll.dice[0]?.results?.find((r) => r.active)?.result ?? 0;
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

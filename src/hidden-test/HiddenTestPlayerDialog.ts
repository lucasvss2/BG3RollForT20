import { MODULE_ID } from "@/constants";
import { BG3Overlay } from "@/overlay/BG3Overlay";
import { computeSkillTotal } from "./skills";
import type { HiddenTestFlag, HiddenTestRequest, TestOutcome } from "./types";

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHiddenTestCardHtml(
    skillLabel: string,
    roll: Roll,
    outcome: TestOutcome,
): string {
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
                <div class="htc-subtitle">Teste Secreto</div>
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

export function openHiddenTestPlayerDialog(request: HiddenTestRequest): void {
    const actor = game.actors?.get(request.actorId);
    const actorName = actor?.name ?? "Personagem";

    const skillTotal = actor ? computeSkillTotal(actor, request.skillKey) : 0;

    const bonusStr = skillTotal >= 0 ? `+${skillTotal}` : `${skillTotal}`;
    const formula = skillTotal !== 0 ? `1d20 + ${skillTotal}` : "1d20";

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
            <div class="htg-roll-hint">A dificuldade é secreta — role e descubra!</div>
        </div>
    `;

    new Dialog(
        {
            title: "Teste Secreto",
            content,
            buttons: {
                roll: {
                    icon: '<i class="fas fa-dice-d20"></i>',
                    label: "Rolar Teste",
                    callback: () => {
                        void executeHiddenTestRoll(request, skillTotal, formula);
                    },
                },
            },
            default: "roll",
        },
        { classes: ["bg3-dialog"], width: 400, id: "hidden-test-player" },
    ).render(true);
}

async function executeHiddenTestRoll(
    request: HiddenTestRequest,
    skillTotal: number,
    formula: string,
): Promise<void> {
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

    // Create public chat message — createChatMessage hook fires for all clients
    await ChatMessage.create({
        content: buildHiddenTestCardHtml(request.skillLabel, roll, outcome),
        flavor: `Teste de ${request.skillLabel}`,
        speaker: ChatMessage.getSpeaker({ actor: game.actors?.get(request.actorId) ?? null }),
        rolls: [roll.toJSON()],
        type: 5,
        flags: { [MODULE_ID]: { hiddenTest: flag } },
    });

    void skillTotal; // used in formula
}

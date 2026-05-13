import { MODULE_ID } from "@/constants";
import { T20_SKILLS } from "./skills";
import type { HiddenTestRequest } from "./types";

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function findTokenOwner(actor: FoundryActor): FoundryUser | undefined {
    const owners = Object.entries(actor.ownership ?? {})
        .filter(([, level]) => (level as number) >= 3)
        .map(([userId]) => userId);

    return (game.users?.contents ?? []).find(
        (u) => !u.isGM && u.active && owners.includes(u.id),
    );
}

export function openHiddenTestGMDialog(): void {
    if (!game.user?.isGM) return;

    const targets = game.user.targets;
    if (!targets?.size) {
        ui.notifications.warn("Selecione um token como alvo primeiro (tecla T).");
        return;
    }

    const token = [...targets][0];
    const actor = token.actor;
    if (!actor) {
        ui.notifications.warn("O token alvo não tem ator associado.");
        return;
    }

    const targetUser = findTokenOwner(actor);
    if (!targetUser) {
        ui.notifications.warn("Nenhum jogador ativo controla este personagem.");
        return;
    }

    const skillOptions = T20_SKILLS.map(
        (s) => `<option value="${esc(s.key)}|${esc(s.label)}">${esc(s.label)}</option>`,
    ).join("");

    const content = `
        <div class="htg-body">
            <div class="htg-target-row">
                <span class="htg-label-sm">PERSONAGEM</span>
                <span class="htg-value-lg">${esc(actor.name)}</span>
                <span class="htg-player-tag">${esc(targetUser.name)}</span>
            </div>
            <div class="htg-divider"></div>
            <div class="form-group">
                <label>PERÍCIA</label>
                <select name="skill" autofocus>${skillOptions}</select>
            </div>
            <div class="form-group">
                <label>DIFICULDADE</label>
                <input type="number" name="dc" value="15" min="1" max="99" />
            </div>
        </div>
    `;

    new Dialog(
        {
            title: "Solicitar Teste Secreto",
            content,
            buttons: {
                send: {
                    icon: '<i class="fas fa-dice-d20"></i>',
                    label: "Solicitar",
                    callback: ($html: JQuery) => {
                        const raw = ($html.find('[name="skill"]').val() as string) ?? "";
                        const [skillKey, ...rest] = raw.split("|");
                        const skillLabel = rest.join("|");
                        const dc = parseInt($html.find('[name="dc"]').val() as string, 10);

                        if (!skillKey || !skillLabel || isNaN(dc) || dc < 1) return;

                        const payload: HiddenTestRequest = {
                            type: "hidden-test-request",
                            requestId: randomID(),
                            targetUserId: targetUser.id,
                            actorId: actor.id,
                            skillKey,
                            skillLabel,
                            dc,
                        };

                        game.socket?.emit(`module.${MODULE_ID}`, payload);
                        ui.notifications.info(
                            `Teste secreto de ${skillLabel} enviado para ${targetUser.name}.`,
                        );
                    },
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancelar",
                },
            },
            default: "send",
        },
        { classes: ["bg3-dialog"], width: 420, id: "hidden-test-gm" },
    ).render(true);
}

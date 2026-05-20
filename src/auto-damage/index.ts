import type { AutoDamageRequest, AttackRerollRequest, AttackMissNotify } from "./types";
import { getSocket, onSocketReady } from "@/socket";
import {
    getAuraInvencibilidadeContextForActor,
    markAuraInvencibilidadeUsed,
} from "@/area-spells/aura-sagrada";
import { getMsgAuthorId } from "@/spell-resistance/index";

// ── socketlib handler names ──────────────────────────────────────────────────

const SOCKET_DAMAGE_REQUEST = "auto-damage/request";
const SOCKET_REROLL_REQUEST = "auto-damage/reroll-request";
const SOCKET_MISS_NOTIFY    = "auto-damage/miss-notify";

// ── CSS ───────────────────────────────────────────────────────────────────────

const AUTO_DAMAGE_STYLES_ID = "bg3-t20-auto-damage-styles";

const AUTO_DAMAGE_STYLES = `
/* ── Auto-damage prompt dialog ──────────────────────────────────────────── */
/* MIGRADO PARA TOKENS: cores via var(--bg3-*) — ver src/theme/tokens.ts. */

.aad-body {
    padding: 4px 0 2px;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
}
.aad-banner {
    padding: 10px 16px 8px;
    text-align: center;
}
.aad-label-sm {
    color: var(--bg3-accent-muted);
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    flex: 0 0 auto;
}
.aad-target-name {
    color: var(--bg3-accent);
    font-size: clamp(1.3rem, 3vw, 1.8rem);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-shadow: 0 0 18px rgba(var(--bg3-accent-rgb), 0.55);
    text-transform: uppercase;
    margin: 4px 0 2px;
}
.aad-divider {
    background: linear-gradient(to right, transparent, var(--bg3-tint-bold), transparent);
    height: 1px;
    margin: 4px 16px;
}
.aad-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 5px 16px;
    flex-wrap: wrap;
}
.aad-value-lg {
    color: var(--bg3-accent-bright);
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    flex: 1 1 auto;
    text-align: right;
}
.aad-attack-val {
    color: var(--bg3-color-success);
    font-size: 1.1rem;
    font-weight: 900;
    letter-spacing: 0.04em;
}
.aad-def-val {
    color: var(--bg3-accent);
    font-size: 1.05rem;
    font-weight: 700;
}
.aad-damage-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 16px 4px;
    gap: 2px;
}
.aad-damage-total {
    color: var(--bg3-color-danger);
    font-size: 3.4rem;
    font-weight: 900;
    line-height: 1;
    text-shadow: 0 0 30px rgba(204, 68, 68, 0.6);
}
.aad-pm-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 16px 8px;
}
.aad-pm-input {
    width: 70px;
    text-align: center;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid var(--bg3-border-strong);
    border-radius: 3px;
    color: var(--bg3-accent-bright);
    font-family: "Modesto Condensed", monospace;
    font-size: 1rem;
    padding: 2px 6px;
    margin-left: auto;
}
.aad-pm-input:focus {
    outline: none;
    border-color: rgba(var(--bg3-accent-rgb), 0.7);
}

/* ── Reroll chat card header ───────────────────────────────────────────── */

.bg3-reroll-header {
    color: var(--bg3-accent);
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    text-shadow: 0 0 12px var(--bg3-tint-bold);
    text-align: center;
    padding: 4px 8px 6px;
    border-bottom: 1px solid var(--bg3-border-strong);
    margin-bottom: 4px;
}

/* ── Dialog button layout ──────────────────────────────────────────────── */

.aad-dialog .dialog-buttons,
.aad-dialog footer.form-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* ── Aura de Invencibilidade badge ─────────────────────────────────────── */

.aad-invenc-badge {
    margin: 6px 12px 4px;
    padding: 8px 12px;
    border-left: 3px solid var(--bg3-accent, #c8a96e);
    background: linear-gradient(135deg,
        rgba(200, 169, 110, 0.18),
        rgba(106, 78, 24, 0.12));
    color: var(--bg3-text-primary, #f0ebe0);
    font-size: 0.82rem;
    line-height: 1.35;
    border-radius: 0 4px 4px 0;
}
.aad-invenc-badge b {
    color: var(--bg3-accent-bright, #ffe89a);
}
.aad-dialog button[data-button="invenc"] {
    background: linear-gradient(180deg,
        rgba(200, 169, 110, 0.28),
        rgba(106, 78, 24, 0.16));
    border-color: var(--bg3-accent, #c8a96e) !important;
    color: var(--bg3-accent-bright, #ffe89a) !important;
    font-weight: 700;
}
.aad-dialog button[data-button="invenc"]:hover {
    background: linear-gradient(180deg,
        rgba(200, 169, 110, 0.42),
        rgba(106, 78, 24, 0.22));
    box-shadow: 0 0 12px rgba(200, 169, 110, 0.4);
}
`;

function ensureStyles(): void {
    if (!document.getElementById(AUTO_DAMAGE_STYLES_ID)) {
        const el = document.createElement("style");
        el.id = AUTO_DAMAGE_STYLES_ID;
        el.textContent = AUTO_DAMAGE_STYLES;
        document.head.appendChild(el);
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    const gm = findActiveGM();
    return gm?.id ?? null;
}

function getDef(actor: FoundryActor): number {
    return actor.system?.attributes?.defesa?.value ?? 10;
}

function readPmInput($html: JQuery): number {
    return parseInt($html.find('[name="pmCost"]').val() as string, 10) || 0;
}

function readRdInput($html: JQuery): number {
    return Math.max(0, parseInt($html.find('[name="rd"]').val() as string, 10) || 0);
}

/** Aplica RD ao dano, garantindo mínimo 0 (nunca negativo). */
function applyRd(amount: number, rd: number): number {
    return Math.max(0, amount - rd);
}

// ── Token actor resolution ────────────────────────────────────────────────────
//
// game.actors.get(id) returns the PROTOTYPE (pv = 0 base value).
// For unlinked NPC tokens the real per-token HP lives in the canvas Token.
// canvas.tokens.get(tokenId).actor is the live synthetic actor whose
// update() proxies through the TokenDocument — the correct target.

function resolveActor(targetTokenId: string, targetActorId: string): FoundryActor | null {
    type CanvasTokenLayer = { get(id: string): { actor: FoundryActor | null } | undefined };
    const layer = (canvas as unknown as { tokens?: CanvasTokenLayer }).tokens;
    const canvasActor = layer?.get(targetTokenId)?.actor ?? null;
    return canvasActor ?? game.actors?.get(targetActorId) ?? null;
}

// ── Damage & PM application ───────────────────────────────────────────────────

async function applyDamage(targetTokenId: string, targetActorId: string, amount: number, pmCost: number): Promise<void> {
    const actor = resolveActor(targetTokenId, targetActorId);
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

    const update: Record<string, unknown> = {
        "system.attributes.pv.temp":  newTemp,
        "system.attributes.pv.value": newHp,
    };

    if (pmCost > 0) {
        const currentPm = actor.system?.attributes?.pm?.value ?? 0;
        update["system.attributes.pm.value"] = Math.max(0, currentPm - pmCost);
    }

    await actor.update(update);
}

// ── Reroll handling (runs on attacker's client) ───────────────────────────────

async function buildRerollContent(rollLabel: string, attackRoll: Roll, damageRoll?: Roll): Promise<string> {
    const attackHtml = await attackRoll.render({ flavor: "Ataque" });
    const damageHtml = damageRoll ? await damageRoll.render({ flavor: "Dano" }) : "";
    return `<div class="bg3-reroll-header">↺ Rerolagem — ${esc(rollLabel)}</div>${attackHtml}${damageHtml}`;
}

async function handleReroll(req: AttackRerollRequest): Promise<void> {
    const speaker = { alias: req.attackerName };

    const attackRoll = new Roll(req.attackFormula);
    await attackRoll.evaluate({ async: true });
    const newAttackTotal = attackRoll.total ?? 0;

    // Missed on reroll — post attack roll to chat, notify both sides
    if (newAttackTotal < req.targetDef) {
        await ChatMessage.create({
            content: await buildRerollContent(req.rollLabel, attackRoll),
            rolls:   [attackRoll.toJSON()],
            type:    5,
            speaker,
        });

        const missPayload: AttackMissNotify = {
            type:         "attack-miss-notify",
            targetUserId: req.targetUserId,
            attackerName: req.attackerName,
            attackTotal:  newAttackTotal,
            targetDef:    req.targetDef,
        };

        if (req.targetUserId === game.user?.id) {
            ui.notifications.info(
                `Ataque de ${req.attackerName} errou no reroll! (${newAttackTotal} vs DEF ${req.targetDef})`,
            );
        } else {
            void getSocket()?.executeAsUser(
                SOCKET_MISS_NOTIFY,
                req.targetUserId,
                missPayload,
            );
        }
        return;
    }

    // Still hits — reroll damage, post both rolls to chat, send new prompt
    const damageRoll = new Roll(req.damageFormula);
    await damageRoll.evaluate({ async: true });

    await ChatMessage.create({
        content: await buildRerollContent(req.rollLabel, attackRoll, damageRoll),
        rolls:   [attackRoll.toJSON(), damageRoll.toJSON()],
        type:    5,
        speaker,
    });

    const newPayload: AutoDamageRequest = {
        type:           "auto-damage-request",
        requestId:      randomID(),
        targetUserId:   req.targetUserId,
        attackerUserId: game.user?.id ?? "",
        targetActorId:  req.targetActorId,
        targetTokenId:  req.targetTokenId,
        attackerName:   req.attackerName,
        rollLabel:      req.rollLabel,
        attackTotal:    newAttackTotal,
        targetDef:      req.targetDef,
        damageTotal:    damageRoll.total ?? 0,
        attackFormula:  req.attackFormula,
        damageFormula:  req.damageFormula,
    };

    if (req.targetUserId === game.user?.id) {
        openDamagePrompt(newPayload);
    } else {
        void getSocket()?.executeAsUser(
            SOCKET_DAMAGE_REQUEST,
            req.targetUserId,
            newPayload,
        );
    }
}

// ── Damage prompt dialog ──────────────────────────────────────────────────────

function openDamagePrompt(req: AutoDamageRequest): void {
    ensureStyles();

    const targetActor = resolveActor(req.targetTokenId, req.targetActorId);
    const targetName  = targetActor?.name ?? "Alvo";
    const halfDmg     = Math.floor(req.damageTotal / 2);

    // Aura de Invencibilidade — quando o alvo está dentro de uma aura cujo
    // caster tem o aprimoramento E ainda não usou nesta cena, oferecemos um
    // botão extra que ignora 100% do dano (e do RD) e marca o uso.
    const invencContext = getAuraInvencibilidadeContextForActor(req.targetActorId, req.targetTokenId);
    const hasInvenc     = invencContext.length > 0;
    const invencCasters = invencContext.map(c => c.casterName).join(" + ");

    const invencBadgeHtml = hasInvenc
        ? `<div class="aad-invenc-badge">
                <b>Aura de Invencibilidade</b> disponível — <b>${esc(invencCasters)}</b> permite
                ignorar este dano (primeira vez na cena).
            </div>`
        : "";

    const content = `
        <div class="aad-body">
            <div class="aad-banner">
                <div class="aad-label-sm">ALVO ATINGIDO</div>
                <div class="aad-target-name">${esc(targetName)}</div>
            </div>
            <div class="aad-divider"></div>
            <div class="aad-row">
                <span class="aad-label-sm">ATACANTE</span>
                <span class="aad-value-lg">${esc(req.attackerName)}</span>
            </div>
            <div class="aad-row">
                <span class="aad-label-sm">ATAQUE</span>
                <span class="aad-attack-val">${req.attackTotal}</span>
                <span class="aad-label-sm">vs DEF</span>
                <span class="aad-def-val">${req.targetDef}</span>
            </div>
            <div class="aad-divider"></div>
            <div class="aad-damage-display">
                <div class="aad-label-sm">DANO</div>
                <div class="aad-damage-total">${req.damageTotal}</div>
            </div>
            ${invencBadgeHtml}
            <div class="aad-pm-row">
                <span class="aad-label-sm">RD</span>
                <input type="number" name="rd" value="0" min="0" max="999" class="aad-pm-input" />
            </div>
            <div class="aad-divider"></div>
            <div class="aad-pm-row">
                <span class="aad-label-sm">CUSTO DE MANA (PM)</span>
                <input type="number" name="pmCost" value="0" min="0" max="999" class="aad-pm-input" />
            </div>
        </div>
    `;

    type DialogButton = {
        icon: string;
        label: string;
        callback: ($html: JQuery) => void;
    };
    const buttons: Record<string, DialogButton> = {
        full: {
            icon:  '<i class="fas fa-sword"></i>',
            label: `Aplicar Integral (${req.damageTotal})`,
            callback: ($html: JQuery) => {
                const finalDmg = applyRd(req.damageTotal, readRdInput($html));
                void applyDamage(req.targetTokenId, req.targetActorId, finalDmg, readPmInput($html));
            },
        },
        half: {
            icon:  '<i class="fas fa-shield-halved"></i>',
            label: `Aplicar Metade (${halfDmg})`,
            callback: ($html: JQuery) => {
                const finalDmg = applyRd(halfDmg, readRdInput($html));
                void applyDamage(req.targetTokenId, req.targetActorId, finalDmg, readPmInput($html));
            },
        },
        none: {
            icon:  '<i class="fas fa-ban"></i>',
            label: "Não Aplicar",
            callback: ($html: JQuery) => {
                const pm = readPmInput($html);
                if (pm > 0) void applyDamage(req.targetTokenId, req.targetActorId, 0, pm);
            },
        },
    };

    if (hasInvenc) {
        buttons["invenc"] = {
            icon:  '<i class="fas fa-shield-heart"></i>',
            label: `Ignorar (Aura de Invencibilidade)`,
            callback: ($html: JQuery) => {
                const pm = readPmInput($html);
                // Marca o uso + posta chat card (ignora antes de qualquer RD/PM)
                void markAuraInvencibilidadeUsed({
                    actorId:       req.targetActorId,
                    tokenId:       req.targetTokenId,
                    casterName:    invencCasters,
                    targetName,
                    damageIgnored: req.damageTotal,
                });
                // PM ainda é debitado se o usuário tiver colocado algo
                if (pm > 0) void applyDamage(req.targetTokenId, req.targetActorId, 0, pm);
            },
        };
    }

    buttons["reroll"] = {
        icon:  '<i class="fas fa-dice-d20"></i>',
        label: "Forçar Rerolar Ataque",
        callback: () => {
            const rerollReq: AttackRerollRequest = {
                type:           "attack-reroll-request",
                requestId:      req.requestId,
                attackerUserId: req.attackerUserId,
                targetUserId:   req.targetUserId,
                targetActorId:  req.targetActorId,
                targetTokenId:  req.targetTokenId,
                attackFormula:  req.attackFormula,
                damageFormula:  req.damageFormula,
                attackerName:   req.attackerName,
                rollLabel:      req.rollLabel,
                targetDef:      req.targetDef,
            };

            if (req.attackerUserId === game.user?.id) {
                void handleReroll(rerollReq);
            } else {
                void getSocket()?.executeAsUser(
                    SOCKET_REROLL_REQUEST,
                    req.attackerUserId,
                    rerollReq,
                );
            }
        },
    };

    new Dialog(
        {
            title: `Dano — ${targetName}`,
            content,
            buttons,
            default: "full",
            render: ($html: JQuery) => {
                const $rd     = $html.find('[name="rd"]');
                const $dialog = $html.closest(".app, .dialog, dialog");
                const $full   = $dialog.find('button[data-button="full"]');
                const $half   = $dialog.find('button[data-button="half"]');

                const refresh = (): void => {
                    const rd       = readRdInput($html);
                    const fullDmg  = applyRd(req.damageTotal, rd);
                    const halfFinal = applyRd(halfDmg, rd);
                    $full.html(`<i class="fas fa-sword"></i> Aplicar Integral (${fullDmg})`);
                    $half.html(`<i class="fas fa-shield-halved"></i> Aplicar Metade (${halfFinal})`);
                };

                $rd.on("input", refresh);
            },
        },
        {
            classes: ["bg3-dialog", "aad-dialog"],
            width:   380,
            id:      `auto-damage-${req.requestId}`,
        },
    ).render(true);
}

// ── Socket handler ────────────────────────────────────────────────────────────

function setupSocket(): void {
    onSocketReady((socket) => {
        socket.register(SOCKET_DAMAGE_REQUEST, (...args: unknown[]) => {
            openDamagePrompt(args[0] as AutoDamageRequest);
        });
        socket.register(SOCKET_REROLL_REQUEST, (...args: unknown[]) => {
            void handleReroll(args[0] as AttackRerollRequest);
        });
        socket.register(SOCKET_MISS_NOTIFY, (...args: unknown[]) => {
            const data = args[0] as AttackMissNotify;
            ui.notifications.info(
                `Ataque de ${data.attackerName} errou no reroll! (${data.attackTotal} vs DEF ${data.targetDef})`,
            );
        });
    });
}

// ── createChatMessage hook ────────────────────────────────────────────────────

function setupCreateChatHook(): void {
    Hooks.on("createChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;

        // Require attack + damage rolls — sufficient to identify a weapon attack.
        // We intentionally do NOT check itemData here: for weapon attacks in T20 v13
        // the itemData flag may be null or empty even for valid attack messages.
        const rolls = message.rolls;
        if (!rolls?.length) return;

        const attackRoll = rolls.find((r) => (r.options as Record<string, unknown>)?.["type"] === "attack");
        const damageRoll = rolls.find((r) => (r.options as Record<string, unknown>)?.["type"] === "damage");
        if (!attackRoll || !damageRoll) return;

        const attackTotal   = attackRoll.total ?? 0;
        const damageTotal   = damageRoll.total ?? 0;
        const attackFormula = attackRoll.formula ?? "1d20";
        const damageFormula = damageRoll.formula ?? "";
        const attackerName  = message.speaker?.alias ?? "Atacante";
        const rollLabel     = message.flavor || "Ataque";

        // ── Apenas o autor da mensagem processa (usa os targets de quem lançou) ──
        // Garante que o GM com T em algum token não interfere no roll do jogador.
        if (getMsgAuthorId(message) !== game.user?.id) return;

        const targets = game.user?.targets;
        if (!targets?.size) return;

        const attackerUserId = game.user?.id ?? "";

        for (const token of targets) {
            const targetActor = token.actor;
            if (!targetActor) continue;

            const targetDef = getDef(targetActor);
            if (attackTotal < targetDef) {
                ui.notifications.info(
                    `${attackerName} errou ${targetActor.name}! (${attackTotal} vs DEF ${targetDef})`,
                );
                continue;
            }

            const targetUserId = getTargetUserId(targetActor);
            if (!targetUserId) {
                ui.notifications.warn(
                    `Nenhum usuário ativo para receber o dano de ${targetActor.name}.`,
                );
                continue;
            }

            const payload: AutoDamageRequest = {
                type:          "auto-damage-request",
                requestId:     randomID(),
                targetUserId,
                attackerUserId,
                targetActorId: targetActor.id,
                targetTokenId: token.id,
                attackerName,
                rollLabel,
                attackTotal,
                targetDef,
                damageTotal,
                attackFormula,
                damageFormula,
            };

            if (targetUserId === game.user?.id) {
                openDamagePrompt(payload);
            } else {
                void getSocket()?.executeAsUser(
                    SOCKET_DAMAGE_REQUEST,
                    targetUserId,
                    payload,
                );
            }
        }
    });
}

// ── Public entry ──────────────────────────────────────────────────────────────

export function setupAutoDamage(): void {
    ensureStyles();
    setupSocket();
    setupCreateChatHook();
}

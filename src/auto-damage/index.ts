import { MODULE_ID } from "@/constants";
import type { AutoDamageRequest, AttackRerollRequest, AttackMissNotify, AutoDamageSocketData } from "./types";

// ── CSS ───────────────────────────────────────────────────────────────────────

const AUTO_DAMAGE_STYLES_ID = "bg3-t20-auto-damage-styles";

const AUTO_DAMAGE_STYLES = `
/* ── Auto-damage prompt dialog ─────────────────────────────────────────── */

.aad-body {
    padding: 4px 0 2px;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
}
.aad-banner {
    padding: 10px 16px 8px;
    text-align: center;
}
.aad-label-sm {
    color: #8a7450;
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    flex: 0 0 auto;
}
.aad-target-name {
    color: #c8a96e;
    font-size: clamp(1.3rem, 3vw, 1.8rem);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-shadow: 0 0 18px rgba(200,169,110,0.55);
    text-transform: uppercase;
    margin: 4px 0 2px;
}
.aad-divider {
    background: linear-gradient(to right, transparent, rgba(200,169,110,0.45), transparent);
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
    color: #e8d8a8;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    flex: 1 1 auto;
    text-align: right;
}
.aad-attack-val {
    color: #6ecf7a;
    font-size: 1.1rem;
    font-weight: 900;
    letter-spacing: 0.04em;
}
.aad-def-val {
    color: #c8a96e;
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
    color: #cc4444;
    font-size: 3.4rem;
    font-weight: 900;
    line-height: 1;
    text-shadow: 0 0 30px rgba(204,68,68,0.6);
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
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(200,169,110,0.35);
    border-radius: 3px;
    color: #e8d8a8;
    font-family: "Modesto Condensed", monospace;
    font-size: 1rem;
    padding: 2px 6px;
    margin-left: auto;
}
.aad-pm-input:focus {
    outline: none;
    border-color: rgba(200,169,110,0.7);
}

/* ── Reroll chat card header ───────────────────────────────────────────── */

.bg3-reroll-header {
    color: #c8a96e;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    text-shadow: 0 0 12px rgba(200,169,110,0.45);
    text-align: center;
    padding: 4px 8px 6px;
    border-bottom: 1px solid rgba(200,169,110,0.35);
    margin-bottom: 4px;
}

/* ── Dialog button layout ──────────────────────────────────────────────── */

.aad-dialog .dialog-buttons,
.aad-dialog footer.form-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
            game.socket?.emit(`module.${MODULE_ID}`, missPayload);
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
        game.socket?.emit(`module.${MODULE_ID}`, newPayload);
    }
}

// ── Damage prompt dialog ──────────────────────────────────────────────────────

function openDamagePrompt(req: AutoDamageRequest): void {
    ensureStyles();

    const targetActor = resolveActor(req.targetTokenId, req.targetActorId);
    const targetName  = targetActor?.name ?? "Alvo";
    const halfDmg     = Math.floor(req.damageTotal / 2);

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

    new Dialog(
        {
            title: `Dano — ${targetName}`,
            content,
            buttons: {
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
                reroll: {
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
                            game.socket?.emit(`module.${MODULE_ID}`, rerollReq);
                        }
                    },
                },
            },
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
    game.socket?.on(`module.${MODULE_ID}`, (raw: unknown) => {
        const data = raw as AutoDamageSocketData;

        if (data?.type === "auto-damage-request") {
            if (data.targetUserId !== game.user?.id) return;
            openDamagePrompt(data);
            return;
        }

        if (data?.type === "attack-reroll-request") {
            if (data.attackerUserId !== game.user?.id) return;
            void handleReroll(data);
            return;
        }

        if (data?.type === "attack-miss-notify") {
            if (data.targetUserId !== game.user?.id) return;
            ui.notifications.info(
                `Ataque de ${data.attackerName} errou no reroll! (${data.attackTotal} vs DEF ${data.targetDef})`,
            );
        }
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

        // ── GM path ───────────────────────────────────────────────────────────
        // If the current user is a GM with T-targeted tokens, handle damage
        // directly — regardless of who authored the attack message.
        // This covers the common case where the GM marks enemies as targets
        // while a player (or another GM) rolls the attack.
        if (game.user?.isGM) {
            const gmTargets = game.user.targets;
            if (gmTargets?.size) {
                for (const token of gmTargets) {
                    const targetActor = token.actor;
                    if (!targetActor) continue;

                    const targetDef = getDef(targetActor);

                    if (attackTotal < targetDef) {
                        ui.notifications.info(
                            `${attackerName} errou ${targetActor.name}! (${attackTotal} vs DEF ${targetDef})`,
                        );
                        continue;
                    }

                    const payload: AutoDamageRequest = {
                        type:          "auto-damage-request",
                        requestId:     randomID(),
                        targetUserId:  game.user.id,   // open directly on this GM's client
                        attackerUserId: getMsgAuthorId(message),
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
                    openDamagePrompt(payload);
                }
                return; // GM handled it — skip player path below
            }
        }

        // ── Player/author path ────────────────────────────────────────────────
        // When the GM has no T-targets, fall back to the original behaviour:
        // only the message author triggers this path and sends the prompt via
        // socket to whoever owns the target (or to the active GM for NPCs).
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
                game.socket?.emit(`module.${MODULE_ID}`, payload);
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

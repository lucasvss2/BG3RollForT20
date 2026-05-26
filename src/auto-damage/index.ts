import type { AutoDamageRequest, AttackRerollRequest, AttackMissNotify } from "./types";
import { getSocket, onSocketReady } from "@/socket";
import {
    getAuraInvencibilidadeContextForActor,
    markAuraInvencibilidadeUsed,
} from "@/area-spells/aura-sagrada";
import { getMsgAuthorId } from "@/spell-resistance/index";
import AUTO_DAMAGE_STYLES from "./auto-damage.css?inline";

// ── socketlib handler names ──────────────────────────────────────────────────

const SOCKET_DAMAGE_REQUEST = "auto-damage/request";
const SOCKET_REROLL_REQUEST = "auto-damage/reroll-request";
const SOCKET_MISS_NOTIFY    = "auto-damage/miss-notify";

// ── CSS ───────────────────────────────────────────────────────────────────────

const AUTO_DAMAGE_STYLES_ID = "bg3-t20-auto-damage-styles";

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

function readPmInput(root: HTMLElement): number {
    return parseInt(root.querySelector<HTMLInputElement>('[name="pmCost"]')?.value ?? "", 10) || 0;
}

function readRdInput(root: HTMLElement): number {
    return Math.max(0, parseInt(root.querySelector<HTMLInputElement>('[name="rd"]')?.value ?? "", 10) || 0);
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

    const buttons: foundry.applications.api.DialogV2Button[] = [
        {
            type:    "submit",
            action:  "full",
            label:   `Aplicar Integral (${req.damageTotal})`,
            icon:    "fas fa-sword",
            default: true,
            callback: (_event, _button, dialog) => {
                const root     = dialog.element;
                const finalDmg = applyRd(req.damageTotal, readRdInput(root));
                void applyDamage(req.targetTokenId, req.targetActorId, finalDmg, readPmInput(root));
            },
        },
        {
            type:   "submit",
            action: "half",
            label:  `Aplicar Metade (${halfDmg})`,
            icon:   "fas fa-shield-halved",
            callback: (_event, _button, dialog) => {
                const root     = dialog.element;
                const finalDmg = applyRd(halfDmg, readRdInput(root));
                void applyDamage(req.targetTokenId, req.targetActorId, finalDmg, readPmInput(root));
            },
        },
        {
            type:   "submit",
            action: "none",
            label:  "Não Aplicar",
            icon:   "fas fa-ban",
            callback: (_event, _button, dialog) => {
                const root = dialog.element;
                const pm   = readPmInput(root);
                if (pm > 0) void applyDamage(req.targetTokenId, req.targetActorId, 0, pm);
            },
        },
    ];

    if (hasInvenc) {
        buttons.push({
            type:   "submit",
            action: "invenc",
            label:  "Ignorar (Aura de Invencibilidade)",
            icon:   "fas fa-shield-heart",
            callback: (_event, _button, dialog) => {
                const root = dialog.element;
                const pm   = readPmInput(root);
                void markAuraInvencibilidadeUsed({
                    actorId:       req.targetActorId,
                    tokenId:       req.targetTokenId,
                    casterName:    invencCasters,
                    targetName,
                    damageIgnored: req.damageTotal,
                });
                if (pm > 0) void applyDamage(req.targetTokenId, req.targetActorId, 0, pm);
            },
        });
    }

    buttons.push({
        type:   "submit",
        action: "reroll",
        label:  "Forçar Rerolar Ataque",
        icon:   "fas fa-dice-d20",
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
                void getSocket()?.executeAsUser(SOCKET_REROLL_REQUEST, req.attackerUserId, rerollReq);
            }
        },
    });

    void foundry.applications.api.DialogV2.wait({
        id:      `auto-damage-${req.requestId}`,
        classes: ["bg3-dialog", "aad-dialog"],
        window:  { title: `Dano — ${targetName}` },
        position: { width: 380 },
        content,
        buttons,
        render: (_event, dialog) => {
            const root    = dialog.element;
            const rdInput = root.querySelector<HTMLInputElement>('[name="rd"]');
            const fullBtn = root.querySelector<HTMLButtonElement>('button[data-action="full"]');
            const halfBtn = root.querySelector<HTMLButtonElement>('button[data-action="half"]');

            const refresh = (): void => {
                const rd        = readRdInput(root);
                const fullDmg   = applyRd(req.damageTotal, rd);
                const halfFinal = applyRd(halfDmg, rd);
                if (fullBtn) fullBtn.innerHTML = `<i class="fas fa-sword"></i> Aplicar Integral (${fullDmg})`;
                if (halfBtn) halfBtn.innerHTML = `<i class="fas fa-shield-halved"></i> Aplicar Metade (${halfFinal})`;
            };

            rdInput?.addEventListener("input", refresh);
        },
        rejectClose: false,
    });
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
        // roll.formula returns cached _formula (pre-crit value) — T20's alter() on
        // terms[0] modifies the Die's .number but doesn't update _formula.
        // Reconstruct from terms so critical multiplier (e.g. 4d6→20d6) is preserved.
        const attackFormula = attackRoll.terms.map((t) => t.expression).join(" ").trim()
            || attackRoll.formula || "1d20";
        const damageFormula = damageRoll.terms.map((t) => t.expression).join(" ").trim()
            || damageRoll.formula || "";
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

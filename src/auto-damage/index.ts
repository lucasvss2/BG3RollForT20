import { MODULE_ID } from "@/constants";
import type { AutoDamageRequest, AutoDamageSocketData, DamageRerollRequest } from "./types";

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

// ── Damage & PM application ───────────────────────────────────────────────────

async function applyDamage(targetActorId: string, amount: number, pmCost: number): Promise<void> {
    const actor = game.actors?.get(targetActorId);
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

async function handleReroll(req: DamageRerollRequest): Promise<void> {
    ui.notifications.info(`Relançando dano — ${req.rollLabel}…`);

    const roll = new Roll(req.damageFormula);
    await roll.evaluate({ async: true });

    const newPayload: AutoDamageRequest = {
        type:          "auto-damage-request",
        requestId:     randomID(),
        targetUserId:  req.targetUserId,
        attackerUserId: game.user?.id ?? "",
        targetActorId: req.targetActorId,
        attackerName:  req.attackerName,
        rollLabel:     req.rollLabel,
        attackTotal:   req.attackTotal,
        targetDef:     req.targetDef,
        damageTotal:   roll.total ?? 0,
        damageFormula: req.damageFormula,
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

    const targetActor = game.actors?.get(req.targetActorId);
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
                    label: "Aplicar Integral",
                    callback: ($html: JQuery) => {
                        void applyDamage(req.targetActorId, req.damageTotal, readPmInput($html));
                    },
                },
                half: {
                    icon:  '<i class="fas fa-shield-halved"></i>',
                    label: `Aplicar Metade (${halfDmg})`,
                    callback: ($html: JQuery) => {
                        void applyDamage(req.targetActorId, halfDmg, readPmInput($html));
                    },
                },
                none: {
                    icon:  '<i class="fas fa-ban"></i>',
                    label: "Não Aplicar",
                    callback: ($html: JQuery) => {
                        const pm = readPmInput($html);
                        if (pm > 0) void applyDamage(req.targetActorId, 0, pm);
                    },
                },
                reroll: {
                    icon:  '<i class="fas fa-dice-d20"></i>',
                    label: "Forçar Rerolar Dano",
                    callback: () => {
                        const rerollReq: DamageRerollRequest = {
                            type:          "damage-reroll-request",
                            requestId:     req.requestId,
                            attackerUserId: req.attackerUserId,
                            targetUserId:  req.targetUserId,
                            targetActorId: req.targetActorId,
                            damageFormula: req.damageFormula,
                            attackerName:  req.attackerName,
                            rollLabel:     req.rollLabel,
                            attackTotal:   req.attackTotal,
                            targetDef:     req.targetDef,
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

        if (data?.type === "damage-reroll-request") {
            if (data.attackerUserId !== game.user?.id) return;
            void handleReroll(data);
        }
    });
}

// ── createChatMessage hook ────────────────────────────────────────────────────

function setupCreateChatHook(): void {
    Hooks.on("createChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;

        if (getMsgAuthorId(message) !== game.user?.id) return;

        const itemData = message.getFlag("tormenta20", "itemData") as Record<string, unknown> | undefined;
        if (!itemData) return;

        const rolls = message.rolls;
        if (!rolls?.length) return;

        const attackRoll = rolls.find((r) => (r.options as Record<string, unknown>)?.["type"] === "attack");
        const damageRoll = rolls.find((r) => (r.options as Record<string, unknown>)?.["type"] === "damage");
        if (!attackRoll || !damageRoll) return;

        const attackTotal   = attackRoll.total ?? 0;
        const damageTotal   = damageRoll.total ?? 0;
        const damageFormula = damageRoll.formula ?? "";

        const targets = game.user?.targets;
        if (!targets?.size) return;

        const attackerName  = message.speaker?.alias ?? "Atacante";
        const rollLabel     = message.flavor || "Ataque";
        const attackerUserId = game.user?.id ?? "";

        for (const token of targets) {
            const targetActor = token.actor;
            if (!targetActor) continue;

            const targetDef = getDef(targetActor);
            if (attackTotal < targetDef) continue;

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
                attackerName,
                rollLabel,
                attackTotal,
                targetDef,
                damageTotal,
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

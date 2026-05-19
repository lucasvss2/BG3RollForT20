/**
 * Bola de Fogo — magia de área (T20)
 *
 * FASE 1 (este arquivo):
 *  - Arcana 2 (Evocação), área esfera 6m, Reflexos reduz à metade.
 *  - Detecta o cast → registra "pending" para reclamar o template do T20.
 *  - Reclamado o template (esfera 6m que o T20 já criou no canvas via click),
 *    enumeramos todos os tokens dentro da área (aliados + inimigos) e
 *    disparamos o modal unificado de resistência para CADA um deles via
 *    socketlib. Cada alvo rola Reflexos próprio e decide aplicar integral
 *    (falhou) ou metade (passou).
 *  - Após o dispatch, o template é deletado depois de um delay curto
 *    (TEMPLATE_LINGER_MS) — o template é one-shot, não persistente como
 *    Consagrar/Aura. O delay deixa os jogadores verem a área.
 *
 * Aprimoramento 1 (+2 PM = +2d6) é absorvido automaticamente: o roll de
 * dano do chat (`message.rolls` type=damage) já inclui todos os dados
 * extras + bônus de poderes/itens selecionados na config do T20.
 *
 * NÃO implementados nesta fase:
 *   - Aprimoramento 2 (esfera flamejante persistente — tick por turno)
 *   - Aprimoramento 3 (pedra flamejante — item consumível no inventário)
 */

import { MODULE_ID } from "@/constants";
import {
    extractSpellName,
    normalizeCondName,
    getMsgAuthorId,
    parseResistance,
    extractCD,
    getTargetUserId,
    dispatchSpellResistanceToTarget,
} from "@/spell-resistance/index";
import type { SpellResistPreRollRequest } from "@/spell-resistance/types";

const SPELL_KEY = "bola de fogo";
const FLAG_SPELL = "spell";
const PENDING_WINDOW_MS = 30_000;
const TEMPLATE_LINGER_MS = 3500; // tempo que a área persiste no canvas após o dispatch

// ── Pending cast ──────────────────────────────────────────────────────────────

type PendingCast = {
    casterActorId: string;
    casterName:    string;
    casterUserId:  string;
    messageId:     string;
    damageTotal:   number;
    damageFormula: string;
    cd:            number;
    resistTxt:     string;
    spellName:     string;
    ts:            number;
};
const _pendingCasts = new Map<string, PendingCast>();

function registerPendingCast(uid: string, cast: Omit<PendingCast, "ts">): void {
    _pendingCasts.set(uid, { ...cast, ts: Date.now() });
}

// ── Geometria (igual ao Consagrar) ───────────────────────────────────────────

function getTokenPosPx(token: FoundryToken): { x: number; y: number; widthSq: number; heightSq: number } {
    type TokenDoc = {
        document?: { x?: number; y?: number; width?: number; height?: number };
        x?: number; y?: number;
    };
    const t   = token as unknown as TokenDoc;
    const doc = t.document;
    return {
        x:        doc?.x ?? t.x ?? 0,
        y:        doc?.y ?? t.y ?? 0,
        widthSq:  doc?.width  ?? 1,
        heightSq: doc?.height ?? 1,
    };
}

function isTokenInsideTemplate(
    token: FoundryToken,
    template: { x: number; y: number; distance: number },
): boolean {
    type CanvasLike = { scene?: { grid?: { size?: number; distance?: number } } };
    const cv       = canvas as unknown as CanvasLike;
    const gridSize = cv.scene?.grid?.size     ?? 100;
    const gridDist = cv.scene?.grid?.distance ?? 1.5;

    const radiusSq = template.distance / gridDist;
    const tCxSq    = template.x / gridSize;
    const tCySq    = template.y / gridSize;

    const pos = getTokenPosPx(token);
    const cx  = pos.x / gridSize + pos.widthSq  / 2;
    const cy  = pos.y / gridSize + pos.heightSq / 2;
    const dx  = cx - tCxSq;
    const dy  = cy - tCySq;
    return Math.sqrt(dx * dx + dy * dy) <= radiusSq;
}

function tokensInTemplate(template: {
    x: number; y: number; distance: number;
}): FoundryToken[] {
    type CanvasLike = { tokens?: { placeables?: FoundryToken[] } };
    const cv     = canvas as unknown as CanvasLike;
    const tokens = cv.tokens?.placeables ?? [];
    return tokens.filter(t => isTokenInsideTemplate(t, template));
}

// ── Template claim/dispatch ──────────────────────────────────────────────────

function buildBolaDeFogoFlags(meta: PendingCast): Record<string, unknown> {
    return {
        [FLAG_SPELL]:   SPELL_KEY,
        casterActorId:  meta.casterActorId,
        casterName:     meta.casterName,
        casterUserId:   meta.casterUserId,
        messageId:      meta.messageId,
        damageTotal:    meta.damageTotal,
        damageFormula:  meta.damageFormula,
        cd:             meta.cd,
        resistTxt:      meta.resistTxt,
        spellName:      meta.spellName,
        createdAtMs:    Date.now(),
        dispatched:     false,
    };
}

async function claimTemplate(
    tplDoc: { update(data: Record<string, unknown>): Promise<unknown> },
    pending: PendingCast,
): Promise<void> {
    try {
        await tplDoc.update({ [`flags.${MODULE_ID}`]: buildBolaDeFogoFlags(pending) });
    } catch (err) {
        console.warn(`[t20-theme-overhaul] Bola de Fogo: falha ao reclamar template:`, err);
    }
}

/**
 * Dispara o modal de resistência para cada token dentro do template.
 * Roda apenas no cliente do CASTER — quem reclamou o template é o autor.
 * Depois de disparar, marca o template como `dispatched:true` (idempotência)
 * e agenda a deleção do template.
 */
async function dispatchExplosion(tplDoc: {
    id: string; uuid: string; x: number; y: number; distance: number;
    flags?: Record<string, Record<string, unknown>>;
    update(data: Record<string, unknown>): Promise<unknown>;
    delete?(): Promise<unknown>;
}): Promise<void> {
    const flags = tplDoc.flags?.[MODULE_ID];
    if (!flags || flags[FLAG_SPELL] !== SPELL_KEY) return;
    if (flags["dispatched"] === true) return;

    // Marca dispatched ANTES de enviar os modais — previne dispatch duplicado se
    // updateMeasuredTemplate disparar mais de uma vez por outras mudanças.
    try {
        await tplDoc.update({ [`flags.${MODULE_ID}.dispatched`]: true });
    } catch (err) {
        console.warn(`[t20-theme-overhaul] Bola de Fogo: falha ao marcar dispatched:`, err);
    }

    const tokens = tokensInTemplate({ x: tplDoc.x, y: tplDoc.y, distance: tplDoc.distance });

    const casterName     = (flags["casterName"]     as string)   ?? "Lançador";
    const casterUserId   = (flags["casterUserId"]   as string)   ?? "";
    const messageId      = (flags["messageId"]      as string)   ?? "";
    const damageTotal    = (flags["damageTotal"]    as number)   ?? 0;
    const damageFormula  = (flags["damageFormula"]  as string)   ?? "";
    const cd             = (flags["cd"]             as number)   ?? 0;
    const resistTxt      = (flags["resistTxt"]      as string)   ?? "Reflexos reduz à metade";
    const spellName      = (flags["spellName"]      as string)   ?? "Bola de Fogo";

    const { skill, outcome } = parseResistance(resistTxt);

    if (tokens.length === 0) {
        ui.notifications?.info(`Bola de Fogo: nenhum alvo na área (${damageTotal} de dano rolado).`);
    } else {
        ui.notifications?.info(`Bola de Fogo explode! ${damageTotal} de dano em ${tokens.length} alvo(s).`);
    }

    type RandomIDFn = () => string;
    const rid = (globalThis as unknown as { randomID?: RandomIDFn }).randomID
             ?? (() => Math.random().toString(36).slice(2, 18));

    for (const token of tokens) {
        const targetActor = token.actor;
        if (!targetActor) continue;
        const targetUserId = getTargetUserId(targetActor);
        if (!targetUserId) {
            ui.notifications?.warn(`Bola de Fogo: nenhum usuário ativo para ${targetActor.name}.`);
            continue;
        }
        const preReq: SpellResistPreRollRequest = {
            type:              "spell-resist-preroll",
            requestId:         rid(),
            targetUserId,
            casterUserId,
            targetActorId:     targetActor.id,
            targetActorUuid:   targetActor.uuid,
            casterName,
            spellName,
            resistTxt,
            resistSkill:       skill,
            resistOutcome:     outcome,
            cd,
            messageId,
            damageTotal,
            damageFormula,
            isHeal:            false,
            maxHealValue:      0,
            removeFadiga:      false,
            truqueAtivo:       false,
            conditions:        [],
            customEffectNames: [],
        };
        dispatchSpellResistanceToTarget(preReq);
    }

    // Linger: deixa a área visível brevemente antes de deletar
    setTimeout(() => {
        void tplDoc.delete?.();
    }, TEMPLATE_LINGER_MS);
}

// ── Setup ────────────────────────────────────────────────────────────────────

export function setupBolaDeFogo(): void {
    // 1. Detect cast → registra pending pra reclamar o template do T20
    Hooks.on("createChatMessage", (...args: unknown[]) => {
        const message = args[0] as ChatMessage;
        const uid     = getMsgAuthorId(message);
        if (uid !== game.user?.id) return;
        if (normalizeCondName(extractSpellName(message)) !== SPELL_KEY) return;

        const itemData = message.getFlag("tormenta20", "itemData") as Record<string, unknown> | undefined;
        if (!itemData) return;

        const rolls      = message.rolls ?? [];
        const damageRoll = rolls.find(r => (r.options as Record<string, unknown>)?.["type"] === "damage");
        if (!damageRoll) return;

        const damageTotal   = damageRoll.total ?? 0;
        const damageFormula = damageRoll.formula ?? "";
        const cd            = extractCD(message);
        const resistTxt     = ((itemData["resistencia"] as { txt?: string } | undefined)?.txt ?? "").trim();

        registerPendingCast(uid, {
            casterActorId: message.speaker?.actor ?? "",
            casterName:    message.speaker?.alias ?? "Lançador",
            casterUserId:  uid,
            messageId:     message.id,
            damageTotal,
            damageFormula,
            cd,
            resistTxt,
            spellName:     extractSpellName(message),
        });
    });

    // 2. Template criado → caster reclama (adiciona nossas flags)
    Hooks.on("createMeasuredTemplate", (...args: unknown[]) => {
        const tplDoc = args[0] as {
            flags?: Record<string, Record<string, unknown>>;
            user?: string | { id?: string };
            author?: { id?: string };
            update(data: Record<string, unknown>): Promise<unknown>;
        };
        const triggerUserId = typeof args[2] === "string" ? (args[2] as string) : undefined;
        const currentUid    = game.user?.id;
        if (!currentUid) return;

        // Já tem nosso flag? (cena reaberta) — nada a fazer
        if (tplDoc.flags?.[MODULE_ID]?.[FLAG_SPELL] === SPELL_KEY) return;

        const authorUid =
            tplDoc.author?.id
            ?? (typeof tplDoc.user === "string" ? tplDoc.user : tplDoc.user?.id)
            ?? triggerUserId;
        if (authorUid !== currentUid) return;

        const pending = _pendingCasts.get(currentUid);
        if (!pending || Date.now() - pending.ts >= PENDING_WINDOW_MS) return;
        _pendingCasts.delete(currentUid);
        void claimTemplate(tplDoc, pending);
    });

    // 3. Template atualizado com nossa flag → caster dispara explosão
    Hooks.on("updateMeasuredTemplate", (...args: unknown[]) => {
        const tplDoc  = args[0] as {
            id: string; uuid: string; x: number; y: number; distance: number;
            flags?: Record<string, Record<string, unknown>>;
            update(data: Record<string, unknown>): Promise<unknown>;
            delete?(): Promise<unknown>;
        };
        const changes = args[1] as Record<string, unknown> | undefined;
        const flags   = tplDoc.flags?.[MODULE_ID];
        if (flags?.[FLAG_SPELL] !== SPELL_KEY) return;

        // Já disparado? (ex.: marcou dispatched no próprio update)
        if (flags["dispatched"] === true) return;

        // Confirma que essa mudança ADICIONOU nossas flags (claim recente)
        const changedFlags = (changes?.["flags"] as Record<string, unknown> | undefined)?.[MODULE_ID];
        if (!changedFlags) return;

        // Só o caster dispara
        const casterUid = flags["casterUserId"] as string | undefined;
        if (casterUid !== game.user?.id) return;

        void dispatchExplosion(tplDoc);
    });
}

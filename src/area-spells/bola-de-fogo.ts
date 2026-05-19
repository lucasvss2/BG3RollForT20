/**
 * Bola de Fogo — magia de área (T20)
 *
 * FASE 1: base + aprimoramento 1 (+2 PM = +2d6)
 *  - Detecta o cast → registra "pending" para reclamar o template do T20.
 *  - Reclamado o template (esfera 6m), enumera todos os tokens dentro e
 *    dispara o modal de resistência para CADA um deles. Cada alvo rola
 *    Reflexos próprio e decide aplicar integral (falhou) ou metade (passou).
 *  - Template auto-deletado após TEMPLATE_LINGER_MS (3.5s).
 *
 * FASE 2: aprimoramento 2 (+2 PM = esfera flamejante persistente)
 *  - Muda a magia para uma esfera de 1.5m de diâmetro (raio ESFERA_RAIO_M)
 *    que persiste pela cena. Dano por hit: 3d6 + (qty imp1) × 2d6.
 *  - Posicionamento via clique no canvas (igual Consagrar).
 *  - Tick automático no INÍCIO DO TURNO do caster: cada token no espaço
 *    da esfera rola Reflexos auto, recebe metade (passa) ou integral
 *    (falha). Resultado num chat card único.
 *  - Movimento: caster arrasta o template no canvas (Foundry default
 *    permite isso pro dono). Ao mover sobre tokens, aplica dano.
 *  - "Uma criatura só pode sofrer dano uma vez por rodada": tracking
 *    via flag `damagedThisRound: { [tokenId]: round }` no template.
 *  - Cancelamento via skills-menu ("Apagar esfera flamejante").
 *  - Roll de dano original (6d6/8d6) suprimido via preCreateChatMessage —
 *    com imp 2 a explosão não acontece, só a esfera.
 *
 * Aprimoramento 1 (+2d6) é stack-compatível com imps 2 e 3.
 *
 * NÃO implementado nesta fase:
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
import { getSocket, onSocketReady } from "@/socket";
import { registerSkillAction, refreshSkillsMenu } from "@/ui/skills-menu";
import type { SpellResistPreRollRequest } from "@/spell-resistance/types";

const SPELL_KEY = "bola de fogo";
const ESFERA_KEY = "bola-de-fogo-esfera";
const FLAG_SPELL = "spell";
const PENDING_WINDOW_MS = 30_000;
const TEMPLATE_LINGER_MS = 3500;
const ESFERA_DIAMETRO_M = 1.5;  // diâmetro em metros = 1 quadrado do tabuleiro
const ESFERA_TEXTURE = `modules/${MODULE_ID}/assets/esfera-flamejante.png`;

// ── socketlib handler names ──────────────────────────────────────────────────
const SOCKET_CREATE_ESFERA = "bola-de-fogo/create-esfera";

// ── GM election ──────────────────────────────────────────────────────────────
//
// Elege o GM "primário" para executar mutações compartilhadas (criação de
// Tile, aplicação de dano, etc.). Quando há múltiplos GMs ativos, todos
// recebem hooks; sem dedup haveria duplicação. Elegemos o GM ativo com o
// menor ID lexicográfico — determinístico em todos os clientes.
function isActiveGM(): boolean {
    const myId = game.user?.id;
    if (!myId || !game.user?.isGM) return false;
    const activeGMs = (game.users?.contents ?? [])
        .filter(u => u.isGM && u.active)
        .map(u => u.id)
        .sort();
    return activeGMs[0] === myId;
}

// ── Helpers (geometria) ──────────────────────────────────────────────────────

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

// ── Geometria para Tile (FASE 2 — esfera flamejante) ────────────────────────
//
// A esfera flamejante é representada por uma Tile (imagem no canvas) de
// 1×1 quadrado, ocupando UM espaço de tabuleiro. Detecção de "criatura no
// mesmo espaço" é AABB: centro do token deve cair dentro do retângulo da
// tile.

function isTokenInTileBounds(
    token: FoundryToken,
    tile:  { x: number; y: number; width: number; height: number },
): boolean {
    type CanvasLike = { scene?: { grid?: { size?: number } } };
    const cv       = canvas as unknown as CanvasLike;
    const gridSize = cv.scene?.grid?.size ?? 100;
    const pos      = getTokenPosPx(token);
    const tcx      = pos.x + pos.widthSq  * gridSize / 2;
    const tcy      = pos.y + pos.heightSq * gridSize / 2;
    return tcx >= tile.x
        && tcx <  tile.x + tile.width
        && tcy >= tile.y
        && tcy <  tile.y + tile.height;
}

function tokensInTile(tile: { x: number; y: number; width: number; height: number }): FoundryToken[] {
    type CanvasLike = { tokens?: { placeables?: FoundryToken[] } };
    const cv     = canvas as unknown as CanvasLike;
    const tokens = cv.tokens?.placeables ?? [];
    return tokens.filter(t => isTokenInTileBounds(t, tile));
}

// ── Detecção de aprimoramentos ───────────────────────────────────────────────

type OnUseEntry = { cost?: number; qty?: number; description?: string };

function getOnUseEffects(message: ChatMessage): OnUseEntry[] {
    const t20 = (message.flags as Record<string, unknown> | undefined)?.tormenta20 as
        | { onUseEffects?: unknown } | undefined;
    const raw = t20?.onUseEffects;
    return Array.isArray(raw) ? raw as OnUseEntry[] : [];
}

function getOnUseEffectsFromData(data: Record<string, unknown>): OnUseEntry[] {
    const flags = data["flags"] as Record<string, unknown> | undefined;
    const t20   = flags?.["tormenta20"] as { onUseEffects?: unknown } | undefined;
    const raw   = t20?.onUseEffects;
    return Array.isArray(raw) ? raw as OnUseEntry[] : [];
}

function detectImp1Qty(entries: OnUseEntry[]): number {
    for (const e of entries) {
        const qty = Number(e?.qty ?? 0);
        if (!Number.isFinite(qty) || qty < 1) continue;
        const desc = String(e?.description ?? "");
        // "aumenta o dano em +2d6"
        if (/aumenta\s+o?\s*dano\s+em\s+\+?2d6/i.test(desc)) return qty;
    }
    return 0;
}

function detectImp2Active(entries: OnUseEntry[]): boolean {
    for (const e of entries) {
        const qty = Number(e?.qty ?? 0);
        if (!Number.isFinite(qty) || qty < 1) continue;
        const desc = String(e?.description ?? "");
        // "muda a área para efeito de esfera flamejante..."
        if (/esfera\s+flamejante/i.test(desc)) return true;
    }
    return false;
}

// ── Pending cast (FASE 1 — explosão one-shot) ────────────────────────────────

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

// ── Template flags ───────────────────────────────────────────────────────────

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

// ── FASE 1: Dispatch explosão ────────────────────────────────────────────────

async function dispatchExplosion(tplDoc: {
    id: string; uuid: string; x: number; y: number; distance: number;
    flags?: Record<string, Record<string, unknown>>;
    update(data: Record<string, unknown>): Promise<unknown>;
    delete?(): Promise<unknown>;
}): Promise<void> {
    const flags = tplDoc.flags?.[MODULE_ID];
    if (!flags || flags[FLAG_SPELL] !== SPELL_KEY) return;
    if (flags["dispatched"] === true) return;

    try {
        await tplDoc.update({ [`flags.${MODULE_ID}.dispatched`]: true });
    } catch (err) {
        console.warn(`[t20-theme-overhaul] Bola de Fogo: falha ao marcar dispatched:`, err);
    }

    const tokens = tokensInTemplate({ x: tplDoc.x, y: tplDoc.y, distance: tplDoc.distance });

    const casterName    = (flags["casterName"]    as string) ?? "Lançador";
    const casterUserId  = (flags["casterUserId"]  as string) ?? "";
    const messageId     = (flags["messageId"]     as string) ?? "";
    const damageTotal   = (flags["damageTotal"]   as number) ?? 0;
    const damageFormula = (flags["damageFormula"] as string) ?? "";
    const cd            = (flags["cd"]            as number) ?? 0;
    const resistTxt     = (flags["resistTxt"]     as string) ?? "Reflexos reduz à metade";
    const spellName     = (flags["spellName"]     as string) ?? "Bola de Fogo";

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

    setTimeout(() => {
        void tplDoc.delete?.();
    }, TEMPLATE_LINGER_MS);
}

// ── FASE 2: Esfera Flamejante persistente ────────────────────────────────────

type EsferaMeta = {
    casterActorId:    string;
    casterName:       string;
    casterUserId:     string;
    cd:               number;
    resistTxt:        string;
    damageFormula:    string;     // "3d6", "5d6", "7d6" etc
    imp1Qty:          number;
    spellName:        string;
};

function buildEsferaFlags(meta: EsferaMeta): Record<string, unknown> {
    return {
        [FLAG_SPELL]:   ESFERA_KEY,
        casterActorId:  meta.casterActorId,
        casterName:     meta.casterName,
        casterUserId:   meta.casterUserId,
        cd:             meta.cd,
        resistTxt:      meta.resistTxt,
        damageFormula:  meta.damageFormula,
        imp1Qty:        meta.imp1Qty,
        spellName:      meta.spellName,
        createdAtMs:    Date.now(),
        creatorUserId:  game.user?.id ?? "",
        damagedThisRound: {} as Record<string, number>,
    };
}

/**
 * Promise que resolve quando o usuário clica no canvas (ou ESC cancela).
 * Copiado do Consagrar — mesmo padrão.
 */
async function promptCanvasClick(label: string): Promise<{ x: number; y: number } | null> {
    return new Promise((resolve) => {
        ui.notifications?.info(label);
        type StageLike = {
            once?(event: string, fn: (e: unknown) => void): void;
            on?(event: string, fn: (e: unknown) => void): void;
            off?(event: string, fn: (e: unknown) => void): void;
        };
        type CanvasLike = { app?: { stage?: StageLike }; stage?: StageLike };
        const cv = canvas as unknown as CanvasLike;
        const stage = cv.app?.stage ?? cv.stage;
        if (!stage?.on || !stage?.off) { resolve(null); return; }

        const clickHandler = (event: unknown) => {
            const ev = event as { data?: { getLocalPosition(target: unknown): { x: number; y: number } } };
            const local = ev.data?.getLocalPosition(stage);
            cleanup();
            if (local) resolve({ x: local.x, y: local.y });
            else       resolve(null);
        };
        const keyHandler = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cleanup();
                ui.notifications?.info("Esfera Flamejante: posicionamento cancelado");
                resolve(null);
            }
        };
        function cleanup(): void {
            stage?.off?.("pointerdown", clickHandler);
            document.removeEventListener("keydown", keyHandler, true);
        }
        stage.on("pointerdown", clickHandler);
        document.addEventListener("keydown", keyHandler, true);
    });
}

/**
 * Constrói os dados da Tile da esfera flamejante (sem persistir).
 * Compartilhado entre o path do GM (cria direto) e o do player
 * (delega via socket, mas a tileData é montada no GM-side).
 */
function buildEsferaTileData(
    sceneGrid: { size?: number; distance?: number } | undefined,
    pos: { x: number; y: number },
    meta: EsferaMeta,
): Record<string, unknown> {
    const gridSize = sceneGrid?.size     ?? 100;
    const gridDist = sceneGrid?.distance ?? 1.5;
    const sizePx   = (ESFERA_DIAMETRO_M / gridDist) * gridSize;

    // Snap pra grid: tile alinhada no quadrado onde clicou.
    const snappedX = Math.floor(pos.x / gridSize) * gridSize;
    const snappedY = Math.floor(pos.y / gridSize) * gridSize;

    // Ownership: caster vira OWNER (3) da tile. GMs já têm acesso por padrão.
    // Isso permite que o jogador dono do conjurador arraste a tile no canvas.
    const ownership: Record<string, number> = { default: 0 };
    if (meta.casterUserId) ownership[meta.casterUserId] = 3;

    return {
        texture: { src: ESFERA_TEXTURE, scaleX: 1, scaleY: 1 },
        x:       snappedX,
        y:       snappedY,
        width:   sizePx,
        height:  sizePx,
        rotation: 0,
        hidden:  false,
        locked:  false,
        sort:    100,
        ownership,
        flags:   { [MODULE_ID]: buildEsferaFlags(meta) },
    };
}

type CreateEsferaSocketRequest = {
    type:    "create-esfera";
    sceneId: string;
    pos:     { x: number; y: number };
    meta:    EsferaMeta;
};

/** Handler GM-side: cria a Tile a pedido de um player. */
async function handleCreateEsferaSocket(req: CreateEsferaSocketRequest): Promise<void> {
    if (!game.user?.isGM) return;
    type SceneLike = {
        grid?: { size?: number; distance?: number };
        createEmbeddedDocuments(t: string, data: unknown[], opts?: Record<string, unknown>): Promise<unknown[]>;
    };
    const scene = (game as unknown as { scenes?: { get(id: string): SceneLike | undefined } })
        .scenes?.get(req.sceneId);
    if (!scene) {
        console.warn(`[t20-theme-overhaul] Esfera Flamejante: GM não achou a cena ${req.sceneId}`);
        return;
    }
    const tileData = buildEsferaTileData(scene.grid, req.pos, req.meta);
    try {
        await scene.createEmbeddedDocuments("Tile", [tileData]);
        ui.notifications?.info(`${req.meta.casterName} criou Esfera Flamejante (via GM).`);
    } catch (err) {
        console.warn(`[t20-theme-overhaul] Esfera Flamejante: GM falhou ao criar tile:`, err);
    }
}

async function placeEsfera(meta: EsferaMeta): Promise<void> {
    const pos = await promptCanvasClick(
        `Clique no canvas para posicionar a Esfera Flamejante (1.5m de diâmetro). ESC cancela.`,
    );
    if (!pos) return;

    type SceneLike = {
        id?: string;
        grid?: { size?: number; distance?: number };
        createEmbeddedDocuments(t: string, data: unknown[], opts?: Record<string, unknown>): Promise<unknown[]>;
    };
    type CanvasLike = { scene?: SceneLike };
    const cv    = canvas as unknown as CanvasLike;
    const scene = cv.scene;
    if (!scene) {
        ui.notifications?.error("Esfera Flamejante: nenhuma cena ativa");
        return;
    }

    // Players não têm permissão TILE_CREATE no Foundry v13 — delega ao GM.
    // GMs criam direto (e disparam a notificação local).
    if (game.user?.isGM) {
        const tileData = buildEsferaTileData(scene.grid, pos, meta);
        try {
            await scene.createEmbeddedDocuments("Tile", [tileData]);
            ui.notifications?.info(`Esfera Flamejante criada (${meta.damageFormula} por hit). Arraste a tile pra mover.`);
        } catch (err) {
            console.warn(`[t20-theme-overhaul] Esfera Flamejante: falha ao criar tile:`, err);
        }
        return;
    }
    // Player: delega ao GM via socketlib
    const sceneId = scene.id;
    if (!sceneId) return;
    const req: CreateEsferaSocketRequest = { type: "create-esfera", sceneId, pos, meta };
    try {
        await getSocket()?.executeAsGM(SOCKET_CREATE_ESFERA, req);
        ui.notifications?.info(`Esfera Flamejante (${meta.damageFormula} por hit). Arraste a tile pra mover.`);
    } catch (err) {
        console.warn(`[t20-theme-overhaul] Esfera Flamejante: falha no socket:`, err);
        ui.notifications?.error("Esfera Flamejante: GM precisa estar online para criar a esfera.");
    }
}

/**
 * Aplica dano em tokens dentro da esfera (respeitando "1x por rodada").
 * Cada token elegível rola Reflexos auto, recebe metade (passa) ou integral.
 * Atualiza o flag `damagedThisRound` no template e posta um chat card.
 *
 * Roda apenas no cliente do CASTER (que tem permissão de modificar o template).
 */
async function applyEsferaDamage(tileDoc: {
    id: string; uuid: string; x: number; y: number; width: number; height: number;
    flags?: Record<string, Record<string, unknown>>;
    update(data: Record<string, unknown>): Promise<unknown>;
}, trigger: "turn-start" | "moved"): Promise<void> {
    const flags = tileDoc.flags?.[MODULE_ID];
    if (!flags || flags[FLAG_SPELL] !== ESFERA_KEY) return;

    // GM-side only: aplica dano em atores (alguns não pertencem ao caster).
    // Multi-GM dedup via isActiveGM (lowest sorted userId).
    if (!isActiveGM()) return;

    const round = (game as unknown as { combat?: { round?: number } }).combat?.round ?? 0;
    const damaged = (flags["damagedThisRound"] as Record<string, number> | undefined) ?? {};
    const damageFormula = (flags["damageFormula"] as string) ?? "3d6";
    const cd            = (flags["cd"]            as number) ?? 0;
    const casterName    = (flags["casterName"]    as string) ?? "Lançador";

    const tokens = tokensInTile({ x: tileDoc.x, y: tileDoc.y, width: tileDoc.width, height: tileDoc.height });
    if (tokens.length === 0) return;

    // Filtra alvos elegíveis (não atingidos nesta rodada)
    const targets = tokens.filter(t => {
        if (!t.actor) return false;
        const tokId = (t as unknown as { document?: { id?: string }; id?: string }).document?.id
                   ?? (t as unknown as { id?: string }).id
                   ?? "";
        return !tokId || damaged[tokId] !== round;
    });
    if (targets.length === 0) return;

    type RollCtor = new (formula: string) => Roll & { evaluate(opts?: object): Promise<Roll> };
    const RollCls = (globalThis as unknown as { Roll: RollCtor }).Roll;

    type ActorWithPericias = FoundryActor & {
        system?: { pericias?: { refl?: { value?: number } } };
        applyDamage?(amount: number, multiplier?: number, applyRD?: boolean): Promise<void>;
    };

    type ResultRow = {
        tokenName:  string;
        actorName:  string;
        passed:     boolean;
        critFail:   boolean;
        critPass:   boolean;
        d20:        number;
        reflexBonus: number;
        reflexTotal: number;
        damage:     number;
        damageApplied: number;
    };
    const results: ResultRow[] = [];
    const newDamaged: Record<string, number> = { ...damaged };

    for (const token of targets) {
        const actor = token.actor as ActorWithPericias | null;
        if (!actor) continue;
        const reflexBonus = actor.system?.pericias?.refl?.value ?? 0;
        const reflexRoll  = new RollCls(`1d20 + ${reflexBonus}`);
        await reflexRoll.evaluate({ async: true } as never);
        const d20Res = (reflexRoll.dice?.[0] as { results?: { active?: boolean; result?: number }[] } | undefined)
            ?.results?.find(r => r.active)?.result ?? 0;
        const reflexTotal = reflexRoll.total ?? 0;
        const critFail = d20Res === 1;
        const critPass = d20Res === 20;
        const passed   = critPass || (!critFail && cd > 0 && reflexTotal >= cd);

        const dmgRoll = new RollCls(damageFormula);
        await dmgRoll.evaluate({ async: true } as never);
        const totalDmg = dmgRoll.total ?? 0;
        const damageApplied = passed ? Math.floor(totalDmg / 2) : totalDmg;

        if (damageApplied > 0) {
            try {
                if (typeof actor.applyDamage === "function") {
                    await actor.applyDamage(damageApplied, 1, false);
                } else {
                    const pv = (actor.system as { attributes?: { pv?: { value?: number } } } | undefined)?.attributes?.pv?.value ?? 0;
                    await (actor as FoundryActor).update({ "system.attributes.pv.value": Math.max(0, pv - damageApplied) });
                }
            } catch (err) {
                console.warn(`[t20-theme-overhaul] Esfera Flamejante: falha ao aplicar dano em ${actor.name}:`, err);
            }
        }

        const tokId = (token as unknown as { document?: { id?: string }; id?: string }).document?.id
                   ?? (token as unknown as { id?: string }).id
                   ?? "";
        if (tokId) newDamaged[tokId] = round;

        results.push({
            tokenName: token.name ?? actor.name ?? "Alvo",
            actorName: actor.name ?? "Alvo",
            passed, critFail, critPass,
            d20: d20Res,
            reflexBonus,
            reflexTotal,
            damage: totalDmg,
            damageApplied,
        });
    }

    try {
        await tileDoc.update({ [`flags.${MODULE_ID}.damagedThisRound`]: newDamaged });
    } catch (err) {
        console.warn(`[t20-theme-overhaul] Esfera Flamejante: falha ao salvar damagedThisRound:`, err);
    }

    if (results.length > 0) {
        await postEsferaChatCard(casterName, trigger, results, cd);
    }
}

async function postEsferaChatCard(
    casterName: string,
    trigger: "turn-start" | "moved",
    results: Array<{
        tokenName: string; actorName: string;
        passed: boolean; critFail: boolean; critPass: boolean;
        d20: number; reflexBonus: number; reflexTotal: number;
        damage: number; damageApplied: number;
    }>,
    cd: number,
): Promise<void> {
    const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const triggerLabel = trigger === "turn-start"
        ? "Início do turno do conjurador"
        : "Movimento da esfera";
    const rows = results.map(r => {
        const verdict = r.critPass ? "✦ SUCESSO CRÍTICO"
                      : r.critFail ? "☠ FALHA CRÍTICA"
                      : r.passed   ? "✓ PASSOU (metade)"
                                   : "✗ FALHOU (integral)";
        const verdictColor = r.passed ? "#6ecf7a" : "#cc4444";
        return `
            <div style="display:flex; align-items:baseline; gap:6px; padding:3px 0; border-bottom:1px solid rgba(204,68,68,0.18); flex-wrap:wrap;">
                <span style="color:#e8d8a8; font-weight:700;">${esc(r.tokenName)}</span>
                <span style="color:#9a8e7a; font-size:0.78rem;">Reflexos: d20(${r.d20}) + ${r.reflexBonus} = <b>${r.reflexTotal}</b> vs CD ${cd}</span>
                <span style="margin-left:auto; color:${verdictColor}; font-weight:700; font-size:0.78rem; letter-spacing:0.05em;">${verdict}</span>
                <span style="width:100%; color:#e8a8a8; font-size:0.85rem;">→ Dano ${r.damage} → <b>${r.damageApplied}</b> aplicado</span>
            </div>`;
    }).join("");

    const content = `
        <div style="font-family:'Modesto Condensed','Palatino Linotype',serif; padding:8px 12px; background:linear-gradient(180deg, rgba(204,68,68,0.08) 0%, transparent 100%); border-left:3px solid #cc4422;">
            <div style="color:#cc4422; font-size:0.7rem; letter-spacing:0.14em; text-transform:uppercase;">Esfera Flamejante — ${esc(casterName)}</div>
            <div style="color:#8a7450; font-size:0.65rem; letter-spacing:0.1em; text-transform:uppercase; font-style:italic; margin-bottom:6px;">${triggerLabel}</div>
            ${rows}
        </div>`;
    type CMCreate = { create(data: Record<string, unknown>): Promise<unknown> };
    await (ChatMessage as unknown as CMCreate).create({
        content,
        speaker: { alias: casterName },
        flags:   { [MODULE_ID]: { esferaFlamejante: true } },
    });
}

// ── Skills menu (cancelar esfera) ────────────────────────────────────────────

type EsferaTile = {
    id: string;
    x?: number; y?: number; width?: number; height?: number;
    flags?: Record<string, Record<string, unknown>>;
    delete?(): Promise<unknown>;
};

function getMyEsferas(): EsferaTile[] {
    type CanvasLike = { scene?: { tiles?: { contents?: EsferaTile[] } } };
    const cv  = canvas as unknown as CanvasLike;
    const all = cv.scene?.tiles?.contents ?? [];
    const mine = all.filter(t => t.flags?.[MODULE_ID]?.[FLAG_SPELL] === ESFERA_KEY);
    if (game.user?.isGM) return mine;
    const uid = game.user?.id;
    if (!uid) return [];
    return mine.filter(t => (t.flags?.[MODULE_ID]?.["creatorUserId"] as string | undefined) === uid);
}

async function onClickCancelEsfera(): Promise<void> {
    const mine = getMyEsferas();
    if (mine.length === 0) {
        ui.notifications?.info("Nenhuma Esfera Flamejante ativa para apagar.");
        refreshSkillsMenu();
        return;
    }
    type SceneLike = { deleteEmbeddedDocuments?(t: string, ids: string[]): Promise<unknown> };
    const scene = (canvas as unknown as { scene?: SceneLike }).scene;
    if (!scene?.deleteEmbeddedDocuments) return;

    if (mine.length === 1) {
        try {
            await scene.deleteEmbeddedDocuments("Tile", [mine[0].id]);
            ui.notifications?.info("Esfera Flamejante apagada.");
        } catch (err) {
            console.warn(`[t20-theme-overhaul] Esfera Flamejante: falha ao apagar:`, err);
        }
        return;
    }

    // Múltiplas esferas — picker
    type DialogCtor = new (data: object, opts?: object) => { render(force?: boolean): unknown };
    const DialogCls = (globalThis as unknown as { Dialog: DialogCtor }).Dialog;
    const escHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows = mine.map((t, i) => {
        const caster = escHtml((t.flags?.[MODULE_ID]?.["casterName"] as string | undefined) ?? "Lançador");
        return `<label class="picker-row" style="display:flex; align-items:center; gap:10px; padding:6px 8px; cursor:pointer;">
            <input type="checkbox" data-tid="${t.id}" checked />
            <span style="color:#8a7450; min-width:56px;">Esfera #${i + 1}</span>
            <span style="color:#d0c4a8;"><b style="color:#cc4422;">${caster}</b></span>
        </label>`;
    }).join("");
    const ids = await new Promise<string[] | null>((resolve) => {
        new DialogCls({
            title: "Apagar esferas flamejantes",
            content: `<div style="padding:8px 12px;"><p style="color:#8a7450; font-size:0.78rem; letter-spacing:0.12em; text-transform:uppercase;">Selecione as esferas a apagar</p>${rows}</div>`,
            buttons: {
                remove: {
                    icon: '<i class="fas fa-fire-flame-curved"></i>', label: "Apagar selecionadas",
                    callback: ($html: JQuery) => {
                        const root = ($html as unknown as { 0?: HTMLElement })[0] ?? ($html as unknown as HTMLElement);
                        const sel = Array.from((root as HTMLElement).querySelectorAll("input[data-tid]:checked"))
                            .map(el => el.getAttribute("data-tid") ?? "").filter(Boolean);
                        resolve(sel.length > 0 ? sel : null);
                    },
                },
                cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar", callback: () => resolve(null) },
            },
            default: "remove", close: () => resolve(null),
        }, { classes: ["bg3-dialog"] }).render(true);
    });
    if (!ids || ids.length === 0) return;
    try {
        await scene.deleteEmbeddedDocuments("Tile", ids);
        ui.notifications?.info(`${ids.length} Esfera(s) Flamejante apagada(s).`);
    } catch (err) {
        console.warn(`[t20-theme-overhaul] Esfera Flamejante: falha ao apagar múltiplas:`, err);
    }
}

// ── Setup ────────────────────────────────────────────────────────────────────

export function setupBolaDeFogo(): void {
    // Skills-menu: botão para apagar Esfera Flamejante (Fase 2)
    registerSkillAction({
        id:    "bola-de-fogo-esfera-cancel",
        label: "Apagar esfera flamejante",
        icon:  "fa-solid fa-fire-flame-curved",
        color: "#ff7733",
        isVisible: () => getMyEsferas().length > 0,
        onClick:   () => onClickCancelEsfera(),
    });

    // Socket: GM cria a Tile da esfera a pedido de player (que não tem
    // TILE_CREATE no Foundry v13). socketlib.executeAsGM seleciona 1 GM.
    onSocketReady((socket) => {
        socket.register(SOCKET_CREATE_ESFERA, (...args: unknown[]) => {
            void handleCreateEsferaSocket(args[0] as CreateEsferaSocketRequest);
        });
    });

    // 0. preCreateChatMessage — suprime o roll de damage quando imp 2 ativo
    //    (a esfera tem dano próprio rolado por hit; a "explosão" não acontece).
    Hooks.on("preCreateChatMessage", (...args: unknown[]) => {
        type DocLike = { updateSource(changes: Record<string, unknown>): void };
        const doc    = args[0] as DocLike;
        const data   = args[1] as Record<string, unknown>;
        const userId = args[3] as string;
        if (userId !== game.user?.id) return;

        const content = (data["content"] as string | undefined) ?? "";
        if (!/bola\s+de\s+fogo/i.test(content)) return;

        const entries = getOnUseEffectsFromData(data);
        if (!detectImp2Active(entries)) return;

        const rolls = data["rolls"] as unknown[] | undefined;
        if (!Array.isArray(rolls) || !rolls.length) return;
        const filtered = rolls.filter(r => {
            try {
                const rd = typeof r === "string" ? JSON.parse(r) as Record<string, unknown> : r as Record<string, unknown>;
                const opts = rd["options"] as Record<string, unknown> | undefined;
                return opts?.["type"] !== "damage";
            } catch { return true; }
        });
        if (filtered.length === rolls.length) return;
        doc.updateSource({ rolls: filtered });
    });

    // 1. createChatMessage — branch entre FASE 1 (explosão) e FASE 2 (esfera)
    Hooks.on("createChatMessage", (...args: unknown[]) => {
        const message = args[0] as ChatMessage;
        const uid     = getMsgAuthorId(message);
        if (uid !== game.user?.id) return;
        if (normalizeCondName(extractSpellName(message)) !== SPELL_KEY) return;

        const itemData = message.getFlag("tormenta20", "itemData") as Record<string, unknown> | undefined;
        if (!itemData) return;

        const entries = getOnUseEffects(message);

        // FASE 2: imp 2 ativo → esfera flamejante persistente
        if (detectImp2Active(entries)) {
            const imp1Qty = detectImp1Qty(entries);
            const dice    = 3 + imp1Qty * 2;
            const damageFormula = `${dice}d6[fogo]`;
            const cd            = extractCD(message);
            const resistTxt     = ((itemData["resistencia"] as { txt?: string } | undefined)?.txt ?? "").trim()
                                  || "Reflexos reduz à metade";
            const meta: EsferaMeta = {
                casterActorId: message.speaker?.actor ?? "",
                casterName:    message.speaker?.alias ?? "Lançador",
                casterUserId:  uid,
                cd,
                resistTxt,
                damageFormula,
                imp1Qty,
                spellName:     "Bola de Fogo (Esfera Flamejante)",
            };
            void placeEsfera(meta);
            return;
        }

        // FASE 1: explosão one-shot
        const rolls      = message.rolls ?? [];
        const damageRoll = rolls.find(r => (r.options as Record<string, unknown>)?.["type"] === "damage");
        if (!damageRoll) return;

        registerPendingCast(uid, {
            casterActorId: message.speaker?.actor ?? "",
            casterName:    message.speaker?.alias ?? "Lançador",
            casterUserId:  uid,
            messageId:     message.id,
            damageTotal:   damageRoll.total ?? 0,
            damageFormula: damageRoll.formula ?? "",
            cd:            extractCD(message),
            resistTxt:     ((itemData["resistencia"] as { txt?: string } | undefined)?.txt ?? "").trim(),
            spellName:     extractSpellName(message),
        });
    });

    // 2. createMeasuredTemplate — caster reclama (FASE 1 explosão)
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

        // Já tem flag (esfera ou explosão)? — nada a fazer
        const ourFlag = tplDoc.flags?.[MODULE_ID]?.[FLAG_SPELL];
        if (ourFlag === SPELL_KEY || ourFlag === ESFERA_KEY) {
            refreshSkillsMenu();
            return;
        }

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

    // 3. updateMeasuredTemplate — FASE 1: dispatch da explosão após claim
    Hooks.on("updateMeasuredTemplate", (...args: unknown[]) => {
        const tplDoc  = args[0] as {
            id: string; uuid: string; x: number; y: number; distance: number;
            flags?: Record<string, Record<string, unknown>>;
            update(data: Record<string, unknown>): Promise<unknown>;
            delete?(): Promise<unknown>;
        };
        const changes = args[1] as Record<string, unknown> | undefined;
        const flags   = tplDoc.flags?.[MODULE_ID];
        if (!flags || flags[FLAG_SPELL] !== SPELL_KEY) return;
        if (flags["dispatched"] === true) return;

        const changedFlags = (changes?.["flags"] as Record<string, unknown> | undefined)?.[MODULE_ID];
        if (!changedFlags) return;
        const casterUid = flags["casterUserId"] as string | undefined;
        if (casterUid !== game.user?.id) return;
        void dispatchExplosion(tplDoc);
    });

    // 4. createTile — refresh skills menu (esfera criada)
    Hooks.on("createTile", (...args: unknown[]) => {
        const tileDoc = args[0] as { flags?: Record<string, Record<string, unknown>> };
        if (tileDoc.flags?.[MODULE_ID]?.[FLAG_SPELL] === ESFERA_KEY) refreshSkillsMenu();
    });

    // 5. updateTile — esfera moveu (x/y mudou) → aplica dano nos novos alvos
    //    Gating GM-side (applyEsferaDamage tem isActiveGM check interno).
    Hooks.on("updateTile", (...args: unknown[]) => {
        const tileDoc = args[0] as {
            id: string; uuid: string; x: number; y: number; width: number; height: number;
            flags?: Record<string, Record<string, unknown>>;
            update(data: Record<string, unknown>): Promise<unknown>;
        };
        const changes = args[1] as Record<string, unknown> | undefined;
        const flags   = tileDoc.flags?.[MODULE_ID];
        if (!flags || flags[FLAG_SPELL] !== ESFERA_KEY) return;
        const moved = typeof changes?.["x"] === "number" || typeof changes?.["y"] === "number";
        if (!moved) return;
        void applyEsferaDamage(tileDoc, "moved");
    });

    // 6. deleteTile — esfera apagada → refresh skills menu
    Hooks.on("deleteTile", (...args: unknown[]) => {
        const tileDoc = args[0] as { flags?: Record<string, Record<string, unknown>> };
        if (tileDoc.flags?.[MODULE_ID]?.[FLAG_SPELL] === ESFERA_KEY) refreshSkillsMenu();
    });

    // 7. combatTurnChange — tick da esfera no início do turno do caster.
    //    Padrão Aura Sagrada: usar combatTurnChange (não combatTurn) para
    //    pegar o NOVO combatant. Gating GM-side via applyEsferaDamage.
    Hooks.on("combatTurnChange", (...args: unknown[]) => {
        const combat = args[0] as { round?: number; combatant?: { actor?: { id?: string }; tokenId?: string } } | null;
        const newCombatant = combat?.combatant;
        const newActorId   = newCombatant?.actor?.id;
        if (!newActorId) return;

        type TileLike = {
            id: string; uuid: string; x: number; y: number; width: number; height: number;
            flags?: Record<string, Record<string, unknown>>;
            update(data: Record<string, unknown>): Promise<unknown>;
        };
        type CanvasLike = { scene?: { tiles?: { contents?: TileLike[] } } };
        const cv    = canvas as unknown as CanvasLike;
        const tiles = cv.scene?.tiles?.contents ?? [];
        for (const tile of tiles) {
            const flags = tile.flags?.[MODULE_ID];
            if (flags?.[FLAG_SPELL] !== ESFERA_KEY) continue;
            if ((flags["casterActorId"] as string | undefined) !== newActorId) continue;
            void applyEsferaDamage(tile, "turn-start");
        }
    });
}

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
import { registerSkillAction, refreshSkillsMenu } from "@/ui/skills-menu";
import type { SpellResistPreRollRequest } from "@/spell-resistance/types";

const SPELL_KEY = "bola de fogo";
const ESFERA_KEY = "bola-de-fogo-esfera";
const PEDRA_KEY  = "pedra-flamejante";       // Ap3 — consumível no inventário
const FLAG_SPELL = "spell";
const PENDING_WINDOW_MS = 30_000;
const TEMPLATE_LINGER_MS = 3500;
const ESFERA_DIAMETRO_M = 1.5;  // diâmetro em metros = 1 quadrado do tabuleiro
const PEDRA_RAIO_M = 6;         // raio da detonação da pedra (mesma área da Bola normal)
const ESFERA_TEXTURE = `modules/${MODULE_ID}/assets/esfera-flamejante.png`;

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

// ── Geometria para esfera-Token (FASE 2 — esfera flamejante) ────────────────
//
// A esfera flamejante é representada por um Token sintético (actorLink:false)
// de 1×1 quadrado, ocupando UM espaço de tabuleiro. Detecção de "criatura no
// mesmo espaço" é AABB: centro do token-criatura deve cair dentro do
// retângulo do token-esfera. Token-esferas são excluídas dos alvos pelo
// flag spell:"bola-de-fogo-esfera".

function tokenIsEsfera(token: FoundryToken): boolean {
    type WithDoc = { document?: { flags?: Record<string, Record<string, unknown>> }; flags?: Record<string, Record<string, unknown>> };
    const t = token as unknown as WithDoc;
    const flags = t.document?.flags ?? t.flags;
    return flags?.[MODULE_ID]?.[FLAG_SPELL] === ESFERA_KEY;
}

function isTokenInEsferaBounds(
    token: FoundryToken,
    esferaPx: { x: number; y: number; width: number; height: number },
): boolean {
    type CanvasLike = { scene?: { grid?: { size?: number } } };
    const cv       = canvas as unknown as CanvasLike;
    const gridSize = cv.scene?.grid?.size ?? 100;
    const pos      = getTokenPosPx(token);
    const tcx      = pos.x + pos.widthSq  * gridSize / 2;
    const tcy      = pos.y + pos.heightSq * gridSize / 2;
    return tcx >= esferaPx.x
        && tcx <  esferaPx.x + esferaPx.width
        && tcy >= esferaPx.y
        && tcy <  esferaPx.y + esferaPx.height;
}

/**
 * Tokens-criatura cujo centro cai dentro dos bounds do esfera-token.
 * Exclui o próprio esfera-token (e qualquer outro com nossa flag).
 */
function tokensInEsfera(esferaPx: { x: number; y: number; width: number; height: number }): FoundryToken[] {
    type CanvasLike = { tokens?: { placeables?: FoundryToken[] } };
    const cv     = canvas as unknown as CanvasLike;
    const tokens = cv.tokens?.placeables ?? [];
    return tokens.filter(t => !tokenIsEsfera(t) && isTokenInEsferaBounds(t, esferaPx));
}

/** Converte width/height de grid-units pra pixels (Token v13). */
function tokenBoundsPx(token: { x: number; y: number; width: number; height: number }): {
    x: number; y: number; width: number; height: number;
} {
    type CanvasLike = { scene?: { grid?: { size?: number } } };
    const cv       = canvas as unknown as CanvasLike;
    const gridSize = cv.scene?.grid?.size ?? 100;
    return {
        x:      token.x,
        y:      token.y,
        width:  token.width  * gridSize,
        height: token.height * gridSize,
    };
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

function detectImp3Active(entries: OnUseEntry[]): boolean {
    for (const e of entries) {
        const qty = Number(e?.qty ?? 0);
        if (!Number.isFinite(qty) || qty < 1) continue;
        const desc = String(e?.description ?? "");
        // Padrões múltiplos para cobrir variações de formato do T20:
        // - full text: "você cria uma pequena pedra flamejante..."
        // - title: "Pedra Flamejante" ou "pedra-flamejante"
        if (/pedra[\s\-_]?flamejante/i.test(desc)) return true;
        // Fallback: "muda a duração" é exclusivo do Ap3 (nenhum outro ap tem isso)
        if (/muda\s+a\s+dura[cç][aã]/i.test(desc)) return true;
        // Fallback 2: "ser descarregada" / "descarreg" — efeito exclusivo do Ap3
        if (/descarreg/i.test(desc)) return true;
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
// Marcador para templates do T20 que devem ser deletados imediatamente (FASE 2 —
// a área padrão é substituída pelo esfera-Token; o MeasuredTemplate não é usado).
const _pendingEsferaTemplateDelete = new Map<string, number>(); // userId → timestamp
// Guard contra detonação dupla (clique rápido na UI ou disparo simultâneo
// por createChatMessage + skills-menu).
let _pedraDetonationInProgress = false;
// Metadados de Pedras Flamejantes pendentes de detonação, indexados por actorId.
// Armazenado ao criar a pedra para garantir disponibilidade no detect via
// createChatMessage mesmo quando T20 já consumiu/deletou o item antes da mensagem
// chegar ao hook (ou quando itemData não inclui nossos flags custom).
const _pendingPedras = new Map<string, { itemId: string; meta: PedraMeta }>();

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
 * Constrói os dados do Token da esfera flamejante (sem persistir).
 *
 * O Token é SINTÉTICO (actorLink:false) e referencia o actor do caster.
 * Player tem permissão TOKEN_CREATE e OWNER no caster → consegue criar
 * direto sem precisar de GM (era o problema com Tile, que é GAMEMASTER-only
 * por design do Foundry).
 *
 * Display ajustado pra parecer um efeito mágico (sem nameplate, sem barras
 * de PV, disposition neutra, texture é a PNG da bola de fogo).
 */
function buildEsferaTokenData(
    sceneGrid: { size?: number; distance?: number } | undefined,
    pos: { x: number; y: number },
    meta: EsferaMeta,
): Record<string, unknown> {
    const gridSize = sceneGrid?.size     ?? 100;
    const gridDist = sceneGrid?.distance ?? 1.5;
    // Token.width/height são em GRID UNITS (quadrados), não pixels.
    const gridUnits = ESFERA_DIAMETRO_M / gridDist; // = 1 pra grid 1.5m

    // Snap pra grid: token alinhado no quadrado onde clicou.
    const snappedX = Math.floor(pos.x / gridSize) * gridSize;
    const snappedY = Math.floor(pos.y / gridSize) * gridSize;

    return {
        name:        "Esfera Flamejante",
        x:           snappedX,
        y:           snappedY,
        width:       gridUnits,
        height:      gridUnits,
        actorId:     meta.casterActorId,
        actorLink:   false,   // sintético — não afeta o actor base do caster
        texture:     { src: ESFERA_TEXTURE, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5 },
        displayName: 0,       // nunca mostrar nameplate
        displayBars: 0,       // nunca mostrar barras
        bar1:        { attribute: "" },
        bar2:        { attribute: "" },
        disposition: 0,       // neutro (sem borda de cor de afinidade)
        hidden:      false,
        locked:      false,
        flags:       { [MODULE_ID]: buildEsferaFlags(meta) },
    };
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

    const tokenData = buildEsferaTokenData(scene.grid, pos, meta);
    try {
        await scene.createEmbeddedDocuments("Token", [tokenData]);
        ui.notifications?.info(`Esfera Flamejante criada (${meta.damageFormula} por hit). Arraste o token pra mover.`);
    } catch (err) {
        console.warn(`[t20-theme-overhaul] Esfera Flamejante: falha ao criar token:`, err);
        ui.notifications?.error("Esfera Flamejante: falha ao criar token (veja console).");
    }
}

/**
 * Samplea posições ao longo do segmento (fromPx → toPx) para coletar
 * tokens-criatura que a esfera intersecta em qualquer ponto do trajeto.
 * Step = gridSize/4 (4 samples por quadrado) — fino o suficiente pra
 * pegar tokens menores em diagonais.
 */
function tokensAlongPath(
    fromPx: { x: number; y: number },
    toPx:   { x: number; y: number },
    esferaW: number,
    esferaH: number,
): FoundryToken[] {
    const dx = toPx.x - fromPx.x;
    const dy = toPx.y - fromPx.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) {
        return tokensInEsfera({ x: fromPx.x, y: fromPx.y, width: esferaW, height: esferaH });
    }
    type CanvasLike = { scene?: { grid?: { size?: number } } };
    const cv       = canvas as unknown as CanvasLike;
    const gridSize = cv.scene?.grid?.size ?? 100;
    const steps    = Math.max(1, Math.ceil(dist / (gridSize / 4)));
    const seen     = new Set<string>();
    const result: FoundryToken[] = [];
    for (let i = 0; i <= steps; i++) {
        const t  = i / steps;
        const sx = fromPx.x + dx * t;
        const sy = fromPx.y + dy * t;
        for (const tok of tokensInEsfera({ x: sx, y: sy, width: esferaW, height: esferaH })) {
            const tid = (tok as unknown as { document?: { id?: string }; id?: string }).document?.id
                     ?? (tok as unknown as { id?: string }).id
                     ?? "";
            if (tid && !seen.has(tid)) {
                seen.add(tid);
                result.push(tok);
            }
        }
    }
    return result;
}

/**
 * Aplica dano da esfera nos tokens-alvo:
 *  - Filtra "1x por rodada" via flag damagedThisRound:{tokId:round}
 *  - Rola damageFormula UMA VEZ (todos os alvos veem o mesmo damageTotal)
 *  - Dispatcha o MODAL DE RESISTÊNCIA pra cada alvo (não auto-roll); cada
 *    dono decide se aplica metade (passou Reflexos) ou integral (falhou)
 *  - Posta um chat card-resumo listando damage rolada + alvos afetados
 *  - Atualiza damagedThisRound no token-esfera
 *
 * GM-side only via isActiveGM (player não tem permissão de aplicar dano em
 * NPCs alheios; o modal é dispatchado via socketlib ao dono de cada alvo).
 *
 * `affectedTokens` opcional: usa essa lista (ex.: tokens no trajeto do
 * movimento). Sem ela, usa tokens na posição atual da esfera (tick por turno).
 */
async function applyEsferaDamage(esferaTokenDoc: {
    id: string; uuid: string; x: number; y: number; width: number; height: number;
    flags?: Record<string, Record<string, unknown>>;
    update(data: Record<string, unknown>): Promise<unknown>;
}, trigger: "turn-start" | "moved" | "placed", affectedTokens?: FoundryToken[]): Promise<void> {
    const flags = esferaTokenDoc.flags?.[MODULE_ID];
    if (!flags || flags[FLAG_SPELL] !== ESFERA_KEY) return;

    // GM-side only: aplica via modal-dispatch (socketlib executa nos donos).
    // Multi-GM dedup via isActiveGM (lowest sorted userId).
    if (!isActiveGM()) return;

    const round         = (game as unknown as { combat?: { round?: number } }).combat?.round ?? 0;
    const damaged       = (flags["damagedThisRound"] as Record<string, number> | undefined) ?? {};
    const damageFormula = (flags["damageFormula"]    as string) ?? "3d6";
    const cd            = (flags["cd"]               as number) ?? 0;
    const casterName    = (flags["casterName"]       as string) ?? "Lançador";
    const casterUserId  = (flags["casterUserId"]     as string) ?? "";
    const resistTxt     = (flags["resistTxt"]        as string) ?? "Reflexos reduz à metade";
    const spellName     = (flags["spellName"]        as string) ?? "Bola de Fogo (Esfera Flamejante)";

    const tokens = affectedTokens ?? tokensInEsfera(tokenBoundsPx(esferaTokenDoc));
    if (tokens.length === 0) return;

    // Dedup + filtra "1x por rodada"
    const seen = new Set<string>();
    const targets: FoundryToken[] = [];
    for (const t of tokens) {
        if (!t.actor) continue;
        const tokId = (t as unknown as { document?: { id?: string }; id?: string }).document?.id
                   ?? (t as unknown as { id?: string }).id
                   ?? "";
        if (!tokId || seen.has(tokId)) continue;
        seen.add(tokId);
        if (damaged[tokId] === round) continue;
        targets.push(t);
    }
    if (targets.length === 0) return;

    // Rola dano UMA VEZ — todos os alvos veem o mesmo damageTotal no modal
    type RollCtor = new (formula: string) => Roll & { evaluate(opts?: object): Promise<Roll> };
    const RollCls = (globalThis as unknown as { Roll: RollCtor }).Roll;
    const dmgRoll = new RollCls(damageFormula);
    await dmgRoll.evaluate({ async: true } as never);
    const damageTotal = dmgRoll.total ?? 0;

    const { skill, outcome } = parseResistance(resistTxt);
    const newDamaged: Record<string, number> = { ...damaged };

    type RandomIDFn = () => string;
    const rid = (globalThis as unknown as { randomID?: RandomIDFn }).randomID
             ?? (() => Math.random().toString(36).slice(2, 18));

    const targetNames: string[] = [];
    for (const token of targets) {
        const actor = token.actor;
        if (!actor) continue;
        const targetUserId = getTargetUserId(actor);
        if (!targetUserId) continue;
        const tokId = (token as unknown as { document?: { id?: string }; id?: string }).document?.id
                   ?? (token as unknown as { id?: string }).id
                   ?? "";
        if (tokId) newDamaged[tokId] = round;
        targetNames.push(token.name ?? actor.name ?? "Alvo");

        const preReq: SpellResistPreRollRequest = {
            type:              "spell-resist-preroll",
            requestId:         rid(),
            targetUserId,
            casterUserId,
            targetActorId:     actor.id,
            targetActorUuid:   actor.uuid,
            casterName,
            spellName,
            resistTxt,
            resistSkill:       skill,
            resistOutcome:     outcome,
            cd,
            messageId:         "",
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

    try {
        await esferaTokenDoc.update({ [`flags.${MODULE_ID}.damagedThisRound`]: newDamaged });
    } catch (err) {
        console.warn(`[t20-theme-overhaul] Esfera Flamejante: falha ao salvar damagedThisRound:`, err);
    }

    // Posta um chat card-resumo com o dano rolado + lista de alvos
    if (targetNames.length > 0) {
        await postEsferaSummaryCard(casterName, trigger, dmgRoll, damageTotal, cd, targetNames);
    }
}

async function postEsferaSummaryCard(
    casterName: string,
    trigger: "turn-start" | "moved" | "placed",
    dmgRoll: Roll,
    _damageTotal: number,
    cd: number,
    targetNames: string[],
): Promise<void> {
    const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const triggerLabel =
        trigger === "turn-start" ? "Início do turno do conjurador" :
        trigger === "placed"     ? "Esfera invocada sobre a criatura" :
                                   "Movimento da esfera";
    const targetsHtml = targetNames.map(n =>
        `<span style="display:inline-block; padding:2px 8px; margin:2px; background:rgba(var(--bg3-color-danger-rgb),0.12); border:1px solid rgba(var(--bg3-color-danger-rgb),0.35); border-radius:3px; color:var(--bg3-accent-bright); font-size:0.82rem;">${esc(n)}</span>`
    ).join("");
    const rollRendered = await dmgRoll.render();

    const content = `
        <div class="t20-theme-chat-card" style="padding:10px 12px; background:linear-gradient(180deg, rgba(var(--bg3-color-danger-rgb),0.10) 0%, transparent 100%); border-left:3px solid #cc4422;">
            <div style="color:#cc4422; font-size:0.7rem; letter-spacing:0.14em; text-transform:uppercase; font-weight:700;">Esfera Flamejante — ${esc(casterName)}</div>
            <div style="color:var(--bg3-accent-muted); font-size:0.65rem; letter-spacing:0.1em; text-transform:uppercase; font-style:italic; margin: 2px 0 8px;">${triggerLabel}</div>
            <div style="margin-bottom:8px;">${rollRendered}</div>
            <div style="color:var(--bg3-accent-muted); font-size:0.7rem; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:4px;">Alvos atingidos (${targetNames.length}) — cada dono rola Reflexos no modal:</div>
            <div>${targetsHtml}</div>
            <div style="color:var(--bg3-text-muted); font-size:0.75rem; font-style:italic; margin-top:6px;">CD ${cd} · Falhar = dano integral, passar = metade</div>
        </div>`;
    type CMCreate = { create(data: Record<string, unknown>): Promise<unknown> };
    await (ChatMessage as unknown as CMCreate).create({
        content,
        rolls:   [dmgRoll.toJSON()],
        type:    5,
        speaker: { alias: casterName },
        flags:   { [MODULE_ID]: { esferaFlamejante: true } },
    });
}

// ── FASE 3: Pedra Flamejante ──────────────────────────────────────────────────
//
// Aprimoramento 3 (+3 PM): em vez da explosão imediata, cria um item
// "Pedra Flamejante" (consumivel) no inventário do conjurador.
//
// Fluxo principal de detonação:
//   1. Player clica no item "Pedra Flamejante" na aba de inventário.
//   2. T20 posta um chat card para o item → nosso createChatMessage detecta
//      flags.[MODULE_ID].spell === PEDRA_KEY no itemData.
//   3. handlePedraDetonationFromItemUse abre o canvas click de posicionamento
//      (igual FASE 1) e, ao confirmar, registra pending cast + cria template.
//   4. createMeasuredTemplate reclama o template e dispatchExplosion despacha
//      o modal de resistência para cada alvo.
//   5. Item é removido do inventário após detonação.
//
// Fluxo alternativo (fallback): skills-menu "Detonar Pedra Flamejante".
// Útil se o T20 não incluir nossos flags no itemData da mensagem.
//
// Ap1 é stack-compatível: 3d6 + qty×2d6 ao detonar.

type PedraActorLike = {
    id: string;
    name?: string | null;
    items: {
        contents?: Array<{ id: string; flags?: Record<string, Record<string, unknown>>; delete?(): Promise<unknown> }>;
        get(id: string): { id?: string; flags?: Record<string, Record<string, unknown>>; delete?(): Promise<unknown> } | undefined;
    };
    createEmbeddedDocuments(type: string, data: unknown[], opts?: object): Promise<unknown[]>;
};

type PedraMeta = {
    casterActorId: string;
    casterName:    string;
    casterUserId:  string;
    cd:            number;
    resistTxt:     string;
    damageFormula: string;
    spellName:     string;
};

async function createPedraFlamejante(
    actor: PedraActorLike,
    meta: PedraMeta,
): Promise<string | null> {
    const itemData = {
        name: "Pedra Flamejante",
        type: "consumivel",
        img:  ESFERA_TEXTURE,
        system: {
            descricao: `Pedra flamejante criada por Bola de Fogo (Aprimoramento 3). Pode ser detonada como reação — arremesse com alcance curto. Ao detonar, causa ${meta.damageFormula} de dano de fogo em esfera de ${PEDRA_RAIO_M}m de raio (CD ${meta.cd}, Reflexos reduz à metade).`,
        },
        flags: {
            [MODULE_ID]: {
                [FLAG_SPELL]:  PEDRA_KEY,
                casterActorId: meta.casterActorId,
                casterName:    meta.casterName,
                casterUserId:  meta.casterUserId,
                cd:            meta.cd,
                resistTxt:     meta.resistTxt,
                damageFormula: meta.damageFormula,
                spellName:     meta.spellName,
                createdAt:     Date.now(),
            },
        },
    };
    try {
        const created = await actor.createEmbeddedDocuments("Item", [itemData]);
        const item    = created[0] as { id?: string } | undefined;
        const newId   = item?.id ?? null;
        // Armazena metadados em memória — fallback para detecção no createChatMessage
        // caso T20 consuma o item antes da mensagem chegar ao hook.
        if (newId) _pendingPedras.set(meta.casterActorId, { itemId: newId, meta });
        return newId;
    } catch (err) {
        console.warn(`[t20-theme-overhaul] Bola de Fogo: falha ao criar Pedra Flamejante:`, err);
        return null;
    }
}

/**
 * Executa a detonação: canvas click → enumera tokens na área → dispatcha
 * modais de resistência → deleta a pedra do inventário.
 * Chamado pelo skills-menu ("Detonar Pedra Flamejante").
 */
async function detonatePedra(
    actor: PedraActorLike,
    itemId: string,
    pedraFlags: Record<string, unknown>,
): Promise<void> {
    const pos = await promptCanvasClick(
        `Clique no canvas para detonar a Pedra Flamejante (área de ${PEDRA_RAIO_M}m de raio). ESC cancela.`,
    );
    if (!pos) return;

    const casterName    = (pedraFlags["casterName"]    as string) ?? "Lançador";
    const casterUserId  = (pedraFlags["casterUserId"]  as string) ?? "";
    const damageFormula = (pedraFlags["damageFormula"] as string) ?? "3d6[fogo]";
    const cd            = (pedraFlags["cd"]            as number) ?? 0;
    const resistTxt     = (pedraFlags["resistTxt"]     as string) ?? "Reflexos reduz à metade";
    const spellName     = (pedraFlags["spellName"]     as string) ?? "Bola de Fogo";

    type CanvasLike = { scene?: { grid?: { size?: number } } };
    const cv       = canvas as unknown as CanvasLike;
    const gridSize = cv.scene?.grid?.size ?? 100;
    const snappedX = Math.round(pos.x / gridSize) * gridSize;
    const snappedY = Math.round(pos.y / gridSize) * gridSize;

    // Garante que nenhuma entrada stale de supressão de template bloqueie o
    // template visual da detonação (pode sobrar caso T20 tenha criado o
    // template do cast em outro cliente e preCreateMeasuredTemplate não
    // tenha consumido a entrada).
    const _currentUidDetonate = game.user?.id;
    if (_currentUidDetonate) _pendingEsferaTemplateDelete.delete(_currentUidDetonate);

    // Cria template visual temporário (mostra a área de explosão durante 3.5s)
    type SceneLike = {
        createEmbeddedDocuments(type: string, data: unknown[]): Promise<Array<{ delete?(): Promise<unknown> }>>;
    };
    const sceneForTpl = (canvas as unknown as { scene?: SceneLike }).scene;
    if (sceneForTpl) {
        try {
            const created = await sceneForTpl.createEmbeddedDocuments("MeasuredTemplate", [{
                t:           "circle",
                x:           snappedX,
                y:           snappedY,
                distance:    PEDRA_RAIO_M,
                fillColor:   "#ff4400",
                fillAlpha:   0.15,
                borderColor: "#ff6600",
                borderAlpha: 0.8,
            }]);
            const visualTpl = created[0] as { delete?(): Promise<unknown> } | undefined;
            if (visualTpl) setTimeout(() => void visualTpl.delete?.(), TEMPLATE_LINGER_MS);
        } catch (err) {
            console.warn(`[t20-theme-overhaul] Pedra Flamejante: falha ao criar template visual:`, err);
        }
    }

    const tokens             = tokensInTemplate({ x: snappedX, y: snappedY, distance: PEDRA_RAIO_M });
    const { skill, outcome } = parseResistance(resistTxt);

    type RollCtor = new (formula: string) => Roll & { evaluate(opts?: object): Promise<Roll> };
    const RollCls    = (globalThis as unknown as { Roll: RollCtor }).Roll;
    const dmgRoll    = new RollCls(damageFormula);
    await dmgRoll.evaluate({ async: true } as never);
    const damageTotal = dmgRoll.total ?? 0;

    type RandomIDFn = () => string;
    const rid = (globalThis as unknown as { randomID?: RandomIDFn }).randomID
             ?? (() => Math.random().toString(36).slice(2, 18));

    if (tokens.length === 0) {
        ui.notifications?.info(`Pedra Flamejante: nenhum alvo na área (${damageTotal} de dano rolado).`);
    } else {
        const targetNames: string[] = [];
        for (const token of tokens) {
            const targetActor = token.actor;
            if (!targetActor) continue;
            const targetUserId = getTargetUserId(targetActor);
            if (!targetUserId) {
                ui.notifications?.warn(`Pedra Flamejante: nenhum usuário ativo para ${targetActor.name}.`);
                continue;
            }
            targetNames.push(token.name ?? targetActor.name ?? "Alvo");
            const preReq: SpellResistPreRollRequest = {
                type:              "spell-resist-preroll",
                requestId:         rid(),
                targetUserId,
                casterUserId,
                targetActorId:     targetActor.id,
                targetActorUuid:   targetActor.uuid,
                casterName,
                spellName:         `${spellName} (Pedra Flamejante)`,
                resistTxt,
                resistSkill:       skill,
                resistOutcome:     outcome,
                cd,
                messageId:         "",
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

        const escHtml      = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const targetsHtml  = targetNames.map(n =>
            `<span style="display:inline-block; padding:2px 8px; margin:2px; background:rgba(var(--bg3-color-danger-rgb),0.12); border:1px solid rgba(var(--bg3-color-danger-rgb),0.35); border-radius:3px; color:var(--bg3-accent-bright); font-size:0.82rem;">${escHtml(n)}</span>`
        ).join("");
        const rollRendered = await dmgRoll.render();
        const content      = `
            <div class="t20-theme-chat-card" style="padding:10px 12px; background:linear-gradient(180deg, rgba(var(--bg3-color-danger-rgb),0.10) 0%, transparent 100%); border-left:3px solid #ff6600;">
                <div style="color:#ff6600; font-size:0.7rem; letter-spacing:0.14em; text-transform:uppercase; font-weight:700;">Pedra Flamejante — ${escHtml(casterName)}</div>
                <div style="color:var(--bg3-accent-muted); font-size:0.65rem; letter-spacing:0.1em; text-transform:uppercase; font-style:italic; margin:2px 0 8px;">Detonação</div>
                <div style="margin-bottom:8px;">${rollRendered}</div>
                <div style="color:var(--bg3-accent-muted); font-size:0.7rem; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:4px;">Alvos atingidos (${targetNames.length}) — cada dono rola Reflexos no modal:</div>
                <div>${targetsHtml}</div>
                <div style="color:var(--bg3-text-muted); font-size:0.75rem; font-style:italic; margin-top:6px;">CD ${cd} · Falhar = dano integral, passar = metade</div>
            </div>`;
        type CMCreate = { create(data: Record<string, unknown>): Promise<unknown> };
        await (ChatMessage as unknown as CMCreate).create({
            content,
            rolls:   [dmgRoll.toJSON()],
            type:    5,
            speaker: { alias: casterName },
            flags:   { [MODULE_ID]: { pedraFlamejante: true } },
        });
    }

    // Remove pedra do inventário após detonação (pode já ter sido consumido pelo T20 — ok)
    try {
        await actor.items.get(itemId)?.delete?.();
    } catch (err) {
        console.warn(`[t20-theme-overhaul] Bola de Fogo: falha ao deletar Pedra Flamejante:`, err);
    }
    // Garante que _pendingPedras não fica stale após detonação via skills-menu
    _pendingPedras.delete(actor.id);
    refreshSkillsMenu();
}

/**
 * Disparado quando o player usa o item "Pedra Flamejante" direto do inventário.
 * Detectado em createChatMessage via flags.[MODULE_ID].spell === PEDRA_KEY.
 *
 * Delega para detonatePedra (canvas click → template visual → roll de dano →
 * modais de resistência → delete do item) protegido pelo guard de duplo-clique.
 */
async function handlePedraDetonationFromItemUse(
    actor: PedraActorLike,
    itemId: string,
    pedraFlags: Record<string, unknown>,
): Promise<void> {
    if (_pedraDetonationInProgress) {
        ui.notifications?.warn("Pedra Flamejante: detonação já em andamento — conclua ou pressione ESC.");
        return;
    }
    _pedraDetonationInProgress = true;
    try {
        await detonatePedra(actor, itemId, pedraFlags);
    } finally {
        _pedraDetonationInProgress = false;
    }
}

function getMyPedras(): Array<{ actorId: string; itemId: string; flags: Record<string, unknown> }> {
    const uid  = game.user?.id;
    const isGM = game.user?.isGM;
    type ActorsLike = {
        contents?: Array<{
            id: string;
            items?: {
                contents?: Array<{
                    id: string;
                    flags?: Record<string, Record<string, unknown>>;
                }>;
            };
        }>;
    };
    const actors  = (game.actors as unknown as ActorsLike)?.contents ?? [];
    const results: Array<{ actorId: string; itemId: string; flags: Record<string, unknown> }> = [];
    for (const actor of actors) {
        const items = actor.items?.contents ?? [];
        for (const item of items) {
            const flags = item.flags?.[MODULE_ID];
            if (!flags || flags[FLAG_SPELL] !== PEDRA_KEY) continue;
            if (!isGM && (flags["casterUserId"] as string | undefined) !== uid) continue;
            results.push({ actorId: actor.id, itemId: item.id, flags });
        }
    }
    return results;
}

async function onClickDetonarPedra(): Promise<void> {
    if (_pedraDetonationInProgress) {
        ui.notifications?.warn("Pedra Flamejante: detonação já em andamento — conclua ou pressione ESC.");
        return;
    }
    const pedras = getMyPedras();
    if (pedras.length === 0) {
        ui.notifications?.info("Nenhuma Pedra Flamejante no inventário.");
        refreshSkillsMenu();
        return;
    }

    type ActorsGetter = { get(id: string): PedraActorLike | undefined };
    const actorsMap = game.actors as unknown as ActorsGetter;
    let pedra       = pedras[0];

    // Múltiplas pedras → picker
    if (pedras.length > 1) {
        type DialogCtor = new (data: object, opts?: object) => { render(force?: boolean): unknown };
        const DialogCls = (globalThis as unknown as { Dialog: DialogCtor }).Dialog;
        const escHtml   = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const rows = pedras.map((p, i) => {
            const caster = escHtml((p.flags["casterName"] as string | undefined) ?? "Lançador");
            const dmg    = escHtml((p.flags["damageFormula"] as string | undefined) ?? "?d6");
            return `<label class="picker-row" style="display:flex; align-items:center; gap:10px; padding:6px 8px; cursor:pointer;">
                <input type="radio" name="pedra-pick" data-pedra-idx="${i}" ${i === 0 ? "checked" : ""} />
                <span style="color:var(--bg3-text-primary);"><b style="color:#ff6600;">${caster}</b> · <span style="color:var(--bg3-accent-muted);">${dmg}</span></span>
                <span style="color:var(--bg3-accent-muted); font-size:0.75rem; font-style:italic;">Pedra #${i + 1}</span>
            </label>`;
        }).join("");
        const chosen = await new Promise<number | null>((resolve) => {
            new DialogCls({
                title:   "Detonar Pedra Flamejante",
                content: `<div style="padding:8px 12px;"><p style="color:var(--bg3-accent-muted); font-size:0.78rem; letter-spacing:0.12em; text-transform:uppercase;">Selecione a pedra a detonar</p>${rows}</div>`,
                buttons: {
                    detonar: {
                        icon: '<i class="fas fa-bomb"></i>', label: "Detonar",
                        callback: ($html: JQuery) => {
                            const root  = ($html as unknown as { 0?: HTMLElement })[0] ?? ($html as unknown as HTMLElement);
                            const radio = (root as HTMLElement).querySelector("input[name='pedra-pick']:checked");
                            const idx   = radio ? Number(radio.getAttribute("data-pedra-idx")) : 0;
                            resolve(Number.isFinite(idx) ? idx : 0);
                        },
                    },
                    cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar", callback: () => resolve(null) },
                },
                default: "detonar", close: () => resolve(null),
            }, { classes: ["bg3-dialog"] }).render(true);
        });
        if (chosen === null) return;
        pedra = pedras[chosen];
    }

    const actor = actorsMap.get(pedra.actorId);
    if (!actor) return;
    _pedraDetonationInProgress = true;
    try {
        await detonatePedra(actor, pedra.itemId, pedra.flags);
    } finally {
        _pedraDetonationInProgress = false;
    }
}

// ── Skills menu (cancelar esfera) ────────────────────────────────────────────

type EsferaTokenDoc = {
    id: string;
    x?: number; y?: number; width?: number; height?: number;
    flags?: Record<string, Record<string, unknown>>;
    delete?(): Promise<unknown>;
};

function getMyEsferas(): EsferaTokenDoc[] {
    type CanvasLike = { scene?: { tokens?: { contents?: EsferaTokenDoc[] } } };
    const cv  = canvas as unknown as CanvasLike;
    const all = cv.scene?.tokens?.contents ?? [];
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
            await scene.deleteEmbeddedDocuments("Token", [mine[0].id]);
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
            <span style="color:var(--bg3-accent-muted); min-width:56px;">Esfera #${i + 1}</span>
            <span style="color:var(--bg3-text-primary);"><b style="color:#cc4422;">${caster}</b></span>
        </label>`;
    }).join("");
    const ids = await new Promise<string[] | null>((resolve) => {
        new DialogCls({
            title: "Apagar esferas flamejantes",
            content: `<div style="padding:8px 12px;"><p style="color:var(--bg3-accent-muted); font-size:0.78rem; letter-spacing:0.12em; text-transform:uppercase;">Selecione as esferas a apagar</p>${rows}</div>`,
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
        await scene.deleteEmbeddedDocuments("Token", ids);
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

    // Skills-menu: botão para detonar Pedra Flamejante (Fase 3 — Ap3)
    registerSkillAction({
        id:    "pedra-flamejante-detonar",
        label: "Detonar Pedra Flamejante",
        icon:  "fa-solid fa-bomb",
        color: "#ff6600",
        isVisible: () => getMyPedras().length > 0,
        onClick:   () => onClickDetonarPedra(),
    });


    // 0. preCreateChatMessage — quando imp 2 ou 3 ativo:
    //    a) seta _pendingEsferaTemplateDelete ANTES que o T20 processe o
    //       createChatMessage (garante que preCreateMeasuredTemplate já
    //       encontra o flag quando o T20 criar o template automático).
    //    b) suprime o roll de damage (imp 2: esfera tem dano próprio;
    //       imp 3: explosão só acontece ao detonar).
    Hooks.on("preCreateChatMessage", (...args: unknown[]) => {
        type DocLike = { updateSource(changes: Record<string, unknown>): void };
        const doc    = args[0] as DocLike;
        const data   = args[1] as Record<string, unknown>;
        const userId = args[3] as string;
        if (userId !== game.user?.id) return;

        // Não checa `data["content"]` aqui — no Foundry v13 o campo pode ainda ser
        // um path de template HBS não renderizado, não o HTML final, e o guard falharia.
        // Confiamos apenas nos onUseEffects que o T20 sempre inclui na criação.
        const entries = getOnUseEffectsFromData(data);
        if (!detectImp2Active(entries) && !detectImp3Active(entries)) return;

        // Seta o flag AQUI (preCreate) em vez de createChatMessage para
        // garantir que preCreateMeasuredTemplate o encontre mesmo que o hook
        // do T20 em createChatMessage rode antes do nosso.
        _pendingEsferaTemplateDelete.set(userId, Date.now());

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

    // 1. createChatMessage — branch entre FASE 1 (explosão), FASE 2 (esfera),
    //    FASE 3 (pedra — cast) e uso de pedra via inventário.
    Hooks.on("createChatMessage", (...args: unknown[]) => {
        const message = args[0] as ChatMessage;
        const uid     = getMsgAuthorId(message);
        if (uid !== game.user?.id) return;

        // ── Detecta uso de Pedra Flamejante no inventário ────────────────────
        //
        // Estratégia em camadas:
        //  1. t20ItemData.flags  → T20 incluiu nossos flags no snapshot (mais confiável)
        //  2. t20ItemData name+type → T20 incluiu nome mas não flags custom
        //  3. _pendingPedras[actorId] → fallback memória: cobre o caso onde o T20
        //     deletou o item ANTES de criar a msg de chat (sem snapshot confiável)
        //     ou onde t20ItemData é null (T20 não inclui itemData para consumivel).
        //
        // Não dependemos mais de encontrar o item VIVO em actor.items.contents —
        // o item pode já ter sido consumido pelo T20 quando chegamos aqui.
        {
            const speakerActorId = message.speaker?.actor ?? "";
            const t20ItemData    = message.getFlag("tormenta20", "itemData") as Record<string, unknown> | undefined;
            type ActorsGetter    = { get(id: string): PedraActorLike | undefined };

            let pedraDetected  = false;
            let pedraActorId   = "";
            let pedraItemId    = "";
            let resolvedFlags: Record<string, unknown> = {};

            // Camada 1 & 2: snapshot do T20
            if (t20ItemData) {
                const itemModFlags = (t20ItemData["flags"] as Record<string, Record<string, unknown>> | undefined)?.[MODULE_ID];
                const itemType     = (t20ItemData["type"] as string | undefined) ?? "";
                const rawItemName  = (t20ItemData["name"] as string | undefined) ?? "";
                const isPedraByFlag = itemModFlags?.[FLAG_SPELL] === PEDRA_KEY;
                const isPedraByName = itemType === "consumivel"
                                   && normalizeCondName(rawItemName) === "pedra flamejante";

                if (isPedraByFlag || isPedraByName) {
                    pedraDetected = true;
                    pedraActorId  = speakerActorId
                                 || (itemModFlags?.["casterActorId"] as string | undefined)
                                 || "";
                    pedraItemId   = (t20ItemData["_id"] as string | undefined)
                                 ?? (t20ItemData["id"]  as string | undefined)
                                 ?? "";
                    // Tenta pegar flags do item ainda vivo; usa snapshot como fallback
                    if (pedraActorId) {
                        const liveActor = (game.actors as unknown as ActorsGetter).get(pedraActorId);
                        const liveItem  = liveActor?.items.contents?.find(
                            i => i.flags?.[MODULE_ID]?.[FLAG_SPELL] === PEDRA_KEY);
                        resolvedFlags = liveItem?.flags?.[MODULE_ID] ?? itemModFlags ?? {};
                        if (!pedraItemId && liveItem) pedraItemId = liveItem.id;
                    } else {
                        resolvedFlags = itemModFlags ?? {};
                    }
                }
            }

            // Camada 3: _pendingPedras — fallback quando t20ItemData é nulo ou
            // sem flags/nome reconhecíveis, mas já sabemos que foi criada uma pedra.
            // IMPORTANTE: NÃO deve disparar quando a msg é o CAST da bola de fogo
            // (que também tem t20ItemData). Usamos extractSpellName para distinguir:
            // se o nome da mensagem é "bola de fogo", é o cast — ignorar Camada 3.
            if (!pedraDetected && speakerActorId && _pendingPedras.has(speakerActorId)) {
                const msgContent  = (message as unknown as { content?: string }).content ?? "";
                const msgItemName = normalizeCondName(extractSpellName(message));
                // Só dispara se NÃO é o cast do spell (nome diferente de "bola de fogo")
                // e a mensagem parece um uso de item do T20.
                const isSpellCast = msgItemName === SPELL_KEY;
                const looksLikeUse = !isSpellCast && (
                    t20ItemData !== undefined
                    || /pedra[\s\-_]?flamejante/i.test(msgContent)
                );
                if (looksLikeUse) {
                    const stored  = _pendingPedras.get(speakerActorId)!;
                    pedraDetected = true;
                    pedraActorId  = speakerActorId;
                    pedraItemId   = stored.itemId;
                    resolvedFlags = stored.meta as unknown as Record<string, unknown>;
                }
            }

            if (pedraDetected && pedraActorId) {
                // Limpa o map independente do caminho que detectou
                _pendingPedras.delete(pedraActorId);
                const pedraActor = (game.actors as unknown as ActorsGetter).get(pedraActorId);
                if (pedraActor) {
                    void handlePedraDetonationFromItemUse(pedraActor, pedraItemId, resolvedFlags);
                    return;
                }
            }
        }
        // ── Fim detecção pedra ───────────────────────────────────────────────

        if (normalizeCondName(extractSpellName(message)) !== SPELL_KEY) return;

        const itemData = message.getFlag("tormenta20", "itemData") as Record<string, unknown> | undefined;
        if (!itemData) return;

        const entries = getOnUseEffects(message);

        // ── DIAGNÓSTICO: log temporário para depurar detecção de aprimoramentos ──
        // Abrir DevTools (F12) → Console para ver os dados reais do T20.
        // Remover após confirmar que a detecção funciona.
        console.warn(
            `[t20-theme-overhaul] Bola de Fogo cast — onUseEffects (${entries.length} entries):`,
            JSON.stringify(entries, null, 2),
        );
        // ── FIM DIAGNÓSTICO ──

        // FASE 2: imp 2 ativo → esfera flamejante persistente
        if (detectImp2Active(entries)) {
            // _pendingEsferaTemplateDelete já foi setado em preCreateChatMessage.
            // O T20 vai criar um MeasuredTemplate de área logo após esse hook;
            // preCreateMeasuredTemplate o cancela antes de aparecer no mapa.
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

        // FASE 3: imp 3 ativo → pedra flamejante no inventário
        if (detectImp3Active(entries)) {
            // _pendingEsferaTemplateDelete já foi setado em preCreateChatMessage.
            // O T20 cria um template de área; preCreateMeasuredTemplate o cancela.
            const imp1Qty       = detectImp1Qty(entries);
            const dice          = 3 + imp1Qty * 2;
            const damageFormula = `${dice}d6[fogo]`;
            const cd            = extractCD(message);
            const resistTxt     = ((itemData["resistencia"] as { txt?: string } | undefined)?.txt ?? "").trim()
                                  || "Reflexos reduz à metade";
            type ActorsGetter   = { get(id: string): PedraActorLike | undefined };
            const actorId       = message.speaker?.actor ?? "";
            const actor         = actorId
                ? (game.actors as unknown as ActorsGetter)?.get(actorId)
                : null;
            if (!actor) {
                ui.notifications?.warn("Bola de Fogo: ator não encontrado para criar Pedra Flamejante.");
                return;
            }
            void createPedraFlamejante(actor, {
                casterActorId: actorId,
                casterName:    message.speaker?.alias ?? "Lançador",
                casterUserId:  uid,
                cd,
                resistTxt,
                damageFormula,
                spellName:     extractSpellName(message),
            }).then((itemId) => {
                if (itemId) {
                    ui.notifications?.info(`Pedra Flamejante criada no inventário. Use o skills-menu para detonar.`);
                    refreshSkillsMenu();
                }
            });
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

    // 2a. preCreateMeasuredTemplate — cancela o template do T20 ANTES de aparecer
    //     quando imp 2 ou 3 ativo. Zero flash no mapa.
    //     (Para FASE 1 não há entrada em _pendingEsferaTemplateDelete → não cancela.)
    Hooks.on("preCreateMeasuredTemplate", (...args: unknown[]) => {
        // pre-hooks: (doc, data, options, userId) → userId em args[3]
        const userId     = typeof args[3] === "string" ? (args[3] as string) : undefined;
        const currentUid = game.user?.id;
        if (!currentUid || userId !== currentUid) return;

        const esferaPendingTs = _pendingEsferaTemplateDelete.get(currentUid);
        if (esferaPendingTs === undefined || Date.now() - esferaPendingTs >= PENDING_WINDOW_MS) return;
        _pendingEsferaTemplateDelete.delete(currentUid);
        return false; // cancela criação — template nunca aparece no mapa
    });

    // 2b. createMeasuredTemplate — caster reclama (FASE 1 explosão)
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

        // ── Backup Ap2/Ap3: preCreateMeasuredTemplate deveria ter cancelado via
        //    return false, mas em alguns cenários do Foundry v13 isso pode não
        //    funcionar (ex.: T20 chama createEmbeddedDocuments por caminho não-hook).
        //    Neste caso o template já foi criado — deletamos imediatamente.
        {
            const esferaBackupTs = _pendingEsferaTemplateDelete.get(currentUid);
            if (esferaBackupTs !== undefined && Date.now() - esferaBackupTs < PENDING_WINDOW_MS) {
                _pendingEsferaTemplateDelete.delete(currentUid);
                void (tplDoc as unknown as { delete?(): Promise<unknown> }).delete?.();
                return;
            }
        }
        // ── Fim backup ──

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

    // 4. createToken — refresh skills menu + concede OWNER (3) ao caster.
    //    Player não tem permissão pra setar ownership ao criar token, então
    //    Foundry ignora silenciosamente o campo `ownership` que passamos em
    //    placeEsfera. Resultado: token nasce com ownership:{} e o player não
    //    consegue arrastar (server rejeita updates). Aqui, no cliente do
    //    GM-ativo, fazemos um update pra granti'r OWNER ao casterUserId.
    Hooks.on("createToken", (...args: unknown[]) => {
        const tokDoc = args[0] as {
            id: string;
            flags?: Record<string, Record<string, unknown>>;
            ownership?: Record<string, number>;
            update(data: Record<string, unknown>): Promise<unknown>;
        };
        const flags = tokDoc.flags?.[MODULE_ID];
        if (flags?.[FLAG_SPELL] !== ESFERA_KEY) {
            refreshSkillsMenu();
            return;
        }
        refreshSkillsMenu();

        if (!isActiveGM()) return;
        const casterUid = flags["casterUserId"] as string | undefined;
        const own = (tokDoc.ownership as Record<string, number> | undefined) ?? {};

        void (async () => {
            // (a) Concede OWNER ao caster se faltar — players não conseguem
            // setar ownership ao criar token, então fazemos server-side.
            if (casterUid && own[casterUid] !== 3) {
                try {
                    await tokDoc.update({ [`ownership.${casterUid}`]: 3 });
                } catch (err) {
                    console.warn(`[t20-theme-overhaul] Bola de Fogo: falha ao conceder OWNER da esfera ao caster (${casterUid}):`, err);
                }
            }

            // (b) Dispara dano imediato se a esfera nasce SOBRE uma criatura.
            // Sem isso, posicionar a esfera no espaço de um alvo não causa
            // dano até a próxima movimentação. Usa applyEsferaDamage com
            // trigger="placed" — passa pela mesma lógica de modal-dispatch
            // e de "1x por rodada" das outras triggers.
            const tileBoxLike = tokDoc as unknown as {
                id: string; uuid: string; x: number; y: number; width: number; height: number;
                flags?: Record<string, Record<string, unknown>>;
                update(data: Record<string, unknown>): Promise<unknown>;
            };
            void applyEsferaDamage(tileBoxLike, "placed");
        })();
    });

    // 5. updateToken — esfera-token moveu (x/y mudou) → aplica dano em TODOS
    //    os tokens-criatura que a esfera intersecta no TRAJETO (não só na
    //    posição final). Gating GM-side via isActiveGM dentro de
    //    applyEsferaDamage.
    Hooks.on("updateToken", (...args: unknown[]) => {
        const tokDoc  = args[0] as {
            id: string; uuid: string; x: number; y: number; width: number; height: number;
            flags?: Record<string, Record<string, unknown>>;
            update(data: Record<string, unknown>): Promise<unknown>;
        };
        const flags = tokDoc.flags?.[MODULE_ID];
        if (!flags || flags[FLAG_SPELL] !== ESFERA_KEY) return;
        const changes = args[1] as Record<string, unknown> | undefined;
        const destX = typeof changes?.["x"] === "number" ? (changes["x"] as number) : undefined;
        const destY = typeof changes?.["y"] === "number" ? (changes["y"] as number) : undefined;
        if (destX === undefined && destY === undefined) return;

        // Quirk v13: tokDoc.x/y é a posição ANTIGA (pré-move); destino vem em
        // changes. Computamos o trajeto e samplemos posições intermediárias.
        const oldX = tokDoc.x;
        const oldY = tokDoc.y;
        const newX = destX ?? oldX;
        const newY = destY ?? oldY;
        if (oldX === newX && oldY === newY) return;

        type CanvasLike = { scene?: { grid?: { size?: number } } };
        const cv       = canvas as unknown as CanvasLike;
        const gridSize = cv.scene?.grid?.size ?? 100;
        const esferaW  = tokDoc.width  * gridSize;
        const esferaH  = tokDoc.height * gridSize;
        const affected = tokensAlongPath(
            { x: oldX, y: oldY },
            { x: newX, y: newY },
            esferaW,
            esferaH,
        );
        void applyEsferaDamage(tokDoc, "moved", affected);
    });

    // 6. deleteToken — esfera-token deletada → refresh skills menu
    Hooks.on("deleteToken", (...args: unknown[]) => {
        const tokDoc = args[0] as { flags?: Record<string, Record<string, unknown>> };
        if (tokDoc.flags?.[MODULE_ID]?.[FLAG_SPELL] === ESFERA_KEY) refreshSkillsMenu();
    });

    // 6b. deleteItem — pedra-flamejante removida do inventário → limpa _pendingPedras
    //     + refresh skills menu (cobre deleção manual, auto-detonação e consumo pelo T20).
    Hooks.on("deleteItem", (...args: unknown[]) => {
        const item = args[0] as {
            flags?:  Record<string, Record<string, unknown>>;
            parent?: { id?: string } | null;
        };
        if (item.flags?.[MODULE_ID]?.[FLAG_SPELL] === PEDRA_KEY) {
            const parentActorId = (item.parent as { id?: string } | null)?.id;
            if (parentActorId) _pendingPedras.delete(parentActorId);
            refreshSkillsMenu();
        }
    });

    // 7. combatTurnChange — tick da esfera no início do turno do caster.
    //    Padrão Aura Sagrada: usar combatTurnChange (não combatTurn) para
    //    pegar o NOVO combatant. Gating GM-side via applyEsferaDamage.
    Hooks.on("combatTurnChange", (...args: unknown[]) => {
        const combat = args[0] as { round?: number; combatant?: { actor?: { id?: string }; tokenId?: string } } | null;
        const newCombatant = combat?.combatant;
        const newActorId   = newCombatant?.actor?.id;
        if (!newActorId) return;

        type TokenLike = {
            id: string; uuid: string; x: number; y: number; width: number; height: number;
            flags?: Record<string, Record<string, unknown>>;
            update(data: Record<string, unknown>): Promise<unknown>;
        };
        type CanvasLike = { scene?: { tokens?: { contents?: TokenLike[] } } };
        const cv     = canvas as unknown as CanvasLike;
        const tokens = cv.scene?.tokens?.contents ?? [];
        for (const tok of tokens) {
            const flags = tok.flags?.[MODULE_ID];
            if (flags?.[FLAG_SPELL] !== ESFERA_KEY) continue;
            if ((flags["casterActorId"] as string | undefined) !== newActorId) continue;
            void applyEsferaDamage(tok, "turn-start");
        }
    });
}

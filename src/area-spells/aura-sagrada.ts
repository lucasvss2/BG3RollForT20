/**
 * Aura Sagrada (Paladino, T20) — Fase 1
 *
 * Diferenças cruciais em relação ao Consagrar:
 *  - A "área" é uma aura emitida pelo TOKEN do paladino, não um
 *    MeasuredTemplate fixo no canvas. Quando o caster se move, a aura
 *    o acompanha — re-sincronizando todos os tokens da cena.
 *  - Não há grid clicável: criamos um MeasuredTemplate "ghost" (visual-only)
 *    centrado no token do caster, atualizado a cada `updateToken` do caster.
 *  - Aliado vs inimigo importa: o AE só vai pro caster e tokens com a MESMA
 *    `disposition` do token-caster (FRIENDLY-FRIENDLY etc.). Hostis nunca
 *    recebem o bônus.
 *  - Aprimoramento "Aura Poderosa" não vem em `onUseEffects` (Aura Sagrada é
 *    `type: "poder"`, não magia). Detectamos pela PRESENÇA de um item chamado
 *    "Aura Poderosa" entre os poderes do caster → raio 30 m em vez de 9 m.
 *  - Duração sustentada: não auto-cancela. O paladino cancela manualmente
 *    pelo mesmo botão flutuante do Consagrar (que ranqueia múltiplas áreas).
 *
 * Aprimoramentos das fases seguintes (não nesta fase):
 *  - Aura Antimagia (re-roll de resistência contra magia)
 *  - Aura Ardente (dano por turno a mortos-vivos/espíritos escolhidos)
 *  - Aura de Cura (cura por turno em aliados escolhidos)
 *  - Aura de Invencibilidade (ignora 1º dano da cena)
 *  - Aura Poderosa (já implementada nesta fase — só altera o raio)
 */

import { MODULE_ID } from "@/constants";
import { extractSpellName, normalizeCondName, getMsgAuthorId } from "@/spell-resistance/index";

// Valor RETORNADO por normalizeCondName("Aura Sagrada") — esse helper só
// faz lowercase + remove acentos, NÃO substitui espaço por hífen. Manter o
// espaço aqui é essencial pra detecção do cast funcionar.
const SPELL_NAME_NORMALIZED = "aura sagrada";
const SPELL_KEY      = "aura-sagrada";        // identificador interno (flag/template)
const FLAG_SPELL     = "spell";               // template flag: identifica a aura
const FLAG_ORIGIN    = "auraSagradaTemplateOrigin"; // AE flag: liga AE ao template
const FLAG_CASTER    = "casterTokenId";       // template flag: token que emite
const FLAG_CASTER_AID = "casterActorId";      // template flag: actor do caster
const POWERFUL_AURA_NORMALIZED = "aura poderosa"; // (idem: sem hífen)

const RAIO_PADRAO_M  = 9;
const RAIO_PODEROSA_M = 30;

// ── Helpers genéricos ─────────────────────────────────────────────────────────

function isActiveGM(): boolean {
    const myId = game.user?.id;
    if (!myId || !game.user?.isGM) return false;
    const activeGMs = (game.users?.contents ?? [])
        .filter(u => u.isGM && u.active)
        .map(u => u.id)
        .sort();
    return activeGMs[0] === myId;
}

/** True se o ator (caster) tem o aprimoramento "Aura Poderosa" entre seus poderes. */
function hasAuraPoderosa(actor: FoundryActor | null | undefined): boolean {
    if (!actor) return false;
    type ItemLike = { type?: string; name?: string };
    const items = (actor as unknown as { items?: { contents?: ItemLike[] } }).items?.contents ?? [];
    return items.some(it => normalizeCondName(it.name ?? "") === POWERFUL_AURA_NORMALIZED);
}

/** Posição do token em PIXELS, com possível override (destino do movimento). */
function getTokenPosPx(
    token: FoundryToken,
    overrideXY?: { x?: number; y?: number },
): { x: number; y: number; widthSq: number; heightSq: number } {
    type TokenDoc = {
        document?: { x?: number; y?: number; width?: number; height?: number };
        x?: number; y?: number;
    };
    const t = token as unknown as TokenDoc;
    const doc = t.document;
    return {
        x:        overrideXY?.x ?? doc?.x ?? t.x ?? 0,
        y:        overrideXY?.y ?? doc?.y ?? t.y ?? 0,
        widthSq:  doc?.width  ?? 1,
        heightSq: doc?.height ?? 1,
    };
}

/** Centro do token em pixels (já considerando width/height do token). */
function getTokenCenterPx(
    token: FoundryToken,
    overrideXY?: { x?: number; y?: number },
): { x: number; y: number } {
    type CanvasLike = { scene?: { grid?: { size?: number } } };
    const cv       = canvas as unknown as CanvasLike;
    const gridSize = cv.scene?.grid?.size ?? 100;
    const pos      = getTokenPosPx(token, overrideXY);
    return {
        x: pos.x + (pos.widthSq  * gridSize) / 2,
        y: pos.y + (pos.heightSq * gridSize) / 2,
    };
}

function isTokenInsideTemplate(
    token: FoundryToken,
    template: { x: number; y: number; distance: number },
    overrideXY?: { x?: number; y?: number },
): boolean {
    type CanvasLike = { scene?: { grid?: { size?: number; distance?: number } } };
    const cv       = canvas as unknown as CanvasLike;
    const gridSize = cv.scene?.grid?.size     ?? 100;
    const gridDist = cv.scene?.grid?.distance ?? 1.5;

    const radiusSq = template.distance / gridDist;
    const tCxSq    = template.x / gridSize;
    const tCySq    = template.y / gridSize;

    const c = getTokenCenterPx(token, overrideXY);
    const cx = c.x / gridSize;
    const cy = c.y / gridSize;
    const dx = cx - tCxSq;
    const dy = cy - tCySq;
    return Math.sqrt(dx * dx + dy * dy) <= radiusSq;
}

/** Token na cena cujo `actor.id` bate com o id dado (linked ou unlinked). */
function findTokenForActor(actorId: string): FoundryToken | null {
    type CanvasLike = { tokens?: { placeables?: FoundryToken[] } };
    const cv = canvas as unknown as CanvasLike;
    for (const t of (cv.tokens?.placeables ?? [])) {
        const aid = (t.actor as unknown as { id?: string } | null)?.id;
        if (aid === actorId) return t;
    }
    return null;
}

/**
 * Disposition de um token. Cobre tanto Foundry v11+ (token.document.disposition)
 * quanto o legacy (token.data.disposition). Default: NEUTRAL (0).
 */
function getTokenDisposition(token: FoundryToken): number {
    type TokenLike = {
        document?: { disposition?: number };
        data?:     { disposition?: number };
    };
    const t = token as unknown as TokenLike;
    return t.document?.disposition ?? t.data?.disposition ?? 0;
}

/** Caster + tokens com a mesma disposition do caster. */
function isAuraTarget(
    token: FoundryToken,
    casterTokenId: string,
    casterDisposition: number,
): boolean {
    const tokenId = (token as unknown as { id?: string }).id;
    if (tokenId === casterTokenId) return true; // o caster sempre se inclui
    return getTokenDisposition(token) === casterDisposition;
}

// ── Detecção do cast ─────────────────────────────────────────────────────────

/**
 * `extractSpellName` resolve o nome do item via `data-item-id` no content
 * (`game.actors.get(actorId).items.get(itemId).name`) — funciona pra poderes
 * tanto quanto pra magias. NÃO confiar em `flags.tormenta20.itemData.name`:
 * em poderes do T20 o `itemData` é só o `.system` (sem `name` top-level).
 */
function isAuraSagradaMessage(message: ChatMessage): boolean {
    const name = extractSpellName(message);
    return normalizeCondName(name) === SPELL_NAME_NORMALIZED;
}

/**
 * Extrai a primeira AEData (changes/duration/etc) do `flags.tormenta20.effects`
 * — esse é o efeito do +CHA em resistências, já calculado pelo T20 no momento
 * do cast (CHA do CASTER, valor numérico em string como "9").
 */
function extractBaseEffectData(message: ChatMessage): Record<string, unknown> | null {
    type EffectsShape = Array<Array<Record<string, unknown>>>;
    const t20 = (message.flags as Record<string, unknown> | undefined)?.tormenta20 as
        | { effects?: EffectsShape } | undefined;
    const first = t20?.effects?.[0]?.[0];
    return (first as Record<string, unknown> | undefined) ?? null;
}

// ── Template ghost: criação / sync ───────────────────────────────────────────

function buildAuraFlags(meta: {
    casterActorId: string; casterTokenId: string; casterName: string; raioM: number;
}): Record<string, unknown> {
    return {
        [FLAG_SPELL]:       SPELL_KEY,
        [FLAG_CASTER]:      meta.casterTokenId,
        [FLAG_CASTER_AID]:  meta.casterActorId,
        casterName:         meta.casterName,
        raioM:              meta.raioM,
        creatorUserId:      game.user?.id ?? "",
        createdAtGameTime:  (game as unknown as { time?: { worldTime?: number } }).time?.worldTime ?? 0,
    };
}

async function createGhostTemplate(opts: {
    casterToken: FoundryToken;
    casterActorId: string;
    casterName: string;
    raioM: number;
}): Promise<string | null> {
    type SceneLike = FoundryActor & {
        createEmbeddedDocuments(t: string, data: unknown[], opts?: Record<string, unknown>): Promise<unknown[]>;
    };
    type CanvasLike = { scene?: SceneLike };
    const cv    = canvas as unknown as CanvasLike;
    const scene = cv.scene;
    if (!scene) return null;

    const center = getTokenCenterPx(opts.casterToken);
    const tokenId = (opts.casterToken as unknown as { id?: string }).id ?? "";

    const data = {
        t: "circle",
        user: game.user?.id,
        distance: opts.raioM,
        direction: 0,
        angle: 0,
        x: center.x,
        y: center.y,
        // Dourado mais claro/quente que o Consagrar (`#ffd86b`), pra distinguir
        // visualmente e refletir "luz dourada e agradável" do texto da skill.
        fillColor:  "#ffe89a",
        borderColor: "#c9a76a",
        flags: { [MODULE_ID]: buildAuraFlags({
            casterActorId: opts.casterActorId,
            casterTokenId: tokenId,
            casterName:    opts.casterName,
            raioM:         opts.raioM,
        }) },
    };

    try {
        const created = await scene.createEmbeddedDocuments("MeasuredTemplate", [data]);
        const tpl = created?.[0] as { id?: string } | undefined;
        return tpl?.id ?? null;
    } catch (err) {
        console.warn(`[${MODULE_ID}] Aura Sagrada: falha ao criar template:`, err);
        return null;
    }
}

/** Lista todos os templates de Aura Sagrada na cena atual. */
type AuraTpl = {
    id: string; uuid: string; x: number; y: number; distance: number;
    flags?: Record<string, Record<string, unknown>>;
    update(data: Record<string, unknown>): Promise<unknown>;
};

function getAuraTemplates(): AuraTpl[] {
    type SceneLike = { templates?: { contents?: AuraTpl[] } };
    const cv = canvas as unknown as { scene?: SceneLike };
    const list = cv.scene?.templates?.contents ?? [];
    return list.filter(t => t.flags?.[MODULE_ID]?.[FLAG_SPELL] === SPELL_KEY);
}

/** Templates emitidos por este caster (token ID). Substituiremos se ele recastar. */
function getCasterTemplates(casterTokenId: string): AuraTpl[] {
    return getAuraTemplates().filter(t =>
        t.flags?.[MODULE_ID]?.[FLAG_CASTER] === casterTokenId
    );
}

// ── AE apply / remove ────────────────────────────────────────────────────────

const _applyInProgress = new Set<string>();

function tokenHasAuraEffectFrom(actor: FoundryActor, templateId: string): boolean {
    return (actor.effects?.contents ?? []).some(e =>
        (e.flags?.[MODULE_ID] as Record<string, unknown> | undefined)?.[FLAG_ORIGIN] === templateId
    );
}

function buildEffectDataFromTemplate(template: AuraTpl): Record<string, unknown> | null {
    const baseRaw = template.flags?.[MODULE_ID]?.["baseEffectData"];
    if (!baseRaw) return null;
    const base = baseRaw as Record<string, unknown>;
    // Clona e injeta a flag de origem do nosso template
    const cloned: Record<string, unknown> = JSON.parse(JSON.stringify(base));
    // Reset metadados de identidade pra que cada AE seja documento novo
    delete (cloned as Record<string, unknown>)["_id"];
    delete (cloned as Record<string, unknown>)["_stats"];
    cloned["origin"] = template.uuid;
    cloned["transfer"] = false;
    const flags = (cloned["flags"] as Record<string, Record<string, unknown>> | undefined) ?? {};
    flags[MODULE_ID] = { ...(flags[MODULE_ID] ?? {}), [FLAG_ORIGIN]: template.id };
    cloned["flags"] = flags;
    // Nome fica "Aura Sagrada" — já vem do baseEffectData
    return cloned;
}

async function applyAuraToToken(token: FoundryToken, template: AuraTpl): Promise<boolean> {
    const actor = token.actor;
    if (!actor) return false;
    const actorId = (actor as unknown as { id?: string }).id ?? "";
    const lockKey = `${actorId}::${template.id}`;
    if (_applyInProgress.has(lockKey)) return false;
    if (tokenHasAuraEffectFrom(actor, template.id)) return false;
    _applyInProgress.add(lockKey);
    try {
        if (tokenHasAuraEffectFrom(actor, template.id)) return false;
        const data = buildEffectDataFromTemplate(template);
        if (!data) return false;
        await (actor as FoundryActor & {
            createEmbeddedDocuments(t: string, data: unknown[]): Promise<unknown>;
        }).createEmbeddedDocuments("ActiveEffect", [data]);
        return true;
    } catch (err) {
        console.warn(`[${MODULE_ID}] Aura Sagrada apply em ${actor.name}:`, err);
        return false;
    } finally {
        _applyInProgress.delete(lockKey);
    }
}

async function removeAuraFromToken(token: FoundryToken, templateId: string): Promise<boolean> {
    const actor = token.actor;
    if (!actor) return false;
    const ours = (actor.effects?.contents ?? []).filter(e =>
        (e.flags?.[MODULE_ID] as Record<string, unknown> | undefined)?.[FLAG_ORIGIN] === templateId
    );
    if (ours.length === 0) return false;
    try {
        await (actor as FoundryActor & {
            deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>;
        }).deleteEmbeddedDocuments("ActiveEffect", ours.map(e => e.id));
        return true;
    } catch (err) {
        console.warn(`[${MODULE_ID}] Aura Sagrada remove em ${actor.name}:`, err);
        return false;
    }
}

/**
 * Re-sincroniza UM token contra todos os templates Aura Sagrada da cena,
 * respeitando disposition (só caster + aliados com mesma disposition recebem).
 */
const _syncInProgress = new Set<string>();
type PendingSync = { token: FoundryToken; overrideXY?: { x?: number; y?: number } };
const _syncPending = new Map<string, PendingSync>();

async function syncTokenWithAuras(
    token: FoundryToken,
    overrideXY?: { x?: number; y?: number },
): Promise<void> {
    if (!isActiveGM()) return;
    if (!token.actor) return;
    const tokenId = (token as unknown as { id?: string }).id ?? "";
    if (!tokenId) return;

    if (_syncInProgress.has(tokenId)) {
        _syncPending.set(tokenId, { token, overrideXY });
        return;
    }
    _syncInProgress.add(tokenId);
    try {
        const templates = getAuraTemplates();
        if (templates.length === 0) {
            // Sem auras ativas — limpa AEs órfãs deste sistema
            const orphans = (token.actor.effects?.contents ?? []).filter(e =>
                (e.flags?.[MODULE_ID] as Record<string, unknown> | undefined)?.[FLAG_ORIGIN] != null
            );
            if (orphans.length > 0) {
                try {
                    await (token.actor as FoundryActor & {
                        deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>;
                    }).deleteEmbeddedDocuments("ActiveEffect", orphans.map(e => e.id));
                } catch { /* ignore */ }
            }
            return;
        }
        for (const tpl of templates) {
            const casterTokenId   = tpl.flags?.[MODULE_ID]?.[FLAG_CASTER] as string | undefined;
            if (!casterTokenId) continue;
            const casterToken     = findTokenForActor(
                (tpl.flags?.[MODULE_ID]?.[FLAG_CASTER_AID] as string | undefined) ?? ""
            );
            const casterDisp      = casterToken ? getTokenDisposition(casterToken) : 0;
            const eligible        = isAuraTarget(token, casterTokenId, casterDisp);
            const inside          = isTokenInsideTemplate(token, tpl, overrideXY);
            const has             = tokenHasAuraEffectFrom(token.actor, tpl.id);

            if (eligible && inside && !has)            await applyAuraToToken(token, tpl);
            if ((!eligible || !inside) && has)         await removeAuraFromToken(token, tpl.id);
        }
    } finally {
        _syncInProgress.delete(tokenId);
        const pending = _syncPending.get(tokenId);
        if (pending) {
            _syncPending.delete(tokenId);
            void syncTokenWithAuras(pending.token, pending.overrideXY);
        }
    }
}

/** Re-sync de TODOS os tokens — usado quando o caster se move ou o template muda. */
async function resyncAllTokens(overrideForToken?: {
    tokenId: string; xy: { x?: number; y?: number };
}): Promise<void> {
    if (!isActiveGM()) return;
    type CanvasLike = { tokens?: { placeables?: FoundryToken[] } };
    const cv = canvas as unknown as CanvasLike;
    const tokens = cv.tokens?.placeables ?? [];
    for (const tk of tokens) {
        if (!tk.actor) continue;
        const tid = (tk as unknown as { id?: string }).id;
        const ov  = (overrideForToken && overrideForToken.tokenId === tid)
            ? overrideForToken.xy
            : undefined;
        await syncTokenWithAuras(tk, ov);
    }
}

/** Remove TODOS os AEs criados por este template (usado no delete do template). */
async function cleanupAEsForTemplate(templateId: string): Promise<void> {
    if (!isActiveGM()) return;
    type CanvasLike = { tokens?: { placeables?: FoundryToken[] } };
    const cv = canvas as unknown as CanvasLike;
    const actorsSet = new Set<FoundryActor>();
    for (const a of ((game.actors?.contents ?? []) as unknown as FoundryActor[])) {
        if (a) actorsSet.add(a);
    }
    for (const tk of (cv.tokens?.placeables ?? [])) {
        if (tk.actor) actorsSet.add(tk.actor);
    }
    let removed = 0;
    for (const actor of actorsSet) {
        const ours = (actor.effects?.contents ?? []).filter(e =>
            (e.flags?.[MODULE_ID] as Record<string, unknown> | undefined)?.[FLAG_ORIGIN] === templateId
        );
        if (ours.length === 0) continue;
        try {
            await (actor as FoundryActor & {
                deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>;
            }).deleteEmbeddedDocuments("ActiveEffect", ours.map(e => e.id));
            removed += ours.length;
        } catch (err) {
            console.warn(`[${MODULE_ID}] Aura Sagrada cleanup em ${actor.name}:`, err);
        }
    }
    if (removed > 0) {
        ui.notifications?.info(`Aura Sagrada: ${removed} efeito(s) removido(s)`);
    }
}

// ── Pipeline de cast ─────────────────────────────────────────────────────────

/**
 * Dispara após detectar o card de Aura Sagrada no chat. Cria/recria o template
 * ghost no centro do token-caster e aplica os AEs aos elegíveis na cena.
 *
 * Regra "1 aura por caster": se o caster já tem aura ativa, ela é removida
 * primeiro (que limpa os AEs antigos) antes da nova ser criada.
 */
async function onAuraSagradaCast(message: ChatMessage): Promise<void> {
    const casterActorId = message.speaker?.actor;
    if (!casterActorId) return;
    const casterActor = game.actors?.get(casterActorId);
    if (!casterActor) return;
    const casterToken = findTokenForActor(casterActorId);
    if (!casterToken) {
        ui.notifications?.warn(
            "Aura Sagrada: token do paladino não encontrado na cena. Coloque o token e tente de novo.",
            { permanent: false }
        );
        return;
    }
    const casterTokenId = (casterToken as unknown as { id?: string }).id ?? "";

    const baseEffect = extractBaseEffectData(message);
    if (!baseEffect) {
        console.warn(`[${MODULE_ID}] Aura Sagrada: mensagem sem effects[0][0] — abortando.`);
        return;
    }

    const raioM = hasAuraPoderosa(casterActor) ? RAIO_PODEROSA_M : RAIO_PADRAO_M;

    type SceneLike = { deleteEmbeddedDocuments?(t: string, ids: string[]): Promise<unknown> };
    const scene = (canvas as unknown as { scene?: SceneLike }).scene;

    // 1. Limpa auras anteriores do mesmo caster (deletar template dispara cleanup dos AEs)
    const previas = getCasterTemplates(casterTokenId);
    if (previas.length > 0 && scene?.deleteEmbeddedDocuments) {
        try {
            await scene.deleteEmbeddedDocuments("MeasuredTemplate", previas.map(t => t.id));
        } catch { /* ignore */ }
    }

    // 2. Cria template ghost
    const newTplId = await createGhostTemplate({
        casterToken,
        casterActorId,
        casterName: message.speaker?.alias ?? casterActor.name ?? "Paladino",
        raioM,
    });
    if (!newTplId) return;

    // 3. Anexa o baseEffectData ao flag do template (depois usamos pra criar AEs)
    //    Fazemos via update porque createEmbeddedDocuments não retorna o doc com
    //    todos os helpers; pegamos pela cena.
    const tplDoc = getAuraTemplates().find(t => t.id === newTplId);
    if (!tplDoc) return;
    try {
        await tplDoc.update({ [`flags.${MODULE_ID}.baseEffectData`]: baseEffect });
    } catch (err) {
        console.warn(`[${MODULE_ID}] Aura Sagrada: falha ao anexar baseEffectData:`, err);
        return;
    }

    // 4. Aplica AEs em todos os elegíveis (caster + aliados dentro)
    //    NB: o `updateMeasuredTemplate` resultante do passo 3 já chama resync;
    //    forçamos aqui também por garantia (caso GM não esteja com sync ativo).
    if (isActiveGM()) await resyncAllTokens();

    ui.notifications?.info(
        `Aura Sagrada ativada (raio ${raioM}m${raioM === RAIO_PODEROSA_M ? " — Aura Poderosa" : ""}).`
    );
}

// ── Sync no movimento do caster ──────────────────────────────────────────────
//
// Quando o caster move, atualizamos o `x/y` do template ghost pra acompanhar.
// Usamos destX/destY do `changes` (quirk v13) e disparamos resync de todos os
// tokens — porque mover o caster pode fazer outros tokens entrarem/saírem da
// área, mesmo que esses tokens estejam parados.

async function moveAuraWithCaster(
    casterToken: FoundryToken,
    overrideXY?: { x?: number; y?: number },
): Promise<void> {
    const casterTokenId = (casterToken as unknown as { id?: string }).id ?? "";
    if (!casterTokenId) return;
    const mine = getCasterTemplates(casterTokenId);
    if (mine.length === 0) return;

    const newCenter = getTokenCenterPx(casterToken, overrideXY);
    for (const tpl of mine) {
        if (Math.abs(tpl.x - newCenter.x) < 1 && Math.abs(tpl.y - newCenter.y) < 1) continue;
        try {
            await tpl.update({ x: newCenter.x, y: newCenter.y });
        } catch (err) {
            console.warn(`[${MODULE_ID}] Aura Sagrada: falha ao mover template:`, err);
        }
    }
    // O `updateMeasuredTemplate` resultante do .update vai disparar resync.
    // Mas pra cobrir o caso de tokens parados que ENTRAM/SAEM, garantimos aqui:
    if (isActiveGM()) {
        await resyncAllTokens({ tokenId: casterTokenId, xy: overrideXY ?? {} });
    }
}

// ── Setup (hooks) ────────────────────────────────────────────────────────────

export function setupAuraSagrada(): void {
    // Setting: "sempre perguntar antes de aplicar efeitos de início de turno"
    // (usado por aprimoramentos futuros — Aura de Cura, Aura Ardente — não
    // tem efeito nesta fase mas já registramos pra UX consistente).
    try {
        game.settings.register(MODULE_ID, "auraSagrada.alwaysPromptStartOfTurn", {
            name: "Aura Sagrada: sempre perguntar no início do turno",
            hint: "Quando ativado, abre um diálogo de escolha de alvos no início do turno do paladino para Aura de Cura e Aura Ardente. Caso contrário, aplica em todos os elegíveis automaticamente.",
            scope: "client",
            config: true,
            type: Boolean,
            default: false,
        });
    } catch { /* já registrado / config indisponível */ }

    // 1. Detectar cast no chat
    Hooks.on("createChatMessage", (...args: unknown[]) => {
        const message = args[0] as ChatMessage;
        if (!isAuraSagradaMessage(message)) return;
        const uid = getMsgAuthorId(message);
        if (uid !== game.user?.id) return; // só o autor dispara a criação
        void onAuraSagradaCast(message);
    });

    // 2. Movimento de qualquer token: re-sync (e se for o caster, mover template)
    Hooks.on("updateToken", (...args: unknown[]) => {
        if (getAuraTemplates().length === 0) return;
        const tokenDoc = args[0] as { object?: FoundryToken; id?: string };
        const changes  = args[1] as Record<string, unknown> | undefined;
        const token    = tokenDoc.object;
        if (!token) return;
        const tokenId  = (token as unknown as { id?: string }).id ?? "";
        const destX = typeof changes?.["x"] === "number" ? (changes["x"] as number) : undefined;
        const destY = typeof changes?.["y"] === "number" ? (changes["y"] as number) : undefined;
        const overrideXY = (destX !== undefined || destY !== undefined)
            ? { x: destX, y: destY } : undefined;

        // Se este token É caster de alguma aura: mover template e re-sync de todos
        const isCaster = getAuraTemplates().some(t =>
            t.flags?.[MODULE_ID]?.[FLAG_CASTER] === tokenId
        );
        if (isCaster) {
            void moveAuraWithCaster(token, overrideXY);
        } else {
            void syncTokenWithAuras(token, overrideXY);
        }
    });

    // 3. Template Aura Sagrada atualizado (posição/raio) → resync todos
    Hooks.on("updateMeasuredTemplate", (...args: unknown[]) => {
        const tplDoc  = args[0] as AuraTpl;
        const changes = args[1] as Record<string, unknown>;
        if (tplDoc.flags?.[MODULE_ID]?.[FLAG_SPELL] !== SPELL_KEY) return;
        const movedOrResized =
            changes["x"] !== undefined ||
            changes["y"] !== undefined ||
            changes["distance"] !== undefined;
        const flagAdded =
            !!((changes["flags"] as Record<string, Record<string, unknown>> | undefined)?.[MODULE_ID]);
        if (!movedOrResized && !flagAdded) return;
        if (!isActiveGM()) return;
        void resyncAllTokens();
    });

    // 4. Template deletado → limpar AEs
    Hooks.on("deleteMeasuredTemplate", (...args: unknown[]) => {
        const template = args[0] as { id: string; flags?: Record<string, Record<string, unknown>> };
        if (template.flags?.[MODULE_ID]?.[FLAG_SPELL] !== SPELL_KEY) return;
        void cleanupAEsForTemplate(template.id);
    });

    // 5. Novo token criado → checa se cai em alguma aura
    Hooks.on("createToken", (...args: unknown[]) => {
        if (getAuraTemplates().length === 0) return;
        const tokenDoc = args[0] as { object?: FoundryToken };
        const token = tokenDoc.object;
        if (!token) return;
        void syncTokenWithAuras(token);
    });

    // 6. Mudou a disposition de um token: aliados podem ter virado hostis (ou vice-versa)
    //    e precisam ter o AE removido/aplicado. updateToken cobre via changes; aqui só
    //    garantimos resync se um campo de disposition mudar.
    Hooks.on("updateToken", (...args: unknown[]) => {
        if (getAuraTemplates().length === 0) return;
        const changes = args[1] as Record<string, unknown> | undefined;
        if (changes?.["disposition"] === undefined) return;
        const tokenDoc = args[0] as { object?: FoundryToken };
        const token = tokenDoc.object;
        if (!token) return;
        void syncTokenWithAuras(token);
    });

    // 7. Carregar cena → re-sync tokens com auras existentes
    Hooks.on("canvasReady", () => {
        if (!isActiveGM()) return;
        const templates = getAuraTemplates();
        if (templates.length === 0) return;
        void resyncAllTokens();
    });
}

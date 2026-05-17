/**
 * Consagrar — magia de área persistente (T20)
 *
 * FASE 1 (este arquivo):
 *  - Detecta quando "Consagrar" é castada
 *  - Pede ao lançador para clicar no canvas para posicionar a área
 *  - Cria um MeasuredTemplate (esfera 9m) com flag identificando como Consagrar
 *  - Cliente do GM (no hook createMeasuredTemplate) percorre tokens dentro
 *    da área e aplica os AEs apropriados:
 *      - Mortos-vivos: penalidade (-2 testes/defesa, +N do aprimoramento)
 *      - Vivos: efeito de "Cura Aprimorada" (flag — integração com modal de
 *        cura virá depois)
 *  - Quando o template é deletado, todos os AEs criados por ele são removidos
 *
 * FASE 2 (futuro): tracking de entrada/saída via updateToken / createToken,
 * para que criaturas que entrem depois do cast também recebam (e quem sair
 * perca) os efeitos.
 */

import { MODULE_ID } from "@/constants";
import { extractSpellName, normalizeCondName, getMsgAuthorId } from "@/spell-resistance/index";

const SPELL_KEY = "consagrar";
const FLAG_SPELL = "spell";                          // template flag: identifica como Consagrar
const FLAG_EFFECT_ORIGIN = "consagrarTemplateOrigin"; // AE flag: ID do template que criou
const FLAG_HEAL_BOOST = "consagrarHealingBoost";      // AE flag: marca o effect de cura aprimorada

const RAIO_METROS = 9;
const PENALIDADE_BASE = 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Lê o conteúdo da mensagem para detectar quantos níveis do aprimoramento
 * "aumenta as penalidades para mortos-vivos em –1" foram ativados.
 * Cada nível adiciona +1 à penalidade base (-2).
 */
function parseEnhancementBonus(content: string): number {
    if (!/penalidades.*?(?:morto[-\s]?vivos|undead).*?[-–]\s*\d/i.test(content)) return 0;
    // Tenta extrair o valor numérico (T20 reflete o nível somado, ex: "em -2")
    const m = content.match(/penalidades.*?(?:morto[-\s]?vivos|undead).*?em\s+[-–]\s*(\d+)/i);
    return m ? Math.max(0, parseInt(m[1], 10)) : 1;
}

/**
 * Detecta se o ator é morto-vivo.
 *
 * NPCs: `actor.system.detalhes.raca === "Morto-vivo"` (campo direto)
 * PCs:  item de tipo "race" com nome "Osteon" ou "Soterrado"
 */
function isUndead(actor: FoundryActor): boolean {
    // NPCs — campo direto
    type DetalhesShape = { detalhes?: { raca?: string } };
    const raca = (actor.system as DetalhesShape | undefined)?.detalhes?.raca;
    if (typeof raca === "string" && raca !== "" && normalizeCondName(raca) === "morto-vivo") {
        return true;
    }
    // PCs — item de raça undead (Osteon, Soterrado)
    type ItemLike = { type?: string; name?: string };
    const items = (actor as unknown as { items?: { contents?: ItemLike[] } }).items?.contents ?? [];
    return items.some(item => {
        if (item.type !== "race") return false;
        const n = typeof item.name === "string" ? normalizeCondName(item.name) : "";
        return n === "osteon" || n === "soterrado";
    });
}

/**
 * Calcula tokens cujo centro está dentro do raio do template.
 *
 * Tudo é expresso em QUADRADOS (não pixels) para ser independente do tamanho
 * de pixel por quadrado de cada cena.
 *
 * - template.x / template.y são pixels → dividir por gridSize → quadrados
 * - token.document.x / y são pixels  → dividir por gridSize → quadrados
 * - token.document.width / height já estão em quadrados (Foundry v13)
 * - template.distance está em metros → dividir por gridDist (metros/quadrado)
 *   → raio em quadrados (ex.: 9m / 1.5m = 6 quadrados)
 *
 * Usa token.document em vez de token.center/token.x para evitar posições
 * obsoletas durante a animação de movimento.
 */
function tokensInTemplate(template: {
    x: number; y: number; distance: number;
}): FoundryToken[] {
    type CanvasLike = {
        tokens?: { placeables?: FoundryToken[] };
        scene?: { grid?: { size?: number; distance?: number } };
    };
    const cv       = canvas as unknown as CanvasLike;
    const tokens   = cv.tokens?.placeables ?? [];
    const gridSize = cv.scene?.grid?.size     ?? 100; // px/quadrado
    const gridDist = cv.scene?.grid?.distance ?? 1.5; // m/quadrado

    // Raio em quadrados: 9m / 1.5m = 6 quadrados (independente de px/quadrado)
    const radiusSq = template.distance / gridDist;

    // Centro do template em quadrados
    const tCxSq = template.x / gridSize;
    const tCySq = template.y / gridSize;

    return tokens.filter(token => {
        type TokenDoc = {
            document?: { x?: number; y?: number; width?: number; height?: number };
            x?: number; y?: number;
        };
        const t   = token as unknown as TokenDoc;
        const doc = t.document;
        const docXpx = doc?.x ?? t.x ?? 0;
        const docYpx = doc?.y ?? t.y ?? 0;
        // document.width/height em quadrados (padrão 1)
        const widthSq  = doc?.width  ?? 1;
        const heightSq = doc?.height ?? 1;
        // Centro do token em quadrados
        const cx = docXpx / gridSize + widthSq  / 2;
        const cy = docYpx / gridSize + heightSq / 2;
        const dx = cx - tCxSq;
        const dy = cy - tCySq;
        return Math.sqrt(dx * dx + dy * dy) <= radiusSq;
    });
}

/** Promise que resolve quando o usuário clica no canvas (ou ESC para cancelar). */
async function promptCanvasClick(): Promise<{ x: number; y: number } | null> {
    return new Promise((resolve) => {
        ui.notifications?.info(`Clique no canvas para posicionar a área de Consagrar (esfera de ${RAIO_METROS}m de raio). ESC cancela.`);
        type StageLike = {
            once?(event: string, fn: (e: unknown) => void): void;
            on?(event: string, fn: (e: unknown) => void): void;
            off?(event: string, fn: (e: unknown) => void): void;
        };
        type CanvasLike = { app?: { stage?: StageLike }; stage?: StageLike };
        const cv = canvas as unknown as CanvasLike;
        const stage = cv.app?.stage ?? cv.stage;
        if (!stage?.on || !stage?.off) {
            resolve(null);
            return;
        }

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
                ui.notifications?.info("Consagrar: posicionamento cancelado");
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

// ── Template placement ───────────────────────────────────────────────────────
//
// Estratégia (v1.6.65+): NÃO criamos mais um MeasuredTemplate por conta própria.
// O sistema T20 já cria seu template animado quando a magia é lançada — antes
// estávamos criando UM SEGUNDO template, daí o usuário via duas áreas. Agora:
//   1. Detectamos o cast → registramos um "pending"
//   2. Quando o T20 (ou qualquer outro caminho) cria um MeasuredTemplate pelo
//      usuário lançador, reclamamos esse template adicionando nossas flags via
//      doc.update(). A partir desse ponto ele é tratado como template Consagrar.
//   3. Se nenhum template aparecer em FALLBACK_PROMPT_MS, abrimos NOSSO próprio
//      prompt manual (placeTemplateManual) — fallback para spells/configurações
//      em que o T20 não auto-posiciona.

type PendingCast = {
    casterActorId: string;
    casterName:    string;
    undeadPenalty: number;
    ts:            number;
    fallbackTimer?: ReturnType<typeof setTimeout>;
};
const _pendingCasts      = new Map<string, PendingCast>(); // key: userId
const PENDING_WINDOW_MS  = 30_000;
const FALLBACK_PROMPT_MS = 4_000;

function clearPending(uid: string): void {
    const p = _pendingCasts.get(uid);
    if (p?.fallbackTimer) clearTimeout(p.fallbackTimer);
    _pendingCasts.delete(uid);
}

function registerPendingCast(uid: string, cast: Omit<PendingCast, "ts" | "fallbackTimer">): void {
    clearPending(uid);
    const entry: PendingCast = { ...cast, ts: Date.now() };
    entry.fallbackTimer = setTimeout(() => {
        // Se ainda está pendente após FALLBACK_PROMPT_MS, o T20 não criou
        // template; recorremos ao prompt manual.
        const still = _pendingCasts.get(uid);
        if (!still || still.ts !== entry.ts) return;
        _pendingCasts.delete(uid);
        void placeTemplateManual(entry);
    }, FALLBACK_PROMPT_MS);
    _pendingCasts.set(uid, entry);
}

/** Constrói o objeto de flags Consagrar para um template (criação ou claim). */
function buildConsagrarFlags(meta: {
    casterActorId: string; casterName: string; undeadPenalty: number;
}): Record<string, unknown> {
    return {
        [FLAG_SPELL]:       SPELL_KEY,
        casterActorId:      meta.casterActorId,
        casterName:         meta.casterName,
        undeadPenalty:      meta.undeadPenalty,
        createdAtGameTime:  (game as unknown as { time?: { worldTime?: number } }).time?.worldTime ?? 0,
        creatorUserId:      game.user?.id ?? "",
    };
}

/**
 * Reclama um template existente (criado pelo T20) adicionando as flags do
 * Consagrar via doc.update. O `updateMeasuredTemplate` hook se encarrega de
 * disparar a aplicação dos AEs no cliente GM.
 */
async function claimTemplate(
    tplDoc: { update(data: Record<string, unknown>): Promise<unknown> },
    pending: PendingCast,
): Promise<void> {
    try {
        await tplDoc.update({ [`flags.${MODULE_ID}`]: buildConsagrarFlags(pending) });
        ui.notifications?.info(`Consagrar ativada (penalidade undead -${pending.undeadPenalty}).`);
    } catch (err) {
        console.warn(`[${MODULE_ID}] Consagrar: falha ao reclamar template:`, err);
    }
}

/**
 * Fallback: cria nosso próprio template via prompt manual. Só roda se o T20
 * não criar um template automaticamente dentro de FALLBACK_PROMPT_MS após o
 * cast.
 */
async function placeTemplateManual(meta: {
    casterActorId: string;
    casterName:    string;
    undeadPenalty: number;
}): Promise<void> {
    const pos = await promptCanvasClick();
    if (!pos) return;

    type SceneLike = FoundryActor & {
        createEmbeddedDocuments(t: string, data: unknown[], opts?: Record<string, unknown>): Promise<unknown>;
    };
    type CanvasLike = { scene?: SceneLike };
    const cv    = canvas as unknown as CanvasLike;
    const scene = cv.scene;
    if (!scene) {
        ui.notifications?.error("Consagrar: nenhuma cena ativa");
        return;
    }

    const templateData = {
        t: "circle",
        user: game.user?.id,
        distance: RAIO_METROS,
        direction: 0,
        angle: 0,
        x: pos.x,
        y: pos.y,
        fillColor: "#ffd86b",
        borderColor: "#c9a76a",
        flags: { [MODULE_ID]: buildConsagrarFlags(meta) },
    };

    try {
        await scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
        ui.notifications?.info(`Consagrar posicionada (fallback, ${RAIO_METROS}m, penalidade undead -${meta.undeadPenalty}).`);
    } catch (err) {
        console.warn(`[${MODULE_ID}] Consagrar: falha ao criar template:`, err);
    }
}

// ── Apply / Remove AEs (GM-side) ─────────────────────────────────────────────

/** Constrói os dados do AE apropriado pro tipo da criatura. */
function buildEffectData(actor: FoundryActor, template: {
    id: string; uuid: string; flags?: Record<string, Record<string, unknown>>;
}): Record<string, unknown> | null {
    const moduleFlags   = template.flags?.[MODULE_ID];
    const undeadPenalty = (moduleFlags?.["undeadPenalty"] as number | undefined) ?? PENALIDADE_BASE;

    if (isUndead(actor)) {
        return {
            name: `Consagrar — Penalidade (-${undeadPenalty})`,
            img: "icons/svg/sun.svg",
            transfer: false,
            origin: template.uuid,
            flags: { [MODULE_ID]: { [FLAG_EFFECT_ORIGIN]: template.id } },
            changes: [
                { key: "system.attributes.defesa.bonus",      mode: 2, value: `-${undeadPenalty}`, priority: 20 },
                { key: "system.modificadores.pericias.geral", mode: 2, value: `-${undeadPenalty}`, priority: 20 },
            ],
        };
    }
    return {
        name: "Consagrar — Cura Aprimorada",
        img: "icons/svg/holy-shield.svg",
        transfer: false,
        origin: template.uuid,
        flags: {
            [MODULE_ID]: {
                [FLAG_EFFECT_ORIGIN]: template.id,
                [FLAG_HEAL_BOOST]:    true,
            },
        },
        changes: [],
    };
}

/** Verifica se o token já tem um AE deste template. */
function tokenHasEffectFromTemplate(actor: FoundryActor, templateId: string): boolean {
    return (actor.effects?.contents ?? []).some(e =>
        (e.flags?.[MODULE_ID] as Record<string, unknown> | undefined)?.[FLAG_EFFECT_ORIGIN] === templateId
    );
}

/**
 * Lock por (actorId, templateId) para evitar race condition entre paths concorrentes
 * (createMeasuredTemplate sweep + updateToken sync) que ambos passem no check
 * tokenHasEffectFromTemplate antes de qualquer createEmbeddedDocuments resolver.
 */
const _applyInProgress = new Set<string>();

/** Aplica o AE deste template ao token (se ainda não tiver). Thread-safe. */
async function applyEffectToToken(token: FoundryToken, template: {
    id: string; uuid: string; flags?: Record<string, Record<string, unknown>>;
}): Promise<boolean> {
    const actor = token.actor;
    if (!actor) return false;
    const actorId = (actor as unknown as { id?: string }).id ?? "";
    const lockKey = `${actorId}::${template.id}`;
    // Bloqueia qualquer segundo caller antes mesmo de verificar o efeito
    if (_applyInProgress.has(lockKey)) return false;
    if (tokenHasEffectFromTemplate(actor, template.id)) return false;
    _applyInProgress.add(lockKey);
    try {
        // Double-check após adquirir o lock (pode ter sido aplicado por caller concorrente)
        if (tokenHasEffectFromTemplate(actor, template.id)) return false;
        const data = buildEffectData(actor, template);
        if (!data) return false;
        await (actor as FoundryActor & {
            createEmbeddedDocuments(t: string, data: unknown[]): Promise<unknown>;
        }).createEmbeddedDocuments("ActiveEffect", [data]);
        return true;
    } catch (err) {
        console.warn(`[${MODULE_ID}] Consagrar apply em ${actor.name}:`, err);
        return false;
    } finally {
        _applyInProgress.delete(lockKey);
    }
}

/** Remove do token o AE específico deste template. */
async function removeEffectFromToken(token: FoundryToken, templateId: string): Promise<boolean> {
    const actor = token.actor;
    if (!actor) return false;
    const ours = (actor.effects?.contents ?? []).filter(e =>
        (e.flags?.[MODULE_ID] as Record<string, unknown> | undefined)?.[FLAG_EFFECT_ORIGIN] === templateId
    );
    if (ours.length === 0) return false;
    try {
        await (actor as FoundryActor & {
            deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>;
        }).deleteEmbeddedDocuments("ActiveEffect", ours.map(e => e.id));
        return true;
    } catch (err) {
        console.warn(`[${MODULE_ID}] Consagrar remove em ${actor.name}:`, err);
        return false;
    }
}

/** Lista todos os templates Consagrar ativos na cena atual. */
function getConsagrarTemplates(): Array<{
    id: string; uuid: string; x: number; y: number; distance: number;
    flags?: Record<string, Record<string, unknown>>;
}> {
    type SceneLike = { templates?: { contents?: Array<{ flags?: Record<string, Record<string, unknown>> }> } };
    const cv = canvas as unknown as { scene?: SceneLike };
    const templates = cv.scene?.templates?.contents ?? [];
    return templates.filter(t =>
        t.flags?.[MODULE_ID]?.[FLAG_SPELL] === SPELL_KEY
    ) as Array<{
        id: string; uuid: string; x: number; y: number; distance: number;
        flags?: Record<string, Record<string, unknown>>;
    }>;
}

/**
 * Lock por tokenId: evita sync concorrente.
 * Pending: garante que a ÚLTIMA posição sempre seja processada, mesmo que o evento
 * tenha chegado durante um sync em andamento (caso contrário o evento seria descartado,
 * causando delay na remoção do AE quando o token sai da área durante um sync ativo).
 */
const _syncInProgress = new Set<string>();
const _syncPending    = new Map<string, FoundryToken>();

/** Sincroniza UM token contra TODOS os templates Consagrar na cena. */
async function syncTokenWithTemplates(token: FoundryToken): Promise<void> {
    if (!game.user?.isGM) return;
    if (!token.actor) return;
    const tokenId = (token as unknown as { id?: string }).id ?? "";
    if (!tokenId) return;

    if (_syncInProgress.has(tokenId)) {
        // Salva o token mais recente para re-sincronizar assim que o sync atual terminar
        _syncPending.set(tokenId, token);
        return;
    }
    _syncInProgress.add(tokenId);
    try {
        const templates = getConsagrarTemplates();
        if (templates.length === 0) {
            // Sem templates ativos — limpa qualquer AE órfão de Consagrar
            const all = (token.actor.effects?.contents ?? []).filter(e =>
                (e.flags?.[MODULE_ID] as Record<string, unknown> | undefined)?.[FLAG_EFFECT_ORIGIN] != null
            );
            if (all.length > 0) {
                try {
                    await (token.actor as FoundryActor & {
                        deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>;
                    }).deleteEmbeddedDocuments("ActiveEffect", all.map(e => e.id));
                } catch { /* ignore */ }
            }
            return;
        }
        for (const template of templates) {
            const inside = tokensInTemplate(template).some(
                t => (t as unknown as { id?: string }).id === tokenId
            );
            const has = tokenHasEffectFromTemplate(token.actor, template.id);
            if (inside && !has)  await applyEffectToToken(token, template);
            if (!inside && has)  await removeEffectFromToken(token, template.id);
        }
    } finally {
        _syncInProgress.delete(tokenId);
        // Processa o sync pendente (última posição) se chegou durante este sync
        const pending = _syncPending.get(tokenId);
        if (pending) {
            _syncPending.delete(tokenId);
            void syncTokenWithTemplates(pending);
        }
    }
}

async function applyAEsForTemplate(template: {
    id: string; uuid: string; x: number; y: number; distance: number;
    flags?: Record<string, Record<string, unknown>>;
}): Promise<void> {
    if (!game.user?.isGM) return;
    const moduleFlags = template.flags?.[MODULE_ID];
    if (!moduleFlags || moduleFlags[FLAG_SPELL] !== SPELL_KEY) return;

    const tokens = tokensInTemplate(template);
    let undeadCount = 0;
    let livingCount = 0;

    for (const token of tokens) {
        if (!token.actor) continue;
        const applied = await applyEffectToToken(token, template);
        if (applied) {
            if (isUndead(token.actor)) undeadCount++;
            else                       livingCount++;
        }
    }

    if (undeadCount + livingCount > 0) {
        ui.notifications?.info(`Consagrar: ${livingCount} vivo(s) abençoado(s), ${undeadCount} morto(s)-vivo(s) penalizado(s)`);
    }
}

async function removeAEsForTemplate(templateId: string): Promise<void> {
    if (!game.user?.isGM) return;

    // Coleta atores únicos de DOIS lugares:
    //   (1) game.actors.contents — atores do mundo
    //   (2) canvas.tokens.placeables[*].actor — atores SINTÉTICOS de tokens
    //       unlinked (NPCs em cena). Importante: para tokens unlinked, o
    //       synthetic.actor é uma instância DIFERENTE com mesmo id do world
    //       actor; precisamos deduplicar por REFERÊNCIA (Set), não por id.
    const actorsSet = new Set<FoundryActor>();
    for (const a of ((game.actors?.contents ?? []) as unknown as FoundryActor[])) {
        if (a) actorsSet.add(a);
    }
    type CanvasLike = { tokens?: { placeables?: FoundryToken[] } };
    const cv = canvas as unknown as CanvasLike;
    for (const tk of (cv.tokens?.placeables ?? [])) {
        const a = tk.actor;
        if (a) actorsSet.add(a);
    }
    const actors = [...actorsSet];

    let removed = 0;
    for (const actor of actors) {
        const ours = (actor.effects?.contents ?? []).filter(e =>
            (e.flags?.[MODULE_ID] as Record<string, unknown> | undefined)?.[FLAG_EFFECT_ORIGIN] === templateId
        );
        if (ours.length === 0) continue;
        try {
            await (actor as FoundryActor & {
                deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>;
            }).deleteEmbeddedDocuments("ActiveEffect", ours.map(e => e.id));
            removed += ours.length;
        } catch (err) {
            console.warn(`[${MODULE_ID}] Consagrar cleanup em ${actor.name}:`, err);
        }
    }
    if (removed > 0) ui.notifications?.info(`Consagrar removida (${removed} efeito(s) limpos)`);
}

// ── Floating button: remover área ────────────────────────────────────────────
//
// Botão injetado no <menu id="scene-controls-layers"> (mesma "lista" do botão
// de teste secreto). Aparece como ÚLTIMO item, e só fica visível enquanto há
// pelo menos uma área Consagrar ativa que o usuário pode remover:
//   - GM: vê o botão se existir QUALQUER área Consagrar na cena
//   - Jogador: vê o botão se for o creatorUserId de pelo menos uma área

const REMOVE_BTN_ID = "bg3-t20-consagrar-remove-btn";
const CONSAGRAR_STYLES_ID = "bg3-t20-consagrar-styles";

// CSS específico do dialog Consagrar — pequeno complemento ao tema bg3-dialog
// (que já cuida do gradiente, header, footer, botões e checkboxes).
const CONSAGRAR_STYLES = `
.window-app.bg3-dialog .bg3-consagrar-remove {
    padding: 14px 16px 6px;
}
.window-app.bg3-dialog .bg3-consagrar-remove p {
    margin: 0 0 8px;
    color: #d0c4a8;
    font-family: "Palatino Linotype", "Book Antiqua", serif;
    font-size: 0.95rem;
    line-height: 1.4;
}
.window-app.bg3-dialog .bg3-consagrar-remove p b {
    color: #c8a96e;
    font-weight: 700;
}
.window-app.bg3-dialog .bg3-consagrar-remove .hint {
    color: #8a7450;
    font-size: 0.82rem;
    font-style: italic;
    margin-top: 4px;
}
.window-app.bg3-dialog .bg3-consagrar-picker {
    padding: 12px 16px 8px;
}
.window-app.bg3-dialog .bg3-consagrar-picker > .picker-intro {
    color: #8a7450;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0 0 10px;
}
.window-app.bg3-dialog .bg3-consagrar-picker .picker-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-bottom: 1px solid rgba(106, 78, 24, 0.18);
    cursor: pointer;
    transition: background 0.15s;
}
.window-app.bg3-dialog .bg3-consagrar-picker .picker-row:last-child {
    border-bottom: none;
}
.window-app.bg3-dialog .bg3-consagrar-picker .picker-row:hover {
    background: rgba(106, 78, 24, 0.12);
}
.window-app.bg3-dialog .bg3-consagrar-picker .picker-row .row-idx {
    color: #8a7450;
    font-family: "Modesto Condensed", "Palatino Linotype", serif;
    font-size: 0.78rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    min-width: 56px;
}
.window-app.bg3-dialog .bg3-consagrar-picker .picker-row .row-name {
    color: #d0c4a8;
    font-family: "Palatino Linotype", serif;
    font-size: 0.95rem;
}
.window-app.bg3-dialog .bg3-consagrar-picker .picker-row .row-name b {
    color: #c8a96e;
    font-weight: 700;
}
`;

function ensureConsagrarStyles(): void {
    if (document.getElementById(CONSAGRAR_STYLES_ID)) return;
    const el = document.createElement("style");
    el.id = CONSAGRAR_STYLES_ID;
    el.textContent = CONSAGRAR_STYLES;
    document.head.appendChild(el);
}

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type ConsagrarTpl = {
    id: string;
    user?: string | { id?: string };
    author?: { id?: string };
    flags?: Record<string, Record<string, unknown>>;
};

/** Templates Consagrar que o usuário atual pode remover. GMs veem todas. */
function getMyConsagrarTemplates(): ConsagrarTpl[] {
    const all = getConsagrarTemplates() as unknown as ConsagrarTpl[];
    if (game.user?.isGM) return all;
    const uid = game.user?.id;
    if (!uid) return [];
    return all.filter(t => {
        const flagged = t.flags?.[MODULE_ID]?.["creatorUserId"] as string | undefined;
        if (flagged) return flagged === uid;
        // Fallback (templates antigos, sem flag): tenta author/user nativos
        const authorId = t.author?.id ?? (typeof t.user === "string" ? t.user : t.user?.id);
        return authorId === uid;
    });
}

function findSceneControlsMenu(): Element | null {
    return (
        document.querySelector("menu#scene-controls-layers") ??
        document.querySelector("aside#scene-controls menu") ??
        document.querySelector("#ui-left menu")
    );
}

function removeRemoveAreaButton(): void {
    const btn = document.getElementById(REMOVE_BTN_ID);
    btn?.parentElement?.remove();
}

function injectRemoveAreaButton(): void {
    if (document.getElementById(REMOVE_BTN_ID)) return;
    const menu = findSceneControlsMenu();
    if (!menu) return;

    const btn = document.createElement("button");
    btn.id = REMOVE_BTN_ID;
    btn.type = "button";
    btn.className = "control ui-control layer icon fa-solid fa-circle-xmark";
    btn.style.color = "#ffb84d"; // âmbar pra destacar de outros botões
    btn.setAttribute("data-tooltip", "Remover área de Consagrar");
    btn.setAttribute("aria-label", "Remover área de Consagrar");
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        void onClickRemoveArea();
    });

    const li = document.createElement("li");
    li.appendChild(btn);
    // appendChild → garantido ser o ÚLTIMO item do menu
    menu.appendChild(li);
}

/** Reflete o estado atual (área(s) ativa(s) ou não) no botão. */
function refreshRemoveAreaButton(): void {
    if (getMyConsagrarTemplates().length === 0) {
        removeRemoveAreaButton();
    } else {
        injectRemoveAreaButton();
    }
}

async function onClickRemoveArea(): Promise<void> {
    const mine = getMyConsagrarTemplates();
    if (mine.length === 0) {
        ui.notifications?.info("Nenhuma área de Consagrar ativa para remover.");
        refreshRemoveAreaButton();
        return;
    }

    type SceneLike = { deleteEmbeddedDocuments?(t: string, ids: string[]): Promise<unknown> };
    const scene = (canvas as unknown as { scene?: SceneLike }).scene;
    if (!scene?.deleteEmbeddedDocuments) {
        ui.notifications?.warn("Cena não disponível.");
        return;
    }

    const idsToRemove = mine.length === 1
        ? await confirmSingleRemoval(mine[0])
        : await pickTemplatesDialog(mine);

    if (!idsToRemove || idsToRemove.length === 0) return;

    try {
        await scene.deleteEmbeddedDocuments("MeasuredTemplate", idsToRemove);
    } catch (err) {
        console.warn(`[${MODULE_ID}] Consagrar: falha ao remover área(s):`, err);
        ui.notifications?.error("Falha ao remover área de Consagrar (veja console).");
    }
}

function confirmSingleRemoval(tpl: ConsagrarTpl): Promise<string[] | null> {
    const caster = esc((tpl.flags?.[MODULE_ID]?.["casterName"] as string | undefined) ?? "Lançador");
    return new Promise<string[] | null>((resolve) => {
        new Dialog({
            title: "Remover área de Consagrar",
            content: `
                <div class="bg3-consagrar-remove">
                    <p>Remover a área de Consagrar de <b>${caster}</b>?</p>
                    <p class="hint">Os efeitos aplicados aos tokens dentro da área serão limpos.</p>
                </div>`,
            buttons: {
                remove: {
                    icon:  '<i class="fas fa-circle-xmark"></i>',
                    label: "Remover",
                    callback: () => resolve([tpl.id]),
                },
                cancel: {
                    icon:  '<i class="fas fa-times"></i>',
                    label: "Cancelar",
                    callback: () => resolve(null),
                },
            },
            default: "remove",
            close:   () => resolve(null),
        }, { classes: ["bg3-dialog"] }).render(true);
    });
}

function pickTemplatesDialog(templates: ConsagrarTpl[]): Promise<string[] | null> {
    return new Promise<string[] | null>((resolve) => {
        const rows = templates.map((t, i) => {
            const caster = esc((t.flags?.[MODULE_ID]?.["casterName"] as string | undefined) ?? "Lançador");
            return `
                <label class="picker-row">
                    <input type="checkbox" data-tid="${t.id}" checked />
                    <span class="row-idx">Área #${i + 1}</span>
                    <span class="row-name"><b>${caster}</b></span>
                </label>`;
        }).join("");

        new Dialog({
            title: "Remover áreas de Consagrar",
            content: `
                <div class="bg3-consagrar-picker">
                    <p class="picker-intro">Selecione as áreas a remover</p>
                    ${rows}
                </div>`,
            buttons: {
                remove: {
                    icon:  '<i class="fas fa-circle-xmark"></i>',
                    label: "Remover selecionadas",
                    callback: ($html: JQuery) => {
                        const root = ($html as unknown as { 0?: HTMLElement })[0] ?? ($html as unknown as HTMLElement);
                        const ids = Array.from(
                            (root as HTMLElement).querySelectorAll("input[data-tid]:checked")
                        )
                            .map(el => el.getAttribute("data-tid") ?? "")
                            .filter(Boolean);
                        resolve(ids.length > 0 ? ids : null);
                    },
                },
                cancel: {
                    icon:  '<i class="fas fa-times"></i>',
                    label: "Cancelar",
                    callback: () => resolve(null),
                },
            },
            default: "remove",
            close:   () => resolve(null),
        }, { classes: ["bg3-dialog"] }).render(true);
    });
}

// ── Setup ────────────────────────────────────────────────────────────────────

export function setupConsagrar(): void {
    // CSS específico dos dialogs Consagrar (complementa o tema bg3-dialog)
    ensureConsagrarStyles();

    // 1. Detecta cast → registra "pending" para reclamar o template do T20
    //    (NÃO mais cria template aqui — antes resultava em 2 áreas no canvas).
    Hooks.on("createChatMessage", (...args: unknown[]) => {
        const message = args[0] as ChatMessage;
        const uid = getMsgAuthorId(message);
        if (uid !== game.user?.id) return;
        if (normalizeCondName(extractSpellName(message)) !== SPELL_KEY) return;

        registerPendingCast(uid, {
            casterActorId: message.speaker?.actor ?? "",
            casterName:    message.speaker?.alias ?? "Lançador",
            undeadPenalty: PENALIDADE_BASE + parseEnhancementBonus(message.content ?? ""),
        });
    });

    // 2. Template criado:
    //    - se foi criado por nós (autor) e há pending → reclamamos via doc.update
    //      (a aplicação de AEs vem via updateMeasuredTemplate quando o flag chega)
    //    - se já vem com flag Consagrar (cena recarregada/import) → GM aplica AEs
    Hooks.on("createMeasuredTemplate", (...args: unknown[]) => {
        const tplDoc = args[0] as {
            id: string; uuid: string; x: number; y: number; distance: number;
            user?: string | { id?: string };
            author?: { id?: string };
            flags?: Record<string, Record<string, unknown>>;
            update(data: Record<string, unknown>): Promise<unknown>;
        };
        const triggerUserId = typeof args[2] === "string" ? args[2] as string : undefined;
        const currentUid    = game.user?.id;
        const hasConsagrar  = tplDoc.flags?.[MODULE_ID]?.[FLAG_SPELL] === SPELL_KEY;

        // Claim: só o autor do template tenta reclamar (evita race entre clientes)
        if (currentUid && !hasConsagrar) {
            const authorUid =
                tplDoc.author?.id
                ?? (typeof tplDoc.user === "string" ? tplDoc.user : tplDoc.user?.id)
                ?? triggerUserId;
            if (authorUid === currentUid) {
                const pending = _pendingCasts.get(currentUid);
                if (pending && Date.now() - pending.ts < PENDING_WINDOW_MS) {
                    clearPending(currentUid);
                    void claimTemplate(tplDoc, pending);
                    // applyAEs virá via updateMeasuredTemplate quando o flag propagar.
                    refreshRemoveAreaButton();
                    return;
                }
            }
        }

        if (hasConsagrar && game.user?.isGM) {
            void applyAEsForTemplate(tplDoc);
        }
        refreshRemoveAreaButton();
    });

    // 3. Template deletado → GM remove AEs criados por ele
    Hooks.on("deleteMeasuredTemplate", (...args: unknown[]) => {
        const template = args[0] as { id: string; flags?: Record<string, Record<string, unknown>> };
        if (template.flags?.[MODULE_ID]?.[FLAG_SPELL] !== SPELL_KEY) return;
        void removeAEsForTemplate(template.id);
        refreshRemoveAreaButton();
    });

    // 4. Token atualizado → resincroniza com todos os templates Consagrar.
    //    NÃO filtramos por changes.x/y porque o sistema de movimento do v13 pode
    //    reportar a mudança sob outras chaves (_movement, path, etc.). O sync
    //    sempre lê document.x/y, que JÁ reflete a posição final do movimento,
    //    então rodar sempre é correto e barato (idempotente + lock por tokenId).
    Hooks.on("updateToken", (...args: unknown[]) => {
        if (getConsagrarTemplates().length === 0) return;
        const tokenDoc = args[0] as { object?: FoundryToken };
        const token = tokenDoc.object;
        if (!token) return;
        void syncTokenWithTemplates(token);
    });

    // 5. FASE 2: Token criado na cena → checa se cai em algum template Consagrar
    Hooks.on("createToken", (...args: unknown[]) => {
        const tokenDoc = args[0] as { object?: FoundryToken };
        if (getConsagrarTemplates().length === 0) return;
        const token = tokenDoc.object;
        if (!token) return;
        void syncTokenWithTemplates(token);
    });

    // 6. Template atualizado:
    //    a) Flag Consagrar foi recém-adicionado (claim do T20-template) → GM aplica AEs
    //    b) Posição/tamanho mudou → re-sync de todos os tokens da cena
    Hooks.on("updateMeasuredTemplate", (...args: unknown[]) => {
        const tplDoc  = args[0] as {
            id: string; uuid: string; x: number; y: number; distance: number;
            flags?: Record<string, Record<string, unknown>>;
        };
        const changes = args[1] as Record<string, unknown>;

        // (a) Flag Consagrar acabou de ser adicionada
        const flagChange = (changes["flags"] as Record<string, Record<string, unknown>> | undefined)?.[MODULE_ID];
        if (flagChange && flagChange[FLAG_SPELL] === SPELL_KEY) {
            if (game.user?.isGM) void applyAEsForTemplate(tplDoc);
            refreshRemoveAreaButton();
            return;
        }

        // (b) Mudança geométrica em template Consagrar já existente
        if (tplDoc.flags?.[MODULE_ID]?.[FLAG_SPELL] !== SPELL_KEY) return;
        if (changes["x"] === undefined && changes["y"] === undefined && changes["distance"] === undefined) return;
        if (!game.user?.isGM) return;
        type CanvasLike = { tokens?: { placeables?: FoundryToken[] } };
        const cv = canvas as unknown as CanvasLike;
        const tokens = cv.tokens?.placeables ?? [];
        void (async () => {
            for (const token of tokens) {
                if (!token.actor) continue;
                const inside = tokensInTemplate(tplDoc).some(t => t === token);
                const has    = tokenHasEffectFromTemplate(token.actor, tplDoc.id);
                if (inside && !has)  await applyEffectToToken(token, tplDoc);
                if (!inside && has)  await removeEffectFromToken(token, tplDoc.id);
            }
        })();
    });

    // 7. FASE 3: Ao carregar/trocar cena → sincroniza tokens com templates existentes
    // canvasReady dispara tanto no start do mundo quanto ao trocar de cena
    Hooks.on("canvasReady", () => {
        // Botão de remover precisa refletir o estado da cena recém-carregada
        // (vale para GM e jogadores; por isso vem antes do early-return de GM).
        refreshRemoveAreaButton();

        if (!game.user?.isGM) return;
        const templates = getConsagrarTemplates();
        if (templates.length === 0) return;
        type CanvasLike = { tokens?: { placeables?: FoundryToken[] } };
        const cv = canvas as unknown as CanvasLike;
        const tokens = cv.tokens?.placeables ?? [];
        void (async () => {
            for (const token of tokens) {
                if (!token.actor) continue;
                await syncTokenWithTemplates(token);
            }
            ui.notifications?.info(`Consagrar: ${templates.length} área(s) ativa(s) restaurada(s)`);
        })();
    });

    // 8b. Toolbar re-renderizada (mudou de layer, etc.) → re-injeta o botão
    Hooks.on("renderSceneControls", () => refreshRemoveAreaButton());
    // 8c. Estado inicial assim que a UI estiver pronta
    Hooks.once("ready", () => refreshRemoveAreaButton());

    // 8. FASE 3: Tempo do mundo avança → remove templates cujo 1 dia expirou
    const ONE_DAY_SECONDS = 86400;
    Hooks.on("updateWorldTime", (...args: unknown[]) => {
        if (!game.user?.isGM) return;
        const worldTime = args[0] as number;
        const templates = getConsagrarTemplates();
        if (templates.length === 0) return;
        type SceneLike = {
            deleteEmbeddedDocuments?(t: string, ids: string[]): Promise<unknown>;
        };
        const scene = (canvas as unknown as { scene?: SceneLike }).scene;
        for (const template of templates) {
            const createdAt = template.flags?.[MODULE_ID]?.["createdAtGameTime"] as number | undefined;
            if (createdAt == null) continue;
            if (worldTime - createdAt >= ONE_DAY_SECONDS) {
                void scene?.deleteEmbeddedDocuments?.("MeasuredTemplate", [template.id]);
                ui.notifications?.info("Consagrar: área expirou após 1 dia de jogo e foi removida");
            }
        }
    });
}

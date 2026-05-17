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
 * Detecta se o ator é morto-vivo (T20: actor.system.detalhes.raca === "Morto-vivo").
 */
function isUndead(actor: FoundryActor): boolean {
    type DetalhesShape = { detalhes?: { raca?: string } };
    const raca = (actor.system as DetalhesShape | undefined)?.detalhes?.raca;
    if (typeof raca !== "string") return false;
    return normalizeCondName(raca) === "morto-vivo";
}

/**
 * Calcula tokens cujo centro está dentro do raio do template (em metros do mundo).
 * Usa `token.document.x/y` ao invés de `token.center` para evitar problemas de
 * timing — durante updateToken hook a placeable pode estar mid-animation com
 * coordenadas obsoletas, enquanto o documento sempre tem o valor canônico.
 */
function tokensInTemplate(template: {
    x: number; y: number; distance: number;
}): FoundryToken[] {
    type CanvasLike = {
        tokens?: { placeables?: FoundryToken[] };
        scene?: { grid?: { size?: number; distance?: number } };
    };
    const cv = canvas as unknown as CanvasLike;
    const tokens = cv.tokens?.placeables ?? [];
    const gridSize = cv.scene?.grid?.size ?? 100;
    const gridDist = cv.scene?.grid?.distance ?? 1.5;
    const pxPerUnit = gridSize / gridDist;
    const radiusPx  = template.distance * pxPerUnit;

    return tokens.filter(token => {
        type TokenDoc = {
            document?: { x?: number; y?: number; width?: number; height?: number };
            x?: number; y?: number; w?: number; h?: number;
        };
        const t   = token as unknown as TokenDoc;
        const doc = t.document;
        const docX = doc?.x ?? t.x ?? 0;
        const docY = doc?.y ?? t.y ?? 0;
        // width/height no document são em grid units; multiplicar por gridSize
        const widthPx  = doc?.width  != null ? doc.width  * gridSize : (t.w ?? gridSize);
        const heightPx = doc?.height != null ? doc.height * gridSize : (t.h ?? gridSize);
        const cx = docX + widthPx / 2;
        const cy = docY + heightPx / 2;
        const dx = cx - template.x;
        const dy = cy - template.y;
        return Math.sqrt(dx * dx + dy * dy) <= radiusPx;
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

async function placeTemplate(meta: {
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
        flags: {
            [MODULE_ID]: {
                [FLAG_SPELL]:    SPELL_KEY,
                casterActorId:   meta.casterActorId,
                casterName:      meta.casterName,
                undeadPenalty:   meta.undeadPenalty,
                createdAt:       Date.now(),
            },
        },
    };

    try {
        await scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
        ui.notifications?.info(`Consagrar posicionada (${RAIO_METROS}m, penalidade undead -${meta.undeadPenalty})`);
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

/** Aplica o AE deste template ao token (se ainda não tiver). */
async function applyEffectToToken(token: FoundryToken, template: {
    id: string; uuid: string; flags?: Record<string, Record<string, unknown>>;
}): Promise<boolean> {
    const actor = token.actor;
    if (!actor) return false;
    if (tokenHasEffectFromTemplate(actor, template.id)) return false;
    const data = buildEffectData(actor, template);
    if (!data) return false;
    try {
        await (actor as FoundryActor & {
            createEmbeddedDocuments(t: string, data: unknown[]): Promise<unknown>;
        }).createEmbeddedDocuments("ActiveEffect", [data]);
        return true;
    } catch (err) {
        console.warn(`[${MODULE_ID}] Consagrar apply em ${actor.name}:`, err);
        return false;
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
 * Lock para evitar sync concorrente do mesmo token. Sem isso, dois updateToken
 * em sequência rápida (ex: animação Foundry) podem disparar dois apply em paralelo
 * antes do primeiro persistir, criando duplicatas.
 */
const _syncInProgress = new Set<string>();

/** Sincroniza UM token contra TODOS os templates Consagrar na cena. */
async function syncTokenWithTemplates(token: FoundryToken): Promise<void> {
    if (!game.user?.isGM) return;
    if (!token.actor) return;
    const tokenId = (token as unknown as { id?: string }).id ?? "";
    if (!tokenId || _syncInProgress.has(tokenId)) return;
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
            const inside = tokensInTemplate(template).some(t => t === token);
            const has    = tokenHasEffectFromTemplate(token.actor, template.id);
            if (inside && !has)  await applyEffectToToken(token, template);
            if (!inside && has)  await removeEffectFromToken(token, template.id);
        }
    } finally {
        _syncInProgress.delete(tokenId);
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

// ── Setup ────────────────────────────────────────────────────────────────────

export function setupConsagrar(): void {
    // 1. Detecta cast (apenas autor processa para prompt de posicionamento)
    Hooks.on("createChatMessage", (...args: unknown[]) => {
        const message = args[0] as ChatMessage;
        if (getMsgAuthorId(message) !== game.user?.id) return;
        if (normalizeCondName(extractSpellName(message)) !== SPELL_KEY) return;

        const casterActorId = message.speaker?.actor ?? "";
        const casterName    = message.speaker?.alias ?? "Lançador";
        const undeadPenalty = PENALIDADE_BASE + parseEnhancementBonus(message.content ?? "");

        void placeTemplate({ casterActorId, casterName, undeadPenalty });
    });

    // 2. Template criado → GM aplica AEs nos tokens dentro
    Hooks.on("createMeasuredTemplate", (...args: unknown[]) => {
        const template = args[0] as { flags?: Record<string, Record<string, unknown>> } & {
            id: string; uuid: string; x: number; y: number; distance: number;
        };
        if (template.flags?.[MODULE_ID]?.[FLAG_SPELL] !== SPELL_KEY) return;
        void applyAEsForTemplate(template);
    });

    // 3. Template deletado → GM remove AEs criados por ele
    Hooks.on("deleteMeasuredTemplate", (...args: unknown[]) => {
        const template = args[0] as { id: string; flags?: Record<string, Record<string, unknown>> };
        if (template.flags?.[MODULE_ID]?.[FLAG_SPELL] !== SPELL_KEY) return;
        void removeAEsForTemplate(template.id);
    });

    // 4. FASE 2: Token movido → resincroniza com todos os templates Consagrar
    Hooks.on("updateToken", (...args: unknown[]) => {
        const tokenDoc = args[0] as { object?: FoundryToken; x?: number; y?: number };
        const changes  = args[1] as Record<string, unknown>;
        // Só interessa se posição mudou
        if (changes["x"] === undefined && changes["y"] === undefined) return;
        if (getConsagrarTemplates().length === 0) return;
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

    // 6. FASE 2: Template movido/redimensionado → reaplica todos os tokens
    Hooks.on("updateMeasuredTemplate", (...args: unknown[]) => {
        const tplDoc  = args[0] as {
            id: string; uuid: string; x: number; y: number; distance: number;
            flags?: Record<string, Record<string, unknown>>;
        };
        const changes = args[1] as Record<string, unknown>;
        if (tplDoc.flags?.[MODULE_ID]?.[FLAG_SPELL] !== SPELL_KEY) return;
        if (changes["x"] === undefined && changes["y"] === undefined && changes["distance"] === undefined) return;
        if (!game.user?.isGM) return;
        // Re-sync de todos os tokens da cena para esse template
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
}

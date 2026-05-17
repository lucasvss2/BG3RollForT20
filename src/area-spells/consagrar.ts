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

/** Calcula tokens cujo centro está dentro do raio do template (em metros do mundo). */
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
        type TokenWithCenter = { center?: { x: number; y: number }; x?: number; y?: number; w?: number; h?: number };
        const t = token as unknown as TokenWithCenter;
        const cx = t.center?.x ?? ((t.x ?? 0) + (t.w ?? 0) / 2);
        const cy = t.center?.y ?? ((t.y ?? 0) + (t.h ?? 0) / 2);
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

async function applyAEsForTemplate(template: {
    id: string; uuid: string; x: number; y: number; distance: number;
    flags?: Record<string, Record<string, unknown>>;
}): Promise<void> {
    if (!game.user?.isGM) return;
    const moduleFlags = template.flags?.[MODULE_ID];
    if (!moduleFlags || moduleFlags[FLAG_SPELL] !== SPELL_KEY) return;

    const undeadPenalty = (moduleFlags["undeadPenalty"] as number | undefined) ?? PENALIDADE_BASE;
    const tokens = tokensInTemplate(template);

    let undeadCount = 0;
    let livingCount = 0;

    for (const token of tokens) {
        const actor = token.actor;
        if (!actor) continue;

        type ActorWithCreate = FoundryActor & {
            createEmbeddedDocuments(t: string, data: unknown[], opts?: Record<string, unknown>): Promise<unknown>;
        };
        const a = actor as ActorWithCreate;

        if (isUndead(actor)) {
            const penaltyEffect = {
                name: `Consagrar — Penalidade (-${undeadPenalty})`,
                img: "icons/svg/sun.svg",
                transfer: false,
                origin: template.uuid,
                flags: { [MODULE_ID]: { [FLAG_EFFECT_ORIGIN]: template.id } },
                changes: [
                    { key: "system.attributes.defesa.bonus",        mode: 2, value: `-${undeadPenalty}`, priority: 20 },
                    { key: "system.modificadores.pericias.geral",   mode: 2, value: `-${undeadPenalty}`, priority: 20 },
                ],
            };
            try {
                await a.createEmbeddedDocuments("ActiveEffect", [penaltyEffect]);
                undeadCount++;
            } catch (err) {
                console.warn(`[${MODULE_ID}] Consagrar penalty em ${actor.name}:`, err);
            }
        } else {
            const boostEffect = {
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
            try {
                await a.createEmbeddedDocuments("ActiveEffect", [boostEffect]);
                livingCount++;
            } catch (err) {
                console.warn(`[${MODULE_ID}] Consagrar boost em ${actor.name}:`, err);
            }
        }
    }

    if (undeadCount + livingCount > 0) {
        ui.notifications?.info(`Consagrar: ${livingCount} vivo(s) abençoado(s), ${undeadCount} morto(s)-vivo(s) penalizado(s)`);
    }
}

async function removeAEsForTemplate(templateId: string): Promise<void> {
    if (!game.user?.isGM) return;
    const actors = (game.actors?.contents ?? []) as unknown as FoundryActor[];
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
}

/**
 * Medalhão Afiado
 *
 * Quando o lançador tem o "Medalhão Afiado" equipado e lança uma magia que
 * fornece bônus em testes de ataque (ex: Bênção, Arma de Jade), os alvos
 * marcados com T também recebem +1 na margem de ameaça de todas as armas
 * equipadas — implementado como AE (-1 em system.criticoM) em cada arma.
 *
 * Fluxo:
 *   createChatMessage (autor) → detecta spell com AE de ataque → caster tem
 *   Medalhão equipado → para cada alvo T: armas equipadas → AE por arma.
 *   Player → delega ao GM via socket (permissão de editar itens de 3º).
 */

import { MODULE_ID } from "@/constants";
import { getMsgAuthorId, normalizeCondName } from "@/spell-resistance/index";
import { getSocket, onSocketReady } from "@/socket";

// ── Constantes ────────────────────────────────────────────────────────────────

const SOCKET_APPLY = "medalhao-afiado/apply-margem";
const MEDALHAO_FLAG = "medalhaoAfiado";
const MEDALHAO_NAME_NORMALIZED = "medalhao afiado";
const SPELL_TIPOS = ["arc", "div", "uni"] as const;

/**
 * Chaves de AE que indicam bônus em testes de ataque no T20.
 * system.modificadores.pericias.ataque — bônus no teste de Luta/Pontaria
 * system.modificadores.ataque.*        — bônus global/corpo-a-corpo/à distância
 * "ataque"                              — chave curta T20 (Bênção e similares):
 *                                          modifica o roll de ataque do item alvo
 */
const ATTACK_BONUS_KEYS: ReadonlySet<string> = new Set([
    "system.modificadores.pericias.ataque",
    "system.modificadores.ataque.geral",
    "system.modificadores.ataque.cac",
    "system.modificadores.ataque.ad",
    "ataque",
]);

// ── Tipos de payload socket ───────────────────────────────────────────────────

interface MargemApplyRequest {
    type: typeof SOCKET_APPLY;
    casterName: string;
    targets: Array<{
        actorUuid: string;
        weaponItemIds: string[];
    }>;
    aeData: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isItemEquipped(item: FoundryItem): boolean {
    const eq = (item.system as { equipado?: unknown })?.equipado;
    if (typeof eq === "number") return eq > 0;
    if (typeof eq === "boolean") return eq;
    if (typeof eq === "string") return eq !== "" && eq !== "0" && eq !== "false";
    return Boolean(eq);
}

/**
 * Verifica se o ator tem "Medalhão Afiado" (equipamento) equipado.
 * Usa .includes() porque o item pode vir com sufixo de melhoria, ex:
 * "Medalhão Afiado Vigilante" — o nome base permanece como substring.
 */
function hasMedalhaoAfiado(actor: FoundryActor): boolean {
    for (const item of actor.items?.contents ?? []) {
        if (item.type !== "equipamento") continue;
        if (!normalizeCondName(item.name).includes(MEDALHAO_NAME_NORMALIZED)) continue;
        if (isItemEquipped(item)) return true;
    }
    return false;
}

/** Retorna true se algum grupo de efeito contém uma mudança de bônus de ataque. */
function hasAttackBonusEffect(effectGroups: Record<string, unknown>[][]): boolean {
    for (const group of effectGroups) {
        for (const ae of group) {
            const changes = (ae as { changes?: Array<{ key?: string }> }).changes ?? [];
            for (const ch of changes) {
                if (ch.key && ATTACK_BONUS_KEYS.has(ch.key)) return true;
            }
        }
    }
    return false;
}

/** Armas equipadas do ator. */
function getEquippedWeapons(actor: FoundryActor): FoundryItem[] {
    return (actor.items?.contents ?? []).filter(
        item => item.type === "arma" && isItemEquipped(item),
    );
}

/**
 * Constrói o AE de margem de ameaça para aplicar nas armas.
 * Copia a duração do primeiro AE do grupo de efeitos da magia, se disponível.
 */
function buildMargemAEData(
    effectGroups: Record<string, unknown>[][],
    messageId: string,
): Record<string, unknown> {
    const baseDuration = (
        effectGroups[0]?.[0] as Record<string, unknown> | undefined
    )?.duration as Record<string, unknown> | undefined;

    const duration: Record<string, unknown> = {};
    if (baseDuration && typeof baseDuration.seconds === "number") {
        duration.seconds = baseDuration.seconds;
        const g = game as unknown as { time?: { worldTime: number } };
        duration.startTime = g.time?.worldTime ?? 0;
    } else if (baseDuration?.rounds) {
        duration.rounds = baseDuration.rounds;
    }

    return {
        name: "Medalhão Afiado — Margem de Ameaça",
        icon: "icons/equipment/neck/amulet-gem-brown.webp",
        changes: [
            { key: "system.criticoM", value: "-1", mode: 2, priority: 20 },
        ],
        duration,
        disabled: false,
        transfer: false,
        flags: {
            [MODULE_ID]: {
                [MEDALHAO_FLAG]: true,
                sourceMessageId: messageId,
            },
        },
    };
}

// ── Aplicação de AE nas armas ─────────────────────────────────────────────────

async function applyMargemToWeapons(
    targets: MargemApplyRequest["targets"],
    aeData: Record<string, unknown>,
    casterName: string,
): Promise<void> {
    type ItemWithCreate = FoundryItem & {
        createEmbeddedDocuments(type: string, data: unknown[]): Promise<unknown>;
    };

    let weaponCount = 0;
    const actorNames: string[] = [];

    for (const { actorUuid, weaponItemIds } of targets) {
        const actor = fromUuidSync(actorUuid) as FoundryActor | null;
        if (!actor) continue;

        let actorApplied = false;
        for (const weaponId of weaponItemIds) {
            const weapon = actor.items?.get(weaponId) as ItemWithCreate | undefined;
            if (!weapon) continue;
            try {
                await weapon.createEmbeddedDocuments("ActiveEffect", [aeData]);
                weaponCount++;
                actorApplied = true;
            } catch (err) {
                console.warn(
                    `[${MODULE_ID}] Medalhão Afiado: falha ao aplicar em ${weapon.name} (${actor.name}):`,
                    err,
                );
            }
        }
        if (actorApplied && !actorNames.includes(actor.name)) {
            actorNames.push(actor.name);
        }
    }

    if (weaponCount > 0) {
        ui.notifications?.info(
            `${casterName}: Medalhão Afiado — margem de ameaça +1 em ${actorNames.join(", ")} (${weaponCount} arma(s))`,
        );
    }
}

// ── Handler GM-side do socket ─────────────────────────────────────────────────

async function handleApplyMargemSocket(req: unknown): Promise<void> {
    if (!game.user?.isGM) return;
    const r = req as MargemApplyRequest;
    await applyMargemToWeapons(r.targets, r.aeData, r.casterName);
}

// ── Lógica principal ──────────────────────────────────────────────────────────

async function processMedalhaoMessage(message: ChatMessage): Promise<void> {
    // 1. Apenas o autor processa
    if (getMsgAuthorId(message) !== game.user?.id) return;

    // 2. Apenas magias (arc/div/uni)
    const itemData = message.getFlag("tormenta20", "itemData") as Record<string, unknown> | undefined;
    if (!itemData) return;
    const tipo = itemData["tipo"] as string | undefined;
    if (!tipo || !(SPELL_TIPOS as readonly string[]).includes(tipo)) return;

    // 3. Deve ter grupos de efeito com bônus de ataque
    type EffectGroup = Record<string, unknown>[];
    const effectGroups = message.getFlag("tormenta20", "effects") as EffectGroup[] | undefined;
    if (!effectGroups?.length || !hasAttackBonusEffect(effectGroups)) return;

    // 4. Caster deve ter Medalhão Afiado equipado
    const casterActorId = message.speaker?.actor ?? "";
    const casterActor = game.actors?.get(casterActorId);
    if (!casterActor || !hasMedalhaoAfiado(casterActor)) return;

    // 5. Deve ter alvos T-marcados com armas equipadas
    const targets = Array.from(game.user?.targets ?? []) as FoundryToken[];
    if (!targets.length) {
        ui.notifications?.warn("Medalhão Afiado: nenhum alvo selecionado (T)");
        return;
    }

    const targetData: MargemApplyRequest["targets"] = [];
    for (const token of targets) {
        const actor = token.actor;
        if (!actor) continue;
        const weapons = getEquippedWeapons(actor);
        if (!weapons.length) continue;
        targetData.push({
            actorUuid: actor.uuid,
            weaponItemIds: weapons.map(w => w.id),
        });
    }

    if (!targetData.length) return;

    const casterName = message.speaker?.alias ?? casterActor.name ?? "Lançador";
    const aeData = buildMargemAEData(effectGroups, message.id);

    if (game.user?.isGM) {
        await applyMargemToWeapons(targetData, aeData, casterName);
        return;
    }

    // Player → delega ao GM
    const gm = (game.users?.contents ?? []).find(
        (u: FoundryUser) => (u as unknown as { isGM: boolean }).isGM && (u as unknown as { active: boolean }).active,
    );
    if (!gm) {
        ui.notifications?.warn("Medalhão Afiado: GM precisa estar online para aplicar margem de ameaça");
        return;
    }

    const req: MargemApplyRequest = {
        type: SOCKET_APPLY,
        casterName,
        targets: targetData,
        aeData,
    };
    void getSocket()?.executeAsGM(SOCKET_APPLY, req);
    ui.notifications?.info(
        `${casterName}: Medalhão Afiado — margem de ameaça enviada ao GM para aplicação`,
    );
}

// ── Entrada pública ───────────────────────────────────────────────────────────

export function setupMedalhaoAfiado(): void {
    onSocketReady((socket) => {
        socket.register(SOCKET_APPLY, handleApplyMargemSocket);
    });

    Hooks.on("createChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;
        void processMedalhaoMessage(message);
    });
}

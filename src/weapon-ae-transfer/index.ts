/**
 * Weapon AE Transfer
 *
 * O T20 não transfere Active Effects de items do tipo `arma` para o ator
 * (mesmo com `transfer: true` e item equipado). Este módulo replica o
 * comportamento que o T20 já tem para `equipamento`:
 *
 *  - Quando uma arma é EQUIPADA (`system.equipado` vira > 0):
 *    cria cópias dos AE marcados com `transfer: true` no ator, com
 *    `origin: item.uuid` e um flag interno apontando para o item de origem.
 *
 *  - Quando uma arma é DESEQUIPADA (`system.equipado` vira 0/falsy):
 *    remove as cópias previamente criadas (identificadas pelo flag).
 *
 *  - Quando o item é DELETADO: cleanup das cópias.
 *
 *  - No `ready` do mundo, o GM faz uma sincronização inicial para
 *    corrigir estados desatualizados (efeitos órfãos ou faltando).
 *
 * Os efeitos criados ganham o flag MODULE_ID.weaponTransferOrigin = item.id,
 * usado tanto para reconhecimento quanto para evitar conflito com efeitos
 * criados manualmente pelo jogador.
 */

import { MODULE_ID } from "@/constants";

const FLAG_KEY = "weaponTransferOrigin";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Considera "equipado" qualquer valor truthy de system.equipado. */
function isItemEquipped(item: FoundryItem): boolean {
    const eq = (item.system as { equipado?: unknown })?.["equipado"];
    if (typeof eq === "number") return eq > 0;
    if (typeof eq === "boolean") return eq;
    if (typeof eq === "string") return eq !== "" && eq !== "0" && eq !== "false";
    return Boolean(eq);
}

/** Efeitos do item elegíveis para transferência ao ator. */
function getTransferableEffects(item: FoundryItem): FoundryItemEffect[] {
    type EffWithTransfer = FoundryItemEffect & { transfer?: boolean };
    const effects = (item.effects?.contents ?? []) as EffWithTransfer[];
    return effects.filter(e => e.transfer === true && !e.disabled && (e.changes?.length ?? 0) > 0);
}

/** Efeitos no ator que ESTE módulo criou a partir deste item. */
function getOurTransferredEffects(actor: FoundryActor, itemId: string): FoundryItemEffect[] {
    const effects = actor.effects?.contents ?? [];
    return effects.filter(e => {
        const flag = (e.flags?.[MODULE_ID] as Record<string, unknown> | undefined)?.[FLAG_KEY];
        return flag === itemId;
    });
}

/** Sincroniza os efeitos transferidos de uma arma específica com seu ator pai. */
async function syncWeaponEffects(item: FoundryItem): Promise<void> {
    if (item.type !== "arma") return;
    const actor = (item as unknown as { parent?: FoundryActor }).parent;
    if (!actor) return;

    const equipped       = isItemEquipped(item);
    const existing       = getOurTransferredEffects(actor, item.id);

    type CreateActor = FoundryActor & {
        createEmbeddedDocuments(t: string, data: unknown[], opts?: Record<string, unknown>): Promise<unknown>;
        deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>;
    };
    const a = actor as CreateActor;

    if (!equipped) {
        // Desequipado → remove qualquer cópia que tínhamos criado.
        if (existing.length > 0) {
            try {
                await a.deleteEmbeddedDocuments("ActiveEffect", existing.map(e => e.id));
            } catch (err) {
                console.warn(`[t20-theme-overhaul] weapon-ae-transfer: falha ao remover de ${actor.name}:`, err);
            }
        }
        return;
    }

    // Equipado → garantir que cada effect transferível tem cópia no ator.
    const transferable    = getTransferableEffects(item);
    if (transferable.length === 0) {
        // Item equipado mas sem efeitos transferíveis: remove qualquer cópia velha.
        if (existing.length > 0) {
            try { await a.deleteEmbeddedDocuments("ActiveEffect", existing.map(e => e.id)); } catch { /* ignore */ }
        }
        return;
    }

    const existingByName = new Map(existing.map(e => [e.name, e]));
    const toCreate: Record<string, unknown>[] = [];

    for (const eff of transferable) {
        if (existingByName.has(eff.name)) continue; // já existe — idempotente
        const src = (eff as unknown as { toObject(): Record<string, unknown> }).toObject();
        toCreate.push({
            ...src,
            transfer: false,
            origin:   (item as unknown as { uuid: string }).uuid,
            flags: {
                ...(src["flags"] as Record<string, unknown> | undefined ?? {}),
                [MODULE_ID]: { [FLAG_KEY]: item.id },
            },
        });
    }

    if (toCreate.length === 0) return;
    try {
        await a.createEmbeddedDocuments("ActiveEffect", toCreate);
    } catch (err) {
        console.warn(`[t20-theme-overhaul] weapon-ae-transfer: falha ao criar em ${actor.name}:`, err);
    }
}

/** Cleanup quando o item é deletado: remove cópias órfãs no ator. */
async function cleanupOrphans(item: FoundryItem): Promise<void> {
    const actor = (item as unknown as { parent?: FoundryActor }).parent;
    if (!actor) return;
    const orphans = getOurTransferredEffects(actor, item.id);
    if (orphans.length === 0) return;
    try {
        await (actor as FoundryActor & {
            deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>;
        }).deleteEmbeddedDocuments("ActiveEffect", orphans.map(e => e.id));
    } catch (err) {
        console.warn(`[t20-theme-overhaul] weapon-ae-transfer: falha ao limpar órfãos em ${actor.name}:`, err);
    }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export function setupWeaponAETransfer(): void {
    // Re-sync quando o item muda (equipa/desequipa)
    Hooks.on("updateItem", (...args: unknown[]) => {
        const item   = args[0] as FoundryItem;
        const userId = args[3] as string;
        if (userId !== game.user?.id) return;
        if (item.type !== "arma") return;
        void syncWeaponEffects(item);
    });

    // Item novo já equipado: cria efeitos
    Hooks.on("createItem", (...args: unknown[]) => {
        const item   = args[0] as FoundryItem;
        const userId = args[2] as string;
        if (userId !== game.user?.id) return;
        if (item.type !== "arma") return;
        void syncWeaponEffects(item);
    });

    // Item deletado: limpa cópias no ator
    Hooks.on("deleteItem", (...args: unknown[]) => {
        const item   = args[0] as FoundryItem;
        const userId = args[2] as string;
        if (userId !== game.user?.id) return;
        if (item.type !== "arma") return;
        void cleanupOrphans(item);
    });

    // ActiveEffect dentro do item mudou (toggle disabled, edição de changes):
    // re-sincroniza para propagar ao ator.
    Hooks.on("updateActiveEffect", (...args: unknown[]) => {
        const eff    = args[0] as { parent?: FoundryItem };
        const userId = args[3] as string;
        if (userId !== game.user?.id) return;
        const item = eff.parent;
        if (!item || item.type !== "arma") return;
        // Limpa as cópias antigas e re-cria do zero para refletir as mudanças.
        const actor = (item as unknown as { parent?: FoundryActor }).parent;
        if (!actor) return;
        void (async () => {
            const old = getOurTransferredEffects(actor, item.id);
            if (old.length > 0) {
                try {
                    await (actor as FoundryActor & { deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>; })
                        .deleteEmbeddedDocuments("ActiveEffect", old.map(e => e.id));
                } catch { /* ignore */ }
            }
            await syncWeaponEffects(item);
        })();
    });

    Hooks.on("createActiveEffect", (...args: unknown[]) => {
        const eff    = args[0] as { parent?: FoundryItem };
        const userId = args[2] as string;
        if (userId !== game.user?.id) return;
        const item = eff.parent;
        if (!item || item.type !== "arma") return;
        void syncWeaponEffects(item);
    });

    Hooks.on("deleteActiveEffect", (...args: unknown[]) => {
        const eff    = args[0] as { parent?: FoundryItem; name?: string };
        const userId = args[2] as string;
        if (userId !== game.user?.id) return;
        const item = eff.parent;
        if (!item || item.type !== "arma") return;
        // Remove a cópia no ator com mesmo nome.
        const actor = (item as unknown as { parent?: FoundryActor }).parent;
        if (!actor) return;
        const stale = getOurTransferredEffects(actor, item.id).filter(e => e.name === eff.name);
        if (stale.length === 0) return;
        void (actor as FoundryActor & { deleteEmbeddedDocuments(t: string, ids: string[]): Promise<unknown>; })
            .deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id));
    });

    // Sincronização inicial no ready: cada usuário sincroniza apenas os atores
    // que pode editar (próprios + GM tem todos). Evita duplicação porque cada
    // ator só é processado por quem tem permissão de write.
    Hooks.once("ready", () => {
        const userId = game.user?.id ?? "";
        const isGM   = Boolean(game.user?.isGM);
        const actors = (game.actors?.contents ?? []) as unknown as FoundryActor[];
        void (async () => {
            for (const actor of actors) {
                if (!isGM) {
                    const ownership = actor.ownership ?? {};
                    const userLevel = (ownership[userId] ?? ownership["default"] ?? 0) as number;
                    if (userLevel < 3) continue; // só dono (3+) processa
                }
                for (const item of (actor.items?.contents ?? [])) {
                    if (item.type !== "arma") continue;
                    await syncWeaponEffects(item);
                }
            }
        })();
    });
}

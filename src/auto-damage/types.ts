export interface AutoDamageRequest {
    type: "auto-damage-request";
    requestId: string;
    targetUserId: string;
    attackerUserId: string;
    targetActorId: string;
    /** Canvas TokenDocument ID — used to resolve the real token actor via
     *  canvas.tokens.get(id).actor, which works for unlinked NPC tokens.
     *  game.actors.get(actorId) returns the prototype (HP=0), not the token. */
    targetTokenId: string;
    attackerName: string;
    rollLabel: string;
    attackTotal: number;
    targetDef: number;
    damageTotal: number;
    attackFormula: string;
    damageFormula: string;
    /** Was the original damage roll maximized (e.g. via Kiai Divino)?
     *  Reroll must apply the same maximize flag to evaluate. */
    damageMaximized: boolean;
    /** Grito de Kiai was active — reroll should use advantage (2d20, best). */
    gritoActive?: boolean;
    /** Samurai level for Grito bonus die table. */
    samuraiLevel?: number;
    /** Effective criticoX (base + actor AE deltas from onUseEffects). */
    effectiveCriticoX?: number;
    /** Effective criticoM (base from itemData, already includes weapon upgrades). */
    effectiveCriticoM?: number;
}

export interface AttackRerollRequest {
    type: "attack-reroll-request";
    requestId: string;
    attackerUserId: string;
    targetUserId: string;
    targetActorId: string;
    targetTokenId: string;
    attackFormula: string;
    damageFormula: string;
    attackerName: string;
    rollLabel: string;
    targetDef: number;
    damageMaximized: boolean;
    gritoActive?: boolean;
    samuraiLevel?: number;
    effectiveCriticoX?: number;
    effectiveCriticoM?: number;
}

export interface AttackMissNotify {
    type: "attack-miss-notify";
    targetUserId: string;
    attackerName: string;
    attackTotal: number;
    targetDef: number;
}


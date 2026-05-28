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
    /** Non-critted base weapon damage formula (dice divided back by criticoX).
     *  Set only when the original attack was a critical hit. Lets reroll
     *  re-apply crit (or not) correctly instead of always using the critted formula. */
    baseDamageFormula?: string;
    /** Grito de Kiai was active — reroll should use advantage (2d20, best). */
    gritoActive?: boolean;
    /** Samurai level for Grito bonus die table. */
    samuraiLevel?: number;
    /** Effective criticoX (base + actor AE deltas from onUseEffects). */
    effectiveCriticoX?: number;
    /** Effective criticoM (base from itemData + onUseEffects AE deltas). */
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
    /** Non-critted base weapon formula — same semantics as in AutoDamageRequest. */
    baseDamageFormula?: string;
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


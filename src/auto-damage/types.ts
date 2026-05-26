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
}

export interface AttackMissNotify {
    type: "attack-miss-notify";
    targetUserId: string;
    attackerName: string;
    attackTotal: number;
    targetDef: number;
}


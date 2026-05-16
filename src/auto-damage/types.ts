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
}

export interface AttackMissNotify {
    type: "attack-miss-notify";
    targetUserId: string;
    attackerName: string;
    attackTotal: number;
    targetDef: number;
}

export type AutoDamageSocketData =
    | AutoDamageRequest
    | AttackRerollRequest
    | AttackMissNotify;

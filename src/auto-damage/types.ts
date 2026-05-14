export interface AutoDamageRequest {
    type: "auto-damage-request";
    requestId: string;
    targetUserId: string;
    attackerUserId: string;
    targetActorId: string;
    attackerName: string;
    rollLabel: string;
    attackTotal: number;
    targetDef: number;
    damageTotal: number;
    damageFormula: string;
}

export interface DamageRerollRequest {
    type: "damage-reroll-request";
    requestId: string;
    attackerUserId: string;
    targetUserId: string;
    targetActorId: string;
    damageFormula: string;
    attackerName: string;
    rollLabel: string;
    attackTotal: number;
    targetDef: number;
}

export type AutoDamageSocketData = AutoDamageRequest | DamageRerollRequest;

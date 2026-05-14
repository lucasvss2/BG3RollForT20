export interface AutoDamageRequest {
    type: "auto-damage-request";
    requestId: string;
    targetUserId: string;
    targetActorId: string;
    attackerName: string;
    rollLabel: string;
    attackTotal: number;
    targetDef: number;
    damageTotal: number;
}

export type AutoDamageSocketData = AutoDamageRequest;

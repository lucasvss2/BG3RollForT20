export type TestOutcome = "critico" | "sucesso" | "falha" | "falha_critica";

export interface HiddenTestRequest {
    type: "hidden-test-request";
    requestId: string;
    targetUserId: string;
    actorId: string;
    skillKey: string;
    skillLabel: string;
    dc: number;
    gmBonus?: number;
}

export interface HiddenTestFlag {
    outcome: TestOutcome;
    skillLabel: string;
    actorName: string;
    appliedBonuses: string[];  // e.g. ["+9 CAR · Audácia (2 PM)", "Vantagem · Lupa"]
}



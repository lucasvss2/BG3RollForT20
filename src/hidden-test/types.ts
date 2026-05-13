export type TestOutcome = "critico" | "sucesso" | "falha" | "falha_critica";

export interface HiddenTestRequest {
    type: "hidden-test-request";
    requestId: string;
    targetUserId: string;
    actorId: string;
    skillKey: string;
    skillLabel: string;
    dc: number;
}

export interface HiddenTestFlag {
    outcome: TestOutcome;
    skillLabel: string;
}

export type HiddenTestSocketData = HiddenTestRequest;

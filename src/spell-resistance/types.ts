export type ResistSkill = "fort" | "refl" | "vont";

/**
 * Parsed outcome from resistencia.txt:
 *  - anula   → pass = nenhum efeito, nenhuma condição
 *  - metade  → pass = metade do dano, nenhuma condição
 *  - parcial → mesmo que metade (reduz à metade + evita condição)
 *  - texto   → efeito especificado no texto da magia; exibe todas as opções
 *  - none    → sem teste de resistência (cura sem resistência, etc.)
 */
export type ResistOutcome = "anula" | "metade" | "parcial" | "texto" | "none";

/** Uma condição de status extraída dos efeitos da mensagem de chat */
export interface SpellConditionData {
    /** ID do status em CONFIG.statusEffects, ex: "atordoado", "pasmo" */
    statusId: string;
    /** Label legível, ex: "Atordoado" */
    label: string;
    /** Duração em rodadas (se disponível) */
    durationRounds?: number;
    /** Duração em segundos (se disponível) */
    durationSeconds?: number;
}

/** Enviado do cliente do lançador para o cliente do alvo via socket */
export interface SpellResistRequest {
    type: "spell-resist-request";
    requestId: string;
    /** ID do usuário controlador do alvo (recebe o socket e abre o dialog) */
    targetUserId: string;
    /** ID do usuário lançador da magia */
    casterUserId: string;
    /** ID do ator alvo */
    targetActorId: string;
    casterName: string;
    spellName: string;
    /** Texto original de resistência, ex: "Vontade parcial" */
    resistTxt: string;
    /** Perícia de resistência parseada, ou null se não houver */
    resistSkill: ResistSkill | null;
    /** Tipo de resultado ao passar no teste */
    resistOutcome: ResistOutcome;
    /** CD do teste (extraído do HTML do card, inclui todos os bônus) */
    cd: number;
    /** Total do teste de resistência rolado (1d20 + bônus) */
    resistRollTotal: number;
    /** Bônus do alvo na perícia de resistência */
    resistBonus: number;
    /** Fórmula usada no teste, ex: "1d20 + 8" */
    resistFormula: string;
    /** Resultado apenas do d20 (para exibição) */
    d20Result: number;
    /** Total do roll de dano ou cura */
    damageTotal: number;
    /** Fórmula do roll de dano ou cura */
    damageFormula: string;
    /** true se a magia cura (curapv) */
    isHeal: boolean;
    /** Condições de status a aplicar (extraídas dos effects do chat) */
    conditions: SpellConditionData[];
    /** true se o alvo passou no teste (resistRollTotal >= cd) */
    passed: boolean;
}

export type SpellResistSocketData = SpellResistRequest;

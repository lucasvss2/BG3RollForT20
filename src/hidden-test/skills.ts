export interface T20Skill {
    key: string;
    label: string;
}

// Keys verified against live tormenta20 system actor.system.pericias
export const T20_SKILLS: T20Skill[] = [
    { key: "acro", label: "Acrobacia" },
    { key: "ades", label: "Adestramento" },
    { key: "atle", label: "Atletismo" },
    { key: "atua", label: "Atuação" },
    { key: "cava", label: "Cavalgar" },
    { key: "conh", label: "Conhecimento" },
    { key: "cura", label: "Cura" },
    { key: "dipl", label: "Diplomacia" },
    { key: "enga", label: "Enganação" },
    { key: "fort", label: "Fortitude" },
    { key: "furt", label: "Furtividade" },
    { key: "guer", label: "Guerra" },
    { key: "inic", label: "Iniciativa" },
    { key: "inti", label: "Intimidação" },
    { key: "intu", label: "Intuição" },
    { key: "inve", label: "Investigação" },
    { key: "joga", label: "Jogatina" },
    { key: "ladi", label: "Ladinagem" },
    { key: "luta", label: "Luta" },
    { key: "mist", label: "Misticismo" },
    { key: "nobr", label: "Nobreza" },
    { key: "perc", label: "Percepção" },
    { key: "pilo", label: "Pilotagem" },
    { key: "pont", label: "Pontaria" },
    { key: "refl", label: "Reflexos" },
    { key: "reli", label: "Religião" },
    { key: "sobr", label: "Sobrevivência" },
    { key: "vont", label: "Vontade" },
];

interface T20PericiaData {
    atributo?: string;
    value?: number;
    outros?: number;
    condi?: number;
    label?: string;
    treinado?: boolean;
    treino?: number;
}

export interface SkillBreakdown {
    total:      number;
    halfLevel:  number;
    treino:     number;
    attrMod:    number;
    attrKey:    string | null;
    outros:     number;
    condi:      number;
    fromValue:  boolean;       // true se pegamos direto do .value (T20 já preparou)
    raw:        T20PericiaData;
}

/**
 * Calcula o bônus total da perícia.
 *
 * IMPORTANTE: T20's prepareDerivedData computa o total da perícia em
 * pericias[key].value para AMBOS PCs e NPCs — esse valor JÁ contém:
 *   halfLevel + treino + attrMod + outros + condi
 * Adicionar outros/condi de novo causava double-counting (bug v1.18.x):
 *   ex.: Lich refl real=20 → modal mostrava 32 porque outros+condi=12 era somado.
 *
 * Para untrained skills sem value definido (skill ausente do statblock do NPC,
 * por exemplo), fazemos um fallback computando manualmente.
 */
export function computeSkillTotal(actor: FoundryActor, skillKey: string): number {
    return computeSkillBreakdown(actor, skillKey).total;
}

export function computeSkillBreakdown(actor: FoundryActor, skillKey: string): SkillBreakdown {
    const pericias = actor.system?.pericias as Record<string, T20PericiaData> | undefined;
    const empty: SkillBreakdown = {
        total: 0, halfLevel: 0, treino: 0, attrMod: 0, attrKey: null,
        outros: 0, condi: 0, fromValue: false,
        raw: { value: 0, outros: 0, condi: 0 },
    };
    if (!pericias) return empty;

    const skill = pericias[skillKey];
    if (!skill) return empty;

    const atributos = actor.system?.atributos as Record<string, { value?: number }> | undefined;
    const attrKey   = skill.atributo ?? null;
    const attrMod   = attrKey ? (atributos?.[attrKey]?.value ?? 0) : 0;
    const nivel     = actor.system?.nivel?.value ?? 0;
    const halfLevel = Math.floor(nivel / 2);
    const treino    = typeof skill.treino === "number" ? skill.treino : 0;
    const outros    = skill.outros ?? 0;
    const condi     = skill.condi ?? 0;
    const value     = skill.value ?? 0;

    if (value !== 0) {
        // T20 já consolidou tudo em .value — usar como total final.
        return {
            total: value,
            halfLevel, treino, attrMod, attrKey,
            outros, condi,
            fromValue: true,
            raw: skill,
        };
    }

    // Untrained / sem valor preparado — fallback de soma manual.
    const total = halfLevel + treino + attrMod + outros + condi;
    return {
        total, halfLevel, treino, attrMod, attrKey, outros, condi,
        fromValue: false,
        raw: skill,
    };
}

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
}

/**
 * Compute the total skill bonus for an actor.
 * T20's prepareDerivedData writes the full computed total (halfLevel + training +
 * attrMod) back into pericias[key].value for trained skills. Do NOT add the
 * attribute modifier again — that causes double-counting.
 * For untrained skills (value === 0) fall back to attrMod + halfLevel.
 */
export function computeSkillTotal(actor: FoundryActor, skillKey: string): number {
    const pericias = actor.system?.pericias as Record<string, T20PericiaData> | undefined;
    if (!pericias) return 0;

    const skill = pericias[skillKey];
    if (!skill) return 0;

    const base = skill.value ?? 0;
    const outros = skill.outros ?? 0;
    const condi = skill.condi ?? 0;

    if (base !== 0) {
        // value already contains halfLevel + training + attrMod
        return base + outros + condi;
    }

    // Untrained: compute from parts
    const atributos = actor.system?.atributos as Record<string, { value?: number }> | undefined;
    const attrMod = skill.atributo ? (atributos?.[skill.atributo]?.value ?? 0) : 0;
    const nivel = actor.system?.nivel?.value ?? 0;
    const halfLevel = Math.floor(nivel / 2);
    return attrMod + halfLevel + outros + condi;
}

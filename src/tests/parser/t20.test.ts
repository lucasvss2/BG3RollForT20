import { describe, it, expect } from "vitest";
import { parseT20 } from "@/parser/t20";

// Helper: call parseT20 with only the flavor string
const parse = (flavor: string) => parseT20({ flavor });

// ── Null / empty inputs ───────────────────────────────────────────────────────

describe("parseT20 — null / empty inputs", () => {
    it("returns null for undefined flavor", () => {
        expect(parseT20({})).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(parse("")).toBeNull();
    });

    it("returns null for whitespace-only string", () => {
        expect(parse("   ")).toBeNull();
    });

    it("returns null for HTML-only flavor (no text content)", () => {
        expect(parse("<span></span>")).toBeNull();
    });
});

// ── Damage rolls (must NOT be intercepted) ────────────────────────────────────

describe("parseT20 — damage rolls pass through", () => {
    it("returns null for 'Dano'", () => {
        expect(parse("Dano")).toBeNull();
    });

    it("returns null for 'Dano com Espada Longa'", () => {
        expect(parse("Dano com Espada Longa")).toBeNull();
    });

    it("returns null for 'dano' (lowercase)", () => {
        expect(parse("dano")).toBeNull();
    });
});

// ── Unknown roll types ────────────────────────────────────────────────────────

describe("parseT20 — unknown roll types", () => {
    it("returns null for an unrecognised string", () => {
        expect(parse("Rolagem Desconhecida")).toBeNull();
    });
});

// ── Initiative ────────────────────────────────────────────────────────────────

describe("parseT20 — Iniciativa", () => {
    it("matches 'Iniciativa'", () => {
        expect(parse("Iniciativa")).toEqual({ category: "Iniciativa" });
    });

    it("matches 'iniciativa' (lowercase)", () => {
        expect(parse("iniciativa")).toEqual({ category: "Iniciativa" });
    });

    it("matches when embedded in longer text", () => {
        expect(parse("Rolagem de Iniciativa")).toEqual({ category: "Iniciativa" });
    });

    it("skill name 'Iniciativa' also matches initiative (in SKILLS list)", () => {
        const result = parse("Iniciativa");
        expect(result?.category).toBe("Iniciativa");
    });
});

// ── Saving throws (Resistências) ──────────────────────────────────────────────

describe("parseT20 — Resistências (saving throws)", () => {
    it.each([
        ["Fortitude", "Fortitude"],
        ["Reflexo", "Reflexo"],
        ["Vontade", "Vontade"],
        ["fortitude", "Fortitude"],
        ["REFLEXO", "Reflexo"],
    ])("bare save name '%s' → subcategory '%s'", (flavor, expected) => {
        const result = parse(flavor);
        expect(result).toEqual({
            category: `Resistência de ${expected}`,
            subcategory: expected,
        });
    });

    it.each([
        ["Resistência de Fortitude", "Fortitude"],
        ["Resistência de Reflexo", "Reflexo"],
        ["Resistência de Vontade", "Vontade"],
        ["resistência de fortitude", "Fortitude"],
    ])("prefixed form '%s' → subcategory '%s'", (flavor, expected) => {
        const result = parse(flavor);
        expect(result).toEqual({
            category: `Resistência de ${expected}`,
            subcategory: expected,
        });
    });

    it("'Teste de Fortitude' resolves as a save, not a skill check", () => {
        const result = parse("Teste de Fortitude");
        expect(result?.category).toBe("Resistência de Fortitude");
        expect(result?.subcategory).toBe("Fortitude");
    });

    it("'Teste de Reflexo' resolves as a save", () => {
        const result = parse("Teste de Reflexo");
        expect(result?.category).toBe("Resistência de Reflexo");
    });

    it("'Teste de Vontade' resolves as a save", () => {
        const result = parse("Teste de Vontade");
        expect(result?.category).toBe("Resistência de Vontade");
    });
});

// ── Attack rolls ──────────────────────────────────────────────────────────────

describe("parseT20 — Ataques", () => {
    it("bare 'Ataque'", () => {
        const result = parse("Ataque");
        expect(result?.category).toBe("Ataque");
        expect(result?.subcategory).toBeUndefined();
    });

    it("'Ataque com Espada Longa'", () => {
        const result = parse("Ataque com Espada Longa");
        expect(result?.category).toBe("Ataque");
        expect(result?.subcategory).toBe("Espada Longa");
    });

    it("'Ataque com Arco Curto'", () => {
        const result = parse("Ataque com Arco Curto");
        expect(result?.category).toBe("Ataque");
        expect(result?.subcategory).toBe("Arco Curto");
    });

    it("weapon-first format: 'Espada Curta - Ataque'", () => {
        const result = parse("Espada Curta - Ataque");
        expect(result?.category).toBe("Ataque");
        expect(result?.subcategory).toBe("Espada Curta");
    });

    it("weapon-first format with en-dash: 'Machado – Ataque'", () => {
        const result = parse("Machado – Ataque");
        expect(result?.category).toBe("Ataque");
        expect(result?.subcategory).toBe("Machado");
    });

    it("'Ataque à distância com Arco Longo'", () => {
        const result = parse("Ataque à distância com Arco Longo");
        expect(result?.category).toBe("Ataque");
    });
});

// ── Spell attacks ─────────────────────────────────────────────────────────────

describe("parseT20 — Ataques Mágicos", () => {
    it("'Ataque Mágico'", () => {
        const result = parse("Ataque Mágico");
        expect(result?.category).toBe("Ataque Mágico");
    });

    it("'Ataque com Magia'", () => {
        const result = parse("Ataque com Magia");
        expect(result?.category).toBe("Ataque Mágico");
    });
});

// ── Skill checks (Testes de Perícia) ─────────────────────────────────────────

describe("parseT20 — Testes de Perícia", () => {
    it.each([
        "Acrobacia",
        "Atletismo",
        "Cavalgar",
        "Cura",
        "Diplomacia",
        "Enganação",
        "Furtividade",
        "Guerra",
        "Intimidação",
        "Intuição",
        "Jogatina",
        "Ladinagem",
        "Luta",
        "Misticismo",
        "Nobreza",
        "Ocultismo",
        "Ofício",
        "Percepção",
        "Pilotagem",
        "Pontaria",
        "Religião",
        "Sobrevivência",
    ])("bare skill name '%s'", (skill) => {
        const result = parse(skill);
        expect(result?.category).toBe(`Teste de ${skill}`);
        expect(result?.subcategory).toBe(skill);
    });

    it.each([
        ["Teste de Percepção", "Percepção"],
        ["Teste de Furtividade", "Furtividade"],
        ["Teste de Luta", "Luta"],
        ["Teste de Conhecimento", "Conhecimento"],
    ])("'%s' → subcategory '%s'", (flavor, expected) => {
        const result = parse(flavor);
        expect(result?.category).toBe(`Teste de ${expected}`);
        expect(result?.subcategory).toBe(expected);
    });

    it("parenthesised ability 'Furtividade (Destreza)'", () => {
        const result = parse("Furtividade (Destreza)");
        expect(result?.category).toBe("Teste de Furtividade");
        expect(result?.subcategory).toBe("Furtividade");
    });

    it("parenthesised ability 'Atletismo (Força)'", () => {
        const result = parse("Atletismo (Força)");
        expect(result?.category).toBe("Teste de Atletismo");
        expect(result?.subcategory).toBe("Atletismo");
    });
});

// ── Ability checks (Testes de Atributo) ──────────────────────────────────────

describe("parseT20 — Testes de Atributo", () => {
    it.each([
        "Força",
        "Destreza",
        "Constituição",
        "Inteligência",
        "Sabedoria",
        "Carisma",
    ])("bare ability name '%s'", (ability) => {
        const result = parse(ability);
        expect(result?.category).toBe(`Teste de ${ability}`);
        expect(result?.subcategory).toBe(ability);
    });

    it.each([
        ["Teste de Força", "Força"],
        ["Teste de Destreza", "Destreza"],
        ["Teste de Constituição", "Constituição"],
        ["Teste de Inteligência", "Inteligência"],
        ["Teste de Sabedoria", "Sabedoria"],
        ["Teste de Carisma", "Carisma"],
    ])("'%s' → subcategory '%s'", (flavor, expected) => {
        const result = parse(flavor);
        expect(result?.category).toBe(`Teste de ${expected}`);
        expect(result?.subcategory).toBe(expected);
    });
});

// ── HTML stripping ────────────────────────────────────────────────────────────

describe("parseT20 — HTML stripping", () => {
    it("strips tags from '<strong>Percepção</strong>'", () => {
        const result = parse("<strong>Percepção</strong>");
        expect(result?.category).toBe("Teste de Percepção");
    });

    it("strips tags from '<em>Ataque com Espada</em>'", () => {
        const result = parse("<em>Ataque com Espada</em>");
        expect(result?.category).toBe("Ataque");
        expect(result?.subcategory).toBe("Espada");
    });

    it("strips tags from '<span class=\"flavor\">Fortitude</span>'", () => {
        const result = parse('<span class="flavor">Fortitude</span>');
        expect(result?.category).toBe("Resistência de Fortitude");
    });
});

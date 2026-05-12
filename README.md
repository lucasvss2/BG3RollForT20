# aeris-bg3-rolls-t20

Adds **Tormenta20** (`t20`) system support to
[Aeris BG3 Rolls](https://foundryvtt.com/packages/aeris-bg3-rolls), enabling
the BG3-inspired cinematic dice roll overlay for the Brazilian Tormenta20 RPG.

---

## What it does

[aeris-bg3-rolls](https://gitlab.com/aeris-fvtt/aeris-bg3-rolls) ships with
parsers for D&D 5e and Pathfinder 2e only. This module bridges the gap by
registering a Portuguese-language roll parser for the `t20` system, so the
overlay correctly labels:

| T20 roll type | Overlay label |
|---|---|
| Perícia (Acrobacia, Percepção…) | `Teste de <Perícia>` |
| Resistência (Fortitude / Reflexo / Vontade) | `Resistência de <Resistência>` |
| Ataque com arma / à distância | `Ataque` + weapon subcategory |
| Ataque mágico | `Ataque Mágico` |
| Iniciativa | `Iniciativa` |
| Teste de atributo (Força, Destreza…) | `Teste de <Atributo>` |

Damage rolls are intentionally **not** intercepted — they appear in the chat
log as normal.

---

## Required modules

| Module | Where to get it |
|---|---|
| [Aeris BG3 Rolls](https://foundryvtt.com/packages/aeris-bg3-rolls) | Foundry package manager |
| [Aeris Core](https://foundryvtt.com/packages/aeris-core) | Foundry package manager |
| [socketlib](https://foundryvtt.com/packages/socketlib) | Foundry package manager |

The module activates only when the **Tormenta20** system (`t20`) is loaded.

---

## Compatible content modules

This module works transparently alongside all official Tormenta20 content
packages — they add actors, items, spells, and rules content but do not change
the system's roll mechanics:

- [Suplementos de Arton](https://github.com/mobguilherme/Suplementos-de-Arton)
- [Bestiário de Arton](https://github.com/mobguilherme/Bestiario-de-Arton)
- [Revista T20 — Duelo de Dragões](https://github.com/mobguilherme/Revista-T20-Duelo-de-Dragoes)
- [Revista T20 — Fullgor dos Deuses](https://github.com/mobguilherme/Revista-T20-Fullgor-dos-Deuses)
- [Aventura — Coração de Rubi](https://github.com/mobguilherme/Aventura-Coracao-de-Rubi)
- [Aventura — Fim dos Tempos](https://github.com/mobguilherme/Aventura-Fim-dos-Tempos)

---

## Installation

### From manifest URL _(recommended once published)_

```
https://your-host/aeris-bg3-rolls-t20/module.json
```

### Manual installation

1. Download or clone this repository.
2. Install Node.js 20+ and run:
   ```sh
   npm install
   npm run build
   ```
3. Copy the entire folder (including `dist/` and `module.json`) into your
   Foundry `Data/modules/aeris-bg3-rolls-t20/` directory.
4. Enable the module in Foundry → **Manage Modules**.

---

## Development

```sh
npm install        # install build tools
npm run dev        # build + watch for changes
npm run build      # production build → dist/main.bundle.js
npm run typecheck  # TypeScript type check without emitting
```

The source lives in `src/`:

```
src/
├── main.ts              Entry point — Foundry lifecycle hooks
├── constants.ts         Module IDs and hook names
├── parser/
│   └── t20.ts           T20 roll flavor-text parser (Portuguese)
├── integration/
│   └── index.ts         Multi-strategy bridge to aeris-bg3-rolls
├── utils/
│   └── logging.ts       Prefixed console helpers
└── types/
    └── global.d.ts      Ambient Foundry VTT / aeris-bg3-rolls types
```

### Integration strategy chain

The module attempts to register the T20 parser with aeris-bg3-rolls using
four strategies in priority order:

1. **Hook API** — listens for `aeris-bg3-rolls.ready` and calls
   `api.registerParser("t20", parseT20)` if the hook carries that method.
2. **Global API** — calls `game.bg3rolls.registerParser("t20", parseT20)` if
   the function is exposed on the global game object.
3. **libWrapper** — wraps `parseRollMeta` via libWrapper (optional module)
   to inject T20 handling before the original function runs.
4. **preCreateChatMessage fallback** — installs a Foundry hook that fires
   the aeris-bg3-rolls orchestrator hook (`aeris-bg3-rolls.alertChatMessage`)
   directly, bypassing the internal parser registry entirely.

Strategy 4 is always installed as a safety net. Strategies 1–3 short-circuit
it once one of them succeeds, preventing double-processing.

---

## Customising the parser

If Tormenta20 updates its roll flavor text or you use a fork of the system,
edit `src/parser/t20.ts` and rebuild. The relevant sections are:

- **`SKILLS`** — list of perícia names (Portuguese)
- **`SAVES`** — list of resistência names
- **`ABILITIES`** — list of atributo names
- **Regular expressions** — regex patterns for each roll category

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Overlay never appears | aeris-bg3-rolls or aeris-core is not enabled |
| Rolls appear in chat instead of overlay | Flavor text format doesn't match any parser pattern — open an issue with the exact flavor text |
| Double roll entries | A future aeris-bg3-rolls version added native T20 support — disable this module |

Enable the browser console and look for `[aeris-bg3-rolls-t20]` log lines to
trace which integration strategy was selected.

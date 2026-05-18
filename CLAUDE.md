# CLAUDE.md — t20-theme-overhaul

## Project Overview

Foundry VTT module for the **Tormenta20** system (`game.system.id = "tormenta20"`). Adds a BG3-inspired dark theme: cinematic roll overlay, restyled dialogs, chat cards, hidden skill tests, auto damage prompts, area spells, and a character sheet redesign.

- **Module ID:** `aeris-bg3-rolls-t20`
- **Foundry:** v13.351+
- **Repo:** https://github.com/lucasvss2/T20ThemeOverhaul
- **Local module path:** `C:\Users\lucas\AppData\Local\FoundryVTT\Data\modules\aeris-bg3-rolls-t20\`

---

## Development Workflow

### Commands

```bash
npm run typecheck   # tsc --noEmit — must pass before any commit/tag
npm test            # vitest run — 75 tests must pass
npm run build       # Vite → dist/main.bundle.js
npm run dev         # watch mode
npm run lint        # eslint src
```

### Before every commit

Run `npm test`. If any test fails, fix the source (not the test) and re-run. Only commit when `npm test` exits 0.

### Feature → Deploy (mandatory)

**Every completed feature or fix must trigger the full deploy flow below.** There is no "push code only" — shipping code without a release means Foundry users stay on the old version.

Version scheme: `MAJOR.MINOR.PATCH`
- New feature → bump MINOR, reset PATCH (`1.6.4` → `1.7.0`)
- Bug fix → bump PATCH (`1.6.4` → `1.6.5`)

### Full deploy flow

```
1.  npm run typecheck && npm test && npm run build   ← all must pass
2.  Bump "version" in module.json  (e.g. "1.7.0")
3.  git add module.json + changed files
4.  git commit -m "feat/fix: description (vX.Y.Z)"
5.  git tag vX.Y.Z
6.  git push origin <branch>:master && git push origin vX.Y.Z
        ↳ triggers .github/workflows/release.yml
          • runs typecheck + test + build on CI
          • patches module.json version + download URL
          • creates aeris-bg3-rolls-t20.zip
          • publishes GitHub Release (what Foundry reads)
7.  Copy dist/main.bundle.js + module.json → local AppData module folder
        C:\Users\lucas\AppData\Local\FoundryVTT\Data\modules\aeris-bg3-rolls-t20\
8.  Check GitHub Actions tab — wait for release workflow green ✓
```

**Rules:**
- Never push a tag without `npm run typecheck` passing locally first.
- Never report a deploy as done before step 8 (green CI).
- Work is done in a **worktree branch** (`claude/adoring-johnson-bbb8c4`), NOT directly on `master`. Push with `git push origin <branch>:master`.
- If CI fails post-push: fix → push new commit → re-tag:
  ```bash
  git tag -d vX.Y.Z
  git push origin --delete vX.Y.Z
  # fix code, commit, then re-tag and push
  ```
- Do NOT create GitHub releases manually via `gh release create` unless CI is definitively broken.

---

## Source File Map

```
src/
  main.ts                      — Hooks init/setup/ready; registers all sub-systems
  constants.ts                 — MODULE_ID, SYSTEM_ID, hook name strings
  types/global.d.ts            — Minimal ambient Foundry types (incl. CONFIG, toggleStatusEffect)
  utils/logging.ts             — log() / warn() helpers prefixed with [MODULE_ID]
  parser/t20.ts                — parseT20(): flavor string → RollMeta | null
  integration/index.ts         — createChatMessage hook → overlay
  overlay/BG3Overlay.ts        — Full-screen cinematic overlay singleton
  dialogs/bg3-dialog.ts        — BG3-style restyling for AbilityUseDialog
  chat/chatStyles.ts           — BG3-style restyling for T20 chat roll cards
  hidden-test/index.ts         — Secret skill test: GM rolls for multiple targets
  auto-damage/index.ts         — Auto damage application prompt (attack-based weapons)
  spell-resistance/index.ts    — Automatic saving throw + damage dialog for spells
  spell-resistance/types.ts    — SpellResistRequest, SpellConditionData, ResistSkill
  area-spells/index.ts         — Entry point for area-persistent spells (calls setupConsagrar + setupAuraSagrada)
  area-spells/consagrar.ts     — Consagrar: MeasuredTemplate claim, AE apply/remove, movement sync
  area-spells/aura-sagrada.ts  — Aura Sagrada (Paladino): ghost template + Aura de Cura (combatTurn heal)
  ui/skills-menu.ts            — Toolbar button that aggregates active skill actions (register/refresh API)
  sheet/index.ts               — Character sheet redesign (BG3 aesthetic)
  tests/
    parser/t20.test.ts         — Vitest unit tests for parseT20 (75 tests)
    setup.ts                   — Test environment setup
```

---

## Systems

| #   | File                          | Hook                     | Notes                                                                                   |
| --- | ----------------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| 1   | `overlay/BG3Overlay.ts`       | `createChatMessage`      | 1 000 ms delay, auto-dismiss 3 000 ms, CSS id `bg3-t20-styles`                          |
| 2   | `dialogs/bg3-dialog.ts`       | `renderApplication`      | Detects `.ability-use-form` / `.attribute-use-form`, CSS id `bg3-t20-dialog-styles`     |
| 3   | `chat/chatStyles.ts`          | `renderChatMessage`      | Target: `.tormenta20.chat-card.item-card` in `#chat-log`, CSS id `bg3-t20-chat-styles`  |
| 4   | `integration/index.ts`        | `createChatMessage`      | `resolveFlavorText` → `parseT20` → `BG3Overlay.show`                                    |
| 5   | `hidden-test/index.ts`        | socket                   | GM emits per-target; each player sees only their own result                             |
| 6   | `auto-damage/index.ts`        | `createChatMessage`      | Triggers on attack+damage rolls (weapons). Skips spells (no attack roll).               |
| 7   | `spell-resistance/index.ts`   | `createChatMessage`      | Triggers on spell rolls (tipo arc/div/uni, damage only, no attack). Rolls saving throw, sends dialog via socket. |
| 8   | `sheet/index.ts`              | —                        | Character sheet redesign                                                                |
| 9   | `area-spells/consagrar.ts`    | multiple (see below)     | Persistent area spell: MeasuredTemplate + AE management + movement sync                |
| 10  | `area-spells/aura-sagrada.ts` | multiple (see below)     | Paladin aura emitted from caster token, follows movement, ally-only via disposition    |
| 11  | `ui/skills-menu.ts`           | renderSceneControls, ready, canvasReady | Single toolbar button aggregating active skill actions (Consagrar remove, Aura cancel, ...) |

### Spell Resistance System (v1.6.5+)

Detects spell chat messages and auto-rolls saving throws for targeted tokens.

**Detection:** `itemData.tipo ∈ ['arc','div','uni']` + damage roll present + **no** attack roll + author == current user.

**Resistance text parsing** (`resistencia.txt`):
- `"Vontade parcial"` → skill=`vont`, outcome=`parcial` (half dmg + no condition on pass)
- `"Reflexos reduz à metade"` → skill=`refl`, outcome=`metade`
- `"Fortitude (veja texto)"` → skill=`fort`, outcome=`texto` (shows all options)
- `"Reflexos anula"` → skill=`refl`, outcome=`anula` (no effect on pass)
- `""` / `"nenhuma"` → no resistance; heals (curapv) proceed without a test

**CD extraction:** `message.content.match(/CD\s*(\d+)/)` — parses from rendered HTML, which includes all power bonuses (e.g. Fortalecimento Arcano). Do NOT use `itemData.resistencia.cd` — it reflects only the stored value, not runtime bonuses.

**Conditions:** Extracted from `message.flags.tormenta20.effects` effect names in format `"SpellName (ConditionName)"`. Matched against `CONFIG.statusEffects` by name; applied via `actor.toggleStatusEffect(id, { active: true })`.

**Heal detection:** `damageRoll.formula.includes('curapv')` → shows green heal dialog, applies PV directly.

---

### Consagrar Area Spell System (v1.6.63+)

Persistent area spell using a MeasuredTemplate (circle, 9m radius). Manages Active Effects on tokens inside the area.

**Hooks used:**
- `createChatMessage` — detects spell cast, registers `_pendingCasts` entry with `undeadPenalty`
- `createMeasuredTemplate` — claims T20's template (adds our flags via `doc.update`); applies AEs if already flagged (scene reload)
- `updateMeasuredTemplate` — (a) flag just added → apply AEs; (b) geometry changed → re-sync all tokens
- `deleteMeasuredTemplate` — removes all AEs created by this template
- `updateToken` — movement sync (see v13 quirk below)
- `createToken` — token placed in scene → sync against all templates
- `createActiveEffect` — dedup/adopt orphan AEs from `chat-apply-ae` button
- `canvasReady` — re-sync all tokens on scene load/switch
- `renderSceneControls` / `ready` — refresh remove-area button visibility
- `updateWorldTime` — expire templates after 1 in-game day (86 400 s)

**Template claim strategy:**
T20 creates its own MeasuredTemplate when a spell with area is cast. We detect this via `createMeasuredTemplate` (comparing `authorUid` vs `game.user.id`) and claim it by calling `doc.update({ flags.aeris-bg3-rolls-t20: {...} })`. This fires `updateMeasuredTemplate` which triggers AE application. Fallback: if no template appears within 4 s, prompt manual placement.

**Template flags (`flags.aeris-bg3-rolls-t20`):**
```
spell: "consagrar"          — identifies this as a Consagrar template
casterActorId               — actor ID of the caster
casterName                  — display name for UI
undeadPenalty               — penalty value (0 = no aprimoramento active)
createdAtGameTime           — game.time.worldTime at cast (for expiry)
creatorUserId               — game.user.id at cast (for remove button filtering)
```

**AE flags (`flags.aeris-bg3-rolls-t20`):**
```
consagrarTemplateOrigin: templateId  — links AE to its source template
consagrarHealingBoost: true          — marks the living-token boost AE
```

**Undead detection:**
- NPC: `actor.system.detalhes.raca === "Morto-vivo"` (normalized)
- PC: item of `type === "race"` with name `"Osteon"` or `"Soterrado"`

**Penalty computation (`computeUndeadPenaltyFromMessage`):**
Reads `message.flags.tormenta20.onUseEffects[]` (user-selected aprimoramentos with qty).
- Do NOT use `flags.tormenta20.effects` — it contains the baseline -2 AE regardless of selection.
- 1PM entry detected by: `/[-–−]\s*2\b.*?\btestes\b.*?\bdefesa\b/i` on `description`
- 2PM entry detected by: `/aumenta\s+(?:as\s+)?penalidades/i` on `description`
- If 1PM not activated → return 0 (no penalty at all)
- Final penalty = 2 + (qty × 1 for each 2PM entry)

**Multi-GM election (`isActiveGM()`):**
When multiple GMs are active, all receive hooks. To avoid duplicate AE creation, only the GM with the lexicographically smallest `user.id` (among active GMs) executes mutations. Pattern:
```typescript
function isActiveGM(): boolean {
    const myId = game.user?.id;
    if (!myId || !game.user?.isGM) return false;
    const activeGMs = (game.users?.contents ?? [])
        .filter(u => u.isGM && u.active)
        .map(u => u.id)
        .sort();
    return activeGMs[0] === myId;
}
```

**Dedup / adoption of orphan AEs:**
If the user clicks `chat-apply-ae` from the T20 chat card:
- If our AE for this template already exists → delete the new one (`createActiveEffect` hook)
- If our AE doesn't exist yet → adopt the new one by writing our `consagrarTemplateOrigin` flag

**Floating remove-area button:**
Injected as the last `<li>` in `menu#scene-controls-layers`. Visible to GM (all areas) and to the caster (`creatorUserId` flag match). CSS id: `bg3-t20-consagrar-remove-btn`. Dialogs use `.bg3-dialog` class + `CONSAGRAR_STYLES_ID` supplement.

---

### Aura Sagrada — Paladin Aura (v1.7.0, Fase 1)

Aura emitted FROM the paladin's token (no clickable grid). Currently implements only the base power + **Aura Poderosa** improvement (radius 30 m vs default 9 m).

**Architectural differences from Consagrar:**
- **Ghost template, created by us**: T20 does NOT auto-create a template for `type:"poder"` items. We create our own MeasuredTemplate, centered on the caster's token. No prompt — no canvas click.
- **Template follows the caster**: hooks on `updateToken` for the caster → we update template `x/y` to track. Result also re-syncs ALL other tokens (stationary tokens may enter/leave the aura when the emitter moves).
- **Ally detection via disposition**: AE only applies to the caster + tokens whose `document.disposition` equals the caster's. Hostiles never get the bonus.
- **No `onUseEffects`**: powers don't expose aprimoramentos in chat flags. "Aura Poderosa" is detected by checking the caster's items for an item named "Aura Poderosa" (normalized).
- **AE re-use**: instead of building the AE from scratch, we clone `message.flags.tormenta20.effects[0][0]` — T20 already computed `system.modificadores.pericias.resistencia += "<caster CHA>"` there. Allies receive the caster's CHA, not their own.
- **One aura per caster**: re-casting deletes the previous template (which cleans its AEs) then creates a new one.

**Detection:** `normalizeCondName(extractSpellName(message)) === "aura sagrada"` (mind the SPACE — `normalizeCondName` does NOT replace spaces with hyphens).

**Template flags (`flags.aeris-bg3-rolls-t20`):**
```
spell: "aura-sagrada"
casterTokenId          — token that emits the aura
casterActorId          — actor id (for re-finding token)
casterName             — display name
raioM                  — 9 or 30 (Aura Poderosa)
creatorUserId          — who cast it
baseEffectData         — AE template cloned per recipient
```

**Hooks:**
- `createChatMessage` → detect cast, call `onAuraSagradaCast` (only the author runs this)
- `updateToken` → caster moved? move template + resync all. Other token? resync just it.
- `updateMeasuredTemplate` → x/y/distance/flags changed → resync all
- `deleteMeasuredTemplate` → cleanup all AEs created by this template
- `createToken` → new token? sync against active auras
- `updateToken` (secondary listener) → disposition changed → resync token (ally/foe flip)
- `canvasReady` → resync everything on scene load

**Client setting:** `auraSagrada.alwaysPromptStartOfTurn` — when **false** (default), Aura de Cura applies automatically to all eligible allies at the caster's turn start. When **true**, opens a dialog with checkboxes pre-marked (player can deselect targets). Same setting will be reused by future Aura Ardente.

### Aura de Cura e Aura Ardente — semântica de tick (v1.9.1)

Itens normalizados nos poderes do caster: `"aura de cura"` (cura aliados elegíveis) e `"aura ardente"` (dano de luz em mortos-vivos/espíritos). Os dois são independentes — o caster pode ter um, o outro ou ambos.

**Quando o tick acontece**: o efeito é aplicado no início do **turno do ALVO** (não mais no turno do caster). O caster também é elegível pra Aura de Cura no PRÓPRIO turno, porque ele se inclui como aliado dentro da própria aura — preserva o texto "você e os aliados".

**Sustentar (custo de PM)**: quando o turno volta ao caster, o handler debita 1 PM por aura ativa dele. Auras que não couberem ser pagas são **canceladas automaticamente** (delete template → cleanup AEs via hook existente). Posta chat card vermelho `Aura Sagrada cancelada — sem PM` + `ui.notifications.warn`. O sustain roda ANTES do tick → se a aura cair por falta de PM, ela não cura nem dana ninguém neste mesmo turno.

**Aura de Cura**:
- Elegível = caster + tokens com mesma `disposition`, dentro da aura, com PV < max.
- Cura = `5 + CHA do caster` (lido de `template.flags.aeris-bg3-rolls-t20.baseEffectData.changes[0].value` — T20 já resolveu `@car` no cast).
- Aplica via `actor.update({ "system.attributes.pv.value": Math.min(max, cur + heal) })`.
- Posta chat card `Aura de Cura — <caster>` (border `#c8a96e`) com `<alvo>: +N`.

**Aura Ardente**:
- Elegível = tokens cuja raça (`actor.system.detalhes.raca`, normalizada) é `"morto-vivo"` ou contém `"espír"`, dentro da aura, com PV > 0. Disposition NÃO é checada (texto: "à sua escolha" — picker resolve).
- Dano = `5 + CHA do caster` (luz elemental).
- Aplica via `actor.applyDamage(amount, 1, false)` — sem RD. T20 ActorT20 expõe `applyDamage(amount, multiplier=1, applyRD=false)`.
- Posta chat card `Aura Ardente — <caster>` (border `#ff8a4a`).
- CSS suplementar: `.bg3-aura-ardente-picker` com texto laranja.

**Setting `auraSagrada.alwaysPromptStartOfTurn`**: quando `true`, abre 1 dialog por alvo perguntando aplicar/pular. Quando `false` (default), aplica direto.

**Hooks**: `combatStart` / `combatTurn` / `combatRound` (`isActiveGM()` é o único que roda; sequência: sustain → tick).

### Phases not yet implemented
Aura Antimagia · Aura de Invencibilidade · Égide Sagrada · Escudo Fraterno.

### Skills Menu (v1.8.0)

`src/ui/skills-menu.ts` é a camada compartilhada que substituiu botões avulsos na toolbar. Cada sistema chama `registerSkillAction({ id, label, icon, color, isVisible(), onClick() })` em seu `setup*()` e `refreshSkillsMenu()` depois de mudar estado relevante (cast/cancel/delete template, etc.).

Comportamento:
- 0 ações visíveis → o botão da toolbar é removido.
- 1 ação visível → click executa direto (sem menu intermediário); tooltip mostra o label da ação.
- 2+ ações visíveis → click abre um Dialog `.bg3-dialog` com lista; tooltip vira `"Skills ativas (N)"`.

Setup global em `main.ts` antes de `setupAreaSpells` — também re-refresh em `renderSceneControls`, `ready` e `canvasReady`.

---

## Foundry v13 Gotchas

### Rolls in createChatMessage

`message._source.rolls[0]` is a **JSON string** in v13. Always use `message.rolls` for Roll instances:

```typescript
// CORRECT
const rolls = message.rolls as Roll[] | undefined;
const roll = rolls?.[0]; // already a Roll instance

// WRONG — throws in v13
Roll.fromData((message as any)._source.rolls[0]);
```

### renderChatMessage args

`args[1]` is a direct `HTMLElement` in v13, NOT a jQuery array.

### `normalizeCondName` does NOT convert spaces to hyphens

`normalizeCondName(s)` = `s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()`. **No hyphen substitution.** Constants for matching multi-word power/spell names must keep the space: `"aura sagrada"`, NOT `"aura-sagrada"`. Got bitten by this writing Aura Sagrada detection.

### `flags.tormenta20.itemData` lacks `name` for powers

`message.flags.tormenta20.itemData` for `type:"poder"` items contains only the item's `.system` payload — there is no `name` top-level field. Always resolve the item name via `extractSpellName(message)` which parses `data-item-id` from the rendered content and looks it up via `actor.items.get(itemId).name`.

### updateToken — doc.x/y is OLD position during animation

When `updateToken` fires, `tokenDoc.x` and `tokenDoc.y` still hold the **pre-move** position. The destination is in `args[1].x` / `args[1].y` (the `changes` object). Pass these as `overrideXY` to any position-based check; only use `doc.x/y` when called outside of `updateToken` (e.g. `canvasReady`, `createToken`).

```typescript
Hooks.on("updateToken", (...args) => {
    const tokenDoc = args[0] as { object?: FoundryToken };
    const changes  = args[1] as Record<string, unknown> | undefined;
    const destX = typeof changes?.["x"] === "number" ? changes["x"] as number : undefined;
    const destY = typeof changes?.["y"] === "number" ? changes["y"] as number : undefined;
    const overrideXY = (destX !== undefined || destY !== undefined) ? { x: destX, y: destY } : undefined;
    void syncTokenWithTemplates(tokenDoc.object!, overrideXY);
});
```

---

## T20 Data Structures

```typescript
// Actor
actor.system.atributos.des.value; // modifier (not score)
actor.system.pericias.fort.value; // total Fortitude bonus
actor.system.pericias.refl.value; // total Reflexos bonus
actor.system.pericias.vont.value; // total Vontade bonus
actor.system.attributes.pv; // { value, max, temp }
actor.system.nivel.value; // character level
actor.system.detalhes.raca; // NPC race string, e.g. "Morto-vivo"

// Spell item (from message.getFlag("tormenta20","itemData"))
itemData.type; // "magia"
itemData.system.escola; // "evo"|"nec"|"con"|"tra"|"abj"|"enc"|"ilu"|"adv"
itemData.system.tipo;   // "arc"|"div"|"uni"
itemData.system.circulo; // 1–5
itemData.system.resistencia.txt; // "Vontade parcial (CD 18)"
itemData.system.resistencia.cd; // may be 0 — parse from txt as fallback

// message.flags.tormenta20 (T20 spell cast message)
flags.tormenta20.onUseEffects; // Array of { cost, description, qty } — user-selected aprimoramentos
flags.tormenta20.effects;      // Array<Array<AEData>> — baseline AEs regardless of selection (DON'T use for penalty)
flags.tormenta20.itemData;     // Full item data at cast time
flags.tormenta20.template;     // Template data if spell has area

// Roll object
roll.formula / roll.total;
roll.dice[0].faces; // 20
roll.dice[0].results[0].result; // natural die result
roll.options.type; // "attack"|"damage"|"initiative"|"skill"|"save"
```

### Saves

| Save      | key    | Atributo |
| --------- | ------ | -------- |
| Fortitude | `fort` | CON      |
| Reflexos  | `refl` | DEX      |
| Vontade   | `vont` | WIS      |

---

## Socket Pattern

```typescript
// Sender
game.socket?.emit(`module.${MODULE_ID}`, payload);

// Receiver
game.socket?.on(`module.${MODULE_ID}`, (raw) => {
  if (raw.targetUserId !== game.user?.id) return;
  // handle
});
```

**GM routing:** (1) online non-GM player owning target (`ownership >= 3`) → (2) active GM who is NOT the sender → (3) any active GM.

**Warning:** `game.user.targets` must be populated before `createChatMessage` fires. If empty, show `ui.notifications.warn`.

---

## Color Palette

| Role            | Hex       |
| --------------- | --------- |
| Gold accent     | `#c8a96e` |
| Gold glow       | `#6a4e18` |
| Text primary    | `#f0ebe0` |
| Text secondary  | `#e8e0d0` |
| Text muted      | `#9a8e7a` |
| Background dark | `#090604` |
| Background mid  | `#1c1209` |
| Crit green      | `#6ecf7a` |
| Fumble red      | `#cc4444` |

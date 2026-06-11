# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page, build-free browser RPG (ウィザードリィ風／魂の迷宮 - Dungeon of Souls). Pure HTML + ES Modules + Canvas — **no bundler, no package.json, no npm, no test runner, no lint config.** All monster/hero/item art is drawn programmatically as pixel art on Canvas (no image assets). Ships as a PWA (manifest + Service Worker, offline-capable).

> Note: `README.md` is partly out of date (it describes an earlier "B3F dragon, 3 floors" version). The actual game now has a town hub, multiple dungeons, a souls system, codices, quests, and an element/affinity system. Trust the code over the README.

## Running & "building"

There is no build step. Because it uses ES Modules, you must serve over HTTP (not `file://`):

```bash
python3 -m http.server 8000   # then open http://localhost:8000/
# or: npx serve .
```

Deploy is automatic: pushing to `main` triggers `.github/workflows/pages.yml`, which uploads the repo root as-is to GitHub Pages (https://kotarotao.github.io/DOS/). No build/test job runs in CI.

### Verifying changes without a browser
There is no test suite. To sanity-check JS edits, use Node:
- Syntax: `for f in $(git ls-files 'src/*.js'); do node --check "$f"; done`
- Module load / logic: a DOM-stub harness (`globalThis.document/window/localStorage/AudioContext` fakes) can `import('./src/game.js')` headlessly to catch load-time errors, and pure logic modules (`combat.js`, `dungeons/*`) can be imported and exercised directly. When testing combat in isolation, first `Object.assign(MONSTERS, DUNGEON_MONSTERS)` because that merge normally happens in `game.js`.

### Service Worker cache — bump on every shipped change
`sw.js` caches assets under a versioned key (`const CACHE = "dos-vNN"`). **Whenever you change any shipped file (JS/CSS/HTML), bump this version** (e.g. `dos-v53` → `dos-v54`), or returning players keep the stale cached copy.

## Architecture

### Module layout (`src/`)
- **`game.js`** — the hub. Owns the single global game state `G`, the main loop, input, all screen rendering (town/board/battle/status/codex overlays), and the bridge between board exploration and turn-based combat. By far the largest file; most features touch it.
- **`board.js`** — maze generation. Edge-walls (walls live on the *boundary* between cells, not as cells), dead-end event placement, stair placement.
- **`combat.js`** — pure combat logic: `Battle` state machine (per-actor speed-ordered turns), `SPELLS`, `CLASSES`, party/enemy construction, `gainExp`. Returns plain result objects; **all animation/SFX lives in `game.js`** (`combatStep` drives `Battle` and renders the results).
- **`sprites.js`** — `MONSTERS`, `HERO`, `ICONS` pixel-art definitions and `drawSprite`. `MONSTERS` starts with a base set and is **augmented at load time** by `Object.assign(MONSTERS, DUNGEON_MONSTERS)` in `game.js`.
- **`items.js`** — equipment/consumable catalog, 8-slot equip logic (`recalc`, `equip`), restrictions (alignment/class/two-handed/cursed).
- **`souls.js`**, **`content.js`** — souls system data/logic and misc content (quests/rumors/flavor).
- **`audio.js`** — Web Audio chiptune SFX + BGM, generated in code (no audio files).

### Dungeon registry (`src/dungeons/`) — the additive-by-design subsystem
- **`schema.js`** — shared definitions: `defMonster`/`defMonsters` (validates `artKey`, applies `palette`/`tint`, fills defaults), `ARTS` art prototypes, `MON_RACES`/`RACE_LABEL`, and the **element system** (`ELEMENTS`, `elemBeats`, `elemMult`).
- **`index.js`** — the single aggregation window. `MODULES = [d01, d02, d03, d04]`; **registration order = in-game unlock order.** Exposes `DUNGEONS` (configs) and `DUNGEON_MONSTERS` (merged dict). It throws on duplicate monster IDs.
- **`d01.js`…`d04.js`** — one file per dungeon. Each exports `monsters` (via `defMonsters`) and a `dungeon` config (`pool`, `deepPool`, `boss`, `enemyScale`, rates, etc.).
- **`common.js`** — shared low-level monsters (`cm_*`) reused across dungeons.

**Conventions when adding content here:**
- Monster IDs are **namespaced** (`d02_harpy`, `cm_slime`) and treated as **append-only** — IDs are persisted in saves and codex, so renaming/removing them breaks existing saves. Add new IDs rather than repurposing old ones.
- **Adding a dungeon = add one `import` + one entry to `MODULES` in `index.js`.** Nothing else references the files directly.
- Every monster needs a valid `artKey` (one of `ARTS`) — `defMonster` throws otherwise. Give visual variety via `palette`/`tint`, not new art.

### Element / affinity system
Six elements + `none`, defined in `schema.js`. Advantage cycle is **火→風→土→水→火** (fire→wind→earth→water→fire); **light↔dark are mutually advantageous**. `elemMult(atk, def)` returns 1.5 (advantage), 0.5 (disadvantage), or 1.0 (neutral / anything involving `none`). For light/dark both directions return 1.5 (no 0.5 reduction). Applied in `combat.js` `_physical` and the `atk`-spell branch; offensive spells carry an `element`, enemies carry `element` from their monster def.

### State & persistence
- All runtime state hangs off the single global `G` in `game.js`. `state` field switches the active screen (`town`/`board`/`battle`/`over`).
- Save key: `dos-save-v1` in `localStorage`. Only the fields in `SAVE_FIELDS` are persisted (transient animation state is excluded).
- Saving uses **`refSerialize`/ref-hydrate**: a custom serializer that encodes shared/circular object references as `{$r: index}` so object **identity is preserved** on load (a single soul object referenced from multiple places stays the same instance). When adding state that relies on shared references, keep it inside this graph rather than re-cloning.

### UI/overlay pattern
Screens are overlay `<div>`s in `index.html` (`#town-screen`, `#status-screen`, `#item-get`) toggled via `.hidden`. Reusable popups in `game.js`: `showChoice` (illustrated choice card), `showEvent` (illustrated info/event card), `showItemGet` (item-acquired card). Reuse these instead of hand-rolling overlays; they manage the `G.prompt` input-block flag and the shared `#item-get` container.

## Conventions
- Comments and all in-game/user-facing strings are in **Japanese**; match the surrounding tone (dark-fantasy flavor for monster/event text).
- Plain ES Modules with explicit `.js` extensions in imports. No TypeScript, no JSX, no framework.

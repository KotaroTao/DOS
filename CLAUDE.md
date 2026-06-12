# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page, build-free browser RPG (ウィザードリィ風／魂の迷宮 - Dungeon of Souls). Pure HTML + ES Modules + Canvas — **no bundler, no package.json, no npm, no test runner, no lint config.** All monster/hero/item art is drawn programmatically as pixel art on Canvas (no image assets). Ships as a PWA (manifest + Service Worker, offline-capable).

The game has a town hub, 100 generated dungeons (each with a unique boss), a souls system, codices, quests, and an element/affinity system. When README and code disagree, trust the code.

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
- **`board.js`** — maze generation. Edge-walls (walls live on the *boundary* between cells, not as cells), dead-end event placement, stair placement, and poison-floor tiles (`type:"poison"`, corridor cells, `cfg.poisonRate` from the dungeon generator — rank 3 band and deeper).
- **`combat.js`** — pure combat logic: `Battle` state machine (per-actor AGI-ordered turns), `SPELLS`, enemy construction (`makeEnemy`/`spawnCardEnemies`/`spawnBossEnemies`/`spawnMimic`). Returns plain result objects; **all animation/SFX lives in `game.js`** (`combatStep` drives `Battle` and renders the results).
  - **Stats are unified into six attributes** (`atk`/`vit`/`agi`/`int`/`pie`/`luk`, plus HP/MP) — there are no derived こうげき/ぼうぎょ/すばやさ/AC values. ATK=physical damage, VIT=damage reduction, AGI=turn order/evasion, INT=attack-spell power, PIE=heal power, LUK=crit. Equipment, souls, and buffs all add to/multiply these same keys. Monster *defs* still author `atk/def/spd`; `makeEnemy` maps them to `atk/vit/agi` at spawn. Old saves (item/actor `def`/`spd`/`ac`) are migrated on load by `migrateLegacyStats` in `game.js`.
- **`sprites.js`** — `MONSTERS`, `HERO`, `ICONS` pixel-art definitions and `drawSprite`. `MONSTERS` starts with a base set and is **augmented at load time** by `Object.assign(MONSTERS, DUNGEON_MONSTERS)` in `game.js`.
- **`items.js`** — base equipment/consumable items, item categories (`ITEM_CATS`, `WEAPON_CATS`), 8-slot equip logic (`recalc`, `equip` — `recalc` also aggregates elemental attack/defense from gear), restrictions (alignment/class/two-handed/cursed).
- **`souls.js`** — souls system data/logic. Also owns the **job-rank passive system**: `PASSIVES` (the effect catalog), `JOB_PASSIVES` (per job key — base class or `"base+sub"` hybrid — one unique passive per rank 2-5; higher ranks include lower ones, and leveled effects never stack: the highest level wins, also across party-wide effects), and hybrid rank titles (`HYBRIDS[k].ranks`, rank 1-5). Rank 1 has no passive. `recalcDoll` fills `doll.passiveMap` (key→lv), which `combat.js` (reactions: かばう/反撃/見切り/魔障壁/不屈…, openings: preempt/ambush, 省詠唱 via `spellCost`) and `game.js` (victory hooks, poison-floor resist, sense markers, drop/gold/soul bonuses) read. Old stat-multiplier passives (ATK+18% etc.) were removed.
- **`content.js`** — rank display definitions only (`RANK_NAME`/`RANK_COLOR`). The old procedural item generation (rank-prefix "二つ名" items) was removed in favor of `src/catalog/`.
- **`audio.js`** — Web Audio chiptune SFX + BGM, generated in code (no audio files).

### Dungeon registry (`src/dungeons/`) — generated dungeons + rank-tiered bestiary
- **`schema.js`** — shared definitions: `defMonster`/`defMonsters` (validates `artKey`, applies `palette`/`tint`, fills defaults), `ARTS` art prototypes, `MON_RACES`/`RACE_LABEL`, **`monStats(rank, boss)`** (the single balance point: rank 1-10 → hp/atk/def/spd/soul/gold curves), and the **element system** (`ELEMENTS`, `elemBeats`, `elemMult`).
- **`bestiary.js`** — ALL monsters, organized by **rank 1-10**. Legacy monsters (`cm_*`, `d01_*`…`d04_*`, defined in `common.js`/`d01.js`…`d04.js`, ids preserved) are rank-remapped and re-statted via `monStats` at load; new monsters use the `bs_` prefix. Exports `BESTIARY` (id→def), `RANK_POOLS` (rank→{regular, boss}), and **`BOSS_ORDER`** (rank → ordered list of 10 boss ids; dungeon n gets `BOSS_ORDER[rank][(n-1)%10]`, so **all 100 dungeons have a unique boss**). Throws if any rank 1-10 lacks regulars, lacks a boss, or has a malformed `BOSS_ORDER` row. Don't reorder `BOSS_ORDER` entries — that silently reassigns which dungeon a boss belongs to.
- **`generator.js`** — generates all **100 dungeon configs** deterministically from the dungeon number n (1-100): rank = `ceil(n/10)`, name from a fixed 100-entry table, regular pools rotate through `RANK_POOLS`, boss = `BOSS_ORDER[rank][(n-1)%10]`, `enemyScale` ramps 0.7→1.7 within each 10-dungeon band, `lootLv = [n*1.5, n*2]`, `rankBonus` is logarithmic (legend souls stay ~3.6% even at n=100), `soulLevelBonus = floor((√n-1)*1.6)`.
- **`index.js`** — the aggregation window: re-exports `DUNGEONS` (from generator) and `DUNGEON_MONSTERS` (= `BESTIARY`).
- **`d01.js`…`d04.js`/`common.js`** — kept only as monster-definition sources for bestiary.js; their `dungeon` config exports are no longer used.

**Conventions when adding content here:**
- Monster IDs are **namespaced** (`bs_troll`, `cm_slime`) and treated as **append-only** — IDs are persisted in saves and codex, so renaming/removing them breaks existing saves. Add new IDs rather than repurposing old ones.
- **Adding a monster = append one entry to `bestiary.js` with a `rank` (1-10).** It automatically appears in every dungeon of that rank band. Don't hand-write hp/atk — stats come from `monStats`.
- Every monster needs a valid `artKey` (one of `ARTS`) — `defMonster` throws otherwise. New 12x12 art prototypes can be added to `ARTS`; otherwise differentiate via `palette`/`tint`.

### Item catalog (`src/catalog/`) — unique items, additive-by-design
- **`defs.js`** — shared item `ARTS` (12x12 shapes per weapon subcategory / armor type / misc trinket) and builders `W/S/A/H/F/G/R/M/U` (weapon/shield/body/head/feet/hands/accessory/misc/usable). Builders derive atk/def/price/rank from the hidden item level and validate input (throw on bad cat/shape/lv/desc).
- **`weapons.js`/`armor.js`/`gear.js`/`misc.js`/`legends.js`** — the hand-written unique-item catalogs (100 weapons, 50 shields, 50 body, 50 head, 50 feet, 18 hands, 8 accessories, 50 misc loot, a few potions, plus 11 mythic legends at lv165-200). **`index.js`** merges them into `CATALOG_ITEMS` (throws on duplicate IDs); `game.js` does `Object.assign(ITEMS, CATALOG_ITEMS)` at load.
- Item IDs are prefixed (`w_`/`s_`/`a_`/`h_`/`f_`/`g_`/`r_`/`m_`/`u_`) and **append-only** (saves/codex reference them). Names are unique one-offs — there are no rank-prefix "二つ名" items anymore.
- Every item has a **hidden level `lv` (1-200)** matching the 100-dungeon `lootLv` bands (lv1-20 = mundane gear, 165-200 = mythic): dungeons define a `lootLv: [min, max]` band (interpolated by floor depth) and `game.js` rolls loot with a gaussian window around that center plus a global decay, so higher-lv items are rarer everywhere. Monster drops are assigned deterministically from the lv band matching the monster's rank (`rank*19`). Display rank (R1-R6) derives from lv via `lvToRank` (thresholds 20/45/80/120/165). When adding items, keep every ~20-lv bucket populated or loot rolls in that band degrade to the `herb` fallback.
- Slots `misc` (その他: sellable loot) and `mat` (貴重品: event items like 空の魂) can't be equipped or used; they exist for the codex/shop categories.

### Element / affinity system
Six elements + `none`, defined in `schema.js`. Advantage cycle is **火→風→土→水→火** (fire→wind→earth→water→fire); **light↔dark are mutually advantageous**. Offensive spells carry an `element`, enemies carry `element` from their monster def.

**Elemental attack/defense stats (属性攻撃/属性防御):** items can carry `eAtk`/`eDef` (`{el, lv}`); `recalc` aggregates them per member into `member.elemAtk`/`member.elemDef` (same element stacks, capped at Lv2=◎; different elements don't mix — strongest wins). `elemDmgMult(aE, aLv, tgtElem, tgtDef)` in `schema.js` is the single damage-multiplier entry point used by `combat.js` (`_physical` and the `atk`-spell branch): the attack side compares the attack element vs the target's innate element (Lv1=◯ ±50%, Lv2=◎ ±100%), the defense side compares the defender's `elemDef` vs the incoming attack element (same magnitudes, reduction when the defense element has the advantage). Spells act as Lv1 unless the caster's `elemAtk` matches the spell element. The legacy flat `elemMult` remains for reference but combat uses `elemDmgMult`.

### State & persistence
- All runtime state hangs off the single global `G` in `game.js`. `state` field switches the active screen (`town`/`board`/`battle`/`over`).
- Save key: `dos-save-v2` in `localStorage` (v1 saves are intentionally orphaned — the v2 content reset re-scaled all item levels and soul caps). Only the fields in `SAVE_FIELDS` are persisted (transient animation state is excluded).
- Saving uses **`refSerialize`/ref-hydrate**: a custom serializer that encodes shared/circular object references as `{$r: index}` so object **identity is preserved** on load (a single soul object referenced from multiple places stays the same instance). When adding state that relies on shared references, keep it inside this graph rather than re-cloning.

### UI/overlay pattern
Screens are overlay `<div>`s in `index.html` (`#town-screen`, `#status-screen`, `#item-get`) toggled via `.hidden`. Reusable popups in `game.js`: `showChoice` (illustrated choice card), `showEvent` (illustrated info/event card), `showItemGet` (item-acquired card). Reuse these instead of hand-rolling overlays; they manage the `G.prompt` input-block flag and the shared `#item-get` container.

## Conventions
- Comments and all in-game/user-facing strings are in **Japanese**; match the surrounding tone (dark-fantasy flavor for monster/event text).
- Plain ES Modules with explicit `.js` extensions in imports. No TypeScript, no JSX, no framework.

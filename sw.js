// オフライン対応キャッシュ (PWA / アプリ化用)
// 戦略: バージョン一括キャッシュ (atomic versioned cache)。
// install 時に全アセットを同一バージョンで先読みし、fetch は同バージョンの
// キャッシュから返す。これにより「新しい game.js + 古い souls.js」のような
// モジュール混在 (export 不一致で白画面) が構造的に起きない。
// 新デプロイは CACHE 名の変更で検出され、ページ側が自動リロードする。
// 版は手で上げない: リポジトリでは "dos-dev" のままにしておき、デプロイ時に
// .github/workflows/pages.yml がコミットのハッシュ ("dos-<sha 12桁>") へ書き換える
// (並行するブランチが同じ行を書き換えて衝突しないように)。
// "dos-dev" のまま動く時 (手元の http.server など) はキャッシュを使わず、常にネットワークから読む。
const CACHE = "dos-dev";
const DEV = CACHE === "dos-dev";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./theme.css",
  "./title.css",
  "./town.css",
  "./dungeon.css",
  "./ui.css",
  "./ui-hub.css",
  "./ui-party.css",
  "./ui-shop.css",
  "./ui-dungeon.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./src/game.js",
  "./src/journal.js",
  "./src/archive-stories.js",
  "./src/archive-art.js",
  "./art/story/road-to-roadal.webp",
  "./art/story/irene-soul-lamp.webp",
  "./art/story/first-vessel-awakening.webp",
  "./art/story/three-vessels-audience.webp",
  "./art/story/four-vessels-departure.webp",
  "./art/story/first-descent-gatekeeper.webp",
  "./art/story/irene-meeting.webp",
  "./art/story/royal-audience.webp",
  "./art/story/irene-repair.webp",
  "./art/story/chapter1/w01_lantern.webp",
  "./art/story/chapter1/report_w01.webp",
  "./art/story/chapter1/w02_sigil.webp",
  "./art/story/chapter1/report_w02.webp",
  "./art/story/chapter1/mem_w03.webp",
  "./art/story/chapter1/report_w03.webp",
  "./art/story/chapter1/w04_arm.webp",
  "./art/story/chapter1/irene_reveal.webp",
  "./art/story/chapter1/report_w04.webp",
  "./art/story/chapter1/minePass.webp",
  "./art/story/chapter1/mem_w05.webp",
  "./art/story/chapter1/report_w05.webp",
  "./art/story/chapter1/irene_fort.webp",
  "./art/story/chapter1/ch1_end.webp",
  "./art/story/chapter1/irene_familiar.webp",
  "./art/story/chapter2/w06_roll.webp",
  "./art/story/chapter2/report_w06.webp",
  "./art/story/chapter2/w07_names.webp",
  "./art/story/chapter2/w07_sera.webp",
  "./art/story/chapter2/irene_sera.webp",
  "./art/story/chapter2/report_w07.webp",
  "./art/story/chapter2/w08_banner.webp",
  "./art/story/chapter2/report_w08.webp",
  "./art/story/chapter2/w09_map.webp",
  "./art/story/chapter2/mem_w09.webp",
  "./art/story/chapter2/report_w09.webp",
  "./art/story/chapter2/irene_roots.webp",
  "./art/story/chapter2/ch2_end.webp",
  "./art/story/chapter3/w10_rope.webp",
  "./art/story/chapter3/report_w10.webp",
  "./art/story/chapter3/w11_hut.webp",
  "./art/story/chapter3/report_w11.webp",
  "./art/story/chapter3/w12_torso.webp",
  "./art/story/chapter3/report_w12.webp",
  "./art/story/chapter3/irene_torso.webp",
  "./art/story/chapter3/mem_w13.webp",
  "./art/story/chapter3/report_w13.webp",
  "./art/story/chapter3/ch3_end.webp",
  "./art/story/chapter3/irene_trust.webp",
  "./art/story/chapter4/w14_lamp.webp",
  "./art/story/chapter4/report_w14.webp",
  "./art/story/chapter4/w15_mural.webp",
  "./art/story/chapter4/report_w15.webp",
  "./art/story/chapter4/w16_legs.webp",
  "./art/story/chapter4/report_w16.webp",
  "./art/story/chapter4/irene_sera_wake.webp",
  "./art/story/chapter4/mem_w17.webp",
  "./art/story/chapter4/report_w17.webp",
  "./art/story/chapter4/ch4_end.webp",
  "./art/story/dungeons/lore_w01.webp",
  "./art/story/dungeons/lore_w02.webp",
  "./art/story/dungeons/lore_w03.webp",
  "./art/story/dungeons/lore_w04.webp",
  "./art/story/dungeons/lore_w05.webp",
  "./art/story/dungeons/lore_w06.webp",
  "./art/story/dungeons/lore_w07.webp",
  "./art/story/dungeons/lore_w08.webp",
  "./art/story/dungeons/lore_w09.webp",
  "./art/story/dungeons/lore_w10.webp",
  "./art/story/dungeons/lore_w11.webp",
  "./art/story/dungeons/lore_w12.webp",
  "./art/story/dungeons/lore_w13.webp",
  "./art/story/dungeons/lore_w14.webp",
  "./art/story/dungeons/lore_w15.webp",
  "./art/story/dungeons/lore_w16.webp",
  "./art/story/dungeons/lore_w17.webp",
  "./art/story/dungeons/lore_ws1.webp",
  "./art/story/dungeons/lore_ws2.webp",
  "./src/ui/journal.js",
  "./src/joblore.js",
  "./src/items.js",
  "./src/weaponpower.js",
  "./src/board.js",
  "./src/traps.js",
  "./src/telemetry.js",
  "./src/stability.js",
  "./src/expedition.js",
  "./src/resonance.js",
  "./art/tutorial/gatekeeper.png",
  "./src/levelcurve.js",
  "./src/baseline.js",
  "./src/pricing.js",
  "./src/events.js",
  "./src/sprites.js",
  "./src/itemart/core.js",
  "./src/itemart/theme.js",
  "./src/itemart/emblems.js",
  "./src/itemart/front.js",
  "./src/itemart/weapons.js",
  "./src/itemart/armor.js",
  "./src/itemart/head.js",
  "./src/itemart/limbs.js",
  "./src/itemart/accs.js",
  "./src/itemart/unid.js",
  "./src/itemart/salts.js",
  "./src/itemart/index.js",
  "./src/itemart/hand/index.js",
  "./src/itemart/hand/pal.js",
  "./src/itemart/hand/job2.js",
  "./src/itemart/hand/job3.js",
  "./src/itemart/hand/job1.js",
  "./src/itemart/hand/l5.js",
  "./src/itemart/hand/l67.js",
  "./src/itemart/hand/l8.js",
  "./src/itemart/hand/l9.js",
  "./src/itemart/hand/l10.js",
  "./src/itemart/hand/arm1.js",
  "./src/itemart/hand/job4.js",
  "./src/itemart/hand/arm3.js",
  "./src/itemart/hand/arm2.js",
  "./src/itemart/hand/l34.js",
  "./src/itemart/hand/l12.js",
  "./src/itemart/hand/acc.js",
  "./src/itemart/hand/sr1.js",
  "./src/combat.js",
  "./src/resistance.js",
  "./src/autotactics.js",
  "./src/buffstage.js",
  "./src/skilldefs.js",
  "./src/jobkit/index.js",
  "./src/jobkit/common.js",
  "./src/jobkit/fighter.js",
  "./src/jobkit/knight.js",
  "./src/jobkit/priest.js",
  "./src/jobkit/mage.js",
  "./src/jobkit/thief.js",
  "./src/jobkit/bishop.js",
  "./src/jobkit/samurai.js",
  "./src/jobkit/berserker.js",
  "./src/jobkit/hunter.js",
  "./src/jobkit/shadow.js",
  "./src/jobkit/paladin.js",
  "./src/jobkit/guardian.js",
  "./src/jobkit/spellblade.js",
  "./src/jobkit/monk.js",
  "./src/jobkit/hexer.js",
  "./src/jobkit/hermit.js",
  "./src/jobkit/brigand.js",
  "./src/jobkit/arcthief.js",
  "./src/jobkit/crusader.js",
  "./src/jobkit/battlemage.js",
  "./src/jobkit/darkknight.js",
  "./src/jobkit/templar.js",
  "./src/jobkit/exorcist.js",
  "./src/jobkit/warden.js",
  "./src/jobkit/arcanist.js",
  "./src/jobkit/inquisitor.js",
  "./src/jobkit/archbishop.js",
  "./src/jobkit/ascetic.js",
  "./src/jobkit/hero.js",
  "./src/jobkit/asura.js",
  "./src/jobkit/dragonknight.js",
  "./src/jobkit/necromancer.js",
  "./src/jobkit/sage.js",
  "./src/jobkit/cardinal.js",
  "./src/jobkit/archmage.js",
  "./src/jobkit/chaplain.js",
  "./src/jobkit/sera.js",
  "./src/souls.js",
  "./src/content.js",
  "./src/audio.js",
  "./src/music/dsp.js",
  "./src/music/instruments.js",
  "./src/music/bank.js",
  "./src/music/worker.js",
  "./src/music/engine.js",
  "./src/music/score.js",
  "./src/music/songs.js",
  "./src/music/legacy.js",
  "./src/music/sfx.js",
  "./src/opening.js",
  "./src/quests.js",
  "./src/tavern.js",
  "./src/story.js",
  "./src/abyss.js",
  "./src/title.js",
  "./src/pxpaint.js",
  "./src/titleart.js",
  "./src/openingart.js",
  "./src/openingillustrations.js",
  "./art/opening/scenes.png",
  "./src/storyart.js",
  "./art/op_dolls.png",
  "./art/mansion_irene.jpg",
  // 呪術師R1〜R5: 聖戦士基準の透明原画。
  "./art/jobs/hexer_1.webp",
  "./art/jobs/hexer_2.webp",
  "./art/jobs/hexer_3.webp",
  "./art/jobs/hexer_4.webp",
  "./art/jobs/hexer_5.webp",
  "./art/jobs/fighter_1.webp", // 戦士R1〜R5は聖戦士基準の原画へ差し替え済み。
  "./art/jobs/ascetic_1.webp",
  "./art/jobs/ascetic_2.webp",
  "./art/jobs/ascetic_3.webp",
  "./art/jobs/ascetic_4.webp",
  "./art/jobs/ascetic_5.webp",
  "./art/jobs/archbishop_1.webp",
  "./art/jobs/archbishop_2.webp",
  "./art/jobs/archbishop_3.webp",
  "./art/jobs/archbishop_4.webp",
  "./art/jobs/archbishop_5.webp",
  "./art/jobs/hero_1.webp",
  "./art/jobs/hero_2.webp",
  "./art/jobs/hero_3.webp",
  "./art/jobs/hero_4.webp",
  "./art/jobs/hero_5.webp",
  "./art/jobs/hermit_1.webp",
  "./art/jobs/hermit_2.webp",
  "./art/jobs/hermit_3.webp",
  "./art/jobs/hermit_4.webp",
  "./art/jobs/hermit_5.webp",
  "./art/jobs/fighter_2.webp",
  "./art/jobs/fighter_3.webp",
  "./art/jobs/fighter_4.webp",
  "./art/jobs/fighter_5.webp",
  "./art/jobs/battlemage_1.webp",
  "./art/jobs/battlemage_2.webp",
  "./art/jobs/battlemage_3.webp",
  "./art/jobs/battlemage_4.webp",
  "./art/jobs/battlemage_5.webp",
  "./art/jobs/arcthief_1.webp",
  "./art/jobs/arcthief_2.webp",
  "./art/jobs/arcthief_3.webp",
  "./art/jobs/arcthief_4.webp",
  "./art/jobs/arcthief_5.webp",
  // 祓魔師：確認済みR1と聖戦士基準で制作した透過原画版 R1〜R5。
  "./art/jobs/exorcist_1.webp",
  "./art/jobs/exorcist_2.webp",
  "./art/jobs/exorcist_3.webp",
  "./art/jobs/exorcist_4.webp",
  "./art/jobs/exorcist_5.webp",
  "./art/jobs/priest_1.webp",
  "./art/jobs/priest_2.webp",
  "./art/jobs/priest_3.webp",
  "./art/jobs/priest_4.webp",
  "./art/jobs/priest_5.webp",
  "./art/jobs/mage_1.webp",
  "./art/jobs/mage_2.webp",
  "./art/jobs/mage_3.webp",
  "./art/jobs/mage_4.webp",
  "./art/jobs/mage_5.webp",
  "./art/jobs/berserker_1.webp",
  "./art/jobs/berserker_2.webp",
  "./art/jobs/berserker_3.webp",
  "./art/jobs/berserker_4.webp",
  "./art/jobs/berserker_5.webp",
  "./art/jobs/crusader_1.webp",
  "./art/jobs/crusader_2.webp",
  "./art/jobs/crusader_3.webp",
  "./art/jobs/crusader_4.webp",
  "./art/jobs/crusader_5.webp",
  "./art/jobs/sera_1.webp",
  "./art/jobs/sera_2.webp",
  "./art/jobs/sera_3.webp",
  "./art/jobs/sera_4.webp",
  "./art/jobs/sera_5.webp",
  "./art/jobs/archmage_1.webp",
  "./art/jobs/archmage_2.webp",
  "./art/jobs/archmage_3.webp",
  "./art/jobs/archmage_4.webp",
  "./art/jobs/archmage_5.webp",
  "./art/jobs/guardian_1.webp",
  "./art/jobs/guardian_2.webp",
  "./art/jobs/guardian_3.webp",
  "./art/jobs/guardian_4.webp",
  "./art/jobs/guardian_5.webp",
  "./art/jobs/samurai_1.webp",
  "./art/jobs/samurai_2.webp",
  "./art/jobs/samurai_3.webp",
  "./art/jobs/samurai_4.webp",
  "./art/jobs/samurai_5.webp",
  "./art/jobs/templar_1.webp",
  "./art/jobs/templar_2.webp",
  "./art/jobs/templar_3.webp",
  "./art/jobs/templar_4.webp",
  "./art/jobs/templar_5.webp",
  "./art/jobs/monk_1.webp",
  "./art/jobs/monk_2.webp",
  "./art/jobs/monk_3.webp",
  "./art/jobs/monk_4.webp",
  "./art/jobs/monk_5.webp",
  "./art/jobs/spellblade_1.webp",
  "./art/jobs/spellblade_2.webp",
  "./art/jobs/spellblade_3.webp",
  "./art/jobs/spellblade_4.webp",
  "./art/jobs/spellblade_5.webp",
  "./art/jobs/asura_1.webp",
  "./art/jobs/asura_2.webp",
  "./art/jobs/asura_3.webp",
  "./art/jobs/asura_4.webp",
  "./art/jobs/asura_5.webp",
  "./art/jobs/dragonknight_1.webp",
  "./art/jobs/dragonknight_2.webp",
  "./art/jobs/dragonknight_3.webp",
  "./art/jobs/dragonknight_4.webp",
  "./art/jobs/dragonknight_5.webp",
  "./art/jobs/darkknight_1.webp",
  "./art/jobs/darkknight_2.webp",
  "./art/jobs/darkknight_3.webp",
  "./art/jobs/darkknight_4.webp",
  "./art/jobs/darkknight_5.webp",
  "./art/jobs/cardinal_1.webp",
  "./art/jobs/cardinal_2.webp",
  "./art/jobs/cardinal_3.webp",
  "./art/jobs/cardinal_4.webp",
  "./art/jobs/cardinal_5.webp",
  "./art/jobs/shadow_1.webp",
  "./art/jobs/shadow_2.webp",
  "./art/jobs/shadow_3.webp",
  "./art/jobs/shadow_4.webp",
  "./art/jobs/shadow_5.webp",
  "./art/jobs/sage_1.webp",
  "./art/jobs/sage_2.webp",
  "./art/jobs/sage_3.webp",
  "./art/jobs/sage_4.webp",
  "./art/jobs/sage_5.webp",
  "./art/jobs/bishop_1.webp",
  "./art/jobs/bishop_2.webp",
  "./art/jobs/bishop_3.webp",
  "./art/jobs/bishop_4.webp",
  "./art/jobs/bishop_5.webp",
  "./art/jobs/knight_1.webp",
  "./art/jobs/knight_2.webp",
  "./art/jobs/knight_3.webp",
  "./art/jobs/knight_4.webp",
  "./art/jobs/knight_5.webp",
  "./art/jobs/paladin_1.webp",
  "./art/jobs/paladin_2.webp",
  "./art/jobs/paladin_3.webp",
  "./art/jobs/paladin_4.webp",
  "./art/jobs/paladin_5.webp",
  "./art/jobs/brigand_1.webp",
  "./art/jobs/brigand_2.webp",
  "./art/jobs/brigand_3.webp",
  "./art/jobs/brigand_4.webp",
  "./art/jobs/brigand_5.webp",
  "./art/jobs/necromancer_1.webp",
  "./art/jobs/necromancer_2.webp",
  "./art/jobs/necromancer_3.webp",
  "./art/jobs/necromancer_4.webp",
  "./art/jobs/necromancer_5.webp",
  // 護法師: 承認済みR1を基にしたR1〜R5の透過原画。
  "./art/jobs/warden_1.webp",
  "./art/jobs/warden_2.webp",
  "./art/jobs/warden_3.webp",
  "./art/jobs/warden_4.webp",
  "./art/jobs/warden_5.webp",
  "./art/jobs/arcanist_1.webp",
  "./art/jobs/arcanist_2.webp",
  "./art/jobs/arcanist_3.webp",
  "./art/jobs/arcanist_4.webp",
  "./art/jobs/arcanist_5.webp",
  "./art/jobs/inquisitor_1.webp",
  "./art/jobs/inquisitor_2.webp",
  "./art/jobs/inquisitor_3.webp",
  "./art/jobs/inquisitor_4.webp",
  "./art/jobs/inquisitor_5.webp",
  "./src/townart.js",
  "./src/walkerart.js",
  "./src/jobart.js",
  "./src/jobphotos.js",
  "./art/jobs/hunter_1.webp",
  "./art/jobs/hunter_2.webp",
  "./art/jobs/hunter_3.webp",
  "./art/jobs/hunter_4.webp",
  "./art/jobs/hunter_5.webp",
  "./src/backdrops.js",
  "./src/battlefx.js",
  "./src/battlefx-sig.js",
  "./src/crypt.js",
  "./src/rarity.js",
  "./src/autoequip.js",
  "./src/ui/ctx.js",
  "./src/ui/prefs.js",
  "./src/ui/motion.js",
  "./src/ui/nav.js",
  "./src/ui/kit.js",
  "./src/ui/phrase.js",
  "./src/ui/itemview.js",
  "./src/ui/townshell.js",
  "./src/ui/hub.js",
  "./src/ui/palace.js",
  "./src/ui/facilities.js",
  "./src/ui/questboard.js",
  "./src/ui/settings.js",
  "./src/ui/story.js",
  "./src/ui/party.js",
  "./src/ui/irene.js",
  "./src/ui/soulpanel.js",
  "./src/ui/shop.js",
  "./src/ui/loot.js",
  "./src/ui/appraise.js",
  "./src/ui/departure.js",
  "./src/ui/dungeonhud.js",
  "./src/ui/results.js",
  "./src/ui/tutorial.js",
  "./src/ui/expedition.js",
  "./src/ui/jobgallery.js",
  "./src/dungeons/schema.js",
  "./src/dungeons/common.js",
  "./src/dungeons/index.js",
  "./src/dungeons/d01.js",
  "./src/dungeons/d02.js",
  "./src/dungeons/d03.js",
  "./src/dungeons/d04.js",
  "./src/dungeons/bestiary.js",
  "./src/dungeons/monart.js",
  "./src/dungeons/generator.js",
  "./src/dungeons/world.js",
  "./src/dungeons/monlore.js",
  "./src/dungeons/named.js",
  "./src/dungeons/unknown.js",
  "./src/catalog/defs.js",
  "./src/catalog/index.js",
  "./src/catalog/weapons.js",
  "./src/catalog/armor.js",
  "./src/catalog/gear.js",
  "./src/catalog/misc.js",
  "./src/catalog/miscart.js",
  "./src/catalog/legends.js",
  "./src/catalog/exclusives.js",
  "./src/catalog/lr.js",
  "./src/catalog/layer1.js",
  "./src/catalog/layer2.js",
  "./src/catalog/layer3.js",
  "./src/catalog/layer4.js",
  "./src/catalog/layer5.js",
  "./src/catalog/layer6.js",
  "./src/catalog/layer7.js",
  "./src/catalog/layer8.js",
  "./src/catalog/layer9.js",
  "./src/catalog/layer10.js",
  "./src/catalog/named.js",
  "./src/catalog/lockpick.js",
  "./src/catalog/ranks/r01.js",
  "./src/catalog/ranks/r02.js",
  "./src/catalog/ranks/r03.js",
  "./src/catalog/ranks/r04.js",
  "./src/catalog/ranks/r05.js",
  "./src/catalog/ranks/r06.js",
  "./src/catalog/ranks/r07.js",
  "./src/catalog/ranks/r08.js",
  "./src/catalog/ranks/r09.js",
  "./src/catalog/ranks/r10.js",
  "./src/catalog/ranks/r11.js",
  "./src/catalog/ranks/r12.js",
  "./src/catalog/ranks/r13.js",
  "./src/catalog/ranks/r14.js",
  "./src/catalog/ranks/r15.js",
  "./src/catalog/ranks/r16.js",
  "./src/catalog/ranks/r17.js",
  "./src/catalog/ranks/r18.js",
  "./src/catalog/ranks/r19.js",
  "./src/catalog/ranks/r20.js",
  "./art/jobs/thief_1.webp",
  "./art/jobs/thief_2.webp",
  "./art/jobs/thief_3.webp",
  "./art/jobs/thief_4.webp",
  "./art/jobs/thief_5.webp",
  "./art/jobs/chaplain_1.webp",
  "./art/jobs/chaplain_2.webp",
  "./art/jobs/chaplain_3.webp",
  "./art/jobs/chaplain_4.webp",
  "./art/jobs/chaplain_5.webp",
];

// 絵 (png/webp/jpg) は版ごとに取り直さない。ASSETS の大半 (約50MB。2026-10 に物語の絵を WebP にするまでは約250MB) は絵で、
// 版のたびに全部を先読みしていた頃は、1つでも取りこぼすと新しい版へ切り替わらず、
// 端末に古い版が残り続けた。絵は版をまたいで残す MEDIA に置き、
//   - install では JS/CSS/HTML (約10MB) だけを先読みして版を切り替える
//   - 絵は使う時にキャッシュから返し、裏で取り直して差し替わりに追いつく
//   - 切り替えの後、まだ持っていない絵だけを裏でゆっくり集める (オフライン用)
const MEDIA = "dos-media";
const isMedia = (u) => /\.(png|webp|jpe?g|gif)$/i.test(new URL(u, self.location.href).pathname);
const CORE = ASSETS.filter((u) => !isMedia(u));
const MEDIA_ASSETS = ASSETS.filter(isMedia);
const abs = (u) => new URL(u, self.location.href).href;

// 前の版のキャッシュにある絵を MEDIA へ移す (ネットワークを使わない・失敗しても止めない)
async function carryMedia() {
  const media = await caches.open(MEDIA);
  const old = (await caches.keys()).filter((k) => k !== CACHE && k !== MEDIA);
  for (const k of old) {
    const c = await caches.open(k);
    for (const u of MEDIA_ASSETS) {
      try {
        if (await media.match(u)) continue;
        const hit = await c.match(u);
        if (hit) await media.put(u, hit);
      } catch (err) { /* 容量不足などは裏の取得に任せる */ }
    }
  }
}

// まだ持っていない絵を少しずつ取りに行く (版の切り替えとは無関係・失敗は次の機会に)
let warming = null;
function warmMedia() {
  if (DEV || warming) return warming;
  warming = (async () => {
    const media = await caches.open(MEDIA);
    const keep = new Set(MEDIA_ASSETS.map(abs));
    // ASSETS から消えた絵は捨てる (迷宮の由来の絵など名前を組み立てる絵は残す)
    for (const req of await media.keys()) {
      if (!keep.has(req.url) && !/\/art\/story\/dungeons\//.test(req.url)) await media.delete(req);
    }
    const todo = [];
    for (const u of MEDIA_ASSETS) if (!(await media.match(u))) todo.push(u);
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const u = todo[i++];
        try { const res = await fetch(u, { cache: "no-cache" }); if (res.ok) await media.put(u, res); }
        catch (err) { /* 通信が切れても次の機会に取り直す */ }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  })().finally(() => { warming = null; });
  return warming;
}

self.addEventListener("install", (e) => {
  if (DEV) { self.skipWaiting(); return; }
  e.waitUntil(
    caches.open(CACHE)
      // 先読みは必ずネットワークから取得し、HTTPキャッシュの古いファイル混入を防ぐ。
      // コードはどれか1つでも欠けると白画面になるので、全部そろった時だけ版を切り替える
      .then((c) => Promise.all(CORE.map((u) => fetch(u, { cache: "no-cache" }).then((res) => {
        if (!res.ok) throw new Error("precache failed: " + u);
        return c.put(u, res);
      }))))
      .then(() => carryMedia().catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => { warmMedia(); })
  );
});

self.addEventListener("fetch", (e) => {
  if (DEV) return; // 手元の開発ではキャッシュに介入しない
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // 他オリジンは介入しない

  // 絵: 持っていればすぐ返し、裏で取り直して差し替わった絵に追いつく
  if (isMedia(url.href)) {
    const media = caches.open(MEDIA);
    const hit = media.then((m) => m.match(e.request, { ignoreSearch: true }));
    const net = media.then((m) => fetch(e.request).then((res) => {
      if (res.ok) m.put(e.request, res.clone()).catch(() => {});
      return res;
    }));
    e.respondWith(hit.then((h) => h || net));
    // 裏の取り直しと、止まっていた残りの絵の取り寄せの再開
    e.waitUntil(net.catch(() => {}).then(() => warmMedia()).catch(() => {}));
    return;
  }

  // コード: 同一バージョンのキャッシュを最優先 (整合性保証)。
  // キャッシュ外のリクエストのみネットワークへ。オフライン時は index にフォールバック
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(e.request, { ignoreSearch: true }).then((hit) =>
        hit ||
        fetch(e.request)
          .then((res) => { c.put(e.request, res.clone()).catch(() => {}); return res; })
          .catch(() => c.match("./index.html"))
      )
    )
  );
});

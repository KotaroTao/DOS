import { SOUL_CLASSES } from "./souls.js";

// 章の未実装分はfeatureUnlockedが閉じる。深部の終端は画面・案内に出さない。
export function depthLimit(unlocked) {
  if (unlocked("infiniteDeep")) return 99999;
  for (const n of [300, 250, 200, 150, 100]) if (unlocked(`infinite${n}`)) return n;
  return 50;
}
export function mutatorEligible(cfg, unlocked) {
  return !!(unlocked && cfg && !cfg.noSpecial && cfg.layer >= 9);
}
export function challengeEntryBlock(cfg, party, souls) {
  if (!cfg?.trait?.commonOnly) return "";
  const wrong = party.filter(d => {
    const soul = souls.find(s => s.uid === d.primary);
    return !soul || SOUL_CLASSES[soul.clsKey]?.rarity !== "common";
  });
  return wrong.length ? `メイン魂を戦士・騎士・僧侶・魔導士・盗賊・司教のいずれかにしてください：${wrong.map(d => d.name).join("・")}` : "";
}
export function applyChallengeEnemies(enemies, trait) {
  for (const e of enemies) {
    if (trait?.challengeRule === "magic") { e.physResist = 100; e.magResist = 0; e.resists = { ...e.resists, physResist: 100, magResist: 0 }; }
    if (trait?.challengeRule === "physical") { e.magResist = 100; e.physResist = 0; e.resists = { ...e.resists, magResist: 100, physResist: 0 }; }
  }
  if (!trait?.giant) return enemies;
  const e = enemies[0];
  if (!e) return enemies;
  if (!e._challengeGiant) {
    for (const k of ["maxhp", "hp", "maxmp", "mp", "atk", "vit", "agi", "int", "pie", "luk"]) if (typeof e[k] === "number") e[k] *= 5;
    e._challengeGiant = true;
    e.name = e.mon?.name || e.name;
    // 一戦分の見返り。死亡・蘇生での二重加算は行わない。
    e.soul *= 5; e.gold *= 5;
  }
  return [e];
}

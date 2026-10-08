// 武器種の基本参照と、用途を明示した特殊武器。属性・持ち主で参照先は変えない。
export const WEAPON_PROFILES = {
  strength: { label: "筋力型", weights: { atk: 1 }, rate: 1 },
  dagger: { label: "短剣型", weights: { atk: 0.3, agi: 0.7 }, rate: 0.95 },
  katana: { label: "刀型", weights: { atk: 0.7, agi: 0.3 }, rate: 1 },
  bow: { label: "弓型", weights: { agi: 1 }, rate: 0.85 },
  arcane: { label: "魔杖型", weights: { int: 1 }, rate: 0.65 },
  faith: { label: "信仰型", weights: { pie: 1 }, rate: 0.65 },
  spellblade: { label: "魔法武器型", weights: { atk: 0.5, int: 0.5 }, rate: 1 },
  spellknife: { label: "魔法短剣型", weights: { agi: 0.5, int: 0.5 }, rate: 0.95 },
  sacred: { label: "聖武器型", weights: { atk: 0.6, pie: 0.4 }, rate: 1 },
  dualstaff: { label: "複合杖型", weights: { int: 0.5, pie: 0.5 }, rate: 0.65 },
};
const DEFAULT_PROFILE = { ls: "strength", ax: "strength", mc: "strength", sp: "strength", dg: "dagger", kt: "katana", bw: "bow", st: "arcane" };
// 名前の推測ではなくIDで決める。後から名前や属性が変わっても参照は一定。
const OVERRIDES = {
  w_flamesword: "spellblade", w_tidemurmur_blade: "spellblade", w_eclipse_blade: "spellblade",
  w_starmetal_hammer: "spellblade", w_firebreather_staff: "spellblade",
  w_sr2_sluiceblade: "spellblade", w_sr3_draftblade: "spellblade",
  w_netherroot_staff: "strength",
  w_shepherd_staff: "faith", w_apothecary_staff: "faith", w_pilgrim_khakkhara: "faith", w_caduceus_staff: "faith",
  w_sr4_chaplainstaff: "dualstaff", w_sr5_sapstaff: "dualstaff", w_sr7_springstaff: "dualstaff", lr_l7_sapseal: "dualstaff",
  w_sr6_lampstaff: "faith", lr_l6_crosier: "faith", w_nm_heresiarch: "sacred",
  w_oath_blade: "sacred", w_condemner_sword: "sacred", w_martyr_lance: "sacred", lr_l1_saintmace: "sacred",
  x_priest_staff: "faith", x_bishop_staff: "dualstaff", x_spellblade_sword: "spellblade",
  x_arcthief_dagger: "spellknife", x_battlemage_sword: "spellblade", x_darkknight_sword: "spellblade",
  x_paladin_sword: "sacred", x_crusader_sword: "sacred", x_templar_spear: "sacred", x_inquisitor_hammer: "sacred",
};
for (const tier of [5, 10, 15, 20]) {
  OVERRIDES[`lr_arcthief${tier}`] = "spellknife";
  for (const job of ["spellblade", "battlemage", "darkknight"]) OVERRIDES[`lr_${job}${tier}`] = "spellblade";
  for (const job of ["priest", "hermit", "warden", "archbishop", "cardinal"]) OVERRIDES[`lr_${job}${tier}`] = "faith";
  for (const job of ["bishop", "sage"]) OVERRIDES[`lr_${job}${tier}`] = "dualstaff";
  for (const job of ["paladin", "templar", "inquisitor", "chaplain"]) OVERRIDES[`lr_${job}${tier}`] = "sacred";
}
// 標準杖は各帯に魔力用と複合用を用意し、回復職にも選択肢を残す。
for (const id of ["w_r1_oldstaff", "w_r2_hollystaff", "w_r3_orbstaff", "w_r4_sagestaff", "w_r5_grandsagestaff", "w_r6_grandtomestaff", "w_r7_astralstaff", "w_r8_godsagestaff", "w_r9_divinemindstaff", "w_r10_divinetruthstaff", "w_r11_heaventruthstaff", "w_r12_godbloodstaff", "w_r13_salvationstaff", "w_r14_dragongodstaff", "w_r15_legendstaff", "w_r16_genesisstaff", "w_r17_artifactstaff", "w_r18_cosmosstaff", "w_r19_heavengracestaff", "w_r20_omnistaff"]) OVERRIDES[id] = "dualstaff";
for (const id of ["w_r12_stigmastaff", "w_r13_relicstaff", "w_r19_gracestaff"]) OVERRIDES[id] = "faith";

export function weaponProfile(it) {
  return OVERRIDES[it.id] || DEFAULT_PROFILE[it.cat];
}

// 旧カタログの威力値は品質の材料としてのみ使用。レア度・両手・個別の強さを保ち、
// 係数は単調に伸びるが最大3倍未満に抑え、能力と武器の成長の掛け算が暴走しないようにする。
export function prepareWeapon(it) {
  if (!it || it.slot !== "weapon" || it.weaponProfile) return it;
  const key = weaponProfile(it), profile = WEAPON_PROFILES[key];
  if (!profile) throw new Error("武器の参照タイプが不明: " + it.id);
  it.weaponProfile = key;
  it.weaponRating = Math.max(1, it.atk || 1);
  const total = (1 + it.weaponRating / (40 + it.weaponRating * 0.5)) * profile.rate;
  it.scale = Object.fromEntries(Object.entries(profile.weights).map(([k, weight]) => [k, Math.round(total * weight * 1000) / 1000]));
  // 武器の旧威力を筋力として加算しない。他の能力補正・属性・追加効果は維持。
  delete it.atk;
  if (it.cat === "st" && (key === "faith" || key === "dualstaff")) {
    const totalStat = (it.int || 0) + (it.pie || 0);
    if (key === "faith") { it.pie = totalStat; delete it.int; }
    else { it.int = Math.ceil(totalStat / 2); it.pie = Math.floor(totalStat / 2); }
  }
  return it;
}

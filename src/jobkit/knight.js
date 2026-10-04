// 騎士 (knight) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 規律と槍突きの忠義 — 隊列を守る前衛の鉄則、強化を剥ぎ力を削ぐ槍、倒れた仲間に報いる誓い
export default {
  // 覚醒のパッシブ: 魂がランク2に上がると目覚める (以前の Lv15 のパッシブ)
  awaken: "cover/1",
  table: `
    1 SHIELDBASH 2 NERAIUCHI 3 taunt/1 5 CHOUHATSU 7 PROTECT 10 KOTE
    12 IWAKUDAKI 15 KNIGHT_JINTOTSU 15 nightWatch/1 20 NIOUDACHI 22 KOUJIN 25 knightTessoku/1 30 RYUURINJIN
    35 cover/2 40 JOUMON 45 bastion/1 50 SHINGANGEKI 50 nightWatch/2 55 IRONWALL 57 GANOTOSHI
    60 knightTessoku/2 65 SHIELDCHARGE 70 parry/1 75 knightFutai/1 80 BOUJIN 82 KNIGHT_HAJINSOU
    85 KNIGHT_YARIBUSUMA 90 resistAilment/1 95 SHUGOHOUKOU 100 JOUSAITSUKI 100 nightWatch/3 105 knightTessoku/3 107 KNIGHT_JINARI
    110 TEPPEKIJIN 115 cover/3 120 KNIGHT_ITTETSU 125 bastion/2 130 FURAKUNOTATE 135 parry/2
    140 BANRAI 145 knightHoujin/1 150 SHUGOKEKKAI 155 knightFutai/2 160 JOUSAIKUZUSHI 162 DAICHIMEIDOU
    165 resistAilment/2 170 TESSAINAGI 175 knightHoujin/2 180 KISHIOU 185 knightOath/1 190 FUDOUJIN
    195 DAIGOUREI 200 FURAKUJOU`,
  skills: {
    // Lv15 (覚醒のパッシブが抜けた段): 隊列を崩さず槍を突き入れ、強化を剥いで力を削ぐ
    KNIGHT_JINTOTSU: { name: "陣突き", mp: 5, kind: "phys", power: 1.2, acc: 0.6, strip: true, debuff: { atk: 0.85 }, target: "enemy", desc: "隊列を崩さず槍を突き入れ、敵の強化を剥いで力を削ぐ" },
    KNIGHT_HAJINSOU: { name: "破陣の聖槍", mp: 12, kind: "phys", power: 2.0, pieScale: 0.3, element: "light", acc: 0.7, strip: true, target: "enemy", desc: "光の槍で突き、敵の強化を剥ぐ" },
    KNIGHT_YARIBUSUMA: { name: "槍衾", mp: 6, kind: "buff", stance: "counter", buff: { vit: 1.15 }, dur: 2, tech: true, target: "self", desc: "穂先を揃えて待ち、物理に必ず突き返す" },
    KNIGHT_JINARI: { name: "地鳴りの槍", mp: 20, kind: "phys", power: 4.6, element: "earth", acc: 0.8, pierce: 0.3, debuff: { atk: 0.8 }, target: "enemy", desc: "踏み込みの突きで鎧を穿ち、力を削ぐ" },
    KNIGHT_ITTETSU: { name: "一徹突き", mp: 16, kind: "phys", power: 2.6, vitScale: 0.5, acc: 1, pierce: 0.4, target: "enemy", desc: "鍛えた身ごと貫く必中の突き（VITで伸びる）" },
  },
  perks: {
    knightTessoku: {
      label: "騎士の鉄則",
      lv: ["物理が当たると10%で敵のATK×0.85 (3ターン)", "物理が当たると14%で敵のATK×0.85 (3ターン)", "物理が当たると18%で敵のATK×0.85 (3ターン)"],
      fx: [{ t: "hit", chance: [0.10, 0.14, 0.18], ail: "atk", mul: 0.85 }],
    },
    knightFutai: {
      label: "不退の誓い",
      lv: ["戦闘ごとに一度、致死をHP1で耐える。味方が倒れるとATK×1.15 (3ターン)", "戦闘ごとに一度、致死をHP1で耐える。味方が倒れるとATK×1.25・VIT×1.2 (3ターン)"],
      fx: [{ t: "start", endure: true }, { t: "fall", buff: { atk: [1.15, 1.25], vit: [1, 1.2] }, dur: 3 }],
    },
    knightHoujin: {
      label: "方陣の規律",
      lv: ["前衛の味方全員の物理の被ダメージ-6%", "前衛の味方全員の物理の被ダメージ-10%"],
      fx: [{ t: "take", aura: true, on: "phys", when: { front: true }, v: [0.06, 0.10] }],
    },
    knightOath: {
      label: "騎士王の誓約",
      lv: ["戦闘開始時、味方全体のVIT×1.15 (3ターン)・敵を自分に引き付ける"],
      fx: [{ t: "start", party: true, taunt: true, buff: { vit: [1.15] }, dur: 3 }],
    },
  },
};

// 罠外しの装飾 — 着けた者が宝箱・床の罠を外す時の解除率を上げる (eff.disarmUp、2026-10 ユーザーの指示)
//
// 解除率 +5% / +10% / +15% / +20% / +30%。20% はスーパーレア、30% はレジェンドレアで、どちらも第10層から出る (layer: 10)。
// 5〜15% は隠しLv で出る深さが決まる (+5% = 第1層の終わり R2 / +10% = 第3〜4層 R4 / +15% = 第5〜6層 R8)。
// 解除率の足し方は game.js disarmChance: 盗賊の眼と同じく、得意職でない者の頭打ち (55%) を越えて足せる (合わせて最大95%)。
// 罠を外そうとする本人の装備だけが効き、装飾どうしでは強い方だけ (items.js recalc)。
// このファイルの品はコモン〜レアの厳選 (catalog/index.js の RARE_PER_BAND) に入れない — いつでも落ちる。
// id は append-only (セーブ/図鑑が参照する)。
import { R } from "./defs.js";

const rar = (r) => (it) => { it.rar = r; return it; };
const sr = (it) => { it.rar = "sr"; it.layer = 10; return it; };
// LR: 層の印 lr:10 (第10層から・出現上限の内側で lrPool に入る)
const lr = (it) => { it.rar = "lr"; it.lr = 10; it.layer = 10; it.exclusive = true; return it; };

export const LOCKPICK_ITEMS = [
  rar("uc")(R("r_lp_thimble", "錠前師の指ぬき", "ring", 14, { agi: 2, luk: 2, eff: { disarmUp: 0.05 }, tint: "#b0a080",
    desc: "街の錠前師が、細い針を押しこむ時に指先へはめていた真ちゅうの指ぬき。指先がぶれず、錠の奥の小さな手ごたえまで伝わってくる。" })),
  rar("r")(R("r_lp_loupe", "細工師の片眼鏡", "amulet", 38, { agi: 3, luk: 4, eff: { disarmUp: 0.10 }, tint: "#c8b878",
    desc: "からくり細工の職人が、首から下げていた片眼鏡。のぞけば錠の中の針やばねが大きく見え、仕掛けの順番が読める。" })),
  rar("r")(R("r_lp_keyring", "盗賊組合の鍵束", "amulet", 72, { agi: 5, luk: 6, eff: { disarmUp: 0.15 }, tint: "#9a8a68",
    desc: "王都の盗賊組合が、腕の立つ者にだけ預けた鍵の束。どの鍵も形がわずかに違い、合う鍵がなくても、近い鍵で錠をだましてしまう。" })),
  sr(R("r_sr10_thousandlocks", "千錠の指輪", "ring", 110, { agi: 8, luk: 10, hp: 20, eff: { disarmUp: 0.20 }, tint: "#d8c070",
    desc: "千の錠を開けたという錠前師が、最後に自分のために打った指輪。指輪の内側に細い針が仕込んであり、錠に触れれば仕掛けの形が指に伝わる。" })),
  lr(R("lr_l10_masterkey", "開かずの扉の鍵", "amulet", 120, { pow: 1.6, agi: 10, luk: 12, eff: { disarmUp: 0.30 }, tint: "#e8d080",
    desc: "嵐の尖塔の頂、だれも開けられなかった扉の鍵穴に、錆びずに残っていた金の鍵。からくりの方から道をあけるように、どんな罠も手の中でほどけていく。" })),
];

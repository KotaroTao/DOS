// モンスター共通スキーマ + 種族定義 + 共有ドット絵ライブラリ
//
// ===== 設計ルール (ダンジョン単位コンテンツの生命線) =====
// 1. ID は「d<番号>_名前」(固有種) / 「cm_名前」(共通種) で名前空間化する。
//    既存IDの変更・並べ替えは禁止 (セーブ/図鑑の参照が壊れる)。追記のみ。
// 2. すべてのモンスターは defMonster() を通して定義する。
//    将来フィールドを足す時はここのデフォルトに足せば全体に行き渡る。
// 3. 1ダンlike1モジュール (d01.js, d02.js, ...)。盤面設定と出現モンスターを同居させ、
//    index.js のレジストリに登録する。

// ===== 種族分類 (16タイプ) — 図鑑のタブ =====
export const MON_RACES = [
  { key: "amorph", label: "不定形" },
  { key: "beast", label: "獣" },
  { key: "wing", label: "飛獣" },
  { key: "avian", label: "鳥人" },
  { key: "insect", label: "虫" },
  { key: "plant", label: "植物" },
  { key: "aquatic", label: "水棲" },
  { key: "reptile", label: "爬虫" },
  { key: "dragon", label: "竜" },
  { key: "humanoid", label: "亜人" },
  { key: "giant", label: "巨人" },
  { key: "undead", label: "不死" },
  { key: "specter", label: "幽鬼" },
  { key: "demon", label: "悪魔" },
  { key: "construct", label: "構造体" },
  { key: "armored", label: "機鎧" },
  { key: "elemental", label: "精霊" },
];
export const RACE_LABEL = (() => {
  const m = {};
  for (const r of MON_RACES) m[r.key] = r.label;
  return m;
})();

// ===== 属性 (エレメント) =====
// 6属性 + 無属性。循環: 火→風→土→水→火。光↔闇は相互に有利。
export const ELEMENTS = {
  none:  { label: "無", color: "#9aa0ac" },
  fire:  { label: "火", color: "#ff6b3a" },
  water: { label: "水", color: "#4aa3ff" },
  wind:  { label: "風", color: "#5fd08a" },
  earth: { label: "土", color: "#c89a4a" },
  light: { label: "光", color: "#ffe27a" },
  dark:  { label: "闇", color: "#9b6bd0" },
};
// A が有利を取る相手 B のリスト
const ELEM_BEATS = {
  fire: ["wind"], wind: ["earth"], earth: ["water"], water: ["fire"],
  light: ["dark"], dark: ["light"],
};
export function elemBeats(a, b) { return !!(ELEM_BEATS[a] && ELEM_BEATS[a].includes(b)); }
// 攻撃属性 atk が 防御属性 def に与えるダメージ倍率
// 有利: 1.5倍 / 不利(相手が有利): 0.5倍 / それ以外: 1.0倍。無属性が絡めば常に1.0
export function elemMult(atk, def) {
  if (!atk || atk === "none" || !def || def === "none") return 1;
  if (elemBeats(atk, def)) return 1.5;   // 光↔闇は双方ここで 1.5 になる
  if (elemBeats(def, atk)) return 0.5;
  return 1;
}

// ===== 属性攻撃 / 属性防御 (装備で得るレベル付きステータス) =====
// 属性攻撃 Lv1=◯: 有利属性へのダメージ+50% / 不利属性へ-50%。Lv2=◎: ±100%。
//   aE/aLv  : 攻撃側の属性と属性攻撃レベル (呪文・モンスター固有属性は Lv1 扱い)
//   tgtElem : 対象の固有属性 (モンスター)。攻撃側の有利不利はこれと比較する
//   tgtDef  : 対象の属性防御 {el, lv} (装備由来)。攻撃属性に有利な時のみ被ダメージを軽減
// 属性防御は「軽減のみ」: 有利属性で受けると減るが、不利属性で受けても増えない
//   (装備した属性防具が裏目に出てダメージが増えることはない)。
//   軽減量は Lv1=◯ 25% / Lv2=◎ 50% (Lv2 が上限)。
// 光↔闇は相互有利の例外: 攻撃側は常に「有利」、防御側は常に「軽減」扱いになる。
export function elemDmgMult(aE, aLv, tgtElem, tgtDef) {
  if (!aE || aE === "none") return 1;
  let m = 1;
  if (aLv > 0 && tgtElem && tgtElem !== "none") {
    const k = 0.5 * Math.min(2, aLv);
    if (elemBeats(aE, tgtElem)) m *= 1 + k;
    else if (elemBeats(tgtElem, aE)) m *= Math.max(0, 1 - k);
  }
  if (tgtDef && tgtDef.lv > 0 && tgtDef.el && tgtDef.el !== "none") {
    const k = 0.25 * Math.min(2, tgtDef.lv); // Lv1→25% / Lv2→50% 軽減
    if (elemBeats(tgtDef.el, aE)) m *= Math.max(0, 1 - k); // 防御側が有利 → 軽減 (不利でも増加はしない)
  }
  return m;
}

// ===== 色ユーティリティ (パレットの部分差し替え用) =====
function hex(n) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"); }
function parseHex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function blend(a, b, t) {
  if (!a) return a; const A = parseHex(a), B = parseHex(b);
  return "#" + hex(A[0] + (B[0] - A[0]) * t) + hex(A[1] + (B[1] - A[1]) * t) + hex(A[2] + (B[2] - A[2]) * t);
}
// ベースパレットを tint 方向へ amount 混ぜる (新種の固有色を作る時に使う)
export function tint(pal, tintColor, amount) {
  const out = {};
  for (const k in pal) out[k] = pal[k] ? blend(pal[k], tintColor, amount) : pal[k];
  return out;
}

// ===== 共有ドット絵ライブラリ =====
// 形ごとの原型。各モンスターは artKey で形を選び、palette で固有の色を持つ。
// 解像度は混在可 (旧 12x12 / 新 32px 級)。drawSpriteFit (sprites.js) が
// 見かけサイズを 12 グリッド換算へ正規化するので、大きいアートほどドットが細かくなる。
// 高解像度アートの規約: 'o'=輪郭 / 光源は左上 / 各素材 3トーン (本体・影・ハイライト)。
export const ARTS = {
  slime: {
    palette: { o: "#102c16", D: "#185424", G: "#389a42", L: "#6ecc64", B: "#aaeb91", W: "#ebffdc", E: "#081408" },
    art: [
      ".............................o..",
      "............................oLo.",
      "..........oooooooooooo.......o..",
      "........ooBBBBBLLLLLLGoo........",
      ".......oBBBBBWBLLLLLLGGGo.......",
      "......oBBBBBBBBLLLLLLGGGGo......",
      ".....oBBWWWWBBBLLLLLLGGGGGo.....",
      "....oBBWWWWWBBBLLLLLLGGGGGGo....",
      "....oBBBWWWBBBBLLLLLLGGGGGGo....",
      "...oBBBBBBBBBBLLLLLLLLBGGGGGo...",
      "...oBBBBBBBBBBLLLLLLGGLGGGGGo...",
      "...oBBBBBBBBBLLLLLLLGGGGGGGGo...",
      "..oLLBBBBBBELLLLLLLEGGGGGGDGGo..",
      "..oLLLLLLLLEELLLLLLEEGGGGGDGGo..",
      "..oLLLLLLLLLELLLLLGGEGGGGDDGGo..",
      "..oLLLLLLBLLLLLLLGGGGGGGGDDGGo..",
      "..oLLLLLLLLLLLLEEGGGGGGGDDDGGo..",
      "..oLLLLLLLLLLLLGGGGGGGGGDDDGGo..",
      "..oLLLLLLLLLLLGGGGGGGGGDDDDGGo..",
      "..oGGGLLLLLGGGGGGGGGGGGDDDDGGo..",
      ".oGGGGGGGGGGGGGGGGGGGGDDDDDDGGo.",
      "oGGGGGGGGGGGGGGGGGGGGGGGDDDDDGGo",
      "oGGGGGGGGGGGGGGGGGGGDDDDDDDDDGGo",
      ".oooooooooooooooooooooooooooooo.",
    ],
  },
  bat: {
    palette: { o: "#180e24", d: "#2a1a40", D: "#3a2458", P: "#6b3fa0", L: "#9a6fd0", H: "#ceb2eb", F: "#7a6096", f: "#56406e", E: "#781018", R: "#ff4040", W: "#ece6f4" },
    art: [
      ".oo.........oo....oo.........oo.",
      "oLLoo.......oFo..ofo.......ooPPo",
      ".oPLLo......oFFooffo......oPPDo.",
      ".oPPPLoo...oHHFFFfffo...ooPDDDo.",
      ".oDPPPLLoo.oHHFFFfffo.ooPPDDDdo.",
      ".oDPPPPPLLoHHRFFFWfffoPPDDDDDdo.",
      "..oPPPPPPPLFFERFFREffPDDDDDDDo..",
      "..oPPPPPPPPFFFFFFffffDDDDDDDDo..",
      "..oPPPPPPPPFFFFooffffDDDDDDDDo..",
      "..oDPPPPPPLLffWffWffPPDDDDDDdo..",
      "..oDPPPDPLLLffWffWffPPPDdDDDdo..",
      "...oPPDDPLPLFFFFFfffPDPDddDDo...",
      "...oDPDoLPLoFFFFFfffoPDPodDdo...",
      "...oDPooDPLoFFFFFfffoPDdooDdo...",
      "....oDooDPooFFFFFfffooDdoodo....",
      "....oLo.oLo.offffffo.oPo.oPo....",
      ".....o..oLo.offffffo.oPo..o.....",
      ".........o...ofoofo...o.........",
      ".............ofoofo.............",
      "............ofo..ofo............",
      ".............o....o.............",
    ],
  },
  beast: {
    palette: { o: "#1e140c", B: "#7a5230", b: "#52361e", H: "#ba8a58", d: "#3a2616", R: "#ff463c", W: "#f0ece2", k: "#140a06" },
    art: [
      "..........o...................",
      ".........obo.o................",
      "........oooHobo.o............o",
      ".......obbHbHHHoboooooo.....ob",
      "...ooooHHHHHHHHBBHBbBBbo...oBo",
      "..oHHHoHHHHHHHHBBBBBHBbbo.oBbo",
      ".ooBRRBBBBBBBBBBBBBBBBbbboBbo.",
      "okBBBBBBBBBBBBBBBBBBBBbbbBbo..",
      "oBBBBBBBBBBBBBBBBBBBBBbbbbo...",
      "okWkWkWkBBBBBBBBBBBBBBbbbbbo..",
      "oddddddBBBBBBBBBBBBBBBbbbbo...",
      ".oooooBBBBBBBBBBBBBBBBdddbo...",
      ".....oBBBdddddddddBBBddddo....",
      ".....oBBBdddddddddBBBddddo....",
      ".....oBBBoddddddddBBBddddo....",
      ".....oBBBoodddoodoBBBodddo....",
      ".....oBBBoodddo.ooBBBoooo.....",
      "....oWbbbWoooo..oWbbbWo.......",
      ".....ooooo.......ooooo........",
    ],
  },
  kobold: {
    palette: { o: "#28180c", B: "#8a5a2b", b: "#5e3a18", H: "#c98c4a", S: "#d9b07a", s: "#ac8254", P: "#d88282", E: "#ffd84a", M: "#b8b8c8", m: "#7e7e8e", W: "#f0f0ea", G: "#a87820", R: "#a03028", r: "#6e1e1a" },
    art: [
      "....o............o....",
      "...obo..........obo...",
      "...obBo........oBbo...",
      "...obPBooooooooBPbo...",
      "..o.oPHoHBBBBBbbPo....",
      ".oMo.oHoHBBBBBbbo.....",
      ".oWmooHHHBBBBBbbbo....",
      ".oMo.oHoHBBBBBbobo....",
      ".oMmooBoEoBBBoEobo....",
      ".oMmooBBBBBBBBbbbo....",
      "oGGGooBBSSoosssbbo....",
      ".oSSooBSSSoossssbo....",
      ".oSBHooBoWoooWobo.....",
      "..ooBHoBBBBBBBbbo.....",
      "....oBBoBBBBBbboo.....",
      ".....oooBBBBBbbobo..o.",
      ".......oBSSSSbboobooHo",
      "......oBBSSSsbbbobooBo",
      "......oBBSSSsbbbossBo.",
      "......oBBSSSsbbboWBo..",
      "......oBBSSSSbbbobo...",
      "......oBRRRRrrrbbo....",
      "......oBRRRRrrrbo.....",
      ".......oRRRRrrro......",
      ".......oBBroobbo......",
      ".......oBBo.obbo......",
      ".......oBBo.obbo......",
      "......oBBo...obbo.....",
      ".....ooBBo...obboo....",
      "....oWBBBBo.obbbbWo...",
      ".....ooooo...ooooo....",
    ],
  },
  skeleton: {
    palette: { o: "#28281e", B: "#d9d4bf", s: "#969078", W: "#fffffa", k: "#10100c", R: "#ff4040", M: "#aaaab8", m: "#6e6e7e", G: "#786032" },
    art: [
      "........oooooo.......",
      ".......oWWBssso......",
      "..oo..oWWWBsssso.....",
      ".oMmooWWWWBssssso....",
      ".oWmooBBBBBssssso....",
      ".oMmooBkRkBskRkso....",
      ".oMoooBkkkBskkkso....",
      ".oMmo.oBBBkkssso.....",
      ".oMmo..oBBBssso......",
      ".oMmo..oWsWssso......",
      ".oMmo..osssssso......",
      "oGGGGo..oossoo.......",
      ".oBBo.oooBBssooo.....",
      ".oBo.oBBBoBsossso....",
      ".oBooBoooBBssoooso...",
      "..oBBoBBBoBsosssoso..",
      "..oBosoooBBssooosso..",
      "...o.oBBBoBsosssooso.",
      "....osoooBBssooososo.",
      ".....oBBBoBsosssooso.",
      "....osooooBsoooososo.",
      ".....o.oBBBBBBo.oosso",
      "......osBBkkBBso..oWo",
      ".......oBBoosso....o.",
      ".......oBBoosso......",
      ".......oBBoosso......",
      ".......oWBooWso......",
      ".......oBBoosso......",
      ".......oBBoosso......",
      "......ooBBoossoo.....",
      ".....oBBBBoosssso....",
      "......oooo..oooo.....",
    ],
  },
  orc: {
    palette: { o: "#10200e", G: "#4f7a3a", d: "#305024", L: "#79a857", k: "#14100a", R: "#ff463c", W: "#f0f0e6", M: "#969ca8", m: "#646a76", X: "#dce2ea", A: "#6e4a26", a: "#4a3018" },
    art: [
      "...........okkkkko.......",
      "..........oLLkkkddo......",
      "oooooo...oLLLGGGdddo.....",
      "WWMMmmo..oLLLGGGdddo.....",
      "WMMMmmo..oLooGGGoodo.....",
      "MMMMmmo..oGRRGGGRRdo.....",
      "MMMMmmo..oGWGddGdWdo.....",
      "MMMMmmo..oGWGGGGdWdo.....",
      "ooAaomooooGooooooodo.....",
      ".oAaoooMMMMMGGGGdddoo....",
      "..oAaooMXXMMGGGGGGdddo...",
      "..oAaooMMMMMGGGGGGdddoo..",
      "...oAaLGGMMMGGGGGGdddddo.",
      "...oAaLGGLLAaGGGGGdddddo.",
      "...oAaGGGLLGAaGGGGdddddo.",
      "....oAaGGGGGGAaGGGdddddo.",
      "....oAaGGGGGGGGGGGdddddo.",
      "....oGAaGGGGGGGGGadddddo.",
      "....oGAaoGGGGGGGGAaddddo.",
      ".....ooooGGGGGGGGGAaodddo",
      "........oGGGGGGGGGddodddo",
      ".........oAAAAAAaaaoodddo",
      ".........oAAAAAAaaaooWoWo",
      ".........oAAAAAAaaao.o.o.",
      ".........oLGGGaddddo.....",
      ".........oLGGGoddddo.....",
      ".........oLGGGoddddo.....",
      ".........oLGGGoddddo.....",
      ".........oLGGGoddddo.....",
      "........oAAAAAoaaaaao....",
      "........oAAAAAoaaaaao....",
      ".........ooooo.ooooo.....",
    ],
  },
  golem: {
    palette: { o: "#181b1f", S: "#6a727a", G: "#464d55", L: "#9aa3ab", d: "#30353c", k: "#14161a", C: "#7fd0e6", c: "#d2f5ff" },
    art: [
      "...........ooooo..........",
      "..........oSSSSSo.........",
      ".........oSSSSSSSo........",
      ".........oScCScCSo........",
      ".........oSCCSCCSo........",
      ".........oSSSSSSSo........",
      "......ooooSSSSSSSoooo.....",
      "..ooooLLLSSSSdSSSGGGGooo..",
      ".oLLLLLLLSSSSdSSkGGGGGGGo.",
      ".oLLLLLLLSSSSdSSkGGGGGGGo.",
      ".oLLLLoLLSSSSdSSSkGGoGGGo.",
      ".oLLLLoLLSSSCcCSSkGGoGGGo.",
      ".oLLLLoLLSSSSdSSSGGGoGGGo.",
      ".oSSSSodddddddddddddoGGGo.",
      ".oddddoSSSSSSdSSSGGGoddddo",
      "oSSSSSoSSkSSSdSSSGGGoGGGGo",
      "oSSSSSoSSSkSSdSSSGGGoGGGGo",
      "oSSSSSoSSSkSSdSSSGGGoGGGGo",
      "oSSSSSoSSSSkSdSSSGGGoGGGGo",
      "oSSSSSoSSSSSSdSSSGGGoGGGGo",
      "oSSSSSoodddddddddddooGGGGo",
      ".ooooo.odddddddddddo.oooo.",
      ".......oSSSSSoSSSGGo......",
      ".......oSSSSSoSSSGGo......",
      ".......oSSSSSoSSSGGo......",
      ".......odddddodddddo......",
      ".......oGGGGGoGGGGGo......",
      ".......oGGGGGoGGGGGo......",
      ".......oGGGGGoGGGGGo......",
      "......oGGGGGGoGGGGGGo.....",
      ".......oooooo.oooooo......",
    ],
  },
  wraith: {
    palette: { o: "#0a101c", D: "#182640", P: "#2b466e", B: "#4e78a5", k: "#04060c", C: "#5fc8ff", c: "#b4f0ff", S: "#c8cdd7", s: "#8c92a0" },
    art: [
      ".........oooooooo.........",
      ".......ooBBBBBPPPoo.......",
      "......oBBBBBBBPPPPPo......",
      "......oBBBBBBBBPPPPo......",
      ".....oBBBDkkkkkkDPPPo.....",
      ".....oBBBkkkkkkkkPPPo.....",
      ".....oBBBkkCckCckPPPo.....",
      ".....oBBBkkkkkkkkPPPo.....",
      ".....oBBBkkkkkkkkPPPo.....",
      "......oBBkkkkkkkkPPo......",
      "......oBBBBBBBPPPPPo......",
      "......oBBBBBBBPPPPPo......",
      "....ooBBBBBBBPPPPPPDo.....",
      "...oSSSBBBBBPPPPPPDDo.....",
      "...oSSSPPPPPPPPPPPDDDo....",
      "..oSoSPSPPPPPPPPPDDssso...",
      ".osoPsPPsPPPPPPPDDDssso...",
      "..ooPPPPPPPPPPPPDDsDsDso..",
      "..oDDPPPPPPPPPDDDDDDDDDoo.",
      "..oDDDDPPPPPDDDDDDDDDDDoDo",
      ".oDDDDDDDDDDDDDDDDDDDDDDo.",
      "oDDDDDDDDDDDDDDDDDDDDDDDo.",
      ".oDDDDDDDDDDDDDDDDDDDDDDo.",
      ".oDDoDDDoDDDoDDDoDDDoDDDo.",
      ".oDooDDooDDooDDooDDooDDo..",
      "..o.oDo.oDo.oDo.oDo.oDo...",
      ".....o...o...o...o...o....",
    ],
  },
  imp: {
    palette: { o: "#2a0a0a", R: "#9c2a2a", d: "#6c1a1a", L: "#d65a3a", D: "#4a1418", P: "#78282c", E: "#340c10", W: "#f0eade", w: "#b4aa9b", Y: "#f2c14e", k: "#1a0606" },
    art: [
      "........o......o.........",
      ".oo....oWo....oWo....oo..",
      "oDDo..oWo.oooo.owo..oEEo.",
      ".oPDooDwooRRRRoowEooEDo..",
      "..ooDDDDLoRRRRodEEEEoo...",
      "...oDDDDLoYRRYodEEEEo....",
      ".ooDDDDDRRRRRRddEEEEEoo..",
      "oDDDDDDDRkRRRRkdEEEEEEEo.",
      "oDDDDDDDRkkkkkkdEEEEEEEo.",
      "oDDDDDDDRRWRRWddEEEEEEEo.",
      "oDDDoDDDooRRRRooEEEoEEEo.",
      "oDDo.oDDoLRRRRdoEEo.oEEo.",
      "oDo...oDoRRRRRdoEo...oEo.",
      "oDo...oRRLRLLRdddo...oEo.",
      ".o..ooRooLRLLRdoodoo..o..",
      "...okRo.oLRLLRdo.odkooko.",
      "....oo..oLRRRRdo..oo.oRko",
      "........oRRooddoo..ooRko.",
      "........oRRooddddooRRoo..",
      ".......ooRRooddoodRoo....",
      "......okRRo..oddkoo......",
      ".......ooo....ooo........",
    ],
  },
  lizard: {
    palette: { o: "#0e2814", G: "#3a8a3a", d: "#226028", L: "#7fd06a", Y: "#e8c24a", y: "#b48e30", F: "#d4504e", f: "#963234", W: "#f0f0e6", k: "#0a160c", M: "#aab0bc", A: "#6e4a26", a: "#4a3018" },
    art: [
      ".........oFfo...........",
      "........oFFFfo..........",
      ".......oFFFFffo.........",
      "......oLLWGGGddo........",
      ".......oYMGGYodo........",
      "......oLMGGGGydoo.......",
      ".....oGGAGGGGddddo......",
      ".....okGAGGGGdddko......",
      ".....okAWkkkkkWkko......",
      "......oAoGGGGoooo.......",
      ".....oAooGGGGooo........",
      ".....oAGLGGGGdddo.......",
      "....oAoGGyyyydddo.......",
      "...ooAGLGYYYYddddo......",
      "..oGLooGGyyyydddodo.....",
      "..oGAooGGYYYYdddoddo....",
      "..oAo.oGGyyyydddoddo....",
      "..oAo.oGGYYYYdddooo.....",
      ".oAo..oGGyyyydddo.......",
      ".oAo..oGGYYYYddGo......o",
      "oAo....oAAAAAAadGoo..ood",
      ".o.....oAAAAAaAodGGooGGo",
      ".......oGGGodddooddGGoo.",
      ".......oGGGodddo.oodo...",
      ".......oGGGodddo...o....",
      "......oGGGo.odddo.......",
      "......oGGGo.odddo.......",
      ".....ooGGGooodddoo......",
      "....oWGGGGGWdddddWo.....",
      ".....ooooooooooooo......",
    ],
  },
  ghost: {
    palette: { o: "#162630", D: "#3a6070", G: "#6ea0b2", B: "#9fd6e6", W: "#e1f8ff", k: "#0a1218" },
    art: [
      ".........oooooo.........",
      ".......ooBBBBBBoo.......",
      "......oWWWWBBBBBGo......",
      ".....oWWWWWWBBBBGGo.....",
      "....oWWWWWWWWBBBBGGo....",
      "...oWWWWWWWWWBBBBGGGo...",
      "...oWWWWWWWWWBBBBGGGo...",
      "...oWWWWWWWWWBBBBGGGo...",
      "...oWWWWokWWWBokBGGGo...",
      "..oBWWWWkkWWWBkkBGGGGo..",
      "...oWWWWkkWWWBkkBGGGo...",
      "...oBWWWWWWWBBBBGGGGo...",
      "...oBBWWWWWBBBBBGGGGDo..",
      "...oBBBBBBBokoBGGGGGDo.o",
      "....oBBBBBBkkkBGGGGDDooD",
      ".....oBBBBBkkkGGGGGDDo.o",
      "......oBBBBBBGGGGGDDDDo.",
      "..o...oBBBBGGGGGGDDDDDo.",
      ".oGo...ooGGGGGGGGDDDDDo.",
      "oDo.....oGGGGGGGDDDDDDo.",
      ".o.......oGGGGDDDDDDDDDo",
      ".......o.oGGGDDDDDDDDDDo",
      "......oGo.ooGooooGoooGo.",
      "......oGo..oDo..oGo.oDo.",
      ".......oDo..o....oGo.o..",
      "........o........oDo....",
      "..................o.....",
    ],
  },
  knightmare: {
    palette: { o: "#101018", M: "#7a8096", m: "#505569", W: "#bec4d7", d: "#323546", k: "#06060c", R: "#ff463c", r: "#962832", F: "#c83238", f: "#822028", L: "#cdd8e0", l: "#919caa", G: "#96783c" },
    art: [
      ".........oFFooFFfo..",
      ".........ooFFFooofo.",
      "........oWMMMmo..o..",
      ".......oWWMMMmmo....",
      ".......oWWMMMmmo....",
      ".......okkRkkRko....",
      ".......okkkkkkko....",
      ".......oMMMMMmmo....",
      "....oooRMMMMMmmrooo.",
      "...oWWMMMMMmMmMmmmmo",
      "...oMMMMMWMmMmMmmmmo",
      "...oMMMMMMMmMmMmmmmo",
      ".ooGGGoMMMMmMmMmmmmo",
      "oGGGGGGoMMMmMmMommo.",
      ".ooWlMModddddddommo.",
      "..oWlMMoMMMmMmmommo.",
      "..oLlMMoMMMmMmMommo.",
      "..oLlmmodddkdddommo.",
      "..oLlmmodddkdddodddo",
      "..oLlooodddddddodddo",
      "..oLlo.ommmmmmmoooo.",
      "..oLlo.ommmmmmmo....",
      "..oLlo.oWMMommmo....",
      "..oLlo.oWMMommmo....",
      "..oLlo.odddodddo....",
      "..oLlo.oWMMommmo....",
      "..oLlo.oWMMommmo....",
      "..oLlooMMMMommmmo...",
      "..olo.oMMMMommmmo...",
      "...o...oororoooo....",
      ".........o.o........",
    ],
  },
  dragon: {
    palette: { o: "#320c0c", R: "#9c2a2a", Q: "#6e181a", L: "#d65a3a", P: "#782428", E: "#56181e", D: "#3c1012", d: "#2c0c0e", Y: "#f2c14e", y: "#be8c32", W: "#f5eede", w: "#b9ac96", k: "#1e0606", F: "#ff7828" },
    art: [
      ".o........o......o..........o..",
      "oPo......oWo....oWo........oEo.",
      "oPDo....oWoooooooowo......odEo.",
      "oPDPoo..owLLLRRRRQwo....ooEdEo.",
      "oPDPPDo..oLoYRRYoQo....odEEdEo.",
      "oPDPPDDo.oLLLRRRRQooo.oddEEdEo.",
      "oPDPPDPPoRRRRRRRRQQQkoEYdEEdEo.",
      "oPDPPDPPPRRRRRRRRQQQQQFEdEEdEo.",
      "oPPDPDPPPkkWkkkWkkkWkkEEFEdEEo.",
      "oPPDPPDPPPoRRRRRRRQoEEEdEEdEEo.",
      "oPPDPPDPPPoRRRRRRRQoEEEdEEdEEo.",
      "oPPDPPDPPPwRRwRRwRQwEEEdEEdEEo.",
      "oPPDPPDPPLLRRRRRRRQQQEEdEEdEEo.",
      "oPPDPoDPPLLRYYYYYYQQQEEdoEdEEo.",
      "oPPPooDPPLLRyyyyyyQQQEEdooEEEo.",
      "oPoo..oooLLRYYYYYYQQQooo..ooEo.",
      ".o......oRRRyyyyyyQQQo......o..",
      "........oRRRYYYYYYQQQo.........",
      "........oRRRyyyyyyQQQo.......o.",
      "........oRRRYYYYYYQQQo......oWo",
      "........oRRRyyyyyyQQRoo.....owo",
      "........oRRRYYYYYYQQQRRoo.ooRow",
      "........oLRRRooooQQQQQQRRoRRo.o",
      "........oLRRRo..oQQQQooQQRoo...",
      "........oLRRRo..oQQQQo.ooQo....",
      "........oLRRRo..oQQQQo...o.....",
      "........oLRRRo..oQQQQo.........",
      ".......oRRRRRo..oQQQQQo........",
      "......oWRRWRRWooWQQWQQWo.......",
      ".......ooooooo..ooooooo........",
    ],
  },
  harpy: {
    palette: { o: "#322412", F: "#caa06a", f: "#967042", e: "#684c2a", H: "#ebcd96", A: "#784623", a: "#543018", S: "#e8be8e", s: "#be9264", E: "#e8c24a", k: "#3c1e14", Y: "#d9a93f", y: "#a07828", W: "#f0ece2" },
    art: [
      "............oooooo............",
      ".o.........oAAAAAAo.........o.",
      "oFoo......oAAAAAAaao......oofo",
      "oFFFoo....oAAAAAAaao....oofffo",
      "oFFFFFoo..oASSSSssao..oofffffo",
      "oFFFFFFFoooASESSEsaooofffffffo",
      "oFFFFFFFFFoASoSSosaofffffffffo",
      "oFFFFFFFFFFASSkkssaffffffffffo",
      "oFoFFFFfFfFaSSSSssafefeffffofo",
      "oFFFFfFfFffoFFFFffoeefefeffffo",
      "ofFfoffofofoFHHHffoeoeoeeoefeo",
      "offffooofoooFHHHffoooeoooeeeeo",
      ".ofofo..o..oFHHHffo..o..oeoeo.",
      "..o.o......oFHHHffo......o.o..",
      "...........oFFHFffo...........",
      "...........oFFFFffo...........",
      "...........oFFFFffo...........",
      "...........oFYFoyo............",
      "..........oFoYFoyfo...........",
      "..........ofoYfoyeo...........",
      "...........ooYooyo............",
      "...........oWYWWyWo...........",
      "...........oWooWoo............",
      "............o..o..............",
    ],
  },
  spider: {
    palette: { o: "#160c16", P: "#4a2d4a", L: "#7a5074", D: "#301c30", k: "#1e1220", R: "#d43c38", r: "#8c282c", W: "#f0ece2", w: "#b9ac96" },
    art: [
      "............o..o............",
      "........o..oDookoo.o........",
      ".......oDooLLLLLLDoko.......",
      "........oLLLLLLLLLLDo.......",
      ".......oLLLLLLLLLLLLDo......",
      "......oLLLLLLLLLLLLLLDo.....",
      "......oLLLLLLRRRLLLLLDo.....",
      "......oLLLLLLLRLLLLLLDo.....",
      ".....oPLLLLLLRRRLLLLLPDo....",
      ".....ooPPLLLPPPPLLLPPDo.....",
      "....okoPPPPPPPPPPPPPPDko....",
      "....okDPPPPPPPPPPPPPPkko....",
      "...okooDPPPPPDkPPPPPkooko...",
      "...okoooDDDDDDkkkkkkoooko...",
      "..okkDDooDLLPPPPLLkookkkko..",
      "..okoooDDoDPRPPRPkokkoooko..",
      ".okkokDDoDDrPrrPrkkokkkokko.",
      ".okookooDDDPPPPPPkkkookooko.",
      ".okoko.oooDDPPPPkkooo.okoko.",
      "okookookDDooWooWookkkookooko",
      ".ooko.okoo.owoowo.ooko.okoo.",
      "..okooko....o..o....okooko..",
      "...o.oko............oko.o...",
      "....oko..............oko....",
    ],
  },
  mandrake: {
    palette: { o: "#1a140a", B: "#caa06a", b: "#966e42", H: "#e8c48c", K: "#604024", k: "#281a0e", G: "#3a8a3a", g: "#226028", L: "#8fd06a" },
    art: [
      "...oLLo...oGo..oLLo...",
      "....ogo..oLGo..ogo....",
      "..oo.ogoo.oGooogo.oo..",
      ".oLLo.oggooGoggo.oLLo.",
      ".oggooooogoGgoooooggo.",
      "..ooggggooggooggggoo..",
      "....ooooggggggoooo....",
      "....oHHHHBBBBBbbbo....",
      "....oHHHHBBBBBbbbo....",
      "....oHHHHBBBBBbbbo....",
      "....oHHHbbBbbBbbbo....",
      "....oHHkHkBBkBkbbo....",
      "....oHHHkBBBBkbbbo....",
      "....oBBBBBBBBBbbbo....",
      "...oBoBbbBbbBbbbobo...",
      "..oBooBBbkkkkbbboobo..",
      ".oBo.oBBkkkkkkbbo.obo.",
      "obbo..oBkkkkkkbo...obo",
      ".oo...obkkKKkkbo....o.",
      "......oBBBBBBBbo......",
      ".......oBBBBBBo.......",
      ".......oBbbBbbo.......",
      "........oBBBBBo.......",
      "........oBBBBo........",
      "........oBBBBo........",
      ".......oBoboobo.......",
      "......oBo.oboobo......",
      "......oBo..o.obo......",
      ".....oBo......obo.....",
      "....obo........obo....",
    ],
  },
  sahagin: {
    palette: { o: "#082634", C: "#1f6a7a", D: "#144a58", L: "#4fb0c0", P: "#9be8e0", p: "#6eb4af", F: "#5fc8d7", f: "#328ca0", Y: "#f2c14e", y: "#b98c32", W: "#ebf5f5", k: "#061820", M: "#aab0bc", A: "#6e4a26" },
    art: [
      "........ooFoo.......",
      ".o.o...oFfooFo......",
      "oWoWo..oFFFfFfo.....",
      "oMWMo.oLLLCCCDDo....",
      "oMMMo.oLLLCCCDDo....",
      ".oAo.oWYLLCCCDYYo...",
      ".oAo.oYDCCCCCDYyo...",
      ".oAo.oCDCCkkCDDDo...",
      ".oAo..oCCkkkkDDo....",
      ".oAo..ofLCCCCDfo....",
      ".oAo...oLCCCCDo.....",
      ".oAo...oLCCCCDo.....",
      ".oAo..oLCCCCCDDo....",
      ".oAoooCCLPPPPDDDo...",
      ".oACCCoLLPPPpDDoDo..",
      ".oACCooCCPPPPDDFoDo.",
      ".oAoo.oCCPPPpDDooDDo",
      ".oAo..oCCPPPPDDoDoDo",
      ".oAo..oCCPPPpDDoo.o.",
      ".oAo..oCCPPPPDDo....",
      ".oAo..oCCCCCCDDo....",
      "..o....oDDDDDDo.....",
      ".......oDDDDDDo.....",
      ".......oCCCoDDDo....",
      ".......oCCCoDDDo....",
      ".......oCCCoDDDo....",
      "......ooCCCoDDDoo...",
      ".....oCCCCCoDDDDDo..",
      "....oFFCCCCoDDDDFfo.",
      ".....oooooo.oooooo..",
    ],
  },
  ogre: {
    palette: { o: "#20160e", S: "#b08a5a", s: "#80603a", H: "#d8b27c", k: "#1c120a", R: "#ff463c", W: "#f0ece2", w: "#b9ac96", A: "#684624", a: "#462e16", B: "#8c6438" },
    art: [
      ".............oWo..........",
      ".............oWwo.........",
      "...........ooSSSSoo.......",
      "..........okkSSSSkko......",
      "..........oHRSSSSRso......",
      "..........oSSSSSSsso......",
      "..........oSSHHHHsso......",
      "..........oSWsHHsWso......",
      "..........okkkkkkkko......",
      ".........ooooSSSSoooo.....",
      "........oAAAAAAAAAAAAo....",
      ".....oooAAAAAAAAAAAAAaooo.",
      "....oHSSHaAaAaAaAaAaAsssso",
      "....oHSSHHSSSSSSSSSSssssso",
      "....oSSSHHSSSSSSSSSSssssso",
      "....oSSSHHSSSSSSSSSSssssso",
      "....oSSSHHSSSSSSSSSSssssso",
      "....oSSSHHSSSSSSSSSSssssso",
      "....oSSSHHSSSSSSSSSSssssso",
      "...oSSSSSSSSSSSSSSSSssssso",
      "...oSSSSSsssssssssssssssso",
      "...oASSSSSSSSSkkSSSSssssso",
      "...oAooSSSSSSSSSSSSSssssso",
      "..oAo.oSSSssssssssssssWoWo",
      ".ooAo..oSSSSSSSSSSSSsso.o.",
      "oWAoo...oSSSSSSSSSSSso....",
      "aAAAAo...oAAAAAAAAAAo.....",
      "ABAWAo...oAAAAAAAAAao.....",
      "AABAAo...oAAaAAAaAAAo.....",
      "AAAAAo...oSSSSoosssso.....",
      "AAAAao...oSSSSoosssso.....",
      "ooooo...osssssoossssso....",
    ],
  },
};

// ===== ランク基準ステータス =====
// モンスターランク (1-10) から基準ステータスを算出する。全100迷宮のバランスの
// 単一の調整点。個体差は mul (hp/atk などの倍率) で付ける。
// ・hp はプレイヤーの攻撃力カーブ (魂×5部位+武器) に対し通常2-3撃で倒せる量
// ・atk はプレイヤーの VIT 半減則 (combat.js) を踏まえた貫通量
export function monStats(rank, boss = false) {
  const r = Math.max(1, Math.min(10, rank));
  const s = {
    hp: Math.round(30 * Math.pow(r, 1.8)),
    atk: Math.round(12 + 3.2 * r * r),
    def: Math.round(2 * Math.pow(r, 1.5)),
    spd: 4 + Math.round(r * 0.9),
    soul: Math.round(10 * Math.pow(1.65, r - 1)),
    gold: Math.round(8 * Math.pow(1.7, r - 1)),
  };
  if (boss) {
    s.hp = Math.round(s.hp * 3.2);
    s.atk = Math.round(s.atk * 1.3);
    s.def = Math.round(s.def * 1.2);
    s.spd += 2;
    s.soul *= 8;
    s.gold *= 10;
  }
  return s;
}

// ===== モンスター定義ヘルパー =====
// すべてのモンスターはここを通る。スキーマ:
// { id, key, name, race, rank, desc, maxhp, hp, atk, def, spd, soul, gold,
//   art, palette, boss?, dropNormal?, dropRare?, soulClass? }
// soul は撃破時に回収できる Soul 量 (経験値の役割を兼ねる)。
// 注: def/spd は定義用の名前のまま。出現時に六大ステへ写像される
//     (combat.js makeEnemy: atk→ATK, def→VIT, spd→AGI)。
// dropNormal/dropRare は省略可 (省略時は game.js がランクから決定的に割り当てる)。
// soulClass を持つ人型は撃破時にまれに魂を落とす。
export function defMonster(def) {
  if (!def.id) throw new Error("monster id required");
  if (!ARTS[def.artKey || ""] && !def.art) throw new Error("unknown artKey: " + def.artKey + " (" + def.id + ")");
  const base = ARTS[def.artKey] || {};
  const m = {
    id: def.id, key: def.id,
    name: def.name || "???",
    race: def.race || "beast",
    element: def.element || "none",
    rank: def.rank || 1,
    desc: def.desc || "",
    maxhp: def.hp || 10, hp: def.hp || 10,
    atk: def.atk || 1, def: def.def || 0, spd: def.spd || 5,
    soul: def.soul || 5, gold: def.gold || 3,
    art: def.art || base.art,
    palette: def.palette || base.palette,
    boss: !!def.boss,
  };
  if (def.dropNormal) m.dropNormal = def.dropNormal;
  if (def.dropRare) m.dropRare = def.dropRare;
  if (def.soulClass) m.soulClass = def.soulClass;
  if (def.elite) m.elite = true; // 強敵 (強敵階専用。通常プール・ミミックの対象外)
  return m;
}

// 定義の配列を { id: monster } に変換 (重複IDは即エラー)
export function defMonsters(defs) {
  const out = {};
  for (const d of defs) {
    const m = defMonster(d);
    if (out[m.id]) throw new Error("duplicate monster id: " + m.id);
    out[m.id] = m;
  }
  return out;
}

// ===== 文節での折り返し (全画面共通) =====
// 日本語の説明文が「無\n料」のように語の途中で切れないよう、キリの良いところ (句読点・括弧・
// 助詞の後など) にだけ折り返しの候補 (ゼロ幅スペース U+200B) を入れる。CSS 側は
// word-break: keep-all (字と字の間では折らない) と overflow-wrap: break-word (一つの文節が
// 1行に収まらないときだけ途中で折る) — styles.css の html, body。
// 文字は kit.js の el/setText/glyphText が作るときに直接整え、それ以外 (game.js の innerHTML・
// textContent 直書きなど) は installPhraseWrap の MutationObserver が後から整える。
// U+200B は見えず、\s にも当たらない。DOM の文字を比べるときは unphrase() で外してから比べる。
// SVG・入力欄・選択肢・.no-phrase の中は触らない。

export const ZWSP = "​";

const HIRA = /[ぁ-ゖゝゞ]/;
const KANJI = /[㐀-䶿一-鿿豈-﫿々〆〇]/;
const KATA = /[ァ-ヺー-ヿｦ-ﾟ]/;
const ALNUM = /[0-9A-Za-z０-９Ａ-Ｚａ-ｚ]/;
const OPEN = /[「『（(【〔［〈《“‘｛]/;
const CLOSE = /[」』）)】〕］〉》”’｝]/;
const STOP = /[、。，．！？!?]/;
const DOTS = /[…‥]/;
// 行頭に来てはいけない字 (小書きの仮名・長音・繰り返し記号・閉じ括弧・句読点・中点)
const NO_HEAD = /[ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶーゝゞヽヾ々」』）)】〕］〉》”’｝、。，．！？!?…‥・：]/;
const JP = /[぀-ヿ㐀-鿿豈-﫿]/;

// 漢字1字 + この送り仮名1字 + 漢字 は複合動詞 (受け取る・引き出す・立ち上がる・閉じ込める) として離さない
const JOIN = /[きぎしじちびみりけげせてれめえ]/;

// cs[i-1] と cs[i] の間で折ってよいか
function canBreak(cs, i) {
  const a = cs[i - 1], b = cs[i];
  if (a === " " || b === " " || a === "　" || b === "　" || b === ZWSP) return false;
  if (NO_HEAD.test(b)) return false;
  if (OPEN.test(a)) return false;
  if (OPEN.test(b)) return true;
  if (STOP.test(a) || DOTS.test(a) || a === "・" || a === "：") return true;
  if (CLOSE.test(a)) return !HIRA.test(b); // 「控え」へ — 括弧の後の助詞は離さない
  // 仮名で終わる文節 (〜の/〜を/〜で/〜ば…) の後、漢字・片仮名・数字で次の文節が始まる。
  // 接頭の「お」「ご」(お金・ご覧) は後ろの漢字から離さない
  if (HIRA.test(a) && a !== "お" && a !== "ご" && (KANJI.test(b) || KATA.test(b) || ALNUM.test(b))) {
    return !(KANJI.test(b) && JOIN.test(a) && i >= 2 && KANJI.test(cs[i - 2]));
  }
  // 漢字と片仮名の境目 (大剣|フランベルジュ) も折り目にして、長い名前が1行をはみ出さないようにする
  if ((KANJI.test(a) && KATA.test(b)) || (KATA.test(a) && KANJI.test(b))) return true;
  return false;
}

// 折り返しの候補を入れた文字列 (何度かけても同じ結果になる)
export function phrase(text) {
  if (text == null) return text;
  const s = String(text);
  if (!JP.test(s)) return s;
  const cs = Array.from(s.indexOf(ZWSP) >= 0 ? s.split(ZWSP).join("") : s);
  let out = cs[0] || "";
  for (let i = 1; i < cs.length; i++) {
    if (canBreak(cs, i)) out += ZWSP;
    out += cs[i];
  }
  return out;
}
// 折り返しの候補を外した素の文字列 (比較用)
export function unphrase(text) {
  return text == null ? "" : String(text).split(ZWSP).join("");
}
// 文字列のどの位置 (コードポイントの添字) の前で折ってよいか — 一文字ずつ span にする語り (opening.js) 用
export function phraseBreaks(text) {
  const cs = Array.from(unphrase(text)), at = new Set();
  for (let i = 1; i < cs.length; i++) if (canBreak(cs, i)) at.add(i);
  return at;
}

// ---- DOM 全体に掛ける ----
const SKIP = "script,style,textarea,input,select,option,svg,[contenteditable],.no-phrase";
function fixText(node) {
  const p = node.parentElement;
  if (!p) return;
  const v = node.nodeValue;
  if (!v || v.length < 2 || !JP.test(v)) return;
  if (p.closest(SKIP)) return;
  const nv = phrase(v);
  if (nv !== v) node.nodeValue = nv;
}
function fixTree(root) {
  if (!root) return;
  if (root.nodeType === 3) { fixText(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.nodeType === 1 && root.closest(SKIP)) return;
  const tw = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) fixText(n);
}
function handle(records) {
  for (const r of records) {
    if (r.type === "characterData") fixText(r.target);
    else for (const n of r.addedNodes) fixTree(n);
  }
}

let observer = null;
export function installPhraseWrap(root) {
  if (observer || typeof document === "undefined" || typeof MutationObserver !== "function") return;
  const target = root || document.body || document.documentElement;
  if (!target) return;
  fixTree(target);
  observer = new MutationObserver(handle);
  observer.observe(target, { childList: true, subtree: true, characterData: true });
}

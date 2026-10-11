// ===== 無限迷宮の称号 (docs/infinite-affixes.md 4章) =====
// 見た目だけ (能力は上がらない)。1つを選んで付けると、無限迷宮の入口・帰還の記録で隊の名の横に出る。
// 数え (G.stats.inf) と得た称号の判定は game.js の「無限迷宮の称号と勲章」の段。key はセーブに残るので変えない・使い回さない
export const INF_TITLES = [
  { key: "f10", name: "淵を覗く者", cond: "無限迷宮の B10F に着く" },
  { key: "boss1", name: "風だまりの客", cond: "風だまりの主を初めて倒す" },
  { key: "f50", name: "深淵を歩む者", cond: "B50F に着く" },
  { key: "f100", name: "百層の踏破者", cond: "B100F に着く" },
  { key: "f150", name: "底なしの", cond: "B150F に着く" },
  { key: "f200", name: "果てを知らぬ", cond: "B200F に着く" },
  { key: "commons", name: "名もなき英雄", cond: "最初の魂がすべてコモンの隊で B30F に着く" },
  { key: "lone", name: "一騎当千", cond: "生き残りが1人の時に主を倒す" },
  { key: "clean", name: "無傷の帰還", cond: "誰も砕けずに B20F より深い主を倒して帰る" },
  { key: "keeper", name: "灯番の友", cond: "灯番でメイン魂を付け替えた回数 10回" },
  { key: "trader", name: "回収人の得意先", cond: "回収人に売った品 100点" },
  { key: "picker", name: "拾い屋", cond: "1回の出撃で魂を 10個拾う" },
  { key: "legend", name: "伝説を拾う者", cond: "無限迷宮でレジェンドの魂を拾う" },
  { key: "star", name: "星を持つ者", cond: "極の特性の付いた品を拾う" },
  { key: "hoard", name: "宝の山", cond: "1回の出撃で秘・極の特性の品を 5点拾う" },
  { key: "embers", name: "残火を抱く者", cond: "1回の出撃で魂の残火を 20個拾う" },
  { key: "undying", name: "不死身", cond: "1回の出撃で一度も器が砕けずに B50F に着く" },
  { key: "brink", name: "背水の陣", cond: "全員のHPが30%以下の時に主を倒す" },
  { key: "blade", name: "剣のみ", cond: "1回の出撃で技を使わずに B20F 以降の主を倒す" },
  { key: "prayer", name: "祈りのみ", cond: "1回の出撃で通常攻撃をせずに B20F 以降の主を倒す" },
];
export const INF_TITLE_MAP = Object.fromEntries(INF_TITLES.map((t) => [t.key, t]));
{
  if (Object.keys(INF_TITLE_MAP).length !== INF_TITLES.length) throw new Error("inftitles: key の重複");
}
// 着いた階で得る称号
export const INF_DEPTH_TITLES = [[10, "f10"], [50, "f50"], [100, "f100"], [150, "f150"], [200, "f200"]];

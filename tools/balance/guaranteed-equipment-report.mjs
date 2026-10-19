// 名のある強敵の固定首級を、ゲームと同じ台帳・説明から一覧化する。
// node tools/balance/guaranteed-equipment-report.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { ITEMS, SLOT_LABEL } from '../../src/items.js';
import { CATALOG_ITEMS } from '../../src/catalog/index.js';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
import { NAMED_FOES } from '../../src/dungeons/named.js';
import { specialLines, statLines } from '../../src/ui/itemview.js';
Object.assign(ITEMS, CATALOG_ITEMS);
Object.assign(MONSTERS, DUNGEON_MONSTERS);
const rows = Object.entries(NAMED_FOES).flatMap(([id, foe]) => {
  const it = ITEMS[foe.trophy];
  if (!it) return [];
  assert.equal(it.trophy, id);
  assert.equal(it.rar, 'sr');
  return [{ 層: foe.layer, 強敵: MONSTERS[id].name, 装備: it.name,
    部位: it.slot === 'acc' ? '装飾' : SLOT_LABEL[it.slot], レア度: 'スーパーレア',
    入手条件: '首級未取得の状態で討伐し、戦闘後の宝箱から回収（全滅で失えば再取得可能）',
    性能: statLines(it), 特殊効果: specialLines(it).join('／'), 装備ID: it.id, 強敵ID: id }];
}).sort((a, b) => a.層 - b.層 || a.装備ID.localeCompare(b.装備ID));
const keys = Object.keys(rows[0]);
const csv = '\ufeff' + [keys, ...rows.map(row => keys.map(k => row[k]))]
  .map(row => row.map(v => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\n') + '\n';
fs.writeFileSync(new URL('../../docs/guaranteed-equipment.csv', import.meta.url), csv);
console.log(`固定首級${rows.length}点を出力。数値は目録の並品相当・追加特性なし。通常の強敵や無限迷宮の主の確定ドロップ、宝物庫のLR褒賞は品名が抽選されるため、この固定装備一覧には含めない。`);

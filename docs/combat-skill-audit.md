# 全職の技・パッシブ重複と利用価値の点検

2026-10-17。基準は main `459c17981eec36b94295acbfb433b5670bd4aeca`。37職（灯守を含む）の習得表から、使用技957キー・パッシブ300キーを全件確認した。定義960技のうち、現在の習得表にない3技は実用性の比較から除いた。今回変更するゲームの挙動はオート開始ボタンの補足文だけで、以下のスキル効果は変更していない。

名前・説明文だけでなく、対象・属性・威力・命中・会心・追加効果・消費MPと、実際の段変換を比較した。別職で同じ技を持つこと、低位技が後で上位技へ役目を譲ること、加算で重なる加護は、それだけでは不具合・不要とは判定しない。職の能力・属性適性が違うので、技定義が同じでも実際のダメージまで同じとは限らない。

## 1. 優先して見直したい：成長しても実効果が変わらない10件

以下は `Battle` を各習得段階で作り、開始時の `effects` の段・倍率・持続が同じであることを実測した。強化・弱体は [段の換算](../src/buffstage.js) を通るため、定義の微小な倍率差が消える。「効果がない」のではなく、上位Lvに育てる追加価値がない。

| 職・パッシブ | 習得レベル（パッシブLv順） | 実際の効果（全習得段階で同じ） |
|---|---|---|
| [仕込み罠](../src/jobkit/thief.js#L60) | 盗賊 75/155/165 | 敵全体の素早さ-1段（×0.8・3ターン） |
| [猛り狂う](../src/jobkit/berserker.js#L63) | 狂戦士 25/70/115 | 本人攻撃+1段（×1.25・3ターン）／本人防御-1段（×0.8・3ターン） |
| [禍の前触れ](../src/jobkit/hexer.js#L34) | 呪術師 35/115 | 敵全体の素早さ-1段（×0.8・3ターン） |
| [霞の庵](../src/jobkit/hermit.js#L51) | 隠修士 60/105/155 | 味方全体素早さ+1段（×1.25・3ターン） |
| [突撃の勢い](../src/jobkit/crusader.js#L48) | 聖戦士 35/105/185 | 本人素早さ+1段（×1.25・2ターン） |
| [護法陣](../src/jobkit/warden.js#L53) | 護法師 25/60/115/185 | 味方全体防御+1段（×1.25・3ターン） |
| [審問官のにらみ](../src/jobkit/inquisitor.js#L54) | 審問官 35/90/165 | 本人への挑発×3・3ターン／敵全体の攻撃-1段（×0.8・3ターン） |
| [開戦の号令](../src/jobkit/hero.js#L42) | 勇者 75/165 | 味方全体防御+1段（×1.25・3ターン） |
| [殺気の帳](../src/jobkit/asura.js#L71) | 修羅 45/115/165 | 敵全体の攻撃-1段（×0.8・3ターン） |
| [聖座の威厳](../src/jobkit/cardinal.js#L41) | 枢機卿 75/155 | 敵全体の攻撃-1段（×0.8・3ターン） |

特に「仕込み罠」「禍の前触れ」はどちらも敵全体の素早さ−1段・3ターン、「護法陣」「開戦の号令」はどちらも味方全体の防御+1段・3ターンで、実効果の役割も重なる。ただし両者を同時に持てば段を積み増せる。

## 2. 別名なのに技定義と消費MPが完全に一致：12組

定義比較から `name`・`desc` だけを除いた一致。共通キーを複数職が覚える通常の共通技（付録）とは分けた。

| 技と習得 | 共通の効果定義 |
|---|---|
| [陣中の手当て](../src/jobkit/knight.js#L19)（騎士Lv25、基礎MP4）<br>[盾陰の手当て](../src/jobkit/guardian.js#L22)（守護騎士Lv25、基礎MP4） | `{"kind":"heal","bodyHeal":0.2,"healCap":0.35,"tech":true,"target":"ally","dur":3}` |
| [陣営の手当て](../src/jobkit/knight.js#L20)（騎士Lv60、基礎MP10）<br>[城壁の手当て](../src/jobkit/guardian.js#L23)（守護騎士Lv60、基礎MP10） | `{"kind":"heal","bodyHeal":0.1,"healCap":0.2,"tech":true,"target":"all-ally","dur":3}` |
| [煙玉](../src/skilldefs.js#L262)（盗賊Lv10、基礎MP3）<br>[影渡り](../src/skilldefs.js#L263)（暗殺者Lv10、基礎MP3）<br>[霞隠れ](../src/skilldefs.js#L264)（隠修士Lv10、基礎MP3） | `{"kind":"escape","target":"self","dur":3,"tech":true}` |
| [炎帝の業火](../src/jobkit/spellblade.js#L30)（魔法剣士Lv170、基礎MP20）<br>[叡智の炎](../src/jobkit/sage.js#L30)（賢者Lv140、基礎MP20） | `{"kind":"atk","power":60,"element":"fire","strip":true,"target":"enemy","dur":3}` |
| [眠り霞](../src/jobkit/hermit.js#L26)（隠修士Lv30、基礎MP4）<br>[死者の子守唄](../src/jobkit/necromancer.js#L29)（死霊術師Lv7、基礎MP4） | `{"kind":"debuff","sleepChance":0.5,"debuff":{"agi":0.9},"target":"all-enemy","dur":3}` |
| [魂抜き](../src/jobkit/arcthief.js#L32)（魔盗賊Lv122、基礎MP21）<br>[冥王の呪鎖](../src/jobkit/darkknight.js#L29)（魔騎士Lv140、基礎MP21） | `{"kind":"atk","power":60,"element":"dark","seal":{"chance":0.5,"turns":3},"target":"enemy","dur":3}` |
| [盗み嵐](../src/jobkit/arcthief.js#L35)（魔盗賊Lv150、基礎MP16）<br>[天鳴の大槌](../src/jobkit/archmage.js#L28)（大魔導Lv110、基礎MP16） | `{"kind":"atk","power":42,"element":"wind","debuff":{"hit":0.85},"target":"all-enemy","dur":3}` |
| [盗み火](../src/jobkit/arcthief.js#L36)（魔盗賊Lv160、基礎MP20）<br>[焼魂のくさび](../src/jobkit/archmage.js#L32)（大魔導Lv140、基礎MP20） | `{"kind":"atk","power":58,"element":"fire","vuln":{"fire":0.8},"target":"enemy","dur":3}` |
| [奪焔嵐](../src/jobkit/arcthief.js#L40)（魔盗賊Lv195、基礎MP30）<br>[灼熱地獄](../src/jobkit/battlemage.js#L35)（魔闘士Lv190、基礎MP30） | `{"kind":"atk","power":84,"element":"fire","debuff":{"vit":0.85},"target":"all-enemy","dur":3}` |
| [岩拳弾](../src/jobkit/battlemage.js#L22)（魔闘士Lv65、基礎MP8）<br>[岩葬の礫](../src/jobkit/archmage.js#L21)（大魔導Lv30、基礎MP8） | `{"kind":"atk","power":28,"element":"earth","debuff":{"vit":0.85},"target":"enemy","dur":3}` |
| [贖罪の火矢](../src/jobkit/inquisitor.js#L24)（審問官Lv12、基礎MP2）<br>[不動の火焔](../src/jobkit/ascetic.js#L24)（修験者Lv12、基礎MP2） | `{"kind":"atk","power":10,"element":"fire","faith":true,"target":"enemy","dur":3}` |
| [終の赦免](../src/jobkit/inquisitor.js#L43)（審問官Lv200、基礎MP120）<br>[聖典の終章](../src/jobkit/archbishop.js#L39)（巡礼者Lv200、基礎MP120） | `{"kind":"heal","healPct":1,"revive":true,"revivePct":0.7,"cure":true,"purge":true,"grantBarrier":1,"target":"all-ally","dur":3}` |

## 3. 効果定義は同じで基礎MPだけ異なる：4組

攻撃技では「魂の格」の威力補正も基礎MPに依存するので、表だけで完全上位とは断定しない。強化・弱体だけの技はその補正の対象外で、同じ使い手がサブ魂から借りるなら安い方を優先する理由がある。

| 比較対象 | 借用・習得枠での評価 |
|---|---|
| [心眼撃](../src/skilldefs.js#L56)（戦士Lv20・騎士Lv50・狂戦士Lv55・聖騎士Lv50・魔法剣士Lv20・武僧Lv55・聖戦士Lv55・審問官Lv65・修験者Lv55、基礎MP6）<br>[天翔撃](../src/skilldefs.js#L355)（竜騎士Lv7、基礎MP5） | 同じ物理技の係数。職の能力と魂の格込みで比較が必要。 |
| [術封じの網](../src/jobkit/arcthief.js#L30)（魔盗賊Lv110、基礎MP11）<br>[魂縛りの陣](../src/jobkit/necromancer.js#L35)（死霊術師Lv80、基礎MP10） | 同じ効果なら基礎MPが高い側の借用優先度が低い。 |
| [祓い](../src/skilldefs.js#L159)（祓魔師Lv20、基礎MP6）<br>[破門の勅書](../src/jobkit/cardinal.js#L22)（枢機卿Lv15、基礎MP5） | 同じ効果なら基礎MPが高い側の借用優先度が低い。 |
| [身代わりの祈り](../src/jobkit/chaplain.js#L28)（護教官Lv65、基礎MP6）<br>[庇い立ち](../src/jobkit/sera.js#L24)（灯守Lv7、基礎MP5） | 同じ効果なら基礎MPが高い側の借用優先度が低い。 |

## 4. 段へ変換すると効果が一致する追加の7組

定義上の強化・弱体倍率だけが異なるもの。威力・追加効果・対象・持続など、ほかの定義は同じ。職の能力差による回復・ダメージ差は残る。

| 比較対象 | 同じになる理由 |
|---|---|
| [聖別](../src/skilldefs.js#L132)（僧侶Lv100、基礎MP16） {"vit": 1.3}<br>[聖水灌頂](../src/jobkit/bishop.js#L33)（司教Lv150、基礎MP9） {"vit": 1.1} | 倍率は違っても同じ段へ丸められる。MP差がある組では高MP側の借用優先度が下がる。 |
| [撒き菱](../src/skilldefs.js#L269)（盗賊Lv55、基礎MP7） {"agi": 0.75}<br>[殺気](../src/jobkit/asura.js#L22)（修羅Lv20、基礎MP6） {"agi": 0.8} | 倍率は違っても同じ段へ丸められる。MP差がある組では高MP側の借用優先度が下がる。 |
| [聖流の裁き](../src/jobkit/bishop.js#L31)（司教Lv132、基礎MP20） {"atk": 0.9}<br>[黒潮の呪滴](../src/jobkit/hexer.js#L23)（呪術師Lv130、基礎MP20） {"atk": 0.88} | 倍率は違っても同じ段へ丸められる。MP差がある組では高MP側の借用優先度が下がる。 |
| [千年城壁](../src/jobkit/guardian.js#L36)（守護騎士Lv130、基礎MP20） {"vit": 1.5}<br>[不動の陣](../src/jobkit/warden.js#L31)（護法師Lv120、基礎MP16） {"vit": 1.4} | 倍率は違っても同じ段へ丸められる。MP差がある組では高MP側の借用優先度が下がる。 |
| [霧籠め](../src/jobkit/hermit.js#L28)（隠修士Lv55、基礎MP8） {"agi": 0.75, "hit": 0.9}<br>[魔の煙幕](../src/jobkit/arcthief.js#L25)（魔盗賊Lv65、基礎MP8） {"agi": 0.8, "hit": 0.9} | 倍率は違っても同じ段へ丸められる。MP差がある組では高MP側の借用優先度が下がる。 |
| [進軍の聖歌](../src/skilldefs.js#L153)（聖戦士Lv30、基礎MP10） {"atk": 1.25, "agi": 1.1}<br>[鼓舞](../src/skilldefs.js#L364)（勇者Lv20、基礎MP10） {"atk": 1.2, "agi": 1.2} | 倍率は違っても同じ段へ丸められる。MP差がある組では高MP側の借用優先度が下がる。 |
| [勇者の激励](../src/jobkit/hero.js#L30)（勇者Lv130、基礎MP18） {"agi": 1.15}<br>[恵みの風雨](../src/jobkit/sage.js#L25)（賢者Lv95、基礎MP18） {"agi": 1.1} | 倍率は違っても同じ段へ丸められる。MP差がある組では高MP側の借用優先度が下がる。 |

## 5. 別名パッシブの効果定義が一致：4組

ここは `fx` の全成分が一致する組。習得時期が違い、定義にある段階を全職が最後まで覚えるとは限らない。別キーなので重ねる価値がある場合もあり、単純な削除候補とはしない。

| パッシブ・職と習得レベル | 共通効果 |
|---|---|
| [血の報い](../src/jobkit/berserker.js#L46)（狂戦士 5/60/105）<br>[恨みの返し刃](../src/jobkit/darkknight.js#L43)（魔騎士 25/90/155） | 物理を受けるたび、攻撃力×0.2でやり返す。上位段階の成分も一致。 |
| [闇の障壁](../src/jobkit/darkknight.js#L39)（魔騎士 5/45/165）<br>[法壁の加護](../src/jobkit/warden.js#L43)（護法師 5/45/145） | 戦闘開始時、魔障壁を1回分まとう (ブレス・呪文半減)。上位段階の成分も一致。 |
| [静謐の循環](../src/jobkit/warden.js#L48)（護法師 90/125）<br>[冥府の泉](../src/jobkit/necromancer.js#L53)（死霊術師 90/175）<br>[紫衣の瞑想](../src/jobkit/cardinal.js#L43)（枢機卿 25/60/70） | 2ターン目から毎ターン、MPを最大の2%回復。上位段階の成分も一致。 |
| [告解の灯](../src/jobkit/inquisitor.js#L52)（審問官 5/60/185）<br>[慈悲の残光](../src/jobkit/sage.js#L79)（賢者 60/125/185）<br>[灯のみちびき](../src/jobkit/sera.js#L85)（灯守 60/115/155） | 戦闘勝利後、味方全員のHP3%回復。上位段階の成分も一致。 |

「静謐の循環」「冥府の泉」は現在Lv2までの習得、「紫衣の瞑想」はLv3まで。同一の実習得段階で比べると、早く高段階になる紫衣の瞑想がサブ魂の候補になりやすい。

## 6. 利用価値が下がる条件が明確な候補

自前で覚える効果を無価値とするものではなく、サブ魂の有限の借用枠や、既に効果が整っている隊での優先度の評価。条件なしの完全下位とは分ける。

| 候補 | 理由・比較対象 | 評価の条件 |
|---|---|---|
| [突撃の勢い](../src/jobkit/crusader.js#L48)（聖戦士35/105/185） | 実際は本人の素早さ+1段・2ターン。[霞の庵](../src/jobkit/hermit.js#L51)は味方全体+1段・3ターン。 | 両方を選べるサブ魂の1枠なら霞の庵が有利。両方の同時発動には段を積む価値がある。 |
| [聖典の護り](../src/jobkit/archbishop.js#L49)（巡礼者75/155） | 全体魔障壁1回の発動率35/55%。[先祓いの結界](../src/jobkit/exorcist.js#L75)は同段で40/60%、Lv115で80%まで覚える。 | 同段・同じ借用枠で比べると見劣り。別加護の障壁を重ねる用途は残る。 |
| [質素な祈り](../src/jobkit/priest.js#L23)（僧侶75/155） | 回復MP−10/18%に対し、[省詠唱](../src/souls.js#L392)は技・呪文全般のMP−15/30%。 | 省詠唱Lv2を借りられるなら、1枠の軽減としては省詠唱が広く強い。併用は可能。 |
| [手当ての心得](../src/jobkit/priest.js#L27)（僧侶135/175） | 回復量+10/20%。[大いなる祝福](../src/jobkit/archbishop.js#L43)は+20/40/60/100%。 | 高ランク巡礼者の加護を借りられる場合。自前の心得との加算は残る。 |
| [禊の加護](../src/jobkit/exorcist.js#L81)（祓魔師35/60/125） | 自分のブレス軽減10/15/20%。護法師のランク加護は最大20%で隊全員の呪文・ブレスに及ぶ。 | 護法師ランク5を借りる選択肢がある場合。軽減の併用自体には価値がある。 |
| [聖痕刻み](../src/jobkit/exorcist.js#L69)（祓魔師45/105/135/185） | 物理命中時12/17/22/27%で光耐性低下。聖水なぎ等で同程度以上の光耐性低下を既に付けた敵には、追加価値が小さい。 | 光耐性低下を確実に維持する隊。通常攻撃でMPを使わず付けられる長所は残る。 |
| 浄化（僧侶Lv45・勝利後に隊の毒・麻痺を治療） | 法力の灯（司教Lv75）は勝利後に隊の状態異常をすべて治す。毒・麻痺だけの浄化は範囲が狭い。 | どちらも借りられる1枠での比較、または法力の灯を隊が既に持つ場合。 |
| 聖域（司教Lv185） | 隊全員に異常耐性Lv1を補うが、本人の異常耐性Lv1以上とは加算されない。 | 生存する全員が異常耐性Lv1以上を持つ隊では、追加効果がない。育成途中や耐性のない味方には有効。 |
| 回復量を増やすパッシブ全般 | 割合回復・全快の `healPct` は対象の最大HPから量を決めるため、回復量倍率を増やしても増えない。回復上限に届いている低位回復でも増分が消える。 | 全快・割合回復主体に限定。通常回復には有効。 |
| 退魔の心得／悪霊退散／破魔の眼／破魔の祝詞 | 祓魔師内で不浄特効を複数の加護が担う。キャラの枠が同じ役割に寄りやすい。 | ダメージ加算・会心・被ダメ軽減・隊全体と範囲が違い、重ねれば機能する。弱いというより個性の整理候補。 |

## 7. 攻撃技の数値比較で確認した範囲

全37職をLv40/100/200・ランク2・裸/標準装備で比較。通常・低防御・高防御・高速/見切り・物理耐性75・魔法耐性75・会心率上限・金属の8条件を用いた。対象と属性が同じで、固有の追加効果を持たない後発技が、先に覚える同消費以下の技に全条件で負ける例は **0件**。既存の `tools/balance/attack-skills.mjs` のサンプル・式を使用。

この結果から、低位技が最終的に使われなくなることだけで「弱い技」とはしていない。状態異常成功率・敵種族・瀕死時の特効・命中・回復・MP吸収などの用途まで全部同じとは扱わない。全職を実戦で順位付けする評価ではない。

## 付録：複数職が同じキーで覚える共通技67件

基礎技・属性の共通技・回復/治療/蘇生・強化弱体など。共通基盤としての再使用なので、そのまま削除候補にしない。全所有職と習得Lvを示す。

| 共通技 | 習得する職・Lv |
|---|---|
| [強撃](../src/skilldefs.js#L51) | 戦士Lv1・侍Lv1・狂戦士Lv1・魔法剣士Lv1・武僧Lv1・義賊Lv1・聖戦士Lv1・魔闘士Lv1・修験者Lv1・勇者Lv1・修羅Lv1 |
| [狙い打ち](../src/skilldefs.js#L50) | 戦士Lv2・騎士Lv2・狂戦士Lv3・聖騎士Lv10・守護騎士Lv2・聖戦士Lv7・魔闘士Lv7・魔騎士Lv3・神殿騎士Lv12・審問官Lv7・修験者Lv7・竜騎士Lv3 |
| [火炎斬り](../src/skilldefs.js#L371) | 戦士Lv7・狂戦士Lv2・聖戦士Lv12・魔闘士Lv2・審問官Lv2・修羅Lv2・竜騎士Lv12 |
| [岩砕き](../src/skilldefs.js#L386) | 戦士Lv12・騎士Lv12・聖騎士Lv12・守護騎士Lv12・武僧Lv2・魔闘士Lv12・修験者Lv2 |
| [心眼撃](../src/skilldefs.js#L56) | 戦士Lv20・騎士Lv50・狂戦士Lv55・聖騎士Lv50・魔法剣士Lv20・武僧Lv55・聖戦士Lv55・審問官Lv65・修験者Lv55 |
| [紅蓮斬](../src/skilldefs.js#L373) | 戦士Lv57・狂戦士Lv57・魔法剣士Lv57・聖戦士Lv82・審問官Lv57・修羅Lv57・竜騎士Lv82 |
| [岩落とし](../src/skilldefs.js#L388) | 戦士Lv82・騎士Lv57・武僧Lv57・修験者Lv57 |
| [盾打ち](../src/skilldefs.js#L78) | 騎士Lv1・聖騎士Lv1・守護騎士Lv1・魔騎士Lv1・神殿騎士Lv1・審問官Lv1・竜騎士Lv1・護教官Lv1・灯守Lv1 |
| [挑発](../src/skilldefs.js#L79) | 騎士Lv5・聖騎士Lv20・守護騎士Lv3・魔騎士Lv12・神殿騎士Lv7・竜騎士Lv10・護教官Lv7・灯守Lv20 |
| [プロテクション](../src/skilldefs.js#L80) | 騎士Lv7・神殿騎士Lv10・護法師Lv1・枢機卿Lv10・護教官Lv10 |
| [仁王立ち](../src/skilldefs.js#L83) | 騎士Lv20・守護騎士Lv30・神殿騎士Lv30・勇者Lv55・竜騎士Lv65・護教官Lv20・灯守Lv30 |
| [光刃](../src/skilldefs.js#L391) | 騎士Lv22・聖騎士Lv2・聖戦士Lv2・神殿騎士Lv2・祓魔師Lv12・勇者Lv12・護教官Lv2 |
| [鱗壁の陣](../src/skilldefs.js#L244) | 騎士Lv30・守護騎士Lv55・竜騎士Lv50 |
| [ヒール](../src/skilldefs.js#L107) | 僧侶Lv1・司教Lv3・聖騎士Lv3・武僧Lv3・隠修士Lv3・聖戦士Lv5・神殿騎士Lv3・祓魔師Lv5・審問官Lv3・巡礼者Lv3・修験者Lv3・勇者Lv3・賢者Lv3・枢機卿Lv3・護教官Lv3・灯守Lv3 |
| [聖光](../src/skilldefs.js#L142) | 僧侶Lv3・司教Lv4・聖戦士Lv3・祓魔師Lv3・巡礼者Lv1・枢機卿Lv1 |
| [キュア](../src/skilldefs.js#L114) | 僧侶Lv5・司教Lv10・聖騎士Lv10・武僧Lv10・隠修士Lv10・聖戦士Lv10・祓魔師Lv10・審問官Lv10・巡礼者Lv5・修験者Lv10・勇者Lv10・賢者Lv10・枢機卿Lv5・護教官Lv10・灯守Lv10 |
| [キュアオール](../src/skilldefs.js#L119) | 僧侶Lv7・巡礼者Lv7・枢機卿Lv7 |
| [リカバー](../src/skilldefs.js#L115) | 僧侶Lv10・司教Lv20・聖騎士Lv20・隠修士Lv20・神殿騎士Lv20・審問官Lv20・巡礼者Lv10・賢者Lv20・枢機卿Lv10・護教官Lv20・灯守Lv20 |
| [リカバーオール](../src/skilldefs.js#L120) | 僧侶Lv17・巡礼者Lv17・枢機卿Lv17 |
| [アウェイク](../src/skilldefs.js#L116) | 僧侶Lv20・司教Lv30・隠修士Lv30・神殿騎士Lv25・祓魔師Lv20・巡礼者Lv20・勇者Lv25・賢者Lv30・枢機卿Lv20・護教官Lv30 |
| [ヒールオール](../src/skilldefs.js#L110) | 僧侶Lv25・司教Lv30・聖騎士Lv30・武僧Lv30・隠修士Lv30・聖戦士Lv30・神殿騎士Lv30・祓魔師Lv30・審問官Lv30・巡礼者Lv20・修験者Lv30・勇者Lv30・賢者Lv30・枢機卿Lv20・護教官Lv30・灯守Lv25 |
| [アウェイクオール](../src/skilldefs.js#L121) | 僧侶Lv30・祓魔師Lv25・巡礼者Lv25・枢機卿Lv25 |
| [ハイヒール](../src/skilldefs.js#L108) | 僧侶Lv30・司教Lv40・聖騎士Lv40・武僧Lv40・隠修士Lv40・聖戦士Lv40・神殿騎士Lv40・祓魔師Lv40・審問官Lv40・巡礼者Lv30・修験者Lv40・勇者Lv40・賢者Lv40・枢機卿Lv30・護教官Lv40・灯守Lv35 |
| [ストーンキュア](../src/skilldefs.js#L117) | 僧侶Lv35・司教Lv50・隠修士Lv50・神殿騎士Lv50・祓魔師Lv50・巡礼者Lv35・修験者Lv50・賢者Lv50・枢機卿Lv35・護教官Lv50 |
| [ハイヒールオール](../src/skilldefs.js#L111) | 僧侶Lv40・司教Lv60・隠修士Lv60・巡礼者Lv55・賢者Lv60・枢機卿Lv55・護教官Lv60 |
| [ストーンキュアオール](../src/skilldefs.js#L122) | 僧侶Lv45・巡礼者Lv45・枢機卿Lv45 |
| [リバイブ](../src/skilldefs.js#L125) | 僧侶Lv50・司教Lv60・聖騎士Lv60・隠修士Lv60・巡礼者Lv50・勇者Lv60・死霊術師Lv60・賢者Lv60・枢機卿Lv50・護教官Lv55 |
| [フルヒール](../src/skilldefs.js#L109) | 僧侶Lv60・司教Lv80・隠修士Lv80・巡礼者Lv60・賢者Lv80・枢機卿Lv60・護教官Lv80 |
| [ピュリファイ](../src/skilldefs.js#L118) | 僧侶Lv65・司教Lv100・隠修士Lv100・巡礼者Lv65・賢者Lv100・枢機卿Lv65・護教官Lv100 |
| [ピュリファイオール](../src/skilldefs.js#L123) | 僧侶Lv80・巡礼者Lv80・枢機卿Lv90 |
| [リザレクション](../src/skilldefs.js#L126) | 僧侶Lv95・巡礼者Lv90・死霊術師Lv100・賢者Lv90・枢機卿Lv85・護教官Lv100 |
| [フルヒールオール](../src/skilldefs.js#L112) | 僧侶Lv110・巡礼者Lv115・賢者Lv120・枢機卿Lv105・護教官Lv120 |
| [ファイアアロー](../src/skilldefs.js#L168) | 魔導士Lv1・魔法剣士Lv3・魔盗賊Lv3・魔闘士Lv3・秘術師Lv2・大魔導Lv1 |
| [アイスニードル](../src/skilldefs.js#L176) | 魔導士Lv3・司教Lv7・魔法剣士Lv10・護法師Lv10・秘術師Lv7・巡礼者Lv12・賢者Lv7・大魔導Lv7 |
| [石つぶて](../src/skilldefs.js#L192) | 魔導士Lv4・魔闘士Lv8・護法師Lv2・大魔導Lv4 |
| [かまいたち](../src/skilldefs.js#L184) | 魔導士Lv7・大魔導Lv8 |
| [シャドウボルト](../src/skilldefs.js#L200) | 魔導士Lv8・呪術師Lv2・魔盗賊Lv4・魔騎士Lv10・秘術師Lv1・死霊術師Lv2・大魔導Lv3 |
| [ファイアストーム](../src/skilldefs.js#L169) | 魔導士Lv20・魔法剣士Lv55・魔盗賊Lv30・魔闘士Lv30・秘術師Lv22・賢者Lv20・大魔導Lv20 |
| [アクアウェイブ](../src/skilldefs.js#L177) | 魔導士Lv22・呪術師Lv12・護法師Lv12・賢者Lv22 |
| [ウィンドストーム](../src/skilldefs.js#L185) | 魔導士Lv27・賢者Lv27 |
| [アースクエイク](../src/skilldefs.js#L193) | 魔導士Lv32・魔闘士Lv32・護法師Lv22・大魔導Lv22 |
| [ブリザード](../src/skilldefs.js#L179) | 魔導士Lv50・魔法剣士Lv95・呪術師Lv100・魔盗賊Lv100・護法師Lv65・秘術師Lv65・死霊術師Lv110・大魔導Lv50 |
| [盗む](../src/skilldefs.js#L260) | 盗賊Lv2・義賊Lv2・魔盗賊Lv1 |
| [浮遊](../src/skilldefs.js#L247) | 盗賊Lv7・武僧Lv12・魔盗賊Lv12 |
| [風牙](../src/skilldefs.js#L383) | 盗賊Lv57・侍Lv82・狩人Lv57・武僧Lv82・勇者Lv57・修羅Lv82・竜騎士Lv57 |
| [封魔の印](../src/skilldefs.js#L215) | 司教Lv20・魔盗賊Lv20・護法師Lv3 |
| [アイスランス](../src/skilldefs.js#L178) | 司教Lv47・呪術師Lv62・護法師Lv47・賢者Lv47 |
| [水月斬り](../src/skilldefs.js#L376) | 侍Lv2・狩人Lv2・守護騎士Lv10・義賊Lv3・祓魔師Lv2・護教官Lv12 |
| [二段斬り](../src/skilldefs.js#L54) | 侍Lv7・魔法剣士Lv7・修羅Lv3 |
| [疾風斬り](../src/skilldefs.js#L381) | 侍Lv12・暗殺者Lv7・勇者Lv2・修羅Lv7・竜騎士Lv2 |
| [渦潮斬り](../src/skilldefs.js#L377) | 侍Lv22・義賊Lv22・祓魔師Lv22 |
| [氷刃](../src/skilldefs.js#L378) | 侍Lv57・狩人Lv80・魔法剣士Lv82・義賊Lv57・祓魔師Lv57 |
| [闇刃](../src/skilldefs.js#L396) | 狂戦士Lv12・暗殺者Lv2・義賊Lv12・魔騎士Lv2 |
| [火焔なぎ](../src/skilldefs.js#L372) | 狂戦士Lv22・魔闘士Lv22・審問官Lv22・修羅Lv22 |
| [冥刃](../src/skilldefs.js#L398) | 狂戦士Lv82・暗殺者Lv57・魔騎士Lv57 |
| [黒影なぎ](../src/skilldefs.js#L397) | 暗殺者Lv22・魔騎士Lv22 |
| [ホーリーライト](../src/skilldefs.js#L143) | 聖騎士Lv17・隠修士Lv17・神殿騎士Lv17・護教官Lv17 |
| [守りの号令](../src/skilldefs.js#L85) | 聖騎士Lv55・護教官Lv30 |
| [反撃の構え](../src/skilldefs.js#L84) | 守護騎士Lv20・魔騎士Lv80 |
| [地裂撃](../src/skilldefs.js#L387) | 守護騎士Lv22・武僧Lv22・修験者Lv22 |
| [属性崩し](../src/skilldefs.js#L236) | 魔法剣士Lv30・呪術師Lv65・魔闘士Lv50・護法師Lv85・秘術師Lv30・大魔導Lv55 |
| [ダークブラスト](../src/skilldefs.js#L202) | 呪術師Lv32・魔盗賊Lv32・魔騎士Lv32・秘術師Lv47・死霊術師Lv32・大魔導Lv47 |
| [リジェネ](../src/skilldefs.js#L129) | 隠修士Lv20・巡礼者Lv17・枢機卿Lv17 |
| [ブレス](../src/skilldefs.js#L131) | 聖戦士Lv10・巡礼者Lv10・勇者Lv10 |
| [聖撃](../src/skilldefs.js#L393) | 聖戦士Lv57・祓魔師Lv82・勇者Lv65 |
| [魔除けの帳](../src/skilldefs.js#L245) | 護法師Lv20・秘術師Lv55・賢者Lv55 |
| [烈風斬](../src/skilldefs.js#L382) | 勇者Lv22・竜騎士Lv22 |

## 対象外・互換定義

習得表にない技：`GOURAI`、`SUIJAKU`、`PRIEST_GOKOU`。旧データ互換や未使用定義を、現在覚えるキャラの弱い枠として数えていない。パッシブの旧別名（希望の陽だまりの旧キーなど）も、独立した効果として重複件数に加えていない。

技の名前や効果を変える際は既存キーを維持し、保存済みのサブ魂・図鑑・習得枠との互換を保つ必要がある。

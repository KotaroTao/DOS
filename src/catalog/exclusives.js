// 職業専用装備カタログ (id prefix: x_)
// 通常の lootLv 抽選テーブルには含まれず、chestContents の専用レイヤーでのみ出現する。
// exclusive: true — LOOT_IDS から除外するフラグ
// forJob: clsKey — 出現判定・重み計算に使う職業キー (classes[] と同じ値)
// ドロップ解禁ランク: コモン=迷宮ランク3+ / レア=5+ / エピック=7+ / レジェンド=9+
// 出現率: BASE_RATE(1/500) × 宝箱ランク (chestContents 側で抽選)
import { W, S, A, H, G } from "./defs.js";

function excl(item, forJob) { item.exclusive = true; item.forJob = forJob; return item; }

// ===== コモン (lv 115-130 / 迷宮ランク3+) =====
const C = [
  excl(W("x_fighter_ax", "魂砕きの戦斧", "ax", 120, {
    cls: ["fighter"], atk: 163,
    desc: "無数の魂を喰らい続けた戦斧。刃毀れひとつなく、振るうたびに空気が鈍い悲鳴をあげる。戦士の手の中にだけ、柄が馴染む。",
  }), "fighter"),
  excl(S("x_knight_shield", "鉄壁の誓い盾", 115, {
    cls: ["knight"], def: 33, hp: 30, eDef: ["light", 1],
    desc: "落とした仲間の紋章を鎧に打ち直した盾。見捨てない、という誓いが金属を硬化させている。騎士の腕にしか嵌らない重さだ。",
  }), "knight"),
  excl(W("x_priest_staff", "癒しの聖錫杖", "st", 118, {
    cls: ["priest"], pie: 9, mp: 16,
    desc: "巡礼の途中で息絶えた老僧が握り続けた錫杖。環は鳴るたびに痛みを一粒ずつ吸い取り、持ち主の信仰を呼び水に周囲を癒す。",
  }), "priest"),
  excl(W("x_mage_staff", "秘紋の魔杖", "st", 125, {
    cls: ["mage"], int: 9, mp: 17,
    desc: "失われた語で記された呪文式が螺旋状に刻まれた杖。魔術師の手に触れると式が自走し始め、詠唱より先に魔力が集まる。",
  }), "mage"),
  excl(W("x_thief_dagger", "影縫いの短刀", "dg", 122, {
    cls: ["thief"], atk: 112, agi: 5, luk: 5,
    desc: "鋳造時に暗殺者の血を混ぜたと伝わる細身の刃。盗賊の手首に沿ってするりと消え、気づかれるより先に急所へ届く。",
  }), "thief"),
  excl(W("x_bishop_staff", "二理の法杖", "st", 128, {
    cls: ["bishop"], int: 8, pie: 7, mp: 18,
    desc: "攻術と癒術の術式を一本の杖に縫い合わせた異形の法具。司教のみが二つの流れを同時に御せると伝えられる。",
  }), "bishop"),
];

// ===== レア (lv 140-158 / 迷宮ランク5+) =====
const R = [
  excl(W("x_samurai_sword", "菊一文字", "kt", 155, {
    cls: ["samurai"], atk: 191, crit: 4,
    desc: "一振りに菊紋を刻む刀鍛冶が百夜の断食の果てに打ち上げた極刀。刃紋は月光の下でのみ見え、侍の手に渡ったその夜から斬れぬものがなくなると語り継がれる。",
  }), "samurai"),
  excl(W("x_berserker_hammer", "壊神の鉄槌", "mc", 150, {
    cls: ["berserker"], two: true, atk: 240, hp: 30,
    desc: "神話の時代に世界の礎石を砕いたと伝わる両手槌。狂戦士以外には指一本触れられず、近づくだけで耳の奥に破壊の衝動が響く。",
  }), "berserker"),
  excl(W("x_hunter_bow", "千里の猟弓", "bw", 145, {
    cls: ["hunter"], atk: 156, eAtk: ["wind", 1], agi: 6,
    desc: "弓身を削り出した木が嵐で倒れた霊樹だと伝わる長弓。弦を引くと風が自ら矢を捕まえ、千里の先まで精確に届けるという。",
  }), "hunter"),
  excl(W("x_shadow_dagger", "宵闇の短刀", "dg", 148, {
    cls: ["shadow"], atk: 134, eAtk: ["dark", 1], agi: 6, luk: 6,
    desc: "黄昏時にしか鍛えられない闇鉄の短刀。暗殺者の手に握られると刀身が周囲の影を喰い、持ち主の輪郭を曖昧にする。",
  }), "shadow"),
  excl(W("x_paladin_sword", "聖典の剣", "ls", 152, {
    cls: ["paladin"], atk: 177, eAtk: ["light", 1], pie: 7,
    desc: "聖典の最後の頁に記された武装の形をそのまま鍛えた剣。聖騎士が手にすると剣から経文が溢れ、不浄をことごとく焼く。",
  }), "paladin"),
  excl(S("x_guardian_shield", "岩壁の大盾", 142, {
    cls: ["guardian"], def: 40, hp: 60,
    desc: "山の一枚岩を鎧職人が十年がかりで成形した盾。守護騎士の腕に収めると岩が脈打ち始め、どんな衝撃もその震えの中に溶ける。",
  }), "guardian"),
  excl(W("x_spellblade_sword", "魔導の太刀", "kt", 156, {
    cls: ["spellblade"], atk: 192, eAtk: ["dark", 1], int: 8,
    desc: "術式を刀身に焼き付けた魔法剣士の専用刀。斬撃と同時に呪文が走り、斬られた傷口から魔力が流出して二重に蝕む。",
  }), "spellblade"),
  excl(G("x_monk_gauntlet", "金剛手甲", 145, {
    cls: ["monk"], shape: "gauntlet", def: 26, atkB: 22,
    desc: "千人の敵を素手で屠った武僧の手の型を、熟練の鍛冶が金属に写し取った手甲。武僧が嵌めると筋が指先まで金剛石と化す。",
  }), "monk"),
  excl(W("x_hexer_staff", "呪縛の杖", "st", 148, {
    cls: ["hexer"], eAtk: ["dark", 1], int: 10, mp: 18,
    desc: "縛りの儀式で使われた骨の数珠を頭部に巻いた呪術師の杖。触れた瞬間から呪術師の夢を見始め、手放せなくなると伝わる。",
  }), "hexer"),
  excl(A("x_hermit_robe", "山神の衣", 150, {
    cls: ["hermit"], shape: "robe", def: 27, int: 5, pie: 8, agi: 4,
    desc: "山岳の霊地で隠修士が独り縫い続けた衣。山神の加護が糸目に宿り、着た者の六感を研ぎ澄ませ、修行の境地を底上げする。",
  }), "hermit"),
  excl(W("x_brigand_sword", "義賊の刀", "kt", 145, {
    cls: ["brigand"], atk: 179, luk: 6,
    desc: "富者から奪い貧者に返すを誓った義賊が最後の夜に砥いだ刀。狙った獲物から逃げ場を奪う嗅覚が刃の中に宿っている。",
  }), "brigand"),
  excl(W("x_arcthief_dagger", "魔盗の短剣", "dg", 152, {
    cls: ["arcthief"], atk: 138, eAtk: ["dark", 1], int: 6, luk: 7,
    desc: "呪禁の金庫から盗み出した短剣を魔術で再鍛した業物。魔盗賊の手に収まると錠前を見ただけで開く感覚が指先に宿る。",
  }), "arcthief"),
];

// ===== エピック (lv 165-180 / 迷宮ランク7+) =====
const E = [
  excl(W("x_crusader_sword", "聖戦の大剣", "ls", 175, {
    cls: ["crusader"], atk: 203, eAtk: ["light", 1], pie: 9,
    desc: "聖戦を布告した教団の旗手が討ち死にの間際に戦場に突き立てた剣。光を含む大気が刃に沿って集まり、悪しきものを焼く。",
  }), "crusader"),
  excl(W("x_battlemage_sword", "魔闘の刃", "ls", 170, {
    cls: ["battlemage"], atk: 198, int: 10,
    desc: "魔闘士の型稽古で千万回振るわれた剣が自ら術式を憶えた剣。斬るたびに軌跡が淡く光り、次の呪文の詠唱を先取りする。",
  }), "battlemage"),
  excl(W("x_darkknight_sword", "冥騎の黒剣", "ls", 172, {
    cls: ["darkknight"], atk: 200, eAtk: ["dark", 1], vit: 9,
    desc: "冥府の鉄を精錬して打った黒剣。魔騎士の手の熱で刃が常温より低く保たれ、傷口の癒えを阻む冥気を放ち続ける。",
  }), "darkknight"),
  excl(W("x_templar_spear", "神殿の聖槍", "sp", 168, {
    cls: ["templar"], atk: 203, eAtk: ["light", 1], vit: 8,
    desc: "神殿騎士の奉仕誓約の際に授けられる儀礼槍の完全武装版。光を通さない迷宮の奥でも穂先だけが自ら明るく輝く。",
  }), "templar"),
  excl(W("x_exorcist_sword", "祓魔の刃", "ls", 170, {
    cls: ["exorcist"], atk: 198, eAtk: ["light", 1], agi: 8,
    desc: "祓魔師が百の悪霊を封じ込めながら鍛えた逆説の剣。悪霊は自分を封じた刃に二度と触れられず、刃は不浄に触れるたびに速度を増す。",
  }), "exorcist"),
  excl(A("x_warden_robe", "護法の法衣", 165, {
    cls: ["warden"], shape: "robe", def: 30, eDef: ["dark", 1], int: 11, pie: 10, mp: 20,
    desc: "法護師が生涯かけて記した護符を布地に縫い込んだ法衣。着た者の周囲に不可視の結界が張られ、呪詛の侵入を一段ずつ弾く。",
  }), "warden"),
  excl(W("x_arcanist_staff", "秘術の大杖", "st", 178, {
    cls: ["arcanist"], int: 14, mp: 24,
    desc: "秘術師の全生涯の研究が凝縮された術式が心材に封印されている大杖。握った者の思考速度が術式の流れに引き上げられる。",
  }), "arcanist"),
  excl(W("x_inquisitor_hammer", "審問の鉄槌", "mc", 167, {
    cls: ["inquisitor"], atk: 214, pie: 10,
    desc: "異端審問の場で何百もの罪を断罪した審問官の鉄槌。罪ある者の前では頭が垂れ、打ち下ろした瞬間に罪の重さが上乗せされると伝わる。",
  }), "inquisitor"),
  excl(H("x_archbishop_crown", "大司教の宝冠", 170, {
    cls: ["archbishop"], shape: "circlet", def: 33, eDef: ["dark", 1], pie: 12, mp: 18,
    desc: "三十年にわたり祈祷を続けた大司教が臨終前夜に遺した黄金冠。戴けば夢の中で過去の大司教たちの祈りが聞こえ始める。",
  }), "archbishop"),
  excl(A("x_ascetic_robe", "修験の袈裟", 167, {
    cls: ["ascetic"], shape: "robe", def: 28, hp: 55, atkB: 10,
    desc: "断崖の滝に打たれながら百夜の苦行を終えた修験者が手縫いした袈裟。苦しみが布に記憶され、着た者の痛覚の閾値を引き上げる。",
  }), "ascetic"),
];

// ===== レジェンド (lv 186-200 / 迷宮ランク9+) =====
const L = [
  excl(S("x_hero_shield", "勇者の神盾", 192, {
    cls: ["hero"], shape: "round", def: 52, eDef: ["light", 1], hp: 90, luk: 6,
    desc: "勇者のみが持てると伝わる神代の盾。掲げれば盾面に仲間の顔が映り、守るべき者を思い出すたびに盾は少しずつ固くなる。",
  }), "hero"),
  excl(G("x_asura_gauntlet", "阿修羅手甲", 198, {
    cls: ["asura"], shape: "gauntlet", def: 34, atkB: 32, agi: 9,
    desc: "阿修羅の六本の腕のうち二本を人の腕に変えたと伝わる手甲。装備すると二本目の腕の感覚が幻のように宿り、斬撃が五回に増える。",
  }), "asura"),
  excl(A("x_dragonknight_mail", "竜騎士の竜甲冑", 195, {
    cls: ["dragonknight"], def: 68, eDef: ["fire", 1], hp: 110,
    desc: "長命の竜が脱皮した鱗を鍛えた鎧。鱗は主を選び、竜騎士の背に添うと古い竜の記憶が流れ込み、炎の中に恐怖を感じなくなる。",
  }), "dragonknight"),
  excl(W("x_necromancer_staff", "死霊術師の秘典", "st", 188, {
    cls: ["necromancer"], eAtk: ["dark", 2], int: 14, mp: 22,
    desc: "死者の名前を全頁に記し続けた秘典が腐りきる前に杖として固まったもの。握れば過去に術師が呼び出した死者の声が聞こえる。",
  }), "necromancer"),
  excl(A("x_sage_robe", "賢者の法衣", 190, {
    cls: ["sage"], shape: "robe", def: 32, eDef: ["light", 1], int: 12, pie: 16, mp: 26,
    desc: "千年の間に七人の賢者が着継いだ法衣。各代の賢者の知識が染みとなって残り、新たな着手の思考に折り重なって語りかける。",
  }), "sage"),
  excl(H("x_cardinal_crown", "枢機卿の宝冠", 186, {
    cls: ["cardinal"], shape: "circlet", def: 37, eDef: ["light", 1], pie: 16, mp: 20, hp: 45,
    desc: "教国の頂点に立つ枢機卿のみが戴ける聖冠。冠に触れた者の祈りは余さず神に届くと言われ、奇跡の発動が一段速くなる。",
  }), "cardinal"),
  excl(W("x_archmage_staff", "大魔導の神杖", "st", 200, {
    cls: ["archmage"], eAtk: ["dark", 2], int: 16, mp: 28,
    desc: "世界に三本しか作られなかった神杖のうち、現存する唯一の一本。握った者の脳裏に宇宙の術式が投影され、思うだけで魔力が形を取る。",
  }), "archmage"),
  excl(A("x_chaplain_plate", "護教官の鎧", 195, {
    cls: ["chaplain"], def: 68, eDef: ["light", 1], hp: 90, pie: 10,
    desc: "護教官の証として代々受け継がれる鎧。前の着手の信仰が染み付いており、危機に瀕した瞬間に背後から誰かに背中を押される感覚がある。",
  }), "chaplain"),
];

export const EXCLUSIVES = [...C, ...R, ...E, ...L];

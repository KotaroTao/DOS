import { AIL_RESIST_KINDS } from "../resistance.js";

// 個体の体・習性・戦い方に合わせた台帳。列は弱点、耐性、無効、属性弱点、属性耐性、やや弱点。
// 空欄の状態異常は基礎値。種族・説明文・IDのハッシュからは補わない。
const list = s => s ? s.split(" ") : [];
const D = "poison sleep death"; // 死んだ肉・骨
const G = "poison paralyze sleep death stone"; // 実体のない魂
const M = "poison sleep charm death stone"; // 石・金属の器
function p(weak, strong, immune, elemWeak, elemResist, slight = "") {
  const resistTiers = Object.fromEntries(AIL_RESIST_KINDS.map(k => [k, "base"]));
  const seen = new Set();
  for (const [tier, kinds] of [["weak", weak], ["strong", strong], ["imm", immune], ["slight", slight]]) {
    for (const k of list(kinds)) {
      if (!(k in resistTiers) || seen.has(k)) throw new Error(`体質の種類が不正または重複: ${k}`);
      seen.add(k); resistTiers[k] = tier;
    }
  }
  return { resistTiers, affinity: { weak: list(elemWeak), resist: list(elemResist) } };
}

export const MONSTER_TEMPERAMENTS = {
  bs_dustroach: p("sleep", "", "", "fire", ""),
  bs_littlecentipede: p("sleep", "", "", "fire", ""),
  bs_woodbee: p("sleep", "", "", "wind", ""),
  // 序章・宝箱の魔物
  slime: p("poison", "paralyze flinch", "charm", "fire", "water"), // 毒が粘体全体に回る
  bat: p("paralyze sleep", "confuse", "", "light", "dark"), // 羽を止めると落ちる
  kobold: p("sleep charm", "poison", "", "fire", ""), // 臆病で手なずけやすい小鬼
  mimic: p("sleep", "poison confuse", "", "fire", "earth", "flinch"), // 待ち伏せ中は眠りやすい生体
  master_mimic: p("paralyze", "sleep charm confuse", "", "water", "earth light", "seal"), // 箱の王は眠りへの警戒が強い
  skeleton: p("seal flinch", "confuse charm", D, "light fire", "dark"), // 古い骨を支える呪い
  orc: p("sleep confuse", "flinch", "", "water", "earth"), // 力任せで判断が鈍い戦士
  wraith: p("seal", "confuse flinch", G, "light", "dark earth"), // 肉を持たない怨念
  dragon: p("sleep", "charm confuse", "", "water", "fire", "seal"), // まだ若く眠りやすい竜
  // 序章から使う共通種・初期の固有種
  cm_slime: p("poison", "paralyze flinch", "charm", "fire light", "water", "seal"), // 湿気と腐肉の粘塊
  cm_bat: p("paralyze", "sleep confuse", "", "light fire", "dark", "flinch"), // 闇を糧に飛ぶ翼
  cm_spider: p("sleep flinch", "paralyze poison charm", "", "fire wind", "earth", "confuse"), // 麻痺毒に慣れた巣の主
  cm_caverat: p("sleep", "poison confuse", "", "fire light", "dark", "seal charm"), // 臆病で仲間を呼ぶ鼠
  d01_kobold: p("sleep charm", "poison", "", "fire", "earth", "flinch"), // 犬頭の臆病な小鬼
  d01_gaoler: p("confuse", "sleep poison", "", "wind water", "earth", "seal charm"), // 番の命令に固執する巨漢
  d02_armkobold: p("charm", "flinch sleep", "", "fire water", "earth", "confuse paralyze"), // 生きた小鬼の継ぎ接ぎ鎧
  d02_harpy: p("paralyze charm", "sleep", "", "fire", "wind", "confuse"), // 飾りを好む鳥の心
  d02_imp: p("paralyze flinch", "charm confuse", "", "water light", "fire dark", "sleep"), // 飛び回る下級魔
  d02_lizard: p("sleep", "poison flinch", "", "water wind", "earth", "paralyze"), // 冷えた硬鱗の待ち伏せ
  d02_lord: p("charm", "seal confuse", G, "light fire", "dark", ""), // 忠誠を求める城主の未練
  d03_whelp: p("sleep confuse", "charm", "", "water", "fire", "seal paralyze"), // ふ化したばかりの柔らかい竜
  d04_vritra: p("sleep", "seal charm confuse", "", "light water", "dark earth", "paralyze"), // 英雄の骸をしとねに眠る古竜
  bs_goblin: p("charm sleep", "poison", "", "fire", "", "confuse"), // 財布に目を奪われる小鬼
  bs_slimeking: p("seal", "poison paralyze confuse", "sleep charm death", "fire earth", "water", ""), // 多数の粘塊を束ねる王の意思
  bs_direwolf: p("sleep", "confuse", "", "fire", "wind", "paralyze flinch"), // 帰り道を断つ生きた大狼
  bs_goblinchief: p("charm", "sleep confuse", "", "water", "fire earth", "seal"), // 戦利品を好む族長
  // 第1層・墓地
  bs_gravewisp: p("seal", "confuse flinch", G, "light water", "dark"), // 揺らめく鬼火を封じる
  bs_grasphand: p("flinch", "paralyze charm", D, "fire light", "earth", "seal"), // 腐手は掴む前に払う
  bs_mournshade: p("charm seal", "flinch", G, "light", "water dark"), // 嘆く心は慰めに揺れる
  bs_corpsemaggot: p("sleep flinch", "poison charm", "", "fire", "dark", "paralyze"), // 屍を食うがウジ自身は生きている
  bs_carrioncrow: p("paralyze", "poison confuse", "", "fire light", "wind", "sleep"), // 腐肉に慣れた賢い鳥
  bs_ghoul: p("sleep charm", "poison flinch", "death", "light fire", "dark"), // 飢えに心を奪われた肉の鬼
  bs_bonepile: p("seal", "paralyze flinch confuse", D, "light wind", "earth", "charm"), // 骨山の結び目を封じる
  bs_skullswarm: p("confuse", "flinch charm", D, "light fire", "dark", "seal paralyze"), // 群れの連携を乱す
  bs_sarcoguard: p("paralyze", "flinch confuse", M, "wind", "earth", "seal"), // 石の関節を止める
  bs_weepangel: p("seal", "paralyze flinch", M, "wind dark", "earth light", "confuse"), // 嘆きの声を封じる
  bs_pettyrevenant: p("confuse", "charm flinch", G, "light", "dark", "seal"), // 新しい恨みは方向を失いやすい
  bs_shroudstrangler: p("seal flinch", "charm", G, "fire light", "dark"), // 死装束の結びを解く
  bs_bonebat: p("paralyze flinch", "confuse", D, "light wind", "dark", "seal"), // 脆い骨の翼
  bs_spiritbat: p("seal", "charm flinch", G, "light fire", "dark water", "confuse"), // 冷たい霊の羽ばたき
  bs_tombwarden: p("paralyze", "flinch confuse charm", D, "light wind", "earth dark", "seal"), // 重い具足と固い命令
  bs_zombie: p("flinch", "paralyze charm confuse", D, "fire light", "water dark", "seal"), // 腐肉を怯ませて再生を遅らせる
  d01_skeleton: p("seal flinch", "charm", D, "light wind", "dark", "confuse"), // 看守を取り違える古い怨み
  d02_soldier: p("seal", "flinch charm", D, "light fire", "earth dark", "paralyze"), // 持ち場に縛られた兵
  bs_bonechanter: p("seal flinch", "confuse charm", D, "light", "dark", "paralyze"), // 祈りを止めれば骨も止まる
  bs_gravecaller: p("seal", "charm", G, "light wind", "dark", "confuse flinch"), // 土の下へ届く語り声
  bs_cryptabbot: p("seal", "confuse charm", D, "light fire", "dark", "paralyze"), // 埋葬の祈りで骨を継ぐ
  el_cryptlord: p("seal", "flinch confuse charm", D + " stone", "light wind", "earth dark", "paralyze"), // 石化した骨の君主
  el_palebutcher: p("sleep", "paralyze flinch poison", "", "fire", "earth", "confuse"), // 恐怖には慣れても眠りは防げない
  // 第2層・地下水路
  bs_giantleech: p("poison sleep", "flinch", "", "fire earth", "water", "paralyze"), // 吸血で毒も取り込む
  bs_sludgeooze: p("seal", "poison paralyze flinch", "sleep charm", "fire light", "water earth", "confuse"), // 毒泥の意思だけを封じる
  bs_toxictoad: p("sleep paralyze", "poison", "", "earth", "water", "flinch"), // 毒腺を持つ柔らかい蛙
  bs_drownedcorpse: p("seal", "paralyze flinch", D, "light fire", "water", "confuse"), // 溺死の恨みを鎮める
  bs_eelfiend: p("sleep", "paralyze poison", "", "earth", "water wind", "flinch"), // 帯電した牙はしびれに強い
  bs_sewercrab: p("paralyze", "poison flinch", "", "earth", "water", "sleep"), // 殻よりも脚を狙う
  bs_abysstentacle: p("sleep", "paralyze flinch charm", "", "earth light", "water dark", "poison"), // 触手の奥の本体を眠らせる
  bs_brinewraith: p("seal charm", "flinch", G, "light earth", "water", "confuse"), // 水夫の未練が残る
  bs_anglerfiend: p("paralyze", "charm confuse", "", "earth light", "water dark", "sleep"), // 誘い灯の術に惑わされない
  bs_bloatfly: p("paralyze", "poison sleep charm", "", "fire wind", "dark", "confuse"), // 毒粉を運ぶ羽を止める
  bs_waterhag: p("charm", "seal confuse", G, "light earth", "water dark", "flinch"), // 妖婆の執着をそらす
  bs_mucusworm: p("sleep", "poison paralyze flinch", "", "fire earth", "water", "seal"), // 毒の粘膜で衝撃を逃がす
  bs_razorshrimp: p("paralyze flinch", "confuse", "", "earth", "water wind", "sleep"), // 鎌を振るう前に止める
  bs_ironcarp: p("sleep", "poison flinch paralyze", "", "earth light", "water", "confuse"), // 古い鯉は丈夫だがまどろむ
  bs_fogspecter: p("seal", "confuse flinch", G, "wind light", "water dark", "charm"), // 汚水のまどろみを散らす
  bs_waterelemental: p("seal", "paralyze flinch", "poison sleep death", "earth", "water fire", "confuse"), // 水の形を保つ魔力
  d03_sahagin: p("paralyze", "poison confuse", "", "earth light", "water", "sleep charm"), // 水の震えで狩る魚人
  bs_deepsahagin: p("sleep", "paralyze poison", "", "earth light", "water dark", "confuse"), // しびれ毒に慣れた深海の変種
  bs_ratking: p("sleep confuse", "poison", "", "fire light", "dark", "flinch"), // 多くの頭の判断を乱す
  bs_sewerdredger: p("seal flinch", "paralyze charm", D, "light earth", "water", "confuse"), // 鐘に従う人夫の骸
  bs_sewerlord: p("paralyze", "poison sleep confuse", "", "earth light", "water dark", "seal"), // 厚い粘膜と汚水への適応
  el_bloatqueen: p("poison", "sleep flinch", "", "fire earth", "water", "seal paralyze"), // 子を産む女王は眠りにくい
  el_drownedpaladin: p("seal", "flinch charm confuse", D, "light earth", "water", "paralyze"), // 祈りが引き起こす聖騎士
  // 第3層・廃坑
  bs_rockworm: p("sleep", "poison flinch charm", "", "wind", "earth", "paralyze"), // 固い体節の内側を眠らせる
  bs_dustwraith: p("seal", "flinch confuse", G, "wind light", "earth dark", "charm"), // 粉塵の渦を散らす
  bs_crystalcrawler: p("paralyze", "seal flinch poison", "stone", "wind", "earth light", "sleep"), // 水晶の守りの外にある脚
  bs_blastsprite: p("confuse", "seal flinch", "poison sleep death", "water", "fire earth", "paralyze"), // 不安定なガスの精
  bs_orehulk: p("paralyze", "flinch confuse", M, "water wind", "earth fire", "seal"), // 熱い鉱くずの重い関節
  bs_tunneler: p("sleep", "confuse flinch", "", "wind", "earth", "paralyze"), // 盲目の掘り手は休眠する
  d03_orc: p("confuse", "sleep flinch poison", "", "water light", "earth dark", "paralyze"), // 痛みを忘れた狂戦士
  bs_gargoyle: p("paralyze", "seal flinch", M, "wind dark", "earth light", "confuse"), // 魔を払う石の翼
  bs_stonegorgon: p("seal", "confuse charm", G, "wind light", "earth", "flinch"), // 石に変える凝視を封じる
  bs_shieldogre: p("confuse", "flinch sleep", "", "wind", "earth", "poison"), // 誇り高い盾役は惑わされる
  d03_mandrake: p("seal flinch", "poison confuse charm", "", "fire wind", "earth dark", "sleep"), // 毒草の絶叫を止める
  bs_troll: p("flinch sleep", "paralyze", "", "fire", "earth water", "poison"), // 振りかぶる腕と火に弱い再生
  bs_deepgolem: p("seal", "paralyze flinch confuse", M, "wind", "earth fire"), // 基礎石に染みた古い呪文
  d04_golem: p("paralyze", "flinch confuse", M, "wind", "earth dark", "seal"), // 墓をかばう石の番人
  d04_ogre: p("sleep confuse", "poison flinch", "", "fire light", "dark", "charm"), // 屍肉で肥えた鈍い巨人
  bs_steelspider: p("seal", "paralyze flinch", M, "water", "earth", "confuse"), // 鋼糸の機構はしびれに強い例外
  bs_chainedconvict: p("confuse seal", "flinch", D, "light wind", "earth", "paralyze"), // 生者を岩と見誤る罪人
  bs_minebat: p("paralyze sleep", "poison", "", "light wind", "dark", "flinch"), // 血をすする大きな翼
  bs_koboldsapper: p("charm", "sleep confuse", "", "wind", "earth", "paralyze"), // 坑道を熟知した働き者
  bs_timbermite: p("sleep flinch", "poison charm", "", "fire", "earth", "confuse"), // 酸を吐く虫の群れ
  bs_minelord: p("seal", "paralyze confuse", M, "wind water", "earth dark"), // 岩を寄せ集める闇を封じる
  el_chainoverseer: p("seal", "flinch charm", D, "light wind", "earth", "confuse paralyze"), // 怒号と号令を断つ
  el_crystalseer: p("flinch", "seal sleep", "stone", "wind dark", "earth light", "paralyze"), // 半分は人のままの錬金術師
  // 第4層・捨て砦
  bs_siegeballista: p("paralyze", "flinch confuse", M, "fire water", "earth", "seal"), // 木の枠と鉄の駆動部
  bs_bannerwraith: p("seal", "confuse", G, "fire light", "wind dark", "charm flinch"), // 軍旗を振る号令
  bs_gravecaptain: p("confuse", "flinch", M, "light water", "earth", "seal paralyze"), // 果たせなかった指揮への固執
  bs_pikewall: p("confuse seal", "flinch", D, "fire light", "earth", "paralyze"), // 個々の骨より陣形を乱す
  bs_drumwraith: p("seal", "charm flinch", G, "light wind", "dark", "confuse"), // 太鼓の響きを止める
  bs_darksamurai: p("paralyze", "confuse flinch", M, "light", "dark", "seal"), // 抜刀の関節を止める
  bs_bloodorc: p("sleep", "poison flinch", "", "water", "fire dark", "confuse"), // 狂乱も眠れば収まる
  bs_cultist: p("seal", "confuse charm", G, "light", "dark", "flinch"), // 禁忌の神とのつながり
  d03_ghost: p("charm seal", "flinch", G, "light fire", "dark water", "confuse"), // 温もりを求める魂
  bs_banshee: p("seal", "confuse charm", G, "light wind", "dark", "flinch"), // 恐怖を運ぶ絶叫
  d03_sentinel: p("paralyze", "flinch confuse", M, "dark water", "light earth", "seal"), // 中空の鎧を動かす誓い
  bs_dullahan: p("seal", "flinch confuse", M, "light fire", "dark", "paralyze"), // 小脇の首のささやきを封じる
  bs_ironknight: p("paralyze", "flinch confuse seal", M, "water", "earth fire"), // 命令だけで動く鉄人形
  bs_shadowmage: p("seal", "confuse", G, "light wind", "dark", "flinch"), // 肉体を失った術師の影
  bs_bloodwraith: p("seal", "flinch charm", G, "light fire", "dark water", "confuse"), // 血を集める霊力
  bs_bonecolossus: p("confuse", "flinch paralyze", D, "light wind", "earth dark", "seal"), // 多数の骨の意志を乱す
  bs_stormgiant: p("sleep", "paralyze flinch", "", "fire earth", "wind water", "seal"), // 雷雲をまとう肉の巨人
  d04_revenant: p("paralyze", "seal flinch confuse", M, "dark water", "light"), // 魔を散らす聖光の鎧
  bs_thunderknight: p("seal", "paralyze flinch confuse", M, "earth fire", "wind"), // すでに雷を宿した鎧
  bs_vampire: p("seal", "charm poison sleep", "death", "light fire", "dark", "paralyze"), // 夜の貴族は心を読ませない
  bs_fortlord: p("seal", "confuse", M, "light water", "earth dark", "paralyze"), // 退却の許しを待つ将
  el_warbanner: p("confuse", "flinch paralyze", M, "water light", "fire dark", "seal"), // 攻めることに固執する亡将
  el_headsman: p("paralyze", "sleep flinch", "", "wind water", "earth", "confuse"), // 眠りに警戒する速い処刑人
  // 第5層・霧の森
  bs_misttreant: p("poison", "flinch confuse charm", "", "fire", "wind earth", "seal"), // 乾いた木の芯と生きた樹液
  bs_dryadfey: p("seal", "charm confuse", "", "fire dark", "wind light", "sleep"), // 歌い分ける森の妖
  bs_giantmoth: p("paralyze", "sleep charm", "", "fire", "wind", "confuse"), // 眠りの粉を運ぶ羽
  bs_stranglevine: p("flinch", "paralyze poison charm", "", "fire wind", "earth", "seal"), // 伸びる蔦を切り払う
  bs_corruptstag: p("flinch", "sleep confuse", "", "fire light", "wind dark", "paralyze"), // 上位の獣は眠りに強い
  bs_fungalhulk: p("seal", "poison paralyze flinch charm", "", "fire wind", "earth water", "sleep"), // 胞子で再生する菌の巨体
  bs_thunderbird: p("seal", "paralyze sleep", "", "earth fire", "wind", "confuse"), // 落雷の術を止める
  bs_chimera: p("confuse", "sleep poison flinch", "", "water light", "fire dark", "seal"), // 憎み合う三つの頭
  bs_griffon: p("paralyze", "sleep confuse", "", "fire", "wind earth", "charm"), // 空の王は眠りにくい
  bs_stonegazer: p("sleep", "poison charm", "stone", "wind water", "earth", "seal"), // 凝視を眠りで止める
  bs_giantowl: p("paralyze", "sleep confuse", "", "fire light", "wind dark", "flinch"), // 夜を狩る梟は眠りに強い
  bs_direboar: p("sleep", "flinch poison", "", "wind water", "earth", "confuse"), // 狂った突進を眠りで止める
  bs_willowwitch: p("seal", "charm confuse", "", "fire", "wind water", "poison"), // 枝上の呪文を封じる
  bs_sporezombie: p("seal", "flinch paralyze charm", D, "fire wind", "earth water", "confuse"), // 菌糸に動かされる亡骸
  bs_thornhound: p("sleep", "confuse poison", "", "fire", "earth", "paralyze"), // 茨の内側は痩せた獣
  bs_wisplure: p("seal", "confuse flinch", G, "light fire", "wind dark", "charm"), // 方角を惑わす群火
  bs_satyrpiper: p("seal charm", "sleep confuse", "", "fire", "wind", "paralyze"), // 角笛を止めて獣を鎮める
  bs_flytrap: p("sleep", "poison charm confuse", "", "fire wind", "earth water", "flinch"), // 捕虫葉の口を閉じさせる
  bs_mossgolem: p("seal", "paralyze flinch confuse", M, "fire wind", "earth water"), // 苔の再生を封じる岩
  bs_fogpanther: p("seal", "sleep flinch", "", "fire light", "wind dark", "paralyze"), // 霧に溶ける上位の豹
  bs_forestlord: p("seal", "confuse charm", "", "fire", "wind earth", "poison"), // 霧の大呪を封じ、木を焼く
  el_mistmother: p("seal", "paralyze poison sleep charm", "", "fire", "wind water", "flinch"), // 繭を呼ぶ女王は毒に慣れる
  el_eldertreant: p("poison", "sleep flinch confuse charm", "", "fire wind", "earth", "seal"), // 古木の樹液を毒で枯らす
  // 第6層・水没神殿
  bs_drownedpriest: p("seal", "charm confuse", G, "light earth", "water", "flinch"), // 祈りと経文を止める
  bs_fonthorror: p("paralyze", "poison flinch", "", "earth light", "water dark", "seal sleep"), // 腐った聖水で再生する肉
  bs_choirwraith: p("seal", "confuse flinch", G, "light wind", "water", "charm"), // 多重の聖歌を封じる
  bs_idolguardian: p("paralyze", "flinch seal", M, "wind dark", "earth water light", "confuse"), // 守りの文字を刻んだ四本腕
  bs_abyssjelly: p("paralyze", "confuse flinch", "", "earth fire", "water", "sleep"), // 灯りを惑わす柔らかい傘
  bs_tidecaller: p("seal", "confuse charm", G, "earth light", "water dark", "flinch"), // 潮を呼ぶ忘れられた祈り
  bs_kelpdrowned: p("confuse", "paralyze flinch", D, "fire light", "water", "seal"), // 藻に縛られた群れの方向を乱す
  bs_sunkenbell: p("seal", "paralyze flinch", M, "earth wind", "water light", "confuse"), // しびれる鐘音は封じて止める
  bs_naga: p("sleep", "poison charm", "", "earth light", "water dark", "seal paralyze"), // 蛇神の毒を扱う生きた巫女
  bs_goldgolem: p("paralyze", "flinch confuse", M, "water dark", "earth light", "seal"), // 重い黄金の拳
  bs_soulharvester: p("seal", "confuse charm", G, "light fire", "dark", "flinch"), // 籠へ魂をくべる刈り手
  d04_grudge: p("charm", "seal flinch", G, "light earth", "dark water", "confuse"), // 黄金への執着をそらす
  bs_shadowdragon: p("paralyze", "sleep flinch confuse", "", "earth light", "water dark", "seal"), // 荒れ狂う海竜は眠りにくい
  bs_crystalgolem: p("seal", "paralyze flinch", M, "wind dark", "earth light", "confuse"), // 結晶の芯へ魔力がひびを入れる
  bs_irongolem: p("seal sleep", "paralyze confuse", "poison charm death stone", "water dark", "earth light", "flinch"), // 光を溜める青銅像の意識を眠らせる
  bs_voidwalker: p("confuse", "seal flinch charm", G, "light", "dark water"), // 虚ろな目的を乱す
  bs_dreadlich: p("seal", "confuse charm flinch", D, "light fire", "dark", "paralyze"), // 三つの宝珠に分けた魂
  bs_divinegolem: p("paralyze", "seal flinch confuse", M, "dark wind", "light earth"), // 白石の裁きの眼
  bs_shadowseraph: p("confuse", "seal flinch", G, "light fire", "dark", "charm"), // 翼だけになった堕ちた御使い
  bs_fallenangel: p("charm", "sleep confuse", "", "dark earth", "light water", "paralyze"), // 伏せた顔に残る悲しみ
  bs_templelord: p("seal", "confuse charm", G, "light earth", "water dark"), // 水底の王の潮術
  el_fallenidol: p("seal", "paralyze confuse flinch", M, "dark wind", "light earth water"), // 信仰の輪を断つ聖石像
  el_heresiarch: p("seal", "charm confuse", D, "light fire", "dark", "paralyze flinch"), // 禁書の説教を黙らせる
  // 第7層・火の洞
  bs_lavagolem: p("paralyze", "flinch confuse", M, "water wind", "fire earth", "seal"), // 重なった岩殻の関節
  bs_magmaslime: p("seal", "paralyze flinch", "poison sleep charm death", "water", "fire earth", "confuse"), // 熱い粘体は毒も眠りも受けない
  bs_sulfurfiend: p("paralyze", "poison sleep", "", "water wind", "fire earth", "flinch"), // 硫煙に慣れた素早い爪
  bs_cinderwraith: p("seal", "confuse flinch", G, "water light", "fire dark", "charm"), // くすぶる未練を鎮める
  bs_flamedrake: p("sleep", "flinch charm", "", "water", "fire", "paralyze seal"), // 荒いがまだ若い火竜
  bs_obsidianguard: p("paralyze", "seal confuse flinch", M, "water wind", "fire earth"), // 呪文を弾く黒曜石の例外
  bs_lavamaw: p("sleep", "poison flinch", "", "water", "fire earth", "paralyze"), // 顎だけ出して獲物を待つ
  bs_ashghoul: p("confuse", "flinch charm", D, "water light", "fire dark", "seal"), // 灰を拝む信徒の群れ
  bs_emberswarm: p("paralyze", "sleep charm", "", "water wind", "fire", "confuse"), // 火の粉を運ぶ小さな羽
  bs_pyrelich: p("seal", "charm confuse", D, "water light", "fire dark", "flinch"), // 火の大呪を唱える乾いた骨
  bs_brimstonegolem: p("paralyze", "confuse seal", M, "water wind", "fire earth", "flinch"), // 惑わしの煙を出す鋳像
  bs_furnacefiend: p("confuse", "poison sleep flinch", "", "water", "fire earth", "seal paralyze"), // 炉の腹より判断を乱す
  bs_magmaray: p("sleep", "paralyze poison", "", "water earth", "fire wind", "flinch"), // 帯電した尾は麻痺に強い
  bs_basaltdrake: p("sleep", "poison flinch charm", "stone", "water wind", "fire earth", "seal"), // 岩の鱗の奥に竜の意識
  bs_demon: p("flinch", "seal charm confuse", "", "water light", "fire dark", "paralyze"), // 加護を剥ぐ上級魔
  bs_hellhound: p("sleep", "poison confuse", "", "water light", "fire dark", "seal"), // 悪魔でも番犬の習性が残る
  bs_shadowogre: p("confuse", "poison flinch", "", "water light", "dark earth", "sleep"), // 魂をすくう鈍い大鬼
  bs_darkliege: p("seal", "flinch confuse", M, "water light", "fire dark", "paralyze"), // 黒鉄に宿る残り火の号令
  bs_infernaltyrant: p("seal", "sleep charm confuse poison", "", "water light", "fire", "paralyze"), // 業火の大玉を散らす
  bs_doombringer: p("paralyze seal", "sleep flinch charm", "", "water", "fire earth", "confuse"), // 古竜の溜めは麻痺と封印で崩す
  bs_infernolord: p("seal", "poison sleep charm confuse", "", "water light", "fire dark", "paralyze"), // 大釜の業炎を封じる
  el_cinderking: p("seal", "charm flinch paralyze", "poison sleep death", "water", "fire light", "confuse"), // 燃え直す王の火を封じる
  el_magmawyrm: p("seal", "sleep poison flinch", "", "water wind", "fire earth", "paralyze"), // 溶鉄の鱗より熱の息を止める
  // 第8層・氷結回廊
  bs_frostwolf: p("sleep", "poison confuse", "", "fire earth", "water", "paralyze"), // 冷えた痩せ狼は眠りに落ちる
  bs_winterbat: p("paralyze", "sleep confuse", "", "fire light", "water dark", "flinch"), // 粉雪の眠りに慣れた翼
  bs_icewraith: p("seal charm", "flinch", G, "fire light", "water", "confuse"), // 氷から出たがる魂
  bs_blizzardspirit: p("seal", "paralyze flinch", "poison sleep death", "fire earth", "water wind", "confuse"), // 吹雪を集める意志
  bs_iceserpent: p("sleep", "paralyze poison", "", "fire earth", "water", "seal"), // 冷気の牙と冷えた血
  bs_glacialcrab: p("paralyze", "flinch poison", "", "earth fire", "water", "sleep"), // 氷の盾の裏の脚
  bs_snowstalker: p("paralyze", "sleep flinch", "", "fire earth", "water", "confuse"), // 吹雪を渡る上位獣
  bs_rimecrawler: p("sleep", "seal poison", "", "fire earth", "water light", "paralyze"), // 氷の紋は術に強い
  bs_frozenexplorer: p("seal", "paralyze flinch", D, "fire light", "water", "confuse"), // 半ば凍った魂のつながり
  bs_snowmantis: p("paralyze flinch", "sleep charm", "", "fire earth", "water", "confuse"), // 氷の鎌の予備動作
  bs_aurorawisp: p("seal", "confuse flinch", G, "fire dark", "water light", "charm"), // 極光の魂を散らす
  bs_iciclehorror: p("seal", "paralyze flinch", "poison sleep charm death", "fire earth", "water", "confuse"), // 伸び続ける氷柱の核
  bs_frostknight: p("paralyze", "flinch confuse", M, "fire dark", "water light", "seal"), // 凍った近衛の鎧
  bs_frostlich: p("seal", "charm confuse", D, "fire light", "water dark", "flinch"), // 魂を捕えた灯籠を封じる
  bs_frostmaiden: p("seal", "charm flinch", G, "fire light", "water", "confuse"), // 哀歌を止める
  bs_icegolem: p("seal", "paralyze flinch", M, "fire earth", "water", "confuse"), // 厚い氷の内の魂を封じる
  bs_frozenangel: p("paralyze", "seal flinch confuse", M, "fire dark", "water light"), // 氷の羽根は術を滑らせる
  bs_frostwyrm: p("sleep", "paralyze charm confuse", "", "fire earth", "water", "seal"), // 冷たい蛇竜を休眠させる
  bs_rimegiant: p("sleep", "paralyze flinch", "", "fire earth", "water", "confuse"), // 氷塊を担ぐ間に眠らせる
  bs_frostfiend: p("confuse", "paralyze flinch", "poison", "fire light", "water dark", "seal"), // 凍った魂の判断を乱す
  bs_glaciallord: p("confuse", "seal charm", G, "fire light", "water dark"), // 三百年で揺らいだ正気
  el_frostsovereign: p("seal", "paralyze flinch confuse", M, "fire light", "water dark"), // 氷の冠と床につながる影
  el_glacialmaw: p("paralyze", "sleep flinch poison", "", "fire earth", "water", "seal"), // 氷棚の巨大な顎を止める
  // 第9層・毒沼
  bs_plaguebeast: p("sleep", "poison flinch", "", "fire light", "earth dark", "paralyze"), // 疫病への適応と獣の眠り
  bs_rotooze: p("seal", "poison paralyze flinch", "sleep charm death", "fire light", "earth water dark", "confuse"), // 腐りきった魂の泥
  bs_swamphag: p("seal", "charm confuse", G, "fire light", "earth water", "flinch"), // 子守歌と泥の灯
  bs_bogdrowned: p("confuse", "paralyze flinch", D, "fire light", "water earth", "seal"), // 膨れた溺者の群れ
  bs_venomspider: p("paralyze", "poison sleep charm", "", "fire wind", "earth", "flinch"), // 毒の腹より飛びかかる脚
  bs_miasmawraith: p("seal", "confuse flinch", G, "wind light", "earth dark", "charm"), // 毒の呪いの輪を解く
  bs_corpseflower: p("sleep", "poison charm confuse", "", "fire wind", "earth dark", "flinch"), // 花粉には強いが花は閉じる
  bs_plaguerat: p("sleep confuse", "poison", "", "fire light", "earth dark", "paralyze"), // 疫病鼠の群れを鎮める
  bs_toxicgolem: p("sleep confuse", "poison paralyze flinch", "death stone", "fire wind", "earth water", "seal"), // 泥の意識を乱して担いだ塊を落とす
  bs_leechswarm: p("sleep poison", "paralyze flinch", "", "fire earth", "water", "confuse"), // しびれ粘液を出す生きたヒル
  bs_gasfiend: p("seal", "poison flinch", "sleep", "wind light", "earth dark", "confuse"), // 毒気の息を止める
  bs_marshlurker: p("sleep", "poison flinch", "", "earth fire", "water", "paralyze"), // 沼底で待つ大顎
  bs_pestilenceknight: p("paralyze", "flinch confuse", M, "fire light", "earth dark", "seal"), // 疫病に腐れた鎧の関節
  bs_fungalcorpse: p("seal flinch", "confuse charm paralyze", D, "fire wind", "earth water"), // 惑わし胞子を散らす
  bs_blightmoth: p("seal", "paralyze poison sleep", "", "fire wind", "earth", "flinch"), // 枯死の粉を封じる
  bs_sludgehydra: p("confuse", "poison flinch", "", "fire earth", "water", "sleep seal"), // 再生する多頭の判断を乱す
  bs_discardeddoll: p("paralyze", "confuse flinch", "poison sleep charm death", "fire light", "dark", "seal"), // 木の器と鉄の壊れた関節
  bs_plaguewraith: p("confuse", "seal flinch", G, "wind light", "dark earth"), // 呪文をのむ顔の群れ
  bs_plaguelich: p("seal", "charm confuse flinch", D, "fire light", "dark earth", "paralyze"), // 病薬の宝珠を封じる
  bs_necromancer: p("seal", "charm confuse", D, "light fire", "dark", "flinch"), // 捨てた器を起こす術
  bs_swamplord: p("seal", "paralyze flinch confuse", "poison sleep charm death", "fire light", "earth water dark"), // 腐った魂の沼を統べる力
  el_offeringslime: p("confuse", "poison paralyze flinch", "sleep charm death", "fire light", "water dark", "seal"), // 金貨への欲望を乱す粘塊
  el_bogfrogking: p("seal", "poison paralyze sleep", "", "fire wind", "earth water", "confuse"), // 眠りに強い蛙の上位種
  // 第10層・嵐の尖塔
  bs_stormelemental: p("seal", "paralyze flinch", "poison sleep death", "fire earth", "wind water", "confuse"), // 雷の呪文を集める雲
  bs_thunderroc: p("seal", "paralyze sleep confuse", "", "fire earth", "wind", "flinch"), // 帯電した翼より雷の息
  bs_windwraith: p("seal", "confuse flinch", G, "fire light", "wind", "charm"), // 正気を乱す叫びを止める
  bs_galeknight: p("paralyze", "flinch confuse", M, "fire earth", "wind", "seal"), // 鎧の継ぎ目の風を止める
  bs_cloudgiant: p("flinch", "paralyze confuse", "poison stone", "fire earth", "wind", "seal sleep"), // 雷を集める拳を崩す
  bs_tempestserpent: p("sleep", "paralyze charm confuse", "", "fire earth", "wind", "seal"), // 雷の牙にも眠りは通る
  bs_harpyqueen: p("seal", "charm sleep confuse", "", "fire", "wind", "paralyze"), // 女王の歌を止める
  bs_lightninggolem: p("confuse", "paralyze seal flinch", M, "earth water", "wind light"), // 雷を逃がす機構の判断を乱す
  bs_zephyrfiend: p("paralyze", "sleep confuse", "", "fire earth", "wind dark", "flinch"), // 旋風の速い爪を止める
  bs_stormhag: p("charm seal", "confuse", G, "fire light", "wind water", "flinch"), // 雨水と風鈴を持つ老婆
  bs_thunderbeast: p("sleep", "paralyze flinch", "", "fire earth", "wind", "seal"), // 雷の獣にも休眠は通る
  bs_galewisp: p("seal", "confuse flinch", G, "fire earth", "wind light", "charm"), // 雷の玉の結び目
  bs_ravenswarm: p("confuse", "sleep poison", "", "fire", "wind dark", "paralyze"), // 金貨を狙う賢い群れを乱す
  bs_skydrake: p("paralyze", "sleep charm confuse", "", "fire", "wind earth", "seal"), // 上空を飛ぶ厚鱗の成竜
  bs_boltarcher: p("seal", "confuse flinch", G, "fire earth", "wind", "charm"), // 加護を射抜く矢を封じる
  bs_cyclonecore: p("seal", "paralyze flinch", "poison sleep death", "fire earth", "wind water", "confuse"), // 嵐を鼓舞する核
  bs_soulanchor: p("seal", "paralyze flinch confuse", M, "light wind", "dark earth"), // 魂を縛る鎖の呪い
  bs_galehound: p("sleep", "confuse", "", "fire", "wind", "paralyze flinch"), // 風より速くても眠れば止まる
  bs_windscythe: p("paralyze", "sleep flinch", "", "fire earth", "wind", "confuse"), // 鎌の前足をしびれさせる
  bs_stormcaller: p("seal", "confuse charm", G, "fire light", "wind water", "flinch"), // 雷への祈りを断つ
  bs_stormlord: p("seal", "paralyze confuse", "poison sleep death stone", "fire earth", "wind water light"), // 鎖につながれた魂の嵐
  el_blizzardwitch: p("seal", "confuse charm", G, "fire light", "wind water", "flinch"), // 眠りの歌を止める
  el_stareater: p("flinch", "sleep charm confuse", "", "light", "dark wind", "seal paralyze"), // 星を吸い込む大口を崩す
  // 第11層・闘技場跡
  bs_championwraith: p("seal", "flinch confuse", M, "light wind", "earth", "paralyze"), // 歓声で戻る不滅の灯
  bs_netfighter: p("sleep", "paralyze confuse", "", "earth", "water", "charm"), // 網の扱いに慣れた軽装の闘士
  bs_arenabeast: p("sleep charm", "flinch", "", "fire", "earth", "paralyze"), // 飢えた獣を鎮める
  bs_spectreaudience: p("seal confuse", "flinch", G, "light fire", "dark", "charm"), // 観客のやじを断つ
  bs_chainedogre: p("confuse", "paralyze flinch", "", "wind", "earth", "sleep"), // 鎖を振るう筋肉の巨人
  bs_bladedancer: p("paralyze", "charm sleep", "", "fire", "wind", "flinch"), // 足首の鈴のリズムを崩す
  bs_executioner: p("sleep", "flinch confuse", "", "water", "earth", "paralyze charm"), // 鎧を着た生きた大男
  bs_beastmaster: p("seal", "confuse charm", G, "light fire", "dark", "flinch"), // むちと口笛の指揮
  bs_mirrorduelist: p("paralyze", "seal confuse flinch", M, "earth dark", "light", ""), // 鏡鋼は術を返す
  bs_crowdroar: p("seal", "confuse flinch", G, "light wind", "dark", "charm"), // 歓声の口を塞ぐ
  bs_sandlurker: p("sleep", "poison flinch", "", "water wind", "earth", "paralyze"), // 砂中の待ち伏せ
  bs_gladiatorlich: p("seal", "charm confuse", D, "light fire", "dark", "flinch"), // 灯の欠片の招来術
  bs_spikedgolem: p("paralyze", "flinch confuse", M, "water wind", "earth", "seal"), // 重い鉄の刺の像
  bs_hookmaster: p("charm sleep", "confuse", "", "fire", "", "paralyze"), // 欲深い小男の懐を惑わす
  bs_bloodpriest: p("seal", "charm flinch", G, "light fire", "dark water", "confuse"), // 血の杯への祈り
  bs_warbeasthound: p("sleep", "flinch confuse", "", "fire", "earth", "charm paralyze"), // 傷に慣れた闘犬
  bs_championofash: p("seal", "paralyze flinch", M, "water light", "fire dark", "confuse"), // 灰の息を断つ
  bs_impaler: p("paralyze", "flinch sleep", "", "wind", "earth", "confuse"), // 三連突きの構えを崩す
  bs_ghostgladiator: p("confuse", "flinch", G, "light fire", "dark", "seal charm"), // 試合の目的を失った霊
  bs_chaingang: p("confuse", "flinch paralyze", D, "light wind", "earth", "seal"), // 一本の鎖につながる判断
  bs_arenalord: p("seal", "confuse paralyze", M, "water dark", "fire light"), // 金の仮面の魅了を封じる
  el_ashshogun: p("seal", "paralyze flinch", M, "water light", "fire dark", "confuse"), // 積もり直す灰のつながり
  el_dragonslayer: p("confuse", "seal flinch charm", G, "light water", "earth fire"), // 英雄の意地と古い試合の記憶
  // 第12層・地底大空洞
  bs_cavebehemoth: p("sleep", "flinch poison", "", "wind", "earth", "seal"), // 巨獣の吠え声は眠りで止まる
  bs_crystaldrake: p("paralyze", "seal sleep confuse", "stone", "wind dark", "earth light", "flinch"), // 水晶の鱗の外の神経
  bs_blindhorror: p("sleep", "confuse", "", "wind light", "earth dark", "paralyze"), // 耳で追う獣を眠らせる
  bs_rocktitan: p("seal", "paralyze flinch confuse", M, "wind light", "earth"), // 岩盤の魂を封じる
  bs_deepworm: p("sleep", "poison flinch charm", "", "fire wind", "earth dark", "paralyze"), // すすの毒に慣れた大蟲
  bs_glowspore: p("flinch", "poison charm confuse", "", "fire wind", "earth light", "seal"), // 薄い胞子の傘を散らす
  bs_stalactiteghost: p("seal", "paralyze flinch", "poison sleep death stone", "wind light", "earth dark", "confuse"), // つらら石にしみた霊
  bs_obsidianbeast: p("paralyze", "sleep flinch", "stone", "wind water", "earth dark", "seal"), // 石の毛皮を生やした上位獣
  bs_cavetroll: p("flinch sleep", "paralyze poison", "", "fire", "earth water", "confuse"), // 岩砕きの溜めを崩す
  bs_echowraith: p("seal", "confuse flinch", G, "light wind", "dark earth", "charm"), // 名を探す声の反響
  bs_crystalspider: p("paralyze", "seal sleep", "stone", "wind dark", "earth light", "flinch"), // 水晶の脚の継ぎ目
  bs_caveguardian: p("paralyze", "seal flinch confuse", M, "wind dark", "earth light"), // 道を守る水晶の目
  bs_fossildragon: p("seal", "paralyze flinch confuse", M, "wind light", "earth dark"), // 生きた竜でなく化石の器
  bs_cavefisher: p("sleep", "paralyze poison", "", "fire earth", "water dark", "flinch"), // しびれる糸で釣る待ち伏せ
  bs_abysshorror: p("confuse", "seal flinch", G, "light fire", "dark", "charm"), // 溶け合った魂の目的を乱す
  bs_earthshaker: p("seal", "flinch poison", "stone", "wind", "earth", "sleep paralyze"), // 地割れの呪いを止める
  bs_mawofthedeep: p("seal", "poison paralyze flinch", "sleep charm death", "fire light", "earth dark", "confuse"), // すすと泥の顎の魂を止める
  bs_primalbeast: p("paralyze", "sleep poison confuse", "", "wind", "earth", "flinch"), // 濁りに染まらぬ原初の獣
  bs_gloomstalker: p("sleep", "paralyze poison charm", "", "fire light", "dark earth", "flinch"), // 闇の百足の針に強い体
  bs_primalserpent: p("paralyze", "sleep poison charm", "", "light earth", "dark water", "seal"), // 自ら眠りを誘う古い蛇
  bs_cavernlord: p("sleep", "poison confuse", "", "wind light", "earth dark", "seal paralyze"), // 大獣が眠れば大空洞は静まる
  el_oremaw: p("seal", "paralyze flinch confuse", M, "wind dark", "earth light"), // 飲んだ魂が動かす原石
  el_tunnelking: p("charm", "sleep confuse", "", "fire light", "earth dark", "seal paralyze"), // 灯籠の宝への欲望
  // 第13層・魔導書庫
  bs_grimoirebeast: p("paralyze", "seal confuse", "poison sleep charm death", "fire light", "dark", "flinch"), // ページをめくる動きを止める
  bs_inkhorror: p("seal", "poison paralyze flinch", "sleep charm death", "fire light", "dark water", "confuse"), // 墨へ知識を留める力
  bs_spellwraith: p("confuse", "seal flinch", G, "light", "dark", "charm"), // 打ち消す呪文は意味を乱す
  bs_runegolem: p("paralyze", "seal flinch confuse", M, "light wind", "dark earth"), // ルーンの守りの外にある関節
  bs_papermimic: p("sleep", "poison confuse", "", "fire light", "dark", "flinch"), // 紙に擬態する生きた魔
  bs_eyetome: p("seal", "confuse flinch", G, "fire light", "dark", "charm"), // 無数の視線を封じる
  bs_forbiddenspirit: p("seal", "paralyze flinch", "poison sleep death", "light", "dark", "confuse"), // 暴走する剥き出しの魔力
  bs_bookworm: p("sleep", "seal charm", "", "fire light", "dark", "paralyze"), // 術を覚えた本の虫
  bs_arcanesentinel: p("paralyze", "seal flinch confuse", M, "water light", "dark earth"), // 鋼の巡回機構
  bs_cursescroll: p("seal", "charm", G, "fire light", "dark", "confuse flinch"), // 災いを呼ぶ文面を封じる
  bs_wordwraith: p("seal", "confuse flinch", G, "light wind", "dark", "charm"), // 囁きの真名を断つ
  bs_inkdragon: p("confuse", "seal paralyze flinch", "poison sleep death", "fire light", "dark water", "charm"), // 墨でできた竜は眠らない
  bs_familiarswarm: p("charm", "sleep flinch", "", "light fire", "dark", "paralyze seal"), // 契約者を求める心
  bs_mindeater: p("confuse", "seal charm", G, "light", "dark", "flinch"), // 奪いすぎた知識が絡む
  bs_glyphhound: p("sleep", "seal confuse", "", "fire light", "dark", "paralyze"), // 呪印の守りでも獣は眠る
  bs_tomeguardian: p("paralyze", "seal flinch confuse", "poison sleep charm death", "fire light", "dark earth"), // 本の鎧の動きを止める
  bs_astralwraith: p("seal", "confuse charm", G, "light earth", "dark wind", "flinch"), // 星の運行を縛る術
  bs_elderlich: p("seal", "confuse charm flinch", D, "light fire", "dark", "paralyze"), // 七つに分けた魂の術
  bs_soulreaper: p("seal", "confuse charm flinch", G, "light fire", "dark"), // 冥府の役目を封じる
  bs_cosmicwraith: p("charm", "seal confuse flinch", G, "light", "dark water"), // 宇宙の孤独を惑わす
  bs_archivist: p("seal", "charm confuse", D, "light fire", "dark", "paralyze"), // 手記を守る術を断つ
  el_voidarchon: p("seal", "confuse charm flinch", G, "dark earth", "light wind"), // 虚空の白い輪郭
  el_librarian: p("paralyze", "seal confuse charm", D, "fire light", "dark", "flinch"), // 呪文を吸う司書の手を止める
  // 第14層・屍蝋の回廊
  bs_wickmummy: p("seal", "paralyze flinch charm", D, "fire light", "dark earth", "confuse"), // 蝋に固められた歴代の王
  bs_embalmer: p("confuse", "seal charm", G, "fire light", "dark", "flinch"), // 完璧な保存への執念を乱す
  bs_graveroyalguard: p("paralyze", "flinch confuse", M, "fire light", "dark earth", "seal"), // 屍蝋の近衛の関節
  bs_waxhorror: p("seal", "paralyze flinch", "poison sleep death", "fire light", "dark earth", "confuse charm"), // 蝋の顔をつなぐ魂
  bs_mournfulchancellor: p("seal charm", "confuse", G, "fire light", "dark", "flinch"), // 空欄を埋めたい記録官
  bs_candlewraith: p("seal", "flinch", G, "water light", "fire dark", "confuse charm"), // 命を芯にする弔い火
  bs_preservedbeast: p("seal", "paralyze flinch confuse", D, "fire light", "dark earth", "charm"), // 剥製は生きた獣の眠りを持たない
  bs_tombpriest: p("seal", "confuse charm", D, "fire light", "dark", "paralyze"), // 終わらない葬送の祈り
  bs_sarcophagusguard: p("paralyze", "flinch seal", M, "wind light", "earth dark", "confuse"), // 金飾りの石棺の蓋
  bs_wailingnoble: p("charm", "flinch", G, "light fire", "dark", "confuse seal"), // 名を失った身代わりの心
  bs_coffincrawler: p("sleep", "poison charm", "", "fire light", "dark earth", "paralyze"), // 棺を食い荒らす生きた虫
  bs_mummylord: p("seal", "paralyze flinch confuse", D, "fire dark", "earth light", "charm"), // 包帯の将の忠義
  bs_deathmask: p("seal", "paralyze confuse flinch", M, "fire dark", "light earth"), // 黄金の仮面の凝視
  bs_corpsewax: p("seal", "paralyze flinch", D, "fire light", "dark earth", "confuse charm"), // 蝋から固まり直す従者
  bs_funeralwraith: p("confuse charm", "flinch", G, "light wind", "dark", "seal"), // 葬列の行く先を惑わす
  bs_boneprince: p("charm", "flinch confuse", D, "light fire", "dark", "seal paralyze"), // 王冠を欲しがる王子
  bs_crypthound: p("seal", "confuse flinch", D, "light fire", "dark", "paralyze"), // 殉葬された犬は眠らない
  bs_shroudkeeper: p("seal", "confuse flinch", G, "fire light", "dark", "charm"), // 装束を絡める力
  bs_doomknight: p("paralyze", "seal flinch confuse", M, "light water", "dark earth"), // 冥鉄の鎧の誓い
  bs_voidknight: p("seal", "confuse flinch", G, "light", "dark", "charm"), // 消えかけた鎧の存在
  bs_cryptking: p("seal", "charm confuse", D, "light fire", "dark earth", "paralyze"), // 王の吸命を封じる
  el_lanternreaper: p("confuse", "seal flinch", G, "light fire", "dark", "charm"), // 消えた灯の憎しみを乱す
  el_soulflayer: p("seal", "confuse charm flinch", G, "light fire", "dark"), // 奪った魂の殻をほどく
  // 第15層・溶鉄炉
  bs_moltensmith: p("paralyze", "flinch confuse", M, "water", "fire earth", "seal"), // 鍛冶の自動機構
  bs_forgegolem: p("seal", "paralyze flinch confuse", M, "water wind", "fire earth"), // 鋳造工程の意志を断つ
  bs_slagbeast: p("seal", "paralyze flinch", M, "water wind", "fire earth", "confuse"), // 生体でなく鉱くずの獣
  bs_anvilhorror: p("seal", "paralyze flinch", M, "water wind", "fire earth", "confuse"), // 打撃に慣れた金床の魔
  bs_soulingot: p("confuse", "seal flinch", "poison sleep death", "water light", "fire dark", "charm paralyze"), // 無数の魂の鋳塊の判断
  bs_moltenwraith: p("seal", "flinch", G, "water light", "fire dark", "confuse charm"), // 溶けても残る霊の火
  bs_forgehound: p("paralyze", "confuse flinch", M, "water", "fire earth", "seal"), // 鉄で鋳た番犬は眠らない
  bs_ironmaiden: p("paralyze", "flinch confuse", M, "water wind", "earth fire", "seal"), // 拷問器具の開閉部
  bs_bellowsfiend: p("seal", "poison sleep flinch", "", "water", "fire wind", "confuse"), // 炉へ送る息を封じる
  bs_quenchserpent: p("sleep", "poison charm", "", "earth light", "fire water", "seal paralyze"), // 油槽の生きた大蛇
  bs_smithghost: p("seal", "confuse", G, "water light", "fire", "charm flinch"), // 鍛冶師の惰性の術
  bs_moltencore: p("seal", "paralyze flinch", "poison sleep charm death", "water", "fire earth", "confuse"), // 炉心の魔力を封じて冷やす
  bs_dollhusk: p("confuse", "flinch", "poison sleep death", "fire light", "dark", "paralyze seal charm"), // 空の器は温もりを求める
  bs_flamehammer: p("paralyze", "flinch confuse", M, "water", "fire earth", "seal"), // 炎槌を振るう鎧
  bs_cruciblehorror: p("seal", "poison paralyze flinch", "sleep death", "water light", "fire dark", "confuse charm"), // 毒金属と魂の溶湯
  bs_sparkswarm: p("seal", "paralyze flinch", "poison sleep charm death", "water wind", "fire", "confuse"), // 火花は虫の生体を持たない
  bs_forgewyrm: p("seal", "paralyze flinch charm", "poison sleep", "water wind", "fire earth", "confuse"), // 炉が燃える限り眠らない竜
  bs_moltenknight: p("seal", "paralyze flinch", M, "water wind", "fire earth", "confuse"), // 溶けた鎧の流れを止める
  bs_cindergeist: p("charm seal", "flinch", G, "water light", "fire dark", "confuse"), // 焼けた職人の未練
  bs_emberfly: p("paralyze", "sleep charm", "", "water wind", "fire", "confuse"), // 熱気に湧く生きた羽虫
  bs_forgemaster: p("paralyze", "seal confuse", M, "water light", "fire earth dark"), // 炉の機構を止める
  el_geargod: p("paralyze", "seal flinch confuse", M, "water wind", "earth light"), // 歯車を止めるしびれ
  el_moltengiant: p("seal", "paralyze flinch", "poison sleep death stone", "water wind", "fire earth", "confuse"), // 溶鉄の血の巨人
  // 第16層・深淵の聖堂
  bs_falseseraph: p("seal", "charm confuse", G, "dark water", "light fire", "flinch"), // 慈悲を装う吸命の光
  bs_inquisitor: p("confuse", "flinch seal", M, "dark water", "light fire", "paralyze"), // 断罪への固執を乱す
  bs_censerfiend: p("seal", "poison sleep flinch", "", "water dark", "light fire", "paralyze"), // 香煙の息を止める
  bs_lightidol: p("paralyze", "seal confuse flinch", M, "dark wind", "light earth"), // 黄金像を動かす関節
  bs_choirofthelost: p("seal", "confuse flinch", G, "dark water", "light fire", "charm"), // 焼かれた記憶を隠す歌
  bs_flagellant: p("seal charm", "flinch paralyze", D, "dark water", "light fire", "confuse"), // 痛みに慣れた苦行者の亡霊
  bs_radiantwraith: p("seal", "confuse flinch", G, "dark earth", "light", "charm"), // まばゆい光の惑わし
  bs_crusaderghost: p("confuse", "seal flinch", M, "dark water", "light", "paralyze"), // 偽りを知らぬ騎士の信念
  bs_saintbeast: p("sleep", "charm flinch", "", "dark earth", "light", "paralyze"), // 光をまとっても生きた獣
  bs_blindingorb: p("seal", "paralyze flinch", "poison sleep death", "dark earth", "light", "confuse"), // 光の矢の核を封じる
  bs_martyrwraith: p("charm", "seal flinch", G, "dark water", "light fire", "confuse"), // 救いを待つ渇いた心
  bs_holygolem: p("paralyze", "seal confuse flinch", M, "dark water", "light earth"), // 中空の幾重の聖鎧
  bs_confessor: p("charm seal", "confuse", G, "dark", "light", "flinch"), // 罪の重みに潰れた心
  bs_lightlance: p("paralyze", "flinch confuse", M, "dark earth", "light", "seal"), // 光槍の突きの関節
  bs_wingedjudge: p("confuse", "seal charm", G, "dark earth", "light wind", "flinch"), // 気まぐれな裁きの判断
  bs_pyreofsouls: p("seal", "paralyze flinch", "poison sleep death", "water dark", "light fire", "confuse"), // 魂を焼く炎を封じる
  bs_cathedralguard: p("paralyze", "seal flinch confuse", M, "dark wind", "light earth"), // 聖印に守られた装甲
  bs_hymncaster: p("seal", "confuse charm", G, "dark water", "light fire", "flinch"), // 悲鳴を隠す指揮の歌
  bs_lightmoth: p("sleep", "paralyze charm", "", "fire dark", "light", "confuse"), // 偽りの灯に集まる生きた蛾
  bs_seraphwraith: p("seal", "charm confuse flinch", G, "dark earth", "light wind"), // 終わりの報せを封じる
  bs_highpontiff: p("seal", "charm confuse", G, "dark water", "light fire"), // 偽りの光の祈りを断つ
  el_sorrowsaint: p("charm seal", "flinch", G, "dark fire", "light water", "confuse"), // 弔いに残る聖女の心
  el_huntsmanwraith: p("confuse", "seal charm flinch", G, "fire light", "wind dark"), // 狩り尽くした王の執念
  // 第17層・凍てつく王墓
  bs_frozenking: p("charm", "paralyze flinch", D, "fire light", "water dark", "seal confuse"), // 譲った冠を探す老王
  bs_iceroyalguard: p("paralyze", "flinch confuse", M, "fire dark", "water light", "seal"), // 霜の槍と近衛の鎧
  bs_frostmonarchwraith: p("charm seal", "flinch", G, "fire light", "water", "confuse"), // 天寿を迎えた古王の嘆き
  bs_youththief: p("seal", "charm confuse", G, "fire light", "water dark", "flinch"), // 若さを束ねる冷気
  bs_glacialtomb: p("seal", "paralyze flinch", M, "fire earth", "water", "confuse"), // 王を納めた氷の棺
  bs_frostnoble: p("charm", "paralyze confuse", D, "fire light", "water", "seal flinch"), // 優雅な序列への執着
  bs_icebreaker: p("confuse", "paralyze flinch", "poison stone", "fire earth", "water", "sleep"), // 氷を割る巨体の判断
  bs_frozenchancellor: p("charm seal", "confuse", G, "fire light", "water", "flinch"), // 王をいさめる侍従長
  bs_frostlynx: p("sleep", "confuse", "", "fire earth", "water", "paralyze"), // 白い生きた山猫
  bs_crystalcoffin: p("seal", "paralyze flinch", M, "fire wind", "water light", "confuse"), // 水晶棺の内部の魂
  bs_soulfrostwraith: p("charm", "flinch", G, "fire light", "water", "seal confuse"), // 温もりを渇望する凍った魂
  bs_permafrostgolem: p("paralyze", "seal flinch confuse", M, "fire wind", "water earth"), // 凍土の番兵の機構
  bs_frozenpriest: p("seal", "charm confuse", D, "fire light", "water dark", "paralyze"), // 氷封じの儀式を止める
  bs_iciclewyrm: p("seal", "paralyze flinch", M, "fire earth", "water", "confuse"), // 氷柱から生まれた竜の形
  bs_mournfulqueen: p("charm", "flinch", G, "fire light", "water dark", "seal confuse"), // 独りで老いた女王の哀切
  bs_coldrevenant: p("confuse", "flinch charm", G, "fire light", "water dark", "seal"), // 怒りの行く先を乱す
  bs_snowhydra: p("confuse", "paralyze poison", "", "fire earth", "water", "sleep seal"), // 首ごとの判断を乱す
  bs_glacialhound: p("seal", "confuse flinch", D, "fire light", "water dark", "paralyze"), // 殉葬した犬の魂
  bs_frostsentinel: p("paralyze", "seal flinch confuse", M, "fire earth", "water"), // 千年の門番の氷の装甲
  bs_frostservant: p("confuse", "paralyze flinch", D, "fire light", "water", "seal charm"), // 命令を続ける従者の列
  bs_frostmonarch: p("seal", "paralyze charm confuse", D, "fire light", "water dark"), // 氷の王の吸命術
  el_palerider: p("paralyze", "seal flinch confuse", M, "light fire", "dark", ""), // 蹄を止めるしびれ
  el_tombcaptain: p("seal", "paralyze flinch confuse", D, "fire light", "water earth", "charm"), // 殉葬近衛への号令
  // 第18層・冥府の門
  bs_gatekeeper: p("paralyze", "seal flinch confuse", M, "light wind", "dark earth"), // 両側を塞ぐ門番の関節
  bs_ferryman: p("charm", "seal flinch", G, "light earth", "dark water", "confuse"), // 渡し賃を求める執着
  bs_wailingdead: p("seal confuse", "flinch", D, "light fire", "dark", "paralyze"), // 還りたい亡者の群れ
  bs_cerberusshade: p("confuse", "seal flinch", G, "light fire", "dark", "charm"), // 肉でなく三つ首の影
  bs_soulchain: p("seal", "paralyze flinch", M, "light wind", "dark earth", "confuse"), // 魂を縛る呪いをほどく
  bs_doorwraith: p("charm seal", "flinch", G, "light fire", "dark", "confuse"), // 宙吊りの魂の迷い
  bs_underjudge: p("confuse", "seal flinch", M, "light water", "dark earth", "paralyze"), // 判官の断罪を迷わせる
  bs_lostbrother: p("charm", "flinch seal", G, "light fire", "dark", "confuse"), // 裏切られた弟の心
  bs_shadereaper: p("seal", "confuse flinch", G, "light fire", "dark", "charm"), // 影の刈り取りを封じる
  bs_grievingspirit: p("charm confuse", "flinch", G, "light fire", "dark", "seal"), // 別れたくない群霊
  bs_boneferry: p("seal", "paralyze flinch", D + " charm stone", "light wind", "dark water", "confuse"), // 骨の舟を結ぶ術
  bs_hadeshound: p("paralyze", "sleep charm confuse", "", "light fire", "dark", "seal"), // 生きた冥犬は眠りに強い
  bs_voidpriest: p("seal", "confuse charm", G, "light fire", "dark", "flinch"), // 門を開く虚無の祈り
  bs_chainwraith: p("seal", "flinch", G, "light fire", "dark earth", "confuse charm"), // 鎖に食い込む魂をほどく
  bs_tormentor: p("flinch", "sleep charm confuse", "", "light water", "dark fire", "paralyze"), // 苦痛を与える鬼の手を崩す
  bs_echoofvoice: p("seal", "confuse flinch", G, "light wind", "dark", "charm"), // 言葉そのものの力を封じる
  bs_apocalypsedrake: p("seal", "sleep charm confuse poison", "", "light water", "dark fire", "paralyze"), // 土を滅ぼす終末の息
  bs_abysswarden: p("seal", "paralyze flinch confuse", M, "light wind", "dark earth"), // 敗者の名を留める誓い
  bs_eternallord: p("seal", "sleep charm confuse", "death", "light", "dark wind", "flinch"), // 時を読む力を断つ
  bs_chaosknight: p("charm", "flinch confuse", "", "light water", "dark earth", "paralyze seal"), // 裏切りを重ねる剣鬼の欲
  bs_gatewarden: p("seal", "confuse charm", G, "light fire", "dark water"), // 境の門を保つ力
  el_hellwarden: p("paralyze", "sleep flinch poison", "", "water light", "fire dark", "seal"), // 灼熱の獄吏の腕を止める
  el_phantomcompany: p("confuse seal", "flinch", G, "fire light", "wind dark", "charm"), // 百人の連携を乱す
  // 第19層・竜の巣
  bs_broodwyrm: p("sleep", "charm", "", "water", "fire", "paralyze confuse"), // 若い仔竜の眠り
  bs_dragonkin: p("confuse", "sleep flinch poison", "", "water light", "fire earth", "paralyze"), // 誇り高い戦士を惑わす
  bs_eggguardian: p("paralyze", "sleep flinch charm", "", "water", "fire earth", "seal"), // 卵を守る母竜は眠りにくい
  bs_wyvernlord: p("paralyze", "sleep confuse charm", "", "water wind", "fire", "seal"), // 飛竜の長の翼を止める
  bs_dragoncultist: p("seal", "sleep charm", "", "water light", "fire dark", "confuse"), // 仔竜を呼ぶ祈りを止める
  bs_scaledhorror: p("sleep", "flinch poison", "", "water wind", "fire earth", "confuse"), // 知恵の浅い異形の眠り
  bs_emberdrake: p("paralyze", "sleep flinch", "", "water", "fire light", "seal"), // 冷めない火の竜を止める
  bs_dragonbeast: p("paralyze", "sleep flinch", "", "water light", "fire", "charm"), // 竜の気性を得た上位獣
  bs_wingedterror: p("paralyze", "sleep confuse", "", "water wind", "fire", "seal"), // 賢い空の狩人の翼
  bs_salamanderking: p("seal", "sleep poison flinch", "", "water", "fire earth", "paralyze"), // 火トカゲの王の息
  bs_dragonpriest: p("seal", "charm confuse", G, "water light", "fire dark", "flinch"), // 竜への供物の祈り
  bs_hoardgolem: p("paralyze", "seal flinch confuse", M, "water dark", "fire light earth"), // 財宝の黄金像
  bs_drakerider: p("paralyze", "flinch confuse", M, "water light", "fire earth", "seal"), // 愛竜を求める槍の鎧
  bs_ashdrake: p("sleep", "poison flinch", "", "water wind", "fire earth", "seal"), // 灰の息を眠りで止める
  bs_brimstonewyrm: p("paralyze", "poison sleep", "", "water wind", "fire earth", "seal"), // 硫煙に慣れた蛇竜の神経
  bs_dragonwhelp: p("sleep confuse", "charm", "", "water", "fire", "paralyze flinch"), // かえったばかりの群れ
  bs_moltendrake: p("seal", "sleep poison flinch", "", "water wind", "fire earth", "paralyze"), // 溶岩の息を封じる
  bs_flameserpentkin: p("sleep", "poison flinch", "", "water earth", "fire", "paralyze"), // 灼けた鱗の生きた蛇
  bs_drakehound: p("sleep", "poison confuse", "", "water light", "fire earth", "paralyze"), // 鱗の内側の猟犬の眠り
  bs_basilisk: p("sleep", "poison charm confuse", "stone", "water wind", "fire earth", "seal"), // 邪眼を閉じさせる
  bs_elderdragon: p("seal", "sleep charm confuse", "", "water light", "fire earth", "paralyze"), // 仔竜の招来と業炎を断つ
  el_goldtyrant: p("paralyze", "sleep charm confuse", "", "dark water", "light fire earth", "seal"), // 黄金の鱗を動かす神経
  el_eclipsedragon: p("seal", "sleep charm confuse", "poison", "light", "dark wind", "paralyze"), // 日蝕を形にする力
  // 第20層・玄室
  bs_cagekeeper: p("paralyze", "seal flinch confuse", M, "light wind", "dark earth"), // 鉄檻を継ぎ足した腕
  bs_souldragon: p("confuse", "sleep charm flinch", "", "light water", "dark fire", "seal paralyze"), // 腹の中の魂の叫びを乱す
  bs_firstdoll: p("charm", "flinch", "poison sleep death stone", "light fire", "dark", "seal confuse paralyze"), // 最初の器に残る主への慕情
  bs_weaversregret: p("charm seal", "flinch", G, "light", "dark", "confuse"), // 織り手の悔いに触れる
  bs_voidserpent: p("seal", "poison paralyze flinch", "sleep death stone", "light", "dark water", "confuse charm"), // 闇そのものの蛇
  bs_memorywraith: p("confuse", "seal flinch", G, "light fire", "dark", "charm"), // 誰のものでもない記憶
  bs_chainoftheworld: p("confuse", "paralyze seal flinch", M, "light wind", "dark earth"), // 魔の膜の内の命令を乱す
  bs_lastguardian: p("seal", "paralyze flinch confuse", M, "light water", "dark earth"), // 最後の命令を封じる
  bs_abyssalbeast: p("paralyze", "sleep poison flinch", "", "light fire", "dark", "seal"), // 神経を止める上位の盲獣
  bs_soulstorm: p("confuse", "seal flinch", G, "light wind", "dark", "charm"), // 魂の群れの向きを乱す
  bs_fallenweaver: p("seal", "sleep charm confuse", "death", "light fire", "dark", "paralyze"), // 魂を縫い付ける術を止める
  bs_dragonshade: p("seal", "confuse flinch", G, "light", "dark fire", "charm"), // 壁に残った竜の影
  bs_eternalflame: p("seal", "paralyze flinch", "poison sleep death", "light water", "dark fire", "confuse"), // 魂を束ねる焔の芯
  bs_nullsentinel: p("paralyze", "seal flinch confuse", M, "light wind", "dark earth"), // 術をのむ虚無の器
  bs_shadowofthefirst: p("charm", "seal flinch", G, "light", "dark", "confuse"), // 眠る主を離れた影の未練
  bs_worldwyrm: p("seal", "sleep poison charm confuse", "", "light earth", "dark water", "paralyze"), // 世界を巻く息を封じる
  bs_despairwraith: p("charm seal", "flinch", G, "light fire", "dark", "confuse"), // 最後の絶望を鎮める
  bs_voiddragon: p("seal", "confuse flinch", G, "light", "dark water", "charm"), // 星の間の無の竜
  bs_voidcolossus: p("confuse", "seal flinch", G, "light", "dark earth", "charm"), // 肉を持たない巨人の無
  bs_godslayer: p("charm", "sleep seal confuse flinch", "death", "light water", "dark fire", "paralyze"), // 強者への執着を惑わす剣士
  bs_firstweaver: p("confuse", "seal sleep charm paralyze", "death", "light", "dark fire earth"), // 祖の孤独と悔いは揺らぐ
  el_soulcrystal: p("confuse", "seal paralyze flinch", M, "dark wind", "light earth"), // 多数の魂を閉じ込めた大晶
  el_namedevourer: p("seal", "confuse flinch", G, "light", "dark", "charm"), // 忘れられた名を呼ぶ囁き
  // 旧迷宮・ランク1の魔物
  bs_mudbeetle: p("sleep", "poison flinch charm", "", "fire wind", "earth water", "paralyze"), // 泥甲羅の内側の眠り
  bs_drainrat: p("sleep", "poison", "", "fire light", "dark", "confuse paralyze"), // 下水に慣れた鼠
  bs_shroomspirit: p("seal flinch", "poison charm confuse", "", "fire wind", "earth water", "sleep"), // 再生する菌糸の魔力
  bs_whispercollector: p("seal", "confuse charm", G, "light wind", "dark"), // 臨終の言葉の囁きを止める
  bs_bloodcoffin: p("seal", "paralyze confuse", M, "light wind", "dark water earth"), // 血を吸う石棺の力
  bs_ossuarygiant: p("confuse", "poison paralyze", "", "light wind", "earth dark", "sleep"), // 骨を喰らう大鬼の判断
  bs_ashprelate: p("seal", "confuse charm", G, "water light", "fire dark"), // 燃え尽きぬ説法を止める
  bs_welldweller: p("sleep", "poison confuse", "", "earth light", "water dark", "paralyze"), // 井底で落ちる獲物を待つ
  bs_chainwarden: p("seal", "paralyze confuse charm", D, "light wind", "dark earth"), // 鎖にのまれた獄卒の呪い
  bs_sarcophaguslord: p("seal", "paralyze confuse charm", D + " stone", "wind light", "earth dark"), // 石棺を鎧にする古王
  bs_boneemperor: p("confuse", "seal paralyze charm", D, "light wind", "dark earth"), // 百骸を束ねる帝の意志
  // 旧迷宮・ランク2の魔物
  bs_shadowhound: p("seal", "confuse flinch", G, "light", "dark earth", "charm"), // 坑道の影そのものの犬
  bs_gnoll: p("charm", "poison flinch", "", "fire wind", "earth", "sleep"), // 死者の装備を好む戦士
  bs_hobgoblin: p("paralyze", "sleep confuse", "", "water", "earth", "charm"), // 知恵を得た小鬼の上位種
  bs_swampslime: p("seal", "poison paralyze flinch", "sleep charm death", "fire wind", "earth water", "confuse"), // 鉱毒を溶かし込んだ粘塊
  bs_goblinshaman: p("seal charm", "confuse", "", "light fire", "dark", "sleep"), // 群れの傷を縫う祈祷師
  bs_ratpiper: p("seal", "confuse", "", "fire", "", "sleep charm"), // 鼠寄せの笛を止める
  bs_foremanwraith: p("seal", "confuse charm", G, "light wind", "dark earth"), // 坑夫頭の点呼を断つ
  bs_bonecollier: p("confuse", "paralyze charm", D, "light wind", "earth dark", "seal"), // 骨を並べ続ける作業を乱す
  bs_saltcolossus: p("seal", "paralyze confuse", M, "water wind", "earth light"), // 岩塩の祈りが転じた呪い
  bs_frostmaggot: p("sleep", "paralyze poison charm", "", "fire earth", "water", "seal"), // 冷気に慣れた大蟲
  bs_brimstonefiend: p("seal", "poison sleep charm", "", "water light", "fire earth", "confuse"), // 毒煙の帳を封じる
  bs_steamtyrant: p("paralyze", "seal confuse", M, "water wind", "fire earth", ""), // 蒸気弁の機構を止める
  bs_leadenking: p("seal", "paralyze confuse", M, "wind light", "earth dark"), // 鉛にのまれた王の執念
  bs_rustwyrm: p("sleep", "poison charm confuse", "", "water wind", "earth fire", "seal"), // 錆を喰らう地竜の休眠
  // 旧迷宮・ランク3の魔物
  bs_werewolf: p("charm", "sleep poison flinch", "", "light fire", "dark", "seal"), // わずかに残る人の心
  bs_scorpion: p("paralyze", "poison sleep charm", "", "water wind", "earth", "flinch"), // 毒針よりはさみを止める
  bs_darkelf: p("sleep", "poison confuse", "", "light fire", "dark", "paralyze charm"), // 暗がりの生きた射手
  bs_poisonspider: p("sleep", "paralyze poison charm", "", "fire wind", "earth", "flinch"), // しびれ毒を持つ待ち伏せ
  bs_marshgolem: p("seal", "poison paralyze flinch", "sleep charm death", "fire wind", "earth water", "confuse"), // 呪文の残りかすで動く泥
  bs_hexwolf: p("seal", "flinch confuse", D, "light fire", "dark", "paralyze"), // 死んでも走る呪骸
  bs_lastbanneret: p("seal", "confuse paralyze", M, "light fire", "earth", ""), // 折れた旗を支える誓い
  bs_bloodfeastogre: p("sleep", "poison confuse", "", "water light", "fire dark", "paralyze"), // 終わらない血祭りを眠りで止める
  bs_squareghost: p("seal", "confuse charm", G, "light wind", "dark"), // 将の名簿の読み上げを断つ
  bs_frozenarcher: p("seal", "paralyze confuse", D, "fire light", "water", "charm"), // 氷の指で引く矢の術
  bs_granarymaw: p("seal", "poison paralyze confuse", "sleep charm death", "water wind", "fire earth"), // おき火と兵糧の粘塊
  bs_headsmanwraith: p("confuse", "seal charm", G, "light fire", "dark"), // 名簿を失った処刑の目的
  bs_ironcagewarden: p("paralyze", "seal confuse", M, "water light", "earth dark"), // 鉄格子と癒着した鎧
  bs_duskcastellan: p("charm", "confuse paralyze", D, "light fire", "dark", "seal"), // 鍵を渡す相手へのこだわり
  bs_warhostrevenant: p("confuse", "seal charm", G, "light wind", "dark"), // 千兵の号令を乱す
  // 旧迷宮・ランク4の魔物
  bs_minotaur: p("confuse sleep", "poison", "", "wind water", "earth", "paralyze"), // 生贄を待つ牛頭の判断
  bs_plaguepriest: p("seal", "confuse charm", G, "light fire", "dark earth", "flinch"), // 病魔の祈りを封じる
  bs_mistwolfking: p("seal", "sleep confuse", "", "fire light", "wind dark", "paralyze"), // 霧を狼にする王の遠吠え
  bs_hollowkodama: p("poison", "sleep charm confuse", "", "fire wind", "earth light", "seal"), // 木の根へ毒を巡らせる
  bs_bloodbriar: p("seal", "poison charm confuse", "", "fire light", "dark earth", "sleep"), // 血と魂を吸う茨の力
  bs_birchwitch: p("seal", "confuse charm", G, "fire light", "water", ""), // 奪う体温の呪文を断つ
  bs_pyretreant: p("seal", "paralyze confuse", "poison sleep charm death", "water wind", "fire earth"), // 燃え続ける木の人形
  bs_bogtyrant: p("sleep", "paralyze poison", "", "earth light", "water dark", "seal"), // 沼で待つ本体を眠らせる
  bs_curseroot: p("seal", "poison charm confuse", "", "fire wind", "dark earth", "sleep"), // 森をつなぐ根の呪い
  bs_rotgardener: p("seal", "paralyze confuse charm", D, "fire light", "earth dark"), // 死体を芽吹かせる術
  bs_mireforestking: p("poison", "sleep charm confuse", "", "fire light", "dark earth water", "seal"), // 血を吸う樹液に毒を回す
  // 旧迷宮・ランク5の魔物
  bs_salamander: p("sleep", "poison flinch", "", "water earth", "fire", "paralyze seal"), // 火トカゲの休眠
  bs_fireserpent: p("sleep", "poison flinch", "", "water earth", "fire", "paralyze"), // 巻きつく炎蛇を眠らせる
  bs_drownedpontiff: p("seal", "paralyze confuse charm", D, "earth light", "water dark"), // 沈黙の聖歌を封じる
  bs_altarguardian: p("paralyze", "seal confuse", M, "dark wind", "light earth"), // 聖石の像の動きを止める
  bs_sacrificelord: p("seal", "confuse charm", G, "light fire", "dark water"), // 未完成の生贄儀式を断つ
  bs_whisperingidol: p("seal", "paralyze confuse", M, "light wind", "dark earth"), // 頭蓋へ響く囁きを止める
  bs_blazeseraph: p("seal", "confuse charm", G, "water dark", "fire light"), // 火の粉の聖句を断つ
  bs_nagamatriarch: p("paralyze", "sleep poison charm", "", "earth light", "water dark", "seal"), // 卵を産む母神は眠りに強い
  bs_cursedpontifex: p("seal", "paralyze confuse charm", D, "light fire", "dark earth"), // 裏返った聖句を封じる
  bs_duskapostle: p("seal", "paralyze sleep", "", "dark fire", "light wind", "confuse"), // 届かない神託の声
  bs_ordealavatar: p("confuse", "seal paralyze", M, "dark wind", "light earth"), // 試練を量る判断を乱す
  // 旧迷宮・ランク6の魔物
  bs_wyvern: p("paralyze", "poison sleep", "", "fire earth", "wind", "confuse"), // 翼と毒針の飛竜
  bs_cyclops: p("confuse", "sleep poison", "", "wind water", "earth", "paralyze"), // 雷を鍛えた単眼巨人
  bs_darkdrake: p("sleep", "charm confuse", "", "light water", "dark", "seal"), // 影の息を吐く小竜
  bs_ashphoenix: p("seal", "sleep poison", "", "water dark", "fire light", "paralyze"), // 最後の炎を守る鳳凰
  bs_magmacentipede: p("paralyze", "poison sleep charm", "", "water wind", "fire earth", "seal"), // 溶岩の百足の脚を止める
  bs_cinderknight: p("seal", "paralyze confuse", M, "water light", "fire dark"), // おき火の誓いを断つ
  bs_boilingmass: p("seal", "poison paralyze confuse", "sleep charm death", "water light", "fire dark"), // 煮えた肉の意思を断つ
  bs_fumarolelord: p("confuse", "poison sleep charm", "", "water wind", "fire earth", "seal"), // 客の格を量る魔伯の判断
  bs_venomhydra: p("confuse", "poison sleep paralyze", "", "water light", "fire dark", "seal"), // 憎み合う二つの首
  bs_calderawyrm: p("sleep", "poison charm confuse", "", "water wind", "fire earth", "seal"), // 火山の縦坑で眠る蛇竜
  bs_flameheresiarch: p("seal", "confuse charm", G, "water light", "fire dark"), // 火刑を説く声を断つ
  bs_emberking: p("confuse", "paralyze charm", D, "water light", "fire dark", "seal"), // 退位を拒む廃王の意志
  bs_infernowyrm: p("paralyze", "sleep poison charm confuse", "", "water light", "fire dark", "seal"), // 業火の中で神経を止める
  // 旧迷宮・ランク7の魔物
  bs_hydra: p("confuse", "poison sleep paralyze", "", "fire earth", "water", "seal"), // 九つ首の連携を乱す
  bs_stormwyvern: p("seal", "paralyze sleep", "", "fire earth", "wind water", "confuse"), // 雷を避ける羽根の竜
  bs_crystalwyrm: p("sleep", "paralyze charm confuse", "stone", "fire earth", "water light", "seal"), // 氷柱に擬態して眠る蛇竜
  bs_snowsexton: p("seal", "paralyze confuse", D, "fire light", "water", "charm"), // 終わらぬ死者の勘定
  bs_frozenwarden: p("seal", "paralyze confuse", M, "fire earth", "water dark"), // 氷柱へ封じる刑を断つ
  bs_blizzardvoice: p("seal", "confuse charm", G, "fire light", "wind water"), // 名を呼ぶ吹雪の声
  bs_glacialgiant: p("sleep", "paralyze poison", "", "fire earth", "water", "confuse"), // 氷河を寝床にする巨王
  bs_paradoxgenie: p("confuse", "seal paralyze", "poison sleep death", "earth dark", "fire water", "charm"), // 氷炎の矛盾した意志
  bs_rimecastellan: p("charm", "seal confuse", G, "fire light", "water dark"), // 晩餐の客を待つ未練
  bs_eternalsnowbeast: p("paralyze", "sleep poison confuse", "", "fire earth", "water", "seal"), // 万年雪の獣の上位種
  bs_iciclequeen: p("charm", "seal confuse", G, "fire light", "water", ""), // 差し伸べる手の優美さ
  // 旧迷宮・ランク8の魔物
  bs_archdemon: p("seal", "charm confuse sleep", "", "light water", "dark fire", "paralyze"), // 甘い契約の招来を断つ
  bs_stormroc: p("seal", "paralyze sleep", "", "fire earth", "wind water", "confuse"), // 畳まぬ翼の暴風を断つ
  bs_skywarden: p("paralyze", "seal confuse", M, "fire earth", "wind", ""), // 浮遊する重い石像
  bs_thunderprelate: p("seal", "confuse charm", G, "earth fire", "wind light"), // 雷に焼かれた祭主の祈り
  bs_cyclonedjinn: p("seal", "sleep charm confuse", "", "fire earth", "wind", "paralyze"), // 三つの願いの術を止める
  bs_stormfrostgiant: p("sleep", "paralyze poison", "", "fire earth", "water wind", "seal"), // 氷の鎧の内の巨人
  bs_stormdrake: p("seal", "paralyze sleep charm", "", "earth water", "wind fire", "confuse"), // 雷炎の咆哮を断つ
  bs_darkcloudspawn: p("seal", "confuse charm", G, "light fire", "dark wind"), // 暗雲から滴る影の力
  bs_ruincore: p("paralyze", "seal confuse", M, "fire earth", "wind light"), // 浮遊を保つ心核の動作
  bs_galesovereign: p("seal", "sleep paralyze confuse", "", "fire earth", "wind", "charm"), // 玉座の烈風を止める
  // 旧迷宮・ランク9の魔物
  bs_hellgatehound: p("confuse", "sleep poison charm", "", "light water", "dark fire", "seal paralyze"), // 三つの喉の判断を乱す
  bs_ferrymanshade: p("charm", "seal confuse", G, "light earth", "dark water"), // 渡し賃を待つ心を惑わす
  bs_bloodjudge: p("confuse", "seal charm", G, "light water", "dark fire"), // 罪の重さを誤らせる
  bs_processionlord: p("seal", "paralyze confuse charm", D, "light wind", "dark earth"), // 列への招来を断つ
  bs_palefrostking: p("seal", "paralyze confuse", M, "fire light", "water dark"), // 凍った玉座の誓い
  bs_hellfirejailer: p("paralyze", "sleep poison charm confuse", "", "water light", "fire dark", "seal"), // 焼けた鎖を引く獄吏の腕
  bs_styxcrone: p("charm", "seal confuse", G, "light fire", "dark water"), // 未練を量る老婆の欲
  bs_duskmausoleum: p("seal", "paralyze charm confuse", D, "dark fire", "light earth"), // 廟を蘇らせる王の力
  bs_soulgaoler: p("seal", "paralyze confuse", M, "light wind", "dark earth"), // 檻の魂の錠を封じる
  // 旧迷宮・ランク10の魔物
  bs_moldern: p("confuse", "seal paralyze", "poison sleep death stone", "fire", "light dark", "charm"), // 木の器の中の古い灯と静かな心
  bs_reddragon: p("sleep", "charm confuse poison", "", "water", "fire earth", "seal"), // 財宝の山で千年眠る竜
  bs_abysslord: p("seal", "charm confuse sleep", "", "light", "dark earth", "paralyze"), // 冠の魂をつなぐ力
  bs_elderwyrmking: p("sleep", "seal charm confuse poison", "", "water light", "earth fire", "paralyze"), // 英雄を抱いて眠る古竜王
  bs_hoardwarden: p("paralyze", "seal confuse", M, "dark wind", "light earth"), // 財宝を鋳た黄金の巨像
  bs_broodmother: p("seal", "sleep poison charm confuse", "", "water", "fire earth", "paralyze"), // 卵を抱く母竜は眠りにくい
  bs_dracolich: p("seal", "paralyze charm confuse", D, "light fire", "dark earth"), // 屍竜の骨を継ぐ死の術
  bs_frostwyrmlord: p("seal", "sleep paralyze charm", "", "fire earth", "water", "confuse"), // 氷に半身を封じられた白竜
  bs_abyssdrake: p("confuse", "sleep charm", "", "light fire", "dark wind", "seal paralyze"), // 落ちる者を玩ぶ影竜
  bs_dragongodshade: p("seal", "confuse charm", G, "dark water", "light fire"), // 信仰で神の形を保つ残影
  bs_twilightdragon: p("paralyze", "sleep charm confuse", "", "dark water", "light fire", "seal"), // 黄昏の厚い鱗の神経
  // 出来事専用・金属の魔物
  bs_cagewarden: p("sleep confuse", "paralyze flinch", "", "light water", "dark earth", "seal"), // 檻兜の獄卒はしびれに慣れる
  mt_silver: p("", "", "poison paralyze sleep charm confuse stone seal flinch death", "", ""), // 銀肌は会心以外を拒む
  mt_gold: p("", "", "poison paralyze sleep charm confuse stone seal flinch death", "", ""), // 金肌と素早い逃げ足
  mt_king: p("", "", "poison paralyze sleep charm confuse stone seal flinch death", "", ""), // 白金の王も状態異常を拒む
};

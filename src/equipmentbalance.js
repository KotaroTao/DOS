// 全装備の割合効果の調整。数値の基準はレア度・入手時期・部位、属性は個別の来歴で決める。
import { rarityKey } from "./rarity.js";

// 防具の加護の色ではなく、実際に防ぐ属性。本文の防御対象・素材・舞台を確認した台帳。
export const EQUIPMENT_DEFENSE_TARGETS = {
  "amberTalisman": ["earth"], // 琥珀の守符
  "tideBead": ["fire"], // 潮霊の数珠
  "gravewardBell": ["dark"], // 墓守の鈴
  "dragonboneRing": ["fire"], // 竜骨の指輪
  "s_gravemound": ["water"], // 塚守りの盾
  "s_emberfan": ["fire", "wind"], // おき火の丸盾
  "s_tidewall": ["fire"], // 潮壁の盾
  "s_galewing": ["earth"], // 風まといの小盾
  "s_flameguard": ["wind"], // フレイムガード
  "s_palebell": ["light"], // 弔鐘の円盾
  "s_quarrybreak": ["water"], // 石切りの大盾
  "s_dawnpetal": ["dark"], // 暁の花弁
  "s_brinefang": ["fire"], // 海蛇の盾鱗
  "s_stormeye": ["earth"], // 嵐の瞳
  "s_pyrelaw": ["wind"], // 火葬律の盾
  "s_haloround": ["dark"], // 光輪の円盾
  "s_rootheart": ["water"], // 大樹の心材
  "s_ghoulfeast": ["light"], // 屍宴の皿
  "s_oldwall": ["water"], // 王都旧壁の盾
  "s_abysslid": ["fire"], // 深淵の蓋
  "s_cinderking": ["wind"], // 灰の王の盾
  "s_nightgrave": ["light"], // ひつぎ盾ニグレド
  "s_skyburial": ["earth"], // 天葬の翼
  "s_graillight": ["dark"], // 聖杯の光背
  "a_tidewrap": ["fire"], // 潮霧の油マント
  "a_forgeapron": ["fire", "wind"], // 火床の前垂れ
  "a_galecloak": ["earth"], // 旋風の陣羽織
  "a_palljacket": ["light"], // 棺掛けの胴着
  "a_claygolem": ["water"], // 土人業の外殻
  "a_dawnplate": ["dark"], // 払暁の聖板金
  "a_sirensilk": ["fire"], // 海妖歌いの絹衣
  "a_barrowplate": ["water"], // 古墳王の甲
  "a_emberbrand": ["wind"], // 焼印師の焦げ甲
  "a_windscript": ["earth"], // 風詠みの写本衣
  "a_relicward": ["dark"], // 聖遺物箱の板金
  "a_depthscale": ["fire"], // 深海魚の鱗鎧
  "a_nightchant": ["light"], // 闇詠みの聖句衣
  "a_mountroot": ["water"], // 山根の岩鎧
  "a_leviascale": ["fire"], // 海帝の冠鱗
  "a_stormcaller": ["earth"], // 嵐喚びの祭衣
  "a_furnaceknight": ["wind"], // 焔獄の炉心甲
  "a_fleshgrave": ["light"], // 屍肉のひつぎ鎧
  "a_seraphmail": ["dark"], // 熾天の羽衣鎧
  "a_holyground": ["dark"], // 不可侵聖域の白鎧
  "h_boartusk_helm": ["water"], // 猪頭の骨兜
  "h_martyr_thorn_crown": ["dark"], // 殉教者の茨冠
  "h_mourner_veil": ["light"], // 会葬者のベール
  "h_bog_leech_helm": ["fire"], // 沼ヒルの革兜
  "h_stormcrier_hat": ["earth"], // 嵐呼びのつば広帽
  "h_ember_guard_helm": ["wind"], // おき火の戦兜
  "h_sunken_river_crown": ["fire"], // 沈み川の宝冠
  "h_crag_sentry_helm": ["water"], // 岩番の重兜
  "h_crematory_grate_helm": ["wind"], // 火葬炉の面格子
  "h_wolfwind_helm": ["earth"], // 狼おろしの羽兜
  "h_fallen_king_circlet": ["light"], // 廃王の額環
  "h_ash_knight_armet": ["wind"], // 灰の騎士の兜
  "h_stone_warden_greathelm": ["water"], // 石衛士の大兜
  "h_holy_candle_diadem": ["dark"], // 聖蝋の宝冠
  "h_gale_runner_helm": ["earth"], // 風走りの軽兜
  "h_abyss_bishop_crown": ["fire"], // 深淵司教の宝冠
  "h_dawn_herald_diadem": ["dark"], // 暁告げの宝冠
  "h_total_eclipse_cowl": ["light"], // 皆既蝕の頭巾
  "f_rampart_gaiters": ["water"], // 土塁兵の脚絆
  "f_drowned_fisher_boots": ["fire"], // 水死人の漁長靴
  "f_night_thief_shoes": ["light"], // 夜盗の忍びぐつ
  "f_windkick_boots": ["earth"], // 風蹴りの軽靴
  "f_firewalk_sabatons": ["fire", "wind"], // 火渡りの鉄ぐつ
  "f_lantern_pilgrim_boots": ["dark"], // 灯持ちの巡礼靴
  "f_quarry_slave_greaves": ["water"], // 採石奴の重脚甲
  "f_drownvale_webbed_boots": ["fire"], // 溺れ谷の水かき靴
  "f_shadow_silk_shoes": ["light"], // 影踏みの絹ぐつ
  "f_gale_chaser_boots": ["earth"], // 暴風追いの長靴
  "f_scorched_march_greaves": ["wind"], // 焦土行軍の脚甲
  "f_relic_route_boots": ["dark"], // 聖跡巡りの白ぐつ
  "f_deep_well_greaves": ["fire"], // 深井の潜り脚甲
  "f_mountain_breaker_greaves": ["water"], // 山砕きの岩脚甲
  "f_purgatory_furnace_greaves": ["wind"], // 煉獄炉の脚甲
  "f_nightmare_hoof_boots": ["light"], // 夢魔の蹄ぐつ
  "f_storm_sovereign_boots": ["earth"], // 嵐王の渡靴
  "g_ember_grips": ["fire", "wind"], // おき火の手甲
  "g_tidecaller_gloves": ["fire"], // 潮詠みの手袋
  "g_stonewall_gauntlets": ["water"], // 石壁の重籠手
  "g_galewing_gloves": ["earth"], // 風翼の指貫
  "g_saintly_mitts": ["dark"], // 聖手の祈り手袋
  "g_dragonscale_grips": ["fire"], // 竜鱗の手甲
  "g_frostbite_gauntlets": ["fire"], // 霜噛みの籠手
  "g_godhand_gauntlets": ["dark"], // 神手の黄金籠手
  "g_tide_weave_gloves": ["fire"], // 潮織りの手袋
  "r_phoenix_plume": ["fire"], // 不死鳥の尾羽
  "s_aegis": ["dark", "fire"], // 神盾アイギス
  "a_dragonmail": ["fire"], // 竜帝の鎧
  "a_holy_vestment": ["dark"], // 大司教の聖衣
  "x_knight_shield": ["dark"], // 鉄壁の誓い盾
  "x_warden_robe": ["dark"], // 護法の法衣
  "x_archbishop_crown": ["dark"], // 巡礼聖者の宝冠
  "x_hero_shield": ["dark"], // 勇者の神盾
  "x_dragonknight_mail": ["fire"], // 竜騎士の竜鎧
  "x_sage_robe": ["dark"], // 賢者の法衣
  "x_cardinal_crown": ["dark"], // 枢機卿の宝冠
  "x_chaplain_plate": ["dark"], // 護教官の鎧
  "lr_a5_head_hv2": ["dark"], // 久遠の覇兜
  "lr_a5_body_hv2": ["dark"], // 久遠の覇鎧
  "lr_a5_hand_hv2": ["dark"], // 久遠の覇籠手
  "lr_a5_shield_k2": ["dark"], // 久遠の覇盾
  "lr_a10_head_hv2": ["dark"], // 常世の覇兜
  "lr_a10_body_hv2": ["dark"], // 常世の覇鎧
  "lr_a10_hand_hv2": ["dark"], // 常世の覇籠手
  "lr_a10_shield_k2": ["dark"], // 常世の覇盾
  "lr_a15_head_hv2": ["dark"], // 無窮の覇兜
  "lr_a15_body_hv2": ["dark"], // 無窮の覇鎧
  "lr_a15_hand_hv2": ["dark"], // 無窮の覇籠手
  "lr_a15_shield_k2": ["dark"], // 無窮の覇盾
  "lr_a20_head_hv2": ["dark"], // 永劫の覇兜
  "lr_a20_body_hv2": ["dark"], // 永劫の覇鎧
  "lr_a20_hand_hv2": ["dark"], // 永劫の覇籠手
  "lr_a20_shield_k2": ["dark"], // 永劫の覇盾
  "a_sr1_wardenmail": ["dark"], // 墓守のくさりかたびら
  "s_sr1_urnlid": ["dark"], // 骨壺蓋の小盾
  "s_sr1_friarbook": ["dark"], // 修道士の葬送祈祷書
  "r_sr1_lanternamulet": ["dark"], // 鎮魂灯の護符
  "lr_l1_gravewardenplate": ["dark"], // 墓守王の黒鎧
  "r_sr2_leechward": ["water"], // ヒル封じの指輪
  "f_sr2_waders": ["water"], // 水渡りの長靴
  "a_sr2_scalecoat": ["water"], // 鱗つづりの胴着
  "s_sr2_draingrate": ["water"], // 排水格子の小盾
  "s_sr2_wellbook": ["water"], // 井戸守りの聖典
  "r_sr2_clearwater": ["water"], // 澄み水の護符
  "lr_l2_sewerwardmail": ["water"], // 水路衛士の重鎧
  "a_sr3_orevest": ["earth"], // 鉱石つづりの胴衣
  "f_sr3_hobnailboots": ["earth"], // 坑道踏みのびょう靴
  "r_sr3_canarycharm": ["earth"], // カナリアの籠飾り
  "s_sr3_cartwheel": ["earth"], // 鉱車輪の小盾
  "s_sr3_minerledger": ["earth"], // 坑夫の弔い帳
  "lr_l3_overseerplate": ["earth"], // 坑監の黒鉄鎧
  "h_sr4_sentryhelm": ["wind"], // 見張りの鉢金
  "a_sr4_garrisonmail": ["wind"], // 守備隊のくさりかたびら
  "f_sr4_rampartboots": ["wind"], // 城壁走りの長靴
  "s_sr4_pavise": ["dark"], // 攻城の置き盾
  "s_sr4_couriertarge": ["wind"], // 伝令の烽火盾
  "s_sr4_cellbook": ["dark"], // 獄中の聖典
  "a_sr4_chaplainrobe": ["dark"], // 従軍司祭の法衣
  "r_sr4_rollcall": ["dark"], // 点呼の名札
  "lr_l4_lastbanner": ["dark"], // 最後の軍旗の盾
  "a_sr5_mossmail": ["fire"], // 苔衣のくさりかたびら
  "f_sr5_rootwalkers": ["earth"], // 根渡りの長靴
  "s_sr5_burlbuckler": ["earth"], // 木こぶの小盾
  "a_sr5_gardenrobe": ["fire"], // 庭師の長衣
  "r_sr5_soulfruit": ["earth"], // 魂の実の首飾り
  "lr_l5_barkplate": ["fire"], // 大樹の心材鎧
  "f_sr6_pilgrimshoes": ["water"], // 参道の巡礼靴
  "a_sr6_templescale": ["water"], // 神殿衛士の鱗鎧
  "h_sr6_choirhood": ["light"], // 聖歌隊の頭巾
  "s_sr6_altarstone": ["water"], // 祭壇石の大盾
  "s_sr6_drownedhymnal": ["dark"], // 溺れた聖歌集
  "a_sr6_baptismrobe": ["dark"], // 洗礼の白衣
  "r_sr6_offeringbell": ["light"], // 供物の鈴
  "lr_l6_fontplate": ["water"], // 洗礼泉の聖鎧
  "lr_l6_sunkenaltar": ["dark"], // 沈める祭壇の大盾
  "a_sr7_ashplate": ["fire"], // 灰被りの重鎧
  "a_sr7_firewardrobe": ["fire"], // 火守りの法衣
  "r_sr7_dewring": ["fire"], // 露玉の指輪
  "lr_l7_quenchplate": ["fire"], // 火消しの鎧
  "lr_l7_lavagreaves": ["fire"], // 溶岩渡りの鉄靴
  "a_sr8_wardenplate": ["water"], // 回廊衛士の鎧
  "a_sr8_weaverrobe": ["water"], // 操霊師の雪衣
  "s_sr8_frozenprayer": ["water"], // 凍てついた祈りの書
  "r_sr8_auroraring": ["water"], // 極光の指輪
  "lr_l8_glacierplate": ["water"], // 氷河の大鎧
  "s_sr9_ferryshield": ["earth"], // 渡し板の円盾
  "a_sr9_bogplate": ["earth"], // 沼渡りの重鎧
  "a_sr9_herbrobe": ["dark"], // 薬草摘みの法衣
  "s_sr9_plaguetome": ["dark"], // 疫病除けの祈りの書
  "r_sr9_herbpouch": ["water"], // 毒消し草の香り袋
  "lr_l9_reedwatchplate": ["earth"], // 葦原の見張りの鎧
  "lr_l9_floatcharm": ["water", "dark"], // 浮かび上がる舟守りの護符
  "s_sr10_bellshield": ["wind"], // 鐘楼の円盾
  "a_sr10_spiralplate": ["wind"], // 螺旋衛士の重鎧
  "a_sr10_gardenrobe": ["dark"], // 雲上の庭師の法衣
  "s_sr10_stormtome": ["wind"], // 雷除けの祈りの書
  "r_sr10_feathercharm": ["wind"], // 雷鳥の羽根飾り
  "lr_l10_rodplate": ["wind"], // 避雷の大鎧
  "lr_l10_springdrop": ["wind"], // 雲上の泉の雫
  "s_sr11_parma": ["dark"], // 闘士の丸盾
  "a_sr11_chainplate": ["earth"], // 鎖巻きの重鎧
  "a_sr11_emberrobe": ["fire"], // 熾火の祭司の法衣
  "s_sr11_victortome": ["dark"], // 勝者の名を記した書
  "r_sr11_tally": ["earth"], // 勝ち残りの木札
  "lr_l11_bridgeplate": ["fire"], // 退かずの大鎧
  "lr_l11_ovation": ["dark"], // 満場の喝采の首飾り
  "s_sr12_lakeshield": ["dark"], // 地底湖の円盾
  "a_sr12_stoneplate": ["earth"], // 岩肌の重鎧
  "a_sr12_myceliumrobe": ["dark"], // 菌糸の法衣
  "s_sr12_lamptome": ["dark"], // 灯籠の数え帳
  "r_sr12_cavepearl": ["earth"], // 洞の真珠の首飾り
  "lr_l12_fossilplate": ["earth"], // 化石竜のあばら鎧
  "lr_l12_clearlamp": ["dark"], // 濁らぬ灯の首飾り
  "r_nm_cryptlord": ["dark"], // 墓所の君主の指輪
  "s_nm_drownedpaladin": ["water"], // 沈みし聖騎士の大盾
  "s_nm_eldertreant": ["earth"], // 古樹の樹皮盾
  "a_nm_mistmother": ["water", "wind"], // 霧繭の薄衣
  "h_nm_fallenidol": ["light"], // 堕ちた神像の石冠
  "r_nm_cinderking": ["fire"], // 残り火の王の燃えさし
  "a_nm_magmawyrm": ["fire"], // 溶鉄の蛇竜の鱗鎧
  "s_nm_glacialmaw": ["water"], // 氷河の大顎の牙盾
  "r_nm_offeringslime": ["dark"], // るつぼの底の金環
  "s_nm_oremaw": ["earth"], // 鉱脈喰らいの岩殻盾
  "a_r4_faeweave": ["wind"], // 妖精織りの鎧
  "s_r4_aegisshield": ["dark"], // 聖印の大盾
  "s_r4_emberbuckler": ["wind"], // 熾火のバックラー
  "s_r4_candlescripture": ["dark"], // 銀燭の聖典
  "a_r5_wyvernhide": ["fire"], // 飛竜革の鎧
  "s_r5_runebulwark": ["earth"], // 守護のルーン大盾
  "s_r5_wyvernbuckler": ["wind", "earth"], // 飛竜革のバックラー
  "s_r5_adamantscripture": ["dark"], // アダマンとじの聖典
  "a_r6_holydragonhide": ["dark"], // 聖竜革の鎧
  "s_r6_holydragonshield": ["dark"], // 聖竜の大盾
  "s_r6_dragonscalebuckler": ["fire", "wind"], // 竜鱗のバックラー
  "s_r6_holydragonsutra": ["dark"], // 聖竜の経典
  "a_r7_faeweave": ["wind"], // 妖精絹の鎧
  "s_r7_spiritshield": ["dark"], // 霊光の大盾
  "s_r7_fairybuckler": ["wind"], // 妖精銀のバックラー
  "s_r7_astralsutra": ["dark"], // 星辰の経典
  "a_r8_winddragonhide": ["wind"], // 風竜革の鎧
  "s_r8_dragonemperorshield": ["fire"], // 竜帝の大盾
  "s_r8_winddragonbuckler": ["wind"], // 風竜鱗の手盾
  "s_r8_revelationscripture": ["dark"], // 天啓の経典
  "a_r9_waterdragonhide": ["fire"], // 水竜革の鎧
  "s_r9_dragongodshield": ["fire"], // 竜神の大盾
  "s_r9_dragongodbuckler": ["fire"], // 竜神鱗のバックラー
  "s_r9_holyspringprayer": ["fire"], // 聖泉の祈祷書
  "a_r10_earthdragonhide": ["earth", "wind"], // 地竜革の鎧
  "s_r10_dragonkingshield": ["earth"], // 竜王の大盾
  "s_r10_skysoarbuckler": ["earth"], // 天翔の手盾
  "s_r10_earthhymnscripture": ["water"], // 大地讃頌の経典
  "a_r11_lightdragonhide": ["dark"], // 光竜革の鎧
  "s_r11_heavenemperorshield": ["dark"], // 天帝の大盾
  "s_r11_sunhazebuckler": ["wind"], // 陽炎の手盾
  "s_r11_heavenscripture": ["dark"], // 天帝の聖典
  "a_r12_darkdragonhide": ["light"], // 闇竜革の鎧
  "s_r12_seraphshield": ["dark"], // 熾天の大盾
  "s_r12_iwakurabuckler": ["water"], // 磐座の手盾
  "s_r12_seraphscripture": ["dark"], // 熾天の聖典
  "a_r13_heavendragonhide": ["dark"], // 天竜革の鎧
  "s_r13_messiahshield": ["dark"], // 救世主の大盾
  "s_r13_pilgrimbuckler": ["water"], // 巡礼者の手盾
  "s_r13_messiahscripture": ["dark"], // 救世主の聖典
  "a_r14_greendragonhide": ["wind"], // 翠竜革の鎧
  "s_r14_dragonkingshield": ["fire"], // 龍王の大盾
  "s_r14_azurebuckler": ["earth"], // 蒼龍の手盾
  "s_r14_yellowdragonscripture": ["water"], // 黄龍の聖典
  "a_r15_stardragonhide": ["dark"], // 星竜革の鎧
  "s_r15_legendshield": ["dark"], // 伝説の大盾
  "s_r15_sagabuckler": ["earth"], // 武勇伝の手盾
  "s_r15_sagascripture": ["dark"], // 伝承の聖典
  "a_r16_primordialdragonhide": ["light"], // 原初竜革の鎧
  "s_r16_genesisshield": ["dark"], // 創世の大盾
  "s_r16_genesisbuckler": ["fire"], // 創世のバックラー
  "s_r16_genesisscripture": ["earth"], // 創世記の聖典
  "a_r17_divinedragonhide": ["dark"], // 神竜革の鎧
  "s_r17_artifactshield": ["dark"], // 神器の大盾
  "s_r17_artifactbuckler": ["wind"], // 神器の手盾
  "s_r17_artifactscripture": ["fire"], // 神器の経典
  "a_r18_cosmosdragonhide": ["wind"], // 星海竜革の鎧
  "s_r18_cosmosshield": ["dark"], // 星海の大盾
  "s_r18_meteorbuckler": ["earth"], // 流星の手盾
  "s_r18_cosmosscripture": ["water"], // 星海の経典
  "a_r19_heavendragonhide": ["dark"], // 天恵竜革の鎧
  "s_r19_heavengraceshield": ["dark"], // 天恵の大盾
  "s_r19_empyreanbuckler": ["water"], // 至高天の手盾
  "s_r19_heavengracescripture": ["dark"], // 天恵の聖典
  "a_r20_enddragonhide": ["light"], // 終焉竜革の鎧
  "s_r20_omnishield": ["dark"], // 万象の大盾
  "s_r20_omnibuckler": ["fire"], // 万象の手盾
  "s_r20_omniscripture": ["dark"], // 万象の経典
};

// 確定首級24点の指定済み性能。再調整の自動帯へ含めない。
const FIXED_TROPHIES = {
  "w_nm_palebutcher": {"onHit":{"k":"paralyze","chance":0.2}},
  "r_nm_cryptlord": {"eDef":{"el":"dark","pct":40,"values":{"dark":40},"kind":"defense"},"elementTint":"light","eff":{"soulUp":0.1}},
  "g_nm_bloatqueen": {"eff":{"lifesteal":0.05}},
  "s_nm_drownedpaladin": {"eDef":{"el":"water","pct":50,"values":{"water":50},"kind":"defense"},"elementTint":"earth","eff":{"guard":0.05}},
  "w_nm_chainoverseer": {"eff":{"multistrike":2}},
  "w_nm_crystalseer": {"eAtk":{"el":"wind","pct":25},"element":"wind","elementTint":"wind","aRes":{"stone":0.4},"eff":{"spellCostMul":0.9}},
  "w_nm_warbanner": {"eAtk":{"el":"fire","pct":35},"element":"fire","elementTint":"fire"},
  "w_nm_headsman": {},
  "s_nm_eldertreant": {"eDef":{"el":"earth","pct":80,"values":{"earth":80},"kind":"defense"},"elementTint":"wind","bRes":0.25,"eff":{"regen":0.03}},
  "a_nm_mistmother": {"eDef":{"el":"water","pct":70,"values":{"water":70,"wind":40},"kind":"defense"},"elementTint":"wind","aRes":{"paralyze":0.3,"sleep":0.3}},
  "w_nm_heresiarch": {"eAtk":{"el":"light","pct":30},"element":"light","elementTint":"light","eff":{"lifesteal":0.05}},
  "h_nm_fallenidol": {"eDef":{"el":"light","pct":50,"values":{"light":50},"kind":"defense"},"elementTint":"dark"},
  "r_nm_cinderking": {"eDef":{"el":"fire","pct":60,"values":{"fire":60},"kind":"defense"},"elementTint":"water","bRes":0.2,"eff":{"regen":0.03}},
  "a_nm_magmawyrm": {"eDef":{"el":"fire","pct":90,"values":{"fire":90},"kind":"defense"},"elementTint":"water","bRes":0.3},
  "w_nm_frostsovereign": {"eAtk":{"el":"earth","pct":30},"element":"earth","elementTint":"earth","onHit":{"k":"paralyze","chance":0.2}},
  "s_nm_glacialmaw": {"eDef":{"el":"water","pct":70,"values":{"water":70},"kind":"defense"},"elementTint":"earth","bRes":0.3,"eff":{"guard":0.05}},
  "r_nm_offeringslime": {"eDef":{"el":"dark","pct":60,"values":{"dark":60},"kind":"defense"},"elementTint":"light","aRes":{"poison":0.3},"eff":{"goldUp":0.1}},
  "w_nm_bogfrogking": {"eAtk":{"el":"wind","pct":30},"element":"wind","elementTint":"wind","onHit":{"k":"paralyze","chance":0.2}},
  "w_nm_blizzardwitch": {"eAtk":{"el":"fire","pct":30},"element":"fire","elementTint":"fire","aRes":{"sleep":0.3},"eff":{"spellCostMul":0.9}},
  "w_nm_stareater": {"eAtk":{"el":"light","pct":30},"element":"light","elementTint":"light","eff":{"lifesteal":0.05}},
  "w_nm_ashshogun": {"eff":{"regen":0.03}},
  "a_nm_dragonslayer": {"bRes":0.3},
  "s_nm_oremaw": {"eDef":{"el":"earth","pct":100,"values":{"earth":100},"kind":"defense"},"elementTint":"wind","aRes":{"stone":0.3}},
  "h_nm_tunnelking": {"aRes":{"confuse":0.3},"eff":{"soulUp":0.1}},
};

export const EQUIPMENT_BALANCE_VERSION = 2;
const SLOTS = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);
const ATTACK_BANDS = { c:[10,20], uc:[20,30], r:[30,50], sr:[40,80], lr:[60,100] };
// 武魂Lv1の5%軽減を1段として、装備だけで上限を埋めない。
const DEFENSE_BANDS = { c:[5,10], uc:[5,15], r:[10,20], sr:[15,25], lr:[20,30] };
const AILMENT_BANDS = { c:[5,15], uc:[10,20], r:[15,25], sr:[20,35], lr:[25,45] };
const DEFENSE_SLOT = { body:1.2, shield:1.1, head:.8, hands:.7, feet:.7, acc:.9, weapon:.7 };
const roundStep = (v, step) => Math.round(v / step) * step;
const pct5 = v => Math.max(.05, Math.min(.95, roundStep(v * 100, 5) / 100));
const valueAt = (band, it) => band[0] + (band[1]-band[0]) * Math.max(0, Math.min(1, ((it.lv || 1)-1)/199));

// 個別に用途を残す調整。低層の万能耐性を、由来に合った複数の専門耐性へ変える。
const SPECIAL = {
  lr_bishop5: {desc:"攻と癒、二つの理を一本に束ねた法杖。司教の光の攻撃を強め、杖に宿るPIEが祈りを支える。属性の加護が強めるのは光の傷だけだ。"},
  lr_bishop10: {desc:"二理の聖杖に守の祈りを重ねた大法杖。司教の光の攻撃をさらに強め、積み重なった祈りが使い手の心を支える。"},
  lr_bishop15: {desc:"三理の大聖杖を、歴代の司教が磨き継いだ神聖杖。杖に宿る光が光の刃と攻撃呪文を強め、使い手の祈りを支える。"},
  lr_l1_saintmace: {desc:"殉教者の遺骨を芯に封じた鉄槌。振るう者の傷を聖なる光が少しずつ塞ぎ、打ち下ろす光の一撃で闇に立ち向かう。"},
  s_emberfan: {desc:"火伏せの村で、かまどの神に捧げられていた丸盾。表面の炎の幕が火の熱と風の刃を和らげる。加護を保つため、毎朝かまどの灰で磨かれていた。"},
  s_flameguard: {desc:"炎の聖印をいただく騎士団に伝わった盾。表面に揺らぐ見えない炎が、吹きつける風の刃を焼き鈍らせて持ち手を守る。"},
  r_phoenix_plume: {desc:"灰から蘇る霊鳥が残した一枚の尾羽。おき火のような温もりが持ち主を包み、同じ火から生まれる熱の害を和らげる。"},
  w_r4_flameknife: {desc:"刃が常にほのかな熱を帯びた魔法の小刀。突き立てた傷口を焼き、抜き去った後にも灼熱の痛みを残す。"},
  w_r4_frostspear: {desc:"長い柄の穂先が白い霜をまとう魔法の槍。両手で突き込めば冷えが傷口を走り、抜いた刃にも霜の縁が残る。"},
  w_r7_frostspear: {desc:"長い柄の穂先が常に凍気を帯びた魔法の槍。両手で突き立てれば傷口が凍りつき、冷たい水の力が一撃に重なる。"},
  lr_l1_shroudofstillness: { aRes:{sleep:.4,charm:.4,confuse:.4,death:.3}, removeImmune:true,
    desc:"千年眠り続けた聖女の亡骸を包んでいた布。眠りと心の乱れ、死を誘う呪いを和らげるが、あらゆる毒を防ぐ布ではない。" },
  lr_l3_silentcanary: { aRes:{poison:.45,paralyze:.3,stone:.3}, removeImmune:true,
    desc:"毒気の満ちた坑で最後まで生き延びたカナリアを、金に封じた指輪。坑の毒、痺れ、石の呪いに備えるための守りで、心を奪う声までは防げない。" },
  lr_l8_frostcrown: { aRes:{paralyze:.45,confuse:.45,charm:.3,stone:.25,sleep:.25}, removeImmune:true,
    desc:"凍王が回廊の入口に残した最初の冠。かぶる者の心と身を氷のように静め、痺れや惑わしを和らげる。毒を洗い流す力は持たない。" },
  lr_l1_requiemblade: { desc:"百の迷宮が口を開けた夜、最初の墓守が振るったと伝わる剣。刃は二度歌って傷を重ね、眠りの力は一振りの終わりに一度だけ敵を誘う。" },
  g_frostbite_gauntlets: { desc:"氷河に千年埋もれていた籠手。中の手はとうに無く、霜だけが形を保つ。まとう冷気が業火の熱を奪い、握る手を炎から守る。" },
  emberRing: { desc:"決して冷めないおき火をはめ込んだ指輪。火の宿った刃や火の呪文を強めるが、無属性の武器に火を宿す力はない。" },
  lr_l9_floatcharm: { desc:"沈んだ舟のへさきに結ばれていた木彫りの護符。水と闇の害を和らげ、持ち主が倒れれば、一戦に一度だけ命を呼び戻す。" },
};
export function retuneEquipment(it) {
  if (!it || !SLOTS.has(it.slot) || it.equipmentBalanceVersion === EQUIPMENT_BALANCE_VERSION) return it;
  // 指定済みの確定首級は数値・重複の仕方まで保持する。
  if (it.trophy && FIXED_TROPHIES[it.id]) { Object.assign(it, structuredClone(FIXED_TROPHIES[it.id])); it.equipmentBalanceVersion = EQUIPMENT_BALANCE_VERSION; return it; }
  const rar = rarityKey(it) || "c";
  // 加護の色は来歴の一部なので、防御対象を変えても絵の色は変えない。
  it.elementTint = it.elementTint || it.eAtk?.el || it.eDef?.el || it.element || Object.keys(it.eAtk?.values || it.eDef?.values || it.eDef?.reductions || {})[0];
  if (it.eAtk) {
    const old = it.eAtk;
    if (old.lv != null) {
      const slotMul = it.slot === "weapon" ? 1 : .6;
      const amount = Math.max(10, roundStep((valueAt(ATTACK_BANDS[rar],it) + (old.lv >= 2 ? 20 : 0)) * slotMul,10));
      it.eAtk = {el:old.el,pct:amount};
    }
    // 属性を持つ武器だけが属性を付与する。防具や護符の属攻は増幅のみ。
    if (it.slot === "weapon") it.element = it.element || old.el;
  }
  if (it.eDef?.lv != null) {
    const targets = EQUIPMENT_DEFENSE_TARGETS[it.id];
    if (!targets) throw new Error("防ぐ属性の確認が必要: " + it.id);
    const amount = Math.min(35,Math.max(5,roundStep(valueAt(DEFENSE_BANDS[rar],it) * DEFENSE_SLOT[it.slot] + (it.eDef.lv >= 2 ? 5 : 0),5)));
    it.eDef = {kind:"defense",reductions:Object.fromEntries(targets.map((k,i)=>[k,(i ? Math.max(5,roundStep(amount*.5,5)) : amount)/100]))};
  }
  if (it.aRes) {
    const [lo,hi]=AILMENT_BANDS[rar], stage=valueAt([0,1],it);
    it.aRes = Object.fromEntries(Object.entries(it.aRes).map(([k,v])=>[k,roundStep(lo+(hi-lo)*Math.min(1,v*.75+stage*.25),5)/100]));
  }
  if (it.bRes) it.bRes = Math.min(.4,pct5(it.bRes));
  if (it.onHit) {
    const list = Array.isArray(it.onHit) ? it.onHit : [it.onHit];
    it.onHit = list.map(o=>({...o,chance:pct5(o.chance)}));
    if (it.onHit.length === 1) it.onHit = it.onHit[0];
  }
  // 固定首級の3%再生などは固有の値を保つ。一般品の恒常軽減は5%刻みにそろえる。
  if (it.eff && !it.trophy) it.eff = Object.fromEntries(Object.entries(it.eff).map(([k,v])=>[k,["guard","lifesteal","regen"].includes(k) ? pct5(v) : v]));
  const special = SPECIAL[it.id];
  if (special) {
    if (special.removeImmune) { it.eff = {...it.eff}; delete it.eff.ailmentImmune; if (!Object.keys(it.eff).length) delete it.eff; }
    if (special.aRes) it.aRes = {...special.aRes};
    if (special.desc) it.desc = special.desc;
  }
  it.equipmentBalanceVersion = EQUIPMENT_BALANCE_VERSION;
  return it;
}

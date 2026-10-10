// 街の施設の情景の原画の台帳 — tools/townart/build.py が書く。手で直さない。
// 鍵は townart.js の vignetteCanvas の鍵 (tavern / inn / shrine)。null の間は従来のドット絵を出す。
// focus = 切り取りの中心 / lights = 揺らぐ明かり [{at:[x,y], r, tone}] (どれも原画の幅・高さに対する割合。r は高さに対する半径)
// <<TOWN_KEYART>>
export const TOWN_KEYART = {
  tavern: {"src": "./art/town/tavern.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.5032552083333334, 0.21484375], "r": 0.06, "tone": "lamp"}, {"at": [0.935546875, 0.5234375], "r": 0.085, "tone": "fire"}, {"at": [0.5423177083333334, 0.5986328125], "r": 0.025, "tone": "candle"}, {"at": [0.7109375, 0.2734375], "r": 0.023, "tone": "lamp"}, {"at": [0.9029947916666666, 0.2333984375], "r": 0.023, "tone": "candle"}]},
  inn: null,
  shrine: null,
};
// <</TOWN_KEYART>>

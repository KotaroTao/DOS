// タイトル画面の原画の台帳 — tools/titleart/build.py が書く。手で直さない。
// wide = 横長の画面用 / tall = 縦長の画面用。null の間は従来のドット絵 (titleart.js) を出す。
// gate = 門の魂火の中心 / gateR = その大きさ / lamp = ランタンの火 / lampR / fogY = 霧の帯の高さ (どれも原画の幅・高さに対する割合)
// <<TITLE_KEYART>>
export const TITLE_KEYART = {
  wide: {"src": "./art/title/keyart-wide.webp", "w": 2400, "h": 1600, "gate": [0.4916666667, 0.54125], "gateR": 0.021, "lamp": [0.6291666667, 0.57875], "lampR": 0.0125, "fogY": 0.67},
  tall: {"src": "./art/title/keyart-tall.webp", "w": 1600, "h": 2400, "gate": [0.490625, 0.5770833333], "gateR": 0.021, "lamp": [0.63, 0.6116666667], "lampR": 0.0125, "fogY": 0.675},
};
// <</TITLE_KEYART>>

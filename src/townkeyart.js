// 街の施設の情景の原画の台帳 — tools/townart/build.py が書く。手で直さない。
// 鍵は townart.js の vignetteCanvas の鍵 (tavern / inn / shrine)。null の間は従来のドット絵を出す。
// focus = 切り取りの中心 / lights = 揺らぐ明かり [{at:[x,y], r, tone}] (どれも原画の幅・高さに対する割合。r は高さに対する半径)
// <<TOWN_KEYART>>
export const TOWN_KEYART = {
  tavern: null,
  inn: null,
  shrine: null,
};
// <</TOWN_KEYART>>

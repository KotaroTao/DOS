// マウスを接続したタブレットでも、従来の画面を保つ。
// 窓の幅・高さと主ポインターの条件は desktop.css が判定する。
document.documentElement.classList.toggle("pc-input", (navigator.maxTouchPoints || 0) === 0);

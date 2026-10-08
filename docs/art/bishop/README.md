# 司教（bishop）の職業画像

聖戦士（crusader）を描画基準にし、ユーザー承認済みR1を直接参照して制作する。
大司教（archbishop）とは別の職業。

既存画像の特徴は、金髪の若い男性、白と青の司教冠、白青の法衣、茶色の革装備、青い宝玉を持つ金の法環の杖と書物。

- R1：控えめな金縁と基本の法衣。
- R2：金縁を増やし、杖に青白の垂れ布を追加。
- R3：冠と肩に宝玉と金飾りを追加。帯と法衣を重ねる。
- R4：冠・肩・胸の礼装を強化し、法衣と垂れ布の刺繍を増やす。
- R5：宝玉の冠、放射状の法環、豪華な重ね衣と刺繍を最大にする。

各ランクを独立した透明背景画像として制作。mainへのマージは行わない。

## 採用と確認

`bishop-r1-draft.png` がユーザー承認済みのR1。`bishop-r1-final.png` は冠を低くして共通枠に収めた採用版。R2〜R5も各1枚ずつ生成し、R4・R5は冠の高さのみ追加調整した。原画のドット化・減色はしていない。

測定・推定値は `import-settings.json`。冠で隠れた人体の頭頂は推定値であり、顎・透過輪郭の足元を測って基準頭身と目の高さから合わせた。原画の顔中心もランクごとに測定。取り込みは既存 `tools/jobimg.py` の共通枠90×92・頭頂9で行った。境界の半透明画素を含めても欠けないよう足元に4原画pxの余白を見込んでいる。

出荷画像は `art/jobs/bishop_1.webp`〜`bishop_5.webp`。`src/jobphotos.js` に登録し、優先されていた `src/jobart.js` の司教5ランクのみ削除した。`sw.js` のASSETSに画像を追加し、CACHEは `dos-dev` を維持。

`final-review.png` は実際の `jobSprite`／`jobBust`／`crispCanvas` による聖戦士との同倍率比較。全身6枚、56/36/26pxと180pxの顔24枚、全30キャンバスの非空描画・画像読込・全ランクの画像選択・顔と頭頂座標・ゲーム起動をChromiumで確認し、ブラウザエラーは0件。`final-review.json` に結果を保存。画像枠の透過と冠・杖・法衣・靴の欠けを目視確認。JS構文チェックと `git diff --check` も通過。

再取り込み:

```python
import json
import subprocess
settings = json.load(open("docs/art/bishop/import-settings.json"))
rows = settings["sources"]
subprocess.run([
    "python3", "tools/jobimg.py", "bishop", *[r["source"] for r in rows],
    "--per-dot", ",".join(str(r["perDot"]) for r in rows),
    "--head", *[",".join(str(v) for v in r["head"]) for r in rows],
    "--frame", "90,92", "--frame-top", "9",
    "--preview", "docs/art/bishop/import-preview.png",
], check=True)
```

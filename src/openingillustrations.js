// 六幕を同じ色調で描いたドット絵。元の描画は画像が使えない時に残す。
import { SCENES as ORIGINAL_SCENES, setReduced } from "./openingart.js";

export { setReduced };

const atlas = typeof Image === "function" ? new Image() : null;
if (atlas) atlas.src = new URL("../art/opening/scenes.png", import.meta.url).href;

function illustratedShot(index, scene, W, H) {
  let fallback = null;
  let painting = null;
  return {
    draw(g, t, cam, prog) {
      if (!atlas || !atlas.complete || !atlas.naturalWidth) {
        fallback ||= scene.build(W, H);
        fallback.draw(g, t, cam, prog);
        return;
      }
      // 一幕を低解像度の画布に固定し、移動中もドットの粒を保つ。
      if (!painting) {
        painting = document.createElement("canvas");
        painting.width = 384;
        painting.height = 256;
        const p = painting.getContext("2d");
        p.imageSmoothingEnabled = false;
        const sw = atlas.naturalWidth / 2, sh = atlas.naturalHeight / 3;
        p.drawImage(atlas, (index % 2) * sw, Math.floor(index / 2) * sh,
          sw, sh, 0, 0, painting.width, painting.height);
        fallback = null;
      }
      const scale = Math.max(W / painting.width, H / painting.height) * 1.06;
      const dw = Math.ceil(painting.width * scale), dh = Math.ceil(painting.height * scale);
      const x = Math.round((W - dw) / 2 - cam.x * (dw - W) * 0.16);
      const y = Math.round((H - dh) / 2 - cam.y * (dh - H) * 0.16);
      g.imageSmoothingEnabled = false;
      g.globalAlpha = 1;
      g.drawImage(painting, x, y, dw, dh);
    },
  };
}

export const SCENES = ORIGINAL_SCENES.map((scene, index) => ({
  ...scene,
  build: (W, H) => illustratedShot(index, scene, W, H),
}));

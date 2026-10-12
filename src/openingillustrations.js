// 六幕を物語と同じ原画で映す。画像が使えない時は元の低解像度描画へ戻す。
import { SCENES as ORIGINAL_SCENES, setReduced } from "./openingart.js";
import { pickRes } from "./pxpaint.js";

export { setReduced };

export const OPENING_IMAGES = [
  { src: "art/opening/rift.webp", focus: [0.5, 0.5] },
  { src: "art/opening/fallen.webp", focus: [0.5, 0.55] },
  { src: "art/story/first-vessel-awakening.webp", focus: [0.53, 0.56] },
  { src: "art/opening/ordo.webp", focus: [0.53, 0.5] },
  { src: "art/opening/letter.webp", focus: [0.5, 0.56] },
  { src: "art/story/irene-soul-lamp.webp", focus: [0.7, 0.56] },
];

const images = OPENING_IMAGES.map(({ src }) => {
  if (typeof Image !== "function") return null;
  const image = new Image();
  image.decoding = "async";
  image.src = new URL("../" + src, import.meta.url).href;
  return image;
});

function illustratedShot(index, scene, W, H) {
  let fallback = null;
  let fallbackCanvas = null;
  const image = images[index];
  const { focus } = OPENING_IMAGES[index];
  return {
    draw(g, t, cam, prog) {
      if (!image || !image.complete || !image.naturalWidth) {
        if (!fallback) {
          const res = pickRes(W, H, 1, { maxArea: 120000, maxW: 440 });
          fallbackCanvas = document.createElement("canvas");
          fallbackCanvas.width = res.w; fallbackCanvas.height = res.h;
          fallback = scene.build(res.w, res.h);
        }
        fallback.draw(fallbackCanvas.getContext("2d"), t, cam, prog);
        g.save();
        g.imageSmoothingEnabled = false;
        g.drawImage(fallbackCanvas, 0, 0, W, H);
        g.restore();
        return;
      }
      fallback = null; fallbackCanvas = null;
      // 横長の映画画角では絵の高さを保ち、顔や燭台を上下で切り落とさない。
      const wide = W / H > image.naturalWidth / image.naturalHeight;
      const scale = (wide ? H / image.naturalHeight : Math.max(W / image.naturalWidth, H / image.naturalHeight)) * 1.06;
      const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale;
      const x = dw < W ? (W - dw) / 2 - cam.x * dw * 0.012
        : Math.max(W - dw, Math.min(0, W / 2 - dw * focus[0] - cam.x * (dw - W) * 0.08));
      const y = Math.max(H - dh, Math.min(0, H / 2 - dh * focus[1] - cam.y * (dh - H) * 0.08));
      g.save();
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.globalAlpha = 1;
      g.fillStyle = "#020104";
      g.fillRect(0, 0, W, H);
      g.drawImage(image, x, y, dw, dh);
      g.restore();
    },
  };
}

export const SCENES = ORIGINAL_SCENES.map((scene, index) => ({
  ...scene,
  photo: OPENING_IMAGES[index].src,
  build: (W, H) => illustratedShot(index, scene, W, H),
}));

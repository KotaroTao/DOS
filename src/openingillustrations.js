// 六幕を物語と同じ原画で映す。画像が使えない時も暗い幕を保つ。
import { watchIllustration } from "./imageloading.js";
import { imageResource } from "./mediaready.js";
import { SCENES as ORIGINAL_SCENES, setReduced } from "./openingart.js";

export { setReduced };

export const OPENING_IMAGES = [
  { src: "art/opening/rift.webp", focus: [0.5, 0.5] },
  { src: "art/opening/fallen.webp", focus: [0.5, 0.55] },
  { src: "art/opening/vessels.webp", focus: [0.44, 0.5] },
  { src: "art/opening/ordo.webp", focus: [0.53, 0.5] },
  { src: "art/opening/letter.webp", focus: [0.5, 0.56] },
  { src: "art/opening/flame.webp", focus: [0.54, 0.53] },
];

export function warmOpening(priority = 0) {
  return Promise.all(OPENING_IMAGES.map(({ src }) => imageResource(src, priority).ready)).then(values => values.every(Boolean));
}

function illustratedShot(index, W, H) {
  const entry = imageResource(OPENING_IMAGES[index].src);
  const image = entry.image;
  const { focus } = OPENING_IMAGES[index];
  return {
    draw(g, t, cam, prog) {
      if (entry.state !== "ready") watchIllustration(image, entry.ready, g.canvas, true);
      // 取得中・失敗時とも旧イラストは使わない。
      if (entry.state !== "ready") {
        g.save(); g.globalAlpha = 1; g.fillStyle = "#020104";
        g.fillRect(0, 0, W, H); g.restore();
        return;
      }
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
  build: (W, H) => illustratedShot(index, W, H),
}));

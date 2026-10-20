// 表示用と先読みで共通の待ち行列を使う。画像の取得口はセーブへ混ぜない。
import { scheduleImage, prioritizeImage } from "./mediaready.js";

export function lazyPhoto(src, { w = 24, h = 24, width, height, exclude } = {}) {
  const photo = { sx: 0, sy: 0, sw: width || 0, sh: height || 0, exclude };
  let failedAt = null, task = null;
  // 画像要素・待ち行列・取得処理は記録へ混ぜない。
  Object.defineProperties(photo, {
    img: { value: null, writable: true },
    ready: { value: null, writable: true },
    load: { value: (priority = 1) => {
      prioritizeImage(task, priority);
      if (failedAt !== null && Date.now() - failedAt < 30000) return photo.ready;
      if (failedAt === null && photo.ready) return photo.ready;
      if (typeof Image === "undefined") return Promise.resolve(false);
      failedAt = null;
      const img = photo.img = new Image();
      let done;
      photo.ready = new Promise(resolve => { done = resolve; });
      task = scheduleImage(() => new Promise(release => {
        let finished = false;
        const finish = ok => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout); img.onload = img.onerror = null;
          if (!ok) failedAt = Date.now();
          else { photo.sw = img.naturalWidth; photo.sh = img.naturalHeight; }
          done(ok); release();
        };
        const timeout = setTimeout(() => { img.src = ""; finish(false); }, 30000);
        img.decoding = "async";
        img.onload = async () => {
          try { await img.decode?.(); }
          catch { finish(false); return; }
          finish(img.naturalWidth > 0 && img.naturalHeight > 0 &&
            (!width || img.naturalWidth === width) && (!height || img.naturalHeight === height));
        };
        img.onerror = () => finish(false);
        img.src = src;
      }), priority);
      return photo.ready;
    } },
  });
  return { w, h, photo };
}

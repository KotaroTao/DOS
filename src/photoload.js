// 原画は表示に必要になってから取得する。種類をまたいで同時取得を6枚までに抑える。
const queue = [];
let active = 0;
function pump() {
  while (active < 6 && queue.length) { active++; queue.shift()(); }
}

export function lazyPhoto(src, { w = 24, h = 24, width, height, exclude } = {}) {
  const photo = { sx: 0, sy: 0, sw: width || 0, sh: height || 0, exclude };
  let failedAt = null;
  // 画像要素・待ち行列・取得処理は記録へ混ぜない。
  Object.defineProperties(photo, {
    img: { value: null, writable: true },
    ready: { value: null, writable: true },
    load: { value: () => {
      if (failedAt !== null && Date.now() - failedAt < 30000) return photo.ready;
      if (failedAt === null && photo.ready) return photo.ready;
      if (typeof Image === "undefined") return Promise.resolve(false);
      failedAt = null;
      const img = photo.img = new Image();
      let done;
      photo.ready = new Promise(resolve => { done = resolve; });
      queue.push(() => {
        let finished = false;
        const finish = ok => {
          if (finished) return;
          finished = true;
          img.onload = img.onerror = null;
          if (!ok) failedAt = Date.now();
          else { photo.sw = img.naturalWidth; photo.sh = img.naturalHeight; }
          done(ok); active--; pump();
        };
        img.decoding = "async";
        img.onload = () => finish(img.naturalWidth > 0 && img.naturalHeight > 0 &&
          (!width || img.naturalWidth === width) && (!height || img.naturalHeight === height));
        img.onerror = () => finish(false);
        img.src = src;
      });
      pump();
      return photo.ready;
    } },
  });
  return { w, h, photo };
}

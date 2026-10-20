// 共通の画像取得。表示用を優先し、裏の先読みは同時に2件までに抑える。
const resources = new Map(), queue = [];
let active = 0, background = 0;
function trimResources(keep) {
  for (const [key, entry] of resources) {
    if (resources.size <= 24) break;
    if (entry !== keep && entry.state !== 'pending') resources.delete(key);
  }
}
function pump() {
  queue.sort((a, b) => b.priority - a.priority);
  while (active < 6) {
    const i = queue.findIndex(task => task.priority > 0 || background < 2);
    if (i < 0) break;
    const task = queue.splice(i, 1)[0], low = task.priority === 0;
    active++; if (low) background++;
    task.run().finally(() => { active--; if (low) background--; pump(); });
  }
}
export function scheduleImage(run, priority = 1) {
  const task = { priority, run };
  queue.push(task); pump();
  return task;
}
export function prioritizeImage(task, priority = 1) {
  if (task && priority > task.priority) { task.priority = priority; pump(); }
}
export function imageResource(src, priority = 1) {
  const key = new URL(src, new URL('../', import.meta.url)).href;
  let entry = resources.get(key);
  if (entry?.state === 'error') { resources.delete(key); entry = null; }
  if (entry) {
    resources.delete(key); resources.set(key, entry);
    if (priority > entry.task.priority) { entry.task.priority = priority; pump(); }
    return entry;
  }
  const image = new Image();
  entry = { image, state: 'pending', ready: null, task: null };
  let finish;
  entry.ready = new Promise(resolve => { finish = resolve; });
  resources.set(key, entry);
  entry.task = scheduleImage(() => new Promise(resolve => {
    let ended = false;
    const done = ok => {
      if (ended) return;
      ended = true; clearTimeout(timeout);
      image.onload = image.onerror = null;
      entry.state = ok ? 'ready' : 'error'; trimResources(entry); finish(ok); resolve();
    };
    const timeout = setTimeout(() => { image.src = ''; done(false); }, 30000);
    image.decoding = 'async';
    image.onload = async () => {
      try { if (image.decode) await image.decode(); done(image.naturalWidth > 0 && image.naturalHeight > 0); }
      catch { done(false); }
    };
    image.onerror = () => done(false);
    image.src = key;
  }), priority);
  // デコード済み画像を際限なく抱えない。表示中の画像は呼び出し側も参照を持つ。
  trimResources(entry);
  return entry;
}
export function warmImages(urls) {
  return Promise.all([...new Set(urls.filter(Boolean))].map(src => imageResource(src, 0).ready));
}

"""localhost:8000で原画の容量制限・再表示・描画済み肖像の保持を確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for memory, budget in [(None, 32), (2, 16)]:
        context = browser.new_context(service_workers='block')
        context.add_init_script('''Object.defineProperty(navigator, 'deviceMemory', {value: %s});
          window.sourceCanvases = [];
          const create = document.createElement.bind(document);
          document.createElement = function(tag, ...args) {
            const node = create(tag, ...args);
            if (tag === 'canvas') sourceCanvases.push(new WeakRef(node));
            return node;
          };''' % ('undefined' if memory is None else memory))
        page = context.new_page()
        errors, requests = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        page.route('**/photo-cache-review.html', lambda route: route.fulfill(
            body='<html><body></body></html>', content_type='text/html'))
        page.goto('http://localhost:8000/photo-cache-review.html')
        page.evaluate('''async () => {
          const {itemPhoto, ITEM_PHOTOS} = await import('/src/itemphotos.js');
          const {whenPhoto, drawPhoto, photoReady, spriteCanvas} = await import('/src/sprites.js');
          const icon = document.createElement('canvas'); icon.width = icon.height = 48;
          document.body.append(icon);
          const ctx = icon.getContext('2d');
          const render = sprite => new Promise(resolve => whenPhoto(sprite, () => {
            ctx.clearRect(0, 0, 48, 48);
            if (!drawPhoto(ctx, sprite, 0, 0, 48, 48)) throw Error('通知時の原画がない');
            resolve();
          }));
          const sprites = ITEM_PHOTOS.slice(0, 200).map(itemPhoto);
          await render(sprites[0]);
          const pixels = () => Array.from(ctx.getImageData(0, 0, 48, 48).data).join(',');
          const before = pixels();
          await new Promise(resolve => whenPhoto(sprites[1], resolve));
          const thumbnail = spriteCanvas(sprites[1], 4, 12).toDataURL();
          if (!ctx.getImageData(0, 0, 48, 48).data.some(v => v)) throw Error('肖像が空白');
          const active = document.createElement('canvas'); active.width = active.height = 48;
          const activeCtx = active.getContext('2d');
          for (const sprite of sprites.slice(1)) {
            await new Promise(resolve => whenPhoto(sprite, resolve));
            // 毎フレーム使う画像を模擬し、読み出しで優先度が更新されるか確かめる。
            activeCtx.clearRect(0, 0, 48, 48);
            if (!drawPhoto(activeCtx, sprites[0], 0, 0, 48, 48)) throw Error('使用中の絵が追い出された');
          }
          if (photoReady(sprites[1].photo)) throw Error('古い原画が残る');
          if (pixels() !== before) throw Error('描画済みの肖像が変わった');
          if (spriteCanvas(sprites[1], 4, 12).toDataURL() !== thumbnail) throw Error('原寸の写しを解放すると同じ肖像の再描画が空になる');
          window.review = {sprites, render, whenPhoto, drawPhoto, photoReady, pixels, before};
        }''')
        cdp = context.new_cdp_session(page)
        cdp.send('HeapProfiler.collectGarbage')
        def retained():
            return page.evaluate('''() => sourceCanvases.map(ref => ref.deref()).filter(Boolean)
              .filter(c => c.width >= 384 && c.height >= 384)
              .reduce((bytes, c) => bytes + c.width * c.height * 4, 0) / 1024**2''')
        used = retained()
        assert 0 < used <= budget, (used, budget)
        request_count = len(requests)
        context.set_offline(True)
        page.evaluate('''async () => {
          const {sprites, render, pixels, before} = review;
          // 解放された画像も、取得し直さずに同じ絵で復元できる。
          await render(sprites[1]); await render(sprites[0]);
          if (pixels() !== before) throw Error('復元後の絵が異なる');
          // 多数の準備が同時に完了しても、通知が描く前に原画を捨てない。
          await Promise.all(sprites.slice(0, 120).map(sprite => render(sprite)));
        }''')
        cdp.send('HeapProfiler.collectGarbage')
        assert retained() <= budget, retained()
        assert len(requests) == request_count, '再表示時に通信が発生'
        assert not errors, errors
        print(f'上限{budget}MiB: 200種表示後 {used:.3f}MiB・使用中の原画を優先・肖像保持・原寸解放後も同じ肖像を即描画・オフライン復元・120種同時描画 OK', flush=True)
        context.close()
    browser.close()

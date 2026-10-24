"""localhost:8000で、操作中の音源開始を要する端末の音声起動・復帰を確認する。"""
from playwright.sync_api import sync_playwright


# WebKitの実機検証とは別に、pointerdownのresumeだけでは起動しない条件を再現する。
GATE = r"""() => {
  const Native = window.AudioContext;
  const nativeResume = Native.prototype.resume;
  window.AudioContext = class extends Native {
    constructor(...args) {
      super(...args);
      this.locked = true;
      window.audioTestContext = this;
      this.suspend();
    }
    get state() { return this.locked ? 'suspended' : super.state; }
    resume() { return this.locked ? Promise.resolve() : nativeResume.call(this); }
    createBufferSource() {
      const src = super.createBufferSource(), start = src.start.bind(src), ctx = this;
      src.start = (...args) => {
        const ev = window.event;
        if (src.buffer?.length === 1 && ev?.isTrusted &&
            ['touchend', 'pointerup', 'click', 'keydown'].includes(ev.type)) {
          ctx.locked = false;
          nativeResume.call(ctx);
        }
        return start(...args);
      };
      return src;
    }
  };
}"""


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for mode in ['tap', 'keyboard', 'click']:
        page = browser.new_page(viewport={'width': 390, 'height': 844},
                                has_touch=True, is_mobile=True, service_workers='block')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script('(' + GATE + ')()')
        if mode == 'click':
            page.add_init_script('''
              for (const ev of ['pointerdown', 'pointerup'])
                document.addEventListener(ev, e => e.stopImmediatePropagation(), true);
            ''')
        page.goto('http://localhost:8000/?testDungeon=w02')
        page.wait_for_function('window.__game?.G.party.length > 0')
        # 個々の画面が伝播を止めても、初期化・復帰が操作中に実行される必要がある。
        page.evaluate('''() => {
          const b = document.createElement('button');
          b.id = 'audio-test'; b.textContent = '音声検査';
          b.style.cssText = 'position:fixed;inset:10px auto auto 10px;z-index:2147483647';
          for (const ev of ['pointerdown','pointerup','touchend','click','keydown'])
            b.addEventListener(ev, e => e.stopPropagation());
          document.body.append(b);
        }''')
        button = page.locator('#audio-test')
        if mode == 'tap':
            button.tap()
        elif mode == 'keyboard':
            button.focus()
            page.keyboard.press('Enter')
        else:
            # pointerdown/upが届かず、clickだけが届く場合も対象。
            button.click()
        page.wait_for_function('window.audioTestContext?.state === "running"')
        page.wait_for_function('''async () => {
          const a = await import('/src/audio.js');
          const d = a.audioDebug();
          return d.playing && d.samples > 0 && d.voices > 0;
        }''')
        # 着信・タブ復帰などで再び操作が必要になった状態を再現する。
        page.evaluate('''async () => {
          const c = window.audioTestContext;
          await c.suspend(); c.locked = true;
        }''')
        button.tap()
        page.wait_for_function('window.audioTestContext.state === "running"')
        # ミュートを次のタップが解除しないことも確認する。
        page.evaluate('''async () => { (await import('/src/audio.js')).toggleMute(); }''')
        page.wait_for_function('window.audioTestContext.state === "suspended"')
        button.tap()
        assert page.evaluate('window.audioTestContext.state') == 'suspended'
        page.evaluate('''async () => { (await import('/src/audio.js')).toggleMute(); }''')
        page.wait_for_function('window.audioTestContext.state === "running"')
        assert not errors, errors
        print(mode + ': BGM起動・音源生成・停止後の復帰・ミュート維持 OK')
        page.close()
    browser.close()

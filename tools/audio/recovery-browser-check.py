"""音声出力の作り直し・初期化失敗後の再試行を実際の音声波形で確認する。"""
import argparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--webkit', action='store_true')
args = parser.parse_args()

with sync_playwright() as p:
    browser = p.webkit.launch() if args.webkit else p.chromium.launch(
        executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for mode in ['normal', 'silent', 'failure']:
        page = browser.new_page(viewport={'width': 390, 'height': 844},
                                has_touch=True, is_mobile=True, service_workers='block')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script('''(() => {
          const Native = window.AudioContext;
          window.audioContexts = [];
          if (MODE === 'silent') {
            let type = 'auto'; window.audioSessionHistory = [];
            Object.defineProperty(navigator, 'audioSession', {value: {
              get type() { return type; },
              set type(value) { type = value; audioSessionHistory.push(value); }
            }});
          }
          window.AudioContext = class extends Native {
            constructor(...args) {
              super(...args);
              window.audioContexts.push(this);
              this.testOut = super.createGain();
              // runningでも実際の出口だけが無音になる状態を再現する。
              this.testOut.gain.value = MODE === 'silent' && audioContexts.length === 1 ? 0 : 1;
              this.testMeter = super.createAnalyser();
              this.testOut.connect(this.testMeter);
              this.testMeter.connect(super.destination);
            }
            get destination() { return this.testOut || super.destination; }
            createConvolver() {
              if (MODE === 'failure' && audioContexts.length === 1)
                throw new Error('検査用: 音声初期化の一時的な失敗');
              return super.createConvolver();
            }
          };
        })();'''.replace('MODE', repr(mode)))
        page.goto('http://localhost:8000/?testDungeon=w02')
        page.bring_to_front()
        page.wait_for_function('window.__game?.G.party.length > 0')
        page.wait_for_function('async () => !(await import("/src/imageloading.js")).mediaBusy()')
        page.evaluate('''() => {
          const b = document.createElement('button'); b.id = 'audio-start'; b.textContent = '音声';
          b.style.cssText = 'position:fixed;top:10px;left:10px;z-index:2147483647';
          document.body.append(b);
        }''')
        page.locator('#audio-start').tap()
        page.wait_for_function('async () => (await import("/src/audio.js")).audioDebug().ready')
        if mode == 'silent':
            assert page.evaluate('audioContexts[0].state') == 'running'
            assert page.evaluate('audioContexts[0].testOut.gain.value') == 0
        if mode == 'failure':
            assert page.evaluate('audioContexts.length') >= 2
            page.wait_for_function('audioContexts[0].state === "closed"')

        # 実際の設定画面から、音量を保持して出力を作り直す。
        page.evaluate('''async () => {
          const a = await import('/src/audio.js'); a.setVolumes(0.35, 0.45);
          (await import('/src/ui/ctx.js')).UI.settingsSheet({});
        }''')
        before = page.evaluate('audioContexts.length')
        page.get_by_role('button', name='音声を再起動', exact=True).tap()
        assert page.evaluate('audioContexts.length') == before + 1
        if mode == 'silent':
            assert page.evaluate('navigator.audioSession.type') == 'playback'
            assert page.evaluate('audioSessionHistory.includes("auto")')
        page.wait_for_function('audioContexts.slice(0,-1).every(c => c.state === "closed")')
        page.wait_for_function('''() => {
          const c = audioContexts[audioContexts.length-1], data = new Float32Array(c.testMeter.fftSize);
          c.testMeter.getFloatTimeDomainData(data);
          return data.every(Number.isFinite) && data.some(x => Math.abs(x) > 0.00001);
        }''')
        state = page.evaluate('async () => (await import("/src/audio.js")).audioDebug()')
        assert state['bgmVol'] == 0.35 and state['sfxVol'] == 0.45, state
        assert state['playing'] == 'layer1' and not state['error'], state
        # ミュートでの再起動が音を出さず、解除後に再び出力できること。
        page.evaluate('async () => (await import("/src/audio.js")).toggleMute()')
        page.wait_for_function('audioContexts[audioContexts.length-1].state === "suspended"')
        page.get_by_role('button', name='音声を再起動', exact=True).tap()
        page.wait_for_function('audioContexts[audioContexts.length-1].state === "suspended"')
        assert page.evaluate('async () => (await import("/src/audio.js")).isMuted()')
        # 診断情報の表示も実際の画面で確認する。
        page.get_by_role('button', name='音声の診断情報を表示', exact=True).tap()
        assert not errors, errors
        info = page.get_by_role('textbox', name='音声の診断情報')
        assert '"muted": true' in info.input_value()
        assert '"browser":' in info.input_value()
        assert not errors, errors
        print(('WebKit' if args.webkit else 'Chromium') + ': ' + mode +
              ' — 出力波形・旧出力の解放・曲と音量保持・ミュート・診断表示 OK', flush=True)
        page.close()
    browser.close()

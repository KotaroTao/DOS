"""iPadのタブ復帰時、runningのまま失われる出力と操作が必要な復帰を波形で検査する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for mode in ['ipad', 'iphone-gesture', 'desktop']:
        page = browser.new_page(service_workers='block', has_touch=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/audio-return-review.html', lambda r: r.fulfill(
            content_type='text/html', body='<button id="start">音声</button>'))
        page.goto('http://localhost:8000/audio-return-review.html')
        page.evaluate('''mode => {
          Object.defineProperty(navigator,'platform',{value:mode==='ipad'?'MacIntel':'Linux'});
          Object.defineProperty(navigator,'maxTouchPoints',{value:mode==='ipad'?5:0});
          Object.defineProperty(navigator,'userAgent',{value:mode==='iphone-gesture'?'iPhone':'Desktop'});
          window.hiddenTest=false;
          Object.defineProperty(document,'hidden',{get:()=>hiddenTest});
          Object.defineProperty(document,'visibilityState',{get:()=>hiddenTest?'hidden':'visible'});
          const Native=window.AudioContext; window.contexts=[];
          window.AudioContext=class extends Native {
            constructor(...args) {
              super(...args); contexts.push(this);
              this.out=super.createGain();this.meter=super.createAnalyser();
              this.out.connect(this.meter);this.meter.connect(super.destination);
              this.gated=mode==='iphone-gesture'&&contexts.length>1;
              if(this.gated)this.out.gain.value=0;
            }
            get destination(){return this.out||super.destination;}
            suspend(){
              // タブ移動後もrunningだが無音、resumeでは出口が戻らない状態。
              if(hiddenTest&&mode!=='desktop'){this.out.gain.value=0;return Promise.resolve();}
              return super.suspend();
            }
            createBufferSource(){
              const src=super.createBufferSource(),start=src.start.bind(src),ctx=this;
              src.start=(...args)=>{
                const ev=window.event;
                if(ctx.gated&&src.buffer?.length===1&&ev?.isTrusted&&
                    ['touchend','pointerup','click','keydown'].includes(ev.type)){
                  ctx.gated=false;ctx.out.gain.value=1;
                }
                return start(...args);
              };return src;
            }
          };
          window.changeTab=hidden=>{
            hiddenTest=hidden;document.dispatchEvent(new Event('visibilitychange'));
          };
        }''', mode)
        page.evaluate('''async()=>{
          window.audio=await import('/src/audio.js');
          document.querySelector('#start').onclick=()=>{audio.initAudio();audio.playBgm('layer1');};
          audio.setVolumes(.35,.45);
        }''')
        page.locator('#start').tap()

        def wave():
            page.wait_for_function('''()=>{
              const c=contexts.at(-1),data=new Float32Array(c.meter.fftSize);
              c.meter.getFloatTimeDomainData(data);
              return data.every(Number.isFinite)&&data.some(x=>Math.abs(x)>.00001);
            }''', timeout=60000)

        wave()
        for cycle in range(2):
            before = page.evaluate('contexts.length')
            page.evaluate('changeTab(true)')
            if mode != 'desktop':
                assert page.evaluate('contexts.at(-1).state') == 'running'
                assert page.evaluate('contexts.at(-1).out.gain.value') == 0
            page.evaluate('changeTab(false)')
            assert page.evaluate('contexts.length') == before + (mode != 'desktop')
            # focus/pageshowが続いても出力を重複して作り直さない。
            page.evaluate("dispatchEvent(new Event('focus'));dispatchEvent(new Event('pageshow'))")
            assert page.evaluate('contexts.length') == before + (mode != 'desktop')
            if mode == 'iphone-gesture':
                assert page.evaluate('contexts.at(-1).out.gain.value') == 0
                page.locator('#start').tap()
            wave()
            page.wait_for_function('contexts.slice(0,-1).every(c=>c.state==="closed")')
            d = page.evaluate('audio.audioDebug()')
            assert d['bgmVol'] == .35 and d['sfxVol'] == .45 and d['playing'] == 'layer1', d
        # 消音中の往復は音を出さず、解除後は再生を継続できる。
        page.evaluate('audio.toggleMute()')
        page.wait_for_function('contexts.at(-1).state==="suspended"')
        page.evaluate('changeTab(true);changeTab(false)')
        page.wait_for_function('contexts.at(-1).state==="suspended"')
        assert page.evaluate('audio.isMuted()')
        page.locator('#start').tap()
        assert page.evaluate('audio.isMuted()')
        page.evaluate('audio.toggleMute()')
        page.locator('#start').tap()
        wave()
        assert not errors, errors
        print(mode+': タブ往復2回・波形復帰・旧出力解放・音量と曲保持・消音維持 OK', flush=True)
        page.close()
    browser.close()

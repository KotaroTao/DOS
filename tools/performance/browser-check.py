"""localhost:8000で描画頻度と音声資源の解放を確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=[
        '--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02')
    page.wait_for_function('window.__game?.G.party.length > 0')
    rates = page.evaluate('''async () => {
      const source = await (await fetch('/src/game.js')).text();
      const start = source.indexOf('function boardAnimLoop(ts) {');
      const end = source.indexOf('\\nrequestAnimationFrame(boardAnimLoop);', start);
      const loop = source.slice(start, end);
      const run = new Function('hz', 'active', `
        const G = {state:'board', board:{}};
        const requestAnimationFrame = () => {}, uiBlocked = () => false;
        let _boardIdleCost = 0, _boardAnimLast = 0, _boardActiveAt = active ? 2000 : 0;
        let count = 0;
        const drawBoardFrame = () => { count++; };
        ${loop}
        for (let i=0; i<hz; i++) boardAnimLoop(2000+i*1000/hz);
        return count;
      `);
      return [60,90,120,144].map(hz => {
        const idle = run(hz, false), active = run(hz, true);
        if (idle > 31 || idle < 24 || active > 61) throw Error('描画頻度: '+[hz,idle,active]);
        return {hz, idle, active};
      });
    }''')
    print('描画回数（1秒）:', rates)

    result = page.evaluate('''async () => {
      const {Engine} = await import('/src/music/engine.js');
      const ctx = new AudioContext();
      await ctx.resume();
      const buf = ctx.createBuffer(1, 240, 24000);
      const data = buf.getChannelData(0);
      for (let i=0;i<data.length;i++) data[i]=Math.sin(i*Math.PI/12)*0.1;
      const engine = new Engine(ctx, {get: () => buf}, {realtime:false});
      const song = {chans:[{inst:'strings', rev:0.5},{inst:'fiddle'},{inst:'harp'}],
        ev:[], spb:1, gain:1, loop:false, loopEnd:1};
      const player = engine.start(song, {at:ctx.currentTime+0.01});
      const wait = ms => new Promise(r => setTimeout(r,ms));
      for (let batch=0; batch<20; batch++) {
        const sounds=[], voices=[];
        for (let i=0;i<30;i++) {
          sounds.push(engine.playBuffer(buf, {rev:0.5,pan:0.2}));
          player.play({c:i%3,m:60,v:0.8,d:0.04,o:{att:0.01,rel:0.02}},ctx.currentTime+0.01);
          voices.push(player.voices[player.voices.length-1]);
        }
        await wait(800);
        if (sounds.some(s => s.buffer || s.onended)) throw Error('効果音の参照が残る');
        if (voices.some(v => v.src.buffer || v.src.onended)) throw Error('声部の参照が残る '+JSON.stringify({batch,state:ctx.state,now:ctx.currentTime,left:voices.filter(v=>v.src.buffer).map(v=>({t0:v.t0,t1:v.t1}))}));
        if (player.voices.length || engine.allVoices.length || player.chans.some(c=>c.voices.length))
          throw Error('終了した声部が配列に残る');
      }
      // 曲の停止は、先読みした音の終了通知を待たずに解放する。
      player.play({c:0,m:60,v:0.8,d:10},ctx.currentTime+0.1);
      const pending=player.voices[0];
      player.kill();
      if(pending.src.buffer || player.voices.length || engine.allVoices.length)
        throw Error('曲の停止後に声部が残る');
      engine.tick();
      if(engine.players.length) throw Error('停止した曲が残る');
      await ctx.close();
      // オフライン試聴では終了通知より先に楽譜をまとめて予約する。
      const oc=new OfflineAudioContext(2,24000,24000);
      const offline=new Engine(oc,{get:()=>buf},{realtime:false});
      const op=offline.start({...song,ev:[{b:0,c:0,m:60,v:0.8,d:0.1,o:{att:0.01,rel:0.02}}]}, {at:0.01});
      offline.scheduleAll(1);
      const rendered=await oc.startRendering();
      const samples=rendered.getChannelData(0);
      if(!samples.every(Number.isFinite) || !samples.some(v=>Math.abs(v)>0.00001))
        throw Error('試聴の書き出し失敗');
      return '効果音600回・楽曲600音・曲停止・オフライン試聴 OK';
    }''')
    print(result)
    assert not errors, errors
    browser.close()

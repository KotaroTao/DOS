"""浮き文字が敵名の帯やCanvasの端に隠れないことを実寸で確認する。"""
import argparse
from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright

args = argparse.ArgumentParser()
args.add_argument('--baseline')
args = args.parse_args()
root = Path(__file__).resolve().parents[2]
source = subprocess.check_output(['git','show',args.baseline+':src/game.js'],cwd=root).decode() if args.baseline else (root/'src/game.js').read_text()
source = source.replace('window.__game = { G,', 'window.__game = { floatTest: { renderCombatCanvas }, G,', 1)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1280,'height':800},service_workers='block',reduced_motion='reduce')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://**',lambda r:r.abort())
    page.route('**/src/game.js',lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto('http://localhost:8000/?testDungeon=w02',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length === 6')
    page.wait_for_function("!document.body.classList.contains('booting') && !document.body.classList.contains('screen-loading')")
    page.evaluate("__game.G.autoCombat=false; __game.startBattle(__game.spawnCardEnemies('bs_drainrat',1),null)")
    page.wait_for_function('__game.G.battle?.phase === "input" && !__game.G.animating')
    page.evaluate('''() => {
      const g=__game.G; g.animating=true;
      window.enemySample=g.battle.enemies[0];
      g.codex.mon[enemySample.key]={kills:10};
      const fill=CanvasRenderingContext2D.prototype.fillText;
      window.floatProbe={record:[],labels:new Set(['99999','+99999','MP+999','毒','攻▲','会心の一撃','灼熱'])};
      CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest) {
        if(this.canvas.id==='view' && floatProbe.labels.has(text)) {
          const m=this.measureText(text);
          floatProbe.record.push({text,y,ascent:m.actualBoundingBoxAscent,descent:m.actualBoundingBoxDescent,margin:Math.max(6,this.shadowBlur)});
        }
        return fill.call(this,text,x,y,...rest);
      };
      window.checkFloats=(n,longNames)=>{
        const g=__game.G;
        g.battle.enemies=Array.from({length:n},(_,i)=>({...enemySample,uid:9000+i,alive:true,
          name:longNames?'闇の奥から這い出る大きな魔物'+String.fromCharCode(65+i):enemySample.mon.name+String.fromCharCode(65+i)}));
        g.fx=null; __game.floatTest.renderCombatCanvas();
        const {VW,VH}=__game.autoMove.viewSize();
        const samples=[['dmg','99999'],['crit','99999'],['pdmg','99999'],['heal','+99999'],['heal','MP+999'],['label','毒'],['buff','攻▲'],['label','会心の一撃'],['trait','灼熱'],['info','毒']];
        for(const age of [0,0.05,0.4,0.9]) for(const [kind,text] of samples) {
          floatProbe.record=[];
          g.fx={lunge:null,slashes:[],skill:[],floats:[{x:VW/2,y:VH-26,text,kind,t0:performance.now()-age*760}],screen:null,flash:{},deaths:[]};
          __game.floatTest.renderCombatCanvas();
          const view=document.getElementById('view'),rect=view.getBoundingClientRect();
          const top=rect.top+view.clientTop,scale=view.clientHeight/VH;
          const bottom=Math.min(top+view.clientHeight,document.getElementById('enemy-names').getBoundingClientRect().top);
          if(!floatProbe.record.length) throw Error('浮き文字を検査できない');
          for(const f of floatProbe.record) {
            const lo=top+(f.y+f.descent+f.margin)*scale,hi=top+(f.y-f.ascent-f.margin)*scale;
            if(lo>bottom+0.5 || hi<top-0.5) throw Error(JSON.stringify({kind,text,age,n,longNames,lo,bottom,hi,top}));
          }
        }
        g.fx=null;
      };
    }''')
    count=0
    for width,height in [(320,550),(390,844),(600,760),(601,700),(768,1024),(1024,768),(1280,800),(1440,900)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(350)
        for n in [1,6]:
            page.evaluate('(n)=>checkFloats(n,false)',n)
            count+=40
        if width>600:
            page.evaluate('checkFloats(6,true)')
            count+=40
    assert not errors, errors
    print(f'{count}場面: 320〜1440px・1/6体・長い敵名・全10種類・拡大/浮上/消失中の文字が名前の帯より上: OK',flush=True)
    browser.close()

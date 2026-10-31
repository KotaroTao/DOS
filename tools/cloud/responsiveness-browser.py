"""移動のめくり・スライド中のUI更新と動く枠の描画を確認する。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=browser.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 # めくり・スライドの途中でHUDを組み直さず、動く蓋の枠を補間する。
 page.goto('http://127.0.0.1:8001/?testDungeon=w02')
 page.wait_for_function("window.__game?.G.board && !__game.G.anim && !document.body.classList.contains('booting')")
 page.wait_for_timeout(1000)
 result=page.evaluate('''async()=>{
  const g=__game.G,{moveStep}=__game.autoMove;
  g.px=2;g.py=2;
  for(let y=0;y<__game.ROWS;y++)for(let x=0;x<__game.COLS;x++){
   const c=g.board.cells[y][x];c.type='empty';c.cleared=true;c.revealed=false;c.walls={n:y===0,s:y===__game.ROWS-1,w:x===0,e:x===__game.COLS-1};
  }
  g.board.cells[2][2].revealed=true;__game.inf.renderBoard();
  const x=3,y=2,c=g.board.cells[y][x],candidate=__game.autoMove.cellRect(2,1);
  c.type='empty';c.revealed=false;c.cleared=true;c.walls={n:false,s:false,w:false,e:false};
  g.prompt=false;g.settingsOpen=false;
  let hudDuringFlip=0;const smoothing=[];const dimensions=[];const borders=[];
  const observer=new MutationObserver(()=>{if(g.flipAnim||g.heroAnim)hudDuringFlip++;});
  for(const id of ['party','runbar','hint'])observer.observe(document.getElementById(id),{subtree:true,childList:true});
  const proto=CanvasRenderingContext2D.prototype,original=proto.drawImage;
  proto.drawImage=function(...args){
   if(this.canvas.id==='view'&&new Error().stack.includes('drawFlipSlab'))smoothing.push(this.imageSmoothingEnabled);
   return original.apply(this,args);
  };
  const stroke=proto.strokeRect;
  proto.strokeRect=function(...args){
   if(this.canvas.id==='view'&&new Error().stack.includes('drawBoardHighlights')&&Math.abs(args[0]-candidate.x-0.7)<0.01&&Math.abs(args[1]-candidate.y-0.7)<0.01)borders.push({moving:!!g.anim,style:this.strokeStyle});
   return stroke.apply(this,args);
  };
  const timer=setInterval(()=>{if(g.flipAnim||g.heroAnim){const v=document.getElementById('view');dimensions.push(v.width+'x'+v.height);}},10);
  try{await new Promise(resolve=>moveStep(x,y,resolve));}
  finally{observer.disconnect();clearInterval(timer);proto.drawImage=original;proto.strokeRect=stroke;}
  if(hudDuringFlip)throw Error('移動中に周辺UIが更新された: '+hudDuringFlip);
  if(!smoothing.length||smoothing.some(v=>!v))throw Error('動く枠の補間なし: '+smoothing);
  if(new Set(dimensions).size!==1)throw Error('移動中の寸法変化: '+dimensions);
  if(!borders.some(b=>b.moving))throw Error('移動中に選択可能な枠が消える');
  if(new Set(borders.map(b=>b.style)).size!==1)throw Error('枠の明るさが変わる');
  return {borderFrames:borders.length,frames:smoothing.length,hudDuringFlip,dimensions:[...new Set(dimensions)]};
 }''')
 print('めくり/歩行中の周辺UI再生成なし・枠の補間・寸法の安定',result,flush=True)
 assert not errors,errors
 c.unroute_all(behavior='ignoreErrors');c.close();browser.close()

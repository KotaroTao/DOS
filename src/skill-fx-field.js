// 探索の技も同じ部品を短く重ねる。入力・保存・盤面の描画は止めない。
import { drawBattleFx } from './battlefx.js';
import { emitSkillFx } from './skill-fx.js';
let stopCurrent=null;
export function showFieldSkillFx(view,key,spell,alive=()=>true){
 stopCurrent?.();if(!view||document.hidden)return;
 const rect=view.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
 const canvas=document.createElement('canvas'),scale=Math.min(1,640/rect.width,640/rect.height);
 canvas.width=Math.ceil(rect.width*scale);canvas.height=Math.ceil(rect.height*scale);canvas.setAttribute('aria-hidden','true');
 Object.assign(canvas.style,{position:'fixed',pointerEvents:'none',zIndex:'35',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
 const target={uid:0,side:'party'},list=[],ctx=canvas.getContext('2d');
 emitSkillFx(list,key,spell,[{target}],()=>({x:canvas.width/2,y:canvas.height*.55}),0,1);
 if(!list.length)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,controller=new AbortController();let frame=0,ended=false;
 const stop=()=>{if(ended)return;ended=true;cancelAnimationFrame(frame);controller.abort();canvas.remove();if(stopCurrent===stop)stopCurrent=null;};
 stopCurrent=stop;document.body.append(canvas);const start=performance.now();
 const tick=now=>{if(document.hidden||!alive()||now-start>350){stop();return;}ctx.clearRect(0,0,canvas.width,canvas.height);drawBattleFx(ctx,list,now-start,canvas.width,canvas.height,reduced);frame=requestAnimationFrame(tick);};
 document.addEventListener('visibilitychange',stop,{signal:controller.signal});window.addEventListener('pagehide',stop,{signal:controller.signal});window.addEventListener('resize',stop,{signal:controller.signal});frame=requestAnimationFrame(tick);
}

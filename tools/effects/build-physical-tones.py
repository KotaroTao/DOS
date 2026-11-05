"""斬撃の色変換を出荷前に行う。実行中の画素読み出し・変換を不要にする。"""
import json,subprocess
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
code="""import {SKILL_FX_SIGNATURES} from './src/skill-fx-signatures.js';import {CLEAVE_COLORS} from './src/cleave-fx.js';import {ELEM_FX_COL} from './src/battlefx.js';import {SPELLS} from './src/skilldefs.js';import {SKILL_FX_CATALOG} from './src/skill-fx-catalog.js';
const base={fire:'#ff4938',water:'#439fff',wind:'#89dfae',earth:'#ca9a65',light:'#ffe297',dark:'#a47bdd'};
const tones=new Set([...Object.values(base),...Object.values(CLEAVE_COLORS)]);
for(const [key,sp]of Object.entries(SPELLS)){const family=SKILL_FX_CATALOG[key]?.family;if(!['cut','cleave','flurry','pierce','projectile'].includes(family))continue;const tone=sp.element?(family==='cleave'?CLEAVE_COLORS[sp.element]:base[sp.element])||(ELEM_FX_COL[sp.element]||ELEM_FX_COL.none)[1]:SKILL_FX_SIGNATURES[key]?.tone;if(tone)tones.add(tone);}
console.log(JSON.stringify([...tones].sort()));"""
colors=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT))
source=np.array(Image.open(ROOT/'art/effects/physical-materials.webp').convert('RGBA'))
output=ROOT/'art/effects/physical-tones';output.mkdir(exist_ok=True)
entries={}
for tone in colors:
 pixels=source.copy();rgb=np.array([int(tone[i:i+2],16)/255 for i in [1,3,5]])
 value=pixels[:,:,:3].astype(float)
 # 旧cacheToneと同じ式。透明度と18コマの形状はそのまま保持する。
 highlight=np.maximum(0,(value-195)/60)*.35
 pixels[:,:,:3]=np.rint(value*np.minimum(1,.3+rgb*.7+highlight)).astype('uint8')
 name=tone[1:]+'.webp';Image.fromarray(pixels).save(output/name,lossless=True,method=6)
 entries[tone]='../art/effects/physical-tones/'+name
for path in output.glob('*.webp'):
 if '#'+path.stem not in entries:path.unlink()
manifest=ROOT/'src/skill-fx-tones.js'
manifest.write_text('// tools/effects/build-physical-tones.pyで生成。手で編集しない。\nexport const PHYSICAL_TONES = Object.freeze('+json.dumps(entries,ensure_ascii=False,indent=2)+');\n')
sw=ROOT/'sw.js';text=sw.read_text();start='  // <<PHYSICAL_TONES>>\n';end='  // <</PHYSICAL_TONES>>\n'
block=start+'  "./src/skill-fx-tones.js",\n'+''.join('  "./art/effects/physical-tones/'+Path(p).name+'",\n' for p in entries.values())+end
if start in text:
 a=text.index(start);b=text.index(end,a)+len(end);text=text[:a]+block+text[b:]
else:text=text.replace('  "./src/skill-fx-materials.js",\n','  "./src/skill-fx-materials.js",\n'+block)
sw.write_text(text)
print({'tones':len(colors),'bytes':sum((output/Path(p).name).stat().st_size for p in entries.values())})

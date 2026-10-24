// 各場面の正本を指定コマンドで再確認し、新規前景の制作条件を記録する。
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SCENES, scenePaths, archiveText, gameText } from './scenes.mjs';
const out='docs/art/story-refs/palace-story-rebuild';
mkdirSync(out+'/prompts',{recursive:true});
const early = new Set([3,4,5,6,7,8,13]);
const wide = new Set([7,9,11,14,18,19,24,28,30,34,36,39,42,46,49,50,52]);
const detail={
  2:'King quietly indicates the next journey. Apprentice holds a modest parchment route map in both hands, scribbles illegible. No keys or permits.',
  3:'King turns his troubled gaze DOWN AND LEFT, deliberately AWAY from Morden; Morden watches silently from the east side. No props.',
  5:'King holds an OPEN worn journal on his lap with one hand and raises the other natural palm to STOP Morden from taking it. Morden is standing, checking his forward reach. Apprentice attentive.',
  7:'King looks directly at Morden, asking how he has served since the preceding reign without aging. Morden bows his head, still no white hairs.',
  8:'King turns his head toward the window thoughtfully, apprentice reporting thunderstorm. Morden not central. No thunder effects inside.',
  9:'King admits HE is the former king, tired and vulnerable; apprentice quietly reports. NO Morden in this scene, empty chair.',
  10:'King tells of the garden he was forbidden to enter, one hand resting on his lap, gaze distant. No actual garden or tree in the room.',
  11:'Apprentice holds the closed worn notebook with both hands; king receives the news thoughtfully. No executed scholar or Ordo present.',
  12:'King looks DOWN at a small ordinary gold goblet placed separately beside his hand, deliberately NOT reaching for it. No drinking.',
  13:'King has become visibly frail and whiter-haired; Morden stands with thin enigmatic smile before withdrawing. Apprentice reporting. Chest of Morden closed.',
  14:'Frail king indicates downward toward the floor while speaking of the drowned old capital. No literal water, submerged city or memories in palace.',
  15:'Frail king GRIPS the invisible armrest, troubled by the forgotten priest name. His gripping hand is naturally curled at his side, ready to overlay original armrest. No literal priest.',
  16:'Frail king rests one hand over heart, soberly admitting his broken oath. No water or spectral oath.',
  17:'Frail king gently pushes ONE gold goblet away from himself; his hand touches its stem. NO drinking. Apprentice attentive.',
  18:'King wipes sweat from his forehead with one hand. He is hot, NOT frozen or sickly blue. No blanket yet.',
  19:'King leans forward, distressed to hear about burning wooden vessels. Do NOT show fire victims or dolls in palace.',
  20:'King bends forward and lowers ONE gold goblet toward the floor with a trembling hand; his other hand braces on his knee. No duplicate cup.',
  21:'King examines his cold fingertips, deeply quiet on learning Morden was a doll. NO blanket yet. No Morden or chest light.',
  22:'King draws a GREY lap blanket up toward his chest with BOTH hands, listening to news that Ordo continued despite a broken leg. A faint familiar smile.',
  23:'King tightly clasps his hands ON the grey lap blanket, accepting responsibility for the eleven imprisoned scholars. No scholars or souls.',
  24:'King tips his head and eyes UP toward the real ceiling. Hands remain on grey blanket. No painted stars or soul lights in palace.',
  26:'King grips the EDGE of the grey lap blanket, horrified by corrupt souls filling the swamp. No swamp or cup in hand.',
  27:'King closes his eyes sadly while remembering Morden never dropping his smile. No Morden in the room.',
  28:'King listens intently, one hand slightly open in a gentle question about the island light. No literal poison or lantern.',
  29:'King tilts his head, contemplating conflicting orders. No Morden, founder or soul fire present.',
  30:'King glances toward windows while noticing a SMALL scorch mark on apprentice cloak edge. No burning clothes or lightning inside.',
  31:'King closes his eyes as if listening for distant bells. No bell in palace.',
  32:'King STANDING near a window, blanket around shoulders, hand lightly leaning on window ledge OUTSIDE this foreground layer; looks out. Apprentice stands behind him.',
  33:'King STANDING near the window in wonder, grey blanket around shoulders, one hand reaching gently toward window frame outside this layer. Apprentice quietly behind. Clear morning.',
  34:'King seated, holding a small old CLOSED chronicle on his lap, turning toward the clear blue sky, attentive apprentice. No city or bridge inside.',
  35:'King looks down at both OPEN thin hands above his grey blanket, troubled. Apprentice stands quietly. No doll or soul-transfer diagram.',
  36:'King looks across the empty hall then toward his empty chancellor chair, reflective. No literal crowd or spectators.',
  37:'King raises one relaxed hand to advise apprentice to let his dolls rest. No need to add a doll, no drinking or new cup.',
  38:'King sits with eyes CLOSED, thinking of the keeper who picks up lanterns. Do NOT bring a lantern into palace; no Ordo or Morden.',
  39:'King compares a small wooden NAME TAG and an old folded royal decree, one held in each hand, then eyes turn toward EMPTY chair. All marks illegible.',
  40:'King leans back, half closed eyes, hand over heart while acknowledging a grave. No lantern brought back, no coffin in palace.',
  41:'King grips the original invisible armrests firmly while hearing Ordo seeks soul kingship. Troubled eyes lowered. Grey blanket; no held crown, he wears crown. Apprentice attentive. No present-day Ordo or Morden.',
  42:'King lowers his eyes with a faint rueful smile, recalling Ordo fleeing thanks. No literal lantern brought into palace, no city or dolls needed.',
  43:'King STANDING at the window with grey blanket over shoulders, looking UP toward sunlit blue sky, one hand supported lightly against window frame outside foreground; apprentice behind. No rain indoors.',
  44:'King looks down at his own wrinkled OPEN hands on the grey lap blanket. No newly delivered vessel.',
  45:'King studies an old leather-bound book OPEN on his lap, index finger on BLANK final page. No legible writing.',
  46:'King holds his removed pointed gold crown gently in BOTH hands above the grey blanket, looking into its rim; bare white-haired head. NO second crown.',
  47:'King grips original invisible armrests and looks DOWN toward the old gold goblet on the floor, which will be added separately. No goblet in hands.',
  48:'King covers his eyes with one hand in shame; other hand open over blanket. NO funeral masks or coffin transported into palace.',
  49:'King sits more upright with a calm faint smile, looks at his OPEN hands, grey blanket. No coffin in palace.',
  50:'King traces original invisible armrest with one fingertip, reflecting on servants he counted by their work. No need for a copied metal tag in hands.',
  51:'King leans forward, listening with humane interest to the story of a hand made for one person. No detached hands or factory props.',
  52:'King gestures kindly toward an elderly plain brown-robed ATTENDANT who is sitting down on a small modest movable wooden stool. Include that stool ONLY with attendant; NOT a throne or chancellor chair. Attendant looks surprised but grateful. Apprentice quietly watching.',
  53:'King looks gently toward an elderly brown-robed ATTENDANT seated on a modest wooden stool. Include the stool ONLY with attendant. King thoughtful. Apprentice reports. No chancellor.',
  54:'King lowers gaze to his own ordinary SHOD FEET below the grey blanket, moved by news of a father making shoes for his daughter. No wooden shoes or craftsman.',
  55:'King turns his white bearded FACE toward the window, tender contemplative profile; apprentice quietly reports. No magic mirror or ghost.',
  56:'King troubled face, right hand FIRMLY curled to GRIP original invisible armrest, thumb plus four fingers, other hand on grey blanket. No literal chains, bells or sleeping doll.',
  57:'King looks directly toward apprentice, gentle and vulnerable, ONE relaxed hand OPEN above the armrest. Patient conversation. No bell or archbishop soul light.'
};
const ids=process.argv.slice(2);
const requests=[];
for(const id of ids){
 const s=SCENES.find(s=>s.id===id);if(!s)throw new Error(id);
 const n=Number(id.split('w')[1]||0);
 const story=execFileSync('node',['tools/storyart/prompt.mjs',id],{encoding:'utf8'});
 writeFileSync(out+'/prompts/'+id+'-story.md',story.trimEnd()+'\n');
 const view=wide.has(n)?(n%3===0?'right':n%3===1?'left':'high'):'audience';
 const cast=early.has(n)?'THREE':(n===52||n===53)?'THREE':'TWO';
 const third=early.has(n)?'Third figure at far RIGHT: MORDEN, ageless gaunt pale narrow face, sunken dark eyes, tall black-purple ceremonial hat with gold band, red inner robe, dark violet gold embroidered outer robes, heavy gold chain red jewel. Chest COMPLETELY CLOSED. No white hair. Seated unless the specific scene requires standing.':(n===52||n===53)?'Third figure at far RIGHT: elderly palace ATTENDANT, simple brown robe, ordinary grey hair, sitting on a SMALL PLAIN WOODEN STOOL (include stool in this figure only). No ceremonial hat or crown.':'';
 const characterPose=[32,33,43].includes(n)?'King STANDING, full body, near-window pose.':'King SEATED on an INVISIBLE chair, weight on hips and knees bent, robe hanging naturally over both shod feet. NO visible chair whatsoever.';
 const prompt=`Create a NEW transparent RGBA FOREGROUND ASSET SHEET 1536x1024 with exactly ${cast} separate full-body figures. No scene, background, floor or furniture except a requested attendant stool. Reference 1 supplies camera ${view}, materials and blue/amber lighting ONLY. Other references define identities and old scene style. Newly draw these poses, NEVER cut people from the old painting. Preserve lavish fine-grained pixel-textured dark fantasy style and natural ADULT anatomy. Thumb plus FOUR fingers, exactly two arms and legs.\nCRITICAL LAYOUT: apprentice full body in LEFT third, king full body in MIDDLE third, ${cast==='THREE'?'third person full body in RIGHT third':'leave right third transparent'}. At least 60px TRANSPARENT GAP between figures, no overlapping silhouettes or shadows. At least 40px margin around entire bodies, no cropped head or feet. These are separately placeable assets, NOT a composite conversation. Keep hands close enough to own body to maintain gaps. No text/labels/panels. Render no chair, armrest, desk, dais, window, throne, candles or background glow.\nKING: very old white haired long white bearded man, pointed gold crown unless explicitly removed, RED gold embroidered robes, white ermine with BLACK spots. ${n>=22?'Grey lap blanket, frail thin body.':n>=13?'Frail thin aging body, NO grey blanket.':'Earlier reign elderly king, NO lap blanket.'} ${characterPose} Use a ${view==='audience'?'front three-quarter':view==='high'?'clearly DOWNWARD high oblique':view==='left'?'three-quarter view from his RIGHT, entrance-left camera':'three-quarter view from his LEFT, entrance-right camera'} perspective. Turn his eyes toward apprentice final position.\nAPPRENTICE: young ADULT brown tousled hair, charcoal black travel cloak with restrained geometric gold embroidery, brown leather crossbody satchel, ordinary boots. Standing, full body BACK three-quarter profile reporting toward king; no hood over hair, no lantern. Same camera ${view}; preserve his identity.\n${third}\nSPECIFIC MOMENT: ${detail[n]||'King gently holds out THREE differently colored tiny souls over his open palm; apprentice receives the little lights with both hands. No dolls or other people.'}\n${n>=33?'Soft bright blue DAY window light with restrained amber candles.':'Cool blue window light, restrained warm amber candles.'} Match lighting physically across both figures. No Ordo, visions, readable writing or invented props. Transparent everywhere outside the people and specifically requested objects. No drop shadow or floating floors.`;
 const refs=['/workspace/DOS/docs/art/story-refs/palace-3d/finished/'+view+'.png','/workspace/DOS/docs/art/story-refs/king.png','/workspace/DOS/docs/art/story-refs/apprentice.png'];
 if(early.has(n))refs.push('/workspace/DOS/docs/art/story-refs/morden.png');
 refs.push('/workspace/DOS/'+scenePaths(id).master);
 writeFileSync(out+'/prompts/'+id+'.txt',prompt);
 requests.push({id,prompt,refs,view,master:scenePaths(id).master,chapter:s.chapter});
}
console.log(JSON.stringify(requests));

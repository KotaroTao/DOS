"""8000番でゲームを配信し、魔封じでの道具・浮遊表示・床の回避を確認する。"""
import pathlib
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parents[2]
source = (root / 'src/game.js').read_text() + '''
window.__itemCheck = { useItem, floatLeft, dockSpec, castField, resolveCell, walkerLift,
  ITEMS, cloneItem, Battle, skillUsable, renderBoard,
  quiet() { autosave = () => {}; } };
'''
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = browser.new_context(service_workers='block')
    ctx.route('**/src/game.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=source))
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testInf=51&testInfLv=55')
    page.wait_for_function('window.__game?.G.state === "board" && window.__itemCheck')
    print(page.evaluate('''async () => {
      const T = __itemCheck, G = __game.G;
      const { reseedRng } = await import('/src/rng.js');
      const { useWhere, useTarget, useCureKinds } = await import('/src/items.js');
      const check = (ok, why) => { if (!ok) throw Error(why); };
      T.quiet(); G.anim = null; G.walking = false;
      G.abyss.rule = 'physOnly';
      G.party.forEach(p => { p.spells = []; p.passiveMap = {}; });
      const owner = G.party[0];
      const give = id => { const it = T.cloneItem(id); owner.items.push(it); return it; };
      const use = it => T.useItem(owner, owner.items.indexOf(it));
      const feather = give('u_float_feather');
      use(feather);
      check(T.floatLeft() === 2 && !owner.items.includes(feather), '羽の消費・浮遊');
      const float = () => T.dockSpec().fields.filter(f => f.kind === 'float');
      check(float().length === 1 && float()[0].tag === '浮遊 残2', '魔封じ・未習得でも浮遊の残りを表示');
      T.renderBoard();
      check(document.querySelector('.dk-float.k-float.on')?.getAttribute('aria-label').includes('残り2階'), '実際の札に残りを表示');
      const mp = owner.mp;
      T.castField('FUYUU');
      check(owner.mp === mp && T.floatLeft() === 2, '効果の確認でMPを使わない');
      check(__game.logHistory().some(x => JSON.stringify(x).includes('浮遊中')), '魔封じの拒否ではなく効果を案内');
      const hp = G.party.map(p => p.hp), floor = G.floor;
      T.resolveCell({type:'pit'}); T.resolveCell({type:'poison'});
      check(G.floor === floor && !G.anim && !G._walkAbort, '浮遊で落ちる床を回避');
      check(JSON.stringify(hp) === JSON.stringify(G.party.map(p => p.hp)), '浮遊で蝕む床を回避');
      check(T.walkerLift(1000) > 0, '駒の浮遊表示');
      const spare = give('u_float_feather'); use(spare);
      check(owner.items.includes(spare), '同じ残り階数で羽を浪費しない');
      G.party.forEach(p => p.alive = false);
      check(float().length === 1, '術者が倒れても効果中の札を表示');
      G.party.forEach(p => p.alive = true);
      G.run.float = 1;
      check(float()[0].tag === '浮遊 残1', '残り1階の表示');
      use(spare); check(T.floatLeft() === 2, '羽で残りを延長');
      G.run.float = 0;
      check(float().length === 0, '効果切れ・未習得なら札を消す');
      owner.spells = ['FUYUU'];
      T.castField('FUYUU');
      check(T.floatLeft() === 0 && owner.mp === mp && !T.skillUsable('FUYUU'), '魔封じ中の術は禁止を維持');
      G.abyss.rule = null;
      check(float().length === 1 && !float()[0].on, '通常時は未発動の術を表示');

      // 同じ乱数・対象で、全道具の効果と消費を通常時/魔封じで比較する。
      const unit = side => ({name:side,side,alive:true,hp:500,maxhp:1000,mp:0,maxmp:100,
        atk:20,vit:10,agi:10,int:10,pie:10,luk:10,level:55,jobLv:55,lv:55,
        spells:[],passiveMap:{},items:[],equip:{},resists:{},ailRes:{}});
      const snapshot = p => ({hp:p.hp,mp:p.mp,alive:p.alive,ailment:p.ailment,
        asleep:p.asleep,mind:p.mind,effects:p.effects});
      let fieldCount = 0, battleCount = 0;
      for (const [id, def] of Object.entries(T.ITEMS)) {
        if (def.slot !== 'use' || !def.use) continue;
        const where = useWhere(def), u = def.use;
        if (where === 'field') continue; // 羽は上で確認。帰還の鈴は無限迷宮では仕様として禁止。
        for (const battle of where === 'battle' ? [true] : [false,true]) {
          const outcomes = [];
          for (const rule of [null,'physOnly']) {
            G.abyss.rule = rule; G.state = battle ? 'combat' : 'board';
            const a = unit('party'), target = unit('party'), enemy = unit('enemy');
            const it = T.cloneItem(id); a.items.push(it); G.party = [a,target];
            reseedRng(12345);
            const b = battle ? new T.Battle(G.party, [enemy], () => {}) : null;
            if (u.revive) { target.alive = false; target.hp = 0; }
            const ail = useCureKinds(u)[0];
            if (ail === 'sleep') target.asleep = true;
            else if (ail === 'charm' || ail === 'confuse') target.mind = ail;
            else if (ail) target.ailment = ail;
            if (battle) {
              b.current = a;
              const chosen = b.chooseAction('item', null, {item:it,owner:a});
              check(!chosen.invalid, id + ': 使用の受付');
              if (chosen.needTarget) b.chooseTarget(useTarget(it) === 'enemy' ? enemy : target);
              b.commit();
            } else T.useItem(a, 0, target);
            check(!a.items.includes(it), id + ': 消費');
            outcomes.push(JSON.stringify({party:G.party.map(snapshot),enemy:snapshot(enemy),result:b?.result}));
          }
          check(outcomes[0] === outcomes[1], id + ': 魔封じで効果が変わった');
          if (battle) battleCount++; else fieldCount++;
        }
      }
      return `浮遊の表示・床回避・魔法禁止 OK / 道具: 探索中${fieldCount}種・戦闘中${battleCount}種で魔封じの有無による差なし`;
    }'''))
    assert not errors, errors
    browser.close()

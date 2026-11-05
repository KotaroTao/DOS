"""記録準備Workerの非同期失敗でも、記録と共有参照を保って処理を続ける。"""
import os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.webkit.launch() if os.environ.get('DOS_TEST_BROWSER')=='webkit' else p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(service_workers='block')
    page.route('**/codec-harness',lambda r:r.fulfill(content_type='text/html',body='<body></body>'))
    page.goto(os.environ.get('DOS_TEST_URL','http://127.0.0.1:8001')+'/codec-harness')
    page.evaluate('''async()=>{
      let created=0,terminated=0;
      window.Worker=class {
        constructor(){created++;}
        postMessage(){setTimeout(()=>this.onerror?.({preventDefault(){}}),0);}
        terminate(){terminated++;}
      };
      const codec=await import('/src/save-codec.js'),{refDeserialize}=await import('/src/savegraph.js');
      const item={id:'dagger',bukon:[{k:'flat_atk',lv:'12345678901234567890'}]};
      const snapshot={gold:123,party:[{equip:{weapon:item}}],inventory:[item],bukonStock:{'flat_hp:1':'99999999999999999'}};
      item.self=item;
      const [raw,replay]=await Promise.all([codec.encodeCloudSave(snapshot,true),codec.replayCloudCommandPrepared({}, {},'test')]);
      const restored=refDeserialize(JSON.parse(raw));
      if(restored.gold!==123||restored.party[0].equip.weapon!==restored.inventory[0]||restored.inventory[0].self!==restored.inventory[0])throw Error('記録や参照が変化した');
      if(restored.inventory[0].bukon[0].lv!==item.bukon[0].lv||restored.bukonStock['flat_hp:1']!==snapshot.bukonStock['flat_hp:1'])throw Error('武魂の数値が変化した');
      if(replay!==null||codec.cloudWorkerReady())throw Error('使えないWorkerで戦闘を処理した');
      const next=refDeserialize(JSON.parse(await codec.encodeCloudSave({gold:456},true)));
      if(next.gold!==456||created!==1||terminated!==1)throw Error('失敗するWorkerを作り直した');
    }''')
    print('Worker非同期失敗: 複数要求の代替処理・共有参照・循環・武魂・以後の保存: OK')
    browser.close()

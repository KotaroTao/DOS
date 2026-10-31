"""クラウド保存を再点検する。ブラウザ検査には8000/8001のゲームと8002の検証APIが必要。"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pglite',required=True,help='PGliteのdist/index.jsの絶対パス')
parser.add_argument('--node-only',action='store_true')
parser.add_argument('--logs',default='/tmp/dos-cloud-audit')
args=parser.parse_args()
logs=Path(args.logs);logs.mkdir(parents=True,exist_ok=True)
cases=[]
for name in ['commands-check.mjs','metrics-check.mjs','check.mjs','codec-check.mjs','compact-check.mjs','recover-raw-check.mjs','worker-fallback-check.mjs','database-check.mjs','deploy-check.mjs']:
 cmd=['node','tools/cloud/'+name]
 if name=='database-check.mjs':cmd.append(args.pglite)
 cases.append((name,cmd,{}))
cases.append(('local-save-check',['node','tools/save-protection/check.mjs'],{}))
if not args.node_only:
 for name in ['commands-browser.py','auth-metrics-browser.py','boot-recovery-browser.py','exit-browser.py','browser-check.py','onboarding-browser-check.py','recovery-browser.py','pending-timeout-browser.py','startup-wait-browser.py','inventory-browser.py','victory-browser.py','effects-browser.py','tempo-browser.py','town-screens-browser.py','unobtrusive-browser.py','quiet-loading-browser.py','performance-browser.py']:
  cases.append((name,[sys.executable,'tools/cloud/'+name],{}))
 cases.append(('crash-inventory',[sys.executable,'tools/cloud/inventory-browser.py'],{'DOS_CRASH_RECOVERY':'1'}))
 for name in ['browser-check.py','update-browser-check.py','title-delete-browser-check.py','update-detection-browser.py']:
  cases.append(('save-'+name,[sys.executable,'tools/save-protection/'+name],{}))
results=[]
for name,cmd,extra in cases:
 start=time.monotonic()
 try:
  result=subprocess.run(cmd,cwd=ROOT,env={**os.environ,**extra},capture_output=True,text=True,timeout=240)
  output=result.stdout+result.stderr;passed=result.returncode==0
 except subprocess.TimeoutExpired as error:
  output=str(error);passed=False
 path=logs/(name+'.log');path.write_text(output)
 results.append({'name':name,'passed':passed,'seconds':round(time.monotonic()-start,1),'log':str(path)})
 print(('PASS' if passed else 'FAIL')+' '+name,flush=True)
 if not passed:print(output[-1500:],flush=True)
(logs/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(str(sum(r['passed'] for r in results))+'/'+str(len(results))+' 通過。記録: '+str(logs/'results.json'))
sys.exit(0 if all(r['passed'] for r in results) else 1)

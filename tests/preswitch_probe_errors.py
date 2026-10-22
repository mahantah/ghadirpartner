"""Execute the generated probe against isolated fixtures; never contacts a server."""
from pathlib import Path
import importlib.util
import json
import subprocess
import tempfile
import textwrap

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('safety', ROOT/'scripts/preswitch_safety.py')
safety = importlib.util.module_from_spec(spec)
spec.loader.exec_module(safety)
workflow = (ROOT/'.github/workflows/deploy-final-v53438.yml').read_text()
start = '          cat > "/tmp/$FILE" <<\'PHP\'\n'
probe = textwrap.dedent(workflow.split(start,1)[1].split('\n          PHP\n',1)[0])
inline_spec = importlib.util.spec_from_file_location('inline_integrity', ROOT/'scripts/inline-preswitch-integrity.py')
inline = importlib.util.module_from_spec(inline_spec)
inline_spec.loader.exec_module(inline)
probe = inline.inline_probe(probe)
# Supplying the token is isolated to this test PHP process.
probe = probe.replace("header('Content-Type: application/json; charset=utf-8');", "$_GET['token']='fixture-token';\nheader('Content-Type: application/json; charset=utf-8');",1)
probe = probe.replace('__TOKEN__','fixture-token')
secret = 'private-fixture-value-must-never-appear'

def run(config, expected, phase=None, prefix='', state=None):
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root/'probe.php').write_text(probe.replace('<?php','<?php\n'+prefix,1))
        if config is not None:
            (root/'config.php').write_text(config)
        if state is not None:
            (root/'fixture.json').write_text(json.dumps(state))
        result = subprocess.run(['php',str(root/'probe.php')],capture_output=True,text=True,timeout=15)
        assert secret not in result.stdout, 'Raw configuration/error value leaked'
        payload = json.loads(result.stdout)
        if expected == 'ok':
            assert payload['ok'] is True
            assert safety.classify_failure(payload,'200') == 'ok'
            assert list((root/'storage/Backups').glob('ghadir-mysql-pre-exact-v53438-*.json')), 'Backup was omitted'
        else:
            assert payload['ok'] is False and payload['guard'] == expected, payload
            if phase: assert payload['phase'] == phase, payload
            report = root/'report.json';report.write_text(result.stdout)
            rejected = subprocess.run(['python3',str(ROOT/'scripts/preswitch_safety.py'),'classify',str(report),'500'],capture_output=True,text=True)
            assert rejected.returncode == 2 and secret not in rejected.stderr, 'Failure was accepted or a secret was logged'
        return payload

run(None,'configuration_error','configuration')
run("<?php echo '"+secret+"'; throw new RuntimeException('"+secret+"');",'configuration_error','configuration')
run("<?php syntax failure fixture",'configuration_error','configuration')
run("<?php return 42;",'configuration_error','configuration')
run("<?php exit('"+secret+"');",'probe_terminated','configuration')
run("<?php trigger_error('"+secret+"',E_USER_ERROR);",'php_fatal_error','configuration')
run("<?php trigger_error('Allowed memory size fixture "+secret+"',E_USER_ERROR);",'php_memory_limit','configuration')
run("<?php return ['mysql'=>['host'=>'127.0.0.1','port'=>1,'username'=>'fixture','password'=>'"+secret+"']];",'database_error','database_connection')

# Fake PDO is scoped to a test namespace. It allows only the exact original SELECT.
prefix = r'''namespace ProbeFixture;
use \RuntimeException; use \Throwable;
class PDO {
 const ATTR_ERRMODE=3; const ERRMODE_EXCEPTION=2; const ATTR_DEFAULT_FETCH_MODE=19; const FETCH_ASSOC=2;
 function __construct($dsn,$user,$password,$options){}
 function query($sql){
  if($sql!=="SELECT state_json,revision FROM ghadir_state WHERE id=1")throw new RuntimeException('Unexpected SQL');
  return new Result();
 }
}
class Result { function fetch(){return ['revision'=>1,'state_json'=>file_get_contents(__DIR__.'/fixture.json')];} }
'''
state = {'cartons':[], 'inventory':[], 'orders':[]}
for i, code in enumerate(safety.PROTECTED_CARTONS,1):
    state['cartons'].append({'id':i,'code':code,'product':'I90'})
    state['inventory'].extend({'carton_id':i,'carton_code':code,'order_id':0,
        'serial':f'MOCK-{i}-{n}','product':'I90','warehouse_id':1} for n in range(20))
state['cartons'].extend({'id':1000+i,'code':'fixture-'+str(i)} for i in range(safety.MIN_CARTONS-len(state['cartons'])))
state['inventory'].extend({'carton_id':0,'order_id':0} for _ in range(safety.MIN_INVENTORY-len(state['inventory'])))
run("<?php return ['mysql'=>[]];",'ok',prefix=prefix,state=state)
state['inventory'][0]['order_id']=99
payload = run("<?php return ['mysql'=>[]];",'protected_carton_state_mismatch','protected_counts',prefix=prefix,state=state)
assert payload['actual']==20 and payload['free']==19 and payload['reserved']==1
assert payload['kind']=='invalid_allocation_order' and payload['allocated']==1
# A complete, valid customer allocation must pass unchanged; it is not a free-stock error.
serials=[r['serial'] for r in state['inventory'][:20]]
for row in state['inventory'][:20]:row['order_id']=99
state['orders']=[{'id':99,'number':'SAMPLE-ORDER','status':'در حال آماده سازی',
    'items':[{'product':'I90','qty':20,'serials':serials}]}]
run("<?php return ['mysql'=>[]];",'ok',prefix=prefix,state=state)
print('PASS: 11 generated-probe scenarios; failures redacted and blocked; valid allocation preserved and invalid allocation rejected')

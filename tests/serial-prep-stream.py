"""Validate the finite source patch without accessing production records."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import tempfile
root=Path(__file__).resolve().parents[1]
m=json.loads((root/'config/serial-prep-stream.json').read_text())
assert set(m['before_files'])==set(m['expected_files'])=={'app.html','assets/ops-v53434.js','assets/partial-exit-v53422.js'}
assert len(m['protected_cartons'])==18
assert all(op['file'] in m['before_files'] and op['count']==1 for op in m['operations'])
subprocess.run(['node','--check',str(root/'scripts/serial-prep-runtime.js')],check=True)
if os.environ.get('GP_OWNER_SOURCE'):
    files={f:(Path(os.environ['GP_OWNER_SOURCE'])/f).read_text() for f in m['before_files']}
    for f,h in m['before_files'].items():assert hashlib.sha256(files[f].encode()).hexdigest()==h
    for op in m['operations']:
        assert files[op['file']].count(op['old'])==op['count'],op['file']
        files[op['file']]=files[op['file']].replace(op['old'],op['new'])
    for f,h in m['expected_files'].items():assert hashlib.sha256(files[f].encode()).hexdigest()==h
    with tempfile.TemporaryDirectory() as tmp:
        for f,text in files.items():
            if not f.endswith('.js'):continue
            p=Path(tmp)/Path(f).name;p.write_text(text);subprocess.run(['node','--check',str(p)],check=True)
print('PASS: bounded code-only serial patch, source hashes and JS syntax')

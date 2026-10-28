"""Validate a finite floating-filter patch, optionally against the private baseline."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import tempfile
root = Path(__file__).resolve().parents[1]
m = json.loads((root/'config/exit-report-floating-filters.json').read_text())
assert set(m['before_files']) == set(m['expected_files']) == {'app.html','assets/search-filter-fab-v1.js'}
assert len(m['protected_cartons']) == 18 and len(m['operations']) == 5
if os.environ.get('GP_OWNER_SOURCE'):
    files={f:(Path(os.environ['GP_OWNER_SOURCE'])/f).read_text() for f in m['before_files']}
    for f,h in m['before_files'].items():assert hashlib.sha256(files[f].encode()).hexdigest()==h
    for op in m['operations']:
        assert files[op['file']].count(op['old'])==op['count']
        files[op['file']]=files[op['file']].replace(op['old'],op['new'])
    for f,h in m['expected_files'].items():assert hashlib.sha256(files[f].encode()).hexdigest()==h
    with tempfile.TemporaryDirectory() as tmp:
        p=Path(tmp)/'filters.js';p.write_text(files['assets/search-filter-fab-v1.js']);subprocess.run(['node','--check',str(p)],check=True)
print('PASS: floating filters finite patch, source hashes and syntax')

"""Validate the bounded exit-report-only patch and optional private source."""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
m = json.loads((root / 'config/exit-report-only-pdf.json').read_text())
assert set(m['before_files']) == set(m['expected_files']) == {'app.html'}
assert len(m['protected_cartons']) == 18
assert len(m['operations']) == 4
assert all(op['file'] == 'app.html' and op['count'] == 1 for op in m['operations'])
assert any('printExitReportPdf' in op['new'] and 'popup.print()' in op['new'] for op in m['operations'])
controls = json.loads((root / 'config/exit-report-clean-controls.json').read_text())
assert set(controls['before_files']) == set(controls['expected_files']) == {'app.html'}
assert len(controls['operations']) == 1 and "w.querySelector('#repBody')" in controls['operations'][0]['new']
if os.environ.get('GP_OWNER_SOURCE'):
    text = (Path(os.environ['GP_OWNER_SOURCE']) / 'app.html').read_text()
    assert hashlib.sha256(text.encode()).hexdigest() == m['before_files']['app.html']
    for op in m['operations']:
        assert text.count(op['old']) == op['count']
        text = text.replace(op['old'], op['new'])
    assert hashlib.sha256(text.encode()).hexdigest() == m['expected_files']['app.html']
    assert 'GP_EXIT_REPORT_ONLY_PDF_20261028' in text
    with tempfile.TemporaryDirectory() as tmp:
        for i, script in enumerate(re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>', text)):
            p = Path(tmp) / f'inline-{i}.js'
            p.write_text(script)
            subprocess.run(['node', '--check', str(p)], check=True)
print('PASS: exit-report-only manifest, PDF print action, all private-source inline script syntax')

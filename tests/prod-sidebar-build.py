#!/usr/bin/env python3
"""Verify generated-shell injection and rejection of missing prerequisites."""
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PATCH = ROOT / 'scripts' / 'patch-prod-sidebar-controls-v1.py'
PREREQS = (
    'GHADIR_NAV_MORPH_V1_20261017',
    'GHADIR_SIDEBAR_EDGE_PROFILE_V2_20261017',
    'GHADIR_SIDEBAR_REAL_EDGE_V4_20261017',
    'id="changePasswordBtn"', 'id="logoutbtn"', 'id="who"', 'sidebar-open',
)
with tempfile.TemporaryDirectory(prefix='ghadir-sidebar-') as name:
    root = Path(name)
    html = root / 'app.html'
    html.write_text('<html><head></head><body>' + ' '.join(PREREQS) + '</body></html>', encoding='utf-8')
    for _ in range(2):
        subprocess.run([sys.executable, str(PATCH), str(root)], check=True, capture_output=True)
    content = html.read_text(encoding='utf-8')
    assert content.count('GHADIR_PROD_SIDEBAR_CONTROLS_V1_20261023') == 1
    assert content.count('prod-sidebar-controls-v1.css?v=20261023a1') == 1
    assert content.count('prod-sidebar-controls-v1.js?v=20261023a1') == 1
    for extension in ('js','css'):
        file = f'prod-sidebar-controls-v1.{extension}'
        assert (root / 'assets' / file).read_bytes() == (ROOT / 'assets' / file).read_bytes()
    html.write_text('<html><head></head><body>sidebar-open</body></html>', encoding='utf-8')
    result = subprocess.run([sys.executable, str(PATCH), str(root)], capture_output=True)
    assert result.returncode != 0, 'must fail closed if original controls are missing'
print('production sidebar build patch: PASS')

"""Offline regression for the minimal, fail-closed sidebar placement release."""
import importlib.util
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'scripts/deploy-production-sidebar-placement-v2.py'
spec = importlib.util.spec_from_file_location('sidebar_placement_v2', path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

base = b'''<html><head>
<link rel="stylesheet" href="/assets/production-sidebar-controls-v1.css?v=1">
</head><body><div id="app"><button id="changePasswordBtn"></button>
<button id="logoutbtn"></button><button id="desktopSidebarCollapse"></button>
<button id="gpSidebarSwitch"></button></div>
<script src="/assets/production-sidebar-controls-v1.js?v=1" defer></script>
</body></html>'''
patched = mod.prepare_html(base)
assert patched.count(mod.CSS.encode()) == 1
assert patched.count(mod.JS.encode()) == 1
assert patched.replace(mod.STYLE.encode(), b'', 1).replace(mod.SCRIPT.encode(), b'', 1) == base
for broken in (
    base.replace(b'id="logoutbtn"', b'id="notLogout"'),
    base.replace(b'id="app"', b'id="notApp"'),
    base.replace(b'desktopSidebarCollapse', b'notCollapsed'),
    base.replace(b'production-sidebar-controls-v1.js?v=1', b'bad.js'),
    base.replace(b'</head>', b''),
    base.replace(b'</body>', b''),
    base.replace(b'</body>', b'</body></body>'),
    patched,
):
    try:
        mod.prepare_html(broken)
    except ValueError:
        pass
    else:
        raise AssertionError('Unsafe source accepted')
print('Production sidebar V2 minimal HTML patch tests OK')

"""No-network test for safe CSS-only presentation hotfix."""
import importlib.util
from pathlib import Path

root = Path(__file__).resolve().parents[1]
script = root / 'scripts/deploy-production-sidebar-orange-frame-v3.py'
spec = importlib.util.spec_from_file_location('sidebar_orange_frame_v3', script)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

updated_css = (root / mod.CSS_PATH).read_bytes()
original_css = mod.expected_old_css(updated_css)
assert b'#app #gpSidebarSwitch .gp-switch-bars' not in updated_css  # animations remain in V1
assert original_css.count(b'#app #gpSidebarSwitch:focus-visible') == 1
assert updated_css.count(b'border: 0 !important;') == 2
assert updated_css.count(b'background: #102a43 !important;') == 2
assert original_css != updated_css
assert mod.expected_old_css(updated_css) == original_css

html = (b'<html><head><link href="' + mod.OLD_CSS_URL +
        b'"><script src="/assets/production-sidebar-placement-v2.js?v=2"></script>' +
        b'</head><body><main id="app"></main></body></html>')
updated_html = mod.expected_new_html(html)
assert updated_html.replace(mod.NEW_CSS_URL, mod.OLD_CSS_URL) == html
for broken in (updated_html, html.replace(b'id="app"', b'id="other"'),
               html.replace(mod.OLD_CSS_URL, b''), html + mod.OLD_CSS_URL):
    try:
        mod.expected_new_html(broken)
    except ValueError:
        pass
    else:
        raise AssertionError('STOP: unexpected live HTML accepted')
try:
    mod.expected_old_css(updated_css.replace(b'border: 0 !important;', b'border: 1px solid orange;', 1))
except ValueError:
    pass
else:
    raise AssertionError('STOP: unexpected source CSS edit accepted')

print('PASS: sidebar frame V3 CSS exact-diff, cache-bust and fail-closed HTML')

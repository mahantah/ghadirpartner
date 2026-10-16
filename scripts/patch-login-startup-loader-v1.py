#!/usr/bin/env python3
"""Render a first-paint branded loader in the currently deployed app.html.

This patch changes only the HTML entrypoint, never authentication endpoints, API
contracts, database contents, session state, or any existing login forms.
"""
from pathlib import Path
import re
import sys

MARKER = 'GHADIR_LOGIN_STARTUP_SPLASH_V1_20261017'
root = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if root is None or not (root / 'app.html').is_file():
    raise SystemExit('Expected build output directory with app.html')
entrypoint = root / 'app.html'
html = entrypoint.read_text(encoding='utf-8')
if MARKER in html:
    if html.count(MARKER) >= 2 and 'id="gp-login-startup"' in html:
        print('Login startup loader is already installed')
        sys.exit(0)
    raise SystemExit('Partial startup-loader patch detected; no changes written')
if 'GHADIR_STAFF_LOGIN_OTP_UI_V1_20261016' not in html:
    raise SystemExit('Staff OTP login patch must be applied before startup loader')
if html.count('</head>') != 1:
    raise SystemExit('HTML head structure changed; refusing to patch')
body = re.search(r'<body\b[^>]*>', html, flags=re.IGNORECASE)
if not body or len(re.findall(r'<body\b[^>]*>', html, flags=re.IGNORECASE)) != 1:
    raise SystemExit('HTML body structure changed; refusing to patch')

# Self-contained critical styles, available before the large application script
# and before the separate OTP stylesheet/downloads have finished.
critical_css = '''
<!-- GHADIR_LOGIN_STARTUP_SPLASH_V1_20261017 -->
<style id="gp-login-startup-style">
#gp-login-startup{position:fixed;inset:0;z-index:110000;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:24px;min-height:100vh;min-height:100dvh;padding:20px;box-sizing:border-box;background:radial-gradient(ellipse at 20% 18%,#1b385b 0,transparent 45%),linear-gradient(135deg,#061323,#0b2443 55%,#071629);color:#f7fbff;text-align:center;direction:rtl;font:700 15px Tahoma,Arial,sans-serif;opacity:1;visibility:visible;pointer-events:all;animation:gp-startup-failsafe 0s linear 9s forwards}
#gp-login-startup.is-ready{animation:none!important;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .16s ease,visibility 0s linear .16s}
#gp-login-startup .gp-startup-cube{position:relative;width:150px;height:150px;display:grid;place-items:center;isolation:isolate}
#gp-login-startup .gp-startup-cube:before,#gp-login-startup .gp-startup-cube:after{content:"";position:absolute;inset:0;border-radius:30px}
#gp-login-startup .gp-startup-cube:before{background:linear-gradient(135deg,#1afbf0,#da00ff);filter:blur(2px);animation:gp-startup-spin 2.5s ease-in-out infinite}
#gp-login-startup .gp-startup-cube:after{background:rgba(255,255,255,.17);border:2px solid rgba(255,55,255,.3);box-sizing:border-box}
#gp-login-startup img{position:relative;z-index:1;width:104px;height:104px;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(0,0,0,.22))}
#gp-login-startup .gp-startup-title{font-size:18px;line-height:1.7;color:#fff}
#gp-login-startup .gp-startup-subtitle{font-size:12px;font-weight:500;color:#adbed4;margin-top:-16px}
@keyframes gp-startup-spin{50%{transform:rotate(-80deg)}}
@keyframes gp-startup-failsafe{to{visibility:hidden;opacity:0;pointer-events:none}}
@media(prefers-reduced-motion:reduce){#gp-login-startup .gp-startup-cube:before{animation:none}#gp-login-startup.is-ready{transition:none}}
</style>
'''
startup_html = '''
<!-- GHADIR_LOGIN_STARTUP_SPLASH_V1_20261017: before legacy application markup -->
<div id="gp-login-startup" role="status" aria-live="polite" aria-label="در حال آماده‌سازی سامانه">
  <div class="gp-startup-cube" aria-hidden="true"><img src="/assets/ghadir-logo-transparent.svg" width="104" height="104" alt=""></div>
  <div class="gp-startup-title">قدیر پارتنر</div>
  <div class="gp-startup-subtitle">در حال آماده‌سازی ورود ...</div>
</div>
<script>
(function(){
  var element=document.getElementById('gp-login-startup');
  if(!element)return;
  var released=false;
  function release(){
    if(released)return;
    released=true;
    window.requestAnimationFrame(function(){
      element.classList.add('is-ready');
      window.setTimeout(function(){if(element.parentNode)element.parentNode.removeChild(element)},300);
    });
  }
  window.GP_LOGIN_STARTUP_READY=release;
  window.setTimeout(release,9000); // Fail open if a script or network request is broken.
  window.addEventListener('pageshow',function(event){if(event.persisted)release()});
  window.addEventListener('load',function(){window.setTimeout(release,600)},{once:true});
})();
</script>
'''
html = html.replace('</head>', critical_css + '</head>', 1)
body = re.search(r'<body\b[^>]*>', html, flags=re.IGNORECASE)
html = html[:body.end()] + startup_html + html[body.end():]
if html.count('id="gp-login-startup"') != 1 or html.count('GP_LOGIN_STARTUP_READY=release') != 1:
    raise SystemExit('Startup loader build failed internal consistency check')
entrypoint.write_text(html, encoding='utf-8')
print('First-paint staff login startup splash added to', entrypoint)
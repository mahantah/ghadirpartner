#!/usr/bin/env python3
"""Add OTP sign-in to the deployed V5.3.4.38 artifact. Fail closed on drift.
This changes only code files in the build output, never config.php/storage/MySQL.
"""
from pathlib import Path
import sys, shutil

MARKER = 'GHADIR_STAFF_LOGIN_OTP_V1_20261016'
TARGET = Path(sys.argv[1]) if len(sys.argv)>1 else None
if not TARGET or not (TARGET/'app.html').is_file() or not (TARGET/'index.php').is_file():
    raise SystemExit('Expected path containing the currently-built app.html and index.php')
ROOT=Path(__file__).resolve().parents[1]
app_file=TARGET/'app.html'
api_file=TARGET/'index.php'
app=app_file.read_text(encoding='utf-8')
api=api_file.read_text(encoding='utf-8')

if MARKER in api or 'GHADIR_STAFF_LOGIN_OTP_UI_V1_20261016' in app:
    if MARKER in api and 'GHADIR_STAFF_LOGIN_OTP_UI_V1_20261016' in app:
        print('OTP login patch previously applied');sys.exit(0)
    raise SystemExit('Partial OTP patch already present; abort before modifying')

# Both endpoints are new: do not reuse password-reset routes (which mutate passwords).
auth_anchor="if($p==='/api/login'&&$m==='POST')"
if api.count(auth_anchor)!=1: raise SystemExit('Login route position changed. Review manually.')
new_endpoint=("/* "+MARKER+" — independent staff sign-in OTP */\n"
              "require_once __DIR__.'/lib/staff-login-otp.php';\n"
              "if($m==='POST' && in_array($p,['/api/staff-login-otp/request','/api/staff-login-otp/verify'],true)) {ghadir_staff_login_otp_route($p,$m);}\n")
api=api.replace(auth_anchor,new_endpoint+auth_anchor,1)

if app.count('</head>')!=1 or app.count('</body>')!=1: raise SystemExit('Unexpected HTML structure')
if 'id="login"' not in app or 'id="lu"' not in app or 'id="lp"' not in app or 'id="loginbtn"' not in app:
    raise SystemExit('Legacy credential controls not found: migration would risk locking staff out')
app=app.replace('</head>', '<!-- GHADIR_STAFF_LOGIN_OTP_UI_V1_20261016 -->\n<link rel="stylesheet" href="/assets/staff-login-otp.css?v=20261016b2">\n</head>',1)
app=app.replace('</body>', '<script src="/assets/staff-login-otp.js?v=20261016b2"></script>\n</body>',1)

# Remove only the square-backed brand image from the sign-in area; don't change
# icons elsewhere in the system. The SVG is recreated from user-provided logo.
app=app.replace('<img src="/brand-v5311.png" alt="لوگوی قدیر پرداخت">','<img src="/assets/ghadir-logo-transparent.svg" alt="لوگوی قدیر پرداخت">')

# Some legacy AJAX handlers call alert(error.message) on initial 401 even though
# the first bootstrap is a normal guest request. Suppress JUST that single
# alert and ONLY while a user is not yet authenticated and login is visible.
# All other errors are retained as-is; after login, even 401s remain visible.
# Keep the same boot and session-expiry handling untouched.
startup_anchor='boot();\n'
if app.count(startup_anchor)!=1:
    raise SystemExit('Could not locate single bootstrap invocation; review startup alert handling')
startup_fix="""/* GHADIR_LOGIN_STARTUP_ALERT_GUARD_V1_20261016 */
(function(){const previousAlert=window.alert.bind(window);
 window.alert=function(){const txt=String(arguments[0]??'').trim();
   const isGuest=typeof ME==='undefined'||!ME;
   const loginVisible=!!document.getElementById('login')&&!document.getElementById('login').classList.contains('hidden');
   if(isGuest&&loginVisible&&txt==='ورود الزامی است')return;
   return previousAlert.apply(window,arguments);
 };})();
"""
app=app.replace(startup_anchor,startup_fix+startup_anchor,1)

# Apply all validation before writing either target file.
api_file.write_text(api,encoding='utf-8')
app_file.write_text(app,encoding='utf-8')
for fname in ['staff-login-otp.php']:
    path=TARGET/'lib'/fname;path.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(ROOT/'lib'/fname,path)
for fname in ['staff-login-otp.css','staff-login-otp.js','ghadir-logo-transparent.svg']:
    path=TARGET/'assets'/fname;path.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(ROOT/'assets'/fname,path)
print('OTP login and startup guest alert fix applied to',TARGET)
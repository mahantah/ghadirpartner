#!/usr/bin/env python3
"""Guarded Ghadir production login-only UI transfer; no DB/API writes."""
import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path

EXPECTED = "4f984fa4eb7e79cef536d49266e562beb2acdba1e430f258192634b1a24dc01c"
ROOT = Path("/tmp/ghadir-production-login")
KIT = Path("production-login-kit")
FILES = {
    "production-login-v1.css": KIT / "assets/staging-login-fullscreen-v2.css",
    "production-login-v1.js": KIT / "assets/staging-login-fullscreen-v2.js",
    "production-login-lobby-v1.webp": KIT / "assets/staging-lobby-login-v5.webp",
    "production-login-brand.png": KIT / "assets/production-login-brand.png",
}

def digest(content):
    return hashlib.sha256(content).hexdigest()

def lftp_quote(value):
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'

def ftp(actions):
    user = os.environ.get("FTP_USERNAME", "")
    host = os.environ.get("FTP_SERVER", "")
    password = os.environ.get("FTP_PASSWORD", "")
    if user.lower() != "deploy@ghadirpartner.ir" or not host or not password:
        raise RuntimeError("Unexpected or missing production FTPS identity")
    source = [
        "set cmd:fail-exit true",
        "set ftp:ssl-force true",
        "set ftp:ssl-protect-data true",
        "set ssl:verify-certificate true",
        "set net:max-retries 2",
        "open -p 21 " + lftp_quote(host),
        "user " + lftp_quote(user) + " " + lftp_quote(password),
        *actions,
        "bye",
    ]
    path = ROOT / "lftp-deploy.txt"
    path.write_text("\n".join(source) + "\n")
    try:
        subprocess.run(["lftp", "-f", str(path)], check=True, timeout=140)
    finally:
        path.unlink(missing_ok=True)

def check_live(path):
    content = path.read_bytes()
    if digest(content) != EXPECTED:
        raise RuntimeError("STOP: production app.html changed; cannot apply login-only patch")
    return content

def check_id_unique(text, key):
    if len(re.findall(r'\bid=["\']' + re.escape(key) + r'["\']', text)) != 1:
        raise RuntimeError("Unexpected application field identifier " + key)

def prepare():
    ROOT.mkdir(parents=True, exist_ok=True)
    for source in FILES.values():
        if not source.is_file() or source.stat().st_size < 100:
            raise RuntimeError("Missing production UI kit source: " + str(source))
    ftp([f"get /app.html -o {lftp_quote(ROOT / 'original-app.html')}"])
    original = check_live(ROOT / "original-app.html")
    live = original.decode("utf-8")
    required_ids = ["login", "app", "lu", "lp", "loginbtn", "lmsg",
                    "staffLoginForm", "staffResetForm", "sri", "sro",
                    "srp", "staffOtpBtn", "staffOtpFields"]
    for key in required_ids:
        check_id_unique(live, key)
    for key in ["toggleStaffReset", "requestStaffOtp", "confirmStaffReset"]:
        pattern = r'\b(?:function\s+' + key + r'\b|(?:window\.)?' + key + r'\s*=)'
        if re.search(pattern, live) is None:
            raise RuntimeError("Missing required existing auth/recovery handler: " + key)
    start_marker = '<div id="login"'
    end_marker = '<div id="app"'
    if live.count(start_marker) != 1 or live.count(end_marker) != 1:
        raise RuntimeError("Ambiguous production application boundaries")
    start, end = live.index(start_marker), live.index(end_marker)
    old_login = live[start:end]
    if not 0 < start < end or not 250 < len(old_login) < 25000:
        raise RuntimeError("Login section size unexpected")
    if '<div id="login" class="automation-login"' not in old_login:
        raise RuntimeError("Production login framework incompatible")
    fragment = (KIT / "login-fragment.html").read_text()
    if (fragment.count(start_marker) != 1 or
        "نسخه آزمایشی" in fragment or
        'class="gp-mini-icon' not in fragment or
        fragment.count('src="/brand-v5311.png"') != 1):
        raise RuntimeError("Login kit fragment failed integrity checks")
    fragment = fragment.replace('src="/brand-v5311.png"',
                                'src="/assets/production-login-brand.png"')
    if "<script" in fragment or "<?php" in fragment:
        raise RuntimeError("Login fragment must not carry executable code")
    css_ref = '<link rel="stylesheet" href="/assets/production-login-v1.css?v=1">\n'
    js_ref = '<script src="/assets/production-login-v1.js?v=1" defer></script>'
    if (live.count("</head>") != 1 or live.count("</body>") != 1 or
        "production-login-v1.css" in live or "production-login-v1.js" in live):
        raise RuntimeError("Production external asset markers not safe to add")
    patched = live[:start] + fragment + "\n" + live[end:]
    patched = patched.replace("</head>", css_ref + "</head>", 1)
    patched = patched.replace("</body>", js_ref + "</body>", 1)
    undone = patched.replace(css_ref, "", 1).replace(js_ref, "", 1)
    a, b = undone.index(start_marker), undone.index(end_marker)
    if undone[:a] != live[:start] or undone[b:] != live[end:]:
        raise RuntimeError("STOP: outside-login application HTML changed")
    for key in required_ids:
        check_id_unique(patched, key)
    (ROOT / "patched-app.html").write_bytes(patched.encode("utf-8"))
    for name, source in FILES.items():
        contents = source.read_bytes()
        if name.endswith(".css"):
            text = contents.decode("utf-8")
            if "staging-lobby-login-v5.webp" not in text:
                raise RuntimeError("CSS background URL not found")
            contents = text.replace("staging-lobby-login-v5.webp",
                                    "production-login-lobby-v1.webp").encode("utf-8")
        (ROOT / name).write_bytes(contents)
    print("PASS: only live #login DOM and CSS/JS references change")
    print("Original app SHA256 verified:", EXPECTED)
    print("Other active application HTML preserved byte-for-byte.")
    print("Snapshot is available as original-app.html for private artifact backup.")

def publish():
    old = check_live(ROOT / "original-app.html")
    ftp([f"get /app.html -o {lftp_quote(ROOT / 'recheck-app.html')}"])
    check_live(ROOT / "recheck-app.html")
    attempted = False
    try:
        attempted = True
        puts = [f"put {lftp_quote(ROOT / name)} -o /assets/{name}"
                for name in FILES]
        puts.append(f"put {lftp_quote(ROOT / 'patched-app.html')} -o /app.html")
        ftp(puts)
        gets = [
            f"get /app.html -o {lftp_quote(ROOT / 'verified-app.html')}",
            *[f"get /assets/{name} -o {lftp_quote(ROOT / ('verified-' + name))}"
              for name in FILES],
        ]
        ftp(gets)
        pairs = [(ROOT / "patched-app.html", ROOT / "verified-app.html")]
        pairs.extend((ROOT / name, ROOT / ("verified-" + name)) for name in FILES)
        for lhs, rhs in pairs:
            if lhs.read_bytes() != rhs.read_bytes():
                raise RuntimeError("FTPS content verification mismatch: " + lhs.name)
    except Exception:
        if attempted:
            print("ATTENTION: upload or verification error. Restore original app.html.", file=sys.stderr)
            try:
                ftp([f"put {lftp_quote(ROOT / 'original-app.html')} -o /app.html"])
                print("Rollback app.html executed", file=sys.stderr)
            except Exception as err:
                print("CRITICAL: automatic rollback failed: " + str(err), file=sys.stderr)
        raise
    print("SUCCESS: production login-only assets published and verified byte-for-byte")
    print("No database, inventory, order, PHP, configuration or other UI file was changed")

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("prepare", "publish"):
        raise SystemExit("Usage: deploy_login.py prepare|publish")
    {"prepare": prepare, "publish": publish}[sys.argv[1]]()

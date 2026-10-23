#!/usr/bin/env python3
"""Ghadir production sidebar UI-only deploy: byte-guarded, backup, verify, rollback."""
import hashlib, os, re, subprocess, sys
from pathlib import Path

EXPECTED = "f70a142b7a20be43571902cefbe01cb4f81b08bf23962515abadb75063faa0da"
ROOT = Path("/tmp/ghadir-sidebar-release")
SOURCES = {
    "production-sidebar-controls-v1.css": Path("production-sidebar-kit/production-sidebar-controls-v1.css"),
    "production-sidebar-controls-v1.js": Path("production-sidebar-kit/production-sidebar-controls-v1.js"),
}
REQUIRED = [
    "id=\"app\"", "id=\"changePasswordBtn\"", "id=\"logoutbtn\"",
    "desktopCollapse.id='desktopSidebarCollapse'",
    "desktopOpen.id='desktopSidebarOpen'",
    "navToggle.className='nav-toggle'",
    "function syncUserbox()", "class=\"sidebar-close\" type=\"button\""
]

def hashed(data):
    return hashlib.sha256(data).hexdigest()

def quoted(x):
    return '"' + str(x).replace("\\", "\\\\").replace('"', '\\"') + '"'

def ftp(commands):
    server, username, password = (os.environ.get(n, "") for n in
                                  ("FTP_SERVER", "FTP_USERNAME", "FTP_PASSWORD"))
    if not server or not password or username.lower() != "deploy@ghadirpartner.ir":
        raise RuntimeError("STOP: protected production FTPS identity mismatched")
    config = [
        "set cmd:fail-exit true", "set ftp:ssl-force true",
        "set ftp:ssl-protect-data true", "set ssl:verify-certificate true",
        "set net:max-retries 2",
        "open -p 21 " + quoted(server),
        "user " + quoted(username) + " " + quoted(password),
        *commands, "bye"
    ]
    f = ROOT / "ftps-commands-private.txt"
    f.write_text("\n".join(config) + "\n")
    try:
        subprocess.run(["lftp", "-f", str(f)], check=True, timeout=150)
    finally:
        f.unlink(missing_ok=True)

def guard(data):
    if hashed(data) != EXPECTED:
        raise RuntimeError("STOP: live app.html hash drift; refusing UI overwrite")
    text = data.decode("utf-8")
    for marker in REQUIRED:
        if text.count(marker) != 1:
            raise RuntimeError("STOP: required sidebar markup/code absent or duplicated: " + marker)
    for name in ["changePasswordBtn", "logoutbtn"]:
        if len(re.findall(r'\bid=["\']'+name+r'["\']',text)) != 1:
            raise RuntimeError("STOP: duplicate auth action: " + name)
    if "production-sidebar-controls-v1.css" in text or "production-sidebar-controls-v1.js" in text:
        raise RuntimeError("STOP: sidebar release already present")
    if text.count("</head>") != 1 or text.count("</body>") != 1:
        raise RuntimeError("STOP: document boundary incompatible")
    return text

def prepare():
    ROOT.mkdir(exist_ok=True,parents=True)
    for source in SOURCES.values():
        if not source.exists() or source.stat().st_size < 500:
            raise RuntimeError("STOP: missing required UI source " + str(source))
    js = SOURCES["production-sidebar-controls-v1.js"].read_text("utf-8")
    css = SOURCES["production-sidebar-controls-v1.css"].read_text("utf-8")
    if not all(token in js for token in ("desktopClose.click()", "desktopOpen.click()", "mobileButton.click()", "gp-sidebar-userbox")):
        raise RuntimeError("STOP: menu JS missing preserved original control calls")
    if not all(token in css for token in ("gp-sidebar-switch", "gp-sidebar-userbox", "gp-switch-bar")):
        raise RuntimeError("STOP: sidebar CSS missing styled controls")
    ftp(["get /app.html -o " + quoted(ROOT / "original-app.html")])
    original = (ROOT / "original-app.html").read_bytes()
    text = guard(original)
    style = '<link rel="stylesheet" href="/assets/production-sidebar-controls-v1.css?v=1">\n'
    script = '<script src="/assets/production-sidebar-controls-v1.js?v=1" defer></script>\n'
    patched = text.replace("</head>",style+"</head>",1).replace("</body>",script+"</body>",1)
    if patched.replace(style,"",1).replace(script,"",1) != text:
        raise RuntimeError("STOP: non-sidebar application code changed")
    if len(patched.encode("utf-8")) - len(original) != len((style+script).encode("utf-8")):
        raise RuntimeError("STOP: bytes outside sidebar links changed")
    (ROOT / "patched-app.html").write_bytes(patched.encode("utf-8"))
    print("PREPARED: production original SHA256",EXPECTED)
    print("Existing orders, inventory, DB, auth, and all app logic preserved byte-for-byte")

def publish():
    original = (ROOT / "original-app.html").read_bytes()
    guard(original)
    ftp(["get /app.html -o " + quoted(ROOT / "prewrite-app.html")])
    guard((ROOT / "prewrite-app.html").read_bytes())
    attempted = False
    try:
        attempted = True
        actions = [
          "put " + quoted(source.resolve()) + " -o /assets/" + name
          for name,source in SOURCES.items()
        ]
        actions.append("put " + quoted(ROOT / "patched-app.html") + " -o /app.html")
        ftp(actions)
        gets = ["get /app.html -o " + quoted(ROOT / "verify-app.html")]
        gets += [
          "get /assets/" + name + " -o " + quoted(ROOT / ("verified-"+name))
          for name in SOURCES
        ]
        ftp(gets)
        expected = [(ROOT / "patched-app.html", ROOT / "verify-app.html")]
        expected += [(source,ROOT / ("verified-"+name)) for name,source in SOURCES.items()]
        for source,verified in expected:
            if source.read_bytes() != verified.read_bytes():
                raise RuntimeError("STOP: FTPS byte integrity mismatch " + source.name)
    except Exception:
        if attempted:
            print("ERROR: attempting original app.html rollback",file=sys.stderr)
            try:
                ftp(["put "+quoted(ROOT / "original-app.html")+" -o /app.html"])
                print("ROLLBACK: original app.html restored",file=sys.stderr)
            except Exception as exc:
                print("CRITICAL: restore app.html manually; automatic rollback failed: "+str(exc),file=sys.stderr)
        raise
    print("SUCCESS: Only sidebar CSS, JS, and two HTML asset references deployed and verified")
    print("PRODUCTION DATA / API / AUTH ACTIONS: UNCHANGED")

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("prepare","publish"):
        raise SystemExit("Usage: deploy_sidebar.py prepare|publish")
    {"prepare":prepare,"publish":publish}[sys.argv[1]]()

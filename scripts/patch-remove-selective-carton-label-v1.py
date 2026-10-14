#!/usr/bin/env python3
from pathlib import Path
import re,sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
app=root/"app.html"
MARK="REMOVE_SELECTIVE_CARTON_LABEL_UI_V1_20261014"

if not app.exists():
    raise SystemExit("app.html not found")

s=app.read_text(encoding="utf-8")
s=re.sub(r'\s*<script[^>]+warehouse-carton-multilabel-v53438\.js[^>]*></script>\s*','\n',s,flags=re.I)

if MARK not in s:
    marker=f"<!-- {MARK} -->\n"
    pos=s.lower().rfind("</body>")
    if pos<0:
        raise SystemExit("</body> not found")
    s=s[:pos]+marker+s[pos:]

app.write_text(s,encoding="utf-8")
print("selective carton label UI removed")

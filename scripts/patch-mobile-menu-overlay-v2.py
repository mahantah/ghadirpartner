#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
app=root/"app.html"
MARK="MOBILE_MENU_OVERLAY_FIX_V2_20261014"

if not app.exists():
    raise SystemExit("app.html not found")

s=app.read_text(encoding="utf-8")
if MARK in s:
    print("mobile menu overlay v2 already applied")
    raise SystemExit(0)

payload=r'''
<style id="gp-mobile-menu-overlay-v2">
/* MOBILE_MENU_OVERLAY_FIX_V2_20261014 */
@media (max-width:760px){
  /* The header is a z-index:20 stacking context. Keep overlay below it,
     otherwise the overlay visually sits on top of the sidebar. */
  .nav-overlay{
    z-index:19!important;
    background:rgba(5,20,36,.34)!important;
    backdrop-filter:none!important;
    -webkit-backdrop-filter:none!important;
    filter:none!important;
  }
  .topnav,.topnav:not(.mobile-open),.topnav.sidebar-open{
    z-index:135!important;
    background:linear-gradient(180deg,#0b2948 0%,#0d3155 100%)!important;
    filter:none!important;
    backdrop-filter:none!important;
    -webkit-backdrop-filter:none!important;
    opacity:1!important;
  }
  .topnav button{
    color:#fff!important;
    background:#ffffff14!important;
    border-color:#ffffff28!important;
    text-shadow:none!important;
    filter:none!important;
    opacity:1!important;
  }
  .topnav button:hover,.topnav button:active{
    background:#ffffff22!important;
  }
  .sidebar-head,.sidebar-head b,.topnav .userbox,.mobile-nav-userbox{
    color:#fff!important;
    filter:none!important;
    opacity:1!important;
  }
}
</style>
'''
pos=s.lower().rfind('</body>')
if pos<0:
    raise SystemExit("</body> not found")
s=s[:pos]+payload+s[pos:]
app.write_text(s,encoding="utf-8")
print("mobile menu overlay v2 patch applied")

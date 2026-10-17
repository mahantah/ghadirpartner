#!/usr/bin/env python3
"""Construct a Chrome fixture from the ACTUAL publicly served production CSS.

Uses only public app.html styles; no credentials, customer data or API calls.
Regression proves the obsolete 282px header shell is absent while the
existing hamburger/X and fixed .topnav remain available.
"""
from pathlib import Path
from html import escape
import re,sys

if len(sys.argv)!=4:
    raise SystemExit("usage: test_live_shell.py LIVE_APP_HTML REPO_ROOT OUTPUT_HTML")
live=Path(sys.argv[1]).read_text(encoding="utf-8")
repo=Path(sys.argv[2]).resolve()
dest=Path(sys.argv[3])
styles=re.findall(r"<style\b[^>]*>(.*?)</style>",live,flags=re.S|re.I)
if not styles:
    raise SystemExit("Live site has no inline style rules")
css="\n".join(styles)
old_header=re.search(
    r"#app\s*>\s*header\s*\{[^}]*position\s*:\s*fixed\s*!important[^}]*width\s*:\s*282px",
    css,re.S|re.I
)
old_wrap=re.search(r"#app\s*>\s*\.wrap\s*\{[^}]*margin\s*:\s*0\s+282px",css,re.S|re.I)
if not old_header or not old_wrap:
    raise SystemExit("Live legacy 282px desktop shell CSS changed; review before patch")
links=[]
for filename in (
  'assets/nav-morph-v1.css',
  'assets/sidebar-profile-polish-v1.css',
  'assets/sidebar-edge-profile-v2.css',
  'assets/sidebar-collapse-v3.css',
  'assets/sidebar-real-edge-v4.css',
  'assets/warehouse-serial-filters-v2.css',
  'assets/remove-legacy-desktop-sidebar-shell-v1.css',
):
    p=repo/filename
    if not p.is_file():raise SystemExit("CSS fixture asset missing: "+filename)
    links.append('<link rel="stylesheet" href="'+p.as_uri()+'">')
head='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
head+=''.join('<style>'+s+'</style>' for s in styles)
head+=''.join(links)
fixture='''<!doctype html><html lang="fa" dir="rtl"><head>'''+head+'''</head>
<body><div id="app"><header>
<div class="brand"><img src="" class="logoimg" alt=""><b>قدیر پارتنر</b><small>فروش و انبار</small></div>
<button type="button" class="nav-toggle gp-nav-morph" aria-expanded="false">
<span class="gp-nav-lines"><span class="gp-nav-line"></span><span class="gp-nav-line"></span><span class="gp-nav-line"></span></span>
</button>
<div class="topnav gp-nav-fully-closed"><div class="sidebar-head"><b>قدیر پارتنر</b></div>
<button data-tab="dashboard">پیشخوان</button><button data-tab="orders">سفارش‌ها</button>
<div class="userbox gp-profile-host"><button class="gp-profile-trigger">پروفایل</button></div>
</div></header>
<div class="wrap"><div class="card" id="test-content">محتوای واقعی صفحه باید بدون نوار کناری دیده شود.</div></div>
<div class="nav-overlay"></div></div>
<pre id="layout-test-result">PENDING</pre>
<script>
window.addEventListener('load',function(){
 const app=document.querySelector('#app'),header=app.querySelector('header'),
       brand=header.querySelector('.brand'),content=app.querySelector('.wrap'),
       nav=header.querySelector('.topnav'),button=header.querySelector('.nav-toggle');
 const output=document.getElementById('layout-test-result');
 function assert(ok,message){if(!ok)throw Error(message)}
 function geometry(){
   const r=header.getBoundingClientRect(),w=content.getBoundingClientRect();
   const hs=getComputedStyle(header),bs=getComputedStyle(brand);
   assert(hs.position==='static','obsolete fixed sidebar header still visible: '+hs.position);
   assert(r.width<=2 && r.height<=2,'legacy header still has navy block '+r.width+'x'+r.height);
   assert(bs.display==='none','old desktop brand outside drawer still visible');
   assert(Math.abs(w.right-innerWidth)<28,'content still reserves old 282px gutter: right='+w.right+' viewport='+innerWidth);
   assert(w.width>innerWidth-35,'content not restored to full viewport: '+w.width+' viewport='+innerWidth);
   assert(parseFloat(getComputedStyle(content).marginRight)<2,'legacy content right margin still applied');
   assert(getComputedStyle(button).display!=='none','hamburger button got hidden');
   assert(getComputedStyle(button).position==='fixed','hamburger must remain viewport-fixed');
 }
 try{
   geometry();
   nav.classList.remove('gp-nav-fully-closed');nav.classList.add('sidebar-open');
   button.setAttribute('aria-expanded','true');
   setTimeout(function(){
     try{
       const nr=nav.getBoundingClientRect();
       assert(getComputedStyle(nav).position==='fixed','drawer no longer fixed');
       assert(nr.width>150 && nr.left<innerWidth-150 && nr.right<=innerWidth+3,
              'drawer not shown: '+nr.left+' '+nr.right+' viewport='+innerWidth);
       nav.classList.remove('sidebar-open');nav.classList.add('gp-nav-fully-closed');
       button.setAttribute('aria-expanded','false');
       setTimeout(function(){
         try{
           geometry();
           assert(getComputedStyle(nav).display==='none','closed drawer still visible');
           output.textContent='LEGACY_SHELL_FIXED_PASS';
         }catch(e){output.textContent='LEGACY_SHELL_FIXED_FAIL '+e.message}
       },80);
     }catch(e){output.textContent='LEGACY_SHELL_FIXED_FAIL '+e.message}
   },90);
 }catch(e){output.textContent='LEGACY_SHELL_FIXED_FAIL '+e.message}
});
</script></body></html>
'''
dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_text(fixture,encoding='utf-8')
print("Real production CSS rules loaded:",len(styles),"Fixture bytes:",len(fixture))

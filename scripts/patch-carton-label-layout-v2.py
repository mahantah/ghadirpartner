#!/usr/bin/env python3
from pathlib import Path
import re, sys

root=Path(sys.argv[1] if len(sys.argv)>1 else '.')
labels=root/'lib'/'labels-v5348.php'
MARK='WAREHOUSE_CARTON_QR_CONTACT_V3_20261012'
if not labels.exists(): raise SystemExit('lib/labels-v5348.php not found')
s=labels.read_text(encoding='utf-8')
if MARK in s:
    print('carton contact QR v3 already applied')
    raise SystemExit(0)

fn=s.find('function gp_carton_ticket_html($c)')
if fn<0: raise SystemExit('gp_carton_ticket_html not found')
fn_end=s.find('\n}\n',fn)
if fn_end<0: raise SystemExit('gp_carton_ticket_html end not found')
block=s[fn:fn_end+3]
start=block.find(" return '<article class=\"ticket\">")
if start<0: raise SystemExit('carton ticket return not found')
stop=block.find("</article>';",start)
if stop<0: raise SystemExit('carton ticket return end not found')
stop += len("</article>';")
new_return = ''' return '<article class="ticket"><div class="qr-mini"><img class="qr-static" src="/assets/ghadir-contact-qr.png" alt="QR قدیر پرداخت"></div><img class="brand-corner" src="/brand-v5311.png" alt="قدیر پرداخت"><div class="t-center"><div class="brand-name">قدیر پرداخت</div><div class="subp">09128151868</div><div class="carton-title">شماره کارتن</div><div class="code">'.gp_h($code).'</div></div><div class="ticket-bottom"><div class="product">'.gp_h($product).'</div><div class="meta"><span>تعداد: <b>'.$count.'</b>'.($cap?' / '.$cap:'').'</span>'.($color!==''?'<span>رنگ: <b>'.gp_h($color).'</b></span>':'').'</div>'.gp_code128_svg($payload).'<div class="scantext">QR = اطلاعات تماس قدیر پرداخت | بارکد = شماره کارتن</div></div></article>';'''
block=block[:start]+new_return+block[stop:]
block='/* '+MARK+' */\n'+block
s=s[:fn]+block+s[fn_end+3:]

pf=s.find('function gp_print_carton_labels_three_up($cartons,$profile)')
if pf<0: raise SystemExit('gp_print_carton_labels_three_up not found')
pf_end=s.find('\n}\n',pf)
if pf_end<0: raise SystemExit('gp_print_carton_labels_three_up end not found')
seg=s[pf:pf_end+3]
seg,n=re.subn(r'\.qr-mini\{[^}]*\}\.qr-mini [^{}]+\{[^}]*\}', '.qr-mini{position:absolute;top:1.8mm;left:2.2mm;width:32mm;height:32mm;display:flex;align-items:center;justify-content:center;background:#fff}.qr-mini .qr-static{width:32mm;height:32mm;display:block;object-fit:contain;image-rendering:pixelated}', seg, count=1)
if n!=1: raise SystemExit('carton QR CSS block not found')
seg,n=re.subn(r'\.t-center\{[^}]*\}', '.t-center{height:32mm;margin:0 13mm 0 34mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}', seg, count=1)
if n!=1: raise SystemExit('t-center CSS block not found')
s=s[:pf]+seg+s[pf_end+3:]
labels.write_text(s,encoding='utf-8')
print('carton contact QR v3 applied')

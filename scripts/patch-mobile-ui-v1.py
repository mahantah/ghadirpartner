#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
app=root/"app.html"
MARK="MOBILE_UI_OPTIMIZATION_V1_20261014"

if not app.exists():
    raise SystemExit("app.html not found")

s=app.read_text(encoding="utf-8")
if MARK in s:
    print("mobile ui v1 already applied")
    raise SystemExit(0)

s=s.replace(
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
)

payload=r'''
<style id="gp-mobile-ui-v1">
/* MOBILE_UI_OPTIMIZATION_V1_20261014 */
@media (max-width:760px){
  html,body{max-width:100%;overflow-x:hidden}
  body{background:#f3f6fa;-webkit-text-size-adjust:100%;padding-bottom:env(safe-area-inset-bottom)}
  header{
    min-height:64px!important;
    padding:8px 10px calc(8px + env(safe-area-inset-top))!important;
    grid-template-columns:1fr!important;
    gap:0!important;
    position:sticky!important;
    top:0!important;
  }
  .brand{
    min-width:0!important;
    padding-right:52px!important;
    gap:9px!important;
    overflow:hidden;
  }
  .brand .logoimg{
    width:44px!important;height:44px!important;border-radius:12px!important;padding:3px!important;
    flex:0 0 44px;
  }
  .brand b{
    display:block;
    max-width:220px;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    font-size:14px!important;
  }
  .brand small{display:none!important}
  .nav-toggle{
    right:10px!important;
    top:calc(10px + env(safe-area-inset-top))!important;
    width:44px!important;height:44px!important;
    border-radius:13px!important;
    font-size:25px!important;
  }
  .topnav,.topnav:not(.mobile-open){
    width:min(330px,88vw)!important;
    max-width:88vw!important;
    height:100dvh!important;
    padding:calc(12px + env(safe-area-inset-top)) 12px calc(14px + env(safe-area-inset-bottom))!important;
    gap:6px!important;
    z-index:135!important;
  }
  .topnav button{
    min-height:44px!important;
    padding:10px 12px!important;
    font-size:13px!important;
    border-radius:10px!important;
  }
  .sidebar-head{padding-bottom:9px!important;margin-bottom:2px!important}
  .sidebar-head b{font-size:15px!important}
  .nav-overlay{
    z-index:134!important;
    background:rgba(5,20,36,.48)!important;
    backdrop-filter:blur(2px);
  }
  .topnav .userbox,.mobile-nav-userbox{
    position:static!important;
    transform:none!important;
    width:100%!important;
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:7px!important;
    margin-top:auto!important;
    padding-top:10px!important;
    border-top:1px solid #ffffff25!important;
    white-space:normal!important;
  }
  .topnav .userpill,.mobile-nav-userbox .userpill{
    grid-column:1/-1;
    text-align:center;
    white-space:normal!important;
    padding:8px 9px!important;
    font-size:12px!important;
  }
  .topnav .userbox button,.mobile-nav-userbox button{width:100%!important;margin:0!important}

  .wrap{
    width:100%!important;
    max-width:100%!important;
    margin:9px auto!important;
    padding:0 8px calc(14px + env(safe-area-inset-bottom))!important;
  }
  .card{
    padding:11px!important;
    margin-bottom:9px!important;
    border-radius:13px!important;
    box-shadow:0 4px 16px rgba(16,42,67,.06)!important;
  }
  .section-title{
    align-items:flex-start!important;
    gap:7px!important;
    margin-bottom:8px!important;
  }
  .section-title h2,.section-title h3{font-size:15px!important;line-height:1.7!important}
  h2{font-size:18px} h3{font-size:16px} h4{font-size:14px}

  input,select,textarea{
    width:100%;
    max-width:100%;
    min-height:44px;
    font-size:16px!important;
    padding:10px!important;
    border-radius:10px!important;
  }
  textarea{min-height:78px!important}
  button{
    min-height:44px;
    padding:10px 12px!important;
    font-size:13px!important;
    border-radius:10px!important;
    touch-action:manipulation;
  }
  input[type=checkbox],input[type=radio]{
    min-height:0!important;width:20px!important;height:20px!important;padding:0!important;
  }

  .grid{grid-template-columns:1fr!important;gap:8px!important}
  .toolbar{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:7px!important;
    width:100%;
  }
  .toolbar>input,.toolbar>select,.toolbar>textarea,.toolbar>.jdate-wrap,.toolbar>label{
    grid-column:1/-1;
    min-width:0!important;
    width:100%!important;
  }
  .toolbar>button{width:100%!important;min-width:0!important}
  .quick-actions{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:7px!important;
  }
  .quick-actions button{width:100%!important;padding:10px!important}

  #dashboard .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
  #dashboard .metric{
    min-height:92px!important;
    padding:10px!important;
  }
  #dashboard .metric-icon{width:34px!important;height:34px!important;font-size:18px!important;margin-bottom:5px!important}
  #dashboard .metric-value{font-size:23px!important}
  #dashboard .metric-label{font-size:11px!important}
  .status-row{grid-template-columns:90px 1fr 38px!important;gap:6px!important;font-size:11px!important}
  .sales-chart-card{padding:11px!important}
  .sales-chart{height:220px!important;margin:0 -3px}
  .sales-col{min-width:68px!important}

  .tablewrap,.warehouse-ledger-wrap,.admin-price-wrap{
    width:100%!important;
    overflow-x:auto!important;
    -webkit-overflow-scrolling:touch;
    overscroll-behavior-x:contain;
    border-radius:10px!important;
  }
  table{font-size:11px!important}
  th,td{padding:8px 7px!important}
  .orders-compact{min-width:900px!important;font-size:11px!important}
  .orders-compact th,.orders-compact td{padding:7px!important}
  .items-compact{max-width:300px!important}
  .item-pill{max-width:210px!important}
  .compact-filter{padding:9px!important}
  .compact-filter .toolbar{grid-template-columns:1fr!important}
  .compact-filter #osearch{min-width:0!important;width:100%!important}
  .orders-pager{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:8px!important;
    padding:10px!important;
  }
  .pager-buttons{overflow-x:auto;padding-bottom:2px}

  .inv-group{border-radius:12px!important;margin-bottom:8px!important}
  .inv-group summary{padding:11px!important;gap:8px!important}
  .inv-customer b{font-size:14px!important}
  .inv-meta{font-size:11px!important;line-height:1.7!important}
  .inv-count{font-size:11px!important;padding:5px 8px!important}
  .inv-detail{padding:5px 10px!important}
  .inv-serial-row{
    display:flex!important;
    flex-wrap:wrap!important;
    align-items:center!important;
    gap:7px 8px!important;
    padding:11px 2px!important;
  }
  .inv-product{
    flex:1 1 100%!important;
    width:100%!important;
    font-size:14px!important;
    line-height:1.55!important;
  }
  .gp-inv-supplier,.gp-inv-supplier-v5{display:inline-block!important;margin-top:4px!important}
  .gp-inv-supplier .badge,.gp-inv-supplier-v5 .badge{
    font-size:10.5px!important;
    padding:4px 7px!important;
    white-space:normal!important;
  }
  .inv-code{
    flex:1 1 180px!important;
    min-width:0!important;
    text-align:left!important;
    font-size:14px!important;
    direction:ltr!important;
  }
  .inv-actions{
    flex:1 1 100%!important;
    width:100%!important;
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:7px!important;
  }
  .inv-actions button{width:100%!important;margin:0!important}
  #inventoryWriteTools{grid-template-columns:1fr!important}
  #inventoryWriteTools>*{grid-column:1!important;width:100%!important}
  #inventory .card>p.small{line-height:1.75;margin:6px 0 9px}

  #warehouse .grid{grid-template-columns:1fr!important}
  #warehouse .toolbar{grid-template-columns:1fr!important}
  #warehouse .toolbar>*{grid-column:1!important}
  #warehouseBody~*{}
  .gp-wh-carton-print-tools{display:grid!important;grid-template-columns:1fr 1fr!important}
  .gp-wh-carton-print-tools .badge{grid-column:1/-1;text-align:center}
  .gp-wh-carton-select-cell{width:40px!important;min-width:40px!important}
  #warehouse table{min-width:980px!important}

  .warehouse-ledger-toolbar{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:7px!important;
  }
  .warehouse-ledger-toolbar>*{width:100%!important;min-width:0!important}
  .warehouse-ledger-toolbar #warehouseLedgerMonth{grid-column:1/-1}
  .warehouse-ledger-summary{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:7px!important;
  }
  .warehouse-ledger-summary .card{padding:9px!important}
  .warehouse-ledger{min-width:1120px!important;font-size:10px!important}
  .warehouse-ledger th,.warehouse-ledger td{padding:5px 4px!important;min-width:46px!important}
  .warehouse-ledger .model-col{min-width:145px!important}
  .warehouse-movement-table{min-width:760px!important}
  .return-serial-grid{grid-template-columns:1fr!important;max-height:48dvh!important}

  .itemrow{grid-template-columns:1fr!important;gap:7px!important}
  .itemrow>*{width:100%!important}
  .panel-checks{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important}
  .panel-checks label{min-height:44px!important}
  .report-grid{grid-template-columns:1fr!important}

  .modal{
    align-items:flex-end!important;
    padding:0!important;
  }
  .modalbox{
    width:100%!important;
    max-width:100%!important;
    max-height:92dvh!important;
    padding:15px 12px calc(15px + env(safe-area-inset-bottom))!important;
    border-radius:20px 20px 0 0!important;
    box-shadow:0 -18px 50px #0003!important;
  }
  .modalbox .toolbar{margin-top:10px}
  .toastwrap{
    left:8px!important;right:8px!important;bottom:calc(8px + env(safe-area-inset-bottom))!important;
    max-width:none!important;
  }
  .toast{font-size:12px!important;padding:10px 11px!important}

  .jdate-pop{
    position:fixed!important;
    right:10px!important;left:10px!important;
    top:auto!important;bottom:calc(10px + env(safe-area-inset-bottom))!important;
    width:auto!important;
    max-width:none!important;
    z-index:170!important;
  }

  .admin-price-help{padding:10px!important}
  .admin-price-table{min-width:980px!important}
  .order-detail-drawer{
    max-height:90dvh!important;
    padding:14px 11px calc(16px + env(safe-area-inset-bottom))!important;
  }
  .detail-layout{grid-template-columns:1fr!important}
  .detail-items-card,.detail-timeline-card{grid-column:auto!important}
  .detail-timeline{padding:4px!important}
  .timeline-step{min-width:118px!important}

  .login{
    width:calc(100% - 20px)!important;
    max-width:410px!important;
    margin:10vh auto!important;
    padding:16px!important;
  }
}

@media (max-width:390px){
  #dashboard .grid{grid-template-columns:1fr 1fr!important}
  .quick-actions{grid-template-columns:1fr!important}
  .panel-checks{grid-template-columns:1fr!important}
  .warehouse-ledger-summary{grid-template-columns:1fr 1fr!important}
  .brand b{max-width:190px}
}
</style>
<script>
(function(){
  const MARK='MOBILE_UI_OPTIMIZATION_V1_20261014';
  if(window.__gpMobileUiV1)return;
  window.__gpMobileUiV1=true;

  function syncUserbox(){
    const header=document.querySelector('#app > header');
    const nav=header&&header.querySelector('.topnav');
    const user=header&&header.querySelector('.userbox') || (nav&&nav.querySelector('.userbox'));
    if(!header||!nav||!user)return;
    const mobile=window.matchMedia('(max-width:760px)').matches;
    if(mobile){
      if(user.parentElement!==nav)nav.appendChild(user);
      user.classList.add('mobile-nav-userbox');
    }else{
      if(user.parentElement!==header)header.appendChild(user);
      user.classList.remove('mobile-nav-userbox');
    }
  }

  function compactInventory(){
    const root=document.getElementById('inventoryGroups');
    if(!root)return;
    root.querySelectorAll('.inv-serial-row').forEach(row=>{
      const children=[...row.children];
      children.forEach((el,i)=>{
        if(el.classList.contains('inv-product')||el.classList.contains('inv-code')||el.classList.contains('inv-actions'))return;
        if(i===2)el.classList.add('gp-mobile-inv-status');
        if(i===3)el.classList.add('gp-mobile-inv-user');
      });
    });
  }

  let t=0;
  function schedule(){
    clearTimeout(t);
    t=setTimeout(()=>{syncUserbox();compactInventory()},50);
  }
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  setTimeout(schedule,50);
  setTimeout(schedule,600);
})();
</script>
'''

pos=s.lower().rfind('</body>')
if pos<0:
    raise SystemExit("</body> not found")
s=s[:pos]+payload+s[pos:]
app.write_text(s,encoding="utf-8")
print("mobile ui v1 patch applied")

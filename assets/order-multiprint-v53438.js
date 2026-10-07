/* GhadirPartner V5.3.4.38 — multi-select order bijak + shipping labels */
(function(){
'use strict';
if(window.__GP_ORDER_MULTIPRINT_53438__) return;
window.__GP_ORDER_MULTIPRINT_53438__=true;

const selected=new Set();
const $=id=>document.getElementById(id);

function visibleOrderIds(){
  return [...document.querySelectorAll('#otbody tr')].map(tr=>{
    const b=tr.querySelector('.dots-btn');
    const code=b?.getAttribute('onclick')||'';
    const m=code.match(/toggleOrderMenu\(event\s*,\s*(\d+)\)/);
    return m?Number(m[1]):0;
  }).filter(Boolean);
}
function syncUi(){
  const count=selected.size;
  const countEl=$('gpOrderPrintCount');
  if(countEl) countEl.textContent=count.toLocaleString('fa-IR')+' سفارش انتخاب شده';
  ['gpPrintBijaks','gpPrintLabels'].forEach(id=>{const b=$(id);if(b)b.disabled=!count});
  const ids=visibleOrderIds();
  const master=$('gpOrderSelectAll');
  if(master){
    const checked=ids.filter(id=>selected.has(id)).length;
    master.checked=!!ids.length&&checked===ids.length;
    master.indeterminate=checked>0&&checked<ids.length;
  }
}
function toggleOne(id,on){
  if(on)selected.add(Number(id)); else selected.delete(Number(id));
  syncUi();
}
function togglePage(on){
  visibleOrderIds().forEach(id=>on?selected.add(id):selected.delete(id));
  document.querySelectorAll('.gp-order-print-check').forEach(x=>x.checked=on);
  syncUi();
}
function decorateRows(){
  const body=$('otbody');if(!body)return;
  [...body.rows].forEach(tr=>{
    if(tr.querySelector('.gp-order-print-check'))return;
    const b=tr.querySelector('.dots-btn');
    if(!b){
      const empty=tr.querySelector('td[colspan]');
      if(empty)empty.colSpan=8;
      return;
    }
    const code=b.getAttribute('onclick')||'';
    const m=code.match(/toggleOrderMenu\(event\s*,\s*(\d+)\)/);
    if(!m)return;
    const id=Number(m[1]);
    const td=document.createElement('td');
    td.className='gp-order-print-cell';
    td.innerHTML='<input class="gp-order-print-check" type="checkbox" aria-label="انتخاب سفارش برای چاپ">';
    const input=td.firstElementChild;
    input.dataset.orderId=String(id);
    input.checked=selected.has(id);
    input.addEventListener('click',e=>e.stopPropagation());
    input.addEventListener('change',()=>toggleOne(id,input.checked));
    tr.insertBefore(td,tr.firstElementChild);
  });
  syncUi();
}
function ensureUi(){
  const orders=$('orders');if(!orders)return;
  const table=orders.querySelector('.orders-compact');
  const head=table?.querySelector('thead tr');
  if(head&&!$('gpOrderSelectAll')){
    const th=document.createElement('th');
    th.className='gp-order-print-cell';
    th.innerHTML='<input id="gpOrderSelectAll" type="checkbox" title="انتخاب همه سفارش‌های این صفحه">';
    head.insertBefore(th,head.firstElementChild);
    $('gpOrderSelectAll').addEventListener('change',e=>togglePage(e.target.checked));
  }
  const tools=orders.querySelector('.compact-filter .toolbar');
  if(tools&&!$('gpOrderPrintTools')){
    const box=document.createElement('div');
    box.id='gpOrderPrintTools';
    box.className='gp-order-print-tools';
    box.innerHTML='<span id="gpOrderPrintCount" class="badge">۰ سفارش انتخاب شده</span>'+
      '<button id="gpPrintBijaks" class="btn2" type="button" disabled>چاپ بیجک‌های انتخابی</button>'+
      '<button id="gpPrintLabels" class="btnlight" type="button" disabled>چاپ لیبل‌های انتخابی</button>'+
      '<button id="gpClearOrderPrint" class="btnlight" type="button">پاک کردن انتخاب</button>';
    tools.appendChild(box);
    $('gpPrintBijaks').onclick=()=>batchPrint('bijak');
    $('gpPrintLabels').onclick=()=>batchPrint('label');
    $('gpClearOrderPrint').onclick=()=>{selected.clear();document.querySelectorAll('.gp-order-print-check').forEach(x=>x.checked=false);syncUi()};
  }
  decorateRows();
}
function pageNodes(doc,kind){
  let nodes=[];
  if(kind==='bijak') nodes=[...doc.querySelectorAll('.dispatchSheet')];
  if(!nodes.length) nodes=[...doc.querySelectorAll('.sheet')];
  if(!nodes.length){
    const body=doc.body.cloneNode(true);
    body.querySelectorAll('.toolbar,script').forEach(x=>x.remove());
    nodes=[...body.children];
  }
  return nodes;
}
async function batchPrint(kind){
  const ids=[...selected];
  if(!ids.length){alert('حداقل یک سفارش را تیک بزنید');return}
  const pop=window.open('','_blank');
  if(!pop){alert('مرورگر پنجره چاپ را مسدود کرده است؛ Pop-up را برای سایت فعال کنید.');return}
  pop.document.write('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>در حال آماده‌سازی چاپ…</title><body style="font-family:Tahoma;padding:30px">در حال آماده‌سازی '+ids.length.toLocaleString('fa-IR')+' سفارش…</body></html>');
  try{
    let styles='',pages=[];
    const endpoint=kind==='label'?'/print/order-label?id=':'/pdf/order-details?id=';
    for(const id of ids){
      const r=await fetch(endpoint+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'});
      if(!r.ok)throw new Error('خطا در آماده‌سازی سفارش '+id);
      const html=await r.text(),doc=new DOMParser().parseFromString(html,'text/html');
      if(!styles)styles=[...doc.querySelectorAll('style')].map(x=>x.textContent).join('\n');
      for(const node of pageNodes(doc,kind)){
        const clone=node.cloneNode(true);
        clone.classList.add('gp-batch-page');
        clone.querySelectorAll('.toolbar,script').forEach(x=>x.remove());
        pages.push(clone.outerHTML);
      }
    }
    const title=kind==='label'?'چاپ گروهی لیبل‌های ارسال':'چاپ گروهی بیجک‌ها';
    pop.document.open();
    pop.document.write('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>'+title+'</title><style>'+styles+'</style>'+
      '<style>html,body{width:auto!important;height:auto!important;overflow:visible!important;background:#fff!important}.toolbar{display:none!important}.gp-batch-toolbar{position:fixed;left:10px;top:10px;z-index:99999;background:#fff;border:1px solid #d7dee7;border-radius:10px;padding:8px;box-shadow:0 8px 28px #0002}.gp-batch-toolbar button{background:#102a43;color:#fff;border:0;border-radius:8px;padding:9px 15px;font-family:Tahoma;cursor:pointer}.gp-batch-page.sheet{position:relative!important;top:auto!important;right:auto!important;left:auto!important;margin:0!important}.gp-batch-page{break-after:page!important;page-break-after:always!important}.gp-batch-page:last-of-type{break-after:auto!important;page-break-after:auto!important}@media print{.gp-batch-toolbar{display:none!important}}</style></head><body>'+
      '<div class="gp-batch-toolbar"><button onclick="window.print()">چاپ همه ('+ids.length.toLocaleString('fa-IR')+')</button></div>'+pages.join('')+
      '<script src="/assets/qrcode-v5349.js"></'+'script><script>window.addEventListener("load",function(){document.querySelectorAll(".qrRender").forEach(function(e){if(window.GPQRCodeSvg)e.innerHTML=GPQRCodeSvg(e.dataset.value||"")})});</'+'script></body></html>');
    pop.document.close();
  }catch(e){
    pop.document.open();pop.document.write('<meta charset="utf-8"><div dir="rtl" style="font-family:Tahoma;padding:30px;color:#b42318">'+String(e.message||e)+'</div>');pop.document.close();
  }
}

const oldRender=window.renderOrders;
if(typeof oldRender==='function'){
  window.renderOrders=function(){const r=oldRender.apply(this,arguments);ensureUi();return r};
}
window.gpBatchPrintOrders=batchPrint;
window.gpOrderPrintSelected=selected;

const css=document.createElement('style');
css.textContent='.gp-order-print-cell{width:44px!important;min-width:44px!important;text-align:center!important}.gp-order-print-cell input{width:18px!important;height:18px!important;min-width:18px!important;margin:0;accent-color:#f58220}.gp-order-print-tools{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.gp-order-print-tools .badge{white-space:nowrap}@media(max-width:900px){.gp-order-print-tools{width:100%}}';
document.head.appendChild(css);

ensureUi();
setTimeout(ensureUi,300);
})();

/* GhadirPartner V5.3.4.38 — warehouse UI refinements 2026-10-10 */
(function(){
'use strict';
if(window.__GP_WAREHOUSE_UI_REFINE_53438__) return;
window.__GP_WAREHOUSE_UI_REFINE_53438__=true;

function walkTextReplace(root, fromRe, to){
  if(!root) return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach(n=>{ if(fromRe.test(n.nodeValue||'')) n.nodeValue=(n.nodeValue||'').replace(fromRe,to); });
}

function renameWarehouseProducts(){
  document.querySelectorAll('button,a,[role="button"]').forEach(el=>{
    const t=(el.textContent||'').trim();
    if(/قیمت\s*و\s*موجودی/.test(t) && !/پرتال/.test(t) && t.length<45){
      walkTextReplace(el,/قیمت\s*و\s*موجودی/g,'محصولات');
    }
  });
}

function mergeCustomerSerialCards(){
  const sec=document.getElementById('inventory');
  if(!sec) return;
  const cards=[...sec.children].filter(x=>x.classList&&x.classList.contains('card'));
  const relevant=cards.filter(card=>{
    const h=(card.querySelector('h3')?.textContent||'').trim();
    return /سریال/.test(h) || !!card.querySelector('#inventoryWriteTools') ||
      [...card.querySelectorAll('button')].some(b=>/Excel|PDF|فاکتور/.test(b.textContent||'')) &&
      /مشتری|سریال|فاکتور/.test(card.textContent||'');
  });
  if(!relevant.length) return;

  const base=relevant[0];
  const h=base.querySelector('h3');
  if(h) h.textContent='سریال‌های مشتریان';

  for(const extra of relevant.slice(1)){
    if(extra===base) continue;
    const divider=document.createElement('div');
    divider.className='gp-serial-merge-divider';
    base.appendChild(divider);
    [...extra.childNodes].forEach(node=>{
      if(node.nodeType===1){
        const el=node;
        const head=el.matches?.('.section-title') ? el.querySelector('h3') : (el.matches?.('h3')?el:null);
        if(head && /سریال/.test(head.textContent||'')) return;
      }
      base.appendChild(node);
    });
    extra.remove();
  }
}

function positionJDate(target){
  const input=document.getElementById(target);
  const pop=document.getElementById(target+'_picker');
  if(!input||!pop||pop.classList.contains('hidden')) return;
  const rect=input.getBoundingClientRect();
  const width=Math.min(290,Math.max(260,Math.min(rect.width||270,290)),window.innerWidth-16);
  pop.style.position='fixed';
  pop.style.zIndex='1000000';
  pop.style.right='auto';
  pop.style.width=width+'px';
  pop.style.maxHeight='min(420px, calc(100vh - 16px))';
  pop.style.overflow='auto';
  let left=Math.max(8,Math.min(window.innerWidth-width-8,rect.right-width));
  let top=rect.bottom+6;
  pop.style.left=left+'px';
  pop.style.top=top+'px';
  requestAnimationFrame(()=>{
    const h=pop.getBoundingClientRect().height||260;
    if(top+h>window.innerHeight-8) top=Math.max(8,rect.top-h-6);
    pop.style.top=top+'px';
  });
}

function installJDateFix(){
  if(typeof toggleJPicker==='function' && !toggleJPicker.__gpFixed){
    const base=toggleJPicker;
    const wrapped=function(target){
      const r=base.apply(this,arguments);
      setTimeout(()=>positionJDate(target),0);
      setTimeout(()=>positionJDate(target),40);
      return r;
    };
    wrapped.__gpFixed=true;
    toggleJPicker=wrapped;
  }
  document.querySelectorAll('.jdate').forEach(input=>{
    if(input.dataset.gpJdateFixed) return;
    input.dataset.gpJdateFixed='1';
    input.addEventListener('click',()=>setTimeout(()=>positionJDate(input.id),10));
  });
}

function addQty(map,product,qty){
  product=String(product||'بدون عنوان');
  map.set(product,(map.get(product)||0)+(Number(qty)||0));
}
function bucketHtml(map){
  const entries=[...map.entries()].filter(([,q])=>q);
  if(!entries.length) return '<span class="small">—</span>';
  const total=entries.reduce((n,[,q])=>n+Math.abs(q),0);
  return '<b>'+total.toLocaleString('fa-IR')+' دستگاه</b><div class="gp-move-products">'+
    entries.map(([p,q])=>'<span>'+esc(p)+': '+Math.abs(q).toLocaleString('fa-IR')+'</span>').join('')+
    '</div>';
}
function transferHtml(ins,outs){
  const inN=[...ins.values()].reduce((n,q)=>n+Math.abs(q),0);
  const outN=[...outs.values()].reduce((n,q)=>n+Math.abs(q),0);
  if(!inN&&!outN) return '<span class="small">—</span>';
  let s='';
  if(inN) s+='<div><b>ورود '+inN.toLocaleString('fa-IR')+'</b><div class="gp-move-products">'+[...ins].map(([p,q])=>'<span>'+esc(p)+': '+Math.abs(q).toLocaleString('fa-IR')+'</span>').join('')+'</div></div>';
  if(outN) s+='<div'+(inN?' style="margin-top:5px"':'')+'><b>خروج '+outN.toLocaleString('fa-IR')+'</b><div class="gp-move-products">'+[...outs].map(([p,q])=>'<span>'+esc(p)+': '+Math.abs(q).toLocaleString('fa-IR')+'</span>').join('')+'</div></div>';
  return s;
}

function renderDailyMovementSummary(){
  if(typeof WAREHOUSE_STATE==='undefined'||!WAREHOUSE_STATE) return;
  const body=document.getElementById('warehouseMovementBody');
  if(!body) return;
  const table=body.closest('table');
  if(!table) return;
  const ym=(document.getElementById('warehouseLedgerMonth')?.value||'').trim();
  const wid=Number(typeof WAREHOUSE_SELECTED!=='undefined'?WAREHOUSE_SELECTED:1);

  const days=new Map();
  (WAREHOUSE_STATE.movements||[]).forEach(m=>{
    const d=typeof warehouseMovementDate==='function'?warehouseMovementDate(m):'';
    if(!d || (ym&&!d.startsWith(ym))) return;
    if(Number(m.from_warehouse_id)!==wid && Number(m.to_warehouse_id)!==wid) return;
    if(!days.has(d)) days.set(d,{in:new Map(),out:new Map(),tin:new Map(),tout:new Map(),notes:new Set(),count:0});
    const g=days.get(d),qty=Number(m.qty)||0,prod=m.product||'بدون عنوان',type=String(m.type||'');
    g.count++;
    if(type==='transfer'){
      if(Number(m.to_warehouse_id)===wid) addQty(g.tin,prod,qty);
      if(Number(m.from_warehouse_id)===wid) addQty(g.tout,prod,qty);
    }else{
      const delta=(Number(m.to_warehouse_id)===wid?qty:0)-(Number(m.from_warehouse_id)===wid?qty:0);
      if(delta>0) addQty(g.in,prod,delta);
      if(delta<0) addQty(g.out,prod,-delta);
    }
    if(type==='return') g.notes.add('مرجوعی '+qty.toLocaleString('fa-IR')+' دستگاه');
    if(type==='adjustment') g.notes.add('اصلاح موجودی');
  });

  let thead=table.querySelector('thead tr');
  if(thead) thead.innerHTML='<th>تاریخ</th><th>ورود</th><th>خروج</th><th>انتقال</th><th>توضیحات</th>';

  const rows=[...days.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([d,g])=>{
    const notes=[...g.notes];
    if(g.count>1) notes.push(g.count.toLocaleString('fa-IR')+' ثبت تجمیع‌شده');
    return '<tr><td><b>'+esc(d)+'</b></td><td>'+bucketHtml(g.in)+'</td><td>'+bucketHtml(g.out)+'</td><td>'+transferHtml(g.tin,g.tout)+'</td><td>'+(notes.length?notes.map(esc).join('، '):'<span class="small">—</span>')+'</td></tr>';
  }).join('');
  body.innerHTML=rows||'<tr><td colspan="5">در این ماه هنوز گردش جدیدی ثبت نشده است.</td></tr>';
}

function wrapWarehouseRender(){
  if(typeof renderWarehouseLedger==='function' && !renderWarehouseLedger.__gpDailyGrouped){
    const base=renderWarehouseLedger;
    const wrapped=function(){
      const r=base.apply(this,arguments);
      try{renderDailyMovementSummary()}catch(e){}
      return r;
    };
    wrapped.__gpDailyGrouped=true;
    renderWarehouseLedger=wrapped;
  }
}

function normalizeUI(){
  renameWarehouseProducts();
  mergeCustomerSerialCards();
  installJDateFix();
  wrapWarehouseRender();
  try{ if(document.getElementById('warehouseDaily') && !document.getElementById('warehouseDaily').classList.contains('hidden')) renderDailyMovementSummary(); }catch(e){}
}

const css=document.createElement('style');
css.textContent=
  '.jdate-pop{z-index:1000000!important}.jdate-wrap{overflow:visible!important}.report-grid,.card{overflow:visible}'+
  '.gp-serial-merge-divider{height:1px;background:#e4eaf1;margin:14px 0}'+
  '#inventory>.card{overflow:visible}.gp-move-products{display:flex;flex-wrap:wrap;gap:4px 7px;margin-top:4px}.gp-move-products span{display:inline-block;background:#f4f7fb;border:1px solid #e1e8f0;border-radius:7px;padding:3px 6px;font-size:11px}.warehouse-movement-table{min-width:900px}.warehouse-movement-table td{vertical-align:top}';
document.head.appendChild(css);

normalizeUI();
setTimeout(normalizeUI,250);
setTimeout(normalizeUI,900);

let queued=false;
new MutationObserver(()=>{
  if(queued)return; queued=true;
  setTimeout(()=>{queued=false;normalizeUI()},100);
}).observe(document.body,{subtree:true,childList:true});

window.addEventListener('resize',()=>{
  document.querySelectorAll('.jdate-pop:not(.hidden)').forEach(p=>{
    const id=p.id.replace(/_picker$/,'');positionJDate(id);
  });
});
})();

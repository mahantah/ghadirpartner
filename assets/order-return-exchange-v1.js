/* GP_ORDER_RETURN_EXCHANGE_V1_20261026 — return device replacement on same order */
(function(){
'use strict';
function order(id){return (window.ORD||ORD||[]).find(o=>+o.id===+id)}
function pendingMap(o){
 const original=new Map, returned=new Set;
 (o.items||[]).forEach(it=>(it.serials||[]).forEach(sn=>original.set(String(sn).toUpperCase(),it.product)));
 (o.returns||[]).forEach(r=>(r.serials||[]).forEach(sn=>returned.add(String(sn).toUpperCase())));
 const counts={};
 returned.forEach(sn=>{const p=original.get(sn);if(p)counts[p]=(counts[p]||0)+1});
 (o.exchanges||[]).forEach(ex=>{counts[ex.product]=(counts[ex.product]||0)-(ex.new_serials||[]).length});
 return Object.fromEntries(Object.entries(counts).filter(([,n])=>n>0));
}
function returnedSerials(o,product){
 const onOrder=new Set((o.items||[]).find(it=>it.product===product)?.serials?.map(s=>String(s).toUpperCase())||[]);
 const out=[];
 (o.returns||[]).forEach(r=>(r.serials||[]).forEach(sn=>{const k=String(sn).toUpperCase();if(onOrder.has(k))out.push(String(sn))}));
 return [...new Set(out)];
}
function whName(id){
 if(typeof warehouseName==='function')return warehouseName(id);
 return +id===2?'انبار خرده تهرانپارس':(+id===1?'انبار عمده':'—');
}
function exchangeHistoryHtml(o,product){
 const rows=(o.exchanges||[]).filter(ex=>!product||ex.product===product);
 if(!rows.length)return '<div class="small">هنوز تعویضی ثبت نشده است.</div>';
 return rows.slice().reverse().map(ex=>{
  const when=typeof jalaliDateTime==='function'?jalaliDateTime(ex.at):ex.at;
  return '<div><b>#'+(ex.id||'—')+'</b> · '+esc(when||'-')+' · '+esc(ex.by||'')+' · '+((ex.new_serials||[]).length).toLocaleString('fa-IR')+' دستگاه · '+esc((ex.new_serials||[]).join(', '))+'</div>';
 }).join('');
}
function newRequestId(){
 try{return crypto.randomUUID()}catch(_){return 'req-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
}
window.openOrderExchange=function(id){
 const o=order(id);if(!o)return;
 const available=pendingMap(o);const keys=Object.keys(available);
 if(!keys.length){alert('مرجوعی تعویض‌نشده وجود ندارد');return}
 const c=typeof customerById==='function'?customerById(o.customer_id):{};
 const options=keys.map(p=>'<option value="'+esc(p)+'">'+esc(p)+'</option>').join('');
 modal('<div class="gp-exchange-modal"><h3>تعویض دستگاه مرجوعی</h3><p class="gp-exchange-sub">سفارش '+esc(o.number)+' · '+esc(o.customer_name||'')+' — جایگزینی بدون فروش جدید؛ مبلغ و تعداد اقلام سفارش تغییر نمی‌کند.</p>'
  +'<div class="gp-exchange-head"><div class="gp-exchange-card"><b>مشتری</b><span>'+esc(c.company||c.mobile||c.code||'—')+'</span></div><div class="gp-exchange-card"><b>وضعیت سفارش</b><span>'+esc(o.status||'')+' · '+esc(o.payment_status||'')+'</span></div></div>'
  +'<label>مدل دستگاه مرجوع‌شده<select id="exchangeProduct" onchange="renderExchangeSerials('+id+')">'+options+'</select></label>'
  +'<div id="exchangeQuota" class="gp-exchange-quota"></div>'
  +'<div class="gp-exchange-section"><h4>سریال‌های مرجوعی (در سابقه سفارش باقی می‌مانند)</h4><div id="exchangeReturned" class="gp-exchange-returned"></div></div>'
  +'<div class="gp-exchange-section"><h4>انتخاب سریال جایگزین از موجودی آزاد</h4><div id="exchangeSerialList"></div></div>'
  +'<div class="gp-exchange-section"><h4>تاریخچه تعویض</h4><div id="exchangeHistory" class="gp-exchange-history"></div></div>'
  +'<div class="gp-exchange-toolbar"><button type="button" class="primary" onclick="submitOrderExchange('+id+')">ثبت نهایی تعویض</button><button type="button" class="ghost" onclick="closeModal()">انصراف</button></div></div>');
 renderExchangeSerials(id);
};
window.renderExchangeSerials=function(id){
 const o=order(id),product=document.getElementById('exchangeProduct')?.value,quota=(pendingMap(o)[product]||0);
 const free=(window.INV||INV||[]).filter(iv=>iv.product===product&&+iv.warehouse_id>0&&!iv.order_id);
 const ret=returnedSerials(o,product);
 const qEl=document.getElementById('exchangeQuota'),rEl=document.getElementById('exchangeReturned'),tEl=document.getElementById('exchangeSerialList'),hEl=document.getElementById('exchangeHistory');
 if(qEl)qEl.innerHTML='<span class="pill">حداکثر '+quota.toLocaleString('fa-IR')+' جایگزین</span><span class="pill alt">'+free.length.toLocaleString('fa-IR')+' سریال آزاد در انبار</span>';
 if(rEl)rEl.textContent=ret.length?ret.join(' · '):'—';
 if(hEl)hEl.innerHTML=exchangeHistoryHtml(o,product);
 if(!tEl)return;
 tEl.innerHTML='<div class="gp-exchange-serial-grid">'+free.map(iv=>'<label class="gp-exchange-serial-item"><input type="checkbox" class="exchangeSerial" value="'+esc(iv.serial)+'"><span class="code">'+esc(iv.serial)+'</span><span class="wh">'+esc(whName(iv.warehouse_id))+'</span></label>').join('')+'</div>';
};
window.submitOrderExchange=async function(id){
 try{
 const o=order(id),product=document.getElementById('exchangeProduct')?.value;
 const serials=[...document.querySelectorAll('.exchangeSerial:checked')].map(x=>x.value);
 const quota=(pendingMap(o)[product]||0);
 if(!serials.length||serials.length>quota)throw Error('تعداد سریال‌های انتخابی باید بین ۱ و '+quota+' باشد');
 if(!confirm(serials.length.toLocaleString('fa-IR')+' دستگاه '+product+' به عنوان جایگزین مرجوعی ثبت شود؟\nمبلغ و تعداد سفارش تغییر نمی‌کند.'))return;
 const request_id=newRequestId();
 await req('/api/order/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,product,serials,request_id})});
 closeModal();toast('جایگزینی و خروج انبار ثبت شد');await refresh();if(typeof loadWarehouseLedger==='function')await loadWarehouseLedger();
 }catch(e){alert(e.message||e)}
};
const previous=window.toggleOrderMenu;
if(typeof previous==='function')window.toggleOrderMenu=function(ev,id){
 previous(ev,id);
 const o=order(id),menu=[...document.querySelectorAll('.order-menu.open')].slice(-1)[0];
 if(o&&menu&&has('prep')&&Object.keys(pendingMap(o)).length){
  menu.insertAdjacentHTML('beforeend','<div class="order-menu-sep"></div><button type="button" onclick="closeOrderMenus();openOrderExchange('+Number(id)+')">↔ تعویض دستگاه مرجوعی</button>');
 }
};
})();

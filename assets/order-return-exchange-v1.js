/* Order return replacement — preserves original order quantities and returned serials. */
(function(){
'use strict';
function order(id){return (window.ORD||ORD||[]).find(o=>+o.id===+id)}
function pending(o){
 const original=new Map, returned=new Set;
 (o.items||[]).forEach(it=>(it.serials||[]).forEach(sn=>original.set(String(sn).toUpperCase(),it.product)));
 (o.returns||[]).forEach(r=>(r.serials||[]).forEach(sn=>returned.add(String(sn).toUpperCase())));
 const counts={};returned.forEach(sn=>{const p=original.get(sn);if(p)counts[p]=(counts[p]||0)+1});
 (o.exchanges||[]).forEach(ex=>{counts[ex.product]=(counts[ex.product]||0)-(ex.new_serials||[]).length});
 return Object.entries(counts).filter(([p,n])=>n>0);
}
window.openOrderExchange=function(id){
 const o=order(id);if(!o)return;
 const available=pending(o);if(!available.length){alert('مرجوعی تعویض‌نشده وجود ندارد');return}
 const options=available.map(([p,n])=>'<option value="'+esc(p)+'">'+esc(p)+' — '+n.toLocaleString('fa-IR')+' دستگاه</option>').join('');
 modal('<h3>تعویض دستگاه مرجوعی — سفارش '+esc(o.number)+'</h3><p class="small">فقط سریال‌های آزاد از موجودی انبار قابل انتخاب‌اند. مبلغ و تعداد سفارش تغییر نمی‌کند.</p><div class="grid"><label>مدل دستگاه<select id="exchangeProduct" onchange="renderExchangeSerials('+id+')">'+options+'</select></label></div><div id="exchangeSerialList"></div><div class="toolbar" style="margin-top:12px"><button onclick="submitOrderExchange('+id+')">ثبت و خروج دستگاه جایگزین</button><button class="btnlight" onclick="closeModal()">انصراف</button></div>');
 renderExchangeSerials(id);
};
window.renderExchangeSerials=function(id){
 const o=order(id),product=document.getElementById('exchangeProduct')?.value,quota=Object.fromEntries(pending(o))[product]||0;
 const free=(window.INV||INV||[]).filter(iv=>iv.product===product&&+iv.warehouse_id>0&&!iv.order_id);
 const target=document.getElementById('exchangeSerialList');if(!target)return;
 target.innerHTML='<p class="small">حداکثر '+quota.toLocaleString('fa-IR')+' دستگاه جایگزین؛ '+free.length.toLocaleString('fa-IR')+' سریال آزاد</p><div class="return-serial-grid">'+free.map(iv=>'<label class="return-serial-item"><input type="checkbox" class="exchangeSerial" value="'+esc(iv.serial)+'"><span class="code">'+esc(iv.serial)+'</span></label>').join('')+'</div>';
};
window.submitOrderExchange=async function(id){
 try{
 const product=document.getElementById('exchangeProduct')?.value,serials=[...document.querySelectorAll('.exchangeSerial:checked')].map(x=>x.value);
 const quota=Object.fromEntries(pending(order(id)))[product]||0;
 if(!serials.length||serials.length>quota)throw Error('تعداد سریال‌های انتخابی باید بین ۱ و '+quota+' باشد');
 if(!confirm('خروج '+serials.length+' دستگاه '+product+' به عنوان جایگزین مرجوعی ثبت شود؟'))return;
 await req('/api/order/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,product,serials})});
 closeModal();toast('جایگزینی و خروج انبار ثبت شد');await refresh();if(typeof loadWarehouseLedger==='function')await loadWarehouseLedger();
 }catch(e){alert(e.message)}
};
const previous=window.toggleOrderMenu;
if(typeof previous==='function')window.toggleOrderMenu=function(ev,id){
 previous(ev,id);const o=order(id),menu=[...document.querySelectorAll('.order-menu.open')].slice(-1)[0];
 if(o&&menu&&has('prep')&&pending(o).length)menu.insertAdjacentHTML('beforeend','<div class="order-menu-sep"></div><button onclick="closeOrderMenus();openOrderExchange('+Number(id)+')">↔ تعویض دستگاه مرجوعی</button>');
};
})();
/* GHADIR_WAREHOUSE_SERIAL_FILTERS_GHOST_V1_20261017
   Overlay cleanup, carton and customer-serial model/date filters.
   Operates only on displayed DOM; original warehouse/inventory data and
   permission-sensitive actions stay as they are. Legacy per-carton print stays.
*/
(function(){
 'use strict';
 function init(){
  var warehouse=document.getElementById('warehouse');
  var inventory=document.getElementById('inventory');
  if(!warehouse || !inventory || document.getElementById('gp-warehouse-filter-box'))return;
  // The standalone bulk-label card is unused; leave per-carton print intact.
  Array.from(warehouse.querySelectorAll('.card')).forEach(function(card){
    var heading=card.querySelector('.section-title h3');
    // Prior live releases may call this bulk-print card by another title.
    // Do not remove the carton table or a per-carton print action.
    var title=(heading&&heading.textContent||'').replace(/\s+/g,' ').trim();
    var separateBulkPrint = title.includes('لیبل') &&
      (title.includes('چاپ')||title.includes('دانلود')) &&
      !card.querySelector('#warehouseBody') &&
      (title.includes('یکجا')||title.includes('گروهی')||title.includes('سریال'));
    if(separateBulkPrint)card.remove();
  });
  function toLatin(v){return String(v||'').replace(/[۰-۹]/g,function(x){return String(x.charCodeAt(0)-1776)})
      .replace(/[٠-٩]/g,function(x){return String(x.charCodeAt(0)-1632)})}
  function normDate(v){var m=toLatin(v).trim().replace(/-/g,'/').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if(!m||+m[2]<1||+m[2]>12||+m[3]<1||+m[3]>31)return '';
    return m[1]+'/'+m[2].padStart(2,'0')+'/'+m[3].padStart(2,'0');
  }
  function jalali(v){if(!v)return'';try{if(typeof jalaliDate==='function')return normDate(jalaliDate(v))}catch(e){}return''}
  function time(v){var t=Date.parse(String(v||'').replace(' ','T'));return Number.isFinite(t)?t:0}
  function escapeText(s){return String(s||'').replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]})}
  function controls(id,title){var box=document.createElement('div');box.className='card gp-warehouse-filters';box.id=id;
    box.innerHTML='<div class="gp-filter-heading">'+title+'</div>'+
    '<div class="gp-filter-grid">'+
    '<label>مدل دستگاه<select data-filter="model"><option value="">تمام مدل‌ها</option></select></label>'+
    '<label>از تاریخ ثبت (شمسی)<input data-filter="from" inputmode="numeric" placeholder="۱۴۰۵/۰۷/۰۱" autocomplete="off"></label>'+
    '<label>تا تاریخ ثبت (شمسی)<input data-filter="to" inputmode="numeric" placeholder="۱۴۰۵/۰۷/۳۰" autocomplete="off"></label>'+
    '<label>مرتب‌سازی تاریخ<select data-filter="order"><option value="new">جدیدترین ابتدا</option><option value="old">قدیمی‌ترین ابتدا</option></select></label>'+
    '</div><div class="gp-filter-foot"><span class="gp-filter-summary" aria-live="polite"></span><button type="button" class="gp-reset-filter">پاک‌کردن فیلترها</button></div>';
    return box;
  }
  function modelOptions(select,values){var val=select.value;
    var arr=Array.from(new Set(values.filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'fa')});
    var key=arr.join('\u0000');if(select.dataset.gpChoices===key)return;
    select.dataset.gpChoices=key;select.innerHTML='<option value="">تمام مدل‌ها</option>'+arr.map(function(v){return '<option value="'+escapeText(v)+'">'+escapeText(v)+'</option>'}).join('');
    select.value=arr.includes(val)?val:'';
  }
  function fields(box){return {
    model:box.querySelector('[data-filter="model"]').value,
    from:normDate(box.querySelector('[data-filter="from"]').value),
    to:normDate(box.querySelector('[data-filter="to"]').value),
    order:box.querySelector('[data-filter="order"]').value
  }}
  function matches(product,date,f){return (!f.model||product===f.model)&&(!f.from||date&&date>=f.from)&&(!f.to||date&&date<=f.to)}
  function bind(box,apply){box.addEventListener('change',apply);box.addEventListener('input',function(e){if(e.target.matches('input'))apply()});
    box.querySelector('.gp-reset-filter').addEventListener('click',function(){
      box.querySelectorAll('select').forEach(function(x){x.selectedIndex=0});
      box.querySelectorAll('input').forEach(function(x){x.value=''});apply();
    });
  }
  var warehouseBody=document.getElementById('warehouseBody');
  if(warehouseBody){
    var wb=controls('gp-warehouse-filter-box','فیلتر و مرتب‌سازی سریال‌های مخزن');
    var card=warehouseBody.closest('.card');
    if(card)card.parentNode.insertBefore(wb,card);
    var whObserver,applying=false;
    function applyWarehouse(){
      if(applying)return;
      applying=true;
      try {
        if(whObserver)whObserver.disconnect();
        var cartons=(typeof WH!=='undefined'&&WH&&Array.isArray(WH.cartons))?WH.cartons:[];
        var serials=(typeof WH!=='undefined'&&WH&&Array.isArray(WH.inventory))?WH.inventory:[];
        modelOptions(wb.querySelector('[data-filter="model"]'),cartons.map(function(c){return c.product}));
        var f=fields(wb),rows=Array.from(warehouseBody.querySelectorAll('tr')),count=0;
        var dateByCarton=new Map();
        serials.forEach(function(iv){var key=String(iv.carton_id||iv.carton_code||'');
          var stamp=String(iv.added_at||iv.created_at||'');
          if(key && (!dateByCarton.has(key)||time(stamp)>time(dateByCarton.get(key))))dateByCarton.set(key,stamp);
        });
        var cartonsByCode=new Map(cartons.map(function(c){return [String(c.code||''),c]}));
        var ranked=rows.map(function(row,index){
          var code=(row.querySelector('td:first-child')?.textContent||'').trim();
          var c=cartonsByCode.get(code);
          var stamp=c?(c.created_at||c.added_at||dateByCarton.get(String(c.id))||dateByCarton.get(code)||''):'';
          var shown=!!c&&matches(c.product,jalali(stamp),f);
          // Keep the original no-data message if the source list is empty.
          if(!cartons.length)shown=true;
          row.style.display=shown?'':'none';
          if(shown&&c)count++;
          return {row:row,idx:index,stamp:time(stamp),id:c?Number(c.id)||0:0}
        });
        ranked.sort(function(a,b){return (f.order==='old'?a.stamp-b.stamp:b.stamp-a.stamp)||a.idx-b.idx});
        var frag=document.createDocumentFragment();ranked.forEach(function(x){frag.appendChild(x.row)});
        warehouseBody.appendChild(frag);
        wb.querySelector('.gp-filter-summary').textContent=count.toLocaleString('fa-IR')+' کارتن از '+cartons.length.toLocaleString('fa-IR')+' کارتن';
      } finally {
        applying=false;
        if(whObserver)whObserver.observe(warehouseBody,{childList:true});
      }
    }
    whObserver=new MutationObserver(applyWarehouse);
    whObserver.observe(warehouseBody,{childList:true});
    bind(wb,applyWarehouse);
    applyWarehouse();
  }
  var groups=document.getElementById('inventoryGroups');
  if(groups){
    var ib=controls('gp-inventory-filter-box','فیلتر سریال‌ها بر اساس مدل و تاریخ');
    groups.parentNode.insertBefore(ib,groups);
    var invObserver,invApplying=false;
    function applyInventory(){
      if(invApplying)return;invApplying=true;
      try{
        if(invObserver)invObserver.disconnect();
        var all=(typeof INV!=='undefined'&&Array.isArray(INV))?INV:[];
        modelOptions(ib.querySelector('[data-filter="model"]'),all.map(function(x){return x.product}));
        var f=fields(ib),visible=0,map=new Map();
        all.forEach(function(iv){var key=String(iv.product||'')+'\u0000'+String(iv.serial||'').toUpperCase();
          if(!map.has(key))map.set(key,[]);
          map.get(key).push(iv)
        });
        Array.from(groups.querySelectorAll('details.inv-group')).forEach(function(group){
          var rows=Array.from(group.querySelectorAll('.inv-serial-row'));
          var ranked=rows.map(function(row,index){
            var product=(row.querySelector('.inv-product')?.textContent||'').trim();
            var raw=(row.querySelector('.inv-code')?.textContent||'').replace(/^\s*SN:\s*/i,'').split('IMEI:')[0].trim().toUpperCase();
            var found=map.get(product+'\u0000'+raw)||[];
            var iv=found[0],stamp=iv?(iv.added_at||iv.created_at||''):'';
            var shown=!!iv&&matches(product,jalali(stamp),f);
            row.style.display=shown?'':'none';
            return {row:row,stamp:time(stamp),index:index,shown:shown}
          });
          ranked.sort(function(a,b){return (f.order==='old'?a.stamp-b.stamp:b.stamp-a.stamp)||a.index-b.index});
          var wrap=group.querySelector('.inv-detail');if(wrap){var frag=document.createDocumentFragment();ranked.forEach(function(x){frag.appendChild(x.row)});wrap.appendChild(frag)}
          var n=ranked.filter(function(x){return x.shown}).length;visible+=n;
          group.style.display=n?'':'none';
          var ct=group.querySelector('.inv-count');if(ct)ct.textContent=n.toLocaleString('fa-IR')+' سریال';
        });
        ib.querySelector('.gp-filter-summary').textContent=visible.toLocaleString('fa-IR')+' سریال از '+all.length.toLocaleString('fa-IR')+' سریال';
      } finally {invApplying=false;if(invObserver)invObserver.observe(groups,{childList:true})}
    }
    invObserver=new MutationObserver(applyInventory);
    invObserver.observe(groups,{childList:true});
    bind(ib,applyInventory);
    applyInventory();
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();

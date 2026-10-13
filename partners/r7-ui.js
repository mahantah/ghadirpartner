/* GhadirPartner R7 UI override - 2026-10-01 */
(function(){
  const SUPPORT='02177247070';
  const TYPE_LABELS={
    panel_cash:'نقد پنل',
    panel_7d:'هفت‌روزه',
    panel_1m:'یک‌ماهه',
    serial_1_50:'سریال آزاد ۱ تا ۵۰',
    serial_51_200:'سریال آزاد ۵۱ تا ۲۰۰',
    sales_agent:'عامل فروش'
  };
  let r7PriceType='panel_cash',r7Product='',r7Search='',r7Status='',r7Payment='';
  function ready(){return typeof window.show==='function'&&typeof window.renderDashboard==='function'&&document.getElementById('app')}
  function q(id){return document.getElementById(id)}
  function safeMoney(v){try{return typeof money==='function'?money(v):Number(v||0).toLocaleString('fa-IR')}catch(e){return Number(v||0).toLocaleString('fa-IR')}}
  function safeEsc(v){try{return typeof esc==='function'?esc(v):String(v??'')}catch(e){return String(v??'')}}
  function customerName(){try{return me?.customer?.name||''}catch(e){return ''}}
  function showOffer(o){
    let old=document.querySelector('.r7-offer-modal');if(old)old.remove();
    let d=document.createElement('div');d.className='r7-offer-modal';
    d.innerHTML='<div><button class="r7-close">بستن</button><h3>'+safeEsc(o.title||'پیشنهاد ویژه')+'</h3><span class="badge">'+safeEsc(o.badge||'پیشنهاد ویژه')+'</span><p class="hint" style="font-size:13px">'+safeEsc(o.description||'')+'</p>'+(o.end_date?'<p class="hint">اعتبار تا '+safeEsc(o.end_date)+'</p>':'')+(o.product?'<button class="orange" style="width:100%;margin-top:8px">ثبت سفارش '+safeEsc(o.product)+'</button>':'')+'</div>';
    d.querySelector('.r7-close').onclick=()=>d.remove();
    d.onclick=e=>{if(e.target===d)d.remove()};
    let b=d.querySelector('.orange');if(b)b.onclick=()=>{d.remove();quickAdd(o.product)};
    document.body.appendChild(d);
  }
  function enhanceDashboard(){
    let hero=document.querySelector('#dashboard .hero h2');
    if(hero)hero.textContent=customerName()?'سلام '+customerName()+' 👋':'پیشخوان قدیر پارتنر';
    try{
      document.querySelectorAll('#specialOffers .offer-item').forEach((el,i)=>{
        el.onclick=()=>{if(offers&&offers[i])showOffer(offers[i])};
        let btn=el.querySelector('button');if(btn)btn.onclick=e=>e.stopPropagation();
      });
    }catch(e){}
  }
  function renderCatalogR7(){
    if(!q('catalogGrid'))return;
    let list=(catalog||[]).filter(p=>p.available);
    if(!list.length){q('catalogGrid').innerHTML='<div class="r7-empty">در حال حاضر کالای قابل سفارشی اعلام نشده است.</div>';return}
    if(!r7Product||!list.some(x=>x.name===r7Product))r7Product=list[0].name;
    let p=list.find(x=>x.name===r7Product)||list[0],prices=p.prices||{};
    let value=prices[r7PriceType]||((r7PriceType==='panel_cash')?p.price:0);
    q('catalogGrid').innerHTML=
      '<div class="r7-catalog-controls">'+
      '<select id="r7PriceType">'+Object.entries(TYPE_LABELS).map(([k,v])=>'<option value="'+k+'" '+(k===r7PriceType?'selected':'')+'>'+v+'</option>').join('')+'</select>'+
      '<select id="r7Product">'+list.map(x=>'<option value="'+safeEsc(x.name)+'" '+(x.name===r7Product?'selected':'')+'>'+safeEsc(x.name)+'</option>').join('')+'</select>'+
      '</div>'+
      '<div class="r7-catalog-card"><div class="r7-title"><div><h3 style="margin:0">'+safeEsc(p.name)+'</h3><div class="hint">'+safeEsc(p.description||'')+'</div></div><span class="badge">'+safeEsc(TYPE_LABELS[r7PriceType])+'</span></div>'+
      '<div class="r7-price">'+(Number(value||0)>0?safeMoney(value)+' <small>تومان</small>':'قیمت ثبت نشده')+'</div>'+
      '<div class="r7-stock">'+(p.stock?'● موجود':'● ناموجود')+'</div>'+
      '<button class="orange" id="r7QuickOrder" style="width:100%;margin-top:12px" '+(p.stock?'':'disabled')+'>افزودن به سفارش</button></div>'+
      '<div class="hint" style="margin-top:8px">ابتدا نوع قیمت و سپس مدل دستگاه را انتخاب کنید؛ برای جلوگیری از شلوغی، فقط یک مدل نمایش داده می‌شود.</div>';
    q('r7PriceType').onchange=e=>{r7PriceType=e.target.value;renderCatalogR7()};
    q('r7Product').onchange=e=>{r7Product=e.target.value;renderCatalogR7()};
    q('r7QuickOrder').onclick=()=>quickAdd(p.name);
  }
  function orderMatches(o){
    let text=(o.number+' '+(o.customer_name||'')+' '+(o.items||[]).map(i=>i.product).join(' ')).toLowerCase();
    return (!r7Search||text.includes(r7Search.toLowerCase()))&&(!r7Status||o.status===r7Status)&&(!r7Payment||o.payment_status===r7Payment);
  }
  function orderRow(o){
    return '<tr><td><b>'+safeEsc(o.number)+'</b></td><td>'+safeEsc(o.created_at||'-')+'</td><td>'+safeEsc(o.customer_name||'')+'</td><td><div class="items">'+(o.items||[]).map(i=>'<span class="item">'+safeEsc(i.product)+' × '+i.qty+'</span>').join('')+'</div></td><td>'+(o.approved_total?safeMoney(o.approved_total)+' تومان':'در انتظار تأیید')+'</td><td><span class="badge '+(o.approval_status==='در انتظار تأیید'?'pending':'')+'">'+safeEsc(o.status)+'</span></td><td>'+paymentBadge(o.payment_status)+'</td><td><div class="toolbar"><button class="light" onclick="details('+o.id+')">جزئیات</button>'+(has('admin')&&o.approval_status!=='تأیید شده'?'<button class="orange" onclick="approveOrder('+o.id+')">تأیید</button>':'')+(isCustomer()&&o.approval_status==='تأیید شده'&&o.payment_status!=='تسویه کامل'?'<button class="orange" onclick="startPayment('+o.id+')">پرداخت</button>':'')+'</div></td></tr>';
  }
  function orderCard(o){
    return '<div class="r7-order-card"><div class="top"><div><b>'+safeEsc(o.number)+'</b><div class="hint">'+safeEsc(o.created_at||'')+'</div></div><span class="badge">'+safeEsc(o.status||'')+'</span></div><div class="items">'+(o.items||[]).map(i=>'<span class="item">'+safeEsc(i.product)+' × '+i.qty+'</span>').join('')+'</div><div class="meta"><span class="badge">'+(o.approved_total?safeMoney(o.approved_total)+' تومان':'در انتظار تأیید')+'</span>'+paymentBadge(o.payment_status)+'</div><div class="actions"><button class="light" onclick="details('+o.id+')">جزئیات</button>'+(isCustomer()&&o.approval_status==='تأیید شده'&&o.payment_status!=='تسویه کامل'?'<button class="orange" onclick="startPayment('+o.id+')">پرداخت</button>':'')+'</div></div>';
  }
  function ensureOrderFilters(){
    let sec=q('orders');if(!sec||q('r7OrderFilters'))return;
    let wrap=document.createElement('div');wrap.id='r7OrderFilters';wrap.className='r7-filterbar';
    wrap.innerHTML='<input id="r7OrderSearch" placeholder="جستجو شماره سفارش یا مدل"><select id="r7OrderStatus"><option value="">همه وضعیت‌ها</option>'+['ثبت شده','در حال آماده سازی','آماده ارسال','ارسال شد','تحویل شد','لغو شد'].map(x=>'<option>'+x+'</option>').join('')+'</select><select id="r7OrderPayment"><option value="">همه پرداخت‌ها</option>'+['پرداخت نشده','تسویه کامل','اعتباری','فورس','چک'].map(x=>'<option>'+x+'</option>').join('')+'</select>';
    let table=sec.querySelector('.tablewrap');if(table)table.parentNode.insertBefore(wrap,table);
    let mobile=document.createElement('div');mobile.id='r7OrderMobile';mobile.className='r7-order-mobile';if(table)table.parentNode.insertBefore(mobile,table.nextSibling);
    q('r7OrderSearch').oninput=e=>{r7Search=e.target.value;renderOrdersR7()};
    q('r7OrderStatus').onchange=e=>{r7Status=e.target.value;renderOrdersR7()};
    q('r7OrderPayment').onchange=e=>{r7Payment=e.target.value;renderOrdersR7()};
  }
  function renderOrdersR7(){
    ensureOrderFilters();
    let list=(orders||[]).slice().reverse().filter(orderMatches);
    if(q('ordersBody'))q('ordersBody').innerHTML=list.map(orderRow).join('')||'<tr><td colspan="8">سفارشی با این فیلتر پیدا نشد.</td></tr>';
    if(q('r7OrderMobile'))q('r7OrderMobile').innerHTML=list.map(orderCard).join('')||'<div class="r7-empty">سفارشی با این فیلتر پیدا نشد.</div>';
  }
  function buildProfileR7(){
    let page=q('profilePage');if(!page||q('r7ProfileTabs'))return;
    let card=page.querySelector('.card');if(!card)return;
    let tabs=document.createElement('div');tabs.id='r7ProfileTabs';tabs.className='r7-profile-tabs';
    tabs.innerHTML='<button data-pane="info" class="active">اطلاعات من</button><button data-pane="serials">سریال‌های من</button><button data-pane="offers">آفرهای من</button>';
    let info=document.createElement('div');info.id='r7PaneInfo';info.className='r7-profile-pane active';
    let serials=document.createElement('div');serials.id='r7PaneSerials';serials.className='r7-profile-pane';
    let offs=document.createElement('div');offs.id='r7PaneOffers';offs.className='r7-profile-pane';
    Array.from(card.children).forEach(ch=>{if(ch!==tabs&&ch.id!=='r7PaneSerials'&&ch.id!=='r7PaneOffers')info.appendChild(ch)});
    card.appendChild(tabs);card.appendChild(info);card.appendChild(serials);card.appendChild(offs);
    tabs.onclick=e=>{let b=e.target.closest('button');if(!b)return;tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));[info,serials,offs].forEach(x=>x.classList.remove('active'));q('r7Pane'+b.dataset.pane.charAt(0).toUpperCase()+b.dataset.pane.slice(1)).classList.add('active')};
    renderProfileExtras();
  }
  function renderProfileExtras(){
    if(!q('r7PaneSerials'))return;
    let serials=[];(orders||[]).forEach(o=>(o.items||[]).forEach(i=>(i.serials||[]).forEach(s=>serials.push({serial:s,product:i.product,order:o.number}))));
    q('r7PaneSerials').innerHTML='<h3>سریال‌های من</h3>'+(serials.length?serials.map(x=>'<div class="r7-serial-item"><b>'+safeEsc(x.product)+'</b><div>'+safeEsc(x.serial)+'</div><small class="hint">سفارش '+safeEsc(x.order)+'</small></div>').join(''):'<div class="r7-empty">هنوز سریالی برای شما ثبت نشده است.</div>');
    q('r7PaneOffers').innerHTML='<h3>آفرهای من</h3>'+((offers||[]).length?(offers||[]).map((o,i)=>'<div class="r7-offer-profile-item" data-offer="'+i+'"><b>'+safeEsc(o.title)+'</b><div class="hint">'+safeEsc(o.description||'')+'</div></div>').join(''):'<div class="r7-empty">آفر فعالی ندارید.</div>')+'<div class="r7-support"><a href="tel:'+SUPPORT+'">تماس با پشتیبانی '+SUPPORT+'</a><a class="secondary" href="https://wa.me/982177247070" target="_blank">واتساپ پشتیبانی</a></div>';
    q('r7PaneOffers').querySelectorAll('[data-offer]').forEach(el=>el.onclick=()=>showOffer(offers[+el.dataset.offer]));
  }
  function install(){
    if(!ready())return setTimeout(install,120);
    const oldDash=window.renderDashboard,oldLoad=window.loadAll;
    window.renderDashboard=function(){oldDash.apply(this,arguments);enhanceDashboard();buildProfileR7();renderProfileExtras()};
    window.renderCatalog=renderCatalogR7;
    window.renderOrders=renderOrdersR7;
    window.loadAll=async function(){let r=await oldLoad.apply(this,arguments);enhanceDashboard();buildProfileR7();renderProfileExtras();return r};
    try{enhanceDashboard();renderCatalogR7();renderOrdersR7();buildProfileR7();renderProfileExtras()}catch(e){console.warn('R7 UI init',e)}
  }
  install();
})();
/* GP_ORDER_DETAILS_V2_20261020 */
'use strict';
let gpOdReturnFocus=null, gpOdImageReturn=null, gpOdScroll='', gpOdCurrent=null;
function gpOdText(v){return typeof v==='string'||typeof v==='number'?String(v):'';}
function gpOdEsc(v){return gpOdText(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function gpOdList(v){return Array.isArray(v)?v:[];}
function gpOdDetails(o){const d=o&&o.settlement_details;return d&&typeof d==='object'&&!Array.isArray(d)?d:{};}
function gpOdImage(raw){
  if(typeof raw!=='string'||!raw||raw.length>1400000)return null;
  let base64=raw,declared='',m=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(raw);
  if(raw.startsWith('data:')){if(!m)return null;declared=m[1].toLowerCase();base64=m[2];}
  base64=base64.replace(/[\r\n]/g,'');
  if(!base64.length||base64.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))return null;
  let bytes;try{bytes=atob(base64);}catch(_){return null;}
  if(bytes.length>1000000)return null;
  let mime='';
  if(bytes.length>=3&&bytes.charCodeAt(0)===255&&bytes.charCodeAt(1)===216&&bytes.charCodeAt(2)===255)mime='jpeg';
  if(bytes.startsWith('\x89PNG\r\n\x1a\n'))mime='png';
  if(bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP')mime='webp';
  if(!mime||(declared&&declared!==mime))return null;
  return {src:'data:image/'+mime+';base64,'+base64,extension:mime==='jpeg'?'jpg':mime};
}
function gpOdAmount(o){
  const approved=Number(o.approved_total),estimated=Number(o.estimated_total);
  if(Number.isFinite(approved)&&approved>0)return {value:approved,label:'مبلغ تأییدشده'};
  if(Number.isFinite(estimated)&&estimated>0)return {value:estimated,label:'مبلغ برآوردی'};
  return {value:null,label:'مبلغ سفارش'};
}
function gpOdMoney(v){return Number.isFinite(Number(v))?Number(v).toLocaleString('fa-IR')+' تومان':'ثبت نشده';}
function gpOdDate(v){return v?gpOdEsc(jalaliDateTime(v)||v):'ثبت نشده';}
function gpOdField(label,value,html=false){
  return '<div class="od2-field"><dt>'+gpOdEsc(label)+'</dt><dd>'+(html?value:gpOdEsc(value)||'ثبت نشده')+'</dd></div>';
}
function gpOdCard(title,content){return '<section class="od2-card"><h4>'+gpOdEsc(title)+'</h4>'+content+'</section>';}
function gpOdFields(content){return '<dl class="od2-fields">'+content+'</dl>';}
function gpOdQuickField(label,value){return '<div class="od2-quick-field"><dt>'+gpOdEsc(label)+'</dt><dd>'+(gpOdEsc(value)||'ثبت نشده')+'</dd></div>';}
function gpOdQuickCard(name,title,fields,linkLabel){
  return '<article class="od2-quick-card od2-quick-'+name+'"><h5>'+gpOdEsc(title)+'</h5><dl>'+fields+'</dl>'+
    (linkLabel?'<button type="button" class="od2-quick-link" data-od2-jump="'+name+'">'+gpOdEsc(linkLabel)+' <span aria-hidden="true">←</span></button>':'')+'</article>';
}
function gpOdQuickHtml(o,c){
  const customer=c&&typeof c==='object'?c:{},address=o.delivery_address&&typeof o.delivery_address==='object'?o.delivery_address:{};
  const snapshot=gpOdText(o.shipping_address)||[address.province,address.city,address.address].map(gpOdText).filter(Boolean).join(' - ');
  const current=[customer.province,customer.city,customer.address].map(gpOdText).filter(Boolean).join(' - ');
  const amount=gpOdAmount(o),financial=has('finance');
  const requested=({cash:'نقد',check:'چک',credit:'اعتباری'})[o.requested_payment_method]||gpOdText(o.requested_payment_method_label)||o.requested_payment_method;
  return '<section class="od2-quick" aria-label="مرور سریع مشتری، پرداخت و ارسال"><div class="od2-quick-heading"><h4>اطلاعات مهم در یک نگاه</h4><p>نمایش اطلاعات ثبت‌شده سفارش؛ وضعیت پرداخت و ارسال فقط براساس سوابق تأییدشده سامانه است.</p></div><div class="od2-quick-grid">'+
    gpOdQuickCard('customer','مشتری',gpOdQuickField('نام سفارش',o.customer_name||customer.name)+
      gpOdQuickField('کد مشتری',customer.code||o.customer_id)+gpOdQuickField('شماره تماس پرونده',customer.mobile),'')+
    gpOdQuickCard('payment','پرداخت',gpOdQuickField('وضعیت ثبت‌شده',o.payment_status)+
      gpOdQuickField(amount.label,amount.value===null?'ثبت نشده':gpOdMoney(amount.value))+
      gpOdQuickField('روش درخواستی',financial?requested:'ویژه واحد مالی'),'مشاهده پرداخت و مدارک')+
    gpOdQuickCard('shipping','ارسال',gpOdQuickField('وضعیت سفارش',o.status)+
      gpOdQuickField('روش ارسال',o.shipping_type)+gpOdQuickField(snapshot?'نشانی سفارش':'نشانی فعلی پرونده',snapshot||current)+
      gpOdQuickField('کد رهگیری مرسوله',o.tracking_code),'مشاهده جزئیات ارسال')+'</div></section>';
}
function gpOdPaymentHtml(o){
  if(!has('finance'))return '<p class="od2-empty">مشاهده مدارک پرداخت برای مدیر و واحد مالی در دسترس است.</p>';
  const d=gpOdDetails(o),image=gpOdImage(d.image_base64),method=({cash:'نقد',check:'چک',credit:'اعتباری'})[o.requested_payment_method]||gpOdText(o.requested_payment_method_label);
  const label=o.requested_payment_method==='check'?'تصویر چک':'تصویر فیش بانکی';
  const fields=gpOdFields(
    gpOdField('روش درخواستی مشتری',method)+gpOdField('وضعیت ثبت‌شده تسویه',o.payment_status)+
    gpOdField('شماره پیگیری واریز',d.tracking_number)+gpOdField('بانک',d.bank_name)+
    gpOdField('شناسه صیادی',d.check_number)+gpOdField('سررسید چک',d.due_date)+
    gpOdField('پذیرش شرایط اعتبار',d.terms_accepted===true?'پذیرفته شده':d.terms_accepted===false?'پذیرفته نشده':'')+
    gpOdField('وضعیت بررسی چک',o.check_status)+gpOdField('تأییدکننده چک',o.check_approved_by)+
    gpOdField('زمان تأیید چک',gpOdDate(o.check_approved_at),true));
  const evidence=image?'<figure class="od2-evidence"><button type="button" class="od2-image-button" data-od2-image aria-label="بزرگ‌نمایی '+label+'"><img src="'+image.src+'" alt="'+label+'" data-od2-preview><span>برای بزرگ‌نمایی انتخاب کنید</span></button><figcaption>'+label+'</figcaption><a class="btn2" href="'+image.src+'" download="payment-'+String(Number(o.id)||0)+'.'+image.extension+'">دانلود تصویر</a></figure>':
    '<p class="od2-empty">'+(d.image_base64?'تصویر ذخیره‌شده معتبر نیست یا قالب آن پشتیبانی نمی‌شود.':'تصویری در اطلاعات پرداخت این سفارش ثبت نشده است.')+'</p>';
  return '<p class="od2-notice">اطلاعات و مدارک ارسالی مشتری از اپلیکیشن، در صورت ثبت، اینجا نمایش داده می‌شوند. مشاهده رسید به معنی تأیید پرداخت یا مجوز ارسال نیست.</p><div class="od2-payment-grid">'+gpOdCard('جزئیات پرداخت ثبت‌شده مشتری',fields)+gpOdCard('مدرک ارسالی مشتری',evidence)+'</div>';
}
function gpOdItemHtml(o){
  const rows=gpOdList(o.items).map((it,n)=>{
    const serials=orderItemSerials(o,it),list=serials.map(s=>{const iv=invBySerial(s,o.id);return '<li><span dir="ltr">'+gpOdEsc(s)+'</span>'+(iv&&iv.imei?'<span dir="ltr">IMEI '+gpOdEsc(iv.imei)+'</span>':'')+'<small>'+gpOdEsc(serialSource(iv))+'</small></li>';}).join('');
    const line=Number(it.line_total),price=Number(it.unit_price);
    return '<tr><td>'+Number(n+1).toLocaleString('fa-IR')+'</td><td><strong>'+gpOdEsc(it.product)+'</strong>'+(it.price_label?'<small>'+gpOdEsc(it.price_label)+'</small>':'')+'</td><td>'+gpOdEsc(it.qty)+'</td><td>'+(Number.isFinite(price)&&price>0?gpOdMoney(price):'ثبت نشده')+'</td><td>'+(Number.isFinite(line)&&line>0?gpOdMoney(line):'ثبت نشده')+'</td><td>'+(serials.length?'<details class="od2-serials"><summary>'+serials.length.toLocaleString('fa-IR')+' سریال؛ نمایش</summary><ul>'+list+'</ul></details>':'بدون سریال')+'</td></tr>';
  }).join('');
  return gpOdCard('اقلام سفارش','<div class="od2-table-wrap"><table><thead><tr><th>ردیف</th><th>کالا</th><th>تعداد</th><th>قیمت واحد</th><th>مبلغ ردیف</th><th>سریال و IMEI</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="6">قلمی ثبت نشده است.</td></tr>')+'</tbody></table></div>');
}
function gpOdOverviewHtml(o,c){
  const contacts=gpOdList(c.contacts).map(x=>'<li>'+gpOdEsc(x.title||x.name)+'<br>'+gpOdEsc(x.name)+' '+gpOdEsc(x.mobile)+'<br>'+gpOdEsc(x.address)+'</li>').join('');
  return gpOdQuickHtml(o,c)+'<div class="od2-grid">'+gpOdCard('اطلاعات سفارش',gpOdFields(
    gpOdField('تاریخ ثبت',gpOdDate(o.created_at),true)+gpOdField('ثبت‌کننده',o.created_by)+
    gpOdField('نوع فاکتور',o.invoice_type)+gpOdField('تأیید سفارش',o.approval_status)+
    gpOdField('کد تخفیف',o.promo_code)+gpOdField('سفارش فوری',o.fros?'بله':'خیر')
  ))+gpOdCard('پرونده مشتری',gpOdFields(
    gpOdField('نام ثبت‌شده در سفارش',o.customer_name)+gpOdField('نام فعلی مشتری',c.name)+
    gpOdField('کد ثابت مشتری',c.code||o.customer_id)+gpOdField('شرکت / حقوقی',c.company)+
    gpOdField('شماره تماس فعلی',c.mobile)+gpOdField('کد ملی / شناسه',c.national_id)
  )+(contacts?'<details><summary>اطلاعات وابسته‌ها</summary><ul class="od2-contacts">'+contacts+'</ul></details>':''))+
  gpOdCard('یادداشت سفارش','<p class="od2-note">'+(gpOdEsc(o.notes)||'توضیحی ثبت نشده است.')+'</p>')+'</div>';
}
function gpOdShippingHtml(o,c){
  const d=o.delivery_address&&typeof o.delivery_address==='object'?o.delivery_address:{};
  const snapshot=gpOdText(o.shipping_address)||[d.province,d.city,d.address].map(gpOdText).filter(Boolean).join(' - ');
  const current=[c.province,c.city,c.address].map(gpOdText).filter(Boolean).join(' - ');
  const ship=shipHistory(o),panels=gpOdList(o.panels).length?o.panels:(o.psp?[o.psp]:[]);
  return '<div class="od2-grid">'+gpOdCard('نشانی و ارسال',gpOdFields(
    gpOdField('عنوان نشانی انتخاب‌شده',d.title)+gpOdField(snapshot?'نشانی ثبت‌شده سفارش':'نشانی فعلی پرونده مشتری',snapshot||current)+
    gpOdField('کدپستی سفارش',d.postal_code)+gpOdField('روش ارسال',o.shipping_type)+
    gpOdField('وضعیت سفارش',o.status)+gpOdField('زمان ارسال',gpOdDate(ship&&ship.at),true)+
    gpOdField('کد مرسوله',o.tracking_code)+(o.shipping_type==='پیک'?gpOdField('نام پیک',o.courier_name)+gpOdField('شماره تماس پیک',o.courier_phone):'')+gpOdField('ثبت در پنل',panels.map(gpOdText).join('، '))
  ))+gpOdCard('فرستنده و سایر اطلاعات',gpOdFields(
    gpOdField('فرستنده',o.sender_name)+gpOdField('آدرس فرستنده',o.sender_address)+gpOdField('واترمارک',o.watermark)+
    gpOdField('علت لغو',o.cancel_reason)+gpOdField('توضیح لغو',o.cancel_note)
  ))+'</div>';
}
function gpOdHistoryHtml(o){
  const rows=gpOdList(o.history).slice().reverse().map(h=>'<li><time>'+gpOdDate(h.at)+'</time><div><strong>'+gpOdEsc(h.action)+'</strong><small>'+gpOdEsc(h.by)+'</small></div></li>').join('');
  return gpOdCard('تاریخچه کامل سفارش',rows?'<ol class="od2-history">'+rows+'</ol>':'<p class="od2-empty">تاریخچه‌ای ثبت نشده است.</p>');
}
function gpOdActivate(name){
  const root=$('orderDetailBody'),tabs=[...root.querySelectorAll('[data-od2-tab]')];
  if(!tabs.some(t=>t.dataset.od2Tab===name))name='overview';
  tabs.forEach(t=>{const active=t.dataset.od2Tab===name;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;});
  root.querySelectorAll('[data-od2-panel]').forEach(p=>{p.hidden=p.dataset.od2Panel!==name;});
  gpOdCurrent=name;
}
function gpOdCloseImage(){
  const el=$('od2ImageDialog');if(!el)return;
  el.remove();if(gpOdImageReturn&&gpOdImageReturn.isConnected)gpOdImageReturn.focus();
}
function gpOdOpenImage(o,trigger){
  const image=gpOdImage(gpOdDetails(o).image_base64);if(!image||!has('finance'))return;
  gpOdImageReturn=trigger;
  const dialog=document.createElement('div');dialog.id='od2ImageDialog';dialog.className='od2-image-dialog';
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','نمایش مدرک پرداخت');dialog.tabIndex=-1;
  dialog.innerHTML='<div class="od2-image-sheet"><button type="button" class="btnlight" data-od2-close-image>بستن تصویر</button><img src="'+image.src+'" alt="مدرک پرداخت مشتری"><a class="btn2" href="'+image.src+'" download="payment-'+String(Number(o.id)||0)+'.'+image.extension+'">دانلود تصویر</a></div>';
  dialog.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('[data-od2-close-image]'))gpOdCloseImage();});
  document.body.appendChild(dialog);dialog.querySelector('button').focus();
}
function openOrderDetails(id,section='overview'){
  closeOrderMenus();const o=ORD.find(x=>Number(x.id)===Number(id));if(!o)return;
  const root=$('orderDetailBody'),overlay=$('orderDetailOverlay'),c=orderCustomer(o),a=gpOdAmount(o),items=gpOdList(o.items),total=items.reduce((n,it)=>n+(Number(it.qty)||0),0);
  if(overlay.classList.contains('hidden')){gpOdReturnFocus=document.activeElement;gpOdScroll=document.body.style.overflow;}
  document.body.style.overflow='hidden';
  overlay.classList.add('od2-overlay');
  const drawer=root.parentElement;drawer.classList.add('od2-drawer');drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-labelledby','od2Title');drawer.tabIndex=-1;
  const sections=[['overview','خلاصه'],['items','اقلام و سریال‌ها'],['payment','پرداخت و مدارک'],['shipping','ارسال'],['history','تاریخچه']];
  root.innerHTML='<div class="od2-header"><div class="od2-heading"><span class="od2-eyebrow">جزئیات سفارش</span><h3 id="od2Title">'+gpOdEsc(o.number)+'</h3><p>'+gpOdEsc(o.customer_name||c.name)+'</p></div><div class="od2-header-actions"><a class="btn2" href="/pdf/order-details?id='+Number(o.id)+'" target="_blank" rel="noopener">دانلود PDF</a><button type="button" class="btnlight" data-od2-close aria-label="بستن جزئیات سفارش">بستن</button></div></div>'+
    '<div class="od2-summary"><div><span>وضعیت سفارش</span><strong>'+gpOdEsc(o.status)+'</strong></div><div><span>تسویه</span><strong>'+gpOdEsc(o.payment_status||'پرداخت نشده')+'</strong></div><div><span>تعداد دستگاه / کالا</span><strong>'+total.toLocaleString('fa-IR')+'</strong></div><div><span>'+a.label+'</span><strong>'+(a.value===null?'ثبت نشده':gpOdMoney(a.value))+'</strong></div></div>'+
    '<div class="od2-tabs" role="tablist" aria-label="بخش‌های جزئیات سفارش">'+sections.map(([key,label])=>'<button type="button" role="tab" id="od2-tab-'+key+'" aria-controls="od2-panel-'+key+'" aria-selected="false" data-od2-tab="'+key+'">'+label+'</button>').join('')+'</div>'+
    sections.map(([key,label])=>'<section role="tabpanel" id="od2-panel-'+key+'" aria-labelledby="od2-tab-'+key+'" data-od2-panel="'+key+'" tabindex="0" hidden>'+
      ({overview:()=>gpOdOverviewHtml(o,c),items:()=>gpOdItemHtml(o),payment:()=>gpOdPaymentHtml(o),shipping:()=>gpOdShippingHtml(o,c),history:()=>gpOdHistoryHtml(o)})[key]()+'</section>').join('');
  root.onclick=e=>{
    const tab=e.target.closest('[data-od2-tab]');if(tab){gpOdActivate(tab.dataset.od2Tab);return;}
    const jump=e.target.closest('[data-od2-jump]');if(jump){
      gpOdActivate(jump.dataset.od2Jump);
      const panel=root.querySelector('[data-od2-panel="'+gpOdCurrent+'"]');if(panel)panel.focus();
      return;
    }
    if(e.target.closest('[data-od2-close]')){closeOrderDetails();return;}
    const image=e.target.closest('[data-od2-image]');if(image)gpOdOpenImage(o,image);
  };
  root.querySelectorAll('img[data-od2-preview]').forEach(img=>img.addEventListener('error',()=>{const figure=img.closest('figure');figure.innerHTML='<p class="od2-empty">تصویر ذخیره‌شده قابل خواندن نیست؛ از مشتری نسخه سالم دریافت کنید.</p>';}));
  overlay.classList.remove('hidden');gpOdActivate(section);
  root.querySelector('[data-od2-tab="'+gpOdCurrent+'"]').focus();drawer.scrollTop=0;
}
function closeOrderDetails(){
  gpOdCloseImage();const overlay=$('orderDetailOverlay');overlay.classList.add('hidden');document.body.style.overflow=gpOdScroll;
  $('orderDetailBody').innerHTML='';gpOdCurrent=null;
  if(gpOdReturnFocus&&gpOdReturnFocus.isConnected)gpOdReturnFocus.focus();
}
function gpOdKeydown(e){
  const overlay=$('orderDetailOverlay');if(!overlay||overlay.classList.contains('hidden'))return;
  const image=$('od2ImageDialog'),scope=image||overlay.querySelector('[role="dialog"]');
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();image?gpOdCloseImage():closeOrderDetails();return;}
  if(!image&&e.target.matches('[data-od2-tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    const tabs=[...$('orderDetailBody').querySelectorAll('[data-od2-tab]')],i=tabs.indexOf(e.target);
    const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowLeft'?1:-1)+tabs.length)%tabs.length;
    e.preventDefault();gpOdActivate(tabs[n].dataset.od2Tab);tabs[n].focus();return;
  }
  if(e.key==='Tab'){
    const focusable=[...scope.querySelectorAll('button:not([disabled]),a[href],summary,[tabindex="0"]')].filter(el=>!el.closest('[hidden]')&&el.getClientRects().length>0);
    const first=focusable[0],last=focusable[focusable.length-1];
    if(!first){e.preventDefault();scope.focus();}
    else if(e.shiftKey&&(document.activeElement===first||!scope.contains(document.activeElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||!scope.contains(document.activeElement))){e.preventDefault();first.focus();}
  }
}
if(typeof document!=='undefined')document.addEventListener('keydown',gpOdKeydown,true);
if(typeof module!=='undefined'&&module.exports)module.exports={gpOdImage,gpOdDetails,gpOdAmount,gpOdEsc,gpOdPaymentHtml,gpOdOverviewHtml,gpOdShippingHtml,gpOdItemHtml,gpOdQuickHtml};

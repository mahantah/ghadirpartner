<?php
/* GhadirPartner V5.3.4.10 physical label renderer */

function gp_h($v){return htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');}

function gp_code128_svg($text){
 $patterns=['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'];
 $text=strtoupper(trim((string)$text));$codes=[104];
 for($i=0;$i<strlen($text);$i++){$n=ord($text[$i])-32;if($n<0||$n>94)$n=0;$codes[]=$n;}
 $sum=104;for($i=1;$i<count($codes);$i++)$sum+=$codes[$i]*$i;
 $codes[]=$sum%103;$codes[]=106;$x=8;$bars='';
 foreach($codes as $code){$pat=$patterns[$code];for($i=0;$i<strlen($pat);$i++){$w=(int)$pat[$i]*2;if($i%2===0)$bars.='<rect x="'.$x.'" y="1" width="'.$w.'" height="38"/>';$x+=$w;}}
 $width=$x+8;
 return '<svg class="barcode" viewBox="0 0 '.$width.' 40" preserveAspectRatio="none" aria-label="'.gp_h($text).'">'.$bars.'</svg>';
}

function gp_brand_title_block(){
 return '<div class="btitle"><div class="name">قدیر پرداخت</div><div class="phone">09128151868</div></div>';
}

function gp_company_contact_qr(){
 return "BEGIN:VCARD
VERSION:3.0
FN:قدیر پرداخت
ORG:قدیر پرداخت
TEL;TYPE=WORK,VOICE:09128151868
TEL;TYPE=CELL:09128151868
ADR;TYPE=WORK:;;تهران پارس غربی، چهارراه دلاوران، خیابان مظفری نیا جنوبی، پلاک 218، واحد 5;تهران;;;ایران
URL:https://ghadirpartner.ir/partners
END:VCARD
";
}

function gp_order_rows_html($o,$c,$sender){
 $senderName=trim((string)($sender['sender_name']??'قدیر پرداخت'));$senderMobile=trim((string)($sender['sender_mobile']??''));
 if($senderMobile==='')$senderMobile='09128151868';
 $senderLine=$senderName.' / '.$senderMobile;
 if(!empty($o['sender_marketer_name'])) $senderLine=$o['sender_marketer_name'].' / '.$senderMobile;
 $receiver=trim((string)($c['company']??''));
 if($receiver==='')$receiver=trim((string)($c['name']??$o['customer_name']??''));
 $receiverMobile=trim((string)($c['mobile']??''));
 $address=gp_customer_address($c);
 $items=[];foreach($o['items']??[] as $it){$items[] = trim((string)($it['product']??'')).' '.(int)($it['qty']??0).' عدد';}
 $itemLine=implode(' | ',array_filter($items)); if($itemLine==='') $itemLine='-';
 $qty=0; foreach($o['items']??[] as $it){$qty+=(int)($it['qty']??0);} if($qty<1)$qty=1;
 $pay=(string)($o['payment_status']??''); if($pay==='تسویه کامل') $pay='<span class="paid">تسویه کامل ✓</span>'; else $pay=gp_h($pay?:'-');
 $ship=gp_h($o['shipping_type']??'-');
 $date=gp_h(jalali_date_value($o['created_at']??''));
 $html='';
 $rows=[
   ['شماره سفارش', gp_h($o['number']??''), 'icon-doc'],
   ['گیرنده', gp_h($receiver), 'icon-user'],
   ['تماس گیرنده', gp_h($receiverMobile?:'-'), 'icon-phone'],
   ['آدرس مقصد', gp_h($address?:'-'), 'icon-pin'],
   ['فرستنده', gp_h($senderLine), 'icon-send'],
   ['کالا / مرسوله', gp_h($itemLine), 'icon-box'],
   ['تعداد', gp_h($qty.' عدد'), 'icon-layers'],
   ['روش ارسال', $ship, 'icon-truck'],
   ['وضعیت پرداخت', $pay, 'icon-pay'],
   ['تاریخ', $date, 'icon-cal'],
 ];
 foreach($rows as [$label,$value,$ic]){
   $html.='<div class="row"><div class="value">'.$value.'</div><div class="label"><span>'.$label.':</span><i class="'.$ic.'"></i></div></div>';
 }
 return $html;
}


function gp_dispatch_box($label,$value){
 return '<div class="infoBox"><div class="iboxLabel">'.gp_h($label).'</div><div class="iboxValue">'.($value!==''?$value:'-').'</div></div>';
}

function gp_dispatch_items_line_from_package($o,$package){
 $line=trim((string)($package['items_line']??''));
 if($line!=='') return $line;
 $items=[];foreach($o['items']??[] as $it){$items[]=trim((string)($it['product']??'')).' × '.(int)($it['qty']??0);} 
 return implode(' | ',array_filter($items));
}

function gp_dispatch_sections_html($o,$c,$sender,$package){
 $senderName=trim((string)($sender['sender_name']??'قدیر پرداخت'));
 $senderMobile=trim((string)($sender['sender_mobile']??'')); if($senderMobile==='')$senderMobile='09128151868';
 $senderAddress=trim((string)($sender['sender_address']??'')); if($senderAddress==='')$senderAddress='تهران';
 if(!empty($o['sender_marketer_name'])) $senderName=$o['sender_marketer_name'];
 $receiver=trim((string)($c['company']??'')); if($receiver==='')$receiver=trim((string)($c['name']??$o['customer_name']??''));
 $receiverMobile=trim((string)($c['mobile']??''));
 $address=gp_customer_address($c);
 $itemsLine=gp_dispatch_items_line_from_package($o,$package);
 if($itemsLine==='') $itemsLine='-';
 $qty=(int)($package['serial_count']??0); if($qty<1){ foreach($o['items']??[] as $it){$qty+=(int)($it['qty']??0);} if($qty<1)$qty=1; }
 $pay=(string)($o['payment_status']??''); if($pay==='')$pay='-';
 $ship=(string)($o['shipping_type']??'-');
 $packageCode=trim((string)($package['carton_code']??''));
 $packageText=trim((string)($package['package_text']??''));
 $sourceText=trim((string)($package['source_label']??''));
 $receiverHtml='';
 $receiverHtml.=gp_dispatch_box('گیرنده',gp_h($receiver?:'-'));
 $receiverHtml.=gp_dispatch_box('تماس گیرنده',gp_h($receiverMobile?:'-'));
 $receiverHtml.=gp_dispatch_box('آدرس مقصد',gp_h($address?:'-'));
 $senderHtml='';
 $senderHtml.=gp_dispatch_box('فرستنده',gp_h($senderName?:'قدیر پرداخت'));
 $senderHtml.=gp_dispatch_box('شماره فرستنده',gp_h($senderMobile));
 $senderHtml.=gp_dispatch_box('آدرس فرستنده',gp_h($senderAddress));
 $packageHtml='';
 $packageHtml.=gp_dispatch_box('مرسوله این بسته',gp_h($itemsLine));
 $packageHtml.=gp_dispatch_box('تعداد این بسته',gp_h($qty.' عدد'));
 $packageHtml.=gp_dispatch_box('روش ارسال',gp_h($ship));
 $packageHtml.=gp_dispatch_box('وضعیت پرداخت',($pay==='تسویه کامل'?'<span class="paid">تسویه کامل ✓</span>':gp_h($pay)));
 if($packageText!=='') $packageHtml.=gp_dispatch_box('شماره بسته',gp_h($packageText));
 if($packageCode!=='') $packageHtml.=gp_dispatch_box('کد کارتن',gp_h($packageCode));
 if($sourceText!=='') $packageHtml.=gp_dispatch_box('مبدا بسته‌بندی',gp_h($sourceText));
 return '<section class="sectionCard"><div class="secHead">مشخصات گیرنده</div><div class="secGrid">'.$receiverHtml.'</div></section>'
 .'<section class="sectionCard"><div class="secHead">مشخصات فرستنده</div><div class="secGrid">'.$senderHtml.'</div></section>'
 .'<section class="sectionCard"><div class="secHead">جزئیات مرسوله</div><div class="secGrid">'.$packageHtml.'</div></section>';
}

function gp_dispatch_left_panel($orderNo,$qrUrl,$package){
 $packageText=trim((string)($package['package_text']??''));
 $packageTitle=$packageText!==''?'<div class="sideMini">بسته '.$packageText.'</div>':'';
 return '<div class="leftCard dispatchLeft"><div class="qrWrap"><div id="orderQr" data-value="'.gp_h($qrUrl).'" class="qrRender"></div></div>'.$packageTitle.'<div class="barcodeWrap">'.gp_code128_svg($orderNo).'<div class="barcodeText">'.gp_h($orderNo).'</div></div><div class="motto">اسکن QR = خلاصه اطلاعات سفارش و فایل سریال‌ها<br>قدیر پرداخت</div></div>';
}

function gp_dispatch_single_sheet($title,$button,$orderNo,$orderDate,$sectionsHtml,$leftHtml,$w,$h,$x,$y,$package){
 $packageText=trim((string)($package['package_text']??''));
 $packageLine=$packageText!==''?'<div class="metaLine">بسته: <b>'.gp_h($packageText).'</b></div>':'';
 return '<section class="sheet dispatchSheet"><div class="header"><div class="hLeft"><img src="/brand-v5311.png" alt="قدیر پرداخت">'.gp_brand_title_block().'</div><div class="divider"></div><div class="hRight"><div><div class="ttl">'.gp_h($title).'</div><div class="sub">از مدیریت امروز، به رشد فردا</div></div><img src="/brand-v5311.png" alt="مرسوله"></div></div><div class="grid dispatchGrid">'.$leftHtml.'<div class="rightCard dispatchCard"><div class="orderNo dispatchOrderNo"><div class="topLine"><span class="lbl">شماره سفارش</span><span class="code">'.gp_h($orderNo).'</span></div><div class="metaRow"><div class="metaLine">تاریخ سفارش: <b>'.gp_h($orderDate).'</b></div>'.$packageLine.'</div></div><div class="sections">'.$sectionsHtml.'</div></div></div></section>';
}

function gp_print_order_dispatch_slips($o,$c,$sender,$profile,$packages){
 $W=max((float)$profile['w'],(float)$profile['h']); $H=min((float)$profile['w'],(float)$profile['h']);
 $x=(float)($profile['x']??0); $y=(float)($profile['y']??0);
 $orderNo=(string)($o['number']??'');
 $orderDate=(string)jalali_date_value($o['created_at']??'');
 $host=(string)($_SERVER['HTTP_HOST']??'ghadirpartner.ir');
 $scheme=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')?'https':'https';
 $token=trim((string)($o['public_qr_token']??''));
 $qrUrl=$scheme.'://'.$host.'/qr/order-info?t='.rawurlencode($token);
 if(!is_array($packages)||!$packages)$packages=[['seq'=>1,'total'=>1,'package_text'=>'1/1','items_line'=>'','serial_count'=>0,'carton_code'=>'','source_label'=>'تجمیعی']];
 $pages='';
 foreach($packages as $p){
   if(empty($p['package_text'])) $p['package_text']=((int)($p['seq']??1)).'/'.((int)($p['total']??1));
   $pages.=gp_dispatch_single_sheet('بیجک ارسال مرسوله','چاپ بیجک ارسال',$orderNo,$orderDate,gp_dispatch_sections_html($o,$c,$sender,$p),gp_dispatch_left_panel($orderNo,$qrUrl,$p),$W,$H,$x,$y,$p);
 }
 header('Content-Type:text/html; charset=utf-8');
 echo '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>بیجک ارسال '.gp_h($orderNo).'</title><style>
 @page{size:'.$W.'mm '.$H.'mm;margin:0}
 *{box-sizing:border-box}
 @font-face{font-family:"B-Nazanin";src:local("B Nazanin"),local("B-NAZANIN"),local("BNazanin");}
 html,body{margin:0!important;padding:0!important;background:#fff;color:#0b1f3a;font-family:"B Nazanin","B-Nazanin","B-NAZANIN",Tahoma,Arial;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .toolbar{position:fixed;z-index:60;left:2mm;top:2mm}.toolbar button{background:#0b1f3a;color:#fff;border:0;border-radius:7px;padding:7px 12px;font-family:inherit}
 .dispatchSheet{position:relative;width:'.$W.'mm;height:'.$H.'mm;transform:translate('.$x.'mm,'.$y.'mm);transform-origin:top right;padding:2.8mm;background:#fff;overflow:hidden;break-after:page;page-break-after:always}
 .dispatchSheet:last-child{break-after:auto;page-break-after:auto}
 .header{height:17mm;background:linear-gradient(135deg,#0c2748,#133c6b 50%,#0a2240);color:#fff;border-radius:5mm;padding:2.6mm 4mm;display:grid;grid-template-columns:1.08fr .45mm 1fr;align-items:center;gap:3.2mm}
 .hLeft,.hRight{display:flex;align-items:center;justify-content:space-between;gap:3mm;min-width:0}.hLeft img,.hRight img{width:11.5mm;height:11.5mm;object-fit:contain;flex:0 0 auto}.divider{height:11mm;width:.45mm;background:rgba(255,255,255,.35);margin:auto}
 .btitle{min-width:0}.btitle .name{font-size:6.2mm;font-weight:900;line-height:1.02;white-space:nowrap}.btitle .phone{font-size:2.9mm;color:#dbe7f5;margin-top:.8mm;direction:ltr;text-align:right}
 .hRight>div{min-width:0}.hRight .ttl{font-size:6mm;font-weight:900;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hRight .sub{font-size:2.9mm;color:#dbe7f5;margin-top:.7mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .dispatchGrid{display:grid;grid-template-columns:34mm 1fr;gap:3mm;margin-top:3mm;height:calc('.$H.'mm - 23mm)}
 .leftCard,.rightCard{border:.45mm solid #d7e2ee;border-radius:4mm;background:#fff;overflow:hidden}
 .dispatchLeft{display:grid;grid-template-rows:auto auto auto auto;padding:2.2mm;gap:2mm;min-height:0}.qrWrap{border:.45mm solid #f58220;border-radius:3.2mm;padding:1.8mm;display:flex;align-items:center;justify-content:center;min-height:0}.qrRender .gp-local-qr{width:23mm;height:23mm;display:block}
 .sideMini{background:#eff5fb;border:.35mm solid #d8e3ef;border-radius:3mm;padding:1.4mm 2mm;text-align:center;font-size:3.2mm;font-weight:800;color:#16385f}
 .barcodeWrap{border:.35mm solid #dae4ef;border-radius:3.2mm;padding:1.8mm}.barcode{display:block;width:100%;height:9.8mm;fill:#000}.barcodeText{text-align:center;font:900 3.9mm/1.05 Arial,Helvetica,sans-serif;direction:ltr;margin-top:.6mm}.motto{border:.35mm solid #e3ebf3;background:#f5f8fc;border-radius:3.2mm;padding:2mm;line-height:1.75;color:#26426a;font-size:2.8mm;text-align:center}
 .dispatchCard{display:flex;flex-direction:column;padding:0;background:#fff}
 .dispatchOrderNo{background:linear-gradient(135deg,#0b2a4d,#143f71 55%,#0a2240);color:#fff;border:.45mm solid #ff8c17;border-radius:3.8mm;padding:2.4mm 3.5mm;margin-bottom:2mm}
 .dispatchOrderNo .topLine{display:flex;justify-content:space-between;align-items:center;gap:3mm}.dispatchOrderNo .lbl{font-size:4.1mm;font-weight:900;white-space:nowrap}.dispatchOrderNo .code{font:900 6.7mm/1 Consolas,monospace;color:#ff9f2e;direction:ltr}
 .dispatchOrderNo .metaRow{display:flex;justify-content:space-between;align-items:center;gap:6mm;margin-top:1.2mm;flex-wrap:wrap}.metaLine{font-size:3.1mm;color:#e8f0fb}.metaLine b{color:#fff;font-weight:900}
 .sections{display:grid;grid-template-columns:1fr;gap:1.8mm;min-height:0}
 .sectionCard{border:.35mm solid #d8e3ef;border-radius:3.4mm;background:#f8fbff;padding:1.6mm 2.2mm}.secHead{font-size:3.5mm;font-weight:900;color:#12365d;margin-bottom:1.2mm;text-align:right;border-right:1mm solid #ff8b14;padding-right:1.4mm}
 .secGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.2mm}
 .infoBox{background:#fff;border:.3mm solid #dfe7f0;border-radius:2.6mm;padding:1.1mm 1.6mm;min-height:10.5mm;display:flex;flex-direction:column;justify-content:center;text-align:right}
 .infoBox .iboxLabel{font-size:2.7mm;color:#5a7090;font-weight:800;line-height:1.2;margin-bottom:.4mm;text-align:right}.infoBox .iboxValue{font-size:3.4mm;font-weight:800;color:#10243f;line-height:1.45;text-align:right;word-break:break-word}.paid{color:#11a24b;font-weight:900}
 @media print{.toolbar{display:none!important}body{background:#fff}}
 </style></head><body><div class="toolbar"><button onclick="window.print()">چاپ بیجک‌ها</button></div>'.$pages.'<script src="/assets/qrcode-v5349.js"></script><script>(function(){document.querySelectorAll(".qrRender").forEach(function(e){if(window.GPQRCodeSvg)e.innerHTML=GPQRCodeSvg(e.dataset.value||"");});})();</script></body></html>';
}

function gp_order_left_panel($orderNo,$qrUrl){
 return '<div class="leftCard"><div class="qrWrap"><div id="orderQr" data-value="'.gp_h($qrUrl).'" class="qrRender"></div></div><div class="barcodeWrap">'.gp_code128_svg($orderNo).'<div class="barcodeText">'.gp_h($orderNo).'</div></div><div class="motto">اعتماد، شروع یک همکاری بلندمدت است.<br>قدیر پرداخت</div></div>';
}

function gp_order_print_shell($title,$button,$orderNo,$rowsHtml,$leftHtml,$w,$h,$x,$y){
 header('Content-Type:text/html; charset=utf-8');
 echo '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.gp_h($title).' '.gp_h($orderNo).'</title><style>
 @page{size:'.$w.'mm '.$h.'mm;margin:0}
 *{box-sizing:border-box}html,body{margin:0!important;padding:0!important;width:'.$w.'mm!important;height:'.$h.'mm!important;overflow:hidden!important;background:#fff;font-family:Tahoma,Arial;color:#0b1f3a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .toolbar{position:fixed;z-index:50;left:2mm;top:2mm}.toolbar button{background:#0b1f3a;color:#fff;border:0;border-radius:7px;padding:7px 12px;font-family:inherit}
 .sheet{position:absolute;top:0;right:0;width:'.$w.'mm;height:'.$h.'mm;transform:translate('.$x.'mm,'.$y.'mm);transform-origin:top right;padding:2.8mm;background:#fff;overflow:hidden}
 .header{height:17mm;background:linear-gradient(135deg,#0c2748,#133c6b 50%,#0a2240);color:#fff;border-radius:5mm;padding:2.6mm 4mm;display:grid;grid-template-columns:1.08fr .45mm 1fr;align-items:center;gap:3.2mm}
 .hLeft,.hRight{display:flex;align-items:center;justify-content:space-between;gap:3mm;min-width:0}.hLeft img,.hRight img{width:11.5mm;height:11.5mm;object-fit:contain;flex:0 0 auto}.divider{height:11mm;width:.45mm;background:rgba(255,255,255,.35);margin:auto}
 .btitle{min-width:0}.btitle .name{font-size:6.5mm;font-weight:900;line-height:1.02;white-space:nowrap}.btitle .phone{font-size:2.7mm;color:#dbe7f5;margin-top:1mm}
 .hRight>div{min-width:0}.hRight .ttl{font-size:6.3mm;font-weight:900;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hRight .sub{font-size:2.8mm;color:#dbe7f5;margin-top:.8mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .grid{display:grid;grid-template-columns:46mm 1fr;gap:3mm;margin-top:3mm;height:calc('.$h.'mm - 23mm)}
 .leftCard,.rightCard{border:.45mm solid #d7e2ee;border-radius:4mm;background:#fff;overflow:hidden}.leftCard{display:grid;grid-template-rows:1fr auto auto;padding:2.3mm;gap:2mm;min-height:0}.qrWrap{border:.45mm solid #f58220;border-radius:3.2mm;padding:2mm;display:flex;align-items:center;justify-content:center;min-height:0}.qrRender .gp-local-qr{width:25mm;height:25mm;display:block}
 .barcodeWrap{border:.35mm solid #dae4ef;border-radius:3.2mm;padding:1.8mm}.barcode{display:block;width:100%;height:9.8mm;fill:#000}.barcodeText{text-align:center;font:900 3.9mm/1.05 Arial,Helvetica,sans-serif;direction:ltr;margin-top:.6mm}.motto{border:.35mm solid #e3ebf3;background:#f5f8fc;border-radius:3.2mm;padding:2mm;line-height:1.6;color:#26426a;font-size:2.9mm;text-align:center}
 .rightCard{padding:0;display:flex;flex-direction:column}.orderNo{background:linear-gradient(135deg,#0b2a4d,#143f71 55%,#0a2240);color:#ff9f2e;border:.45mm solid #ff8c17;border-radius:3.8mm;margin:0 0 2.2mm 0;padding:2.2mm 3.5mm;display:grid;grid-template-columns:1fr auto;align-items:center;gap:2mm}.orderNo .code{font:900 7mm/1 Consolas,monospace;direction:ltr}.orderNo .lbl{color:#fff;font-size:4.1mm;font-weight:900;white-space:nowrap}
 .rows{display:grid;gap:1.6mm;flex:1}.row{min-height:6.7mm;border:.35mm solid #d8e3ef;border-radius:3.2mm;background:#f8fbff;padding:1.2mm 3.2mm;display:grid;grid-template-columns:1fr auto;align-items:center;gap:2mm}.value{font-size:3.5mm;font-weight:700;color:#122546;line-height:1.45;overflow:hidden}.label{display:flex;flex-direction:row-reverse;align-items:center;gap:1.8mm;color:#27426a;font-size:3.45mm;font-weight:800;white-space:nowrap}.label span{white-space:nowrap}
 .label i{display:inline-flex;align-items:center;justify-content:center;width:5.2mm;height:5.2mm;border-radius:1.5mm;background:#fff3e8;color:#ff7e00;font-style:normal;font-size:3.1mm;border:.22mm solid #ffd4ac;flex:0 0 auto}
 .paid{color:#11a24b;font-weight:900}
 .icon-doc::before{content:"📋"}.icon-user::before{content:"👤"}.icon-phone::before{content:"📞"}.icon-pin::before{content:"📍"}.icon-send::before{content:"🏢"}.icon-box::before{content:"📦"}.icon-layers::before{content:"🧱"}.icon-truck::before{content:"🚚"}.icon-pay::before{content:"💳"}.icon-cal::before{content:"📅"}
 @media print{.toolbar{display:none!important}}
 </style></head><body><div class="toolbar"><button onclick="window.print()">'.gp_h($button).'</button></div><main class="sheet"><div class="header"><div class="hLeft"><img src="/brand-v5311.png" alt="قدیر پرداخت">'.gp_brand_title_block().'</div><div class="divider"></div><div class="hRight"><div><div class="ttl">'.gp_h($title).'</div><div class="sub">از مدیریت امروز، به رشد فردا</div></div><img src="/brand-v5311.png" alt="مرسوله"></div></div><div class="grid">'.$leftHtml.'<div class="rightCard"><div class="orderNo"><div class="code">'.gp_h($orderNo).'</div><div class="lbl">شماره سفارش:</div></div><div class="rows">'.$rowsHtml.'</div></div></div></main><script src="/assets/qrcode-v5349.js"></script><script>(function(){document.querySelectorAll(".qrRender").forEach(function(e){if(window.GPQRCodeSvg)e.innerHTML=GPQRCodeSvg(e.dataset.value||"");});})();</script></body></html>';
}

function gp_print_order_shipping_label($o,$c,$sender,$profile){
 $W=max((float)$profile['w'],(float)$profile['h']); $H=min((float)$profile['w'],(float)$profile['h']);
 $x=(float)($profile['x']??0); $y=(float)($profile['y']??0);
 $orderNo=(string)($o['number']??'');
 $host=(string)($_SERVER['HTTP_HOST']??'ghadirpartner.ir');
 $scheme=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')?'https':'https';
 $qrUrl=$scheme.'://'.$host.'/?tab=orders&open_order='.(int)($o['id']??0);
 gp_order_print_shell('لیبل ارسال مرسوله','چاپ لیبل ارسال',$orderNo,gp_order_rows_html($o,$c,$sender),gp_order_left_panel($orderNo,$qrUrl),$W,$H,$x,$y);
}

function gp_print_order_dispatch_slip($o,$c,$sender,$profile){
 gp_print_order_dispatch_slips($o,$c,$sender,$profile,[['seq'=>1,'total'=>1,'package_text'=>'1/1','items_line'=>'','serial_count'=>0,'carton_code'=>'','source_label'=>'تجمیعی']]);
}

function gp_carton_ticket_html($c){
 $code=(string)($c['code']??'');$product=(string)($c['product']??'');$color=trim((string)($c['color']??''));
 $count=count($c['_serials']??[]);$cap=(int)($c['capacity']??0);
 $host=(string)($_SERVER['HTTP_HOST']??'ghadirpartner.ir');
 $scheme=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')?'https':'https';
 $qrValue=gp_company_contact_qr();
 $payload=$code;
 return '<article class="ticket"><div class="t-head"><img src="/brand-v5311.png" alt=""><div><b>قدیر پرداخت</b><div class="subp">09128151868</div><div class="code">'.gp_h($code).'</div></div></div><div class="product">'.gp_h($product).'</div><div class="meta"><span>تعداد: <b>'.$count.'</b>'.($cap?' / '.$cap:'').'</span>'.($color!==''?'<span>رنگ: <b>'.gp_h($color).'</b></span>':'').'</div><div class="qr-mini"><div class="qrRender" data-value="'.gp_h($qrValue).'"></div></div>'.gp_code128_svg($payload).'<div class="scantext">اسکن QR = اطلاعات تماس قدیر پرداخت | اسکن بارکد = بازیابی باکس در مخزن</div></article>';
}

function gp_print_carton_labels_three_up($cartons,$profile){
 $w=$profile['w'];$h=$profile['h'];$x=$profile['x'];$y=$profile['y'];
 $chunks=array_chunk(array_values($cartons),3);$pages='';
 foreach($chunks as $chunk){
   $tickets='';foreach($chunk as $c)$tickets.=gp_carton_ticket_html($c);
   while(count($chunk)<3){$tickets.='<article class="ticket empty"></article>'; $chunk[]=[];}
   $pages.='<section class="physical">'.$tickets.'</section>';
 }
 header('Content-Type:text/html; charset=utf-8');
 echo '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>لیبل مخزن — سه باکس در هر لیبل</title><style>
 @page{size:'.$w.'mm '.$h.'mm;margin:0}
 *{box-sizing:border-box}html,body{margin:0;padding:0;background:#eef2f7;font-family:Tahoma,Arial;color:#0b1f3a}
 .toolbar{position:sticky;top:0;z-index:50;padding:10px;text-align:center;background:#eef2f7}.toolbar button{background:#0b1f3a;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-family:inherit}
 .physical{width:'.$w.'mm;height:'.$h.'mm;background:#fff;display:grid;grid-template-rows:repeat(3,1fr);margin:0;break-after:page;page-break-after:always;transform:translate('.$x.'mm,'.$y.'mm);transform-origin:top right;overflow:hidden}
 .physical:last-child{break-after:auto;page-break-after:auto}.ticket{position:relative;padding:3.4mm 4.5mm;border-bottom:.35mm dashed #8594a6;overflow:hidden}.ticket:last-child{border-bottom:0}.ticket.empty{background:#fff}
 .t-head{display:flex;justify-content:space-between;align-items:center;gap:3mm}.t-head img{width:10mm;height:10mm;object-fit:contain}.t-head b{font-size:11px}.subp{font-size:7px;color:#5a6d85}.code{direction:ltr;font:900 12px Consolas,monospace;color:#0b1f3a}.product{font-size:12px;font-weight:900;margin:1.3mm 0 1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{display:flex;gap:7mm;font-size:8.5px;color:#53647b}.qr-mini{display:flex;justify-content:center;align-items:center;margin:1.4mm 0 1.1mm}.qr-mini .gp-local-qr{width:15mm;height:15mm;display:block}.barcode{display:block;width:100%;height:11.5mm;fill:#000;margin-top:1mm}.scantext{text-align:center;font-size:7px;color:#53647b;margin-top:.8mm}
 @media print{body{background:#fff}.toolbar{display:none!important}.physical{margin:0}}
 </style></head><body><div class="toolbar"><button onclick="window.print()">چاپ پشت سر هم — ۳ باکس در هر لیبل</button></div>'.$pages.'<script src="/assets/qrcode-v5349.js"></script><script>(function(){document.querySelectorAll(".qrRender").forEach(function(e){if(window.GPQRCodeSvg)e.innerHTML=GPQRCodeSvg(e.dataset.value||"");});})();</script></body></html>';
}
?>

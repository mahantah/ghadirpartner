<?php
function gp_native_price_label($key){return ['panel_cash'=>'ثبت در پنل — نقد','panel_7d'=>'ثبت در پنل — هفت‌روزه','panel_1m'=>'ثبت در پنل — یک‌ماهه','serial_1_50'=>'سریال آزاد ۱ تا ۵۰','serial_51_200'=>'سریال آزاد ۵۱ تا ۲۰۰','sales_agent'=>'عامل فروش'][$key]??'';}
if($p==='/api/customer-order/cancel-request'&&$m==='POST'){
 $u=auth(['customer']);$x=input();$reason=trim((string)($x['reason']??''));if($reason===''||strlen($reason)>600)fail('علت درخواست الزامی است');
 out(db(true,function(&$s)use($u,$x,$reason){$i=idx($s['orders'],$x['id']??0);if($i<0||(int)($s['orders'][$i]['customer_id']??0)!==(int)($u['customer_id']??0))fail('سفارش پیدا نشد',404);$o=&$s['orders'][$i];if(in_array($o['status']??'',['ارسال شد','تحویل شد','لغو شد'],true))fail('در این مرحله درخواست لغو مجاز نیست',409);$note=substr(trim((string)($x['note']??'')),0,2000);$o['cancel_request']=['status'=>'pending','reason'=>$reason,'note'=>$note,'created_at'=>now()];hist($o,$u['username'],'درخواست لغو مشتری: '.$reason.' '.$note);$o['notes']=($o['notes']??'')."\nدرخواست لغو: ".$reason.' '.$note;return ['ok'=>true];}));
}

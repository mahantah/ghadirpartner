<?php
function gp_order_window($instant=null){
 $now=$instant ?: new DateTimeImmutable('now',new DateTimeZone('Asia/Tehran'));
 $now=$now->setTimezone(new DateTimeZone('Asia/Tehran'));
 $hour=(int)$now->format('H');return $hour>=9&&$hour<18;
}
function gp_order_window_message(){
 $now=new DateTimeImmutable('now',new DateTimeZone('Asia/Tehran'));
 return (int)$now->format('H')<9 ? 'ثبت سفارش از ساعت ۹ تا ۱۸ به وقت تهران فعال است؛ امروز ساعت ۹ مراجعه کنید.' : 'زمان ثبت سفارش پایان یافته است؛ فردا از ساعت ۹ سفارش خود را ثبت کنید.';
}
function gp_address_snapshot($c,$id){
 if($id==='')return ['id'=>'','title'=>'آدرس اصلی','province'=>$c['province']??'','city'=>$c['city']??'','address'=>$c['address']??'','postal_code'=>$c['postal_code']??''];
 foreach($c['delivery_addresses']??[] as $a)if(($a['id']??'')===$id)return $a;
 fail('آدرس انتخاب‌شده متعلق به حساب شما نیست یا حذف شده است',422);
}
function gp_customer_visible_order($o){
 if(($o['status']??'')!=='تحویل شد'){
  foreach(['items','exit_items'] as $k)if(isset($o[$k]))foreach($o[$k] as &$it){unset($it['serials'],$it['imei'],$it['imeis']);}unset($it);
 }
 return $o;
}
if($p==='/api/addresses'){
 $u=auth(['customer']);$cid=(int)($u['customer_id']??0);if($cid<1)fail('حساب مشتری لازم است',403);
 if($m==='GET')out(db(false,function($s)use($cid){$ci=idx($s['customers'],$cid);if($ci<0)fail('مشتری پیدا نشد',404);return array_values($s['customers'][$ci]['delivery_addresses']??[]);}));
 if($m!=='POST')fail('روش درخواست نامعتبر است',405);
 $x=input();out(db(true,function(&$s)use($cid,$x){
  $ci=idx($s['customers'],$cid);if($ci<0)fail('مشتری پیدا نشد',404);
  $rows=$s['customers'][$ci]['delivery_addresses']??[];
  if(isset($x['delete_id'])){$rows=array_values(array_filter($rows,fn($a)=>($a['id']??'')!==(string)$x['delete_id']));}
  else {
   $a=[];foreach(['title'=>60,'province'=>80,'city'=>80,'address'=>1000,'postal_code'=>10] as $k=>$max){$a[$k]=trim((string)($x[$k]??''));if(strlen($a[$k])>$max*4)fail('طول اطلاعات آدرس بیش از حد مجاز است',422);if($k!=='postal_code'&&$a[$k]==='')fail('عنوان، استان، شهر و آدرس الزامی است',422);}
   if($a['postal_code']!==''&&!preg_match('/^[0-9۰-۹]{10}$/u',$a['postal_code']))fail('کدپستی باید ده رقم باشد',422);
   $id=trim((string)($x['id']??''));$found=false;
   foreach($rows as &$row)if(($row['id']??'')===$id&&$id!==''){$a['id']=$id;$row=$a;$found=true;}unset($row);
   if($id!==''&&!$found)fail('آدرس پیدا نشد',404);
   if(!$found){if(count($rows)>=20)fail('حداکثر ۲۰ آدرس مجاز است',422);$a['id']=bin2hex(random_bytes(12));$rows[]=$a;}
  }
  $s['customers'][$ci]['delivery_addresses']=$rows;return array_values($rows);
 }));
}
if($p==='/api/purchased-devices'){
 $u=auth(['customer']);$cid=(int)($u['customer_id']??0);if($cid<1)fail('حساب مشتری لازم است',403);
 out(db(false,function($s)use($cid){$qty=0;$devices=[];foreach($s['products']??[] as $p)if(!empty($p['serial_required']))$devices[$p['name']]=true;
 foreach($s['orders']??[] as $o)if((int)($o['customer_id']??0)===$cid&&($o['status']??'')==='تحویل شد')foreach($o['items']??[] as $it)if(isset($devices[$it['product']??'']))$qty+=max(0,(int)($it['qty']??0));return ['qty'=>$qty,'basis'=>'delivered_serial_required_products'];}));
}

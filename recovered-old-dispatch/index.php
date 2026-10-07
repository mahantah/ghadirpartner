<?php
declare(strict_types=1);
$cfg=require __DIR__.'/config.php';date_default_timezone_set($cfg['timezone']??'Asia/Tehran');
header('X-Content-Type-Options: nosniff');header('X-Frame-Options: DENY');header('Referrer-Policy: strict-origin-when-cross-origin');header('Permissions-Policy: camera=(self), microphone=(), geolocation=()');header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
ini_set('session.use_strict_mode','1');ini_set('session.cookie_httponly','1');ini_set('session.cookie_samesite','Lax');if(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')ini_set('session.cookie_secure','1');
session_name('ghadir_session');session_start();if(!empty($_SESSION['last_seen'])&&time()-$_SESSION['last_seen']>1800){session_unset();session_destroy();session_start();}$_SESSION['last_seen']=time();if(in_array($_SERVER['REQUEST_METHOD']??'GET',['POST','PUT','PATCH','DELETE'])){$origin=$_SERVER['HTTP_ORIGIN']??$_SERVER['HTTP_REFERER']??'';if($origin!==''&&strcasecmp((string)parse_url($origin,PHP_URL_HOST),(string)($_SERVER['HTTP_HOST']??''))!==0){http_response_code(403);exit('مبدأ درخواست مجاز نیست');}}
$dir=$cfg['storage'];if(!is_dir($dir))@mkdir($dir,0750,true);$file=$dir.'/ghadir_data.json';$backups=$dir.'/Backups';if(!is_dir($backups))@mkdir($backups,0750,true);
function default_products(){return [
['name'=>'دستگاه كارتخوان I90','pattern'=>'^R9[0-9]{11}$','example'=>'R900000000000','serial_required'=>true],['name'=>'دستگاه كارتخوان I80','pattern'=>'^R8[0-9]{11}$','example'=>'R800000000000','serial_required'=>true],['name'=>'دستگاه كارتخوان AF-75','pattern'=>'^05HEC[0-9]{6}$','example'=>'05HEC000000','serial_required'=>true],
['name'=>'رول حرارتي 12 متري','pattern'=>'','example'=>'','serial_required'=>false],['name'=>'رول حرارتي 14 متري','pattern'=>'','example'=>'','serial_required'=>false],['name'=>'رول حرارتي 16 متري','pattern'=>'','example'=>'','serial_required'=>false],
['name'=>'h9 معمولي','pattern'=>'^P025[0-9]{6}$','example'=>'P025000000','serial_required'=>true],['name'=>'TRENDIT- T3 2G','pattern'=>'^T33[0-9]{11}$','example'=>'T3300000000000','serial_required'=>true],['name'=>'TRENDIT- T3 4G ECONOMY','pattern'=>'^T33[0-9]{11}$','example'=>'T3300000000000','serial_required'=>true],
['name'=>'MOREFUN - H9 PRO','pattern'=>'^P125[0-9]{6}$','example'=>'P125000000','serial_required'=>true],['name'=>'MOREFUN - MF919','pattern'=>'^P[0-9]{9}$','example'=>'P000000000','serial_required'=>true],['name'=>'PAX - Q60','pattern'=>'^213[0-9]{7}$','example'=>'2130000000','serial_required'=>true],
['name'=>'AISINO - V72','pattern'=>'^0003[0-9]{7}$','example'=>'00030000000','serial_required'=>true],['name'=>'TOPWISE - M3P','pattern'=>'^S281[0-9]{13}$','example'=>'S2810000000000000','serial_required'=>true],['name'=>'TRENDIT T3 4G- سخن گو','pattern'=>'^T306[0-9]{10}$','example'=>'T3060000000000','serial_required'=>true],
['name'=>'دستگاه كارتخوان AF-75 - پلاس','pattern'=>'^05HEC[0-9]{6}$','example'=>'05HEC000000','serial_required'=>true],['name'=>'Z-990','pattern'=>'^314[0-9]{13}$','example'=>'3140000000000000','serial_required'=>true],['name'=>'AISINO - V77','pattern'=>'^[0-9]{11}$','example'=>'00000000000','serial_required'=>true],
['name'=>'دستگاه كارتخوان AF-70 - پلاس','pattern'=>'^00HEC[0-9]{6}$','example'=>'00HEC000000','serial_required'=>true],['name'=>'TOPWISE - M3P- 4G','pattern'=>'^S281[0-9]{13}$','example'=>'S2810000000000000','serial_required'=>true],['name'=>'دستگاه كارتخوان AF-70','pattern'=>'^00HEC[0-9]{6}$','example'=>'00HEC000000','serial_required'=>true],
['name'=>'دستگاه كش لس D600','pattern'=>'^TD600[0-9]{6}$','example'=>'TD600027074','serial_required'=>true],['name'=>'كيف دستگاه كارتخوان معمولي','pattern'=>'','example'=>'','serial_required'=>false],['name'=>'كيف دستگاه كارتخوان شطرنجي','pattern'=>'','example'=>'','serial_required'=>false]];}
function init_state(){return ['users'=>[['id'=>1,'username'=>'admin','password_hash'=>password_hash('123456',PASSWORD_DEFAULT),'roles'=>['admin','sales','finance','prep'],'active'=>true]],'customers'=>[],'orders'=>[],'inventory'=>[],'cartons'=>[],'notifications'=>[],'products'=>default_products(),'next_customer'=>1,'next_order'=>1,'next_user'=>2,'next_serial'=>1,'next_carton'=>1,'next_notification'=>1,'settings'=>['sender_name'=>'قدیر پرداخت','sender_mobile'=>'','sender_address'=>'']];}
require_once __DIR__.'/lib/storage.php';
function db($write,$fn){return ghadir_db((bool)$write,$fn);}
function input(){return json_decode(file_get_contents('php://input'),true)?:[];} function now(){return date('Y-m-d H:i:s');}
function out($v,$c=200){http_response_code($c);header('Content-Type:application/json; charset=utf-8');echo json_encode($v,JSON_UNESCAPED_UNICODE);exit;}
function fail($m,$c=400){http_response_code($c);header('Content-Type:text/plain; charset=utf-8');echo $m;exit;}
function idx($a,$id){foreach($a as $i=>$x)if((int)($x['id']??0)===(int)$id)return $i;return -1;}
function gp_print_defaults(){return [
'print_printer'=>'TSC TTP-244 Pro','print_dpi'=>203,
'print_profiles_v5349'=>true,
'print_label_w'=>93.98,'print_label_h'=>191.77,'print_label_gap'=>3,'print_label_x'=>0,'print_label_y'=>0,'print_label_layout'=>'portrait',
'print_warehouse_batch_mode'=>'continuous','print_order_mode'=>'label',
'print_order_w'=>93.98,'print_order_h'=>191.77,'print_order_gap'=>3,'print_order_x'=>0,'print_order_y'=>0
];}
function gp_num($v,$d,$min,$max){$n=is_numeric($v)?(float)$v:(float)$d;return max((float)$min,min((float)$max,$n));}
function gp_customer_address($c){return implode(' - ',array_filter([$c['province']??'',$c['city']??'',$c['address']??''],fn($v)=>trim((string)$v)!==''));}
function gp_effective_sender($s,$o){
 $ci=idx($s['customers']??[],$o['customer_id']??0);$c=$ci<0?[]:$s['customers'][$ci];$pid=(int)($c['parent_marketer_id']??0);
 if($pid>0){
   $mi=idx($s['customers']??[],$pid);
   if($mi>=0){
     $m=$s['customers'][$mi];
     $name=trim((string)($m['name']??''));$company=trim((string)($m['company']??''));
     if($company!=='')$name.=$name!==''?' | '.$company:$company;
     return ['sender_name'=>$name?:'بازاریاب','sender_mobile'=>$m['mobile']??'','sender_address'=>gp_customer_address($m),'sender_marketer_id'=>(int)($m['id']??0),'sender_source'=>'marketer'];
   }
 }
 $set=array_merge(gp_print_defaults(),$s['settings']??[]);
 return ['sender_name'=>$o['sender_name']??$set['sender_name']??'قدیر پرداخت','sender_mobile'=>$o['sender_mobile']??$set['sender_mobile']??'','sender_address'=>$o['sender_address']??$set['sender_address']??'','sender_marketer_id'=>0,'sender_source'=>'default'];
}
function gp_product_requires_serial($s,$name){
 foreach($s['products']??[] as $p)if(($p['name']??'')===$name)return !empty($p['serial_required']);
 return false;
}
function gp_exit_items($s,$o){
 $out=[];
 foreach($o['items']??[] as $it){
   $name=(string)($it['product']??'');
   if($name===''||!gp_product_requires_serial($s,$name))continue;
   $serials=array_values(array_unique(array_filter(array_map(fn($v)=>trim((string)$v),$it['serials']??[]),fn($v)=>$v!=='')));
   if(!$serials)continue;
   $out[]=['product'=>$name,'qty'=>count($serials),'serials'=>$serials];
 }
 return $out;
}
function gp_exit_device_qty($items){$n=0;foreach($items??[] as $it)$n+=(int)($it['qty']??0);return $n;}
function gp_decorate_order($s,$o){
 $o=array_merge($o,gp_effective_sender($s,$o));
 if(in_array($o['status']??'',['ارسال شد','تحویل شد'],true)){
   $items=(isset($o['exit_items'])&&is_array($o['exit_items']))?$o['exit_items']:gp_exit_items($s,$o);
   $o['exit_items']=$items;
   $o['exit_device_qty']=gp_exit_device_qty($items);
 }
 return $o;
}
function gp_profile_key_for_product($product){
 $p=(string)$product;
 if(strpos($p,'رول')!==false||stripos($p,'roll')!==false){
   if(preg_match('/(^|[^0-9])12([^0-9]|$)/u',$p))return 'roll12';
   if(preg_match('/(^|[^0-9])14([^0-9]|$)/u',$p))return 'roll14';
   if(preg_match('/(^|[^0-9])16([^0-9]|$)/u',$p))return 'roll16';
 }
 return 'box';
}
require_once __DIR__.'/lib/labels-v5348.php';
function gp_print_profile($settings,$key){
 $x=array_merge(gp_print_defaults(),$settings??[]);
 // V5.3.4.9 uses one physical label for both order and warehouse.
 $legacy=empty($x['print_profiles_v5349']);
 return ['w'=>$legacy?93.98:gp_num($x['print_label_w']??93.98,93.98,25,108),
 'h'=>$legacy?191.77:gp_num($x['print_label_h']??191.77,191.77,20,300),
 'gap'=>gp_num($x['print_label_gap']??3,3,0,15),
 'x'=>gp_num($x['print_label_x']??0,0,-10,10),
 'y'=>gp_num($x['print_label_y']??0,0,-10,10),
 'layout'=>'portrait','key'=>$key];
}

function auth($roles=[]){if(empty($_SESSION['uid']))fail('ورود الزامی است',401);$u=db(false,function($s){foreach($s['users'] as $u)if($u['id']==$_SESSION['uid']&&!empty($u['active']))return $u;return null;});if(!$u)fail('نشست نامعتبر است',401);if($roles&&!in_array('admin',$u['roles']??[])&&!array_intersect($roles,$u['roles']??[]))fail('دسترسی ندارید',403);return $u;}
function hist(&$o,$by,$a){$o['history'][]=['at'=>now(),'by'=>$by,'action'=>$a];}
function clean_mobile($v){$v=preg_replace('/\D+/','',(string)$v);if(strpos($v,'98')===0&&strlen($v)===12)$v='0'.substr($v,2);return $v;}
function cut_text($v,$max){$v=(string)$v;$max=max(0,(int)$max);if(function_exists('mb_substr'))return mb_substr($v,0,$max,'UTF-8');return strlen($v)>$max?substr($v,0,$max):$v;}
function text_lower($v){$v=(string)$v;return function_exists('mb_strtolower')?mb_strtolower($v,'UTF-8'):strtolower($v);}
function text_pos($haystack,$needle){return function_exists('mb_strpos')?mb_strpos((string)$haystack,(string)$needle,0,'UTF-8'):strpos((string)$haystack,(string)$needle);}
function staff_role_names(){return ['admin','sales','finance','prep','viewer'];}
function user_has_staff_role($u){return (bool)array_intersect(staff_role_names(),$u['roles']??[]);}
function is_customer_user($u){return in_array('customer',$u['roles']??[],true)||((int)($u['customer_id']??0)>0&&!user_has_staff_role($u));}
function normalized_user_roles($u){$roles=array_values(array_unique($u['roles']??[]));if(is_customer_user($u)&&!in_array('customer',$roles,true))$roles[]='customer';return $roles;}
function normalize_state_users(&$s){if(!isset($s['users'])||!is_array($s['users']))$s['users']=[];foreach($s['users'] as &$u){if(!isset($u['roles'])||!is_array($u['roles']))$u['roles']=[];$u['roles']=normalized_user_roles($u);}unset($u);}
function user_mobile_keys($s,$u){$keys=[];foreach([$u['username']??'',$u['mobile']??'',$u['login_mobile']??'',$u['alternate_mobile']??''] as $v){$m=clean_mobile($v);if(preg_match('/^09\d{9}$/',$m))$keys[$m]=true;}if((int)($u['customer_id']??0)>0){$ci=idx($s['customers']??[],(int)$u['customer_id']);if($ci>=0){$m=clean_mobile($s['customers'][$ci]['mobile']??'');if(preg_match('/^09\d{9}$/',$m))$keys[$m]=true;}}return array_keys($keys);}
function mobile_identity_in_use($s,$mobile,$excludeUserId=0){$mobile=clean_mobile($mobile);if(!preg_match('/^09\d{9}$/',$mobile))return false;foreach($s['users']??[] as $u){if((int)($u['id']??0)===(int)$excludeUserId)continue;if(in_array($mobile,user_mobile_keys($s,$u),true))return true;}return false;}
function customer_login_score($s,$u,$mobile){$score=0;if(in_array('customer',$u['roles']??[],true))$score+=100;if((int)($u['customer_id']??0)>0)$score+=50;if(clean_mobile($u['login_mobile']??'')===$mobile)$score+=20;if(clean_mobile($u['username']??'')===$mobile)$score+=10;return $score*100000+(int)($u['id']??0);}
function carton_serials_from_state($s,$c){$map=[];foreach($c['serials']??[] as $sn){$sn=trim((string)$sn);if($sn!=='')$map[strtoupper($sn)]=$sn;}foreach($s['inventory']??[] as $iv)if((int)($iv['carton_id']??0)===(int)($c['id']??0)||(($iv['carton_code']??'')!==''&&($iv['carton_code']??'')===($c['code']??''))){$sn=trim((string)($iv['serial']??''));if($sn!=='')$map[strtoupper($sn)]=$sn;}return array_values($map);}
function homa_response_meta($resp,$http){
    $body=trim((string)$resp);$json=json_decode($body,true);$resultCode='';$explicitError=false;$success=false;$requestId='';$errorCode='';$errorMessage='';$errorDetails=[];
    if(is_array($json)){
        foreach(['id','messageId','message_id','result','code','statusCode','trackingCode'] as $k)if(isset($json[$k])&&is_scalar($json[$k])){$resultCode=(string)$json[$k];break;}
        $requestId=(string)($json['requestId']??$json['request_id']??'');
        if(isset($json['error'])&&is_array($json['error'])){
            $errorCode=(string)($json['error']['code']??$json['errorCode']??'');
            $errorMessage=(string)($json['error']['message']??$json['message']??'');
            $errorDetails=is_array($json['error']['details']??null)?$json['error']['details']:[];
        }else{
            $errorCode=(string)($json['errorCode']??'');
            $errorMessage=(string)($json['message']??'');
        }
        if($resultCode===''&&$errorCode!=='')$resultCode=$errorCode;
        $status=strtolower((string)($json['status']??''));
        $explicitError=($status==='error'||$status==='failed'||!empty($json['error'])||!empty($json['errorCode'])||$errorCode!=='');
        $success=!$explicitError&&(!empty($json['success'])||!empty($json['isSuccess'])||in_array($status,['ok','success','sent','true'],true));
        if(!$success){foreach(['id','messageId','message_id','result'] as $k)if(isset($json[$k])&&is_numeric($json[$k])&&(float)$json[$k]>1000){$success=true;break;}}
    }
    if($body!==''&&!$explicitError){
        if(preg_match('/(^|\\b)(error|failed|invalid|unauthorized|forbidden|missing_credentials)(\\b|:)/i',$body)||preg_match('/ناموفق|خطا|نامعتبر|مجاز نیست|عدم دسترسی/u',$body))$explicitError=true;
        if(preg_match('/^-?\\d+(?:\\.\\d+)?$/',$body)){if($resultCode==='')$resultCode=$body;if((float)$body>1000)$success=true;}
        if(in_array(strtolower($body),['ok','success','sent','true'],true))$success=true;
    }
    $ok=$resp!==false&&$http>=200&&$http<300&&!$explicitError&&$success;
    return ['ok'=>$ok,'body'=>$body,'json'=>$json,'result_code'=>$resultCode,'explicit_error'=>$explicitError,'request_id'=>$requestId,'error_code'=>$errorCode,'error_message'=>$errorMessage,'error_details'=>$errorDetails];
}
function homa_token_send($endpoint,$token,$recipient,$message){
    $endpoint=trim((string)$endpoint);$token=trim((string)$token);
    $attempts=[
        ['label'=>'bearer','headers'=>['Authorization: Bearer '.$token]],
        ['label'=>'x-api-token','headers'=>['X-API-Token: '.$token]],
        ['label'=>'authorization-token','headers'=>['Authorization: '.$token]],
    ];
    $last=['resp'=>false,'http'=>0,'err'=>'','meta'=>['ok'=>false,'body'=>'','result_code'=>''],'auth'=>''];
    foreach($attempts as $a){
        $ch=curl_init($endpoint);
        curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15,CURLOPT_CONNECTTIMEOUT=>6,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_HTTPHEADER=>array_merge(['Accept: application/json','Content-Type: application/json;charset=UTF-8'],$a['headers']),CURLOPT_POSTFIELDS=>json_encode(['recipient'=>$recipient,'message'=>$message],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
        $resp=curl_exec($ch);$http=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$err=curl_error($ch);curl_close($ch);
        $meta=homa_response_meta($resp,$http);$last=['resp'=>$resp,'http'=>$http,'err'=>$err,'meta'=>$meta,'auth'=>$a['label']];
        if($meta['ok'])return $last;
        $body=strtolower((string)($meta['body']??''));
        $authFailure=in_array($http,[401,403],true)||strpos($body,'missing_credentials')!==false||strpos($body,'unauthorized')!==false||strpos($body,'token')!==false&&strpos($body,'invalid')!==false;
        if(!$authFailure)break; /* برای جلوگیری از ارسال تکراری در پاسخ‌های مبهم */
    }
    return $last;
}
function homa_legacy_send($endpoint,$username,$password,$portal,$server,$mobile,$message){
    $requestEndpoint=rtrim((string)$endpoint,'/?').'/';
    $url=$requestEndpoint.'?'.http_build_query(['username'=>$username,'password'=>$password,'PortalCode'=>$portal,'mobile'=>$mobile,'message'=>$message,'ServerType'=>$server!==''?$server:'100'],'','&',PHP_QUERY_RFC3986);
    $ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_HTTPGET=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15,CURLOPT_CONNECTTIMEOUT=>6,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_HTTPHEADER=>['Accept: application/json, text/plain, */*']]);
    $resp=curl_exec($ch);$http=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$err=curl_error($ch);curl_close($ch);
    return ['resp'=>$resp,'http'=>$http,'err'=>$err,'meta'=>homa_response_meta($resp,$http),'auth'=>'legacy'];
}
function sms_template_definitions(){return [
    'otp'=>['category'=>'امنیت و ورود','label'=>'کد بازیابی رمز پرتال مشتری','enabled'=>true,'text'=>'کد بازیابی رمز قدیر پارتنر: {otp} — اعتبار ۵ دقیقه'],
    'staff_otp'=>['category'=>'امنیت و ورود','label'=>'کد بازیابی رمز اتوماسیون','enabled'=>true,'text'=>'کد بازیابی رمز اتوماسیون قدیر پارتنر: {otp} — اعتبار ۵ دقیقه'],
    'order_created'=>['category'=>'سفارش','label'=>'ثبت سفارش مشتری','enabled'=>true,'text'=>'سفارش {order_number} ثبت شد و در انتظار بررسی است.'],
    'order_approved'=>['category'=>'سفارش','label'=>'تأیید سفارش','enabled'=>true,'text'=>'سفارش {order_number} تأیید شد. مبلغ قابل پرداخت: {amount} تومان'],
    'status_registered'=>['category'=>'وضعیت سفارش','label'=>'ثبت شده','enabled'=>true,'text'=>'وضعیت سفارش {order_number} به «ثبت شده» تغییر کرد.'],
    'status_prep'=>['category'=>'وضعیت سفارش','label'=>'در حال آماده سازی','enabled'=>true,'text'=>'سفارش {order_number} در حال آماده سازی است.'],
    'ready'=>['category'=>'وضعیت سفارش','label'=>'آماده ارسال','enabled'=>true,'text'=>'سفارش {order_number} آماده ارسال است.'],
    'shipped'=>['category'=>'وضعیت سفارش','label'=>'ارسال شد','enabled'=>true,'text'=>'سفارش {order_number} از طریق {carrier} ارسال شد.{tracking_suffix}'],
    'delivered'=>['category'=>'وضعیت سفارش','label'=>'تحویل شد','enabled'=>true,'text'=>'سفارش {order_number} تحویل شد. از خرید شما سپاسگزاریم.'],
    'status_cancelled'=>['category'=>'وضعیت سفارش','label'=>'لغو سفارش','enabled'=>true,'text'=>'سفارش {order_number} لغو شد.{cancel_suffix}'],
    'tracking'=>['category'=>'ارسال و رهگیری','label'=>'ثبت / تغییر کد مرسوله','enabled'=>true,'text'=>'کد مرسوله سفارش {order_number} برای {carrier}: {tracking_code}'],
    'payment_success'=>['category'=>'پرداخت','label'=>'ثبت موفق پرداخت','enabled'=>true,'text'=>'پرداخت سفارش {order_number} با موفقیت ثبت شد.'],
    'offer_published'=>['category'=>'طرح‌ها و آفرها','label'=>'اعلام طرح / کد تخفیف به مشتری','enabled'=>true,'text'=>'{offer_title} — {discount}. کد تخفیف: {promo_code}{offer_product_suffix}{offer_end_suffix}'],
    'admin_order_created'=>['category'=>'اعلان‌های مدیریت','label'=>'اعلام سفارش جدید به مدیریت','enabled'=>true,'text'=>'سفارش جدید {order_number} از {customer_name} — {items_count} قلم — مبلغ تقریبی {amount} تومان — روش پرداخت: {payment_method}'],
    'test'=>['category'=>'سیستم','label'=>'پیام آزمایشی','enabled'=>true,'text'=>'پیام آزمایشی سامانه قدیر پارتنر'],
];}
function sms_template_config_from_state($s,$kind){$defs=sms_template_definitions();$base=$defs[$kind]??['category'=>'سایر','label'=>$kind,'enabled'=>true,'text'=>''];$saved=$s['settings']['sms_templates'][$kind]??[];if(!is_array($saved))$saved=[];return array_merge($base,$saved,['key'=>$kind]);}
function sms_template_enabled($kind){return db(false,function($s)use($kind){$c=sms_template_config_from_state($s,$kind);return !array_key_exists('enabled',$c)||!empty($c['enabled']);});}
function sms_template_render_text($text,$vars=[]){$safe=[];foreach((array)$vars as $k=>$v)$safe['{'.$k.'}']=(string)$v;return strtr((string)$text,$safe);}

function admin_order_sms_mobiles($settings){
    $raw=$settings['admin_order_sms_mobiles']??($settings['admin_order_sms_mobile']??'');
    return normalize_admin_sms_mobiles($raw, false);
}
function normalize_admin_sms_mobiles($raw,$strict=true){
    if(is_array($raw))$raw=implode("\n",array_map('strval',$raw));
    $raw=strtr((string)$raw,array_combine(preg_split('//u','۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',-1,PREG_SPLIT_NO_EMPTY),str_split('01234567890123456789')));
    $parts=preg_split('/[\s,;،؛]+/u',trim($raw),-1,PREG_SPLIT_NO_EMPTY);$result=[];
    foreach($parts as $part){
        if(!preg_match('/^(?:09[0-9]{9}|(?:\+98|98|0098)9[0-9]{9})$/',$part)){
            if($strict)fail('یکی از شماره‌های مدیریت معتبر نیست؛ هر شماره را در یک خط وارد کنید');
            continue;
        }
        if(strpos($part,'0098')===0)$part=substr($part,2);
        $mobile=clean_mobile($part);$result[$mobile]=$mobile;
    }
    return array_values($result);
}
function sms_template_vars_for_order($customer,$order){$carrier=trim((string)($order['shipping_type']??''));$tracking=trim((string)($order['tracking_code']??''));$cancel=trim((string)($order['cancel_reason']??''));$amount=(int)((($order['approval_status']??'')==='تأیید شده'&&array_key_exists('approved_total',$order))?$order['approved_total']:($order['estimated_total']??0));$subtotal=(int)($order['subtotal_before_discount']??$amount);$discount=(int)($order['discount_amount']??0);$itemsCount=0;foreach($order['items']??[] as $it)$itemsCount+=(int)($it['qty']??0);return ['order_number'=>(string)($order['number']??''),'customer_name'=>(string)($customer['name']??$order['customer_name']??''),'status'=>(string)($order['status']??''),'amount'=>number_format(max(0,$amount)),'subtotal'=>number_format(max(0,$subtotal)),'discount_amount'=>number_format(max(0,$discount)),'promo_code'=>(string)($order['promo_code']??''),'items_count'=>number_format(max(0,$itemsCount)),'payment_method'=>(string)($order['requested_payment_method_label']??$order['payment_method_label']??'-'),'carrier'=>$carrier!==''?$carrier:'روش ارسال انتخاب‌شده','tracking_code'=>$tracking,'tracking_suffix'=>$tracking!==''?' کد مرسوله: '.$tracking:'','cancel_reason'=>$cancel,'cancel_suffix'=>$cancel!==''?' علت: '.$cancel:''];}

function sms_send_mobile($mobile,$message,$meta=[]){
    global $cfg;
    $mobile=clean_mobile($mobile);
    if(!preg_match('/^09\\d{9}$/',$mobile))return ['queued'=>false,'sent'=>false,'error'=>'invalid_mobile'];
    $kind=strtolower(trim((string)($meta['kind']??'status')));
    $vars=is_array($meta['vars']??null)?$meta['vars']:[];
    $template=db(false,function($s)use($kind){return sms_template_config_from_state($s,$kind);});
    if($kind==='test'&&trim((string)$message)!==''){$finalMessage=trim((string)$message);}else{$tplText=trim((string)($template['text']??''));$finalMessage=$tplText!==''?sms_template_render_text($tplText,$vars):(string)$message;}
    if(trim($finalMessage)==='')$finalMessage=(string)$message;
    $provider='homa_token';
    $entry=['id'=>0,'mobile'=>$mobile,'order_id'=>(int)($meta['order_id']??0),'order_number'=>(string)($meta['order_number']??''),'message'=>$finalMessage,'kind'=>$kind,'template_label'=>(string)($template['label']??$kind),'template_category'=>(string)($template['category']??'سایر'),'provider'=>$provider,'status'=>'ثبت در صف','created_at'=>now(),'sent_at'=>'','provider_response'=>'','provider_error'=>'','http_code'=>0,'request_endpoint'=>'','result_code'=>'','auth_mode'=>'','request_id'=>'','error_code'=>'','error_message'=>'','error_details'=>[]];
    if(array_key_exists('enabled',$template)&&empty($template['enabled'])){$entry['status']='غیرفعال';$entry['provider_error']='این نوع پیامک در تنظیمات غیرفعال است';$entry=db(true,function(&$s)use($entry){$entry['id']=count($s['sms_outbox']??[])+1;$s['sms_outbox'][]=$entry;return $entry;});return ['queued'=>false,'sent'=>false,'disabled'=>true,'id'=>$entry['id'],'kind'=>$kind];}
    $entry=db(true,function(&$s)use($entry){$entry['id']=count($s['sms_outbox']??[])+1;$s['sms_outbox'][]=$entry;return $entry;});
    if(!function_exists('curl_init')){db(true,function(&$s)use($entry){foreach($s['sms_outbox'] as &$x)if((int)($x['id']??0)===(int)$entry['id']){$x['status']='خطا';$x['provider_error']='PHP cURL extension is not available';break;}});return ['queued'=>true,'sent'=>false,'id'=>$entry['id'],'error'=>'curl_missing'];}

    $token=trim((string)($cfg['homa_api_token']??''));
    $newEndpoint=trim((string)($cfg['homa_api_endpoint']??'https://www.homacrm.com/api/v1/external/messaging/send'));
    $legacyEnabled=!empty($cfg['homa_legacy_fallback']);
    $legacyUser=trim((string)($cfg['homa_username']??''));$legacyPass=(string)($cfg['homa_password']??'');$portal=trim((string)($cfg['homa_portal_code']??''));$server=trim((string)($cfg['homa_server_type']??'100'));
    $legacyEndpoint=in_array($kind,['otp','staff_otp'],true)?trim((string)($cfg['homa_otp_endpoint']??'https://api.homais.com/services/messaging/sms/api/sendMessage/OTP/')):trim((string)($cfg['homa_direct_endpoint']??'https://api.homais.com/services/messaging/sms/api/sendMessage/direct/'));

    $r=null;$requestEndpoint='';
    if($token!==''&&$newEndpoint!==''){
        $requestEndpoint=$newEndpoint;$r=homa_token_send($newEndpoint,$token,$mobile,$finalMessage);$provider='homa_token';
    }elseif($legacyEnabled&&$legacyUser!==''&&$legacyPass!==''&&$portal!==''){
        $requestEndpoint=$legacyEndpoint;$r=homa_legacy_send($legacyEndpoint,$legacyUser,$legacyPass,$portal,$server,$mobile,$finalMessage);$provider=in_array($kind,['otp','staff_otp'],true)?'homa_otp_legacy':'homa_direct_legacy';
    }else{
        db(true,function(&$s)use($entry){foreach($s['sms_outbox'] as &$x)if((int)($x['id']??0)===(int)$entry['id']){$x['status']='تنظیم نشده';$x['provider_error']='Homa API token is not configured';break;}});
        return ['queued'=>true,'sent'=>false,'id'=>$entry['id'],'error'=>'provider_not_configured'];
    }
    $metaResp=$r['meta']??['ok'=>false,'body'=>'','result_code'=>''];$ok=!empty($metaResp['ok']);$raw=(string)($r['resp']!==false?$r['resp']:'');$http=(int)($r['http']??0);$curlErr=(string)($r['err']??'');$resultCode=(string)($metaResp['result_code']??'');$authMode=(string)($r['auth']??'');$requestId=(string)($metaResp['request_id']??'');$errorCode=(string)($metaResp['error_code']??'');$errorMessage=(string)($metaResp['error_message']??'');$errorDetails=$metaResp['error_details']??[];
    db(true,function(&$s)use($entry,$ok,$raw,$curlErr,$http,$provider,$requestEndpoint,$resultCode,$authMode,$requestId,$errorCode,$errorMessage,$errorDetails){foreach($s['sms_outbox'] as &$x)if((int)($x['id']??0)===(int)$entry['id']){$x['provider']=$provider;$x['status']=$ok?'ارسال شد':'خطا';$x['sent_at']=$ok?now():'';$x['provider_response']=substr($raw,0,2000);$x['provider_error']=substr($curlErr,0,500);$x['http_code']=$http;$x['request_endpoint']=$requestEndpoint;$x['result_code']=$resultCode;$x['auth_mode']=$authMode;$x['request_id']=$requestId;$x['error_code']=$errorCode;$x['error_message']=$errorMessage;$x['error_details']=$errorDetails;break;}});
    return ['queued'=>true,'sent'=>$ok,'id'=>$entry['id'],'http_code'=>$http,'provider'=>$provider,'result_code'=>$resultCode,'provider_response'=>substr($raw,0,900),'provider_error'=>substr($curlErr,0,300),'auth_mode'=>$authMode,'endpoint'=>$requestEndpoint,'request_id'=>$requestId,'error_code'=>$errorCode,'error_message'=>$errorMessage,'error_details'=>$errorDetails];
}


function sms_public_failure_message($send){
    $code=(string)($send['error_code']??'');
    $msg=(string)($send['error_message']??'');
    if($code==='E4005'||stripos($msg,'Insufficient credit')!==false)return 'ارسال پیامک انجام نشد؛ اعتبار یا سقف ارسال پنل هما را بررسی کنید.';
    if($code==='E4009'||stripos($msg,'Too Many Requests')!==false)return 'ارسال پیامک موقتاً به علت محدودیت تعداد درخواست انجام نشد؛ کمی بعد دوباره تلاش کنید.';
    if(($send['error']??'')==='provider_not_configured')return 'سرویس پیامک هما در سامانه تنظیم نشده است.';
    if(($send['error']??'')==='curl_missing')return 'امکان ارتباط با سرویس پیامک روی سرور فعال نیست.';
    return 'ارسال پیامک انجام نشد؛ وضعیت سرویس پیامک هما را بررسی کنید.';
}

function sms_status($customer,$order,$message,$kind='status'){$mobile=clean_mobile($customer['mobile']??'');if($mobile==='')return ['queued'=>false,'sent'=>false];return sms_send_mobile($mobile,$message,['kind'=>$kind,'order_id'=>$order['id']??0,'order_number'=>$order['number']??'','vars'=>sms_template_vars_for_order($customer,$order)]);}
function promo_code_norm($v){$v=trim((string)$v);$v=preg_replace('/\s+/u','',$v);return strtoupper($v);}
function offer_discount_label($o){$type=(string)($o['discount_type']??'none');$value=max(0,(int)($o['discount_value']??0));if($type==='percent'&&$value>0)return $value.'٪ تخفیف';if($type==='amount'&&$value>0)return number_format($value).' تومان تخفیف';return 'پیشنهاد ویژه';}
function offer_is_active_for_customer($o,$customerId){$today=date('Y-m-d');if(empty($o['active']))return false;if(($o['start_date']??'')!==''&&($o['start_date']??'')>$today)return false;if(($o['end_date']??'')!==''&&($o['end_date']??'')<$today)return false;if(($o['audience']??'all')==='selected'&&!in_array((int)$customerId,array_map('intval',$o['customer_ids']??[]),true))return false;return true;}
function offer_usage_rows($s){return is_array($s['offer_usages']??null)?$s['offer_usages']:[];}
function offer_used_by_customer($s,$offerId,$customerId){foreach(offer_usage_rows($s) as $u)if((int)($u['offer_id']??0)===(int)$offerId&&(int)($u['customer_id']??0)===(int)$customerId)return true;return false;}
function offer_by_code($s,$code,$customerId){$code=promo_code_norm($code);if($code==='')return null;foreach(array_reverse($s['special_offers']??[]) as $o){if(promo_code_norm($o['promo_code']??'')!==$code)continue;if(!offer_is_active_for_customer($o,(int)$customerId))continue;if(!empty($o['one_time_per_customer'])&&offer_used_by_customer($s,(int)($o['id']??0),(int)$customerId))fail('این کد تخفیف قبلاً توسط شما استفاده شده است',409);$type=(string)($o['discount_type']??'none');$value=max(0,(int)($o['discount_value']??0));if(!in_array($type,['percent','amount'],true)||$value<=0)continue;return $o;}return null;}
function offer_discount_for_items($offer,$items,$subtotal){$eligible=0;$product=trim((string)($offer['product']??''));foreach($items as $it){if($product!==''&&($it['product']??'')!==$product)continue;$eligible+=(int)($it['line_total']??0);}if($eligible<=0)return 0;$type=(string)($offer['discount_type']??'none');$value=max(0,(int)($offer['discount_value']??0));if($type==='percent')return min($eligible,(int)floor($eligible*min(100,$value)/100));if($type==='amount')return min($eligible,$value);return 0;}
function offer_sms_vars($o){$product=trim((string)($o['product']??''));$end=trim((string)($o['end_date']??''));return ['offer_title'=>(string)($o['title']??'طرح ویژه'),'discount'=>offer_discount_label($o),'promo_code'=>(string)($o['promo_code']??''),'offer_product'=>$product,'offer_product_suffix'=>$product!==''?' — ویژه '.$product:'','offer_end'=>$end,'offer_end_suffix'=>$end!==''?' — اعتبار تا '.jalali_date_value($end):''];}

function order_sales_amount($o){if(($o['status']??'')==='لغو شد')return 0;$approved=$o['approval_status']??'';if($approved==='در انتظار تأیید')return 0;if(!payment_allows_shipping($o))return 0;$amount=(int)($o['approved_total']??0);if($amount<=0)$amount=(int)($o['estimated_total']??0);if($amount<=0){foreach($o['items']??[] as $it)$amount+=(int)($it['line_total']??0);}return max(0,$amount);}
function order_item_qty($o){$q=0;foreach($o['items']??[] as $it)$q+=(int)($it['qty']??0);return $q;}
function sales_orders($s,$customerId=0){return array_values(array_filter($s['orders']??[],function($o)use($customerId){if($customerId>0&&(int)($o['customer_id']??0)!==$customerId)return false;return order_sales_amount($o)>0;}));}
function period_stats_from_orders($orders,$days){$cut=time()-$days*86400;$amount=0;$count=0;$qty=0;foreach($orders as $o){$ts=strtotime((string)($o['created_at']??''));if(!$ts||$ts<$cut)continue;$amount+=order_sales_amount($o);$count++;$qty+=order_item_qty($o);}return ['amount'=>$amount,'orders'=>$count,'qty'=>$qty];}
function normalize_jalali_input($v){$v=trim((string)$v);$v=strtr($v,['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9']);$v=str_replace(['-','.'],'/',$v);if($v==='')return '';if(!preg_match('/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/',$v,$m))return '';return sprintf('%04d/%02d/%02d',(int)$m[1],(int)$m[2],(int)$m[3]);}
function sales_orders_in_range($orders,$from='',$to=''){$from=normalize_jalali_input($from);$to=normalize_jalali_input($to);return array_values(array_filter($orders,function($o)use($from,$to){$j=jalali_date_value($o['created_at']??'');if($j==='')return false;if($from!==''&&$j<$from)return false;if($to!==''&&$j>$to)return false;return true;}));}
function sales_series($orders,$period,$from='',$to=''){$now=time();$bucket=[];$jparts=function($t){$j=jalali_date_value(date('Y-m-d',$t));$a=array_map('intval',explode('/',$j));return [$a[0]??0,$a[1]??0,$a[2]??0,$j];};
 if($period==='daily'){for($i=13;$i>=0;$i--){$t=strtotime('-'.$i.' days',$now);$j=jalali_date_value(date('Y-m-d',$t));$bucket[$j]=['label'=>substr($j,5),'amount'=>0,'orders'=>0,'qty'=>0];}}
 elseif($period==='weekly'){for($i=11;$i>=0;$i--){$t=strtotime('-'.$i.' weeks',$now);$key=date('o-W',$t);$bucket[$key]=['label'=>'هفته '.substr(jalali_date_value(date('Y-m-d',$t)),5),'amount'=>0,'orders'=>0,'qty'=>0];}}
 elseif($period==='quarterly'){[$jy,$jm]=array_slice($jparts($now),0,2);$q=(int)ceil(max(1,$jm)/3);$base=$jy*4+($q-1);for($i=7;$i>=0;$i--){$idx=$base-$i;$y=intdiv($idx,4);$qq=($idx%4)+1;$key=$y.'-Q'.$qq;$bucket[$key]=['label'=>'سه‌ماهه '.$qq.' '.$y,'amount'=>0,'orders'=>0,'qty'=>0];}}
 elseif($period==='yearly'){[$jy]=$jparts($now);for($i=4;$i>=0;$i--){$y=$jy-$i;$bucket[(string)$y]=['label'=>(string)$y,'amount'=>0,'orders'=>0,'qty'=>0];}}
 elseif($period==='custom'){if(!$orders)return [];$from=normalize_jalali_input($from);$to=normalize_jalali_input($to);$daily=false;if($from!==''&&$to!==''){$fa=array_map('intval',explode('/',$from));$ta=array_map('intval',explode('/',$to));$months=(($ta[0]-$fa[0])*12)+($ta[1]-$fa[1]);$daily=$months<=1;}foreach($orders as $o){$j=jalali_date_value($o['created_at']??'');if($j==='')continue;$key=$daily?$j:substr($j,0,7);if(!isset($bucket[$key]))$bucket[$key]=['label'=>$daily?substr($j,5):substr($j,0,7),'amount'=>0,'orders'=>0,'qty'=>0];}ksort($bucket);}
 else{[$jy,$jm]=$jparts($now);$base=$jy*12+($jm-1);for($i=11;$i>=0;$i--){$idx=$base-$i;$y=intdiv($idx,12);$m=($idx%12)+1;$key=sprintf('%04d/%02d',$y,$m);$bucket[$key]=['label'=>$key,'amount'=>0,'orders'=>0,'qty'=>0];}}
 foreach($orders as $o){$ts=strtotime((string)($o['created_at']??''));if(!$ts)continue;$j=jalali_date_value($o['created_at']??'');$a=array_map('intval',explode('/',$j));$jy=$a[0]??0;$jm=$a[1]??0;if($period==='daily')$key=$j;elseif($period==='weekly')$key=date('o-W',$ts);elseif($period==='quarterly')$key=$jy.'-Q'.(int)ceil(max(1,$jm)/3);elseif($period==='yearly')$key=(string)$jy;elseif($period==='custom'){$daily=false;if($from!==''&&$to!==''){$fa=array_map('intval',explode('/',normalize_jalali_input($from)));$ta=array_map('intval',explode('/',normalize_jalali_input($to)));$daily=((($ta[0]-$fa[0])*12)+($ta[1]-$fa[1]))<=1;}$key=$daily?$j:substr($j,0,7);}else $key=substr($j,0,7);if(!isset($bucket[$key]))continue;$bucket[$key]['amount']+=order_sales_amount($o);$bucket[$key]['orders']++;$bucket[$key]['qty']+=order_item_qty($o);}return array_values($bucket);}
function tracking_message($order){$carrier=trim((string)($order['shipping_type']??''));$code=trim((string)($order['tracking_code']??''));$s='سفارش '.$order['number'].' از طریق '.($carrier!==''?$carrier:'روش ارسال انتخاب‌شده').' ارسال شد.';if($code!=='')$s.=' کد مرسوله: '.$code;return $s;}
function valid_serial($p,$s){global $PRODUCTS;foreach($PRODUCTS as $x)if($x['name']===$p)return !empty($x['serial_required'])&&!empty($x['pattern'])&&preg_match('/'.$x['pattern'].'/u',$s);return false;}
function order_serial_complete($o){global $PRODUCTS;foreach($o['items']??[] as $it){$required=false;foreach($PRODUCTS as $p)if(($p['name']??'')===($it['product']??'')){$required=!empty($p['serial_required']);break;}if($required&&count($it['serials']??[])<(int)($it['qty']??0))return false;}return true;}
function jalali_date_value($date){$ts=strtotime((string)$date);if(!$ts)return '';$gy=(int)date('Y',$ts);$gm=(int)date('n',$ts);$gd=(int)date('j',$ts);$gdm=[0,31,59,90,120,151,181,212,243,273,304,334];$gy2=$gm>2?$gy+1:$gy;$days=355666+365*$gy+(int)(($gy2+3)/4)-(int)(($gy2+99)/100)+(int)(($gy2+399)/400)+$gd+$gdm[$gm-1];$jy=-1595+33*(int)($days/12053);$days%=12053;$jy+=4*(int)($days/1461);$days%=1461;if($days>365){$jy+=(int)(($days-1)/365);$days=($days-1)%365;}$jm=$days<186?1+(int)($days/31):7+(int)(($days-186)/30);$jd=1+($days<186?$days%31:($days-186)%30);return sprintf('%04d/%02d/%02d',$jy,$jm,$jd);}

function gp_public_order_token(&$s,$orderId){
 $i=idx($s['orders']??[],$orderId);if($i<0)return '';
 $tok=trim((string)($s['orders'][$i]['public_qr_token']??''));
 if($tok===''){
   try{$tok=bin2hex(random_bytes(18));}catch(Throwable $e){$tok=hash('sha256',uniqid((string)$orderId,true).microtime(true));}
   $s['orders'][$i]['public_qr_token']=$tok;
   $s['orders'][$i]['public_qr_created_at']=now();
 }
 return $tok;
}
function gp_public_order_by_token($s,$token){
 $token=trim((string)$token);if($token==='')return null;
 foreach($s['orders']??[] as $o){
   $stored=trim((string)($o['public_qr_token']??''));
   if($stored!==''&&hash_equals($stored,$token)){
     $ci=idx($s['customers']??[],$o['customer_id']??0);
     $c=$ci>=0?$s['customers'][$ci]:[];
     return [$o,$c,order_serial_rows_from_state($s,$o),gp_effective_sender($s,$o)];
   }
 }
 return null;
}
function gp_public_order_info_page($o,$c,$rows,$sender,$token){
 $e=fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');
 $items=[];foreach($o['items']??[] as $it)$items[]=trim((string)($it['product']??'')).' × '.(int)($it['qty']??0);
 $itemsText=implode(' | ',array_filter($items));if($itemsText==='')$itemsText='-';
 $receiver=trim((string)($c['company']??''));if($receiver==='')$receiver=trim((string)($c['name']??$o['customer_name']??''));
 $address=gp_customer_address($c);
 $senderName=trim((string)($sender['sender_name']??'قدیر پرداخت'));
 $senderMobile=trim((string)($sender['sender_mobile']??''));if($senderMobile==='')$senderMobile='09128151868';
 $serialBody='';foreach($rows as $i=>$r)$serialBody.='<tr><td>'.($i+1).'</td><td>'.$e($r['product']??'').'</td><td>'.$e($r['manufacturer']??'').'</td><td class="ltr">'.$e($r['serial']??'').'</td><td class="ltr">'.$e($r['imei']??'').'</td></tr>';
 if($serialBody==='')$serialBody='<tr><td colspan="5">برای این سفارش سریالی ثبت نشده است.</td></tr>';
 header('Content-Type:text/html; charset=utf-8');
 echo '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>خلاصه مرسوله '.$e($o['number']??'').'</title><style>
 *{box-sizing:border-box}body{margin:0;background:#f3f6fb;color:#10243f;font-family:Tahoma,Arial,sans-serif}.wrap{max-width:980px;margin:0 auto;padding:18px}.card{background:#fff;border:1px solid #dce5ef;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px #11345d12}.head{background:linear-gradient(135deg,#0b2a4d,#123d6d 60%,#0b2444);color:#fff;padding:18px 22px;display:flex;justify-content:space-between;gap:15px;align-items:center}.head h1{margin:0;font-size:26px}.head .sub{color:#d6e3f2;margin-top:6px}.num{direction:ltr;color:#ffa33a;font:900 28px Consolas,monospace}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px}.box{border:1px solid #dce5ef;background:#f8fbff;border-radius:13px;padding:12px 14px}.box b{display:block;color:#46617f;font-size:12px;margin-bottom:7px}.box div{font-size:18px;font-weight:700;line-height:1.75}.full{grid-column:1/-1}.actions{padding:0 16px 16px;display:flex;gap:10px;flex-wrap:wrap}.btn{display:inline-block;text-decoration:none;background:#ff7e14;color:#fff;padding:11px 16px;border-radius:11px;font-weight:800}.btn.alt{background:#12365d}.serials{padding:0 16px 18px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #dbe4ee;padding:9px;text-align:right}th{background:#12365d;color:#fff}.ltr{direction:ltr;text-align:left;font-family:Consolas,monospace}.note{padding:0 16px 18px;color:#5b6d82;line-height:1.9}@media(max-width:700px){.grid{grid-template-columns:1fr}.head{display:block}.num{margin-top:10px}.full{grid-column:auto}}</style></head><body><div class="wrap"><section class="card"><header class="head"><div><h1>خلاصه اطلاعات مرسوله</h1><div class="sub">قدیر پرداخت — اطلاعات سفارش و سریال دستگاه‌ها</div></div><div class="num">'.$e($o['number']??'').'</div></header><div class="grid"><div class="box"><b>گیرنده</b><div>'.$e($receiver).'</div></div><div class="box"><b>تماس گیرنده</b><div>'.$e($c['mobile']??'-').'</div></div><div class="box full"><b>آدرس مقصد</b><div>'.$e($address?:'-').'</div></div><div class="box"><b>فرستنده</b><div>'.$e($senderName.' / '.$senderMobile).'</div></div><div class="box"><b>روش ارسال</b><div>'.$e($o['shipping_type']??'-').'</div></div><div class="box"><b>وضعیت پرداخت</b><div>'.$e($o['payment_status']??'-').'</div></div><div class="box"><b>تاریخ</b><div>'.$e(jalali_date_value($o['created_at']??'')).'</div></div><div class="box full"><b>کالا / مرسوله</b><div>'.$e($itemsText).'</div></div></div><div class="actions"><a class="btn" href="/qr/order-serials?t='.$e(rawurlencode($token)).'" target="_blank">فایل سریال‌ها / چاپ PDF</a><a class="btn alt" href="/qr/order-serials.csv?t='.$e(rawurlencode($token)).'">دانلود CSV سریال‌ها</a></div><div class="serials"><table><thead><tr><th>ردیف</th><th>مدل دستگاه</th><th>شرکت سازنده</th><th>سریال</th><th>IMEI</th></tr></thead><tbody>'.$serialBody.'</tbody></table></div><div class="note">این صفحه از QR روی بیجک ارسال باز می‌شود و شامل خلاصه مرسوله و سریال‌های همان سفارش است.</div></section></div></body></html>';exit;
}
function gp_public_serial_print_page($o,$c,$rows){
 $blocks=[['number'=>$o['number']??'','date'=>jalali_date_value($o['created_at']??''),'status'=>$o['status']??'','rows'=>$rows]];
 serial_print_page('سریال‌های مرسوله','مشتری: '.($c['name']??($o['customer_name']??'')).' | سفارش: '.($o['number']??''),$blocks);
}
function gp_public_serial_csv($o,$rows){
 $fn='order-serials-'.preg_replace('/[^A-Za-z0-9_-]+/','-',(string)($o['number']??'order')).'.csv';
 header('Content-Type:text/csv; charset=UTF-8');header('Content-Disposition: attachment; filename="'.$fn.'"');echo "\xEF\xBB\xBF";
 $f=fopen('php://output','w');fputcsv($f,['ردیف','مدل دستگاه','شرکت سازنده','سریال','IMEI']);
 foreach($rows as $i=>$r)fputcsv($f,[$i+1,$r['product']??'',$r['manufacturer']??'',$r['serial']??'',$r['imei']??'']);
 fclose($f);exit;
}

function xlsx_out($filename,$rows){
 if(!class_exists('ZipArchive')){$csv=preg_replace('/\.xlsx$/i','.csv',$filename);header('Content-Type:text/csv; charset=utf-8');header('Content-Disposition:attachment; filename="'.$csv.'"');echo "\xEF\xBB\xBF";$h=fopen('php://output','w');foreach($rows as $row)fputcsv($h,$row);fclose($h);exit;}
 $xml=fn($v)=>htmlspecialchars((string)$v,ENT_XML1|ENT_QUOTES,'UTF-8');
 $col=function($n){$s='';while($n>0){$n--;$s=chr(65+$n%26).$s;$n=(int)($n/26);}return $s;};
 $widths=[];$maxCols=0;foreach($rows as $row){$maxCols=max($maxCols,count($row));foreach(array_values($row) as $ci=>$v){$txt=(string)$v;$len=function_exists('mb_strlen')?mb_strlen($txt,'UTF-8'):strlen($txt);$widths[$ci]=min(42,max($widths[$ci]??8,$len+3));}}
 $cols='';for($i=0;$i<$maxCols;$i++)$cols.='<col min="'.($i+1).'" max="'.($i+1).'" width="'.($widths[$i]??12).'" customWidth="1"/>';
 $sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews><cols>'.$cols.'</cols><sheetData>';
 foreach($rows as $ri=>$row){$rn=$ri+1;$vals=array_values($row);$nonEmpty=array_values(array_filter($vals,fn($x)=>trim((string)$x)!==''));$isBlank=!$nonEmpty;$isTitle=$ri===0&&count($nonEmpty)<=2;$first=trim((string)($vals[0]??''));$isHeader=in_array($first,['ردیف','مدل دستگاه','شماره سفارش','شماره فاکتور'],true)||($ri===0&&count($nonEmpty)>2);$style=$isTitle?3:($isHeader?2:($isBlank?0:1));$sheet.='<row r="'.$rn.'">';
  foreach($vals as $ci=>$v){$ref=$col($ci+1).$rn;$sheet.='<c r="'.$ref.'" t="inlineStr" s="'.$style.'"><is><t xml:space="preserve">'.$xml($v).'</t></is></c>';}
 $sheet.='</row>';}
 $sheet.='</sheetData></worksheet>';
 $styles='<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Tahoma"/></font><font><sz val="11"/><name val="Tahoma"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Tahoma"/></font><font><b/><color rgb="FF0D2B4F"/><sz val="14"/><name val="Tahoma"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0D2B4F"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF0E2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD6DEE8"/></left><right style="thin"><color rgb="FFD6DEE8"/></right><top style="thin"><color rgb="FFD6DEE8"/></top><bottom style="thin"><color rgb="FFD6DEE8"/></bottom></border></borders><cellStyleXfs count="1"><xf fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf><xf fontId="2" fillId="1" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="3" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf></cellXfs></styleSheet>';
 $tmp=tempnam(sys_get_temp_dir(),'ghxlsx');$z=new ZipArchive;if($z->open($tmp,ZipArchive::OVERWRITE)!==true)fail('ساخت فایل Excel ممکن نشد',500);
 $z->addFromString('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
 $z->addFromString('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 $z->addFromString('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="گزارش" sheetId="1" r:id="rId1"/></sheets></workbook>');
 $z->addFromString('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
 $z->addFromString('xl/styles.xml',$styles);$z->addFromString('xl/worksheets/sheet1.xml',$sheet);$z->close();
 header('Content-Type:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');header('Content-Disposition:attachment; filename="'.$filename.'"');header('Content-Length:'.filesize($tmp));readfile($tmp);unlink($tmp);exit;
}

function product_manufacturer_from_state($s,$name){foreach($s['products']??[] as $p)if(($p['name']??'')===$name)return trim((string)($p['manufacturer']??''));return '';}
function order_serial_rows_from_state($s,$o){$map=[];foreach($o['items']??[] as $it){$product=(string)($it['product']??'');foreach($it['serials']??[] as $sn){$sn=trim((string)$sn);if($sn==='')continue;$map[strtoupper($sn)]=['product'=>$product,'manufacturer'=>product_manufacturer_from_state($s,$product),'serial'=>$sn,'imei'=>''];}}foreach($s['inventory']??[] as $iv)if((int)($iv['order_id']??0)===(int)($o['id']??0)){$sn=trim((string)($iv['serial']??''));if($sn==='')continue;$product=(string)($iv['product']??'');$map[strtoupper($sn)]=['product'=>$product,'manufacturer'=>product_manufacturer_from_state($s,$product),'serial'=>$sn,'imei'=>(string)($iv['imei']??'')];}return array_values($map);}
function serial_print_page($title,$subtitle,$blocks){$e=fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');$body='';foreach($blocks as $b){$body.='<section class="invoice"><div class="invoice-head"><div><b>'.$e($b['number']??'').'</b><span>'.$e($b['date']??'').'</span></div><div><span class="status">'.$e($b['status']??'').'</span></div></div><table><thead><tr><th>ردیف</th><th>مدل دستگاه</th><th>شرکت سازنده</th><th>سریال</th><th>IMEI</th></tr></thead><tbody>';foreach($b['rows']??[] as $i=>$r)$body.='<tr><td>'.($i+1).'</td><td>'.$e($r['product']??'').'</td><td>'.$e($r['manufacturer']??'').'</td><td class="ltr">'.$e($r['serial']??'').'</td><td class="ltr">'.$e($r['imei']??'').'</td></tr>';$body.='</tbody></table></section>';}if($body==='')$body='<div class="empty">سریالی برای این انتخاب ثبت نشده است.</div>';header('Content-Type:text/html; charset=utf-8');echo '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.$e($title).'</title><style>@page{size:A4 portrait;margin:11mm}*{box-sizing:border-box}body{margin:0;background:#f2f5fa;color:#0b1f38;font-family:IRANSans,IRANSansWeb,Tahoma,Arial,sans-serif}.toolbar{position:sticky;top:0;z-index:3;background:#0d2b4f;color:#fff;padding:10px;text-align:center}.toolbar button{background:#ff7a19;color:#fff;border:0;border-radius:8px;padding:9px 18px;font:inherit;cursor:pointer}.sheet{max-width:190mm;margin:12px auto;background:#fff;border-radius:14px;padding:14mm;box-shadow:0 8px 28px #0d2b4f18}.title{font-size:22px;font-weight:900;color:#0d2b4f;border-bottom:3px solid #ff7a19;padding-bottom:10px}.subtitle{color:#6f7f94;margin:8px 0 18px;line-height:1.8}.invoice{margin:0 0 18px;break-inside:avoid}.invoice-head{display:flex;justify-content:space-between;gap:10px;align-items:center;background:#f7f9fc;border:1px solid #e1e7ef;border-radius:9px 9px 0 0;padding:9px 11px}.invoice-head b{direction:ltr;display:inline-block}.invoice-head span{margin-right:10px;color:#6f7f94;font-size:11px}.status{background:#fff0e2!important;color:#a34d0c!important;padding:4px 8px;border-radius:999px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#0d2b4f;color:#fff}th,td{border:1px solid #d7dfe8;padding:7px;text-align:right}tbody tr:nth-child(even){background:#fbfcfe}.ltr{direction:ltr;text-align:left;font-family:Consolas,monospace}.empty{padding:30px;text-align:center;color:#7f8da4}@media print{body{background:#fff}.toolbar{display:none}.sheet{box-shadow:none;margin:0;max-width:none;border-radius:0;padding:0}}</style></head><body><div class="toolbar"><button onclick="window.print()">ذخیره / چاپ PDF</button></div><main class="sheet"><div class="title">'.$e($title).'</div><div class="subtitle">'.$e($subtitle).'</div>'.$body.'</main><script>setTimeout(()=>window.print(),350)</script></body></html>';exit;}
function carton_code($s,$p){preg_match_all('/[A-Z0-9]+/i',$p,$m);$pre=strtoupper(implode('',$m[0]))?:'ITEM';$max=0;foreach($s['cartons'] as $c)if(strpos($c['code'],$pre.'-')===0)$max=max($max,(int)substr($c['code'],strlen($pre)+1));return sprintf('%s-%03d',$pre,$max+1);}
function rows_file($f,$name){$e=strtolower(pathinfo($name,PATHINFO_EXTENSION));if($e==='csv'){$a=[];$h=fopen($f,'r');while(($r=fgetcsv($h))!==false)$a[]=$r;fclose($h);return $a;}if($e==='xlsx'&&class_exists('ZipArchive')){$z=new ZipArchive;if($z->open($f)!==true)fail('Excel باز نشد');$ss=[];$q=$z->getFromName('xl/sharedStrings.xml');if($q){$x=simplexml_load_string($q);foreach($x->si as $v)$ss[]=(string)$v->t;}$q=$z->getFromName('xl/worksheets/sheet1.xml');$z->close();$x=simplexml_load_string($q);$a=[];foreach($x->sheetData->row as $rr){$r=[];foreach($rr->c as $c){$v=(string)$c->v;$r[]=((string)$c['t']==='s')?($ss[(int)$v]??''):$v;}$a[]=$r;}return $a;}fail('فقط CSV یا XLSX پشتیبانی می‌شود');}
function inventory_summary($s){
    $map=[];
    foreach($s['products']??[] as $p){
        $name=(string)($p['name']??'');
        if($name==='') continue;
        $map[$name]=[
            'product'=>$name,
            'serial_required'=>!empty($p['serial_required']),
            'incoming'=>0,'current'=>0,'reserved'=>0,'outgoing'=>0,'cartons'=>0,'issues'=>[]
        ];
    }

    $orders=[];
    foreach($s['orders']??[] as $o){
        $oid=(int)($o['id']??0);
        if($oid>0) $orders[$oid]=$o;
    }

    $serialSeen=[];
    $inventoryBySerial=[];
    foreach($s['inventory']??[] as $iv){
        $name=(string)($iv['product']??'نامشخص');
        if(!isset($map[$name])){
            $map[$name]=[
                'product'=>$name,'serial_required'=>true,
                'incoming'=>0,'current'=>0,'reserved'=>0,'outgoing'=>0,'cartons'=>0,'issues'=>[]
            ];
        }
        $map[$name]['incoming']++;

        $rawSerial=trim((string)($iv['serial']??''));
        $serialKey=strtoupper($rawSerial);
        if($serialKey!==''){
            if(isset($serialSeen[$serialKey])){
                $map[$name]['issues'][]='سریال تکراری: '.$rawSerial;
                $otherName=$serialSeen[$serialKey];
                if(isset($map[$otherName])) $map[$otherName]['issues'][]='سریال تکراری: '.$rawSerial;
            }else{
                $serialSeen[$serialKey]=$name;
            }
            if(!isset($inventoryBySerial[$serialKey])) $inventoryBySerial[$serialKey]=$iv;
        }

        $oid=(int)($iv['order_id']??0);
        if($oid>0){
            $o=$orders[$oid]??null;
            if(!$o){
                $map[$name]['issues'][]='تخصیص به سفارش ناموجود';
                $map[$name]['reserved']++;
            }else{
                $shipped=in_array($o['status']??'',['ارسال شد','تحویل شد'],true);
                if($shipped) $map[$name]['outgoing']++;
                else $map[$name]['reserved']++;

                $matched=false;
                foreach($o['items']??[] as $it){
                    if(($it['product']??'')===$name && in_array($rawSerial,$it['serials']??[],true)){
                        $matched=true;
                        break;
                    }
                }
                if(!$matched) $map[$name]['issues'][]='مغایرت سریال با سفارش '.$oid;
            }
        }else{
            $map[$name]['current']++;
        }
    }

    $cartons=[];
    foreach($s['cartons']??[] as $c){
        $name=(string)($c['product']??'نامشخص');
        $cartons[$name]=($cartons[$name]??0)+1;
        if(!isset($map[$name])){
            $map[$name]=[
                'product'=>$name,'serial_required'=>true,
                'incoming'=>0,'current'=>0,'reserved'=>0,'outgoing'=>0,'cartons'=>0,'issues'=>[]
            ];
        }
        foreach($c['serials']??[] as $sn){
            $key=strtoupper(trim((string)$sn));
            if($key!=='' && isset($inventoryBySerial[$key]) && ($inventoryBySerial[$key]['product']??'')!==$name){
                $map[$name]['issues'][]='مدل سریال کارتن مغایر است: '.$sn;
            }
        }
    }

    foreach($orders as $oid=>$o){
        foreach($o['items']??[] as $it){
            $name=(string)($it['product']??'نامشخص');
            if(!isset($map[$name])){
                $map[$name]=[
                    'product'=>$name,'serial_required'=>true,
                    'incoming'=>0,'current'=>0,'reserved'=>0,'outgoing'=>0,'cartons'=>0,'issues'=>[]
                ];
            }
            $serials=array_values($it['serials']??[]);
            if(count($serials)>(int)($it['qty']??0)){
                $map[$name]['issues'][]='تعداد سریال بیشتر از تعداد سفارش '.$oid;
            }
            foreach($serials as $sn){
                $key=strtoupper(trim((string)$sn));
                $iv=$inventoryBySerial[$key]??null;
                if(!$iv){
                    $map[$name]['issues'][]='سریال سفارش در مخزن نیست: '.$sn;
                }elseif((int)($iv['order_id']??0)!==(int)$oid){
                    $map[$name]['issues'][]='سریال سفارش به سفارش دیگری وصل است: '.$sn;
                }elseif(($iv['product']??'')!==$name){
                    $map[$name]['issues'][]='مدل سریال سفارش مغایر است: '.$sn;
                }
            }
        }
    }

    foreach($map as $name=>&$row){
        $row['cartons']=$cartons[$name]??0;
        $row['issues']=array_values(array_unique($row['issues']));
        $row['balance_ok']=($row['incoming']===($row['current']+$row['reserved']+$row['outgoing'])) && empty($row['issues']);
    }
    unset($row);
    return array_values($map);
}
function product_name_key($name){$name=trim((string)$name);$name=strtr($name,['ك'=>'ک','ي'=>'ی','ى'=>'ی','ة'=>'ه','ۀ'=>'ه','ـ'=>'','–'=>'-','—'=>'-']);$name=preg_replace('/\s*-\s*/u','-',$name);$name=preg_replace('/\s+/u',' ',$name);return strtolower($name);}
function same_product_name($a,$b){return product_name_key($a)===product_name_key($b);}
function warehouse_free_stock($s,$product){$n=0;foreach($s['inventory']??[] as $iv)if(same_product_name($iv['product']??'',$product)&&empty($iv['order_id']))$n++;return $n;}
function product_index_by_name($s,$name){foreach($s['products']??[] as $i=>$p)if(same_product_name($p['name']??'',$name))return $i;return -1;}
function reserved_unassigned_qty($s,$product,$excludeOrderId=0){$n=0;foreach($s['orders']??[] as $o){if((int)($o['id']??0)===(int)$excludeOrderId)continue;if(in_array($o['status']??'',['ارسال شد','تحویل شد','لغو شد'],true))continue;if(array_key_exists('approval_status',$o)&&($o['approval_status']??'')!=='تأیید شده')continue;foreach($o['items']??[] as $it)if(same_product_name($it['product']??'',$product)){$n+=max(0,(int)($it['qty']??0)-count($it['serials']??[]));}}return $n;}function ready_to_ship_reserved_qty($s,$product){$pi=product_index_by_name($s,$product);$serialRequired=$pi>=0?!empty($s['products'][$pi]['serial_required']):true;$n=0;foreach($s['orders']??[] as $o){if(($o['status']??'')!=='آماده ارسال')continue;if(array_key_exists('approval_status',$o)&&($o['approval_status']??'')!=='تأیید شده')continue;foreach($o['items']??[] as $it)if(same_product_name($it['product']??'',$product)){$n+=$serialRequired?count($it['serials']??[]):max(0,(int)($it['qty']??0));}}return $n;}
function warehouse_orderable_stock($s,$product,$excludeOrderId=0){return max(0,warehouse_free_stock($s,$product)-reserved_unassigned_qty($s,$product,$excludeOrderId));}
function customer_orderable_stock($s,$product,$excludeOrderId=0){$max=warehouse_orderable_stock($s,$product,$excludeOrderId);$pi=product_index_by_name($s,$product);if($pi<0)return 0;$p=$s['products'][$pi];if(!empty($p['serial_required'])&&array_key_exists('sellable_stock',$p))return min($max,max(0,(int)$p['sellable_stock']));return $max;}
function payment_allows_shipping($o){$pay=$o['payment_status']??'';if($pay==='تسویه کامل')return true;if($pay==='اعتباری')return ($o['credit_status']??'')==='تأیید شده';if($pay==='اقساطی')return ($o['installment_status']??'')==='تأیید شده';if($pay==='چک')return ($o['check_status']??'')==='تأیید شده';return false;}
function release_order_serials(&$s,&$o){$oid=(int)($o['id']??0);if(!isset($s['inventory'])||!is_array($s['inventory']))$s['inventory']=[];foreach($s['inventory'] as &$iv)if((int)($iv['order_id']??0)===$oid){$iv['order_id']=0;$iv['order_number']='';}unset($iv);if(!isset($o['items'])||!is_array($o['items']))$o['items']=[];foreach($o['items'] as &$it)$it['serials']=[];unset($it);}
function order_is_locked_for_serial_change($o){return in_array($o['status']??'',['ارسال شد','تحویل شد'],true);}

function auto_assign_order(&$s,&$o,$by){return 0;}
function repair_allocations_once(&$s,$by){return;}
$PRODUCTS=db(false,fn($s)=>$s['products']);

function v39_normalize_label($v){$v=trim((string)$v);$v=str_replace(['ي','ى','ك','‌','-','_'],['ی','ی','ک',' ',' ',' '],$v);$v=preg_replace('/\s+/u',' ',$v);return trim($v);}
function v39_cleanup_retail_warehouse_orders(&$s){
    $done=$s['settings']['migration_v39_retail_warehouse_cleanup']??null;if(is_array($done))return $done;
    $targets=['انبار خرد'=>true,'سفارش انبار خرد'=>true];$customerIds=[];
    foreach($s['customers']??[] as $c){$n=v39_normalize_label($c['name']??'');$co=v39_normalize_label($c['company']??'');if(isset($targets[$n])||isset($targets[$co]))$customerIds[(int)($c['id']??0)]=true;}
    $remove=[];foreach($s['orders']??[] as $o){$oid=(int)($o['id']??0);$cid=(int)($o['customer_id']??0);$cn=v39_normalize_label($o['customer_name']??'');$notes=v39_normalize_label($o['notes']??'');if(isset($customerIds[$cid])||isset($targets[$cn])||isset($targets[$notes]))$remove[$oid]=true;}
    $numbers=[];foreach($s['orders']??[] as $o)if(isset($remove[(int)($o['id']??0)]))$numbers[(string)($o['number']??'')]=true;
    if($remove){foreach($s['inventory'] as &$iv)if(isset($remove[(int)($iv['order_id']??0)])){ $iv['order_id']=0;$iv['order_number']=''; }unset($iv);
        $s['orders']=array_values(array_filter($s['orders']??[],fn($o)=>!isset($remove[(int)($o['id']??0)])));
        foreach(['notifications','payment_transactions','sms_outbox'] as $key)if(isset($s[$key])&&is_array($s[$key]))$s[$key]=array_values(array_filter($s[$key],function($x)use($remove,$numbers){$oid=(int)($x['order_id']??0);$on=(string)($x['order_number']??'');return !isset($remove[$oid])&&!isset($numbers[$on]);}));
    }
    $result=['at'=>now(),'removed_orders'=>count($remove),'order_ids'=>array_values(array_map('intval',array_keys($remove)))];$s['settings']['migration_v39_retail_warehouse_cleanup']=$result;return $result;
}
function ensure_v39_retail_warehouse_cleanup(){global $file,$backups;$marker=dirname($file).'/.v39-retail-warehouse-cleanup.done';if(is_file($marker))return;@mkdir($backups,0750,true);if(is_file($file)&&filesize($file)>0){$stamp=date('Ymd-His');@copy($file,$backups.'/pre-v39-retail-warehouse-cleanup-'.$stamp.'.json');}$r=db(true,function(&$s){return v39_cleanup_retail_warehouse_orders($s);});@file_put_contents($marker,json_encode($r,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));}
ensure_v39_retail_warehouse_cleanup();

$p=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH)?:'/';$m=$_SERVER['REQUEST_METHOD'];

function gp_dispatch_packages_from_state($s,$o){
 $orderId=(int)($o['id']??0);
 $groups=[];
 foreach($s['inventory']??[] as $iv){
   if((int)($iv['order_id']??0)!==$orderId) continue;
   $cartonCode=trim((string)($iv['carton_code']??''));
   $key=$cartonCode!==''?('carton:'.$cartonCode):'loose';
   if(!isset($groups[$key])) $groups[$key]=['carton_code'=>$cartonCode,'source'=>$cartonCode!==''?'carton':'loose','items'=>[],'serials'=>[]];
   $prod=trim((string)($iv['product']??''));
   if($prod!=='') $groups[$key]['items'][$prod]=($groups[$key]['items'][$prod]??0)+1;
   $sn=trim((string)($iv['serial']??'')); if($sn!=='') $groups[$key]['serials'][]=$sn;
 }
 $ordered=[];
 foreach($groups as $g){ if(($g['source']??'')==='carton') $ordered[]=$g; }
 usort($ordered, fn($a,$b)=>strnatcasecmp((string)($a['carton_code']??''),(string)($b['carton_code']??'')));
 if(isset($groups['loose'])) $ordered[]=$groups['loose'];
 if(!$ordered){
   $items=[]; foreach($o['items']??[] as $it){ $prod=trim((string)($it['product']??'')); if($prod==='') continue; $items[$prod]=($items[$prod]??0)+(int)($it['qty']??0); }
   $ordered[]=['carton_code'=>'','source'=>'default','items'=>$items,'serials'=>[]];
 }
 $total=count($ordered); if($total<1) $total=1;
 $out=[];
 foreach($ordered as $i=>$g){
   $parts=[]; foreach(($g['items']??[]) as $prod=>$qty) $parts[]=$prod.' × '.(int)$qty;
   $sourceLabel='پیش‌فرض';
   if(($g['source']??'')==='carton') $sourceLabel='کارتن';
   elseif(($g['source']??'')==='loose') $sourceLabel='خرده / قفسه';
   $out[]=[
     'seq'=>$i+1,
     'total'=>$total,
     'package_text'=>($i+1).'/'.$total,
     'carton_code'=>(string)($g['carton_code']??''),
     'items_line'=>implode(' | ',$parts),
     'serial_count'=>count($g['serials']??[]),
     'source_label'=>$sourceLabel,
     'serials'=>array_values($g['serials']??[]),
   ];
 }
 return $out;
}

if($p==='/export/stocktake.xlsx'){auth();$summary=db(false,fn($s)=>inventory_summary($s));$rows=[['کالا / مدل','نوع موجودی','تعداد ورودی ثبت‌شده','موجودی فعلی','رزرو / تخصیص','خروج قطعی','تعداد کارتن','کنترل تراز','شرح مغایرت']];$ti=0;$tc=0;$tr=0;$to=0;foreach($summary as $r){if(!$r['serial_required']&&$r['incoming']===0&&$r['current']===0)continue;$rows[]=[$r['product'],$r['serial_required']?'مخزن سریال':'موجودی دستی',(int)$r['incoming'],(int)$r['current'],(int)$r['reserved'],(int)$r['outgoing'],(int)$r['cartons'],$r['balance_ok']?'صحیح':'مغایرت',implode(' | ',$r['issues']??[])];$ti+=(int)$r['incoming'];$tc+=(int)$r['current'];$tr+=(int)$r['reserved'];$to+=(int)$r['outgoing'];}$rows[]=['جمع کل','',$ti,$tc,$tr,$to,'',$ti===($tc+$tr+$to)?'صحیح':'مغایرت',''];xlsx_out('ghadir-stocktaking-report.xlsx',$rows);}
if($p==='/logo.png'){header('Content-Type:image/png');readfile(__DIR__.'/logo.png');exit;}if($p==='/mobile-scan'){header('Content-Type:text/html; charset=utf-8');readfile(__DIR__.'/mobile.html');exit;}if($p==='/healthz'){db(false,fn($s)=>true);out(['ok'=>true,'driver'=>ghadir_storage_driver(),'version'=>'V5.3.2.1-MYSQL-OFFERS-SMS-MOBILE']);}
if($p==='/api/login'&&$m==='POST'){if(($_SESSION['login_block_until']??0)>time())fail('تلاش ناموفق زیاد است؛ چند دقیقه بعد دوباره امتحان کنید',429);$x=input();$n=trim($x['Username']??$x['username']??'');$pw=$x['Password']??$x['password']??'';$u=db(false,function($s)use($n,$pw){foreach($s['users'] as $u)if(strcasecmp((string)($u['username']??''),$n)===0&&!empty($u['active'])){$h=$u['password_hash']??'';$legacy=empty(password_get_info($h)['algo']);$ok=password_verify($pw,$h)||($legacy&&hash_equals($h,hash('sha256','ghadir:'.$pw)));if($ok){$u['_rehash']=$legacy||password_needs_rehash($h,PASSWORD_DEFAULT);return $u;}}return null;});if(!$u){$_SESSION['login_failures']=(int)($_SESSION['login_failures']??0)+1;if($_SESSION['login_failures']>=5)$_SESSION['login_block_until']=time()+300;fail('نام کاربری یا رمز اشتباه است',401);}if(!user_has_staff_role($u))fail('این حساب مخصوص پرتال مشتریان است؛ از بخش پرتال همکاران/مشتریان وارد شوید.',403);$mobile=clean_mobile($n);if(preg_match('/^09\d{9}$/',$mobile)){$conflict=db(false,function($s)use($mobile,$u){foreach($s['users'] as $x){if((int)($x['id']??0)===(int)($u['id']??0))continue;if(is_customer_user($x)&&in_array($mobile,user_mobile_keys($s,$x),true))return true;}return false;});if($conflict)fail('این شماره به حساب مشتری متصل است؛ برای ورود مدیریت از نام کاربری غیرموبایلی استفاده کنید.',409);}if(!empty($u['_rehash']))db(true,function(&$s)use($u,$pw){$i=idx($s['users'],$u['id']);if($i>=0)$s['users'][$i]['password_hash']=password_hash($pw,PASSWORD_DEFAULT);});unset($u['_rehash'],$_SESSION['login_failures'],$_SESSION['login_block_until']);session_regenerate_id(true);$_SESSION['uid']=$u['id'];out(['ok'=>true]);}

if($p==='/api/staff-password-reset/request'&&$m==='POST'){
    if(!sms_template_enabled('staff_otp'))fail('پیامک بازیابی رمز اتوماسیون در تنظیمات پیامک غیرفعال است',503);
    $x=input();$identity=trim((string)($x['identity']??''));if($identity==='')fail('نام کاربری یا شماره موبایل را وارد کنید');$otp=(string)random_int(100000,999999);
    $r=db(true,function(&$s)use($identity,$otp){
        $mobileIdentity=clean_mobile($identity);$ui=-1;
        foreach($s['users'] as $i=>$u){if(empty($u['active'])||!user_has_staff_role($u))continue;$storedMobile=clean_mobile($u['mobile']??'');if(strcasecmp((string)($u['username']??''),$identity)===0||($storedMobile!==''&&$storedMobile===$mobileIdentity)){$ui=$i;break;}}
        if($ui<0)return null;$u=$s['users'][$ui];$mobile=clean_mobile($u['mobile']??'');if(!preg_match('/^09\d{9}$/',$mobile)){$_userMobile=clean_mobile($u['username']??'');if(preg_match('/^09\d{9}$/',$_userMobile))$mobile=$_userMobile;}
        if(!preg_match('/^09\d{9}$/',$mobile))return ['missing_mobile'=>true];
        $latest=null;foreach(array_reverse($s['staff_password_reset_requests']??[]) as $q)if((int)($q['user_id']??0)===(int)$u['id']&&($q['status']??'')==='otp_sent'){$latest=$q;break;}
        if($latest&&time()-strtotime((string)($latest['created_at']??''))<60)return ['rate_limited'=>true,'mobile'=>$mobile,'id'=>(int)($latest['id']??0)];
        $req=['id'=>$s['next_staff_password_reset']++,'user_id'=>(int)$u['id'],'username'=>$u['username']??'','mobile'=>$mobile,'status'=>'otp_pending','otp_hash'=>password_hash($otp,PASSWORD_DEFAULT),'expires_at'=>date('Y-m-d H:i:s',time()+300),'attempts'=>0,'created_at'=>now(),'completed_at'=>''];
        $s['staff_password_reset_requests'][]=$req;return ['id'=>$req['id'],'mobile'=>$mobile,'rate_limited'=>false];
    });
    if($r&&!empty($r['missing_mobile']))fail('برای این کاربر شماره موبایل بازیابی ثبت نشده است؛ مدیر سیستم باید شماره موبایل کاربر را در بخش کاربران ثبت کند',400);
    if(!$r)out(['ok'=>true,'otp_required'=>false,'sms_sent'=>false,'message'=>'اگر حساب فعال باشد، امکان بازیابی برای آن فعال خواهد بود.']);
    if(!empty($r['rate_limited']))out(['ok'=>true,'otp_required'=>true,'sms_sent'=>false,'rate_limited'=>true,'message'=>'کد قبلی هنوز معتبر است؛ تا یک دقیقه از درخواست قبلی دوباره پیامک ارسال نمی‌شود.']);
    $send=sms_send_mobile($r['mobile'],'کد بازیابی رمز اتوماسیون قدیر پارتنر: '.$otp.' — اعتبار ۵ دقیقه',['kind'=>'staff_otp','vars'=>['otp'=>$otp]]);
    if(empty($send['sent'])){
        db(true,function(&$s)use($r,$send){foreach($s['staff_password_reset_requests']??[] as &$q)if((int)($q['id']??0)===(int)$r['id']){$q['status']='sms_failed';$q['sms_error_code']=(string)($send['error_code']??$send['error']??'');$q['sms_error_message']=(string)($send['error_message']??'');unset($q['otp_hash']);break;}unset($q);});
        fail(sms_public_failure_message($send),503);
    }
    db(true,function(&$s)use($r){foreach($s['staff_password_reset_requests']??[] as &$q)if((int)($q['id']??0)===(int)$r['id']){$q['status']='otp_sent';break;}unset($q);});
    out(['ok'=>true,'otp_required'=>true,'sms_sent'=>true,'message'=>'کد یکبارمصرف ارسال شد.']);
}
if($p==='/api/staff-password-reset/confirm'&&$m==='POST'){$x=input();$identity=trim((string)($x['identity']??''));$otp=trim((string)($x['otp']??''));$pw=(string)($x['password']??'');if($identity===''||!preg_match('/^\d{6}$/',$otp)||strlen($pw)<8)fail('نام کاربری، کد ۶ رقمی و رمز جدید حداقل ۸ کاراکتری الزامی است');out(db(true,function(&$s)use($identity,$otp,$pw){$mobileIdentity=clean_mobile($identity);$ui=-1;foreach($s['users'] as $i=>$u){if(empty($u['active'])||!user_has_staff_role($u))continue;$storedMobile=clean_mobile($u['mobile']??'');if(strcasecmp((string)($u['username']??''),$identity)===0||($storedMobile!==''&&$storedMobile===$mobileIdentity)){$ui=$i;break;}}if($ui<0)fail('کد بازیابی معتبر نیست یا منقضی شده است',400);$uid=(int)$s['users'][$ui]['id'];$ri=-1;for($i=count($s['staff_password_reset_requests']??[])-1;$i>=0;$i--){$q=$s['staff_password_reset_requests'][$i];if((int)($q['user_id']??0)===$uid&&($q['status']??'')==='otp_sent'){$ri=$i;break;}}if($ri<0)fail('کد بازیابی معتبر نیست یا منقضی شده است',400);$r=&$s['staff_password_reset_requests'][$ri];if(strtotime((string)($r['expires_at']??''))<time()){$r['status']='expired';fail('کد بازیابی منقضی شده است؛ دوباره کد بگیرید',400);}if((int)($r['attempts']??0)>=5){$r['status']='locked';fail('تعداد تلاش مجاز تمام شده است؛ دوباره کد بگیرید',429);}$r['attempts']=(int)($r['attempts']??0)+1;if(!password_verify($otp,(string)($r['otp_hash']??'')))fail('کد یکبارمصرف صحیح نیست',400);$s['users'][$ui]['password_hash']=password_hash($pw,PASSWORD_DEFAULT);$r['status']='completed';$r['completed_at']=now();unset($r['otp_hash']);return ['ok'=>true,'message'=>'رمز عبور تغییر کرد؛ اکنون وارد اتوماسیون شوید.'];}));}

if($p==='/api/logout'){session_destroy();out(['ok'=>true]);}if($p==='/api/me'){$u=auth();out(['id'=>$u['id'],'username'=>$u['username'],'roles'=>$u['roles']]);}
if($p==='/api/password'&&$m==='POST'){$u=auth();$x=input();if(strlen($x['new']??'')<6)fail('رمز جدید حداقل ۶ کاراکتر باشد');db(true,function(&$s)use($u,$x){$i=idx($s['users'],$u['id']);$h=$s['users'][$i]['password_hash'];if(!password_verify($x['current']??'',$h)&&!hash_equals($h,hash('sha256','ghadir:'.($x['current']??''))))fail('رمز فعلی اشتباه است');$s['users'][$i]['password_hash']=password_hash($x['new'],PASSWORD_DEFAULT);});out(['ok'=>true]);}
if($p==='/api/products'&&$m==='GET'){auth();out($PRODUCTS);}
if($p==='/api/catalog'&&$m==='GET'){auth();out(db(false,function($s){$r=[];foreach($s['products'] as $i=>$p){$p['price']=(int)($p['price']??($i<3?[12500000,11500000,10800000][$i]:0));$physical=!empty($p['serial_required'])?warehouse_free_stock($s,$p['name']):(int)($p['physical_stock']??$p['stock']??($i<3?[120,75,40][$i]:0));$reserved=!empty($p['serial_required'])?reserved_unassigned_qty($s,$p['name']):0;$orderable=max(0,$physical-$reserved);$configured=array_key_exists('sellable_stock',$p)?max(0,(int)$p['sellable_stock']):$orderable;$sellable=min($configured,$orderable);$p['physical_stock']=$physical;$p['reserved_stock']=$reserved;$p['ready_reserved_stock']=ready_to_ship_reserved_qty($s,$p['name']);$p['max_sellable_stock']=$orderable;$p['sellable_stock']=$sellable;$p['stock']=$sellable;$p['stock_source']=!empty($p['serial_required'])?'warehouse_limit':'manual';$p['available']=array_key_exists('available',$p)?(bool)$p['available']:true;$p['description']=$p['description']??'';$defaults=['panel_cash'=>$p['price'],'panel_7d'=>0,'panel_1m'=>0,'serial_1_50'=>0,'serial_51_200'=>0,'sales_agent'=>0];$p['prices']=array_map('intval',array_merge($defaults,is_array($p['prices']??null)?$p['prices']:[]));$p['credit_available']=!empty($p['credit_available']);$r[]=$p;}return $r;}));}
if($p==='/api/catalog/update'&&$m==='POST'){$u=auth(['admin']);$x=input();out(db(true,function(&$s)use($x){$name=trim($x['name']??'');foreach($s['products'] as &$p)if(($p['name']??'')===$name){$keys=['panel_cash','panel_7d','panel_1m','serial_1_50','serial_51_200','sales_agent'];$prices=[];foreach($keys as $k)$prices[$k]=max(0,(int)($x['prices'][$k]??0));$p['prices']=$prices;$p['price']=$prices['panel_cash']?:max(0,(int)($x['price']??0));$requested=max(0,(int)($x['stock']??0));if(!empty($p['serial_required'])){$physical=warehouse_free_stock($s,$name);$reserved=reserved_unassigned_qty($s,$name);$max=max(0,$physical-$reserved);if($requested>$max)fail('موجودی قابل فروش نمی‌تواند از موجودی واقعی قابل سفارش انبار بیشتر باشد (حداکثر '.number_format($max).' دستگاه)');$p['sellable_stock']=$requested;}else{$p['stock']=$requested;$p['physical_stock']=max($requested,(int)($p['physical_stock']??0));$p['sellable_stock']=$requested;}$p['available']=!empty($x['available']);$p['credit_available']=!empty($x['credit_available']);$p['description']=trim($x['description']??'');$p['price_updated_at']=now();return $p;}fail('محصول پیدا نشد',404);}));}
if($p==='/api/offers'&&$m==='GET'){$u=auth();out(db(false,function($s)use($u){$all=$s['special_offers']??[];$usage=offer_usage_rows($s);if(in_array('admin',$u['roles']??[])){foreach($all as &$o){$oid=(int)($o['id']??0);$o['usage_count']=count(array_filter($usage,fn($x)=>(int)($x['offer_id']??0)===$oid));}unset($o);return array_values(array_reverse($all));}$today=date('Y-m-d');$cid=(int)($u['customer_id']??0);$rows=array_values(array_filter(array_reverse($all),fn($o)=>!empty($o['active'])&&(($o['start_date']??'')===''||$o['start_date']<=$today)&&(($o['end_date']??'')===''||$o['end_date']>=$today)&&(($o['audience']??'all')==='all'||in_array($cid,array_map('intval',$o['customer_ids']??[]),true))));foreach($rows as &$o)$o['used_by_customer']=!empty($o['one_time_per_customer'])&&offer_used_by_customer($s,(int)($o['id']??0),$cid);unset($o);return $rows;}));}
if($p==='/api/offers/usage'&&$m==='GET'){auth(['admin']);out(db(false,function($s){$rows=[];foreach(offer_usage_rows($s) as $u){$ci=idx($s['customers'],$u['customer_id']??0);$oi=idx($s['orders'],$u['order_id']??0);$rows[]=array_merge($u,['customer_name'=>$ci>=0?($s['customers'][$ci]['name']??''):'','order_number'=>$oi>=0?($s['orders'][$oi]['number']??''):'']);}usort($rows,fn($a,$b)=>strcmp((string)($b['used_at']??''),(string)($a['used_at']??'')));return $rows;}));}
if($p==='/api/offers/save'&&$m==='POST'){
    auth(['admin']);$x=input();
    $saved=db(true,function(&$s)use($x){
        $title=trim((string)($x['title']??''));if($title==='')fail('عنوان پیشنهاد الزامی است');
        $audience=($x['audience']??'all')==='selected'?'selected':'all';
        $customerIds=array_values(array_unique(array_filter(array_map('intval',$x['customer_ids']??[]),fn($id)=>$id>0)));
        if($audience==='selected'&&!$customerIds)fail('حداقل یک مشتری برای این طرح انتخاب کنید');
        foreach($customerIds as $cid)if(idx($s['customers'],$cid)<0)fail('یکی از مشتریان انتخاب‌شده معتبر نیست');
        $discountType=in_array(($x['discount_type']??'none'),['none','percent','amount'],true)?(string)$x['discount_type']:'none';
        $discountValue=max(0,(int)($x['discount_value']??0));
        if($discountType==='percent'&&($discountValue<1||$discountValue>100))fail('درصد تخفیف باید بین ۱ تا ۱۰۰ باشد');
        if($discountType==='amount'&&$discountValue<1)fail('مبلغ تخفیف باید بیشتر از صفر باشد');
        if($discountType==='none')$discountValue=0;
        $promo=promo_code_norm($x['promo_code']??'');
        if($discountType!=='none'&&$promo==='')fail('برای تخفیف، کد تخفیف الزامی است');
        $id=(int)($x['id']??0);
        $oldOfferIndex=$id?idx($s['special_offers'],$id):-1;
        $wasActive=$oldOfferIndex>=0&&!empty($s['special_offers'][$oldOfferIndex]['active']);
        if($promo!=='')foreach($s['special_offers']??[] as $other)if((int)($other['id']??0)!==$id&&promo_code_norm($other['promo_code']??'')===$promo)fail('این کد تخفیف قبلاً برای طرح دیگری ثبت شده است');
        foreach(['start_date','end_date'] as $key){
            $date=trim((string)($x[$key]??''));
            if($date!==''&&(!preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/',$date,$parts)||!checkdate((int)$parts[2],(int)$parts[3],(int)$parts[1])))fail('تاریخ طرح معتبر نیست');
        }
        if(!empty($x['start_date'])&&!empty($x['end_date'])&&$x['start_date']>$x['end_date'])fail('تاریخ پایان نمی‌تواند قبل از شروع باشد');
        $item=['title'=>$title,'description'=>trim((string)($x['description']??'')),'badge'=>trim((string)($x['badge']??'پیشنهاد ویژه')),'product'=>trim((string)($x['product']??'')),'start_date'=>trim((string)($x['start_date']??'')),'end_date'=>trim((string)($x['end_date']??'')),'active'=>!empty($x['active']),'audience'=>$audience,'customer_ids'=>$audience==='selected'?$customerIds:[],'discount_type'=>$discountType,'discount_value'=>$discountValue,'promo_code'=>$promo,'one_time_per_customer'=>!empty($x['one_time_per_customer']),'updated_at'=>now()];
        if($id){$i=idx($s['special_offers'],$id);if($i<0)fail('پیشنهاد پیدا نشد',404);$s['special_offers'][$i]=array_merge($s['special_offers'][$i],$item);$item=$s['special_offers'][$i];}
        else{$item['id']=$s['next_offer']++;$item['created_at']=now();$s['special_offers'][]=$item;}
        $recipients=[];
        if((array_key_exists('send_sms',$x)?!empty($x['send_sms']):!$wasActive)&&!empty($item['active'])){
            foreach($s['customers']??[] as $c){
                if(!empty($c['deleted']))continue;$cid=(int)($c['id']??0);
                if($audience==='selected'&&!in_array($cid,$customerIds,true))continue;
                $mobile=clean_mobile($c['mobile']??'');if(!preg_match('/^09\d{9}$/',$mobile))continue;
                $recipients[$mobile]=['mobile'=>$mobile,'name'=>$c['name']??''];
            }
        }
        return [$item,array_values($recipients)];
    });
    [$item,$recipients]=$saved;$sent=0;$failed=0;$disabled=0;
    if($recipients){$vars=offer_sms_vars($item);foreach($recipients as $r){$xsend=sms_send_mobile($r['mobile'],'',['kind'=>'offer_published','vars'=>$vars]);if(!empty($xsend['sent']))$sent++;elseif(!empty($xsend['disabled']))$disabled++;else $failed++;}}
    $item['sms_summary']=['requested'=>count($recipients),'sent'=>$sent,'failed'=>$failed,'disabled'=>$disabled];out($item);
}
if($p==='/api/profile/update'&&$m==='POST'){$u=auth(['customer']);$x=input();out(db(true,function(&$s)use($u,$x){$ci=idx($s['customers'],$u['customer_id']??0);$ui=idx($s['users'],$u['id']);if($ci<0||$ui<0)fail('پروفایل مشتری پیدا نشد',404);$name=trim((string)($x['name']??''));if(strlen($name)<3)fail('نام معتبر وارد کنید');foreach(['name','company','province','city','address'] as $k)$s['customers'][$ci][$k]=trim((string)($x[$k]??''));$postal=preg_replace('/\D+/','',(string)($x['postal_code']??''));if($postal!==''&&strlen($postal)!==10)fail('کدپستی باید ۱۰ رقم باشد');$s['customers'][$ci]['postal_code']=$postal;$alt=clean_mobile($x['alternate_mobile']??'');if($alt!==''&&!preg_match('/^09\d{9}$/',$alt))fail('شماره جایگزین معتبر نیست');$primary=clean_mobile($s['users'][$ui]['login_mobile']??$s['users'][$ui]['username']??'');if($alt!==''&&$alt===$primary)fail('شماره جایگزین باید با شماره ورود متفاوت باشد');$currentAlt=clean_mobile($s['users'][$ui]['alternate_mobile']??'');if($alt!==''&&$alt!==$currentAlt&&mobile_identity_in_use($s,$alt,(int)$s['users'][$ui]['id']))fail('شماره جایگزین قبلاً به حساب دیگری متصل است');$s['users'][$ui]['alternate_mobile']=$alt;$s['customers'][$ci]['updated_at']=now();return ['customer'=>$s['customers'][$ci],'username'=>$s['users'][$ui]['username'],'alternate_mobile'=>$alt];}));}
if($p==='/api/products/add'&&$m==='POST'){$u=auth(['admin']);$x=input();out(db(true,function(&$s)use($x){$name=trim($x['name']??'');if($name==='')fail('نام محصول الزامی است');foreach($s['products'] as $v)if(strcasecmp($v['name'],$name)===0)fail('این محصول قبلاً ثبت شده است');$serial=!empty($x['serial_required']);$pattern=trim($x['pattern']??'');if($serial&&$pattern==='')fail('الگوی سریال الزامی است');if($pattern!==''&&@preg_match('/'.$pattern.'/u','')===false)fail('الگوی سریال معتبر نیست');$p=['name'=>$name,'manufacturer'=>trim((string)($x['manufacturer']??'')),'pattern'=>$serial?$pattern:'','example'=>$serial?trim($x['example']??''):'','serial_required'=>$serial];$s['products'][]=$p;return $p;}));}
if($p==='/api/products/edit'&&$m==='POST'){$u=auth(['admin']);$x=input();out(db(true,function(&$s)use($x){$old=trim($x['old_name']??'');$name=trim($x['name']??'');if($old===''||$name==='')fail('نام محصول الزامی است');$i=-1;foreach($s['products'] as $k=>$v)if($v['name']===$old)$i=$k;if($i<0)fail('محصول پیدا نشد',404);foreach($s['products'] as $k=>$v)if($k!==$i&&strcasecmp($v['name'],$name)===0)fail('محصولی با این نام وجود دارد');$serial=!empty($x['serial_required']);$pattern=trim($x['pattern']??'');if($serial&&$pattern==='')fail('الگوی سریال الزامی است');if($pattern!==''&&@preg_match('/'.$pattern.'/u','')===false)fail('الگوی سریال معتبر نیست');$s['products'][$i]=array_merge($s['products'][$i],['name'=>$name,'manufacturer'=>trim((string)($x['manufacturer']??'')),'pattern'=>$serial?$pattern:'','example'=>$serial?trim($x['example']??''):'','serial_required'=>$serial]);if($old!==$name){foreach($s['orders'] as &$o)foreach($o['items'] as &$it)if(($it['product']??'')===$old)$it['product']=$name;foreach($s['inventory'] as &$iv)if(($iv['product']??'')===$old)$iv['product']=$name;foreach($s['cartons'] as &$c)if(($c['product']??'')===$old)$c['product']=$name;}return $s['products'][$i];}));}
if($p==='/api/customers'&&$m==='GET'){$u=auth();out(db(false,function($s)use($u){if(in_array('customer',$u['roles']??[],true)){foreach($s['customers'] as $c)if((int)($c['id']??0)===(int)($u['customer_id']??0))return [$c];return [];}return array_values(array_filter($s['customers'],fn($x)=>empty($x['deleted'])));}));}
if($p==='/api/customers/add'){$u=auth(['sales']);$x=input();$r=db(true,function(&$s)use($x){if(!trim($x['name']??''))fail('نام مشتری الزامی است');$x['id']=$s['next_customer']++;$x['deleted']=false;$x['contacts']=$x['contacts']??[];$s['customers'][]=$x;return $x;});out($r);}
if($p==='/api/customers/edit'){$u=auth(['sales']);$x=input();out(db(true,function(&$s)use($x){$i=idx($s['customers'],$x['id']??0);if($i<0)fail('مشتری پیدا نشد',404);$s['customers'][$i]=array_merge($s['customers'][$i],$x);return $s['customers'][$i];}));}
if($p==='/api/customers/delete'){auth(['sales']);$x=input();db(true,function(&$s)use($x){$i=idx($s['customers'],$x['id']??0);if($i<0)fail('مشتری پیدا نشد',404);$s['customers'][$i]['deleted']=true;});out(['ok'=>true]);}
if($p==='/api/customers/import'){auth(['admin']);if(empty($_FILES['file']))fail('فایل انتخاب نشده');$rs=rows_file($_FILES['file']['tmp_name'],$_FILES['file']['name']);$n=db(true,function(&$s)use($rs){$n=0;foreach($rs as $i=>$r){if($i===0||!trim($r[0]??''))continue;$s['customers'][]=['id'=>$s['next_customer']++,'name'=>trim($r[0]),'mobile'=>trim($r[1]??''),'code'=>trim($r[2]??''),'company'=>trim($r[3]??''),'province'=>trim($r[4]??''),'city'=>trim($r[5]??''),'address'=>trim($r[6]??''),'deleted'=>false,'contacts'=>[]];$n++;}return $n;});out(['added'=>$n]);}
if($p==='/api/orders'&&$m==='GET'){$u=auth();out(db(false,function($s)use($u){$orders=array_map(fn($o)=>gp_decorate_order($s,$o),$s['orders']);if(in_array('customer',$u['roles']??[],true))return array_values(array_filter($orders,fn($o)=>(int)($o['customer_id']??0)===(int)($u['customer_id']??0)));return $orders;}));}
if($p==='/api/orders/add'){$u=auth(['sales']);$x=input();$o=db(true,function(&$s)use($x,$u){$ci=idx($s['customers'],$x['customer_id']??0);if($ci<0||!empty($s['customers'][$ci]['deleted']))fail('مشتری پیدا نشد');if(empty($x['items'])||!is_array($x['items']))fail('حداقل یک کالا الزامی است');$id=$s['next_order']++;$c=$s['customers'][$ci];$items=[];$total=0;$seenItems=[];foreach($x['items'] as $it){$name=trim((string)($it['product']??''));$qty=(int)($it['qty']??0);if($name===''||$qty<1)fail('کالا و تعداد معتبر الزامی است');if(isset($seenItems[$name]))fail('هر مدل را فقط یک‌بار در سفارش ثبت کنید');$seenItems[$name]=true;$pi=product_index_by_name($s,$name);if($pi<0)fail('کالا پیدا نشد: '.$name);$pinfo=$s['products'][$pi];$priceKey=trim((string)($it['price_key']??'panel_cash'));$allowedKeys=['panel_cash','panel_7d','panel_1m','serial_1_50','serial_51_200','sales_agent'];if(!in_array($priceKey,$allowedKeys,true))$priceKey='panel_cash';$price=(int)($pinfo['prices'][$priceKey]??$pinfo['price']??0);if($price<0)$price=0;$labels=['panel_cash'=>'ثبت در پنل — نقد','panel_7d'=>'ثبت در پنل — هفت‌روزه','panel_1m'=>'ثبت در پنل — یک‌ماهه','serial_1_50'=>'سریال آزاد — ۱ تا ۵۰','serial_51_200'=>'سریال آزاد — ۵۱ تا ۲۰۰','sales_agent'=>'عامل فروش'];$items[]=['product'=>$name,'qty'=>$qty,'price_key'=>$priceKey,'price_label'=>$labels[$priceKey]??'ثبت در پنل — نقد','unit_price'=>$price,'line_total'=>$price*$qty,'serials'=>[]];$total+=$price*$qty;}$o=$x;$o['id']=$id;$o['number']=sprintf('GHP-%06d',$id);$o['customer_id']=(int)$c['id'];$o['customer_name']=$c['name'];$o=array_merge($o,gp_effective_sender($s,$o));$o['items']=$items;$o['estimated_total']=$total;$o['approved_total']=$total;$o['approval_status']='تأیید شده';$o['payment_status']='پرداخت نشده';$o['payment_method']='';$o['payment_method_label']='';$o['payment_details']=[];$o['check_status']='';$o['credit_status']='';$o['installment_status']='';$o['status']='ثبت شده';$o['created_by']=$u['username'];$o['created_at']=$o['updated_at']=now();$o['history']=[];hist($o,$u['username'],'سفارش ثبت شد؛ قیمت مبنا در زمان ثبت ذخیره شد و تخصیص سریال فقط دستی انجام می‌شود');$s['orders'][]=$o;return $o;});out($o);}
if($p==='/api/orders/edit'){$u=auth(['sales']);$x=input();out(db(true,function(&$s)use($x,$u){$i=idx($s['orders'],$x['id']??0);if($i<0)fail('سفارش پیدا نشد');$o=&$s['orders'][$i];if(in_array($o['status']??'',['ارسال شد','تحویل شد','لغو شد'],true))fail('ویرایش سفارش در این مرحله مجاز نیست');$customerId=array_key_exists('customer_id',$x)?(int)$x['customer_id']:(int)($o['customer_id']??0);$ci=idx($s['customers'],$customerId);if($ci<0||!empty($s['customers'][$ci]['deleted']))fail('مشتری معتبر نیست');if(array_key_exists('items',$x)){if(!is_array($x['items'])||!$x['items'])fail('حداقل یک کالا الزامی است');$oldBy=[];foreach($o['items']??[] as $it)$oldBy[$it['product']??'']=$it;$newItems=[];$total=0;$seen=[];foreach($x['items'] as $it){$name=trim((string)($it['product']??''));$qty=(int)($it['qty']??0);if($name===''||$qty<1)fail('کالا و تعداد معتبر الزامی است');if(isset($seen[$name]))fail('هر مدل را فقط یک‌بار در سفارش ثبت کنید');$seen[$name]=true;$pi=product_index_by_name($s,$name);if($pi<0)fail('کالا پیدا نشد: '.$name);$prev=$oldBy[$name]??[];$serials=array_values($prev['serials']??[]);if(count($serials)>$qty)fail('برای کاهش تعداد «'.$name.'» ابتدا سریال‌های مازاد را آزاد کنید');$priceKey=trim((string)($it['price_key']??($prev['price_key']??'panel_cash')));$labels=['panel_cash'=>'ثبت در پنل — نقد','panel_7d'=>'ثبت در پنل — هفت‌روزه','panel_1m'=>'ثبت در پنل — یک‌ماهه','serial_1_50'=>'سریال آزاد — ۱ تا ۵۰','serial_51_200'=>'سریال آزاد — ۵۱ تا ۲۰۰','sales_agent'=>'عامل فروش'];if(!isset($labels[$priceKey]))$priceKey='panel_cash';$pinfo=$s['products'][$pi];$price=(int)($pinfo['prices'][$priceKey]??$pinfo['price']??0);$newItems[]=['product'=>$name,'qty'=>$qty,'price_key'=>$priceKey,'price_label'=>$labels[$priceKey],'unit_price'=>$price,'line_total'=>$price*$qty,'serials'=>$serials];$total+=$price*$qty;}foreach($oldBy as $name=>$prev)if(!isset($seen[$name])&&!empty($prev['serials']))fail('برای حذف «'.$name.'» ابتدا سریال‌های تخصیص‌یافته را آزاد کنید');$o['items']=$newItems;$o['estimated_total']=$total;$o['approved_total']=$total;}$o['customer_id']=$customerId;$o['customer_name']=$s['customers'][$ci]['name'];$o=array_merge($o,gp_effective_sender($s,$o));foreach(['notes','panels','fros'] as $k)if(array_key_exists($k,$x))$o[$k]=$x[$k];$o['updated_at']=now();hist($o,$u['username'],'سفارش با کنترل مشتری، کالا، مبلغ و سریال‌ها ویرایش شد');return $o;}));}
if($p==='/api/payment'){$u=auth(['finance']);$x=input();out(db(true,function(&$s)use($x,$u){$i=idx($s['orders'],$x['id']??0);if($i<0)fail('سفارش پیدا نشد');$status=trim((string)($x['status']??''));$allowed=['پرداخت نشده','در انتظار تأیید','بیعانه','تسویه کامل','اعتباری','چک','اقساطی'];if(!in_array($status,$allowed,true))fail('وضعیت پرداخت نامعتبر است');$o=&$s['orders'][$i];$prevMethod=(string)($o['payment_method']??'');$o['payment_status']=$status;if($status==='اعتباری'){if($prevMethod!==''&&$prevMethod!=='credit')$o['payment_details']=[];$o['payment_method']='credit';$o['payment_method_label']='خرید اعتباری';$o['credit_status']='تأیید شده';}elseif($status==='چک'){if($prevMethod!==''&&$prevMethod!=='check')$o['payment_details']=[];$o['payment_method']='check';$o['payment_method_label']='پرداخت با چک';if(($o['check_status']??'')!=='تأیید شده')$o['check_status']='در انتظار تأیید';}elseif($status==='اقساطی'){if($prevMethod!==''&&$prevMethod!=='installment')$o['payment_details']=[];$o['payment_method']='installment';$o['payment_method_label']='پرداخت اقساطی';$o['installment_status']='تأیید شده';}elseif($status==='پرداخت نشده'){$o['payment_method']='';$o['payment_method_label']='';$o['payment_details']=[];$o['check_status']='';$o['credit_status']='';$o['installment_status']='';}elseif($status!=='چک'){$o['check_status']='';}if($status==='تسویه کامل')$o['paid_at']=$o['paid_at']??now();$o['payment_updated_at']=now();$o['payment_updated_by']=$u['username'];hist($o,$u['username'],'نحوه تسویه به «'.$status.'» تغییر کرد');return $o;}));}
if($p==='/api/check/approve'){$u=auth(['finance']);$x=input();out(db(true,function(&$s)use($x,$u){$i=idx($s['orders'],$x['id']??0);if($i<0)fail('سفارش پیدا نشد');$s['orders'][$i]['check_status']='تأیید شده';$s['orders'][$i]['check_approved_by']=$u['username'];$s['orders'][$i]['check_approved_at']=now();hist($s['orders'][$i],$u['username'],'چک تأیید شد');return $s['orders'][$i];}));}
if($p==='/api/incomplete/request'){$u=auth(['prep']);$x=input();out(db(true,function(&$s)use($x,$u){$i=idx($s['orders'],$x['id']??0);if($i<0)fail('سفارش پیدا نشد');if(order_serial_complete($s['orders'][$i]))fail('سریال‌های سفارش کامل است و نیازی به مجوز نیست');$reason=trim($x['reason']??'');if($reason==='')fail('علت ارسال ناقص الزامی است');$s['orders'][$i]['incomplete_status']='در انتظار تأیید مدیر';$s['orders'][$i]['incomplete_reason']=$reason;$s['orders'][$i]['incomplete_requested_by']=$u['username'];$s['orders'][$i]['incomplete_requested_at']=now();unset($s['orders'][$i]['incomplete_approved_by'],$s['orders'][$i]['incomplete_approved_at']);hist($s['orders'][$i],$u['username'],'درخواست مجوز ارسال ناقص ثبت شد: '.$reason);return $s['orders'][$i];}));}
if($p==='/api/incomplete/approve'){$u=auth(['admin']);$x=input();out(db(true,function(&$s)use($x,$u){$i=idx($s['orders'],$x['id']??0);if($i<0)fail('سفارش پیدا نشد');if(($s['orders'][$i]['incomplete_status']??'')!=='در انتظار تأیید مدیر')fail('درخواست ارسال ناقص در انتظار تأیید نیست');$s['orders'][$i]['incomplete_status']='تأیید شده';$s['orders'][$i]['incomplete_approved_by']=$u['username'];$s['orders'][$i]['incomplete_approved_at']=now();hist($s['orders'][$i],$u['username'],'مجوز ارسال ناقص توسط مدیر تأیید شد');return $s['orders'][$i];}));}
if($p==='/api/status'){$u=auth(['prep']);$x=input();$r=db(true,function(&$s)use($x,$u){$i=idx($s['orders'],$x['id']??0);if($i<0)fail('سفارش پیدا نشد');$st=['ثبت شده','در حال آماده سازی','آماده ارسال','ارسال شد','تحویل شد'];$old=$s['orders'][$i]['status'];$new=$x['status']??'';$oldPos=array_search($old,$st,true);$newPos=array_search($new,$st,true);if($new==='لغو شد'){if(in_array($old,['ارسال شد','تحویل شد','لغو شد'],true))fail('لغو در این مرحله مجاز نیست');if(empty($x['cancel_reason']))fail('علت لغو الزامی است');}else{if($oldPos===false||$newPos===false)fail('مرحله سفارش نامعتبر است');if($newPos<$oldPos)fail('بازگشت به مرحله قبل مجاز نیست');$pay=$s['orders'][$i]['payment_status']??'';if(in_array($new,['ارسال شد','تحویل شد'],true)&&!payment_allows_shipping($s['orders'][$i]))fail('ارسال و تحویل فقط پس از تأیید روش پرداخت مجاز است');}if(in_array($new,['آماده ارسال','ارسال شد','تحویل شد'],true)&&!order_serial_complete($s['orders'][$i])&&($s['orders'][$i]['incomplete_status']??'')!=='تأیید شده')fail('سریال‌های سفارش ناقص است؛ ابتدا درخواست ارسال ناقص باید توسط مدیر تأیید شود');$shipping=trim((string)($x['shipping_type']??($s['orders'][$i]['shipping_type']??'')));$tracking=trim((string)($x['tracking_code']??($s['orders'][$i]['tracking_code']??'')));if($new==='ارسال شد'&&$shipping==='')fail('نوع ارسال الزامی است');if($new==='ارسال شد'&&in_array($shipping,['تیپاکس','چاپار'],true)&&$tracking==='')fail('برای ارسال با تیپاکس یا چاپار، کد مرسوله الزامی است');if($new==='ارسال شد'&&($s['orders'][$i]['payment_status']??'')==='چک'&&($s['orders'][$i]['check_status']??'')!=='تأیید شده')fail('چک هنوز تأیید نشده است');$oldTracking=trim((string)($s['orders'][$i]['tracking_code']??''));
$changed=$old!==$new;
$trackingChanged=$tracking!==''&&$tracking!==$oldTracking;
if($new==='ارسال شد'&&$changed){
  $exitItems=gp_exit_items($s,$s['orders'][$i]);
  $hasSerialProduct=false;
  foreach($s['orders'][$i]['items']??[] as $eit)if(gp_product_requires_serial($s,$eit['product']??'')){$hasSerialProduct=true;break;}
  if($hasSerialProduct&&!$exitItems)fail('برای خروج حداقل یک دستگاه دارای سریال باید ثبت شده باشد');
  $s['orders'][$i]['exit_items']=$exitItems;
  $s['orders'][$i]['exit_device_qty']=gp_exit_device_qty($exitItems);
  $s['orders'][$i]['partial_exit']=!order_serial_complete($s['orders'][$i]);
  $s['orders'][$i]['partial_exit_at']=now();
  $s['orders'][$i]['partial_exit_by']=$u['username'];
}foreach(['status','cancel_reason','cancel_note'] as $k)if(isset($x[$k]))$s['orders'][$i][$k]=$x[$k];if($new==='لغو شد')release_order_serials($s,$s['orders'][$i]);if($shipping!=='')$s['orders'][$i]['shipping_type']=$shipping;if($tracking!==''){$s['orders'][$i]['tracking_code']=$tracking;$s['orders'][$i]['tracking_updated_at']=now();$s['orders'][$i]['tracking_updated_by']=$u['username'];}$s['orders'][$i]['updated_at']=now();$histAction=$changed?'وضعیت به «'.$new.'» تغییر کرد':'اطلاعات ارسال به‌روزرسانی شد';
if($new==='ارسال شد'&&$changed&&!empty($s['orders'][$i]['partial_exit'])){
  $histAction='خروج ناقص ثبت شد: '.(int)($s['orders'][$i]['exit_device_qty']??0).' دستگاه دارای سریال خارج شد';
}
hist($s['orders'][$i],$u['username'],$histAction);$ci=idx($s['customers'],$s['orders'][$i]['customer_id']);return [$s['orders'][$i],$ci<0?[]:$s['customers'][$ci],$changed,$trackingChanged];});[$order,$customer,$changed,$trackingChanged]=$r;if($changed){if($order['status']==='ثبت شده')sms_status($customer,$order,'وضعیت سفارش '.$order['number'].' به «ثبت شده» تغییر کرد.','status_registered');elseif($order['status']==='در حال آماده سازی')sms_status($customer,$order,'سفارش '.$order['number'].' در حال آماده سازی است.','status_prep');elseif($order['status']==='آماده ارسال')sms_status($customer,$order,'سفارش '.$order['number'].' آماده ارسال است.','ready');elseif($order['status']==='ارسال شد')sms_status($customer,$order,tracking_message($order),'shipped');elseif($order['status']==='تحویل شد')sms_status($customer,$order,'سفارش '.$order['number'].' تحویل شد. از خرید شما سپاسگزاریم.','delivered');elseif($order['status']==='لغو شد')sms_status($customer,$order,'سفارش '.$order['number'].' لغو شد.'.(!empty($order['cancel_reason'])?' علت: '.$order['cancel_reason']:''),'status_cancelled');}elseif($trackingChanged&&in_array($order['shipping_type']??'',['تیپاکس','چاپار'],true))sms_status($customer,$order,'کد مرسوله سفارش '.$order['number'].' برای '.$order['shipping_type'].': '.$order['tracking_code'],'tracking');out($order);}
if($p==='/api/shipping/tracking'&&$m==='POST'){$u=auth(['prep']);$x=input();$r=db(true,function(&$s)use($x,$u){$i=idx($s['orders'],$x['id']??0);if($i<0)fail('سفارش پیدا نشد');$carrier=trim((string)($x['shipping_type']??$s['orders'][$i]['shipping_type']??''));$code=trim((string)($x['tracking_code']??''));if(!in_array($carrier,['تیپاکس','چاپار'],true))fail('ثبت کد مرسوله برای تیپاکس یا چاپار فعال است');if($code==='')fail('کد مرسوله الزامی است');$s['orders'][$i]['shipping_type']=$carrier;$s['orders'][$i]['tracking_code']=$code;$s['orders'][$i]['tracking_updated_at']=now();$s['orders'][$i]['tracking_updated_by']=$u['username'];$s['orders'][$i]['updated_at']=now();hist($s['orders'][$i],$u['username'],'کد مرسوله '.$carrier.' ثبت/ویرایش شد: '.$code);$ci=idx($s['customers'],$s['orders'][$i]['customer_id']);return [$s['orders'][$i],$ci<0?[]:$s['customers'][$ci]];});[$order,$customer]=$r;sms_status($customer,$order,'کد مرسوله سفارش '.$order['number'].' برای '.$order['shipping_type'].': '.$order['tracking_code'],'tracking');out($order);}
if($p==='/api/inventory'&&$m==='GET'){auth();out(db(false,fn($s)=>$s['inventory']));}
if($p==='/api/scan'){$u=auth(['prep']);$x=input();out(db(true,function(&$s)use($x,$u){$oi=idx($s['orders'],$x['id']??0);if($oi<0)fail('سفارش پیدا نشد');$sn=strtoupper(trim($x['serial']??''));if(!valid_serial($x['product']??'',$sn))fail('سریال خارج از الگوی مجاز است');foreach($s['inventory'] as $v)if(strcasecmp($v['serial'],$sn)===0&&!empty($v['order_id']))fail('سریال قبلاً تخصیص یافته است');$it=-1;foreach($s['orders'][$oi]['items'] as $i=>$v)if($v['product']===$x['product'])$it=$i;if($it<0)fail('کالا در سفارش نیست');if(count($s['orders'][$oi]['items'][$it]['serials']) >= $s['orders'][$oi]['items'][$it]['qty'])fail('تعداد سریال کامل است');$ii=-1;foreach($s['inventory'] as $i=>$v)if(strcasecmp($v['serial'],$sn)===0)$ii=$i;if($ii<0){$ii=count($s['inventory']);$s['inventory'][]=['id'=>$s['next_serial']++,'product'=>$x['product'],'serial'=>$sn,'added_at'=>now(),'added_by'=>$u['username'],'order_id'=>0,'order_number'=>''];}$s['inventory'][$ii]['order_id']=$s['orders'][$oi]['id'];$s['inventory'][$ii]['order_number']=$s['orders'][$oi]['number'];$s['inventory'][$ii]['imei']=$x['imei']??'';$s['orders'][$oi]['items'][$it]['serials'][]=$sn;$s['orders'][$oi]['updated_at']=now();hist($s['orders'][$oi],$u['username'],'سریال '.$sn.' ثبت شد؛ مرحله سفارش تغییر نکرد');return $s['orders'][$oi];}));}
if($p==='/api/order/allocate'&&$m==='POST'){$u=auth(['prep']);$x=input();out(db(true,function(&$s)use($x,$u){$oi=idx($s['orders'],$x['id']??0);if($oi<0)fail('سفارش پیدا نشد');if(order_is_locked_for_serial_change($s['orders'][$oi])||($s['orders'][$oi]['status']??'')==='لغو شد')fail('در این مرحله تخصیص سریال مجاز نیست');$product=trim((string)($x['product']??''));$code=strtoupper(trim((string)($x['code']??'')));if($product===''||$code==='')fail('مدل و شماره باکس یا سریال الزامی است');$ii=-1;foreach($s['orders'][$oi]['items'] as $k=>$it)if(($it['product']??'')===$product){$ii=$k;break;}if($ii<0)fail('این مدل در سفارش وجود ندارد');$current=array_values(array_unique($s['orders'][$oi]['items'][$ii]['serials']??[]));$remaining=(int)($s['orders'][$oi]['items'][$ii]['qty']??0)-count($current);if($remaining<1)fail('ظرفیت سریال این قلم کامل است');$carton=null;foreach($s['cartons']??[] as $c)if(strcasecmp((string)($c['code']??''),$code)===0){$carton=$c;break;}$indexes=[];$source='serial';if($carton){if(($carton['product']??'')!==$product)fail('مدل باکس با قلم سفارش مطابقت ندارد');foreach($s['inventory'] as $k=>$iv)if((int)($iv['carton_id']??0)===(int)($carton['id']??0)&&empty($iv['order_id']))$indexes[]=$k;if(!$indexes)fail('این باکس سریال آزاد ندارد');if(count($indexes)>$remaining)fail('تعداد سریال آزاد باکس از ظرفیت باقی‌مانده سفارش بیشتر است');$source='carton';}else{foreach($s['inventory'] as $k=>$iv)if(strcasecmp((string)($iv['serial']??''),$code)===0){if(!empty($iv['order_id']))fail('این سریال قبلاً به سفارش '.($iv['order_number']??'دیگر').' تخصیص یافته است');if(($iv['product']??'')!==$product)fail('مدل این سریال با قلم سفارش مطابقت ندارد');$indexes[]=$k;break;}if(!$indexes)fail('شماره باکس یا سریال آزاد در مخزن پیدا نشد');}$assigned=[];foreach($indexes as $k){$sn=$s['inventory'][$k]['serial'];if(in_array($sn,$current,true))continue;$s['inventory'][$k]['order_id']=$s['orders'][$oi]['id'];$s['inventory'][$k]['order_number']=$s['orders'][$oi]['number'];$current[]=$sn;$assigned[]=$sn;}$s['orders'][$oi]['items'][$ii]['serials']=$current;$s['orders'][$oi]['updated_at']=now();$label=$source==='carton'?'باکس '.$carton['code']:'سریال '.$code;hist($s['orders'][$oi],$u['username'],$label.' با '.count($assigned).' سریال به‌صورت دستی از مخزن تخصیص یافت؛ مرحله سفارش تغییر نکرد');return ['ok'=>true,'assigned'=>count($assigned),'source'=>$source,'label'=>$label,'serials'=>$assigned];}));}

if($p==='/api/order/serial/unassign'||$p==='/api/order/serials/unassign-product'){$u=auth(['prep']);$x=input();out(db(true,function(&$s)use($x,$u,$p){$oi=idx($s['orders'],$x['id']??0);if($oi<0)fail('سفارش پیدا نشد');if(order_is_locked_for_serial_change($s['orders'][$oi])||($s['orders'][$oi]['status']??'')==='لغو شد')fail('بعد از ارسال، تحویل یا لغو، سریال سفارش قابل آزادسازی نیست');foreach($s['orders'][$oi]['items'] as &$it)if($it['product']===($x['product']??'')){$remove=$p==='/api/order/serial/unassign'?[$x['serial']]:$it['serials'];$it['serials']=array_values(array_filter($it['serials'],fn($sn)=>!in_array($sn,$remove)));foreach($s['inventory'] as &$iv)if(in_array($iv['serial'],$remove)){$iv['order_id']=0;$iv['order_number']='';}hist($s['orders'][$oi],$u['username'],count($remove).' سریال آزاد شد');return $s['orders'][$oi];}fail('کالا پیدا نشد');}));}
if($p==='/api/inventory/delete'){$u=auth(['prep']);$x=input();db(true,function(&$s)use($x){$i=idx($s['inventory'],$x['id']??0);if($i<0)fail('سریال پیدا نشد');if(!empty($s['inventory'][$i]['order_id']))fail('ابتدا سریال را آزاد کنید');$iv=$s['inventory'][$i];array_splice($s['inventory'],$i,1);if(!empty($iv['carton_id']))foreach($s['cartons'] as &$c)if($c['id']==$iv['carton_id'])$c['serials']=array_values(array_filter($c['serials'],fn($v)=>$v!==$iv['serial']));});out(['ok'=>true]);}
if($p==='/api/inventory/unassign'){$u=auth(['prep']);$x=input();db(true,function(&$s)use($x){$i=idx($s['inventory'],$x['id']??0);if($i<0)fail('سریال پیدا نشد');$sn=$s['inventory'][$i]['serial'];$oid=(int)($s['inventory'][$i]['order_id']??0);if($oid){$oi=idx($s['orders'],$oid);if($oi>=0&&order_is_locked_for_serial_change($s['orders'][$oi]))fail('بعد از ارسال یا تحویل، سریال سفارش قابل آزادسازی نیست');if($oi>=0)foreach($s['orders'][$oi]['items'] as &$it)$it['serials']=array_values(array_filter($it['serials']??[],fn($v)=>$v!==$sn));}$s['inventory'][$i]['order_id']=0;$s['inventory'][$i]['order_number']='';});out(['ok'=>true]);}
if($p==='/api/inventory/edit'){$u=auth(['prep']);$x=input();out(db(true,function(&$s)use($x){$i=idx($s['inventory'],$x['id']??0);if($i<0)fail('سریال پیدا نشد');$iv=&$s['inventory'][$i];$old=(string)($iv['serial']??'');$new=strtoupper(trim((string)($x['serial']??'')));$product=(string)($iv['product']??'');if($new===''||!valid_serial($product,$new))fail('سریال با الگوی این مدل مطابقت ندارد');foreach($s['inventory'] as $k=>$v)if($k!==$i&&strcasecmp((string)($v['serial']??''),$new)===0)fail('این سریال قبلاً در مخزن وجود دارد');$imei=trim((string)($x['imei']??''));if($imei!==''&&!preg_match('/^\d{15}$/',$imei))fail('IMEI باید ۱۵ رقم باشد');$oid=(int)($iv['order_id']??0);if($oid){$oi=idx($s['orders'],$oid);if($oi>=0&&order_is_locked_for_serial_change($s['orders'][$oi]))fail('بعد از ارسال یا تحویل، ویرایش سریال مجاز نیست');if($oi>=0)foreach($s['orders'][$oi]['items'] as &$it){if(!isset($it['serials'])||!is_array($it['serials']))$it['serials']=[];foreach($it['serials'] as &$sn)if(strcasecmp((string)$sn,$old)===0)$sn=$new;unset($sn);}unset($it);}$cid=(int)($iv['carton_id']??0);$cc=(string)($iv['carton_code']??'');if(!isset($s['cartons'])||!is_array($s['cartons']))$s['cartons']=[];foreach($s['cartons'] as &$c)if(($cid&&((int)($c['id']??0)===$cid))||($cc!==''&&($c['code']??'')===$cc)){if(!isset($c['serials'])||!is_array($c['serials']))$c['serials']=[];foreach($c['serials'] as &$sn)if(strcasecmp((string)$sn,$old)===0)$sn=$new;unset($sn);}unset($c);$iv['serial']=$new;$iv['imei']=$imei;return $iv;}));}
if($p==='/api/inventory/import'||$p==='/api/order/serials/import'){$uu=auth(['prep']);if(empty($_FILES['file']))fail('فایل انتخاب نشده');$rs=rows_file($_FILES['file']['tmp_name'],$_FILES['file']['name']);$added=0;$errs=[];if($p==='/api/inventory/import'){foreach($rs as $r){$prod=trim($r[0]??'');$sn=strtoupper(trim($r[1]??''));if(!$sn||!valid_serial($prod,$sn))continue;db(true,function(&$s)use($prod,$sn,$uu,&$added){foreach($s['inventory'] as $v)if(strcasecmp($v['serial'],$sn)===0)return;$s['inventory'][]=['id'=>$s['next_serial']++,'product'=>$prod,'serial'=>$sn,'order_id'=>0,'order_number'=>'','added_at'=>now(),'added_by'=>$uu['username']];$added++;});}out(['added'=>$added,'errors'=>$errs]);}$oid=(int)($_POST['id']??0);$prod=trim((string)($_POST['product']??''));if(!$oid||$prod==='')fail('سفارش یا مدل دستگاه مشخص نیست');$candidates=[];foreach($rs as $rn=>$r){$sn='';$imei='';foreach($r as $cell){$v=strtoupper(trim((string)$cell));if($sn===''&&valid_serial($prod,$v))$sn=$v;elseif($imei===''&&preg_match('/^\d{15}$/',$v))$imei=$v;}if($sn===''){if(array_filter($r,fn($v)=>trim((string)$v)!==''))$errs[]='ردیف '.($rn+1).': سریال معتبر برای این مدل پیدا نشد';continue;}$candidates[]=['serial'=>$sn,'imei'=>$imei,'row'=>$rn+1];}db(true,function(&$s)use($oid,$prod,$candidates,$uu,&$added,&$errs){$oi=idx($s['orders'],$oid);if($oi<0)fail('سفارش پیدا نشد');if(order_is_locked_for_serial_change($s['orders'][$oi])||($s['orders'][$oi]['status']??'')==='لغو شد')fail('در این مرحله ثبت یا تغییر سریال سفارش مجاز نیست');$it=-1;foreach($s['orders'][$oi]['items'] as $i=>$v)if(($v['product']??'')===$prod){$it=$i;break;}if($it<0)fail('این مدل در سفارش وجود ندارد');$qty=(int)$s['orders'][$oi]['items'][$it]['qty'];foreach($candidates as $c){$sn=$c['serial'];if(count($s['orders'][$oi]['items'][$it]['serials'])>=$qty){$errs[]='ظرفیت سریال این قلم کامل شد؛ ردیف '.$c['row'].' ثبت نشد';continue;}if(in_array($sn,$s['orders'][$oi]['items'][$it]['serials'],true)){$errs[]='ردیف '.$c['row'].': سریال در همین سفارش تکراری است';continue;}$ii=-1;foreach($s['inventory'] as $i=>$iv)if(strcasecmp((string)($iv['serial']??''),$sn)===0){$ii=$i;break;}if($ii>=0&&!empty($s['inventory'][$ii]['order_id'])){$errs[]='ردیف '.$c['row'].': سریال قبلاً به سفارش '.$s['inventory'][$ii]['order_number'].' تخصیص یافته است';continue;}if($ii>=0&&($s['inventory'][$ii]['product']??$prod)!==$prod){$errs[]='ردیف '.$c['row'].': مدل سریال با موجودی مغایرت دارد';continue;}if($ii<0){$ii=count($s['inventory']);$s['inventory'][]=['id'=>$s['next_serial']++,'product'=>$prod,'serial'=>$sn,'added_at'=>now(),'added_by'=>$uu['username'],'order_id'=>0,'order_number'=>''];}$s['inventory'][$ii]['order_id']=$s['orders'][$oi]['id'];$s['inventory'][$ii]['order_number']=$s['orders'][$oi]['number'];if($c['imei']!=='')$s['inventory'][$ii]['imei']=$c['imei'];$s['orders'][$oi]['items'][$it]['serials'][]=$sn;$added++;}if($added){$s['orders'][$oi]['updated_at']=now();hist($s['orders'][$oi],$uu['username'],$added.' سریال از فایل Excel برای «'.$prod.'» ثبت شد');}});out(['added'=>$added,'errors'=>$errs]);}
if($p==='/api/warehouse'&&$m==='GET'){auth();out(db(false,fn($s)=>['cartons'=>$s['cartons'],'inventory'=>$s['inventory'],'connected'=>true]));}
if($p==='/api/warehouse/stock-summary'&&$m==='GET'){auth();out(db(false,fn($s)=>inventory_summary($s)));}
if($p==='/api/warehouse/import'||$p==='/api/warehouse/import-file'){$u=auth(['prep']);if($p==='/api/warehouse/import')$x=input();else{$x=$_POST;$x['serials']=[];$rs=rows_file($_FILES['file']['tmp_name'],$_FILES['file']['name']);foreach($rs as $r)foreach($r as $v)if(valid_serial($x['product']??'',strtoupper(trim($v))))$x['serials'][]=strtoupper(trim($v));}$c=db(true,function(&$s)use($x,$u){$prod=$x['product']??'';$cap=(int)($x['capacity']??0);$ss=array_values(array_unique(array_map(fn($v)=>strtoupper(trim($v)),$x['serials']??[])));if(!in_array($cap,[20,25,30])||!$ss)fail('ظرفیت یا سریال‌ها نامعتبر است');foreach($ss as $sn){if(!valid_serial($prod,$sn))fail('سریال نامعتبر: '.$sn);foreach($s['inventory'] as $iv)if($iv['serial']===$sn)fail('سریال تکراری: '.$sn);}if(count($ss)<$cap&&empty($x['allow_incomplete']))fail('کارتن ناقص را تأیید کنید');$code=carton_code($s,$prod);$id=$s['next_carton']++;$c=['id'=>$id,'code'=>$code,'manufacturer_box_no'=>$code,'product'=>$prod,'color'=>$x['color']??'','capacity'=>$cap,'incomplete_reason'=>$x['incomplete_reason']??'','serials'=>$ss,'created_at'=>now(),'created_by'=>$u['username']];$s['cartons'][]=$c;foreach($ss as $sn)$s['inventory'][]=['id'=>$s['next_serial']++,'product'=>$prod,'serial'=>$sn,'carton_id'=>$id,'carton_code'=>$code,'shelf_level'=>count($ss)<$cap?(int)($x['shelf_level']??1):0,'order_id'=>0,'order_number'=>'','added_at'=>now(),'added_by'=>$u['username']];return $c;});out($c);}
if($p==='/api/warehouse/carton/delete'){$u=auth(['prep']);$x=input();out(db(true,function(&$s)use($x){$i=idx($s['cartons'],$x['carton_id']??0);if($i<0)fail('باکس پیدا نشد');$id=$s['cartons'][$i]['id'];foreach($s['inventory'] as $iv)if(($iv['carton_id']??0)==$id&&!empty($iv['order_id']))fail('باکس دارای سریال تخصیص‌یافته است');$n=0;$s['inventory']=array_values(array_filter($s['inventory'],function($v)use($id,&$n){if(($v['carton_id']??0)==$id){$n++;return false;}return true;}));$code=$s['cartons'][$i]['code'];array_splice($s['cartons'],$i,1);return ['deleted_carton'=>$code,'deleted_serials'=>$n];}));}
if($p==='/api/warehouse/serial/delete'){$u=auth(['prep']);$x=input();db(true,function(&$s)use($x){foreach($s['inventory'] as $i=>$iv)if(($iv['carton_id']??0)==($x['carton_id']??0)&&$iv['serial']===($x['serial']??'')){if(!empty($iv['order_id']))fail('سریال تخصیص یافته است');array_splice($s['inventory'],$i,1);foreach($s['cartons'] as &$c)if($c['id']==$x['carton_id'])$c['serials']=array_values(array_filter($c['serials'],fn($v)=>$v!==$x['serial']));return;}fail('سریال پیدا نشد');});out(['ok'=>true]);}
if($p==='/api/warehouse/assign-carton'&&$m==='POST'){$u=auth(['prep']);$x=input();out(db(true,function(&$s)use($x,$u){$ci=idx($s['cartons'],$x['carton_id']??0);$oi=idx($s['orders'],$x['order_id']??0);if($ci<0||$oi<0)fail('باکس یا سفارش پیدا نشد');$c=$s['cartons'][$ci];$ii=-1;foreach($s['orders'][$oi]['items'] as $k=>$it)if(($it['product']??'')===($c['product']??'')){$ii=$k;break;}if($ii<0)fail('مدل این باکس در سفارش وجود ندارد');$free=[];foreach($s['inventory'] as $k=>$iv)if(($iv['carton_id']??0)===$c['id']&&empty($iv['order_id']))$free[]=$k;if(!$free)fail('این باکس سریال آزاد ندارد');$remaining=(int)$s['orders'][$oi]['items'][$ii]['qty']-count($s['orders'][$oi]['items'][$ii]['serials']??[]);if(count($free)>$remaining)fail('ظرفیت باقی‌مانده سفارش کمتر از تعداد آزاد باکس است');foreach($free as $k){$s['inventory'][$k]['order_id']=$s['orders'][$oi]['id'];$s['inventory'][$k]['order_number']=$s['orders'][$oi]['number'];$s['orders'][$oi]['items'][$ii]['serials'][]=$s['inventory'][$k]['serial'];}$s['orders'][$oi]['updated_at']=now();hist($s['orders'][$oi],$u['username'],'باکس '.$c['code'].' با '.count($free).' سریال از مخزن تخصیص یافت؛ مرحله سفارش تغییر نکرد');return ['ok'=>true,'assigned'=>count($free),'carton'=>$c['code'],'order'=>$s['orders'][$oi]['number']];}));}
if($p==='/api/users'&&$m==='GET'){auth(['admin']);out(db(false,fn($s)=>array_map(fn($u)=>['id'=>$u['id'],'username'=>$u['username'],'mobile'=>$u['mobile']??'','roles'=>$u['roles'],'active'=>$u['active']],$s['users'])));}
if($p==='/api/users'&&$m==='POST'){$a=auth(['admin']);$x=input();out(db(true,function(&$s)use($x){$username=trim((string)($x['Username']??''));$mobile=clean_mobile($x['Mobile']??'');if($username==='')fail('نام کاربری الزامی است');if(!preg_match('/^09\d{9}$/',$mobile))fail('شماره موبایل معتبر برای بازیابی رمز الزامی است');if(strlen((string)($x['Password']??''))<6)fail('رمز حداقل ۶ کاراکتر باشد');if(mobile_identity_in_use($s,$mobile))fail('این شماره موبایل قبلاً به یک حساب دیگر متصل است');foreach($s['users'] as $v)if(strcasecmp((string)($v['username']??''),$username)===0)fail('این نام کاربری قبلاً وجود دارد');$u=['id'=>$s['next_user']++,'username'=>$username,'mobile'=>$mobile,'password_hash'=>password_hash($x['Password'],PASSWORD_DEFAULT),'roles'=>$x['Roles'],'active'=>true];$s['users'][]=$u;unset($u['password_hash']);return $u;}));}
if($p==='/api/users/edit'){$a=auth(['admin']);$x=input();out(db(true,function(&$s)use($x){$i=idx($s['users'],$x['id']??0);if($i<0)fail('کاربر پیدا نشد');if(array_key_exists('username',$x)){$username=trim((string)$x['username']);$mobile=clean_mobile($username);if(preg_match('/^09\d{9}$/',$mobile)&&mobile_identity_in_use($s,$mobile,(int)$s['users'][$i]['id']))fail('این شماره موبایل قبلاً به حساب دیگری یا مشتری متصل است');foreach($s['users'] as $k=>$v)if($k!==$i&&strcasecmp((string)($v['username']??''),$username)===0)fail('این نام کاربری قبلاً وجود دارد');$s['users'][$i]['username']=$username;}if(array_key_exists('mobile',$x)){$mobile=clean_mobile($x['mobile']??'');if($mobile!==''&&!preg_match('/^09\d{9}$/',$mobile))fail('شماره موبایل معتبر نیست');if($mobile!==''&&mobile_identity_in_use($s,$mobile,(int)$s['users'][$i]['id']))fail('این شماره موبایل قبلاً به حساب دیگری متصل است');$s['users'][$i]['mobile']=$mobile;}foreach(['roles','active'] as $k)if(array_key_exists($k,$x))$s['users'][$i][$k]=$x[$k];if(!empty($x['password']))$s['users'][$i]['password_hash']=password_hash($x['password'],PASSWORD_DEFAULT);$u=$s['users'][$i];unset($u['password_hash']);return $u;}));}
if($p==='/api/customer-accounts'&&$m==='GET'){auth(['admin']);out(db(false,function($s){$r=[];foreach($s['users'] as $u)if(in_array('customer',$u['roles']??[])){$i=idx($s['customers'],$u['customer_id']??0);$c=$i<0?[]:$s['customers'][$i];$r[]=['id'=>$u['id'],'login_mobile'=>$u['login_mobile']??$c['mobile']??'','alternate_mobile'=>$u['alternate_mobile']??'','active'=>!empty($u['active']),'customer_id'=>(int)($u['customer_id']??0),'customer_name'=>$c['name']??''];}return $r;}));}
if($p==='/api/customer-accounts'&&$m==='POST'){auth(['admin']);$x=input();out(db(true,function(&$s)use($x){$cid=(int)($x['customer_id']??0);$ci=idx($s['customers'],$cid);if($ci<0)fail('مشتری پیدا نشد');$mobile=clean_mobile($x['mobile']??$s['customers'][$ci]['mobile']??'');$pw=(string)($x['password']??'');if(!preg_match('/^09\d{9}$/',$mobile)||strlen($pw)<8)fail('شماره موبایل معتبر و رمز حداقل ۸ کاراکتری الزامی است');if(mobile_identity_in_use($s,$mobile))fail('این شماره قبلاً به یک حساب کاربری متصل است؛ حساب تکراری نسازید');$alt=clean_mobile($x['alternate_mobile']??'');if($alt!==''){if(!preg_match('/^09\d{9}$/',$alt))fail('شماره جایگزین معتبر نیست');if($alt===$mobile)fail('شماره جایگزین باید با شماره ورود متفاوت باشد');if(mobile_identity_in_use($s,$alt))fail('شماره جایگزین قبلاً به حساب دیگری متصل است');}$u=['id'=>$s['next_user']++,'username'=>$mobile,'login_mobile'=>$mobile,'alternate_mobile'=>$alt,'password_hash'=>password_hash($pw,PASSWORD_DEFAULT),'roles'=>['customer'],'active'=>true,'customer_id'=>$cid,'created_at'=>now()];$s['users'][]=$u;unset($u['password_hash']);return $u;}));}
if($p==='/api/customer-accounts/update'&&$m==='POST'){auth(['admin']);$x=input();out(db(true,function(&$s)use($x){$i=idx($s['users'],$x['id']??0);if($i<0||!is_customer_user($s['users'][$i]))fail('حساب مشتری پیدا نشد');$mobile=clean_mobile($x['mobile']??'');if(!preg_match('/^09\d{9}$/',$mobile))fail('شماره ورود معتبر نیست');$currentMobile=clean_mobile($s['users'][$i]['login_mobile']??$s['users'][$i]['username']??'');if($mobile!==$currentMobile&&mobile_identity_in_use($s,$mobile,(int)$s['users'][$i]['id']))fail('این شماره به حساب دیگری متصل است');$s['users'][$i]['username']=$mobile;$s['users'][$i]['login_mobile']=$mobile;$s['users'][$i]['roles']=normalized_user_roles($s['users'][$i]);$alt=clean_mobile($x['alternate_mobile']??'');if($alt!==''){if(!preg_match('/^09\d{9}$/',$alt))fail('شماره جایگزین معتبر نیست');if($alt===$mobile)fail('شماره جایگزین باید با شماره ورود متفاوت باشد');$currentAlt=clean_mobile($s['users'][$i]['alternate_mobile']??'');if($alt!==$currentAlt&&mobile_identity_in_use($s,$alt,(int)$s['users'][$i]['id']))fail('شماره جایگزین قبلاً به حساب دیگری متصل است');}$s['users'][$i]['alternate_mobile']=$alt;$s['users'][$i]['active']=array_key_exists('active',$x)?!empty($x['active']):$s['users'][$i]['active'];if(!empty($x['password'])){if(strlen($x['password'])<8)fail('رمز حداقل ۸ کاراکتر باشد');$s['users'][$i]['password_hash']=password_hash($x['password'],PASSWORD_DEFAULT);}return ['ok'=>true];}));}
if($p==='/api/registration-requests'&&$m==='GET'){auth(['admin']);out(db(false,function($s){$r=$s['registration_requests']??[];foreach($r as &$x)unset($x['password_hash']);usort($r,function($a,$b){return strcmp($b['created_at']??'',$a['created_at']??'');});return $r;}));}
if($p==='/api/registration-requests/review'&&$m==='POST'){auth(['admin']);$x=input();out(db(true,function(&$s)use($x){$i=idx($s['registration_requests'],$x['id']??0);if($i<0)fail('درخواست پیدا نشد');$r=&$s['registration_requests'][$i];if(($r['status']??'pending')!=='pending')fail('این درخواست قبلاً بررسی شده است');$action=$x['action']??'';if($action==='reject'){$r['status']='rejected';$r['reviewed_at']=now();$r['reviewed_by']=$_SESSION['uid'];unset($r['password_hash']);return ['ok'=>true,'status'=>'rejected'];}if($action!=='approve')fail('عملیات نامعتبر است');$mobile=clean_mobile($r['mobile']??'');if(mobile_identity_in_use($s,$mobile))fail('این شماره قبلاً به یک حساب متصل است');$cid=$s['next_customer']++;$s['customers'][]=['id'=>$cid,'name'=>$r['name'],'mobile'=>$mobile,'code'=>'WEB-'.str_pad((string)$cid,5,'0',STR_PAD_LEFT),'company'=>$r['company']??'','province'=>'','city'=>$r['city']??'','address'=>$r['address']??'','notes'=>'ثبت‌نام از پرتال مشتریان','deleted'=>false,'contacts'=>[]];$s['users'][]=['id'=>$s['next_user']++,'username'=>$mobile,'login_mobile'=>$mobile,'alternate_mobile'=>'','password_hash'=>$r['password_hash'],'roles'=>['customer'],'active'=>true,'customer_id'=>$cid];$r['status']='approved';$r['customer_id']=$cid;$r['reviewed_at']=now();$r['reviewed_by']=$_SESSION['uid'];unset($r['password_hash']);return ['ok'=>true,'status'=>'approved','customer_id'=>$cid];}));}
if($p==='/api/password-reset/requests'&&$m==='GET'){auth(['admin']);out(db(false,function($s){$r=$s['password_reset_requests']??[];usort($r,function($a,$b){return strcmp($b['created_at']??'',$a['created_at']??'');});return $r;}));}
if($p==='/api/password-reset/complete'&&$m==='POST'){$u=auth(['admin']);$x=input();$pw=(string)($x['password']??'');if(strlen($pw)<8)fail('رمز جدید حداقل ۸ کاراکتر باشد');out(db(true,function(&$s)use($x,$pw,$u){$i=idx($s['password_reset_requests'],$x['id']??0);if($i<0)fail('درخواست پیدا نشد');$r=&$s['password_reset_requests'][$i];if(($r['status']??'pending')!=='pending')fail('این درخواست قبلاً انجام شده است');$ui=idx($s['users'],$r['user_id']??0);if($ui<0||!in_array('customer',$s['users'][$ui]['roles']??[]))fail('حساب مشتری پیدا نشد');$s['users'][$ui]['password_hash']=password_hash($pw,PASSWORD_DEFAULT);$r['status']='completed';$r['reviewed_at']=now();$r['reviewed_by']=$u['username'];return ['ok'=>true];}));}
if($p==='/api/customer-order/cancel'&&$m==='POST'){$u=auth(['admin']);$x=input();$r=db(true,function(&$s)use($x,$u){$i=idx($s['orders'],$x['id']??0);if($i<0)fail('سفارش پیدا نشد');$o=&$s['orders'][$i];if(in_array($o['status']??'',['ارسال شد','تحویل شد','لغو شد']))fail('لغو سفارش در این مرحله مجاز نیست');$reason=trim((string)($x['reason']??''));if($reason==='')fail('علت لغو الزامی است');release_order_serials($s,$o);$o['status']='لغو شد';$o['approval_status']='لغو شد';$o['cancel_reason']=$reason;$o['cancel_note']=trim((string)($x['note']??''));$o['cancelled_by']=$u['username'];$o['cancelled_at']=$o['updated_at']=now();hist($o,$u['username'],'سفارش توسط ادمین لغو شد: '.$reason);$ci=idx($s['customers'],$o['customer_id']??0);return [$o,$ci<0?[]:$s['customers'][$ci]];});[$order,$customer]=$r;sms_status($customer,$order,'سفارش '.$order['number'].' توسط ادمین لغو شد. علت: '.$order['cancel_reason'],'status_cancelled');out($order);}
if($p==='/api/customer-order/approve'&&$m==='POST'){$u=auth(['admin','sales']);$x=input();$r=db(true,function(&$s)use($x,$u){$i=idx($s['orders'],$x['id']??0);if($i<0)fail('سفارش پیدا نشد');$o=&$s['orders'][$i];if(($o['approval_status']??'')==='تأیید شده')fail('سفارش قبلاً تأیید شده است');$o['approved_total']=max(0,(int)($x['total']??$o['estimated_total']??0));$o['approval_status']='تأیید شده';$o['status']='ثبت شده';$o['approved_by']=$u['username'];$o['approved_at']=$o['updated_at']=now();hist($o,$u['username'],'سفارش مشتری تأیید شد؛ تخصیص سریال فقط دستی انجام می‌شود');$ci=idx($s['customers'],$o['customer_id']);return [$o,$ci<0?[]:$s['customers'][$ci]];});[$order,$customer]=$r;sms_status($customer,$order,'سفارش '.$order['number'].' تأیید شد. مبلغ: '.number_format($order['approved_total']).' تومان','order_approved');out($order);}

if($p==='/api/reports/sales'&&$m==='GET'){auth(['sales','admin','viewer']);$period=$_GET['period']??'monthly';if(!in_array($period,['daily','weekly','monthly','quarterly','yearly','custom'],true))$period='monthly';$from=normalize_jalali_input($_GET['from']??'');$to=normalize_jalali_input($_GET['to']??'');if($from!==''&&$to!==''&&$from>$to)fail('بازه تاریخ نامعتبر است');out(db(false,function($s)use($period,$from,$to){$orders=sales_orders($s);if($from!==''||$to!=='')$orders=sales_orders_in_range($orders,$from,$to);$series=sales_series($orders,$period,$from,$to);$total=array_sum(array_column($series,'amount'));$count=array_sum(array_column($series,'orders'));$qty=array_sum(array_column($series,'qty'));return ['period'=>$period,'from'=>$from,'to'=>$to,'series'=>$series,'total_amount'=>$total,'total_orders'=>$count,'total_qty'=>$qty];}));}
if($p==='/api/reports/customers'&&$m==='GET'){auth(['sales','admin','viewer']);out(db(false,function($s){$rows=[];foreach($s['customers']??[] as $c){if(!empty($c['deleted']))continue;$orders=sales_orders($s,(int)($c['id']??0));$m1=period_stats_from_orders($orders,30);$m3=period_stats_from_orders($orders,90);$rows[]=['customer_id'=>(int)($c['id']??0),'name'=>$c['name']??'','company'=>$c['company']??'','code'=>$c['code']??'','mobile'=>$c['mobile']??'','month'=>$m1,'three_months'=>$m3];}usort($rows,fn($a,$b)=>($b['three_months']['amount']??0)<=>($a['three_months']['amount']??0));return $rows;}));}
if($p==='/api/sms/templates'&&$m==='GET'){auth(['admin']);out(db(false,function($s){$defs=sms_template_definitions();$rows=[];foreach($defs as $key=>$d){$c=sms_template_config_from_state($s,$key);$rows[]=['key'=>$key,'category'=>$c['category'],'label'=>$c['label'],'enabled'=>!empty($c['enabled']),'text'=>(string)$c['text']];}return $rows;}));}
if($p==='/api/sms/templates/save'&&$m==='POST'){auth(['admin']);$x=input();$key=trim((string)($x['key']??''));$defs=sms_template_definitions();if(!isset($defs[$key]))fail('نوع پیامک معتبر نیست',404);$text=trim((string)($x['text']??''));if($text==='')fail('متن پیامک نمی‌تواند خالی باشد');if(strlen($text)>4000)fail('متن پیامک بیش از حد طولانی است');$enabled=!empty($x['enabled']);out(db(true,function(&$s)use($key,$text,$enabled){if(!isset($s['settings']['sms_templates'])||!is_array($s['settings']['sms_templates']))$s['settings']['sms_templates']=[];$s['settings']['sms_templates'][$key]=['text'=>$text,'enabled'=>$enabled];$c=sms_template_config_from_state($s,$key);return ['ok'=>true,'key'=>$key,'enabled'=>!empty($c['enabled']),'text'=>$c['text']];}));}
if($p==='/api/sms/templates/reset'&&$m==='POST'){auth(['admin']);$x=input();$key=trim((string)($x['key']??''));$defs=sms_template_definitions();if($key!==''&&!isset($defs[$key]))fail('نوع پیامک معتبر نیست',404);out(db(true,function(&$s)use($key){if(!isset($s['settings']['sms_templates'])||!is_array($s['settings']['sms_templates']))$s['settings']['sms_templates']=[];if($key==='')$s['settings']['sms_templates']=[];else unset($s['settings']['sms_templates'][$key]);return ['ok'=>true];}));}
if($p==='/api/sms/test'&&$m==='POST'){auth(['admin']);$x=input();$mobile=clean_mobile($x['mobile']??'');if(!preg_match('/^09\d{9}$/',$mobile))fail('شماره موبایل معتبر وارد کنید');$message=trim((string)($x['message']??''));if($message==='')$message='پیام آزمایشی سامانه قدیر پرداخت';out(sms_send_mobile($mobile,$message,['kind'=>'test']));}
if($p==='/api/sms/outbox'&&$m==='GET'){auth(['admin']);out(db(false,fn($s)=>array_slice(array_reverse($s['sms_outbox']??[]),0,100)));}
if($p==='/api/sms/admin-order-settings'&&$m==='GET'){auth(['admin']);out(db(false,function($s){$mobiles=admin_order_sms_mobiles($s['settings']??[]);return ['mobile'=>$mobiles[0]??'','mobiles'=>$mobiles];}));}
if($p==='/api/sms/admin-order-settings'&&$m==='POST'){auth(['admin']);$x=input();$mobiles=normalize_admin_sms_mobiles($x['mobiles']??($x['mobile']??''));out(db(true,function(&$s)use($mobiles){$s['settings']['admin_order_sms_mobiles']=$mobiles;$s['settings']['admin_order_sms_mobile']=$mobiles[0]??'';return ['ok'=>true,'mobile'=>$mobiles[0]??'','mobiles'=>$mobiles];}));}
if($p==='/api/settings'){$u=auth(['admin']);if($m==='GET')out(db(false,function($s){$x=array_merge(gp_print_defaults(),$s['settings']);$x['backup_interval']='روزانه توسط هاست';$x['backup_path']='storage/Backups';$x['backup_keep']=120;return $x;}));$x=input();db(true,function(&$s)use($x){$s['settings']=array_merge($s['settings'],$x);});out(['ok'=>true]);}
if($p==='/api/storage-info'&&$m==='GET'){$u=auth(['admin']);out(ghadir_storage_info());}
if($p==='/api/backup'){$u=auth(['admin']);out(['path'=>ghadir_backup_snapshot()]);}
if($p==='/api/network'){auth(['admin']);$scheme=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')?'https':'http';out([$scheme.'://'.$_SERVER['HTTP_HOST']]);}
if($p==='/api/notifications'){auth();out([]);}
if($p==='/print/warehouse-carton-labels'){
 auth();$from=trim((string)($_GET['from']??''));$to=trim((string)($_GET['to']??''));$product=trim((string)($_GET['product']??''));$pdf=!empty($_GET['pdf']);$download=!empty($_GET['download']);
 $rows=db(false,function($s)use($from,$to,$product){$r=[];foreach($s['cartons']??[] as $c){$d=jalali_date_value($c['created_at']??'');if($d===''||($from!==''&&$d<$from)||($to!==''&&$d>$to)||($product!==''&&($c['product']??'')!==$product))continue;$c['_serials']=carton_serials_from_state($s,$c);$c['_jdate']=$d;$r[]=$c;}usort($r,fn($a,$b)=>strcmp((string)($a['created_at']??''),(string)($b['created_at']??'')));return $r;});
 if(!$rows)fail('در بازه انتخابی کارتنی برای چاپ وجود ندارد',404);
 $labels='';$serialTotal=0;foreach($rows as $c){$serials=array_values($c['_serials']??[]);$serialTotal+=count($serials);$maxLen=0;foreach($serials as $sn)$maxLen=max($maxLen,strlen((string)$sn));$cols=$maxLen>15?2:3;$serialHtml=implode('',array_map(fn($v)=>'<span>'.htmlspecialchars($v,ENT_QUOTES,'UTF-8').'</span>',$serials));$labels.='<article class="label"><div class="label-head"><b class="code">'.htmlspecialchars($c['code']??'',ENT_QUOTES,'UTF-8').'</b><span class="qty">'.count($serials).' سریال</span></div><div class="product">'.htmlspecialchars($c['product']??'',ENT_QUOTES,'UTF-8').'</div><div class="serials" style="grid-template-columns:repeat('.$cols.',minmax(0,1fr))">'.$serialHtml.'</div></article>';}
 header('Content-Type:text/html; charset=utf-8');if($download)header('Content-Disposition: attachment; filename="ghadir-carton-labels-a4-'.date('Ymd-His').'.html"');echo '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>لیبل A4 مخزن کارتن‌ها</title><style>@page{size:A4 portrait;margin:6mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Tahoma,Arial;color:#07192d;background:#fff}.printbar{direction:rtl;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:9px;padding:9px;background:#eef3f8;position:sticky;top:0;z-index:5}.printbar button{border:0;border-radius:9px;background:#102a43;color:#fff;padding:9px 16px;font-family:inherit}.sheet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:2.5mm;padding:0;direction:rtl}.label{min-height:32mm;border:1.2px solid #111;border-radius:2.4mm;padding:2.2mm;break-inside:avoid;page-break-inside:avoid;background:#fff;overflow:hidden}.label-head{display:flex;direction:ltr;justify-content:space-between;align-items:center;gap:2mm;border-bottom:.35mm solid #111;padding-bottom:1.1mm}.code{font:900 4.6mm/1 Georgia,Times,serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qty{direction:rtl;font:700 2.4mm Tahoma;color:#555;white-space:nowrap}.product{direction:rtl;text-align:right;font:900 3mm/1.25 Tahoma,Arial;margin:1.3mm 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.serials{display:grid;column-gap:1.2mm;row-gap:.45mm;direction:ltr;text-align:center;font:700 2.05mm/1.08 Consolas,monospace;white-space:nowrap}.serials span{min-width:0;overflow:hidden;text-overflow:clip;border-bottom:.15mm dotted #ccd2d8;padding:.25mm 0}.serials:empty:after{content:"بدون سریال ثبت‌شده";grid-column:1/-1;font:700 2.5mm Tahoma;color:#777;direction:rtl;padding:2mm}@media print{.printbar{display:none}.sheet{gap:2mm}.label{border-color:#333}}@media(max-width:700px){.sheet{grid-template-columns:1fr}.label{min-height:auto}}</style></head><body><div class="printbar"><b>'.count($rows).' کارتن · '.$serialTotal.' سریال</b><button onclick="window.print()">چاپ / ذخیره PDF A4</button></div><main class="sheet">'.$labels.'</main>'.($pdf?'<script>setTimeout(()=>window.print(),350)</script>':'').'</body></html>';exit;
}
if($p==='/print/warehouse-serial-labels'){
 auth();$from=trim((string)($_GET['from']??''));$to=trim((string)($_GET['to']??''));$product=trim((string)($_GET['product']??''));$download=!empty($_GET['download']);
 $rows=db(false,function($s)use($from,$to,$product){$r=[];foreach($s['inventory']??[] as $v){$d=jalali_date_value($v['added_at']??'');if($d===''||($from!==''&&$d<$from)||($to!==''&&$d>$to)||($product!==''&&($v['product']??'')!==$product))continue;$v['_jdate']=$d;$r[]=$v;}usort($r,function($a,$b){return strcmp(implode('|',[$a['added_at']??'',$a['product']??'',$a['carton_code']??'',$a['serial']??'']),implode('|',[$b['added_at']??'',$b['product']??'',$b['carton_code']??'',$b['serial']??'']));});return $r;});
 if(!$rows)fail('در بازه انتخابی سریالی برای چاپ وجود ندارد',404);
 $patterns=['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'];
 $barcode=function($text)use($patterns){$text=strtoupper(trim((string)$text));$codes=[104];for($i=0;$i<strlen($text);$i++){$n=ord($text[$i])-32;if($n<0||$n>94)$n=0;$codes[]=$n;}$sum=104;for($i=1;$i<count($codes);$i++)$sum+=$codes[$i]*$i;$codes[]=$sum%103;$codes[]=106;$x=8;$bars='';foreach($codes as $code){$pat=$patterns[$code];for($i=0;$i<strlen($pat);$i++){$w=(int)$pat[$i]*2;if($i%2===0)$bars.='<rect x="'.$x.'" y="2" width="'.$w.'" height="42"/>';$x+=$w;}}$width=$x+8;return '<svg class="barcode" viewBox="0 0 '.$width.' 46" preserveAspectRatio="none" aria-label="'.htmlspecialchars($text,ENT_QUOTES,'UTF-8').'">'.$bars.'</svg>';};
 $labels='';foreach($rows as $v){$loc=!empty($v['carton_code'])?'کارتن '.$v['carton_code']:(!empty($v['shelf_level'])?'قفسه '.$v['shelf_level']:'ورود دستی');$labels.='<article class="label"><div class="meta"><b>'.htmlspecialchars($v['product']??'',ENT_QUOTES,'UTF-8').'</b><span>'.htmlspecialchars($loc,ENT_QUOTES,'UTF-8').'</span></div>'.$barcode($v['serial']??'').'<div class="serial">'.htmlspecialchars($v['serial']??'',ENT_QUOTES,'UTF-8').'</div><div class="date">ورود: '.htmlspecialchars($v['_jdate'],ENT_QUOTES,'UTF-8').'</div></article>';}
 header('Content-Type:text/html; charset=utf-8');if($download)header('Content-Disposition: attachment; filename="ghadir-warehouse-labels-'.date('Ymd-His').'.html"');echo '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>چاپ گروهی لیبل سریال‌ها</title><style>@page{size:A4 portrait;margin:7mm}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial;color:#102a43}.printbar{display:flex;justify-content:center;align-items:center;gap:12px;padding:10px;background:#eef3f8;position:sticky;top:0;z-index:2}.printbar button{border:0;border-radius:8px;background:#102a43;color:#fff;padding:9px 18px;font-family:inherit;cursor:pointer}.sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;direction:rtl}.label{height:28mm;border:1px dashed #8091a5;border-radius:2mm;padding:1.6mm;overflow:hidden;break-inside:avoid;background:#fff}.meta{display:flex;justify-content:space-between;gap:2mm;font-size:8.5px;white-space:nowrap;overflow:hidden}.meta b{overflow:hidden;text-overflow:ellipsis}.meta span{font-weight:700;color:#a94f00}.barcode{display:block;width:100%;height:11mm;fill:#000;margin-top:1mm}.serial{direction:ltr;text-align:center;font:700 10px Consolas,monospace;letter-spacing:.3px;line-height:1.15}.date{text-align:left;font-size:7px;color:#536579;margin-top:.3mm}@media print{.printbar{display:none}.sheet{gap:1.5mm}.label{border-color:#555}}</style></head><body><div class="printbar"><b>'.count($rows).' لیبل آماده چاپ</b><button onclick="window.print()">چاپ همه لیبل‌ها</button></div><main class="sheet">'.$labels.'</main></body></html>';exit;
}
if($p==='/print/tsc-test'){
 auth();$key=trim((string)($_GET['profile']??'box'));if(!in_array($key,['label','order','box','roll12','roll14','roll16'],true))$key='label';
 $set=db(false,fn($s)=>array_merge(gp_print_defaults(),$s['settings']??[]));$pr=gp_print_profile($set,$key);
 $w=$pr['w'];$h=$pr['h'];$x=$pr['x'];$y=$pr['y'];$gap=$pr['gap'];$name=['label'=>'لیبل واحد چاپ','order'=>'جزئیات سفارش','box'=>'باکس عمومی','roll12'=>'باکس رول ۱۲ متری','roll14'=>'باکس رول ۱۴ متری','roll16'=>'باکس رول ۱۶ متری'][$key];
 header('Content-Type:text/html; charset=utf-8');echo '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تست TSC</title><style>
 @page{size:'.$w.'mm '.$h.'mm;margin:0}
 *{box-sizing:border-box}
 html,body{margin:0!important;padding:0!important;width:'.$w.'mm!important;height:'.$h.'mm!important;overflow:hidden!important;background:#fff;font-family:Tahoma,Arial}
 .toolbar{position:fixed;left:3mm;top:3mm;z-index:99}
 .toolbar button{padding:7px 12px;background:#102a43;color:#fff;border:0;border-radius:6px;font-family:Tahoma}
 .label{position:absolute;top:0;right:0;width:'.$w.'mm;height:'.$h.'mm;padding:3mm;border:.35mm solid #111;transform:translate('.$x.'mm,'.$y.'mm);transform-origin:top right;overflow:hidden;background:#fff}
 .edge{position:absolute;width:5mm;height:5mm;border-color:#111;border-style:solid}
 .e1{right:0;top:0;border-width:.5mm .5mm 0 0}.e2{left:0;top:0;border-width:.5mm 0 0 .5mm}.e3{right:0;bottom:0;border-width:0 .5mm .5mm 0}.e4{left:0;bottom:0;border-width:0 0 .5mm .5mm}
 .info{position:absolute;top:7mm;right:7mm;left:7mm;background:#fff;padding:2mm;border:.25mm solid #bbb;font-size:10px;line-height:1.8}
 @media print{.toolbar{display:none!important}html,body{width:'.$w.'mm!important;height:'.$h.'mm!important}}
 </style></head><body><div class="toolbar"><button onclick="window.print()">چاپ تست TSC</button></div><main class="label"><i class="edge e1"></i><i class="edge e2"></i><i class="edge e3"></i><i class="edge e4"></i><div class="info"><b>TSC TTP-244 Pro · 203 DPI</b><br>'.$name.'<br>Paper: '.$w.' × '.$h.' mm<br>Gap: '.$gap.' mm<br>Offset X/Y: '.$x.' / '.$y.' mm<br>Scale: 100% · Margin: 0 · Portrait<br><b>مبدأ چاپ: گوشه بالا-راست</b></div></main></body></html>';exit;
}
if($p==='/print/order-label'){
 $guard=auth();$id=(int)($_GET['id']??0);
 $d=db(false,function($s)use($id,$guard){$i=idx($s['orders'],$id);if($i<0)return null;$o=$s['orders'][$i];if(in_array('customer',$guard['roles']??[],true)&&(int)($o['customer_id']??0)!==(int)($guard['customer_id']??0))fail('دسترسی ندارید',403);$ci=idx($s['customers'],$o['customer_id']??0);return [$o,$ci<0?[]:$s['customers'][$ci],array_merge(gp_print_defaults(),$s['settings']??[]),gp_effective_sender($s,$o)];});
 if(!$d)fail('سفارش پیدا نشد',404);[$o,$c,$set,$sender]=$d;
 gp_print_order_shipping_label($o,$c,$sender,gp_print_profile($set,'order'));exit;
}

if($p==='/qr/order-info'){
 $token=trim((string)($_GET['t']??''));$d=db(false,fn($s)=>gp_public_order_by_token($s,$token));if(!$d)fail('لینک مرسوله معتبر نیست یا منقضی شده است',404);[$o,$c,$rows,$sender]=$d;gp_public_order_info_page($o,$c,$rows,$sender,$token);
}
if($p==='/qr/order-serials'){
 $token=trim((string)($_GET['t']??''));$d=db(false,fn($s)=>gp_public_order_by_token($s,$token));if(!$d)fail('لینک سریال‌ها معتبر نیست',404);[$o,$c,$rows,$sender]=$d;gp_public_serial_print_page($o,$c,$rows);
}
if($p==='/qr/order-serials.csv'){
 $token=trim((string)($_GET['t']??''));$d=db(false,fn($s)=>gp_public_order_by_token($s,$token));if(!$d)fail('لینک سریال‌ها معتبر نیست',404);[$o,$c,$rows,$sender]=$d;gp_public_serial_csv($o,$rows);
}
if($p==='/print/warehouse-label'){
 auth();$id=(int)($_GET['id']??0);
 $d=db(false,function($s)use($id){$i=idx($s['cartons'],$id);if($i<0)return null;$c=$s['cartons'][$i];$c['_serials']=carton_serials_from_state($s,$c);return [$c,array_merge(gp_print_defaults(),$s['settings']??[])];});
 if(!$d)fail('باکس پیدا نشد',404);[$c,$set]=$d;
 gp_print_carton_labels_three_up([$c],gp_print_profile($set,'label'));exit;
}
if($p==='/print/warehouse-labels'){
 auth();$idsRaw=trim((string)($_GET['ids']??''));$ids=array_values(array_filter(array_map('intval',explode(',',$idsRaw)),fn($v)=>$v>0));if(!$ids)fail('شناسه کارتن‌ها ارسال نشده',400);
 $d=db(false,function($s)use($ids){$out=[];foreach($ids as $id){$i=idx($s['cartons'],$id);if($i<0)continue;$c=$s['cartons'][$i];$c['_serials']=carton_serials_from_state($s,$c);$out[]=$c;}return [$out,array_merge(gp_print_defaults(),$s['settings']??[])];});
 [$cartons,$set]=$d;if(!$cartons)fail('کارتنی یافت نشد',404);
 gp_print_carton_labels_three_up($cartons,gp_print_profile($set,'label'));exit;
}

if($p==='/pdf/order-details'){
 $guard=auth();$id=(int)($_GET['id']??0);$d=db(true,function(&$s)use($id,$guard){$i=idx($s['orders'],$id);if($i<0)return null;$o=$s['orders'][$i];if(in_array('customer',$guard['roles']??[],true)&&(int)($o['customer_id']??0)!==(int)($guard['customer_id']??0))fail('دسترسی ندارید',403);$tok=gp_public_order_token($s,$id);$s['orders'][$i]['public_qr_token']=$tok;$o=$s['orders'][$i];$ci=idx($s['customers'],$o['customer_id']);$packages=gp_dispatch_packages_from_state($s,$o);return [$o,$ci<0?[]:$s['customers'][$ci],$s['settings'],gp_effective_sender($s,$o),$packages];});
 if(!$d)fail('سفارش پیدا نشد',404);[$o,$c,$set,$sender,$packages]=$d;
 gp_print_order_dispatch_slips($o,$c,$sender,gp_print_profile(array_merge(gp_print_defaults(),$set??[]),'order'),$packages);exit;
}

if($p==='/export/customer-serials.xlsx'){
 auth(['admin','sales','prep','viewer']);$cid=(int)($_GET['customer_id']??0);if($cid<1)fail('مشتری را انتخاب کنید');
 $d=db(false,function($s)use($cid){$ci=idx($s['customers'],$cid);if($ci<0)return null;$orders=array_values(array_filter($s['orders']??[],fn($o)=>(int)($o['customer_id']??0)===$cid));usort($orders,fn($a,$b)=>strcmp((string)($b['created_at']??''),(string)($a['created_at']??'')));$blocks=[];foreach($orders as $o){$r=order_serial_rows_from_state($s,$o);if($r)$blocks[]=[$o,$r];}return [$s['customers'][$ci],$blocks];});
 if(!$d)fail('مشتری پیدا نشد',404);[$c,$blocks]=$d;$rows=[['سریال‌های مشتری'],['مشتری',$c['name']??''],['نام شرکت',$c['company']??''],['کد مشتری',$c['code']??''],['موبایل',$c['mobile']??''],['تعداد سفارش دارای سریال',count($blocks)],[]];
 foreach($blocks as [$o,$serialRows]){$rows[]=['شماره فاکتور',$o['number']??'','تاریخ',jalali_date_value($o['created_at']??''),'وضعیت',$o['status']??''];$rows[]=['ردیف','مدل دستگاه','شرکت سازنده','سریال','IMEI'];foreach($serialRows as $i=>$r)$rows[]=[$i+1,$r['product'],$r['manufacturer'],$r['serial'],$r['imei']];$rows[]=[];}
 xlsx_out('customer-serials-'.preg_replace('/[^A-Za-z0-9_-]+/','-',(string)($c['code']??$cid)).'.xlsx',$rows);
}
if($p==='/export/order-serials.xlsx'){
 auth(['admin','sales','prep','viewer']);$id=(int)($_GET['id']??0);if($id<1)fail('فاکتور را انتخاب کنید');
 $d=db(false,function($s)use($id){$oi=idx($s['orders'],$id);if($oi<0)return null;$o=$s['orders'][$oi];$ci=idx($s['customers'],$o['customer_id']??0);$c=$ci>=0?$s['customers'][$ci]:[];return [$o,$c,order_serial_rows_from_state($s,$o)];});
 if(!$d)fail('فاکتور پیدا نشد',404);[$o,$c,$serialRows]=$d;$rows=[['سریال‌های سفارش'],['شماره فاکتور',$o['number']??''],['تاریخ',jalali_date_value($o['created_at']??'')],['مشتری',$c['name']??($o['customer_name']??'')],['نام شرکت',$c['company']??''],['وضعیت',$o['status']??''],[],['ردیف','مدل دستگاه','شرکت سازنده','سریال','IMEI']];foreach($serialRows as $i=>$r)$rows[]=[$i+1,$r['product'],$r['manufacturer'],$r['serial'],$r['imei']];xlsx_out('order-serials-'.preg_replace('/[^A-Za-z0-9_-]+/','-',(string)($o['number']??$id)).'.xlsx',$rows);
}
if($p==='/print/customer-serials'){
 auth(['admin','sales','prep','viewer']);$cid=(int)($_GET['customer_id']??0);if($cid<1)fail('مشتری را انتخاب کنید');$d=db(false,function($s)use($cid){$ci=idx($s['customers'],$cid);if($ci<0)return null;$blocks=[];foreach(array_reverse($s['orders']??[]) as $o)if((int)($o['customer_id']??0)===$cid){$rows=order_serial_rows_from_state($s,$o);if($rows)$blocks[]=['number'=>$o['number']??'','date'=>jalali_date_value($o['created_at']??''),'status'=>$o['status']??'','rows'=>$rows];}return [$s['customers'][$ci],$blocks];});if(!$d)fail('مشتری پیدا نشد',404);[$c,$blocks]=$d;serial_print_page('سریال‌های مشتری','مشتری: '.($c['name']??'').' | شرکت: '.($c['company']??'').' | کد: '.($c['code']??''),$blocks);
}
if($p==='/print/order-serials'){
 auth(['admin','sales','prep','viewer']);$id=(int)($_GET['id']??0);if($id<1)fail('فاکتور را انتخاب کنید');$d=db(false,function($s)use($id){$oi=idx($s['orders'],$id);if($oi<0)return null;$o=$s['orders'][$oi];$ci=idx($s['customers'],$o['customer_id']??0);$c=$ci>=0?$s['customers'][$ci]:[];$rows=order_serial_rows_from_state($s,$o);return [$o,$c,$rows];});if(!$d)fail('فاکتور پیدا نشد',404);[$o,$c,$rows]=$d;$blocks=[['number'=>$o['number']??'','date'=>jalali_date_value($o['created_at']??''),'status'=>$o['status']??'','rows'=>$rows]];serial_print_page('سریال‌های سفارش','مشتری: '.($c['name']??($o['customer_name']??'')).' | شماره فاکتور: '.($o['number']??''),$blocks);
}
if($p==='/export/selected-serials.xlsx'){
 auth(['admin','sales','prep','viewer']);$raw=trim((string)($_GET['ids']??''));$ids=array_values(array_unique(array_filter(array_map('intval',preg_split('/[,\s]+/',$raw)))));if(!$ids)fail('حداقل یک سریال انتخاب کنید');
 $rows=db(false,function($s)use($ids){$out=[['ردیف','مدل دستگاه','سریال','IMEI','فاکتور','مشتری']];$n=0;foreach($s['inventory']??[] as $iv){if(!in_array((int)($iv['id']??0),$ids,true))continue;$n++;$oi=idx($s['orders'],$iv['order_id']??0);$o=$oi>=0?$s['orders'][$oi]:[];$ci=idx($s['customers'],$o['customer_id']??0);$c=$ci>=0?$s['customers'][$ci]:[];$out[]=[$n,$iv['product']??'',$iv['serial']??'',$iv['imei']??'',$o['number']??($iv['order_number']??''),$c['name']??($o['customer_name']??'')];}return $out;});
 if(count($rows)<2)fail('سریال انتخاب‌شده پیدا نشد',404);xlsx_out('selected-customer-serials.xlsx',$rows);
}
if(strpos($p,'/export/')===0){$guard=auth();$s=db(false,function($x)use($guard){if(in_array('customer',$guard['roles']??[],true))$x['orders']=array_values(array_filter($x['orders'],fn($o)=>(int)($o['customer_id']??0)===(int)($guard['customer_id']??0)));return $x;});if($p==='/export/orders.xlsx'){$q=text_lower(trim($_GET['q']??''));$status=trim($_GET['status']??'');$payment=trim($_GET['payment']??'');$rows=[['شماره سفارش','تاریخ ثبت','نام مشتری','شرکت','کد مشتری','موبایل','کالاها','تعداد کل','نحوه تسویه','وضعیت','روش ارسال']];foreach($s['orders'] as $o){$ci=idx($s['customers'],$o['customer_id']??0);$c=$ci<0?[]:$s['customers'][$ci];$products=implode('، ',array_map(fn($it)=>($it['product']??'').' × '.(int)($it['qty']??0),$o['items']??[]));$hay=text_lower(implode(' ',[$o['number']??'',$o['customer_name']??'',$c['company']??'',$c['code']??'',$c['mobile']??'',$products]));if($q!==''&&text_pos($hay,$q)===false)continue;if($status!==''&&($o['status']??'')!==$status)continue;if($payment!==''&&($o['payment_status']??'پرداخت نشده')!==$payment)continue;$qty=array_sum(array_map(fn($it)=>(int)($it['qty']??0),$o['items']??[]));$rows[]=[$o['number']??'',jalali_date_value($o['created_at']??''),$o['customer_name']??'',$c['company']??'',$c['code']??'',$c['mobile']??'',$products,$qty,$o['payment_status']??'',$o['status']??'',$o['shipping_type']??''];}xlsx_out('ghadir-orders.xlsx',$rows);}if($p==='/export/exit.xlsx'){$from=trim($_GET['from']??'');$to=trim($_GET['to']??'');$ship=trim($_GET['ship']??'');$sort=trim($_GET['sort']??'date');$dir=strtolower(trim($_GET['dir']??'desc'))==='asc'?'asc':'desc';$allowedSort=['date','order','customer','product','qty','shipping','by'];if(!in_array($sort,$allowedSort,true))$sort='date';$data=[];foreach($s['orders'] as $o){$at='';$by='';foreach($o['history']??[] as $h)if(strpos((string)($h['action']??''),'«ارسال شد»')!==false){$at=$h['at']??'';$by=$h['by']??'';}if($at===''&&in_array($o['status']??'',['ارسال شد','تحویل شد']))$at=$o['updated_at']??'';if($at==='')continue;$j=jalali_date_value($at);if($from!==''&&$j<$from)continue;if($to!==''&&$j>$to)continue;if($ship!==''&&($o['shipping_type']??'')!==$ship)continue;$ci=idx($s['customers'],$o['customer_id']??0);$c=$ci<0?[]:$s['customers'][$ci];$exitItems=(isset($o['exit_items'])&&is_array($o['exit_items']))?$o['exit_items']:gp_exit_items($s,$o);
foreach($exitItems as $it)$data[]=['date'=>$at,'jdate'=>$j,'order'=>$o['number']??'','customer'=>$o['customer_name']??($c['name']??''),'company'=>$c['company']??'','customer_code'=>$c['code']??'','product'=>$it['product']??'','qty'=>(int)($it['qty']??0),'shipping'=>$o['shipping_type']??'','by'=>$by];}usort($data,function($a,$b)use($sort,$dir){$av=$a[$sort]??'';$bv=$b[$sort]??'';$cmp=$sort==='qty'?((int)$av<=> (int)$bv):strnatcasecmp((string)$av,(string)$bv);return $dir==='asc'?$cmp:-$cmp;});$rows=[['تاریخ خروج','شماره سفارش','نام مشتری','نام شرکت / فروشگاه','کد مشتری','کالا','تعداد','روش ارسال','ثبت‌کننده خروج']];foreach($data as $r)$rows[]=[$r['jdate'],$r['order'],$r['customer']?:'-',$r['company']?:'-',$r['customer_code'],$r['product'],$r['qty'],$r['shipping'],$r['by']];xlsx_out('ghadir-exit-report.xlsx',$rows);}fail('نوع خروجی نامعتبر است',404);}
if($p==='/'||$p==='/index.php'){header('Content-Type:text/html; charset=utf-8');readfile(__DIR__.'/app.html');exit;}
fail('مسیر پیدا نشد',404);

<?php
// Native Figma R5.4: customer OTP and unapproved settlement evidence.
// Financial approval and shipping permissions remain exclusively with existing finance routes.
function gp_r54_settlement($x,$u,$order){
 if(!isset($x['settlement_details']))return [];
 $d=$x['settlement_details'];if(!is_array($d))fail('اطلاعات تسویه معتبر نیست',422);
 $method=$order['requested_payment_method']??'';$clean=['method'=>$method,'review_status'=>'در انتظار بررسی','submitted_at'=>now()];
 foreach(['tracking_number'=>100,'check_number'=>16,'bank_name'=>80,'due_date'=>30] as $key=>$max)$clean[$key]=cut_text(trim((string)($d[$key]??'')),$max);
 if($method==='check'&&(!preg_match('/^\d{16}$/',$clean['check_number'])||$clean['bank_name']===''||$clean['due_date']===''))fail('شناسه صیادی ۱۶ رقمی، بانک و سررسید الزامی است',422);
 if($method==='credit'&&empty($d['terms_accepted']))fail('پذیرش شرایط درخواست اعتبار الزامی است',422);
 $clean['terms_accepted']=!empty($d['terms_accepted']);
 $encoded=(string)($d['image_base64']??'');
 if($encoded!==''){
  if(strlen($encoded)>1500000)fail('تصویر رسید بیش از حد بزرگ است',413);
  $bytes=base64_decode($encoded,true);$info=$bytes===false?false:@getimagesizefromstring($bytes);
  if(!$info||!in_array($info['mime']??'',['image/jpeg','image/png'],true)||$info[0]>5000||$info[1]>5000)fail('تصویر رسید معتبر نیست',422);
  global $file;$dir=dirname($file).'/native-proofs';if(!is_dir($dir)&&!mkdir($dir,0750,true))fail('ذخیره تصویر انجام نشد',503);
  $token=bin2hex(random_bytes(24));$path=$dir.'/'.$token.'.php';
  if(file_put_contents($path,"<?php http_response_code(404); exit; ?>\n".$bytes,LOCK_EX)===false)fail('ذخیره تصویر انجام نشد',503);
  @chmod($path,0640);$clean['proof_token']=$token;$clean['proof_mime']=$info['mime'];
 }
 return $clean;
}
if($p==='/api/native/credit'&&$m==='GET'){
 $u=auth(['customer']);out(db(false,function($s)use($u){$i=idx($s['customers'],$u['customer_id']??0);$c=$i<0?[]:$s['customers'][$i];
  // Do not infer financial limits from historical order values.
  return ['configured'=>isset($c['credit_available_amount']),'available'=>isset($c['credit_available_amount'])?max(0,(int)$c['credit_available_amount']):null,'due_date'=>$c['credit_due_date']??'','requires_approval'=>true];
 }));
}
if($p==='/api/native/proof'&&$m==='GET'){
 // Permit the already-authenticated automation finance session for this read-only route.
 // Portal and automation retain their separate sessions; no account is logged in or changed here.
 if(empty($_SESSION['uid'])&&!empty($_COOKIE['ghadir_session'])){
  $staffId=(string)$_COOKIE['ghadir_session'];
  if(preg_match('/^[A-Za-z0-9,-]{16,128}$/',$staffId)){
   session_write_close();session_name('ghadir_session');session_id($staffId);
   session_start(['use_cookies'=>false,'read_and_close'=>true]);
   if(empty($_SESSION['last_seen'])||time()-(int)$_SESSION['last_seen']>86400)$_SESSION=[];
  }
 }
 $u=auth();$token=(string)($_GET['token']??'');if(!preg_match('/^[a-f0-9]{48}$/',$token))fail('فایل پیدا نشد',404);
 $proof=db(false,function($s)use($u,$token){foreach($s['orders']??[] as $o){$d=$o['native_settlement']??[];if(($d['proof_token']??'')!==$token)continue;
  $roles=$u['roles']??[];$own=in_array('customer',$roles,true)&&(int)($o['customer_id']??0)===(int)($u['customer_id']??0);
  if(!$own&&!array_intersect($roles,['admin','finance','sales']))fail('دسترسی ندارید',403);return $d;
 }fail('فایل پیدا نشد',404);});
 global $file;$path=dirname($file).'/native-proofs/'.$token.'.php';if(!is_file($path))fail('فایل پیدا نشد',404);
 header('Content-Type: '.$proof['proof_mime']);header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
 $f=fopen($path,'rb');fgets($f);fpassthru($f);fclose($f);exit;
}
if($p==='/api/native/login-otp/request'&&$m==='POST'){
 $x=input();$mobile=clean_mobile($x['mobile']??'');if(!preg_match('/^09\d{9}$/',$mobile))fail('شماره همراه معتبر وارد کنید',422);
 $key=hash('sha256',$mobile);$ip=hash('sha256',(string)($_SERVER['REMOTE_ADDR']??''));$code=(string)random_int(100000,999999);
 $r=db(true,function(&$s)use($mobile,$key,$ip,$code){
  $bucket=$s['settings']['native_login_otp']??[];foreach($bucket as $k=>$v)if(($v['at']??0)<time()-3600)unset($bucket[$k]);
  $prev=$bucket[$key]??[];$recent=0;foreach($bucket as $v)if(($v['ip']??'')===$ip&&($v['at']??0)>time()-900)$recent++;
  if(($prev['at']??0)>time()-60||($prev['blocked_until']??0)>time()||$recent>=10)return ['error'=>'درخواست زیاد است؛ کمی بعد دوباره تلاش کنید','status'=>429];
  $candidates=[];foreach($s['users']??[] as $u)if(!empty($u['active'])&&is_customer_user($u)&&in_array($mobile,user_mobile_keys($s,$u),true))$candidates[]=$u;
  usort($candidates,function($a,$b)use($s,$mobile){return customer_login_score($s,$b,$mobile)<=>customer_login_score($s,$a,$mobile);});
  $uid=(int)($candidates[0]['id']??0);$nonce=bin2hex(random_bytes(16));
  $bucket[$key]=['uid'=>$uid,'hash'=>password_hash($code,PASSWORD_DEFAULT),'at'=>time(),'expires'=>time()+300,'attempts'=>0,'sent'=>false,'ip'=>$ip,'nonce'=>$nonce];
  $s['settings']['native_login_otp']=$bucket;return ['uid'=>$uid,'nonce'=>$nonce];
 });
 if(isset($r['error']))fail($r['error'],$r['status']);
 $sent=false;if($r['uid']>0){$send=sms_send_mobile($mobile,'کد ورود قدیر پارتنر: '.$code.' — اعتبار ۵ دقیقه',['kind'=>'otp','vars'=>['otp'=>$code]]);$sent=!empty($send['sent']);}
 db(true,function(&$s)use($key,$sent,$r){if(($s['settings']['native_login_otp'][$key]['nonce']??'')===$r['nonce'])$s['settings']['native_login_otp'][$key]['sent']=$sent;});
 if($r['uid']>0&&!$sent)fail('ارسال پیامک انجام نشد؛ از رمز عبور استفاده کنید یا دوباره تلاش کنید',503);
 out(['ok'=>true,'retry_after'=>60,'message'=>'اگر حساب فعالی با این شماره وجود داشته باشد، کد ورود ارسال می‌شود.']);
}
if($p==='/api/native/login-otp/confirm'&&$m==='POST'){
 $x=input();$mobile=clean_mobile($x['mobile']??'');$code=trim((string)($x['otp']??''));if(!preg_match('/^09\d{9}$/',$mobile)||!preg_match('/^\d{6}$/',$code))fail('شماره و کد شش‌رقمی را بررسی کنید',422);
 $r=db(true,function(&$s)use($mobile,$code){$key=hash('sha256',$mobile);$q=$s['settings']['native_login_otp'][$key]??[];
  if(!$q||empty($q['sent'])||($q['expires']??0)<time()||($q['attempts']??0)>=5)return ['error'=>'کد نامعتبر یا منقضی است'];
  $q['attempts']++;if($q['attempts']>=5)$q['blocked_until']=time()+900;
  $s['settings']['native_login_otp'][$key]=$q;
  if(!password_verify($code,$q['hash']))return ['error'=>'کد تأیید صحیح نیست'];
  $i=idx($s['users'],$q['uid']);if($i<0||empty($s['users'][$i]['active'])||!is_customer_user($s['users'][$i]))return ['error'=>'حساب فعال پیدا نشد'];
  $s['settings']['native_login_otp'][$key]['sent']=false;unset($s['settings']['native_login_otp'][$key]['hash']);return ['uid'=>$q['uid']];
 });
 if(isset($r['error']))fail($r['error'],400);
 session_regenerate_id(true);$_SESSION['uid']=$r['uid'];unset($_SESSION['login_failures'],$_SESSION['login_block_until']);out(['ok'=>true]);
}

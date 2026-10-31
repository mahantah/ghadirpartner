<?php
declare(strict_types=1);
/** Selected-customer credit endpoints; clients never supply their own customer identity. */
if($p!=='/api/customer-credit')return;
if(!in_array($m,['GET','POST'],true))fail('روش درخواست مجاز نیست',405);
$user=auth();$roles=$user['roles']??[];$customer=in_array('customer',$roles,true);
if($m==='POST'||!$customer)$user=auth(['admin','finance']);
$service=GpCustomerCredit::create();
if($m==='GET'){
    $id=$customer?(int)($user['customer_id']??0):(int)($_GET['id']??0);
    if($id<1)fail('شناسه مشتری معتبر نیست',422);
    out(db(false,static function(array $s)use($service,$id): array{return $service->balance($s,$id);}));
}
$request=input();if(!is_int($request['id']??null)||$request['id']<1)fail('شناسه مشتری معتبر نیست',422);
out(db(true,static function(array &$s)use($service,$request,$user): array{return $service->configure($s,$request['id'],$request,(string)$user['username']);}));

<?php
// Sanitized in-memory fixtures only; never opens production config, storage or HTTP.
class RouteResult extends Exception { public $value; function __construct($v) { $this->value=$v; } }
class RouteError extends Exception {}
function fail($message, $status=400) { throw new RouteError($message, $status); }
function out($value) { throw new RouteResult($value); }
function auth($roles=[]) {
    global $user;
    if ($user === null) fail('login',401);
    if (!array_intersect($roles,$user['roles']??[])) fail('forbidden',403);
    return $user;
}
function input() { global $input; return $input; }
function idx($rows,$id) { foreach($rows as $i=>$row) if($row['id']==$id)return $i; return -1; }
function db($write,$callback) {
    global $state,$commits;
    $copy=$state;$result=$callback($copy);
    if($write){$state=$copy;$commits++;}
    return $result;
}
function callRoute($method,$payload=[],$path='/api/addresses') {
    global $input;$input=$payload;$p=$path;$m=$method;
    try { require __DIR__.'/../lib/native-address-book-v1.php'; return ['status'=>0]; }
    catch(RouteResult $e){return ['status'=>200,'value'=>$e->value];}
    catch(RouteError $e){return ['status'=>$e->getCode()];}
}
$checks=0;
function verify($condition,$message) { global $checks;if(!$condition)throw new Exception($message);$checks++; }
$state=['customers'=>[
    ['id'=>1,'address'=>'primary unchanged','delivery_addresses'=>[['id'=>'own','title'=>'دفتر','province'=>'تهران','city'=>'تهران','address'=>'نشانی آزمایشی','postal_code'=>'','extra'=>'preserved']]],
    ['id'=>2,'delivery_addresses'=>[['id'=>'other','address'=>'private fixture']]]
], 'orders'=>[['id'=>8,'customer_id'=>1,'delivery_address'=>['address'=>'historic snapshot']]]];
$user=['roles'=>['customer'],'customer_id'=>1];$commits=0;
$original=$state;$other=$state['customers'][1];$orders=$state['orders'];
$r=callRoute('GET');verify($r['status']===200&&count($r['value'])===1&&$r['value'][0]['id']==='own','GET must only expose own addresses');
verify($commits===0&&$state===$original,'GET must not write');
$valid=['title'=>'دفتر دوم','province'=>'تهران','city'=>'تهران','address'=>'نشانی دوم','postal_code'=>'۱۲۳۴۵۶۷۸۹۰'];
$r=callRoute('POST',$valid);verify($r['status']===200&&count($r['value'])===2,'create');
$new=$r['value'][1];verify((bool)preg_match('/^[a-f0-9]{24}$/',$new['id']),'generated ID');
verify($new['postal_code']==='1234567890','Persian postal digits');
$r=callRoute('POST',array_replace($valid,['id'=>'own','title'=>'ویرایش','postal_code'=>'١٢٣٤٥٦٧٨٩٠']));
verify($r['status']===200&&$r['value'][0]['title']==='ویرایش'&&$r['value'][0]['extra']==='preserved','edit retains unknown record fields');
verify($r['value'][0]['postal_code']==='1234567890','Arabic postal digits');
$safe=$state;$before=$commits;
foreach([['id'=>'other'],['id'=>'missing'],['delete_id'=>'other'],['delete_id'=>'missing']] as $change) {
    verify(callRoute('POST',array_replace($valid,$change))['status']===404,'foreign/unknown ownership');
    verify($state===$safe&&$commits===$before,'rejected write changes no state');
}
foreach([['title'=>''],['title'=>str_repeat('ش',61)],['address'=>str_repeat('ن',1001)],['postal_code'=>'123'],['title'=>[]],['id'=>[]],['delete_id'=>'']] as $change) {
    verify(callRoute('POST',array_replace($valid,$change))['status']===422,'invalid input');
    verify($state===$safe,'invalid input preserves state');
}
verify(callRoute('POST',array_replace($valid,['title'=>str_repeat('ش',60),'address'=>str_repeat('ن',1000),'postal_code'=>'']))['status']===200,'valid Unicode boundaries and optional postal code');
$r=callRoute('POST',['delete_id'=>$new['id']]);verify($r['status']===200&&count($r['value'])===2,'delete own address');
verify(callRoute('DELETE')['status']===405,'unsupported method');
verify(callRoute('GET',[],'/api/orders')['status']===0,'unrelated route falls through');
$user=null;verify(callRoute('GET')['status']===401,'anonymous access');
$user=['roles'=>['sales'],'customer_id'=>1];verify(callRoute('POST',$valid)['status']===403,'noncustomer access');
$user=['roles'=>['customer']];verify(callRoute('GET')['status']===403,'missing customer linkage');
$user=['roles'=>['customer'],'customer_id'=>99];verify(callRoute('GET')['status']===404,'missing customer');
$user=['roles'=>['customer'],'customer_id'=>1];
$state['customers'][0]['delivery_addresses']=array_fill(0,20,['id'=>'fixture']);$safe=$state;
verify(callRoute('POST',$valid)['status']===422&&$state===$safe,'20-address limit');
verify($state['customers'][1]===$other&&$state['orders']===$orders&&$state['customers'][0]['address']==='primary unchanged','other customers, historical snapshots and primary address preserved');
echo "PASS: $checks address lifecycle, validation, authorization and isolation checks\n";

<?php
// In-memory contract tests: no MySQL, network, real users, or real SMS.
declare(strict_types=1);
class Response extends RuntimeException {
    public array $body;
    public function __construct(array $body, int $status = 200) { parent::__construct('', $status); $this->body = $body; }
}
function out($body) { throw new Response($body); }
function fail($message, $status) { throw new Response(['error' => $message], $status); }
function input() { return $GLOBALS['payload']; }
function now() { return date('Y-m-d H:i:s'); }
function clean_mobile($value) { return preg_replace('/\D+/', '', (string)$value); }
function user_has_staff_role($u) { return in_array('admin', $u['roles'] ?? [], true); }
function db($write, $fn) {
    $state = unserialize(serialize($GLOBALS['state']));
    $result = $fn($state);
    if ($write) $GLOBALS['state'] = unserialize(serialize($state));
    return $result;
}
function sms_send_mobile($mobile, $message, $meta) {
    $GLOBALS['sms_calls']++;
    $GLOBALS['test_code'] = $meta['vars']['otp'];
    return ['sent' => $GLOBALS['sms_ok']];
}
require $argv[1] ?? __DIR__.'/../lib/staff-login-otp.php';
session_start();
function resetFixture() {
    $_SESSION = [];
    $GLOBALS['sms_ok'] = true;
    $GLOBALS['sms_calls'] = 0;
    $GLOBALS['state'] = ['users' => [
        ['id'=>1,'username'=>'synthetic-staff','mobile'=>'09000000000','active'=>true,'roles'=>['admin']],
        ['id'=>2,'username'=>'synthetic-other','mobile'=>'09000000001','active'=>true,'roles'=>['admin']],
        ['id'=>3,'username'=>'synthetic-inactive','mobile'=>'09000000002','active'=>false,'roles'=>['admin']],
        ['id'=>4,'username'=>'synthetic-customer','mobile'=>'09000000003','active'=>true,'roles'=>['customer']],
    ], 'orders'=>[['id'=>9001,'note'=>'synthetic unchanged sentinel']]];
}
function route($action, $extra=[]) {
    $GLOBALS['payload'] = array_merge(['identity'=>'synthetic-staff'], $extra);
    try { ghadir_staff_login_otp_route('/api/staff-login-otp/'.$action, 'POST'); }
    catch (Response $r) { return $r; }
    throw new RuntimeException('Route did not return a response');
}
function check($condition, $label) {
    if (!$condition) throw new RuntimeException($label);
    $GLOBALS['checks'][] = $label;
}
function ageRequest($seconds=61) {
    $_SESSION['staff_otp_last_request'] = time()-$seconds;
    $GLOBALS['state']['staff_login_otp_requests'][0]['created_at'] = date('Y-m-d H:i:s',time()-$seconds);
}
resetFixture();
route('request');
check($GLOBALS['state']['staff_login_otp_requests'][0]['status']==='sent','delivery state persists');
$id = $_SESSION['staff_otp_request_id']; $code=$GLOBALS['test_code'];
check(route('verify',['otp'=>$code])->getCode()===200 && $_SESSION['uid']===1,'correct code creates staff session');
check($GLOBALS['state']['staff_login_otp_requests'][0]['status']==='used','consumption persists');
check(!isset($GLOBALS['state']['staff_login_otp_requests'][0]['otp_hash']),'consumed hash removed');
check(route('verify',['otp'=>$code])->getCode()===400,'consumed code rejected');
check($GLOBALS['state']['orders']===[['id'=>9001,'note'=>'synthetic unchanged sentinel']],'business state unchanged');
resetFixture();route('request');
for ($i=1;$i<=5;$i++) route('verify',['otp'=>'000000']);
check($GLOBALS['state']['staff_login_otp_requests'][0]['attempts']===5,'failed attempts persist');
check($GLOBALS['state']['staff_login_otp_requests'][0]['status']==='locked','fifth failure locks challenge');
check(route('verify',['otp'=>$GLOBALS['test_code']])->getCode()===429,'session block enforced');
resetFixture();route('request');
$GLOBALS['state']['staff_login_otp_requests'][0]['expires_at']=date('Y-m-d H:i:s',time()-1);
check(route('verify',['otp'=>$GLOBALS['test_code']])->getCode()===400,'expired code rejected');
check($GLOBALS['state']['staff_login_otp_requests'][0]['status']==='expired','expiry state persists');
resetFixture();route('request');$id=$_SESSION['staff_otp_request_id'];$code=$GLOBALS['test_code'];
check(route('request')->getCode()===429 && $_SESSION['staff_otp_request_id']===$id,'30-second throttle preserves challenge');
$_SESSION['staff_otp_last_request']=time()-31;
route('request');
check($_SESSION['staff_otp_request_id']===$id && $GLOBALS['sms_calls']===1,'60-second account throttle preserves challenge');
check(route('verify',['otp'=>$code])->getCode()===200,'original code usable after throttled resend');
resetFixture();route('request');$id=$_SESSION['staff_otp_request_id'];$code=$GLOBALS['test_code'];ageRequest();$GLOBALS['sms_ok']=false;
route('request');
check($_SESSION['staff_otp_request_id']===$id,'failed resend preserves previous challenge');
check($GLOBALS['state']['staff_login_otp_requests'][1]['status']==='sms_failed' && !isset($GLOBALS['state']['staff_login_otp_requests'][1]['otp_hash']),'failed delivery recorded without hash');
check(route('verify',['otp'=>$code])->getCode()===200,'original code usable after failed resend');
resetFixture();route('request');$id=$_SESSION['staff_otp_request_id'];ageRequest();route('request');
check($_SESSION['staff_otp_request_id']!==$id,'successful resend replaces selected challenge');
check(route('verify',['otp'=>$GLOBALS['test_code']])->getCode()===200,'replacement code authenticates');
resetFixture();$GLOBALS['sms_ok']=false;route('request');
check(!isset($_SESSION['staff_otp_request_id']),'initial SMS failure never enables verification');
foreach (['missing','synthetic-inactive','synthetic-customer'] as $identity) {
    resetFixture();$r=route('request',['identity'=>$identity]);
    check($r->getCode()===200 && $GLOBALS['sms_calls']===0 && !isset($_SESSION['staff_otp_request_id']),'generic response without SMS: '.$identity);
}
resetFixture();$GLOBALS['state']['users'][1]['mobile']='09000000000';
route('request',['identity'=>'09000000000']);
check($GLOBALS['sms_calls']===0,'ambiguous mobile rejected');
resetFixture();route('request');
$GLOBALS['state']['staff_login_otp_requests'][0]['session_tag']=hash('sha256','different-session');
check(route('verify',['otp'=>$GLOBALS['test_code']])->getCode()===400 && !isset($_SESSION['uid']),'different session rejected');
resetFixture();route('request');
check(route('verify',['identity'=>'synthetic-other','otp'=>$GLOBALS['test_code']])->getCode()===400,'different account rejected');
resetFixture();route('request');$GLOBALS['state']['users'][0]['active']=false;
check(route('verify',['otp'=>$GLOBALS['test_code']])->getCode()===400,'deactivated account rejected at verification');
resetFixture();route('request');unset($GLOBALS['state']['staff_login_otp_requests']);
check(route('verify',['otp'=>$GLOBALS['test_code']])->getCode()===400,'missing challenge collection fails closed');
echo 'PASS '.count($GLOBALS['checks'])." OTP contract checks; synthetic data only\n";

<?php
// Test-only adapter. No production config, network or SMS is loaded.
ob_start();
$statePath=$argv[1];$p=$argv[2];$m='POST';$body=json_decode($argv[3],true);$_SESSION=[];$_SERVER['REMOTE_ADDR']='127.0.0.1';
function input(){global $body;return $body;}
function clean_mobile($x){return trim($x);}
function idx($rows,$id){foreach($rows as $i=>$r)if($r['id']==$id)return $i;return -1;}
function is_customer_user($u){return in_array('customer',$u['roles']);}
function user_mobile_keys($s,$u){return [$u['mobile']];}
function customer_login_score($s,$u,$mobile){return $u['id'];}
function db($write,$fn){global $statePath;$s=json_decode(file_get_contents($statePath),true);$result=$fn($s);if($write)file_put_contents($statePath,json_encode($s));return $result;}
function out($x){echo json_encode($x);exit;}
function fail($message,$status=400){out(['error'=>$message,'status'=>$status]);}
function sms_send_mobile($mobile,$text,$options){db(true,function(&$s)use($options){$s['test_last_code']=$options['vars']['otp'];$s['test_sms_count']=($s['test_sms_count']??0)+1;});return ['sent'=>true];}
require __DIR__.'/../native-r54-deploy/native-r54.php';

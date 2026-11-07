<?php
function fail($m,$s=400){throw new RuntimeException($m,$s);}function now(){return 'fixture';}function cut_text($s,$max){return substr($s,0,$max);}
$p='/fixture';$m='GET';$folder=sys_get_temp_dir().'/gp-proof-test-'.bin2hex(random_bytes(5));mkdir($folder);$file=$folder.'/data.json';
require __DIR__.'/candidate/partners/native-r54.php';
function verify($value,$message){if(!$value)throw new RuntimeException($message);}
$png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1cAAAAASUVORK5CYII=';
try{
 $result=gp_r54_settlement(['settlement_details'=>['cash_image_base64'=>$png,'check_image_base64'=>$png]],[],['requested_payment_method'=>'mixed']);
 verify(count($result['proofs'])===2,'two distinct proofs required');verify($result['proofs'][0]['proof_token']!==$result['proofs'][1]['proof_token'],'tokens must differ');
 foreach($result['proofs'] as $proof){$raw=file_get_contents($folder.'/native-proofs/'.$proof['proof_token'].'.php');verify(str_contains($raw,"http_response_code(404)"),'private file guard');verify(str_ends_with($raw,base64_decode($png)),'image roundtrip');}
 $cash=gp_r54_settlement(['settlement_details'=>['cash_image_base64'=>$png]],[],['requested_payment_method'=>'cash']);verify(count($cash['proofs'])===1&&$cash['proofs'][0]['kind']==='cash','cash-only upload');
 $old=gp_r54_settlement(['settlement_details'=>['image_base64'=>$png]],[],['requested_payment_method'=>'cash']);verify(isset($old['proof_token']),'legacy upload');
 try{gp_r54_settlement(['settlement_details'=>['cash_image_base64'=>'invalid']],[],['requested_payment_method'=>'cash']);throw new LogicException('accepted invalid image');}catch(RuntimeException $e){verify($e->getCode()===422,'bad image status');}
 echo "PASS: cash/check/mixed/legacy uploads, private storage, invalid image rejection\n";
}finally{foreach(glob($folder.'/native-proofs/*')?:[] as $path)unlink($path);@rmdir($folder.'/native-proofs');rmdir($folder);}

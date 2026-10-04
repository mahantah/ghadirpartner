<?php
// Synthetic tests only: no real database, SMS or financial mutations.
$p='/test';$m='GET';$file=sys_get_temp_dir().'/r54-fixture/data.json';@mkdir(dirname($file),0700,true);
function fail($message,$status=400){throw new RuntimeException($message,$status);}
function now(){return '2026-10-04 12:00:00';}
function cut_text($x,$n){return mb_substr($x,0,$n);}
require __DIR__.'/native-r54.php';
function check($ok){if(!$ok)throw new RuntimeException('Assertion failed');}
$order=['requested_payment_method'=>'check'];
try{gp_r54_settlement(['settlement_details'=>['check_number'=>'123']],[],$order);throw new Exception('Invalid check accepted');}catch(RuntimeException $e){check($e->getCode()===422);}
$valid=['check_number'=>'1234567890123456','bank_name'=>'بانک نمونه','due_date'=>'1405/07/26'];
$d=gp_r54_settlement(['settlement_details'=>$valid],[],$order);check($d['review_status']==='در انتظار بررسی');check(!isset($d['payment_status']));
try{gp_r54_settlement(['settlement_details'=>[]],[],['requested_payment_method'=>'credit']);throw new Exception('Unchecked credit accepted');}catch(RuntimeException $e){check($e->getCode()===422);}
$d=gp_r54_settlement(['settlement_details'=>['terms_accepted'=>true]],[],['requested_payment_method'=>'credit']);check($d['terms_accepted']===true);
try{gp_r54_settlement(['settlement_details'=>['image_base64'=>base64_encode('<?php echo 1;')]],[],['requested_payment_method'=>'cash']);throw new Exception('Invalid image accepted');}catch(RuntimeException $e){check($e->getCode()===422);}
echo "R54 settlement validation passed\n";

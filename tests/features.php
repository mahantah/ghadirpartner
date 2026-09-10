<?php
declare(strict_types=1);
// Load only pure production functions; never start sessions or contact MySQL/Homa.
function load_functions(string $file,array $wanted):void {
    $tokens=token_get_all(file_get_contents($file));$n=count($tokens);
    for($i=0;$i<$n;$i++){
        if(!is_array($tokens[$i])||$tokens[$i][0]!==T_FUNCTION)continue;
        $j=$i+1;while($j<$n&&is_array($tokens[$j])&&$tokens[$j][0]===T_WHITESPACE)$j++;
        if(!is_array($tokens[$j])||$tokens[$j][0]!==T_STRING||!in_array($tokens[$j][1],$wanted,true))continue;
        $code='';$depth=0;$started=false;
        for(;$i<$n;$i++){$t=$tokens[$i];$code.=is_array($t)?$t[1]:$t;if($t==='{'){$depth++;$started=true;}if($t==='}')$depth--;if($started&&$depth===0)break;}
        eval($code);
    }
}
function fail($message,$status=400){throw new RuntimeException($message,$status);}
function check($value,$message){if(!$value)throw new RuntimeException($message);}
$root=$argv[1];
load_functions($root.'/partners/index.php',['clean_mobile','normalize_admin_sms_mobiles','admin_order_sms_mobiles','offer_discount_for_items','offer_is_active_for_customer','sms_template_vars_for_order','sms_template_definitions','sms_template_config_from_state']);
load_functions($root.'/lib/storage.php',['ghadir_storage_driver']);
$phones=normalize_admin_sms_mobiles("۰۹۱۲۳۴۵۶۷۸۹\n+989123456789،00989123456780");
check($phones===['09123456789','09123456780'],'Normalize and deduplicate management recipients');
check(admin_order_sms_mobiles(['admin_order_sms_mobile'=>'09123456789'])===['09123456789'],'Preserve existing single recipient');
check(normalize_admin_sms_mobiles('')===[],'Allow clearing recipients');
try{normalize_admin_sms_mobiles('09123456789 invalid');throw new LogicException('Accepted invalid recipient');}catch(RuntimeException $e){}
$items=[['product'=>'A','line_total'=>1000],['product'=>'B','line_total'=>2000]];
check(offer_discount_for_items(['discount_type'=>'percent','discount_value'=>10,'product'=>'A'],$items,3000)===100,'Product percentage');
check(offer_discount_for_items(['discount_type'=>'amount','discount_value'=>5000],$items,3000)===3000,'Discount cannot exceed eligible subtotal');
check(offer_discount_for_items(['discount_type'=>'amount','discount_value'=>10,'product'=>'C'],$items,3000)===0,'Ineligible product');
$offer=['active'=>true,'audience'=>'selected','customer_ids'=>[7]];
check(offer_is_active_for_customer($offer,7),'Selected customer');check(!offer_is_active_for_customer($offer,8),'Unselected customer must not see offer');
check(!offer_is_active_for_customer(array_merge($offer,['end_date'=>'2000-01-01']),7),'Expired offer');
$vars=sms_template_vars_for_order(['name'=>'Test'],['approval_status'=>'در انتظار تأیید','estimated_total'=>12500000,'approved_total'=>0]);
check($vars['amount']==='12,500,000','New order management SMS amount');
$config=sms_template_config_from_state(['settings'=>['sms_templates'=>['offer_published'=>['enabled'=>false,'text'=>'Custom {discount}']]]],'offer_published');
check($config['enabled']===false&&$config['text']==='Custom {discount}','Editable template and disabled flag persist');
$cfg=[];check(ghadir_storage_driver()==='mysql','Default MySQL');$cfg=['storage_driver'=>'json'];
try{ghadir_storage_driver();throw new LogicException('JSON fallback accepted');}catch(RuntimeException $e){}
echo "Feature regression checks passed; no real SMS or database writes performed.\n";

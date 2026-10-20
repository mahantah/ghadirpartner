<?php
declare(strict_types=1);
/**
 * Read-only audit of one explicitly named production order.
 * Temporary upload via GitHub Actions; no customer or serial data is returned.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
const GP_ORDER_TARGET = 'GHP-000261';
const GP_ORDER_ID = 261;
const GP_ORDER_INSPECT_TOKEN = '__ORDER_INSPECT_TOKEN__';
function respond(int $status, array $result): void {
    http_response_code($status);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET' ||
    !hash_equals(GP_ORDER_INSPECT_TOKEN, (string)($_GET['token'] ?? ''))) {
    respond(403,['ok'=>false,'error'=>'unauthorized']);
}
function linked(array $obj): bool {
    foreach ($obj as $k=>$value) {
        $name = strtolower((string)$k);
        if (is_array($value)) { if (linked($value)) return true; continue; }
        if (!is_scalar($value) || $value === null) continue;
        $v = trim((string)$value);
        if ($v === GP_ORDER_TARGET) return true;
        if (in_array($name, [
           'order_id','warehouse_exit_order_id','source_order_id','related_order_id',
           'target_order_id','original_order_id','parent_order_id'
        ],true) && ctype_digit($v) && (int)$v === GP_ORDER_ID) return true;
    }
    return false;
}
try {
    $cfg = require __DIR__.'/config.php';
    $m = $cfg['mysql'] ?? [];
    $db = new PDO('mysql:host='.($m['host']??'localhost').';port='.(int)($m['port']??3306).
      ';dbname='.($m['database']??'').';charset='.($m['charset']??'utf8mb4'),
      (string)($m['username']??''),(string)($m['password']??''),
      [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
       PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
       PDO::ATTR_EMULATE_PREPARES=>false]);
    $r = $db->query('SELECT state_json, revision FROM ghadir_state WHERE id=1')->fetch();
    if (!$r) throw new RuntimeException('state_missing');
    $s=json_decode((string)$r['state_json'],true);
    if (!is_array($s) || !isset($s['orders']) || !is_array($s['orders'])) {
      throw new RuntimeException('state_invalid');
    }
    $found=[];
    foreach($s['orders'] as $order){
      if (!is_array($order)) continue;
      if ((string)($order['number']??'')===GP_ORDER_TARGET ||
          (int)($order['id']??0)===GP_ORDER_ID) $found[]=$order;
    }
    $refs=[];
    foreach($s as $category=>$records){
      if ($category==='orders' || !is_array($records)) continue;
      $n=0;
      foreach($records as $rec) if(is_array($rec)&&linked($rec)) $n++;
      if($n>0)$refs[$category]=$n;
    }
    $out=['ok'=>true,'order'=>GP_ORDER_TARGET,'revision'=>(int)$r['revision'],
          'matches'=>count($found),'references'=>$refs];
    if(count($found)===1){
      $o=$found[0];
      $items=$o['items']??[];
      $serialCount=0;
      foreach((is_array($items)?$items:[]) as $it){
        if(is_array($it))$serialCount+=count(is_array($it['serials']??null)?$it['serials']:[]);
      }
      $unsafeMoneyKeys=['paid_amount','payment_amount','deposit_amount','paid','balance_paid',
                        'invoice_id','invoice_number','payments','payment_transactions',
                        'receipts','settlement_transactions','refunds'];
      $money=[];
      foreach($unsafeMoneyKeys as $key)if(!empty($o[$key]))$money[]=$key;
      $returns=is_array($o['returns']??null)?count($o['returns']):(!empty($o['returns'])?1:0);
      $status=(string)($o['status']??'');
      $payment=(string)($o['payment_status']??'');
      $check=(string)($o['check_status']??'');
      $validIdentity=((int)($o['id']??0)===GP_ORDER_ID &&
                        (string)($o['number']??'')===GP_ORDER_TARGET);
      $eligible=$validIdentity &&
        in_array($status,['ثبت شده','لغو شد'],true) &&
        in_array($payment,['','پرداخت نشده'],true) &&
        $check==='' && $serialCount===0 && $returns===0 &&
        $money===[] && $refs===[];
      $out+=['identity_verified'=>$validIdentity,
             'status'=>$status,'payment_status'=>$payment,
             'check_status'=>$check,'item_serials'=>$serialCount,
             'returns'=>$returns,'financial_fields'=>$money,
             'eligible_for_safe_deletion'=>$eligible];
    }else{
      $out['eligible_for_safe_deletion']=false;
    }
    respond(200,$out);
} catch(Throwable $e) {
    respond(500,['ok'=>false,'error'=>'read_only_inspection_failed']);
}

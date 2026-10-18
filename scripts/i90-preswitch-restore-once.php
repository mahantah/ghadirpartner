<?php
declare(strict_types=1);
/*
 * GP_I90_PRESWITCH_REPAIR_V1_20261018
 * Standalone one-time remediation. Private token required over HTTPS POST.
 * Changes ONLY the 360 proven preswitch-restored I90 serial locations 1 -> 0.
 * Never deletes serials, edits orders, changes retail, or bypasses carton guard.
 */
const GP_I90_TOKEN = '__I90_EXECUTION_TOKEN__';
const GP_I90_BACKUP = 'ghadir-mysql-pre-exact-v53438-20261017-203512.json';
const GP_I90_RETURN_AT = '2026-10-17 20:35:12';
const GP_I90_EXPECTED_WHOLESALE = 1815;
const GP_I90_EXPECTED_PHYSICAL = 1455;
const GP_I90_EXPECTED_RETAIL = 16;
const GP_I90_EXPECTED_RESTORED = 360;
const GP_I90_CARTONS = [
  'I90-097','I90-098','I90-099','I90-100','I90-101','I90-102','I90-103',
  'I90-109','I90-110','I90-111','I90-112','I90-113','I90-114','I90-115',
  'I90-116','I90-123','I90-124','I90-125'
];

function gp_i90_fail(string $reason): void { throw new RuntimeException($reason); }
function gp_i90_upper($v): string { return strtoupper(trim((string)($v ?? ''))); }
function gp_i90_is_model($p): bool {
  return preg_match('/(^|[^A-Za-z0-9])I90([^A-Za-z0-9]|$)/i', (string)$p) === 1;
}
function gp_i90_inventory_count(array $s, int $wid): int {
  $n=0;
  foreach(($s['inventory']??[]) as $iv) {
    if(gp_i90_is_model($iv['product']??'') && (int)($iv['warehouse_id']??-1)===$wid) $n++;
  }
  return $n;
}
function gp_i90_cartons(array $s): array {
  $ids=[];$codes=[];
  foreach(($s['cartons']??[]) as $ct) {
    $code=gp_i90_upper($ct['code']??'');
    if(!in_array($code, GP_I90_CARTONS, true))continue;
    $id=(int)($ct['id']??0);
    if($id<1 || isset($codes[$code]) || isset($ids[$id]))gp_i90_fail('carton_identity_invalid');
    $ids[$id]=$code;$codes[$code]=$id;
  }
  if(count($codes)!==18)gp_i90_fail('protected_carton_state_mismatch');
  return [$ids,$codes];
}
function gp_i90_forbidden_order_reuse(array $s, array $serials): bool {
  foreach(($s['orders']??[]) as $order) {
    foreach(($order['items']??[]) as $item) {
      foreach(($item['serials']??[]) as $sn) {
        if(isset($serials[gp_i90_upper($sn)]))return true;
      }
    }
  }
  return false;
}
function gp_i90_plan(array $cur, array $old): array {
  if(!is_array($cur['inventory']??null)||!is_array($old['inventory']??null))
    gp_i90_fail('inventory_missing');
  if(!empty($cur['inventory_reconciliations'])) {
    foreach($cur['inventory_reconciliations'] as $v)
      if(($v['event']??'')==='preswitch_i90_360_reversal_v1')
        gp_i90_fail('already_repaired');
  }
  $beforeWholesale=gp_i90_inventory_count($cur,1);
  $retail=gp_i90_inventory_count($cur,2);
  if($beforeWholesale!==GP_I90_EXPECTED_WHOLESALE || $retail!==GP_I90_EXPECTED_RETAIL)
    gp_i90_fail('live_stock_changed_reaudit_required');
  [$ids,$codes]=gp_i90_cartons($cur);
  [$oldIds,$oldCodes]=gp_i90_cartons($old);
  $oldBySerial=[];
  foreach($old['inventory'] as $iv) {
    $sn=gp_i90_upper($iv['serial']??'');
    if($sn==='')continue;
    if(isset($oldBySerial[$sn])) $oldBySerial[$sn]=null;
    else $oldBySerial[$sn]=$iv;
  }
  $currentSerialCounts=[];
  foreach($cur['inventory'] as $iv){
    $sn=gp_i90_upper($iv['serial']??'');
    if($sn!=='')$currentSerialCounts[$sn]=($currentSerialCounts[$sn]??0)+1;
  }
  $indexes=[];$candidateSerials=[];$countByCarton=array_fill_keys(GP_I90_CARTONS,0);
  foreach($cur['inventory'] as $i=>$iv) {
    if(!gp_i90_is_model($iv['product']??''))continue;
    if((int)($iv['warehouse_id']??0)!==1)continue;
    if((int)($iv['returned_from_order_id']??0)<1 ||
       (string)($iv['returned_at']??'')!==GP_I90_RETURN_AT)continue;
    $cc=gp_i90_upper($iv['carton_code']??'');
    $byId=$ids[(int)($iv['carton_id']??0)]??'';
    if($cc!==''&&$cc!==$byId)gp_i90_fail('carton_identity_invalid');
    $code=$cc!==''?$cc:$byId;
    if(!in_array($code,GP_I90_CARTONS,true))gp_i90_fail('candidate_not_protected');
    if((int)($iv['order_id']??-99)!==0)
      gp_i90_fail('candidate_order_changed');
    $sn=gp_i90_upper($iv['serial']??'');
    if($sn===''||($currentSerialCounts[$sn]??0)!==1||!isset($oldBySerial[$sn]))
      gp_i90_fail('candidate_serial_missing_or_duplicate');
    $prior=$oldBySerial[$sn];
    if(!is_array($prior))gp_i90_fail('candidate_prior_duplicate');
    $oldCode=gp_i90_upper($prior['carton_code']??'');
    $oldById=$oldIds[(int)($prior['carton_id']??0)]??'';
    if($oldCode!==''&&$oldCode!==$oldById)gp_i90_fail('prior_carton_conflict');
    if(($oldCode!==''?$oldCode:$oldById)!==$code ||
       !gp_i90_is_model($prior['product']??'') ||
       (int)($prior['warehouse_id']??-1)!==0 ||
       (int)($prior['order_id']??0)!==(int)$iv['returned_from_order_id'])
      gp_i90_fail('prior_state_mismatch');
    if(isset($candidateSerials[$sn]))gp_i90_fail('candidate_duplicate');
    $candidateSerials[$sn]=true;
    $indexes[]=$i;
    $countByCarton[$code]++;
  }
  if(count($indexes)!==GP_I90_EXPECTED_RESTORED)gp_i90_fail('wrong_restore_count');
  foreach($countByCarton as $qty)if($qty!==20)gp_i90_fail('protected_carton_state_mismatch');
  if(gp_i90_forbidden_order_reuse($cur,$candidateSerials))
    gp_i90_fail('candidate_reused_in_current_orders');

  // A later legitimate movement of any target serial must block correction.
  foreach(($cur['warehouse_movements']??[]) as $mv){
    $at=(string)($mv['created_at']??'');
    if($at<=GP_I90_RETURN_AT)continue;
    foreach(($mv['serials']??[]) as $sn){
      if(isset($candidateSerials[gp_i90_upper($sn)]))
        gp_i90_fail('candidate_has_later_warehouse_movement');
    }
  }
  // Exact original protective carton integrity check: all 18, 20 free serial rows.
  $counts=array_fill_keys(GP_I90_CARTONS,0);
  $reserved=array_fill_keys(GP_I90_CARTONS,0);
  foreach($cur['inventory'] as $iv) {
    $cc=gp_i90_upper($iv['carton_code']??'');
    $byId=$ids[(int)($iv['carton_id']??0)]??'';
    if($cc!==''&&in_array($cc,GP_I90_CARTONS,true))$code=$cc;
    else $code=$byId;
    if(!in_array($code,GP_I90_CARTONS,true))continue;
    if($cc!==''&&$byId!==''&&$cc!==$byId)gp_i90_fail('protected_carton_state_mismatch');
    $counts[$code]++;
    if((int)($iv['order_id']??0)!==0)$reserved[$code]++;
  }
  foreach(GP_I90_CARTONS as $code)
    if($counts[$code]!==20||$reserved[$code]!==0)gp_i90_fail('protected_carton_state_mismatch');
  return [
    'indexes'=>$indexes,
    'serial_hash'=>hash('sha256',implode("\n",array_keys($candidateSerials))),
    'wholesale_before'=>$beforeWholesale,
    'wholesale_after'=>$beforeWholesale-count($indexes),
    'retail'=>$retail,
    'restored'=>count($indexes),
    'cartons'=>count($countByCarton)
  ];
}
function gp_i90_handle(string $mode): array {
  $cfg=require __DIR__.'/config.php';
  $db=$cfg['mysql']??[];
  if(!is_array($db)||empty($db['database'])||empty($db['username']))
    gp_i90_fail('database_configuration_invalid');
  $pdo=new PDO(
    'mysql:host='.($db['host']??'localhost').';port='.(int)($db['port']??3306).
    ';dbname='.$db['database'].';charset=utf8mb4',
    $db['username'],(string)($db['password']??''),
    [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
     PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
     PDO::ATTR_EMULATE_PREPARES=>false]
  );
  $pdo->exec("SET time_zone='+03:30'");
  $backup=__DIR__.'/storage/Backups/'.GP_I90_BACKUP;
  if(!is_file($backup)||!is_readable($backup))gp_i90_fail('reference_backup_unavailable');
  $previous=json_decode((string)file_get_contents($backup),true,512,JSON_THROW_ON_ERROR);
  if(!is_array($previous))gp_i90_fail('invalid_reference_backup');
  $write=$mode==='apply';
  try {
    if($write)$pdo->beginTransaction();
    $sql='SELECT state_json,revision FROM ghadir_state WHERE id=1'.($write?' FOR UPDATE':'');
    $r=$pdo->query($sql)->fetch();
    if(!$r)gp_i90_fail('current_state_missing');
    $state=json_decode($r['state_json'],true,512,JSON_THROW_ON_ERROR);
    if(!is_array($state))gp_i90_fail('invalid_current_state');
    if($mode==='verify') {
      $reversed=0;$hasAudit=false;
      foreach(($state['inventory']??[]) as $iv)
        if(($iv['preswitch_restore_reversed_reason']??'')==='verified_deploy_39067294958_360'
           && (int)($iv['warehouse_id']??-1)===0)$reversed++;
      foreach(($state['inventory_reconciliations']??[]) as $x)
        if(($x['event']??'')==='preswitch_i90_360_reversal_v1')$hasAudit=true;
      $whole=gp_i90_inventory_count($state,1);
      $retail=gp_i90_inventory_count($state,2);
      return ['ok'=>$whole===1455&&$retail===16&&$reversed===360&&$hasAudit,
       'mode'=>'verify','wholesale'=>$whole,'retail'=>$retail,'reversed'=>$reversed,
       'audit_exists'=>$hasAudit,'revision'=>(int)$r['revision']];
    }
    $plan=gp_i90_plan($state,$previous);
    if($plan['wholesale_after']!==GP_I90_EXPECTED_PHYSICAL)
      gp_i90_fail('post_count_unexpected');
    if(!$write) {
      unset($plan['indexes'],$plan['serial_hash']);
      return ['ok'=>true,'mode'=>'dry_run','eligible'=>true,'revision'=>(int)$r['revision']]+$plan;
    }
    $backupName='ghadir-mysql-pre-i90-repair-'.date('Ymd-His').'-'.bin2hex(random_bytes(4)).'.json';
    $backupPath=__DIR__.'/storage/Backups/'.$backupName;
    if(file_put_contents($backupPath,$r['state_json'],LOCK_EX)!==strlen($r['state_json']))
      gp_i90_fail('safe_backup_write_failed');
    if(!chmod($backupPath,0600))gp_i90_fail('safe_backup_permissions_failed');
    $now=date('Y-m-d H:i:s');
    foreach($plan['indexes'] as $i) {
      $state['inventory'][$i]['warehouse_id']=0;
      $state['inventory'][$i]['preswitch_restore_reversed_at']=$now;
      $state['inventory'][$i]['preswitch_restore_reversed_reason']='verified_deploy_39067294958_360';
      // Keep returned_from_order_id/returned_at as forensic history.
      // Orders are not rewritten: prior associations require separate review.
    }
    if(!isset($state['inventory_reconciliations'])||!is_array($state['inventory_reconciliations']))
      $state['inventory_reconciliations']=[];
    $state['inventory_reconciliations'][]=[
      'event'=>'preswitch_i90_360_reversal_v1','at'=>$now,
      'qty'=>$plan['restored'],'from_warehouse_id'=>1,'to_warehouse_id'=>0,
      'before_warehouse_total'=>$plan['wholesale_before'],
      'after_warehouse_total'=>$plan['wholesale_after'],
      'prior_backup'=>GP_I90_BACKUP,'pre_repair_backup'=>$backupName,
      'serial_set_hash'=>$plan['serial_hash']
    ];
    if(gp_i90_inventory_count($state,1)!==GP_I90_EXPECTED_PHYSICAL ||
       gp_i90_inventory_count($state,2)!==GP_I90_EXPECTED_RETAIL)
      gp_i90_fail('post_validation_failed');
    // The protected 18-carton guard remains enforced, never weakened.
    [$ids,$codes]=gp_i90_cartons($state);
    $counters=array_fill_keys(GP_I90_CARTONS,0);
    $free=array_fill_keys(GP_I90_CARTONS,0);
    foreach($state['inventory'] as $iv) {
      $cc=gp_i90_upper($iv['carton_code']??'');
      $byId=$ids[(int)($iv['carton_id']??0)]??'';
      $code=in_array($cc,GP_I90_CARTONS,true)?$cc:$byId;
      if(!in_array($code,GP_I90_CARTONS,true))continue;
      $counters[$code]++;
      if((int)($iv['order_id']??0)===0)$free[$code]++;
    }
    foreach(GP_I90_CARTONS as $code)
      if($counters[$code]!==20||$free[$code]!==20)
        gp_i90_fail('protected_carton_state_mismatch');

    $encoded=json_encode($state,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE|JSON_THROW_ON_ERROR);
    $hash=hash('sha256',$encoded);
    $next=(int)$r['revision']+1;
    $upd=$pdo->prepare('UPDATE ghadir_state SET state_json=?, revision=?, checksum=?, updated_at=NOW() WHERE id=1 AND revision=?');
    $upd->execute([$encoded,$next,$hash,$r['revision']]);
    if($upd->rowCount()!==1)gp_i90_fail('concurrent_revision_changed');
    $audit=$pdo->prepare('INSERT INTO ghadir_state_audit (revision,checksum,bytes) VALUES (?,?,?)');
    $audit->execute([$next,$hash,strlen($encoded)]);
    $pdo->commit();
    return ['ok'=>true,'mode'=>'applied','changed'=>360,
      'wholesale_before'=>1815,'wholesale_after'=>1455,'retail'=>16,
      'protected_cartons_valid'=>18,'revision'=>$next,'backup_created'=>true];
  } catch(Throwable $e) {
    if($pdo->inTransaction())$pdo->rollBack();
    throw $e;
  }
}
if(!defined('GHADIR_I90_TEST_MODE')) {
  header('Content-Type:application/json; charset=utf-8');
  header('Cache-Control:no-store');
  header('X-Content-Type-Options:nosniff');
  $token=$_SERVER['HTTP_X_GP_I90_TOKEN']??'';
  if(($_SERVER['REQUEST_METHOD']??'')!=='POST' || strlen(GP_I90_TOKEN)!==64 ||
     !hash_equals(GP_I90_TOKEN,(string)$token) ||
     (empty($_SERVER['HTTPS'])||$_SERVER['HTTPS']==='off')) {
    http_response_code(403);
    echo '{"ok":false,"error":"forbidden"}';exit;
  }
  $mode=$_POST['mode']??'';
  if(!in_array($mode,['dry_run','apply','verify'],true)) {
    http_response_code(400);echo '{"ok":false,"error":"invalid_mode"}';exit;
  }
  try {
    $output=gp_i90_handle($mode);
    echo json_encode($output,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
  } catch(Throwable $e) {
    http_response_code(409);
    // All errors are sanitized. Never send DB rows, serials, secrets or exception detail.
    $safe=['inventory_missing','already_repaired','live_stock_changed_reaudit_required',
      'protected_carton_state_mismatch','carton_identity_invalid',
      'candidate_not_protected','candidate_order_changed','candidate_serial_missing_or_duplicate',
      'candidate_prior_duplicate','prior_carton_conflict','prior_state_mismatch',
      'candidate_duplicate','wrong_restore_count','candidate_reused_in_current_orders',
      'candidate_has_later_warehouse_movement','post_count_unexpected',
      'database_configuration_invalid','reference_backup_unavailable',
      'invalid_reference_backup','current_state_missing','invalid_current_state',
      'safe_backup_write_failed','safe_backup_permissions_failed','post_validation_failed','concurrent_revision_changed'];
    $reason=in_array($e->getMessage(),$safe,true)?$e->getMessage():'internal_error';
    echo json_encode(['ok'=>false,'error'=>'guard_blocked','reason'=>$reason],JSON_UNESCAPED_UNICODE);
  }
}

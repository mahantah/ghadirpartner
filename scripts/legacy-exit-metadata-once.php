<?php
declare(strict_types=1);
/* One-time, token-protected repair of a missing legacy exit metadata without dispatch timestamps.
 * This script is uploaded temporarily by the explicitly authorized reconciliation workflow. */
// __INLINE_RECONCILE_DEPENDENCIES__
const GP_LEGACY_SHIP_TOKEN='__RECONCILE_TOKEN__';
const GP_EXIT_CODES=__TARGET_CODES__;

function gp_legacy_ship_handle(string $mode, int $expectedRevision=0): array {
    $cfg=require __DIR__.'/config.php';$mysql=$cfg['mysql']??[];
    if (!is_array($mysql) || empty($mysql['username']) || empty($mysql['database'])) {
        throw new RuntimeException('configuration_invalid');
    }
    $pdo=new PDO('mysql:host='.($mysql['host']??'localhost').';port='.(int)($mysql['port']??3306).
        ';dbname='.$mysql['database'].';charset='.($mysql['charset']??'utf8mb4'),
        (string)$mysql['username'],(string)($mysql['password']??''),[
            PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES=>false,
        ]);
    $write=$mode==='apply';
    try {
        if ($write) $pdo->beginTransaction();
        $row=$pdo->query('SELECT state_json,revision FROM ghadir_state WHERE id=1'.($write?' FOR UPDATE':''))->fetch();
        if (!$row) throw new RuntimeException('state_missing');
        $revision=(int)$row['revision'];
        $state=json_decode((string)$row['state_json'],true,512,JSON_THROW_ON_ERROR);
        if (!is_array($state)) throw new RuntimeException('state_invalid');
        $plan=(new LegacyExitMetadata(GP_EXIT_CODES))->reconcile($state);
        if ($mode==='verify') return ['ok'=>!$plan['changed'],'mode'=>'verify','revision'=>$revision,'targets'=>count(GP_EXIT_CODES),'inventory_unchanged'=>true];
        if (!$write) return ['ok'=>true,'mode'=>'inspect','revision'=>$revision,'eligible'=>$plan['changed'],'units'=>$plan['units'],'orders'=>$plan['orders'],'inventory_unchanged'=>true];
        if ($expectedRevision<1 || $expectedRevision!==$revision) throw new RuntimeException('revision_changed');
        if (!$plan['changed']) {
            $pdo->commit();
            return ['ok'=>true,'mode'=>'already_reconciled','revision'=>$revision,'units'=>$plan['units']];
        }
        $dir=__DIR__.'/storage/Backups';
        if (!is_dir($dir) && !mkdir($dir,0750,true)) throw new RuntimeException('backup_directory_failed');
        $backup=$dir.'/ghadir-pre-legacy-exit-metadata-'.date('Ymd-His').'-'.bin2hex(random_bytes(6)).'.json';
        $oldUmask=umask(0077);
        try {$wrote=file_put_contents($backup,(string)$row['state_json'],LOCK_EX);} finally {umask($oldUmask);}
        if ($wrote!==strlen((string)$row['state_json']) || !chmod($backup,0600)) throw new RuntimeException('backup_failed');
        $encoded=json_encode($plan['state'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
        $checksum=hash('sha256',$encoded);$newRevision=$revision+1;
        $update=$pdo->prepare('UPDATE ghadir_state SET state_json=?,revision=?,checksum=?,updated_at=NOW() WHERE id=1 AND revision=?');
        $update->execute([$encoded,$newRevision,$checksum,$revision]);
        if ($update->rowCount()!==1) throw new RuntimeException('revision_changed');
        $audit=$pdo->prepare('INSERT INTO ghadir_state_audit (revision,checksum,bytes) VALUES (?,?,?)');
        $audit->execute([$newRevision,$checksum,strlen($encoded)]);
        $pdo->commit();
        return ['ok'=>true,'mode'=>'applied','revision'=>$newRevision,'units'=>$plan['units'],
            'inventory_unchanged'=>true,'dates_unchanged'=>true,'orders'=>$plan['orders'],'backup_created'=>true];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

if (!defined('GP_LEGACY_SHIP_TEST_MODE')) {
    header('Content-Type:application/json; charset=utf-8');
    header('Cache-Control:no-store');
    header('X-Content-Type-Options:nosniff');
    @ini_set('display_errors','0');
    register_shutdown_function(static function(): void {
        $last=error_get_last();
        if (!$last || !in_array($last['type'],[E_ERROR,E_PARSE,E_CORE_ERROR,E_COMPILE_ERROR],true)) return;
        http_response_code(500);
        $reason=strpos(strtolower($last['message'] ?? ''),'allowed memory size')!==false?'php_memory_limit':'php_fatal_error';
        echo json_encode(['ok'=>false,'error'=>$reason]);
    });
    $token=(string)($_SERVER['HTTP_X_GP_RECONCILE_TOKEN']??'');
    if (($_SERVER['REQUEST_METHOD']??'')!=='POST' ||
        empty($_SERVER['HTTPS']) || $_SERVER['HTTPS']==='off' ||
        strlen(GP_LEGACY_SHIP_TOKEN)!==64 ||
        !hash_equals(GP_LEGACY_SHIP_TOKEN,$token)) {
        http_response_code(403);echo '{"ok":false,"error":"forbidden"}';exit;
    }
    $mode=(string)($_POST['mode']??'');
    if (!in_array($mode,['inspect','apply','verify'],true)) {
        http_response_code(400);echo '{"ok":false,"error":"invalid_mode"}';exit;
    }
    try {
        echo json_encode(gp_legacy_ship_handle($mode,(int)($_POST['expected_revision']??0)),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        http_response_code(409);
        $safe=['invalid_target_codes','invalid_exited_rows','order_missing_or_duplicate','not_missing_complete_legacy_exit','incomplete_order_serials','duplicate_or_missing_serial','serial_not_exited_for_order','allocation_number_mismatch','unmatched_order_allocation','no_verified_exit_serials','unexpected_carton_state','duplicate_carton','carton_missing','invalid_allocated_rows',
            'invalid_allocated_count','duplicate_order','order_missing',
            'shipment_already_present_or_not_delivered','order_number_mismatch',
            'reference_date_missing','invalid_order_items','duplicate_order_serial',
            'serial_product_or_order_mismatch','not_all_serials_in_order',
            'inventory_must_not_change','post_reconciliation_integrity_failed',
            'configuration_invalid','state_missing','state_invalid','revision_changed',
            'backup_directory_failed','backup_failed'];
        $reason=in_array($e->getMessage(),$safe,true)?$e->getMessage():'guarded_reconciliation_failed';
        echo json_encode(['ok'=>false,'error'=>$reason],JSON_UNESCAPED_UNICODE);
    }
}

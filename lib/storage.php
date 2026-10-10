<?php
declare(strict_types=1);

/*
 * Ghadir Partner storage adapter.
 * Production is MySQL-only; never fall back to legacy JSON.
 * MySQL mode stores the canonical state transactionally in InnoDB.
 */

function ghadir_storage_driver(): string {
    global $cfg;
    $d = strtolower(trim((string)($cfg['storage_driver'] ?? 'mysql')));
    if ($d !== 'mysql') fail('این نسخه فقط با MySQL اجرا می‌شود؛ تنظیم storage_driver را بررسی کنید', 503);
    return 'mysql';
}

function ghadir_warehouse_prepare_state(array &$s): void {
    if (!isset($s['warehouses']) || !is_array($s['warehouses']) || count($s['warehouses']) < 2) {
        $s['warehouses'] = [
            ['id'=>1,'code'=>'WHOLESALE','name'=>'انبار عمده','active'=>true],
            ['id'=>2,'code'=>'TEHRANPARS_RETAIL','name'=>'انبار خرده تهرانپارس','active'=>true],
        ];
    }
    if (!isset($s['warehouse_movements']) || !is_array($s['warehouse_movements'])) $s['warehouse_movements'] = [];
    if (!isset($s['next_warehouse_movement'])) {
        $mx=0; foreach($s['warehouse_movements'] as $m) $mx=max($mx,(int)($m['id']??0));
        $s['next_warehouse_movement']=$mx+1;
    }

    if (!isset($s['inventory']) || !is_array($s['inventory'])) $s['inventory'] = [];
    if (!isset($s['cartons']) || !is_array($s['cartons'])) $s['cartons'] = [];
    $orderStatus=[];
    foreach($s['orders']??[] as $o) $orderStatus[(int)($o['id']??0)] = (string)($o['status']??'');
    foreach($s['inventory'] as &$iv) {
        if (!array_key_exists('warehouse_id',$iv)) {
            $oid=(int)($iv['order_id']??0);
            $out = $oid < 0 || ($oid > 0 && in_array($orderStatus[$oid]??'', ['ارسال شد','تحویل شد'], true));
            $iv['warehouse_id']=$out ? 0 : 1;
        } else {
            $iv['warehouse_id']=(int)$iv['warehouse_id'];
        }
    }
    unset($iv);

    foreach($s['cartons'] as &$ct) {
        if (!array_key_exists('warehouse_id',$ct)) {
            $ids=[];
            foreach($s['inventory']??[] as $iv) {
                if ((int)($iv['carton_id']??0)===(int)($ct['id']??0) && (int)($iv['warehouse_id']??0)>0) $ids[(int)$iv['warehouse_id']]=1;
            }
            $ct['warehouse_id']=count($ids)===1 ? (int)array_key_first($ids) : (count($ids)>1 ? 0 : 1);
        } else {
            $ct['warehouse_id']=(int)$ct['warehouse_id'];
        }
    }
    unset($ct);

    if (empty($s['warehouse_activated_at'])) $s['warehouse_activated_at']=date('Y-m-d H:i:s');
    if (!isset($s['warehouse_baseline']) || !is_array($s['warehouse_baseline'])) {
        $counts=[];
        foreach($s['inventory']??[] as $iv) {
            $wid=(int)($iv['warehouse_id']??0);
            if ($wid<1) continue;
            $p=(string)($iv['product']??'نامشخص');
            $k=$wid.'|'.$p;
            if(!isset($counts[$k])) $counts[$k]=['warehouse_id'=>$wid,'product'=>$p,'qty'=>0];
            $counts[$k]['qty']++;
        }
        $s['warehouse_baseline']=array_values($counts);
    }
}

function ghadir_warehouse_record(array &$s,string $type,string $product,array $serials,int $fromWarehouse,int $toWarehouse,string $by,int $orderId=0,string $orderNumber='',string $note=''): array {
    ghadir_warehouse_prepare_state($s);
    $serials=array_values(array_unique(array_filter(array_map(fn($v)=>trim((string)$v),$serials),fn($v)=>$v!=='')));
    $row=[
        'id'=>$s['next_warehouse_movement']++,
        'type'=>$type,
        'product'=>$product,
        'qty'=>count($serials),
        'serials'=>$serials,
        'from_warehouse_id'=>$fromWarehouse,
        'to_warehouse_id'=>$toWarehouse,
        'order_id'=>$orderId,
        'order_number'=>$orderNumber,
        'note'=>$note,
        'created_at'=>date('Y-m-d H:i:s'),
        'created_by'=>$by,
    ];
    $s['warehouse_movements'][]=$row;
    return $row;
}

function ghadir_warehouse_exit_order(array &$s,array &$order,string $by): int {
    ghadir_warehouse_prepare_state($s);
    $groups=[];$n=0;$oid=(int)($order['id']??0);$now=date('Y-m-d H:i:s');
    foreach($s['inventory'] as &$iv) {
        if ((int)($iv['order_id']??0)!==$oid) continue;
        $wid=(int)($iv['warehouse_id']??0);
        if ($wid<1) continue;

        // هر سریال فقط در همان لحظه‌ای که واقعاً از انبار خارج می‌شود ثبت خروج می‌خورد.
        // اگر به هر دلیل یک سریالِ همین سفارش قبلاً خروج قطعی خورده باشد، دوباره خروج نمی‌خورد.
        if ((int)($iv['warehouse_exit_order_id']??0)===$oid && !empty($iv['warehouse_exited_at'])) continue;

        $product=(string)($iv['product']??'نامشخص');
        $key=$wid.'|'.$product;
        if(!isset($groups[$key])) $groups[$key]=['warehouse_id'=>$wid,'product'=>$product,'serials'=>[]];
        $groups[$key]['serials'][]=(string)($iv['serial']??'');
        $iv['warehouse_id']=0;
        $iv['warehouse_last_moved_at']=$now;
        $iv['warehouse_exited_at']=$now;
        $iv['warehouse_exit_order_id']=$oid;
        $iv['warehouse_exit_order_number']=(string)($order['number']??'');
        $iv['warehouse_exit_by']=$by;
        $n++;
    }
    unset($iv);

    $batchSerials=[];$batchGroups=[];
    foreach($groups as $g) {
        $mv=ghadir_warehouse_record($s,'sale_out',$g['product'],$g['serials'],$g['warehouse_id'],0,$by,$oid,(string)($order['number']??''),'خروج سفارش');
        $batchSerials=array_merge($batchSerials,$g['serials']);
        $batchGroups[]=['product'=>$g['product'],'warehouse_id'=>$g['warehouse_id'],'qty'=>count($g['serials']),'movement_id'=>(int)($mv['id']??0)];
        $set=array_fill_keys($g['serials'],true);
        foreach($s['inventory'] as &$iv) {
            if ((int)($iv['order_id']??0)===$oid && isset($set[(string)($iv['serial']??'')])) {
                $iv['warehouse_exit_movement_id']=(int)($mv['id']??0);
            }
        }
        unset($iv);
    }

    if($n>0) {
        $order['warehouse_exit_at']=$now;
        if(!isset($order['warehouse_exit_batches'])||!is_array($order['warehouse_exit_batches'])) $order['warehouse_exit_batches']=[];
        $order['warehouse_exit_batches'][]=[
            'at'=>$now,
            'by'=>$by,
            'qty'=>$n,
            'serials'=>array_values(array_unique($batchSerials)),
            'groups'=>$batchGroups,
        ];
    }
    return $n;
}

function ghadir_state_prepare(array &$s): void {
    foreach (init_state() as $k => $v) if (!array_key_exists($k, $s)) $s[$k] = $v;
    ghadir_warehouse_prepare_state($s);
    foreach (['sms_outbox','payment_transactions','registration_requests','password_reset_requests','staff_password_reset_requests','special_offers','offer_usages'] as $k) {
        if (!isset($s[$k]) || !is_array($s[$k])) $s[$k] = [];
    }
    foreach (['next_registration','next_password_reset','next_staff_password_reset','next_offer'] as $k) {
        if (!isset($s[$k])) $s[$k] = 1;
    }
    if (function_exists('normalize_state_users')) normalize_state_users($s);
    if (isset($s['orders']) && is_array($s['orders'])) {
        foreach ($s['orders'] as &$o) if (($o['payment_status'] ?? '') === 'پرداخت جزئی') $o['payment_status'] = 'بیعانه';
        unset($o);
    }
}

function ghadir_json_decode_state(string $raw): array {
    if ($raw === '') return init_state();
    $s = json_decode($raw, true);
    if (!is_array($s)) fail('فایل داده نامعتبر است؛ برای جلوگیری از حذف اطلاعات، نوشتن متوقف شد و باید از بکاپ بازیابی شود', 500);
    ghadir_state_prepare($s);
    return $s;
}

function ghadir_json_db(bool $write, callable $fn) {
    global $file;
    $h = fopen($file, 'c+');
    if (!$h) fail('پوشه storage قابل نوشتن نیست', 500);
    if (!flock($h, $write ? LOCK_EX : LOCK_SH)) { fclose($h); fail('قفل داده قابل دریافت نیست', 503); }
    rewind($h);
    $raw = (string)stream_get_contents($h);
    $s = ghadir_json_decode_state($raw);
    $r = $fn($s);
    if ($write) {
        $encoded = json_encode($s, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($encoded === false) { flock($h, LOCK_UN); fclose($h); fail('رمزگذاری داده ناموفق بود', 500); }
        rewind($h); ftruncate($h, 0);
        $written = fwrite($h, $encoded);
        if ($written === false || $written < strlen($encoded)) { flock($h, LOCK_UN); fclose($h); fail('نوشتن داده کامل نشد', 500); }
        fflush($h);
        if (function_exists('fsync')) @fsync($h);
    }
    flock($h, LOCK_UN); fclose($h);
    return $r;
}

function ghadir_mysql_cfg(): array {
    global $cfg;
    $m = is_array($cfg['mysql'] ?? null) ? $cfg['mysql'] : [];
    if (!$m) {
        $root = dirname(__DIR__) . '/config.php';
        if (is_file($root)) {
            $rootCfg = require $root;
            if (is_array($rootCfg['mysql'] ?? null)) $m = $rootCfg['mysql'];
        }
    }
    return array_merge([
        'host' => 'localhost', 'port' => 3306, 'database' => '', 'username' => '', 'password' => '', 'charset' => 'utf8mb4',
        'auto_migrate_from_json' => false,
    ], $m);
}

function ghadir_mysql_pdo(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    if (!extension_loaded('pdo_mysql')) fail('افزونه pdo_mysql روی هاست فعال نیست', 500);
    $m = ghadir_mysql_cfg();
    foreach (['database','username'] as $k) if (trim((string)$m[$k]) === '') fail('تنظیمات MySQL در config.php کامل نیست', 503);
    $dsn = 'mysql:host=' . $m['host'] . ';port=' . (int)$m['port'] . ';dbname=' . $m['database'] . ';charset=' . $m['charset'];
    try {
        $pdo = new PDO($dsn, (string)$m['username'], (string)$m['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 5,
        ]);
        $pdo->exec("SET time_zone = '+03:30'");
    } catch (Throwable $e) {
        fail('اتصال MySQL برقرار نشد. تنظیمات config.php را بررسی کنید.', 503);
    }
    return $pdo;
}

function ghadir_mysql_ensure_schema(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS ghadir_state (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        state_json LONGTEXT NOT NULL,
        revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
        checksum CHAR(64) NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS ghadir_state_audit (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        revision BIGINT UNSIGNED NOT NULL,
        checksum CHAR(64) NOT NULL,
        bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_revision (revision), INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function ghadir_state_counts(array $s): array {
    $keys = ['users','customers','orders','inventory','cartons','products','notifications','sms_outbox','payment_transactions'];
    $out = [];
    foreach ($keys as $k) $out[$k] = isset($s[$k]) && is_array($s[$k]) ? count($s[$k]) : 0;
    return $out;
}

function ghadir_mysql_bootstrap(PDO $pdo): void {
    ghadir_mysql_ensure_schema($pdo);
    $exists = (int)$pdo->query('SELECT COUNT(*) FROM ghadir_state WHERE id=1')->fetchColumn();
    if ($exists > 0) return;
    fail('داده اصلی MySQL پیدا نشد؛ برای حفاظت از اطلاعات، بازیابی خودکار JSON متوقف است', 503);
}

function ghadir_mysql_db(bool $write, callable $fn) {
    static $readCache = null;
    $pdo = ghadir_mysql_pdo();
    ghadir_mysql_bootstrap($pdo);
    try {
        if (!$write && is_array($readCache)) {
            $s = $readCache;
            if (isset($s['products']) && is_array($s['products'])) $GLOBALS['PRODUCTS'] = $s['products'];
            return $fn($s);
        }
        if ($write) $pdo->beginTransaction();
        $sql = 'SELECT state_json,revision FROM ghadir_state WHERE id=1' . ($write ? ' FOR UPDATE' : '');
        $row = $pdo->query($sql)->fetch();
        if (!$row) throw new RuntimeException('state missing');
        $s = json_decode((string)$row['state_json'], true);
        if (!is_array($s)) throw new RuntimeException('state invalid');
        ghadir_state_prepare($s);
        if (isset($s['products']) && is_array($s['products'])) $GLOBALS['PRODUCTS'] = $s['products'];
        if (!$write) $readCache = $s;
        $r = $fn($s);
        if ($write) {
            $encoded = json_encode($s, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            if ($encoded === false) throw new RuntimeException('encode failed');
            $checksum = hash('sha256', $encoded);
            $revision = (int)$row['revision'] + 1;
            $st = $pdo->prepare('UPDATE ghadir_state SET state_json=?, revision=?, checksum=?, updated_at=NOW() WHERE id=1');
            $st->execute([$encoded, $revision, $checksum]);
            $st = $pdo->prepare('INSERT INTO ghadir_state_audit (revision,checksum,bytes) VALUES (?,?,?)');
            $st->execute([$revision, $checksum, strlen($encoded)]);
            $pdo->commit();
            $readCache = $s;
            if (isset($s['products']) && is_array($s['products'])) $GLOBALS['PRODUCTS'] = $s['products'];
        }
        return $r;
    } catch (Throwable $e) {
        if ($write && $pdo->inTransaction()) $pdo->rollBack();
        fail('خطای تراکنش MySQL؛ هیچ تغییر ناقصی ذخیره نشد', 500);
    }
}

function ghadir_db(bool $write, callable $fn) {
    ghadir_storage_driver();
    return ghadir_mysql_db($write, $fn);
}

function ghadir_backup_snapshot(): string {
    global $backups;
    @mkdir($backups, 0750, true);
    $to = $backups . '/ghadir-backup-' . date('Ymd-His') . '.json';
    $state = ghadir_db(false, fn($s) => $s);
    $raw = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($raw === false || @file_put_contents($to, $raw, LOCK_EX) === false) fail('ساخت بکاپ ممکن نشد', 500);
    return 'storage/Backups/' . basename($to);
}

function ghadir_storage_info(): array {
    global $dir;
    $info = ['driver' => ghadir_storage_driver(), 'mysql_migrated' => is_file($dir . '/.mysql-migrated.json')];
    if ($info['driver'] === 'mysql') {
        $pdo = ghadir_mysql_pdo();
        ghadir_mysql_bootstrap($pdo);
        $row = $pdo->query('SELECT revision,checksum,updated_at,LENGTH(state_json) bytes FROM ghadir_state WHERE id=1')->fetch();
        $info['mysql'] = $row ?: null;
    }
    return $info;
}

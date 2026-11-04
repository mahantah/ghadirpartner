<?php
declare(strict_types=1);

/** Publish only reviewed read-path code; never migrate or write business data. */
final class GpWarehouseReadRelease
{
    /** @var array<string,mixed> */
    private array $manifest;
    /** @var array<string,string|null> */
    private array $rollback = [];

    private string $root;
    private string $directory;

    /** Load the private manifest and resolve the intended application root. */
    public function __construct(string $root, string $directory)
    {
        $resolved = realpath($root);
        if ($resolved === false || !is_file($resolved.'/config.php')) throw new RuntimeException('application_root_missing');
        $this->root = $resolved; $this->directory=$directory;
        $value = json_decode((string)file_get_contents($directory.'/manifest.json'),true);
        if (!is_array($value) || !isset($value['original'],$value['candidate'],$value['support'],$value['protected_cartons']) || !is_int($value['drain_seconds']??null) || $value['drain_seconds']<1) throw new RuntimeException('release_manifest_invalid');
        $this->manifest = $value;
    }

    /**
     * @param array<string,mixed> $details Record aggregate evidence without customer or serial data.
     */
    public function status(string $status, array $details = []): void
    {
        $json = json_encode(['status'=>$status,'at'=>date('c')]+$details,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);
        if (file_put_contents($this->directory.'/report.json',$json,LOCK_EX)===false) throw new RuntimeException('report_write_failed');
        chmod($this->directory.'/report.json',0600);
    }

    /** Prevent path traversal and publishing unrelated application files. */
    private function path(string $name): void
    {
        if (strpos($name,'..')!==false || !preg_match('~^(?:app\.html|lib/[a-z0-9-]+\.php|config/warehouse-storage\.yaml)$~D',$name)) throw new RuntimeException('release_path_invalid');
    }

    /** Verify source identity and PHP syntax before loading any candidate class. */
    private function verify(): void
    {
        foreach ($this->manifest['original'] as $name=>$hash) {
            $this->path($name);
            if (!is_file($this->root.'/'.$name) || !hash_equals($hash,(string)hash_file('sha256',$this->root.'/'.$name))) throw new RuntimeException('source_hash_mismatch:'.$name);
        }
        foreach ($this->manifest['candidate']+$this->manifest['support'] as $name=>$hash) {
            $this->path($name); $file=$this->directory.'/candidate/'.$name;
            if (!is_file($file) || !hash_equals($hash,(string)hash_file('sha256',$file))) throw new RuntimeException('candidate_hash_mismatch:'.$name);
            if (substr($name,-4)==='.php' && !token_get_all((string)file_get_contents($file),TOKEN_PARSE)) throw new RuntimeException('empty_php_candidate');
        }
    }

    /**
     * @param array<string,mixed> $state Enforce the existing protected-carton gate.
     */
    private function integrity(array $state): void
    {
        foreach ($this->manifest['protected_cartons'] as $code) if (empty(gp_preswitch_allocated_carton_integrity($state,$code)['ok'])) throw new RuntimeException('protected_carton_state_mismatch');
    }

    /**
     * @param callable():array<string,mixed> $read
     * @return array{value:array<string,mixed>,ms:float,bytes:int} Include serialization in read timing.
     */
    private function measure(callable $read): array
    {
        $start=hrtime(true);$value=$read();$json=json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        return ['value'=>$value,'ms'=>round((hrtime(true)-$start)/1e6,2),'bytes'=>strlen($json)];
    }

    /**
     * @return array<string,mixed> Prove counters and filtered pages against the same physical records.
     */
    private function check(GpWarehouseStorage $storage): array
    {
        $state=$storage->readCore(function(array $state) use($storage): array {$storage->hydrate($state);return $state;});
        if (!$storage->isSplit($state)) throw new RuntimeException('warehouse_split_required');
        $this->integrity($state);
        $before=hash('sha256',GpWarehouseRepository::encode($state['inventory']));
        $overview=$storage->readCore(static fn(array $core):array=>$storage->inventoryOverview($core,'','all'));
        $free=count(array_filter($state['inventory'],static fn(array $row):bool=>empty($row['order_id'])));
        if ($overview['total']!==count($state['inventory']) || $overview['free']!==$free || $overview['assigned']!==count($state['inventory'])-$free) throw new RuntimeException('counter_contract_mismatch');
        $page=$storage->readCore(static fn(array $core):array=>$storage->mobilePage('',1,$storage->defaultPageSize()));
        $expected=array_slice(array_reverse($state['inventory']),0,$storage->defaultPageSize());
        if ($page['rows']!==$expected) throw new RuntimeException('page_contract_mismatch');
        // Compare customer grouping and search against the unchanged production helper definitions.
        require_once $this->directory.'/candidate/lib/legacy-inventory-oracle.php';
        [$orders,$customers]=gp_inventory_maps($state);
        $queries=['','I90','سریال‌های آزاد','%_!'];
        foreach (array_slice($state['inventory'],0,1) as $row) $queries[]=(string)$row['serial'];
        foreach ($queries as $query) {
            $query=mb_strtolower(trim($query),'UTF-8');$matched=0;
            foreach ($state['inventory'] as $row) if ($query==='' || mb_strpos(gp_inv_search_text($row,gp_inv_group_meta($state,$row,$orders,$customers)),$query,0,'UTF-8')!==false) $matched++;
            $result=$storage->readCore(static fn(array $core):array=>$storage->inventoryOverview($core,$query,'all'));
            if ($result['matched']!==$matched) throw new RuntimeException('search_contract_mismatch');
        }
        $legacy=$this->measure(fn():array=>$storage->readCore(function(array $core) use($storage):array {$storage->hydrate($core);ghadir_state_prepare($core);return ['cartons'=>$core['cartons'],'inventory'=>$core['inventory'],'connected'=>true];}));
        $compact=$this->measure(fn():array=>$storage->readCore(static fn(array $core):array=>$storage->compactWarehouse()));
        if ($compact['value']['cartons']!==$state['cartons']) throw new RuntimeException('carton_contract_mismatch');
        $indexed=$this->measure(fn():array=>$storage->readCore(static fn(array $core):array=>$storage->mobilePage('',1,$storage->defaultPageSize())));
        $after=$storage->readCore(function(array $core) use($storage):array {$storage->hydrate($core);return $core;});
        // Only compare a single snapshot's in-memory source; concurrent legitimate writes stay allowed.
        if ($before!==hash('sha256',GpWarehouseRepository::encode($state['inventory']))) throw new RuntimeException('read_changed_inventory');
        $this->integrity($after);
        return ['serials'=>count($state['inventory']),'cartons'=>count($state['cartons']),'free'=>$free,'assigned'=>count($state['inventory'])-$free,'legacy_warehouse'=>['ms'=>$legacy['ms'],'bytes'=>$legacy['bytes']],'compact_warehouse'=>['ms'=>$compact['ms'],'bytes'=>$compact['bytes']],'inventory_page'=>['ms'=>$indexed['ms'],'bytes'=>$indexed['bytes'],'rows'=>count($indexed['value']['rows'])]];
    }

    /** Publish one file atomically with a private rollback copy. */
    private function publish(string $name): void
    {
        $target=$this->root.'/'.$name;
        $old=is_file($target)?(string)file_get_contents($target):null;
        $this->rollback[$name]=$old;
        if ($old!==null) {
            $backup=$this->directory.'/rollback/'.$name;
            if (!is_dir(dirname($backup)) && !mkdir(dirname($backup),0700,true)) throw new RuntimeException('rollback_directory_failed');
            if (file_put_contents($backup,$old,LOCK_EX)===false) throw new RuntimeException('rollback_write_failed');
            chmod($backup,0600);
        }
        $temporary=$target.'.gp-read-stage';
        if (!copy($this->directory.'/candidate/'.$name,$temporary) || !chmod($temporary,0644) || !rename($temporary,$target)) throw new RuntimeException('publish_failed');
        if (!hash_equals($this->manifest['candidate'][$name],(string)hash_file('sha256',$target))) throw new RuntimeException('publish_readback_failed');
    }

    /** Restore availability even when a rollback copy fails, then report that failure. */
    private function restore(bool $published, string $maintenance, string $original): void
    {
        $failure=null;
        if (!$published) foreach (array_reverse($this->rollback,true) as $name=>$old) {
            $target=$this->root.'/'.$name;
            if ($old===null) { if (is_file($target) && !unlink($target)) $failure=new RuntimeException('rollback_remove_failed'); }
            elseif (file_put_contents($target,$old,LOCK_EX)===false) $failure=new RuntimeException('rollback_restore_failed');
        }
        if (file_put_contents($maintenance,$original,LOCK_EX)===false) $failure=new RuntimeException('maintenance_restore_failed');
        if ($failure!==null) throw $failure;
    }

    /** Run preflight or publish code with availability restoration; no business-data write is used. */
    public function run(string $mode): void
    {
        if (!in_array($mode,['check','apply'],true)) throw new RuntimeException('release_mode_invalid');
        $this->verify();
        global $cfg;$cfg=require $this->root.'/config.php';
        date_default_timezone_set((string)($cfg['timezone']??'Asia/Tehran'));
        require_once $this->directory.'/candidate/lib/storage.php';
        require_once $this->directory.'/preswitch-carton-integrity.php';
        $storage=GpWarehouseStorage::create(ghadir_mysql_pdo());
        $metrics=$this->check($storage);
        $this->status('preflight_passed',$metrics);
        if ($mode==='check') return;
        $maintenance=$this->root.'/.htaccess';$original=(string)file_get_contents($maintenance);$published=false;
        try {
            if (file_put_contents($maintenance,"# GP_INDEXED_READS_MAINTENANCE\nRewriteEngine On\nRewriteRule ^ - [R=503,L]\nErrorDocument 503 \"Warehouse update in progress. Please retry shortly.\"\n".$original,LOCK_EX)===false) throw new RuntimeException('maintenance_failed');
            $this->status('maintenance',$metrics);
            sleep($this->manifest['drain_seconds']);
            $this->verify();
            foreach (array_keys($this->manifest['candidate']) as $name) $this->publish($name);
            $published=true;
        } finally {
            $this->restore($published,$maintenance,$original);
        }
        $this->status('applied',$metrics);
    }
}

if (PHP_SAPI!=='cli') { http_response_code(404);exit; }
$release=null;
try {
    $directory=__DIR__; $mode=$argv[2]??'check';
    $lock=fopen($directory.'/'.$mode.'.lock','x');if ($lock===false) exit;
    $release=new GpWarehouseReadRelease($argv[1]??'', $directory);$release->run($mode);
} catch (Throwable $error) {
    if ($release!==null) $release->status('failed',['reason'=>$error->getMessage()]);
    fwrite(STDERR,"Warehouse read release failed: ".$error->getMessage()."\n");exit(1);
}

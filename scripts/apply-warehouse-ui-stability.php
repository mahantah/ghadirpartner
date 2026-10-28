<?php
declare(strict_types=1);
/** Apply a finite hash-checked UI patch to the owner's current source, code only. */
// __INTEGRITY_CLASS__
final class WarehouseUiStability {
    private array $manifest;
    private string $checkpoint;
    public function __construct(array $manifest) {
        $this->manifest=$manifest;
        $this->checkpoint=dirname(__DIR__).'/.gp-warehouse-ui-__RUN_ID__';
    }
    /** Original protected carton validation, read-only. */
    private function guard(): void {
        $cfg=require __DIR__.'/config.php';$m=$cfg['mysql'];
        $pdo=new PDO('mysql:host='.($m['host']??'localhost').';port='.($m['port']??3306).';dbname='.$m['database'].';charset=utf8mb4',$m['username'],$m['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $raw=$pdo->query('SELECT state_json FROM ghadir_state WHERE id=1')->fetchColumn();
        $s=json_decode((string)$raw,true,512,JSON_THROW_ON_ERROR);
        foreach($this->manifest['protected_cartons'] as $code)if(!gp_preswitch_allocated_carton_integrity($s,$code)['ok'])throw new RuntimeException('protected_carton_state_mismatch');
    }
    /** Atomically restore this run's code checkpoint, without touching runtime state. */
    public function rollback(): array {
        foreach($this->manifest['before_files'] as $file=>$hash){
            $saved=$this->checkpoint.'/before/'.$file;
            if(!is_file($saved)||!hash_equals($hash,hash_file('sha256',$saved)))throw new RuntimeException('rollback_unavailable');
        }
        foreach($this->manifest['before_files'] as $file=>$hash)$this->publish($file,file_get_contents($this->checkpoint.'/before/'.$file));
        return ['ok'=>true,'rolled_back'=>true,'database_changed'=>false];
    }
    private function publish(string $file,string $text): void {
        $dest=__DIR__.'/'.$file;$tmp=$dest.'.whfix-__RUN_ID__.tmp';
        if(file_put_contents($tmp,$text,LOCK_EX)!==strlen($text)||!chmod($tmp,0644)||!rename($tmp,$dest))throw new RuntimeException('publish_failed');
    }
    /** Reject unexpected source, stage all operations before publishing app.html last. */
    public function apply(): array {
        $this->guard();$staged=[];
        foreach($this->manifest['before_files'] as $file=>$hash){
            if(!in_array($file,['app.html','assets/ui-v53435-menu2.js','assets/nav-restructure-v1.js','assets/menu-live-v4.js','assets/warehouse-ui-refine-v53438.js','assets/search-filter-fab-v1.js','assets/ops-v53434.js','assets/partial-exit-v53422.js'],true))throw new RuntimeException('invalid_path');
            $path=__DIR__.'/'.$file;
            if(!is_file($path)||!hash_equals($hash,hash_file('sha256',$path)))throw new RuntimeException('source_hash_mismatch');
            $staged[$file]=file_get_contents($path);
        }
        foreach($this->manifest['operations'] as $op){
            if(!isset($staged[$op['file']])||substr_count($staged[$op['file']],$op['old'])!==$op['count'])throw new RuntimeException('anchor_mismatch');
            $staged[$op['file']]=str_replace($op['old'],$op['new'],$staged[$op['file']]);
        }
        foreach($staged as $file=>$text)if(!hash_equals($this->manifest['expected_files'][$file],hash('sha256',$text)))throw new RuntimeException('staged_hash_mismatch');
        if(file_exists($this->checkpoint))throw new RuntimeException('checkpoint_exists');
        foreach($staged as $file=>$text){
            $save=$this->checkpoint.'/before/'.$file;
            if(!is_dir(dirname($save)))mkdir(dirname($save),0700,true);
            if(!copy(__DIR__.'/'.$file,$save))throw new RuntimeException('backup_failed');chmod($save,0600);
        }
        try{
            foreach($staged as $file=>$text)if($file!=='app.html')$this->publish($file,$text);
            $this->publish('app.html',$staged['app.html']);
            foreach($this->manifest['expected_files'] as $file=>$hash)if(!hash_equals($hash,hash_file('sha256',__DIR__.'/'.$file)))throw new RuntimeException('readback_failed');
        }catch(Throwable $e){$this->rollback();throw $e;}
        return ['ok'=>true,'files'=>count($staged),'protected_cartons'=>count($this->manifest['protected_cartons']),'database_changed'=>false,'code_backup'=>true];
    }
}
if(defined('WAREHOUSE_UI_TEST'))return;
ini_set('display_errors','0');set_time_limit(120);
header('Content-Type:application/json; charset=utf-8');header('Cache-Control:no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!hash_equals('__TOKEN__',(string)($_SERVER['HTTP_X_GP_RECONCILE_TOKEN']??''))){http_response_code(403);exit('{"ok":false}');}
try{
    $m=json_decode(base64_decode('__MANIFEST_B64__'),true,512,JSON_THROW_ON_ERROR);$service=new WarehouseUiStability($m);
    $mode=(string)($_POST['mode']??'');if(!in_array($mode,['apply','rollback'],true))throw new RuntimeException('invalid_mode');
    echo json_encode($mode==='apply'?$service->apply():$service->rollback(),JSON_THROW_ON_ERROR);
}catch(Throwable $e){http_response_code(409);$safe=['protected_carton_state_mismatch','rollback_unavailable','invalid_path','source_hash_mismatch','anchor_mismatch','staged_hash_mismatch','checkpoint_exists','backup_failed','publish_failed','readback_failed'];echo json_encode(['ok'=>false,'error'=>in_array($e->getMessage(),$safe,true)?$e->getMessage():'ui_patch_failed']);}

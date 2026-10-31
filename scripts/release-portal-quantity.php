<?php
declare(strict_types=1);
/** Install the finite owner-source order patch without exporting private source or writing state. */
// __INTEGRITY_CLASS__
final class PortalQuantityRelease
{
    private string $web;
    private string $checkpoint;
    private array $manifest;
    private array $dependencies;
    /** Inject the validated finite package and private filesystem locations. */
    public function __construct(string $web, string $checkpoint, array $manifest, array $dependencies) {
        $this->web=$web;$this->checkpoint=$checkpoint;$this->manifest=$manifest;$this->dependencies=$dependencies;
        $paths=array_merge(array_keys($manifest['before_files']),array_keys($dependencies));
        if(count($paths)!==1||count(array_unique($paths))!==1||count($manifest['expected_files'])!==1)throw new RuntimeException('invalid_manifest');
        foreach($paths as $path){
            if(!preg_match('~^config/native-order-flow[.]yaml$~D',$path)||!isset($manifest['expected_files'][$path]))throw new RuntimeException('invalid_manifest');
        }
        foreach($manifest['operations'] as $op)if(!isset($manifest['before_files'][$op['file']])||!is_string($op['old'])||$op['old']===''||!is_string($op['new'])||!is_int($op['count'])||$op['count']<1)throw new RuntimeException('invalid_manifest');
    }
    /** Require the unchanged protected-carton validator using a read-only database query. */
    private function guard(): void {
        $cfg=require $this->web.'/config.php';$m=$cfg['mysql'];
        $pdo=new PDO('mysql:host='.($m['host']??'localhost').';port='.($m['port']??3306).';dbname='.$m['database'].';charset=utf8mb4',$m['username'],$m['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $state=json_decode((string)$pdo->query('SELECT state_json FROM ghadir_state WHERE id=1')->fetchColumn(),true,512,JSON_THROW_ON_ERROR);
        foreach($this->manifest['protected_cartons'] as $code)if(!gp_preswitch_allocated_carton_integrity($state,$code)['ok'])throw new RuntimeException('protected_carton_state_mismatch');
    }
    /** Stage every bounded edit and validate dependency hashes before any publication. */
    private function stage(): array {
        $staged=[];
        foreach($this->manifest['before_files'] as $file=>$hash){
            $path=$this->web.'/'.$file;
            if(!is_file($path)||!hash_equals($hash,hash_file('sha256',$path)))throw new RuntimeException('source_hash_mismatch');
            $staged[$file]=file_get_contents($path);
        }
        foreach($this->manifest['operations'] as $op){
            if(substr_count($staged[$op['file']],$op['old'])!==$op['count'])throw new RuntimeException('anchor_mismatch');
            $staged[$op['file']]=str_replace($op['old'],$op['new'],$staged[$op['file']]);
        }
        foreach($this->dependencies as $file=>$content){
            $decoded=base64_decode($content,true);if($decoded===false)throw new RuntimeException('invalid_manifest');$staged[$file]=$decoded;
        }
        foreach($staged as $file=>$text)if(!hash_equals($this->manifest['expected_files'][$file],hash('sha256',$text)))throw new RuntimeException('staged_hash_mismatch');
        return $staged;
    }
    /** Replace each code file atomically, invalidating cached PHP bytecode. */
    private function publish(string $file,string $text): void {
        $dest=$this->web.'/'.$file;$tmp=$dest.'.web-__RUN_ID__.php';
        if(!is_dir(dirname($dest))&&!mkdir(dirname($dest),0755,true))throw new RuntimeException('publish_failed');
        if(file_put_contents($tmp,$text,LOCK_EX)!==strlen($text)||!chmod($tmp,0644)||!rename($tmp,$dest))throw new RuntimeException('publish_failed');
        if(function_exists('opcache_invalidate'))opcache_invalidate($dest,true);
    }
    /** Verify every installed file and protected carton without changing application state. */
    public function verify(): array {
        $this->guard();
        foreach($this->manifest['expected_files'] as $file=>$hash)if(!is_file($this->web.'/'.$file)||!hash_equals($hash,hash_file('sha256',$this->web.'/'.$file)))throw new RuntimeException('readback_failed');
        return ['ok'=>true,'files'=>1,'protected_cartons'=>count($this->manifest['protected_cartons']),'database_changed'=>false];
    }
    /** Restore old entrypoints before removing or restoring dependencies. */
    public function rollback(): array {
        $record=$this->checkpoint.'/before.json';if(!is_file($record))throw new RuntimeException('rollback_unavailable');
        $before=json_decode(file_get_contents($record),true,512,JSON_THROW_ON_ERROR);
        if(array_keys($before)!==array_keys($this->manifest['expected_files']))throw new RuntimeException('rollback_unavailable');
        foreach($before as $file=>$hash)if($hash!==null&&(!is_file($this->checkpoint.'/before/'.$file)||!hash_equals($hash,hash_file('sha256',$this->checkpoint.'/before/'.$file))))throw new RuntimeException('rollback_unavailable');
        foreach($before as $file=>$hash){
            if($hash!==null)$this->publish($file,file_get_contents($this->checkpoint.'/before/'.$file));
            elseif(is_file($this->web.'/'.$file)&&!unlink($this->web.'/'.$file))throw new RuntimeException('rollback_failed');
        }
        return ['ok'=>true,'rolled_back'=>true,'database_changed'=>false];
    }
    /** Check carton integrity and all hashes, checkpoint five paths, then publish dependencies first. */
    public function apply(): array {
        $this->guard();$staged=$this->stage();
        if(file_exists($this->checkpoint)||!mkdir($this->checkpoint,0700,true))throw new RuntimeException('checkpoint_exists');
        $before=[];
        foreach($this->manifest['expected_files'] as $file=>$hash){
            $path=$this->web.'/'.$file;$before[$file]=is_file($path)?hash_file('sha256',$path):null;
            if($before[$file]===null)continue;
            $saved=$this->checkpoint.'/before/'.$file;
            if(!is_dir(dirname($saved))&&!mkdir(dirname($saved),0700,true))throw new RuntimeException('backup_failed');
            if(!copy($path,$saved)||!chmod($saved,0600)||!hash_equals($before[$file],hash_file('sha256',$saved)))throw new RuntimeException('backup_failed');
        }
        $record=json_encode($before,JSON_THROW_ON_ERROR);
        if(file_put_contents($this->checkpoint.'/before.json',$record,LOCK_EX)!==strlen($record)||!chmod($this->checkpoint.'/before.json',0600))throw new RuntimeException('backup_failed');
        try{
            foreach(array_keys($this->dependencies) as $file)$this->publish($file,$staged[$file]);
            foreach(array_keys($this->manifest['before_files']) as $file)$this->publish($file,$staged[$file]);
            return $this->verify()+['code_backup'=>true];
        }catch(Throwable $error){$this->rollback();throw $error;}
    }
}
if(defined('PORTAL_QUANTITY_RELEASE_TEST'))return;
ini_set('display_errors','0');set_time_limit(120);
header('Content-Type:application/json; charset=utf-8');header('Cache-Control:no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!hash_equals('__TOKEN__',(string)($_SERVER['HTTP_X_GP_RECONCILE_TOKEN']??''))){http_response_code(403);exit('{"ok":false}');}
try{
    $manifest=json_decode(base64_decode('__MANIFEST_B64__'),true,512,JSON_THROW_ON_ERROR);
    $dependencies=json_decode(base64_decode('__DEPENDENCIES_B64__'),true,512,JSON_THROW_ON_ERROR);
    $service=new PortalQuantityRelease(__DIR__,dirname(__DIR__).'/.gp-portal-quantity-__RUN_ID__',$manifest,$dependencies);
    $mode=(string)($_POST['mode']??'');
    if(!in_array($mode,['apply','verify','rollback'],true))throw new RuntimeException('invalid_mode');
    echo json_encode($service->$mode(),JSON_THROW_ON_ERROR);
}catch(Throwable $error){
    http_response_code(409);$safe=['protected_carton_state_mismatch','invalid_manifest','source_hash_mismatch','anchor_mismatch','staged_hash_mismatch','publish_failed','readback_failed','checkpoint_exists','backup_failed','rollback_unavailable','rollback_failed','invalid_mode'];
    echo json_encode(['ok'=>false,'error'=>in_array($error->getMessage(),$safe,true)?$error->getMessage():'portal_quantity_release_failed']);
}

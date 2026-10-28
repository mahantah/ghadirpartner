<?php
declare(strict_types=1);
/** Restore reviewed code privately on the owner's host; never restore database state. */
// __READER_CLASS__
// __INTEGRITY_CLASS__
final class CorrectSourceRecovery
{
    private string $web;
    private string $private;
    private array $manifest;
    /** Initialize the finite reviewed recovery manifest and private checkpoint. */
    public function __construct(array $manifest) {
        $this->web=__DIR__;
        $this->private=dirname(__DIR__).'/.gp-correct-source-__RUN_ID__';
        $this->manifest=$manifest;
    }
    /** Back up current database server-side and require the original carton guard. */
    private function guard(): void {
        $cfg=require $this->web.'/config.php';$m=$cfg['mysql'];
        $pdo=new PDO('mysql:host='.($m['host']??'localhost').';port='.($m['port']??3306).';dbname='.$m['database'].';charset=utf8mb4',$m['username'],$m['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $row=$pdo->query('SELECT state_json FROM ghadir_state WHERE id=1')->fetch(PDO::FETCH_ASSOC);
        $state=json_decode((string)$row['state_json'],true,512,JSON_THROW_ON_ERROR);
        foreach($this->manifest['protected_cartons'] as $code)if(!gp_preswitch_allocated_carton_integrity($state,$code)['ok'])throw new RuntimeException('protected_carton_state_mismatch');
        $backup=$this->private.'/current-state-before.json';
        if(file_put_contents($backup,$row['state_json'],LOCK_EX)!==strlen($row['state_json']))throw new RuntimeException('backup_failed');
        chmod($backup,0600);
    }
    /** Extract the small code-only tar using only gzip; reject any undeclared member. */
    private function extract(string $archive,string $stage): void {
        $input=gzopen($archive,'rb');if(!$input)throw new RuntimeException('archive_unavailable');
        try{
            while(!gzeof($input)){
                $header=gzread($input,512);if($header===false||strlen($header)!==512)throw new RuntimeException('source_hash_mismatch');
                if(trim($header,"\0")==='')break;
                $path=rtrim(substr($header,0,100),"\0");
                if(!isset($this->manifest['expected_files'][$path]))throw new RuntimeException('source_hash_mismatch');
                $size=(int)octdec(trim(substr($header,124,12),"\0 "));
                $target=$stage.'/'.$path;if(!is_dir(dirname($target)))mkdir(dirname($target),0700,true);
                $output=fopen($target,'wb');if(!$output)throw new RuntimeException('source_hash_mismatch');
                try{
                    $remaining=(int)(ceil($size/512)*512);$content=$size;
                    while($remaining>0){
                        $length=min(65536,$remaining);$chunk=gzread($input,$length);
                        if($chunk===false||strlen($chunk)!==$length)throw new RuntimeException('source_hash_mismatch');
                        $write=min($content,$length);if($write>0&&fwrite($output,substr($chunk,0,$write))!==$write)throw new RuntimeException('source_hash_mismatch');
                        $content-=$write;$remaining-=$length;
                    }
                }finally{fclose($output);}
            }
        }finally{gzclose($input);}
    }
    /** Stage hash-checked public dependencies absent from the original code archive. */
    private function stagePublicFiles(string $stage): void {
        // New public dependencies are not in the owner's original archive.
        foreach($this->manifest['public_files']??[] as $path){
            if(!isset($this->manifest['expected_files'][$path])||!isset($this->manifest['public_file_contents'][$path])||strpos($path,'..')!==false||$path[0]==='/')throw new RuntimeException('source_hash_mismatch');
            $text=base64_decode($this->manifest['public_file_contents'][$path],true);
            if($text===false||!hash_equals($this->manifest['expected_files'][$path],hash('sha256',$text)))throw new RuntimeException('source_hash_mismatch');
            $target=$stage.'/'.$path;if(!is_dir(dirname($target)))mkdir(dirname($target),0700,true);
            if(file_put_contents($target,$text,LOCK_EX)!==strlen($text))throw new RuntimeException('source_hash_mismatch');
        }
    }
    /** Restore code from the private pre-recovery checkpoint; never touch runtime data. */
    public function rollback(): array {
        $record=$this->private.'/before.json';
        if(!is_file($record))throw new RuntimeException('no_checkpoint');
        foreach(json_decode(file_get_contents($record),true,512,JSON_THROW_ON_ERROR) as $path=>$exists){
            $destination=$this->web.'/'.$path;
            if($exists){if(!copy($this->private.'/before/'.$path,$destination))throw new RuntimeException('rollback_failed');chmod($destination,0644);}
            elseif(is_file($destination))unlink($destination);
        }
        return ['ok'=>true,'mode'=>'rolled_back'];
    }
    /** Validate every staged hash before replacing application code atomically per file. */
    public function apply(): array {
        if(is_file($this->private.'/complete'))throw new RuntimeException('already_applied');
        if(!is_dir($this->private)&&!mkdir($this->private,0700,true))throw new RuntimeException('private_directory_failed');
        $tar=$this->private.'/source.tar.gz';
        (new BackupCodeReader())->copy('__ARCHIVE__',$tar);
        $stage=$this->private.'/stage';mkdir($stage,0700,true);
        $this->extract($tar,$stage);
        $this->stagePublicFiles($stage);
        foreach($this->manifest['operations'] as $operation){
            $path=$stage.'/'.$operation['file'];$text=file_get_contents($path);
            if(substr_count($text,$operation['old'])!==$operation['count'])throw new RuntimeException('patch_anchor_mismatch');
            file_put_contents($path,str_replace($operation['old'],$operation['new'],$text));
        }
        $paths=array_keys($this->manifest['expected_files']);
        foreach($this->manifest['expected_files'] as $path=>$hash){
            if(strpos($path,'..')!==false||$path[0]==='/'||!is_file($stage.'/'.$path)||!hash_equals($hash,hash_file('sha256',$stage.'/'.$path)))throw new RuntimeException('source_hash_mismatch');
        }
        $this->guard();
        $before=[];
        foreach($paths as $path){
            $source=$this->web.'/'.$path;$before[$path]=is_file($source);
            if(!$before[$path])continue;
            $saved=$this->private.'/before/'.$path;if(!is_dir(dirname($saved)))mkdir(dirname($saved),0700,true);
            if(!copy($source,$saved))throw new RuntimeException('code_backup_failed');chmod($saved,0600);
        }
        file_put_contents($this->private.'/before.json',json_encode($before,JSON_THROW_ON_ERROR),LOCK_EX);
        // Dependencies first, then entrypoints; no configuration or data paths are in this manifest.
        usort($paths,static function(string $a,string $b): int {
            $priority=['lib/storage.php'=>5,'partners/index.php'=>6,'index.php'=>7,'partners/portal.html'=>8,'mobile.html'=>9,'app.html'=>10];
            return ($priority[$a]??0)<=>($priority[$b]??0);
        });
        try{
            foreach($paths as $path){
                $destination=$this->web.'/'.$path;if(!is_dir(dirname($destination)))mkdir(dirname($destination),0755,true);
                $temporary=$destination.'.recovery-__RUN_ID__.php';
                if(!copy($stage.'/'.$path,$temporary)||!chmod($temporary,0644)||!rename($temporary,$destination))throw new RuntimeException('code_publish_failed');
            }
            foreach($this->manifest['expected_files'] as $path=>$hash)if(!hash_equals($hash,hash_file('sha256',$this->web.'/'.$path)))throw new RuntimeException('code_readback_failed');
        }catch(Throwable $error){$this->rollback();throw $error;}
        file_put_contents($this->private.'/complete','verified');
        return ['ok'=>true,'mode'=>'applied','files'=>count($paths),'code_backup'=>true,'database_backup'=>true,'database_restored'=>false];
    }
}
if(defined('CORRECT_SOURCE_TEST'))return;
ini_set('display_errors','0');set_time_limit(330);
header('Content-Type:application/json; charset=utf-8');header('Cache-Control:no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!hash_equals('__TOKEN__',(string)($_SERVER['HTTP_X_GP_RECONCILE_TOKEN']??''))){http_response_code(403);exit('{"ok":false}');}
try{
    $manifest=json_decode(base64_decode('__MANIFEST_B64__'),true,512,JSON_THROW_ON_ERROR);
    $service=new CorrectSourceRecovery($manifest);$mode=(string)($_POST['mode']??'');
    if(!in_array($mode,['apply','rollback'],true))throw new RuntimeException('invalid_mode');
    echo json_encode($mode==='apply'?$service->apply():$service->rollback(),JSON_THROW_ON_ERROR);
}catch(Throwable $error){
    http_response_code(409);$safe=['protected_carton_state_mismatch','backup_failed','no_checkpoint','already_applied','patch_anchor_mismatch','source_hash_mismatch','code_backup_failed','code_publish_failed','code_readback_failed','application_code_not_found','archive_unavailable'];
    echo json_encode(['ok'=>false,'error'=>in_array($error->getMessage(),$safe,true)?$error->getMessage():'source_recovery_failed']);
}

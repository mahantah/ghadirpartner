<?php
declare(strict_types=1);
/** Exercise deployment staging, tamper guards and dependency-safe rollback with synthetic code. */
define('PARTIAL_DISPATCH_RELEASE_TEST',true);
require dirname(__DIR__).'/scripts/release-partial-dispatch.php';
$root=sys_get_temp_dir().'/gp-native-release-'.bin2hex(random_bytes(8));mkdir($root,0700,true);
$before=['index.php'=>'old root'];
$contents=['lib/partial-dispatch.php'=>'public helper','lib/partial-dispatch-routes.php'=>'public routes','config/partial-dispatch.yaml'=>'{}'];
$manifest=['before_files'=>[],'expected_files'=>[],'operations'=>[],'protected_cartons'=>[]];
foreach($before as $path=>$text){file_put_contents($root.'/'.$path,$text);$manifest['before_files'][$path]=hash('sha256',$text);$manifest['expected_files'][$path]=hash('sha256',str_replace('old','new',$text));$manifest['operations'][]=['file'=>$path,'old'=>'old','new'=>'new','count'=>1];}
foreach($contents as $path=>$text)$manifest['expected_files'][$path]=hash('sha256',$text);
$dependencies=array_map('base64_encode',$contents);
$service=new PartialDispatchRelease($root,$root.'/checkpoint',$manifest,$dependencies);
$stage=new ReflectionMethod($service,'stage');$stage->setAccessible(true);
$staged=$stage->invoke($service);
if($staged['index.php']!=='new root'||count($staged)!==4)throw new RuntimeException('staging_failed');
file_put_contents($root.'/index.php','unexpected');
try{$stage->invoke($service);throw new LogicException('tampered source accepted');}catch(RuntimeException $e){if($e->getMessage()!=='source_hash_mismatch')throw $e;}
file_put_contents($root.'/index.php','old root');
$bad=$dependencies;$bad['lib/partial-dispatch.php']=base64_encode('tampered');
try{$stage->invoke(new PartialDispatchRelease($root,$root.'/checkpoint',$manifest,$bad));throw new LogicException('tampered dependency accepted');}catch(RuntimeException $e){if($e->getMessage()!=='staged_hash_mismatch')throw $e;}
$record=[];
foreach($manifest['expected_files'] as $path=>$hash){
    $record[$path]=isset($before[$path])?hash('sha256',$before[$path]):null;
    if(isset($before[$path])){$saved=$root.'/checkpoint/before/'.$path;if(!is_dir(dirname($saved)))mkdir(dirname($saved),0700,true);file_put_contents($saved,$before[$path]);}
    if(!is_dir(dirname($root.'/'.$path)))mkdir(dirname($root.'/'.$path),0700,true);
    file_put_contents($root.'/'.$path,$staged[$path]);
}
file_put_contents($root.'/checkpoint/before.json',json_encode($record,JSON_THROW_ON_ERROR));
$service->rollback();
foreach($before as $path=>$text)if(file_get_contents($root.'/'.$path)!==$text)throw new RuntimeException('rollback_failed');
foreach($contents as $path=>$text)if(file_exists($root.'/'.$path))throw new RuntimeException('rollback_left_dependency');
$iterator=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
foreach($iterator as $path){if($path->isDir())rmdir($path->getPathname());else unlink($path->getPathname());}rmdir($root);
echo "PASS: all files staged before publication, source/dependency tamper blocked, rollback restores entrypoints and removes new dependencies\n";

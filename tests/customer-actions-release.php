<?php
declare(strict_types=1);
/** Validate actual finite staging and rollback with synthetic owner source. */
define('CUSTOMER_ACTIONS_RELEASE_TEST',true);
require dirname(__DIR__).'/scripts/release-customer-actions.php';
$root=sys_get_temp_dir().'/gp-actions-'.bin2hex(random_bytes(8));mkdir($root,0700,true);mkdir($root.'/assets');
$paths=['assets/kartabl-sync-v1.js','assets/order-action-burger-v1.css','app.html'];
$manifest=['before_files'=>[],'expected_files'=>[],'operations'=>[],'protected_cartons'=>[]];
foreach($paths as $file){file_put_contents($root.'/'.$file,'old');$manifest['before_files'][$file]=hash('sha256','old');$manifest['expected_files'][$file]=hash('sha256','new');$manifest['operations'][]=['file'=>$file,'old'=>'old','new'=>'new','count'=>1];}
$service=new CustomerActionsRelease($root,$root.'/checkpoint',$manifest,[]);
$stage=new ReflectionMethod($service,'stage');$stage->setAccessible(true);$staged=$stage->invoke($service);
if(count($staged)!==3||count(array_unique($staged))!==1||$staged['app.html']!=='new')throw new RuntimeException('staging_failed');
file_put_contents($root.'/app.html','unexpected');
try{$stage->invoke($service);throw new LogicException('tampered_source_accepted');}catch(RuntimeException $e){if($e->getMessage()!=='source_hash_mismatch')throw $e;}
$record=[];
foreach($paths as $file){$saved=$root.'/checkpoint/before/'.$file;if(!is_dir(dirname($saved)))mkdir(dirname($saved),0700,true);file_put_contents($saved,'old');file_put_contents($root.'/'.$file,'new');$record[$file]=hash('sha256','old');}
file_put_contents($root.'/checkpoint/before.json',json_encode($record,JSON_THROW_ON_ERROR));$service->rollback();
foreach($paths as $file)if(file_get_contents($root.'/'.$file)!=='old')throw new RuntimeException('rollback_failed');
$iterator=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
foreach($iterator as $file){if($file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($root);
echo "PASS: three bounded code paths, source tamper blocked and rollback restored every file\n";

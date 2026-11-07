<?php
function verify($v,$m){if(!$v)throw new RuntimeException($m);}
$root=__DIR__;$tmp=sys_get_temp_dir().'/gp-storage-test-'.bin2hex(random_bytes(5));mkdir($tmp);
foreach(['warehouse-repository.php','warehouse-ledger-integrity.php','warehouse-read-service.php'] as $name)file_put_contents($tmp.'/'.$name,'<?php');
class GpWarehouseRepository {public array $calls=[];public function sync(string $c,array $b,array $a):void{$this->calls[]=$c;}}
class GpWarehouseLedgerIntegrity {}
copy($root.'/candidate/lib/warehouse-storage.php',$tmp.'/warehouse-storage.php');require $tmp.'/warehouse-storage.php';
try{
 $repo=new GpWarehouseRepository();$storage=new GpWarehouseStorage($repo,new GpWarehouseLedgerIntegrity(),['version'=>1,'page_size'=>100,'max_page_size'=>250,'core_read_paths'=>[]]);
 $before=['inventory'=>[['id'=>1,'serial'=>'A']],'cartons'=>[['id'=>1]],'warehouse_movements'=>[['id'=>1]]];
 $after=$before+['warehouse_storage_version'=>1];$persisted=$storage->persist($before,$after);verify($repo->calls===[],'unchanged writes skipped');verify(!isset($persisted['inventory']),'split metadata kept separate');
 $after['inventory'][0]['serial']='B';$storage->persist($before,$after);verify($repo->calls===['inventory'],'only inventory synchronised');
 $source=file_get_contents($root.'/candidate/index.php');$start=strpos($source,'// Validate and deduplicate the import');$end=strpos($source,"out(['added'=>\$added",$start);$code=substr($source,$start,$end-$start);
 $state=['inventory'=>[['id'=>1,'serial'=>'A']],'next_serial'=>2];$transactions=0;
 function db($write,$fn){global $state,$transactions;$transactions++;return $fn($state);}function valid_serial($prod,$sn){return $prod==='P'&&preg_match('/^[A-Z]+$/',$sn);}function now(){return 'fixture';}
 $rs=[['P','a'],['P','B'],['P','b'],['P','C'],['P','bad-1'],['bad product','D']];$uu=['username'=>'fixture'];$added=0;eval($code);
 verify($transactions===1&&$added===2&&count($state['inventory'])===3,'one transaction and duplicate/invalid filtering');
 echo "PASS: unchanged table writes skipped; bulk import one transaction; duplicates/invalid rows skipped\n";
}finally{foreach(glob($tmp.'/*') as $p)unlink($p);rmdir($tmp);}

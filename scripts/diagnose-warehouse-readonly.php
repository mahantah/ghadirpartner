<?php
declare(strict_types=1);
/** Return only collection shape and aggregate health; never export records. */
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD']??'')!=='POST' || !hash_equals('__TOKEN__',(string)($_SERVER['HTTP_X_GP_RECONCILE_TOKEN']??''))) {http_response_code(403);exit('{"ok":false}');}
try {
    $cfg=require __DIR__.'/config.php';$m=$cfg['mysql'];
    $pdo=new PDO('mysql:host='.($m['host']??'localhost').';port='.($m['port']??3306).';dbname='.$m['database'].';charset=utf8mb4',$m['username'],$m['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $row=$pdo->query('SELECT state_json,revision FROM ghadir_state WHERE id=1')->fetch(PDO::FETCH_ASSOC);
    $s=json_decode((string)$row['state_json'],true,512,JSON_THROW_ON_ERROR);
    $summary=[];
    foreach(['orders','products','inventory','cartons','warehouse_movements','warehouse_baseline','warehouses'] as $key){
        $a=$s[$key]??null;
        $summary[$key]=['type'=>gettype($a),'count'=>is_array($a)?count($a):0,'list'=>is_array($a)&&(!$a||array_keys($a)===range(0,count($a)-1))];
    }
    $physical=[];$invalid=0;
    foreach($s['inventory']??[] as $iv){if(!is_array($iv)){$invalid++;continue;}$wid=(int)($iv['warehouse_id']??-1);$physical[$wid]=($physical[$wid]??0)+1;}
    $errors=[];$log=dirname(__DIR__).'/logs/php.error.log';
    if(is_readable($log)){
        $f=fopen($log,'rb');fseek($f,max(0,filesize($log)-32768));$tail=stream_get_contents($f);fclose($f);
        foreach(explode("\n",$tail) as $line){
            if(!preg_match('/PHP (Fatal error|Warning|Notice|Parse error).* in (\/[^ ]+) on line ([0-9]+)/',$line,$hit))continue;
            $category=strpos($line,'Allowed memory size')!==false?'memory':(strpos($line,'Maximum execution time')!==false?'timeout':$hit[1]);
            $errors[]=['type'=>$category,'file'=>basename($hit[2]),'line'=>(int)$hit[3]];
        }
    }
    echo json_encode(['ok'=>true,'read_only'=>true,'revision'=>(int)$row['revision'],'bytes'=>strlen($row['state_json']),'collections'=>$summary,'physical_by_warehouse'=>$physical,'invalid_inventory_rows'=>$invalid,'memory_limit'=>ini_get('memory_limit'),'recent_errors'=>array_slice($errors,-12)],JSON_THROW_ON_ERROR);
} catch(Throwable $e){http_response_code(500);echo '{"ok":false,"error":"diagnostic_failed"}';}

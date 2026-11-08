<?php
/** Exercise the real selected-export route against synthetic state only. */
$source=file_get_contents(__DIR__.'/candidate/index.php');
$start=strpos($source,"if(\$p==='/export/selected-serials.xlsx'){");$end=strpos($source,'/* PARTIAL_SHIPMENT_BATCH_EXPORT_',$start);$route=substr($source,$start,$end-$start);
if($start===false||$end===false)throw new RuntimeException('export route anchors missing');
$p='/export/selected-serials.xlsx';$captured=[];$denied=false;$roles=[];
$state=['inventory'=>[['id'=>11,'serial'=>'00001234567890123456','product'=>'P','order_id'=>0],['id'=>12,'serial'=>'A-02','product'=>'P','order_id'=>7],['id'=>13,'serial'=>'NOT-SELECTED','product'=>'Q','order_id'=>0]],'orders'=>[['id'=>7,'number'=>'PRIVATE-ORDER','customer_id'=>9]],'customers'=>[['id'=>9,'name'=>'PRIVATE-CUSTOMER']]];
function auth($allowed){global $denied,$roles;$roles=$allowed;if($denied)throw new RuntimeException('denied',403);}
function fail($message,$status=400){throw new RuntimeException($message,$status);}
function db($write,$callback){global $state;if($write)throw new RuntimeException('unexpected write');return $callback($state);}
function idx($rows,$id){foreach($rows as $i=>$row)if((int)$row['id']===(int)$id)return $i;return -1;}
if(($argv[1]??'')==='--xlsx'){
 $a=strpos($source,'function xlsx_out(');$b=strpos($source,'function product_manufacturer_from_state(',$a);eval(substr($source,$a,$b-$a));$_GET=['ids'=>'11,12','serial_only'=>'1'];eval($route);exit;
}
if(($argv[1]??'')!=='--xlsx'){function xlsx_out($filename,$rows){global $captured;$captured=['filename'=>$filename,'rows'=>$rows];throw new RuntimeException('captured',299);}}
function run_export($query){global $_GET,$route,$captured;$_GET=$query;try{eval($route);}catch(RuntimeException $e){if($e->getCode()!==299)throw $e;}return $captured;}
$result=run_export(['ids'=>'11,12,11','serial_only'=>'1']);if($result['rows']!==[['00001234567890123456'],['A-02']])throw new RuntimeException('serial-only cells mismatch');
if($roles!==['admin','sales','prep','viewer'])throw new RuntimeException('access contract changed');
$result=run_export(['ids'=>'12']);if(count($result['rows'][0])!==6||count($result['rows'])!==2)throw new RuntimeException('legacy export changed');
try{run_export(['ids'=>'999','serial_only'=>'1']);throw new LogicException('missing rows accepted');}catch(RuntimeException $e){if($e->getCode()!==404)throw $e;}
$denied=true;try{run_export(['ids'=>'11','serial_only'=>'1']);throw new LogicException('denied request accepted');}catch(RuntimeException $e){if($e->getCode()!==403)throw $e;}
echo "PASS: only selected serial cells, no header/metadata, exact text, existing roles and legacy format retained\n";

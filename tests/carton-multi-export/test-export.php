<?php
/** Test the actual carton export route with synthetic cartons and serials. */
$source=file_get_contents(__DIR__.'/candidate/index.php');$start=strpos($source,"/* Selected carton export is read-only");$end=strpos($source,"if(\$p==='/export/selected-serials.xlsx')",$start);if($start===false||$end===false)throw new RuntimeException('route anchors missing');$route=substr($source,$start,$end-$start);
$p='/export/carton-serials.xlsx';$captured=[];$denied=false;$roles=[];
$state=['cartons'=>[['id'=>1,'code'=>'BOX-ONE'],['id'=>2,'code'=>'BOX-TWO'],['id'=>3,'code'=>'BOX-THREE']],'inventory'=>[['serial'=>'00001234567890123456','carton_id'=>1,'order_id'=>0],['serial'=>'A-02','carton_id'=>2,'order_id'=>7],['serial'=>' a-02 ','carton_id'=>2,'order_id'=>0],['serial'=>'UNSELECTED','carton_id'=>3,'order_id'=>0]]];
function auth($allowed){global $denied,$roles;$roles=$allowed;if($denied)throw new RuntimeException('denied',403);}
function fail($message,$status=400){throw new RuntimeException($message,$status);}
function db($write,$callback){global $state;if($write)throw new RuntimeException('unexpected write');return $callback($state);}
if(($argv[1]??'')==='--xlsx'){$a=strpos($source,'function xlsx_out(');$b=strpos($source,'function product_manufacturer_from_state(',$a);eval(substr($source,$a,$b-$a));$_POST=['carton_ids'=>'1,2'];eval($route);exit;}
if(($argv[1]??'')!=='--xlsx'){function xlsx_out($filename,$rows){global $captured;$captured=['filename'=>$filename,'rows'=>$rows];throw new RuntimeException('captured',299);}}
function run_export($post,$get=[]){global $_POST,$_GET,$route,$captured,$p;$_POST=$post;$_GET=$get;try{eval($route);}catch(RuntimeException $e){if($e->getCode()!==299)throw $e;}return $captured;}
$result=run_export(['carton_ids'=>'1,2,1']);if($result['rows']!==[['00001234567890123456'],['A-02']])throw new RuntimeException('multi-carton serial-only data mismatch');
if($roles!==['admin','sales','prep','viewer'])throw new RuntimeException('inventory export permissions changed');
$result=run_export([],['carton_ids'=>'2']);if($result['rows']!==[['A-02']])throw new RuntimeException('single selected carton mismatch');
$state['inventory'][]=['serial'=>'CODE-LINKED','carton_id'=>0,'carton_code'=>'box-one','order_id'=>0];$result=run_export(['carton_ids'=>'1']);if($result['rows']!==[['00001234567890123456'],['CODE-LINKED']])throw new RuntimeException('code-linked inventory must follow carton selection');
try{run_export(['carton_ids'=>'999']);throw new LogicException('unknown carton accepted');}catch(RuntimeException $e){if($e->getCode()!==404)throw $e;}
try{run_export(['carton_ids'=>'-1,0']);throw new LogicException('invalid selection accepted');}catch(RuntimeException $e){if($e->getCode()!==400)throw $e;}
$denied=true;try{run_export(['carton_ids'=>'1']);throw new LogicException('unauthorized export accepted');}catch(RuntimeException $e){if($e->getCode()!==403)throw $e;}
echo "PASS: selected cartons only, assigned and code-linked serials, deduplication, exact text, access and validation\n";

<?php
declare(strict_types=1);
require __DIR__ . '/warehouse-storage.php';

$pdo = new WarehouseTestPdo();
// SQLite exposes extracted strings directly; MySQL exposes JSON strings to JSON_UNQUOTE.
$pdo->sqliteCreateFunction('JSON_UNQUOTE', static fn(mixed $value): mixed => $value);
$pdo->sqliteCreateFunction('JSON_TYPE', static fn(mixed $value): string => $value === null ? 'NULL' : 'STRING');
$pdo->sqliteCreateFunction('CONCAT', static fn(mixed ...$values): string => implode('', $values));
$pdo->sqliteCreateFunction('CONCAT_WS', static fn(string $separator, mixed ...$values): string => implode($separator, $values));
$pdo->sqliteCreateFunction('LOWER', static fn(string $value): string => mb_strtolower($value, 'UTF-8'));
$repository = new GpWarehouseRepository($pdo);
$repository->createSchema();
$rows = [
 ['id'=>1,'product'=>'I90','serial'=>'SN-ONE','carton_id'=>10,'carton_code'=>'BOX-A','order_id'=>0,'shelf_level'=>2,'imei'=>null,'supplier'=>'تأمین تست'],
 ['id'=>2,'product'=>'I90','serial'=>'SN-TWO','carton_id'=>10,'carton_code'=>'BOX-A','order_id'=>7,'order_number'=>'GHP-7','shelf_level'=>0],
 ['id'=>3,'product'=>'I80','serial'=>'SN-%_!','carton_id'=>0,'carton_code'=>'BOX-A','order_id'=>0,'shelf_level'=>3],
 ['id'=>4,'product'=>'I80','serial'=>'SN-FOUR','order_id'=>88,'order_number'=>'ORPHAN'],
 ['id'=>5,'product'=>'I80','serial'=>'SN-FIVE','order_id'=>7,'order_number'=>'GHP-7','supplier'=>'supplier'],
];
$cartons = [['id'=>10,'code'=>'BOX-A','serials'=>['SN-ONE','SN-TWO'],'capacity'=>2]];
$pdo->beginTransaction();
$repository->sync('inventory', [], $rows); $repository->sync('cartons', [], $cartons);
$pdo->commit();
$policy = json_decode(file_get_contents(dirname(__DIR__) . '/config/warehouse-storage.yaml'), true);
$facade = new GpWarehouseStorage($repository, new GpWarehouseLedgerIntegrity(), $policy);
$core = ['orders'=>[['id'=>7,'number'=>'GHP-7','customer_id'=>9]],'customers'=>[['id'=>9,'name'=>'مشتری تست','company'=>'شرکت تست','code'=>'CUSTOMER-9','mobile'=>'09000000000']]];
$overview = $facade->inventoryOverview($core, '', 'all');
verify($overview['total']===5 && $overview['free']===2 && $overview['assigned']===3, 'global ownership counters');
verify($overview['groups'][0]['key']==='free' && $overview['groups'][0]['count']===2, 'free group first');
verify($facade->inventoryOverview($core, 'شرکت تست', 'all')['matched']===2, 'Persian customer metadata search');
verify($facade->inventoryOverview($core, 'i90 sn-one', 'all')['matched']===1, 'search across adjacent serial fields');
verify($facade->inventoryOverview($core, 'supplier مشتری', 'all')['matched']===1, 'search across serial and customer boundary');
verify($facade->inventoryOverview($core, '%_!', 'all')['matched']===1, 'SQL wildcards remain literal user text');
verify($facade->inventoryOverview($core, 'null', 'all')['matched']===0, 'JSON null fields do not become searchable strings');
verify($facade->inventoryOverview($core, 'سفارش orphan', 'all')['matched']===1, 'orphan labels preserved');
$first = $facade->inventoryGroup($core, 'o-7', '', 'all', 0, 1);
$second = $facade->inventoryGroup($core, 'o-7', '', 'all', 1, 1);
verify($first['rows'][0]['id']===5 && $first['has_more'] && $second['rows'][0]['id']===2 && !$second['has_more'], 'stable descending page boundary');
verify($facade->inventoryGroup($core, 'o-7', '', 'free', 0, 100)['total']===0, 'group respects free filter');
verify($facade->inventoryGroup($core, 'unknown-7', '', 'all', 0, 100)['total']===0, 'known order cannot masquerade as orphan');
verify($facade->inventoryGroup($core, 'unknown-88', '', 'all', 0, 100)['total']===1, 'orphan group remains available');
$mobile = $facade->mobilePage('box-a', 1, 1);
verify(count($mobile['rows'])===1 && $mobile['total']===3 && $mobile['free']===2 && $mobile['assigned']===3, 'mobile searches full stock while counters remain global');
$compact = $facade->compactWarehouse();
verify($compact['inventory']===[] && $compact['cartons']===$cartons, 'compact response preserves label serials without full inventory');
verify($compact['carton_stats'][0]['total']===3 && $compact['carton_stats'][0]['free']===2, 'carton code fallback and ownership counts');
verify($compact['supplier_hints'][0]['supplier']==='تأمین تست', 'compact metadata preserves first-row supplier hints');
verify($compact['shelves'][2]['n']===1 && $compact['shelves'][3]['by']['I80']===1, 'shelf product counters');
$before = GpWarehouseRepository::encode($repository->read('inventory'));
$facade->inventoryOverview($core,'','all'); $facade->mobilePage('',1,2); $facade->compactWarehouse();
verify($before===GpWarehouseRepository::encode($repository->read('inventory')), 'reads never mutate stock or allocation');

// A realistic sanitized dataset proves page size and payload reduction without production data.
$big=[];
for($id=6;$id<=30005;$id++) $big[]=['id'=>$id,'product'=>'I90','serial'=>'BENCH-'.$id,'order_id'=>0,'carton_id'=>10,'carton_code'=>'BOX-A','shelf_level'=>0,'added_at'=>'2026-11-04 10:00:00','added_by'=>'fixture'];
$pdo->beginTransaction();$repository->sync('inventory',$rows,array_merge($rows,$big));$pdo->commit();
$started=hrtime(true);$page=$facade->mobilePage('',1,200);$elapsed=(hrtime(true)-$started)/1e6;
verify(count($page['rows'])===200 && $page['total']===30005,'30k serials remain bounded to 200 rows');
$fullBytes=strlen(GpWarehouseRepository::encode(array_merge($rows,$big)));$pageBytes=strlen(GpWarehouseRepository::encode($page));
verify($pageBytes<$fullBytes/50,'page transfer must be at least 50x smaller on fixture');
echo json_encode(['status'=>'passed','fixture_serials'=>30005,'page_rows'=>count($page['rows']),'full_bytes'=>$fullBytes,'page_bytes'=>$pageBytes,'page_ms'=>round($elapsed,2)],JSON_UNESCAPED_UNICODE)."\n";

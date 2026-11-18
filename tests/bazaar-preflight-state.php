<?php
declare(strict_types=1);
require_once __DIR__.'/../scripts/bazaar-preflight-state.php';
require_once __DIR__.'/../lib/preswitch-carton-integrity.php';
$inventory = []; $serials = [];
for ($i = 0; $i < 20; $i++) {
    $serials[] = 'FIXTURE-'.$i;
    $inventory[] = ['id'=>$i+1,'serial'=>'FIXTURE-'.$i,'product'=>'I90','warehouse_id'=>1,'order_id'=>7,'order_number'=>'FIXTURE-7','carton_id'=>1,'carton_code'=>'I90-097'];
}
$cartons = [['id'=>1,'code'=>'I90-097','product'=>'I90','serials'=>$serials]];
$state = ['orders'=>[['id'=>7,'number'=>'FIXTURE-7','status'=>'در حال آماده سازی','items'=>[['product'=>'I90','qty'=>20,'serials'=>$serials]]]],'settings'=>['fixture'=>true]];
$rows = ['ghadir_inventory_cartons'=>array_map('json_encode', $cartons),'ghadir_inventory_serials'=>array_map('json_encode', $inventory)];
$reads = [];
$helper = new GpBazaarPreflightState(static function (string $table) use (&$reads, &$rows): array { $reads[] = $table; return $rows[$table]; });
$hydrated = $helper->hydrate($state);
if (!gp_preswitch_allocated_carton_integrity($hydrated, 'I90-097')['ok'] || $hydrated['orders'] !== $state['orders'] || $hydrated['settings'] !== $state['settings']) throw new RuntimeException('Canonical normalized data must preserve the original strict guard and state');
$beforeReads = $reads;
if ($helper->hydrate($hydrated) !== $hydrated || $reads !== $beforeReads) throw new RuntimeException('Do not replace legacy collections or duplicate reads');
array_pop($rows['ghadir_inventory_serials']);
if (gp_preswitch_allocated_carton_integrity($helper->hydrate($state), 'I90-097')['ok']) throw new RuntimeException('Missing protected units must still block deployment');
$invalid = false; $rows['ghadir_inventory_serials'] = ['{"unexpected":"shape"}'];
try { $helper->hydrate($state); } catch (RuntimeException $error) { $invalid = true; }
if (!$invalid) throw new RuntimeException('Unknown canonical schema must fail closed');
echo "PASS: read-only normalized/legacy hydration preserves all strict protected-carton checks\n";

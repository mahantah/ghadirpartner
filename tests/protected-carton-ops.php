<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/protected-cartons.php';

function gp_load_state(string $name): array {
    $path = __DIR__ . '/fixtures/' . $name;
    $s = json_decode((string)file_get_contents($path), true);
    if (!is_array($s)) {
        throw new RuntimeException('fixture unreadable: ' . $name);
    }
    return $s;
}

function gp_assert(bool $cond, string $msg): void {
    if (!$cond) {
        throw new RuntimeException($msg);
    }
}

$ok = gp_load_state('preswitch_protected_ok.json');
$bad = gp_load_state('preswitch_protected_mismatch.json');

gp_assert(ghadir_protected_carton_first_mismatch($ok) === null, 'healthy fixture should pass');
$first = ghadir_protected_carton_first_mismatch($bad);
gp_assert(is_array($first) && $first['code'] === 'I90-097', 'first mismatch should be I90-097');
gp_assert($first['kind'] === 'count_and_allocated', '097 should be count+allocated');
gp_assert((int)$first['actual'] === 18 && (int)$first['free'] === 17 && (int)$first['reserved'] === 1, '097 counts');

$missing = ghadir_protected_carton_inspect($bad, 'I90-098');
gp_assert($missing['kind'] === 'missing', '098 missing');

$nineteen = $ok;
array_pop($nineteen['inventory']); // drop last serial of last carton I90-125
$rep = ghadir_protected_carton_inspect($nineteen, 'I90-125');
gp_assert($rep['kind'] === 'count_mismatch' && (int)$rep['actual'] === 19, '19 serials');

$twentyone = $ok;
$twentyone['inventory'][] = ['id'=>9999,'carton_id'=>18,'carton_code'=>'I90-125','order_id'=>0];
$rep = ghadir_protected_carton_inspect($twentyone, 'I90-125');
gp_assert($rep['kind'] === 'count_mismatch' && (int)$rep['actual'] === 21, '21 serials');

$alloc = $ok;
foreach ($alloc['inventory'] as &$iv) {
    if (($iv['carton_code'] ?? '') === 'I90-110') { $iv['order_id'] = 7; break; }
}
unset($iv);
$rep = ghadir_protected_carton_inspect($alloc, 'I90-110');
gp_assert($rep['kind'] === 'allocated' && (int)$rep['reserved'] === 1 && (int)$rep['free'] === 19, 'allocated');

try {
    ghadir_protected_refuse_if_code($ok, 'I90-097', 'allocate');
    throw new RuntimeException('allocate of protected carton should fail');
} catch (RuntimeException $e) {
    gp_assert(str_contains($e->getMessage(), 'I90-097'), $e->getMessage());
}

try {
    ghadir_protected_transfer_guard($ok, 'R900000000001', 0, [0]);
    // index 0 is first serial of I90-097 in the ok fixture
} catch (RuntimeException $e) {
    gp_assert(str_contains($e->getMessage(), 'جدا از باکس'), $e->getMessage());
}

$whole = [];
foreach ($ok['inventory'] as $i => $iv) {
    if (($iv['carton_code'] ?? '') === 'I90-097') $whole[] = $i;
}
ghadir_protected_transfer_guard($ok, 'I90-097', 1, $whole);
gp_assert(ghadir_protected_should_detach_retail('I90-097') === false, 'protected must stay attached');
gp_assert(ghadir_protected_should_detach_retail('I90-200') === true, 'normal retail detach remains');

$full = $ok;
$full['orders'] = [['id'=>7,'number'=>'GHP-TEST','items'=>[['product'=>'دستگاه كارتخوان I90','serials'=>[]]], 'history'=>[]]];
$sns = [];
foreach ($full['inventory'] as &$iv) {
    if (($iv['carton_code'] ?? '') !== 'I90-097') continue;
    $iv['order_id'] = 7;
    $iv['order_number'] = 'GHP-TEST';
    $iv['warehouse_id'] = 1;
    $iv['serial'] = 'MOCK-097-'.count($sns);
    $sns[] = $iv['serial'];
}
unset($iv);
$full['orders'][0]['items'][0]['serials'] = $sns;
$before = ghadir_protected_carton_inspect($full, 'I90-097');
gp_assert($before['kind'] === 'allocated' && (int)$before['reserved'] === 20, 'I90-097 fully allocated fixture');
$fix = ghadir_protected_unassign_reserved($full, 'I90-097');
gp_assert($fix['changed'] === true && (int)$fix['released'] === 20, 'released 20 in-warehouse serials');
gp_assert((int)($fix['restored_warehouse'] ?? 0) === 0, 'in-warehouse rows need no restore');
$after = ghadir_protected_carton_inspect($full, 'I90-097');
gp_assert($after['ok'] === true && (int)$after['free'] === 20, 'I90-097 free after unassign');
gp_assert($full['orders'][0]['items'][0]['serials'] === [], 'order serials cleared');

$shipped = $ok;
foreach ($shipped['inventory'] as &$iv) {
    if (($iv['carton_code'] ?? '') !== 'I90-097') continue;
    $iv['order_id'] = 8;
    $iv['warehouse_id'] = 0;
}
unset($iv);
$no = ghadir_protected_unassign_reserved($shipped, 'I90-097');
gp_assert($no['changed'] === true && (int)$no['restored_warehouse'] === 20, 'exited serials return to warehouse 1');
gp_assert(ghadir_protected_carton_inspect($shipped, 'I90-097')['ok'] === true, 'I90-097 free after restore');

if (($argv[1] ?? '') === 'diagnose') {
    $state = json_decode((string)file_get_contents($argv[2] ?? ''), true);
    echo json_encode(['ok'=>ghadir_protected_carton_first_mismatch($state)===null,'cartons'=>ghadir_protected_carton_report($state)], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT), "\n";
    exit(ghadir_protected_carton_first_mismatch($state)===null ? 0 : 2);
}

echo "protected-carton-ops php tests ok\n";

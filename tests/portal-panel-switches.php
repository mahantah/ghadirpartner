<?php
declare(strict_types=1);

require_once $argv[1].'/lib/portal-panel-switches.php';
require_once $argv[1].'/lib/native-order-flow.php';

$policy = GpPortalPanelSwitches::published();
$options = $policy->options();
if (count($options) < 2) {
    throw new RuntimeException('Expected multiple published switches.');
}
$first = ['product'=>'Sample', 'qty'=>1, 'price_key'=>'panel_cash', 'panel_switch'=>$options[0]];
$second = array_replace($first, ['panel_switch'=>$options[1]]);
if ($policy->choice($first) !== $options[0] || $policy->choice(['price_key'=>'panel_cash']) !== '') {
    throw new RuntimeException('Valid or legacy choice rejected.');
}
$enabled = ['name' => 'Sample', 'panel_switch_enabled' => true];
$disabled = ['name' => 'Other', 'panel_switch_enabled' => false];
if ($policy->productOptions([$enabled, $disabled, ['name' => 'Legacy']]) !== ['Sample' => $options]
    || $policy->choice($first, $enabled) !== $options[0]
    || $policy->choice(['price_key'=>'panel_cash'], $enabled) !== ''
    || $policy->choice(['price_key'=>'panel_cash'], $disabled) !== ''
    || $policy->productSetting([]) !== []
    || $policy->productSetting(['panel_switch_enabled'=>false]) !== ['panel_switch_enabled'=>false, 'panel_switch_models'=>[]]) {
    throw new RuntimeException('Product switch settings were not preserved.');
}
$oneModel = $enabled + $policy->productSetting(['panel_switch_models' => [$options[0]]]);
if ($policy->productOptions([$oneModel]) !== ['Sample' => [$options[0]]]) {
    throw new RuntimeException('Product exposed a model that was not selected.');
}
try {
    $policy->choice($second, $oneModel);
    throw new RuntimeException('Checkout accepted an unselected model.');
} catch (InvalidArgumentException $expected) {
}
try {
    $policy->choice($first, $disabled);
    throw new RuntimeException('Disabled product accepted a switch.');
} catch (InvalidArgumentException $expected) {
}
try {
    $policy->choice(array_replace($first, ['price_key'=>'serial_1_50']));
    throw new RuntimeException('Non-panel item accepted a switch.');
} catch (InvalidArgumentException $expected) {
}
$flow = new GpCustomerOrderFlow(['maximum_quantity'=>10, 'serial_tier_threshold'=>5]);
$flow->validateRequest([
    'invoice_type'=>'غیررسمی', 'requested_payment_method'=>'cash', 'items'=>[$first, $second],
]);
echo "Panel choices and distinct checkout lines passed.\n";

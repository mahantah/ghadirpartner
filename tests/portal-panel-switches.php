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

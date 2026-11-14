<?php
declare(strict_types=1);

require_once __DIR__.'/../lib/portal-activity.php';

$cart = [
    ['product' => 'I90', 'qty' => 3, 'private_field' => 'ignored'],
    ['product' => 'H9', 'qty' => 1],
    ['product' => 'I90', 'qty' => 2],
];
if (GpPortalActivity::quantities($cart, 8, 10) !== ['H9' => 1, 'I90' => 5]) {
    throw new RuntimeException('Expected product quantities aggregated across price tiers.');
}
foreach ([[['product' => 'I90', 'qty' => -1]], [['product' => 'I90', 'qty' => '2']], ['invalid']] as $invalid) {
    try {
        GpPortalActivity::quantities($invalid, 8, 10);
        throw new RuntimeException('Malformed cart was accepted.');
    } catch (InvalidArgumentException $expected) {
    }
}
echo "Portal cart validation passed.\n";

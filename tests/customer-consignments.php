<?php
declare(strict_types=1);

require __DIR__.'/../lib/customer-consignments.php';

$policy = json_decode((string) file_get_contents(__DIR__.'/../config/customer-consignments.yaml'), true, 512, JSON_THROW_ON_ERROR);
$register = new GpCustomerConsignments($policy);
$state = [
    'customers' => [['id' => 1, 'name' => 'مشتری آزمایشی']],
    'products' => [['name' => 'I90']],
    'inventory' => [['id' => 12, 'product' => 'I90']],
    'orders' => [['id' => 18]],
];
$before = $state;
$send = ['action' => 'send', 'request_id' => str_repeat('a', 32), 'customer_id' => 1, 'product' => 'I90', 'quantity' => 5];
$created = $register->record($state, $send, 3, '2026-11-17 10:00:00');
if ($register->record($state, $send, 3, '2026-11-17 10:01:00') !== $created) {
    throw new LogicException('A retried delivery created another record.');
}
$return = ['action' => 'return', 'id' => $created['id'], 'request_id' => str_repeat('b', 32), 'quantity' => 2];
$partial = $register->record($state, $return, 4, '2026-11-17 11:00:00');
if ($partial['remaining'] !== 3 || $register->record($state, $return, 4, '2026-11-17 11:01:00') !== $partial) {
    throw new LogicException('A partial return or retry changed the wrong balance.');
}
try {
    $register->record($state, array_replace($return, ['request_id' => str_repeat('c', 32), 'quantity' => 4]), 4, '2026-11-17 11:02:00');
    throw new LogicException('Accepted a return above the outstanding amount.');
} catch (DomainException $error) {
    if ($error->getCode() !== 409) throw $error;
}
$closed = $register->record($state, array_replace($return, ['request_id' => str_repeat('c', 32), 'quantity' => 3]), 4, '2026-11-17 11:03:00');
if ($closed['remaining'] !== 0 || count($closed['returns']) !== 2 || $register->report($state)['records'] !== [$closed]
    || $state['orders'] !== $before['orders'] || $state['inventory'] !== $before['inventory']) {
    throw new LogicException('Consignment completion or isolation failed.');
}
echo "Delivery, partial/full return, retry, over-return and inventory isolation passed.\n";

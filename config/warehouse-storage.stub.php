<?php
/** @param array<string, mixed> $s
 * @param list<string> $serials
 * @param-out array<string, mixed> $s
 * @return array<string, mixed>
 */
function ghadir_warehouse_record(array &$s, string $type, string $product, array $serials, int $fromWarehouse, int $toWarehouse, string $by, int $orderId = 0, string $orderNumber = '', string $note = ''): array {}

/** @param array<string,mixed> $state
 * @return array{array<int,array<string,mixed>>,array<int,array<string,mixed>>} */
function gp_inventory_maps(array $state): array {}
/** @param array<string,mixed> $state
 * @param array<string,mixed> $row
 * @param array<int,array<string,mixed>> $orders
 * @param array<int,array<string,mixed>> $customers
 * @return array<string,mixed> */
function gp_inv_group_meta(array $state, array $row, array $orders, array $customers): array {}
/** @param array<string,mixed> $row
 * @param array<string,mixed> $metadata */
function gp_inv_search_text(array $row, array $metadata): string {}

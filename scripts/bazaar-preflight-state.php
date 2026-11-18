<?php
declare(strict_types=1);

/** Reconstruct the existing read-only inventory snapshot after the live normalized-table split. */
final class GpBazaarPreflightState
{
    private Closure $readRecords;

    /** Inject a read-only table reader; fixture tests never open a production connection. */
    public function __construct(Closure $readRecords) { $this->readRecords = $readRecords; }

    /** Preserve legacy arrays or hydrate only missing collections from canonical record JSON. */
    public function hydrate(array $state): array
    {
        foreach (['cartons'=>'ghadir_inventory_cartons','inventory'=>'ghadir_inventory_serials'] as $key => $table) {
            if (isset($state[$key]) && is_array($state[$key])) continue;
            $state[$key] = [];
            foreach (($this->readRecords)($table) as $raw) {
                if (!is_string($raw)) throw new RuntimeException('invalid_normalized_inventory_contract');
                $row = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
                if (!is_array($row) || !is_string($row[$key === 'cartons' ? 'code' : 'serial'] ?? null)) throw new RuntimeException('invalid_normalized_inventory_contract');
                $state[$key][] = $row;
            }
        }
        return $state;
    }
}

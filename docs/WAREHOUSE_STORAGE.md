# Indexed warehouse storage

A missing receipt for a serial added through manual order entry or Excel made the live-current ledger anchor inflate earlier days. The storage facade pairs new physical inventory rows with dated receipts inside the existing order transaction. Browser-local quantities no longer override server movement history.

The private-source patcher checks exact production hashes before touching `index.php` or `lib/storage.php`. It does not replace them with this repository's legacy root files. Production source, configuration values and customer records must stay private.

`GpWarehouseStorage` is the entry facade. Warehouse rows, cartons and movements live in separate InnoDB tables after an explicit migration; unknown record fields and original list ordering are retained in row payloads. Serial, warehouse/product, order and carton indexes support targeted reads. Writes hold the existing core-state lock and commit warehouse changes, orders and audit together. The database trigger rejects old workers that try to write embedded warehouse arrays into migrated state.

Authentication and audited lightweight reads use core state. Order bootstrap reads only allocated inventory for existing order decorators. Live warehouse totals use SQL aggregation. `/api/inventory/page` provides an opt-in indexed paginated API with exact serial, model, warehouse, order and carton filters. Existing full-list APIs retain their response contracts; older clients still request full serial lists until updated.

Policy lives in `config/warehouse-storage.yaml` (JSON-compatible YAML); no credentials are added. The CLI-only release runner requires a private bundle with reviewed source/candidate hashes. `check` is read-only. `apply` checks protected cartons, creates shadow tables, temporarily pauses HTTP requests, drains workers, reconstructs only supported post-activation receipts, verifies exact warehouse round trips, publishes files and commits the split. A publication or transaction failure restores original code. Private rollback copies contain code only.

Never run an older deployment or raw state repair that assumes `state_json.inventory` still exists. Use the facade to hydrate and persist migrated state. An unknown receipt date or warehouse is skipped, never invented. Existing inventory, ownership, carton links and prior movements remain intact during history repair.

Checks: PHPStan level 6, PHP syntax, Python Ruff/Mypy, transactional PDO fixtures and JavaScript historical-balance fixtures. MySQL schema and legacy-writer trigger were also exercised locally with MariaDB 10.11 bootstrap; network-listening database tests are unavailable in the workspace.

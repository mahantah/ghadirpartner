# Warehouse allocation and deployment checks

Reported case: I90-097 is assigned to a customer, so requiring all 20 serials to be
free is not a valid deployment invariant. Run 39505139621 stopped safely with
20 linked rows, zero free, and 20 allocated; this does not itself prove corruption.

## Change

The preflight still requires every one of the same 18 protected cartons to have
exactly 20 inventory rows. A read-only, inlined validator now also checks unique
serials, consistent carton links and product names, valid warehouse locations, and
matching order/item/serial references. Complete and partial allocations are allowed
only if the referenced order exists, is not cancelled/deleted, has capacity and
contains the serial exactly once in the correct product line. Conflicting active
claims remain blocking. Warehouse exit requires a matching shipment snapshot;
partially shipped orders can retain their unshipped serials in the warehouse.
Historical delivered orders are not treated as a conflicting active claim after
a legitimate return and resale.

The report uses `allocated`. A `reserved` alias remains in probe JSON for compatibility
with existing consumers, but is not a distinct inventory state or user-facing label.
The older protected-carton fixture/restore helpers deliberately retain their free-only
restoration semantics; they are not the new production deployment validator.

## Other confirmed defects in the inspected code

- The legacy PHP and Python carton inspectors calculated `invalid_links` but did not
  include it in their decision. Twenty free rows with contradictory links could pass.
  Both now reject these rows.
- The old count-only preflight did not check duplicate serials or cross-order
  allocation consistency. These are now explicit blocking checks.
- The HTTP classifier could accept an `ok` body with HTTP 500, or a truthy string
  instead of boolean true. Success now requires boolean true, HTTP 200 and the
  existing inventory/carton count floors.

No inventory allocation is released, reconstructed or moved. No order, customer,
payment, database or storage migration is performed. The SQL remains the original
SELECT; the server-local backup and 500/failure blocking are preserved. No production
core module is overwritten ahead of the safety check. The new validator is inlined
only into the temporary token-protected probe, which uses the existing cleanup.

## Audit boundaries and verification

Review covered the deployment probe, protected-carton helpers and operation guards,
free-stock counting, serial allocation references, transfer, partial shipment and
return/resale representation. Tests use invented serials and order ids only.
The warehouse ledger, physical-stock and existing transfer/restore regressions
remain in CI, alongside 40 allocation/integrity cases and 11 generated-probe cases.
The complete canonical production build must also pass.

No private production state, customer information, credentials or backups were
opened or exported. Live I90-097 has not yet been checked by the new validator;
it may still reveal a genuine inconsistency and must then keep deployment blocked.
This review is not a claim that every warehouse record or every operational path
is defect-free. Merge and production deployment require human approval.

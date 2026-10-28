# Customer order flow for Android R5.12

Companion to `mahantah/ghadirpartner-android-r2`, branch `feature/customer-order-review`.
This package patches the current private owner source; root `index.php` and `partners/index.php` in this public repository are not deployment inputs.

## Behavior

- Customers choose an invoice type explicitly. Credit requires boolean consent and stores the exact server-owned commitment text/hash in `native_settlement`.
- Each model may have multiple purchase price options. Each submitted option is priced by the existing authorized catalog logic; stock checks add every quantity for the model. Duplicate identical options and serial-tier splitting are rejected.
- `purchase_items` holds exact integer unit prices, quantities and line totals for financial documents. `items` retains one physical row per model so existing allocation, partial exit, serial locks and warehouse reports continue to identify the same model unambiguously. Each warehouse row has `purchase_lines`; its unit price is a display-only weighted average and its integer `line_total` remains exact. Android details/PDF consume `purchase_items`.
- Customer creation stays `approval_status=در انتظار تأیید`, `status=در انتظار تأیید سفارش`. It allocates no stock and does not approve settlement.
- Existing admin/sales company approval remains separate from finance approval. A final/cancelled/rejected order cannot be reapproved.
- POST `/api/customer-order/reject` permits admin/sales only, requires a reason, writes `approval_status=رد شده`, `status=لغو شد` and a review history entry. It refuses orders with serials or inventory ownership. Existing inventory/carton values, dispatch timestamps and financial approval are untouched.
- Legacy item editors refuse mixed financial rows rather than silently losing their price breakdown. Plain-order edits keep `purchase_items` synchronized.
- The existing native credit/proof adapter is activated for those paths. Login and OTP handlers are unchanged.

## Stage and verify

```sh
python3 scripts/patch-native-order-flow.py CURRENT_OWNER_SOURCE STAGED_OUTPUT --manifest config/native-order-flow-patch.json
php -l lib/native-order-flow.php
php -l lib/native-order-flow-routes.php
php tests/native-order-flow.php
php tests/native-order-review-routes.php
GP_OWNER_SOURCE=CURRENT_OWNER_SOURCE python3 tests/native-order-flow-patch.py
```

The source is staged separately after every replacement anchor is checked. The checked-in manifest identifies the two exact before hashes and five exact staged hashes. Running against a stale or already patched source fails. Never commit/export the private staged PHP entrypoints or a production database.

## Deployment boundary

This PR does not deploy itself. Review the paired Android build first. Before production installation, verify the original protected-carton integrity check, preserve a private code checkpoint, publish the three public dependencies before the two patched entrypoints, verify all five hashes and health, and retain a rollback of both entrypoints and dependencies. No database migration/restore is required. The current owner recovery manifest must also be extended when adopting this package so a later recovery does not remove the feature. Do not use an obsolete rebuild workflow.

Policy is JSON-compatible YAML so production PHP 7.4 needs no YAML extension. `GpOrderPolicyRepository` validates its schema before the service uses it. No credentials are included in policy.

Validation uses synthetic fixtures only. Release APK signing and live-account acceptance are separate from these PHP checks. Do not submit test orders, receipts or SMS to production.

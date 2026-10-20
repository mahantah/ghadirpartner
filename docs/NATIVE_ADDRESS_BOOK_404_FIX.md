# Partner Android address-book 404

Read-only production checks on 2026-10-20 returned HTTP 404 (`مسیر پیدا نشد`) for `/partners/api/addresses` and HTTP 401 (`ورود الزامی است`) for `/partners/api/me`. The Android client already uses the expected GET/POST address contract. The canonical partner router has no address handler; the historical R5 compatibility module contained one, but the current production assembly does not retain it.

`scripts/patch-native-address-book-v1.py` adds only the address route before the partner router's final 404. The route is inlined into the existing `partners/index.php` deployment artifact; no extra PHP file needs a separate live upload. The production build includes the patch so later releases retain the fix. Existing address handlers or altered patch markers cause an explicit failure instead of replacement.

Addresses use the existing authenticated customer storage (`delivery_addresses`). Required fields, Unicode lengths, optional ten-digit postal code, 20-address limit, and ownership are checked. Main profile addresses, other customers and historical order address snapshots are preserved. Unknown update/delete IDs return 404 without changing records. No database migration is introduced.

Tests use sanitized in-memory fixtures. CI checks PHP syntax, lifecycle, account isolation, malformed fields, address limits, patch placement/idempotence, and the complete canonical production build. CI does not deploy this fix. Human approval is required before merging or publishing to production; do not deploy the root router as a replacement for the assembled release.

After approved deployment, an unauthenticated GET of the address endpoint must return 401 rather than the router's 404. Verify full create/edit/delete using a designated test customer in staging before production publication. The current Android APK needs no endpoint change.

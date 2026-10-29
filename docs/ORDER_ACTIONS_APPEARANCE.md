# Order action appearance

The approved compact menu uses navy #102a43, orange hover/focus and a one-pixel blur on other actions. The delivery entry and its dialog are labeled «تحویل جزئی». Touch devices retain readable siblings and 44px targets. Reduced-motion settings disable transitions.

Only the existing order popover is decorated. Native permissions, triggers, handlers, finance, stock movements and authenticated printing remain in place. Customer menus and site navigation are outside the CSS scope. The existing legacy burger module supports an explicit `data-menu-only` mode for the owner site.

Design tokens come from validated `config/order-actions-theme.yaml`. Run `python3 scripts/build-order-actions-theme.py --check`, `npm --prefix tooling/partial-delivery-web run check`, and `python3 scripts/build-web-partial-delivery.py --check`. Browser fixtures cover both menu modes and partial delivery; the finite release fixture checks source tampering and rollback.

Release installs exactly five code files, with source hashes, a private checkpoint, the original 18-carton read-only guard and readback. It writes no database records. Never deploy the stale repository root app.html; the manifest patches the current owner source in place.

# Order details v2 and customer payment evidence

The Android settlement form sends `settlement_details.image_base64` (JPEG, under 1 MB),
`tracking_number`, `check_number`, `bank_name`, `due_date` and `terms_accepted`.
The inspected partner order route retains the input in the order object. The former
admin details/payment/cheque views did not render these fields.

This change replaces the canonical web details renderer with five sections:
overview, items with collapsed serials, payment and evidence, shipping, and full history.
Payment and cheque dialogs link directly to the payment section.
Saved JPEG/PNG/WebP evidence can be enlarged and downloaded. Fixed format/signature and
size checks reject SVG, HTML, arbitrary URLs and malformed image values; text is escaped.
Only existing admin/finance roles render payment evidence. This is a UI restriction,
not a change to existing API authorization or storage access.

No backend, order, payment state, approval, shipping or database semantics change.
Requested payment method remains distinct from confirmed settlement; viewing evidence
does not approve a payment. Missing evidence displays an explicit empty state.
The shipping view uses the order address snapshot when available, with a labelled
current-profile fallback. Both order name and current customer name remain available.

The workflow applies `scripts/patch-order-details-v2.py` to the assembled
`app.html` after existing production patches. JavaScript and CSS are inlined, so
the existing deployment and rollback of app.html cover this change; no extra public
file or FTP rule is needed. The patch refuses unknown/partial source and is repeatable.

Validation:
- Node fixture: safe/unsafe image sources, text injection, role gating, unchanged data,
  amount labels, delivery snapshot and serial disclosure.
- Patch fixture: original finance action regions unchanged, repeatability, refusal
  without partial writes, all generated inline scripts parse.
- Headless Chrome at 390 and 1440 px: sections, serial disclosure, evidence viewer,
  Escape/focus return, RTL keyboard navigation, access/empty states and page overflow.
- Complete pinned production build, including every existing patch, without server access.
- Synthetic preview: open `tests/order-details-v2.html?preview=1&view=overview`
  or `view=payment`. CI publishes four screenshots; all data is invented.

Order 000261 is the user's reported example. Its private production record and evidence
were not read or exported. This change exposes evidence that is already stored; it
cannot restore an attachment that was never stored. Production verification must use
the normal authorized application session after human approval and successful deployment.
The predeployment MySQL/carton safety guard must remain blocking.

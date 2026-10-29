# تحویل بخشی داخل سایت اتوماسیون

این قابلیت در سایت `ghadirpartner.ir` اجرا می‌شود و به نصب اپ اتوماسیون نیاز ندارد.

مدیر از فهرست سفارش‌ها، منوی عملیات یا جزئیات یک سفارش تأییدشدهٔ آماده‌سازی/آماده ارسال/ارسال بخشی را باز می‌کند و «تحویل بخشی با مجوز مدیر» را می‌زند. تعداد هر مدل را می‌تواند وارد کند یا از انتخاب یک‌سوم ماندهٔ هر مدل استفاده کند (تعداد صحیح رو به پایین). سپس علت، نوع تحویل، کد پیگیری یا مشخصات پیک را وارد و در مرحلهٔ بازبینی، سریال‌های دقیق را تأیید می‌کند.

فقط همان سریال‌های آماده و ارسال‌نشده از انبار خارج می‌شوند. پرداخت، مبلغ فاکتور و رسیدها تغییر نمی‌کنند و باقی سفارش باز می‌ماند. این مسیر مجوز تحویل کل مانده نیست. ارسال تکراری پس از خطای ارتباط، همان شناسه و سریال‌های بازبینی‌شده را نگه می‌دارد. سرور مجوز مدیر، مالکیت سریال و وضعیت روز انبار را دوباره کنترل می‌کند؛ سریال نامعتبر با سریال دیگری جایگزین نمی‌شود.

## Implementation and validation

- `scripts/partial-delivery-web.ts` separates the pure physical model/policy from the HTTP client, modal view and one public facade. Generated `assets/partial-delivery-web.js` embeds the validated existing JSON-compatible YAML policy; no production build tooling or public configuration request is needed.
- A manager-only GET `/api/orders/partial-dispatch-view?id=...` reads one current physical order snapshot. It is read-only and whitelists fields; full state, payment evidence and unrelated inventory are never returned. The existing POST partial-dispatch operation remains unchanged.
- Two bounded button additions use the existing order-menu and approved details renderer. They do not wrap menu handlers or create observers/polling. The native dialog manages focus and blocks closing while a stock write is in flight.
- `npm ci --prefix tooling/partial-delivery-web --ignore-scripts --no-audit --no-fund`, `npm --prefix tooling/partial-delivery-web run check`, and `python3 scripts/build-web-partial-delivery.py --check` run strict TypeScript, lint, formatting and reproducible-build checks. PHP route and deployment fixtures cover authorization, minimal read-only data, staging, tamper rejection and rollback. Synthetic browser tests cover mobile/desktop quantities, one-third selection, courier/tracking requirements, exact preview, failed requests, stable retries and focus.
- The finite seven-file installer verifies current private owner hashes, all original 18 protected cartons, checkpoints code privately, publishes dependencies before entrypoints, then verifies hashes and service health. Recovery includes the same operations and public dependencies (135 code files). Stale repository root PHP/HTML are never deployment inputs. No production DB write, migration, live test order or test SMS is part of publication.

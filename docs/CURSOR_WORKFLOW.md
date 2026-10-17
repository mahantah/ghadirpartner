# استفاده امن از Cursor Cloud Agents در قدیر پارتنر

## شروع از GitHub بدون نصب روی ویندوز

1. به [Cursor Agents](https://cursor.com/agents) بروید و با حسابی که GitHub آن متصل شده وارد شوید.
2. مخزن `mahantah/ghadirpartner` و شاخه مبنا `main` را انتخاب کنید.
3. اگر Cloud Environment هنوز تنظیم نشده است، Guided Setup را آغاز کنید؛ **حساب تولید، FTP، MySQL، رمز عبور، فایل‌های مشتریان و سایر اسرار هاست را در محیط ابری وارد نکنید**. برای تست از داده ساختگی و دسترسی‌های حداقلی استفاده کنید.
4. Cursor باید دستورالعمل‌های `AGENTS.md` و `.cursor/rules/*.mdc` را از همان شاخه بخواند.
5. برای هر درخواست، خروجی را به صورت **Pull Request برای بازبینی** بخواهید؛ ادغام و انتشار فقط با تأیید انسانی.

### اولین وظیفه پیشنهادی برای Cursor (فقط بررسی)

```text
Review the current main branch of mahantah/ghadirpartner.
Investigate, READ-ONLY, the latest failed
"Deploy Exact V5.3.4.38" GitHub Actions runs, especially
"Snapshot and verify MySQL before deployment":
protected_carton_state_mismatch, HTTP 500.

Determine whether the check is working correctly, which comparison
failed, and what NON-DESTRUCTIVE diagnostics are possible from
existing repo code and sanitized CI logs.

Do not run/deploy production workflows, read production secrets,
access or modify customer data, bypass the pre-switch guard,
or change databases. Do not auto-merge or force-push.

If a code fix is demonstrably needed, create a separate branch,
tests using mock fixtures, and a DRAFT pull request.
Report evidence, remaining unknowns and a safe recovery plan in Persian.
```

## معماری واقعی و تست

- `.github/workflows/deploy-final-v53438.yml`: مبنای ساخت عملیاتی از ZIP دقیق V5.3.4.38، اعمال پچ‌ها، محافظت از داده و انتشار دستی.
- `.github/workflows/ci-web.yml`: تست‌های تجمیعی مرورگر و رگرسیون؛ قبل از درخواست ادغام باید بررسی شوند.
- `app.html` و `VERSION.txt` در ریشه ممکن است با بسته عملیاتی متفاوت باشند. حتماً خروجی ساخته‌شده (assembled build) را هم بررسی کنید.
- کد و دیتا دو چیز متفاوت‌اند: `storage/ghadir_data.json`، `config.php` و `partners/config.php` باید خارج از Git باقی بمانند.
- تنظیمات حاضر صرفاً راهنمای Agent هستند، نه مجوز دسترسی به محیط تولید یا فعال‌سازی خودکار انتشار.

## چک‌لیست پایان هر کار

- شاخه و PR مستقل ساخته شده است.
- همه قابلیت‌های قبلی مرتبط حفظ شده‌اند.
- تست‌های موردنیاز اجرا و نتیجه واقعی آن‌ها گزارش شده است.
- هیچ داده، کلید یا فایل حساس وارد کد یا PR نشده است.
- بدون درخواست صریح، هیچ انتشار زنده‌ای آغاز نشده است.


## صرفه‌جویی در توکن و هزینه Agent

- **یک وظیفه مشخص در هر اجرا:** مثلاً «فقط منوی عملیات سفارش»؛ درخواستِ «کل سامانه را بررسی و بازنویسی کن» معمولاً فایل‌خوانی و پردازش بیشتری ایجاد می‌کند.
- **کمترین متن ضروری:** پیام ورودی کوتاه، پاسخ نهایی فشرده. تنها وقتی نیاز شد توضیح تفصیلی بخواهید.
- **جست‌وجوی هدفمند:** ابتدا نام فایل یا تابع، سپس فقط خطوط مرتبط؛ از درخواست خواندن تمام مخزن، فایل ZIP اصلی و لاگ‌های کامل پرهیز کنید.
- **مدل مناسب کار:** برای تغییرات کوچک از مدل سبک‌تر/اقتصادیِ در دسترس حساب خود استفاده کنید؛ مدل قوی و حالت‌های پرهزینه‌تر را به خطاهای سخت، اصلاح چندبخشی یا بررسی امنیتی محدود کنید. هزینه واقعی طبق طرح و مدل انتخابی Cursor متفاوت است.
- **تست اقتصادی ولی کامل:** حین توسعه تست کوچک مرتبط اجرا شود؛ پیش از PR و انتشار، تست‌های ضروری حذف نشوند.
- **داده کمتر، امنیت بیشتر:** فقط Fixture ساختگی و بخش لازم از خروجی تست را ارسال کنید. هرگز برای کاهش هزینه محافظت داده، کنترل دسترسی یا تست ایمنی را خاموش نکنید.

### قالب کوتاه وظیفه پیشنهادی

```text
Task: <one specific bug or UI change>.
Keep all existing functions, permissions and data unchanged.
Read AGENTS.md and only relevant source ranges. Search symbols first.
Do not dump full files/logs or inspect unrelated areas.
Implement the smallest safe patch with focused regression tests.
Create a branch and PR; do NOT merge or deploy.
Reply in Persian, max 8 lines: root cause, changed files, tests, risks, PR link.
```

نکته: کوتاه‌ترکردن قواعد باعث کاهش محتوای ارسالی در هر اجرا می‌شود، اما **میزان دقیق توکن مصرفی یا صورت‌حساب Cursor را تضمین نمی‌کند**.

"""Stage the customer purchase report against the owner's application source."""

from argparse import ArgumentParser
from pathlib import Path
from shutil import copyfile


class CustomerPurchaseReportStage:
    """Apply exact additive changes to an independently staged release."""

    _route = "if($p==='/api/reports/customers'&&$m==='GET')"
    _section = (
        '<section id="salesReports" class="tab hidden"><div class="sales-report-shell">'
    )
    _script = '<script defer src="/assets/customer-purchase-report.js"></script>'
    _customer_section = '<section id="customers" class="tab hidden">'
    _approval = "if($action!=='approve')fail('عملیات نامعتبر است');$mobile="
    _card = """
<details id="gpCustomerPurchaseReport" class="card" hidden>
  <summary>خرید و اعتبار هر مشتری</summary>
  <form class="sales-custom-range">
    <label>مشتری <select name="customer_id" required><option value="">انتخاب مشتری</option></select></label>
    <label>از تاریخ شمسی <input name="from" placeholder="۱۴۰۵/۰۸/۰۱"></label>
    <label>تا تاریخ شمسی <input name="to" placeholder="۱۴۰۵/۰۸/۳۰"></label>
    <button class="btn2" type="submit">نمایش گزارش</button>
  </form>
  <p class="small" role="status"></p>
  <dl></dl>
  <ul aria-label="اقلام خریداری‌شده"></ul>
  <div class="tablewrap" hidden>
    <table>
      <caption>سفارش‌های مشتری در بازه</caption>
      <thead><tr><th>شماره</th><th>تاریخ شمسی</th><th>وضعیت</th><th>تأیید</th><th>مبلغ سفارش</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
</details>
"""
    _membership_card = """
<details id="gpMembershipRequests" class="card" hidden>
  <summary>درخواست‌های عضویت</summary>
  <button type="button" class="btn2">به‌روزرسانی درخواست‌ها</button>
  <p class="small" role="status"></p>
  <div class="tablewrap">
    <table>
      <thead><tr><th>متقاضی</th><th>شماره همراه</th><th>تأیید شماره</th><th>کد ملی</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
</details>
<details id="gpPortalMessages" class="card" hidden>
  <summary>ارسال پیام به مشتریان</summary>
  <form>
    <label>عنوان <input name="title" required maxlength="120"></label>
    <label>متن <textarea name="body" required maxlength="800"></textarea></label>
    <label>گیرندگان <select name="recipients" multiple size="7" required></select></label>
    <label><input type="checkbox" name="app" checked> داخل اپ</label>
    <label><input type="checkbox" name="sms"> پیامک</label>
    <button type="submit" class="btn2">ارسال</button>
  </form>
  <p role="status"></p>
  <div class="tablewrap"><table><caption>آخرین ارسال‌ها</caption>
    <thead><tr><th>پیام</th><th>گیرنده</th><th>خواندن در اپ</th><th>پیامک</th></tr></thead>
    <tbody></tbody>
  </table></div>
</details>
"""
    _files = (
        "lib/customer-purchase-report.php",
        "lib/customer-purchase-report-route.php",
        "assets/customer-purchase-report.js",
        "assets/portal-messages.js",
        "lib/portal-messages.php",
        "lib/portal-messages-routes.php",
        "config/portal-messages.yaml",
    )

    def __init__(self, package: Path) -> None:
        """Use reviewed dependencies from the repository."""
        self._package = package

    @staticmethod
    def _insert(source: str, anchor: str, replacement: str) -> str:
        if source.count(replacement) == 1:
            return source
        if source.count(anchor) != 1:
            raise ValueError(f"Expected a single source anchor for {anchor}")
        return source.replace(anchor, replacement, 1)

    def stage(
        self, source: Path, output: Path, partner_router: Path | None = None
    ) -> None:
        """Write a candidate only after verifying all source anchors."""
        if source.resolve() == output.resolve():
            raise ValueError("Choose a distinct staging directory.")
        index = self._insert(
            (source / "index.php").read_text(),
            self._route,
            "require __DIR__.'/lib/customer-purchase-report-route.php';\n"
            "require __DIR__.'/lib/portal-messages-routes.php';\n" + self._route,
        )
        index = self._insert(
            index,
            self._approval,
            "if($action!=='approve')fail('عملیات نامعتبر است');"
            "if(isset($r['national_id'])){"
            "if(($x['identity_reviewed']??false)!==true)fail('ابتدا هویت متقاضی را بررسی کنید',422);"
            "$r['identity_verified_at']=now();}"
            "$mobile=",
        )
        app = self._insert(
            (source / "app.html").read_text(),
            self._section,
            self._section + self._card,
        )
        app = self._insert(
            app, self._customer_section, self._customer_section + self._membership_card
        )
        closing = "\n</body></html>"
        app = self._insert(
            app,
            closing,
            "\n"
            + self._script
            + '\n<script defer src="/assets/portal-messages.js"></script>'
            + closing,
        )
        router = None
        if partner_router is not None:
            anchor = "if($p==='/api/register'&&$m==='POST')"
            router = self._insert(
                partner_router.read_text(),
                anchor,
                "require __DIR__.'/lib/portal-membership-route.php';\n"
                "require __DIR__.'/lib/portal-messages-routes.php';\n" + anchor,
            )
        output.mkdir(parents=True, exist_ok=True)
        for name in self._files:
            path = output / name
            path.parent.mkdir(parents=True, exist_ok=True)
            copyfile(self._package / name, path)
        (output / "index.php").write_text(index)
        (output / "app.html").write_text(app)
        if router is not None:
            target = output / "partners"
            (target / "lib").mkdir(parents=True, exist_ok=True)
            (output / "config").mkdir(parents=True, exist_ok=True)
            copyfile(
                self._package / "lib/portal-membership.php",
                output / "lib/portal-membership.php",
            )
            copyfile(
                self._package / "lib/portal-membership-route.php",
                target / "lib/portal-membership-route.php",
            )
            copyfile(
                self._package / "lib/portal-messages-routes.php",
                target / "lib/portal-messages-routes.php",
            )
            copyfile(
                self._package / "config/portal-membership.yaml",
                output / "config/portal-membership.yaml",
            )
            (target / "index.php").write_text(router)

    @classmethod
    def main(cls) -> None:
        """Stage the report using the explicitly supplied source and output."""
        parser = ArgumentParser(description=__doc__)
        parser.add_argument("source", type=Path)
        parser.add_argument("output", type=Path)
        parser.add_argument("--partner-router", type=Path)
        args = parser.parse_args()
        cls(Path(__file__).resolve().parents[1]).stage(
            args.source, args.output, args.partner_router
        )


if __name__ == "__main__":
    CustomerPurchaseReportStage.main()

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
      <thead><tr><th>متقاضی</th><th>شماره همراه</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
</details>
"""
    _files = (
        "lib/customer-purchase-report.php",
        "lib/customer-purchase-report-route.php",
        "assets/customer-purchase-report.js",
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

    def stage(self, source: Path, output: Path) -> None:
        """Write a candidate only after verifying all source anchors."""
        if source.resolve() == output.resolve():
            raise ValueError("Choose a distinct staging directory.")
        index = self._insert(
            (source / "index.php").read_text(),
            self._route,
            "require __DIR__.'/lib/customer-purchase-report-route.php';\n"
            + self._route,
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
        app = self._insert(app, closing, "\n" + self._script + closing)
        output.mkdir(parents=True, exist_ok=True)
        for name in self._files:
            path = output / name
            path.parent.mkdir(parents=True, exist_ok=True)
            copyfile(self._package / name, path)
        (output / "index.php").write_text(index)
        (output / "app.html").write_text(app)

    @classmethod
    def main(cls) -> None:
        """Stage the report using the explicitly supplied source and output."""
        parser = ArgumentParser(description=__doc__)
        parser.add_argument("source", type=Path)
        parser.add_argument("output", type=Path)
        args = parser.parse_args()
        cls(Path(__file__).resolve().parents[1]).stage(args.source, args.output)


if __name__ == "__main__":
    CustomerPurchaseReportStage.main()

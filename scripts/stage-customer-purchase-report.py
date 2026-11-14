"""Stage the customer purchase report against the owner's application source."""

import json
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
    _messages_script = '<script defer src="/assets/portal-messages.js"></script>'
    _reports_v2 = (
        '<script defer src="/assets/customer-purchase-report.js?v=2"></script>'
    )
    _messages_v2 = '<script defer src="/assets/portal-messages.js?v=2"></script>'
    _new_assets = (
        '<link rel="stylesheet" href="/assets/portal-phase-two.css?v=2">'
        '\n<script defer src="/assets/portal-phase-two-navigation.js?v=2"></script>'
    )
    _old_assets = _new_assets.replace("?v=2", "")
    _sidebar_release = _new_assets.replace("?v=2", "?v=3")
    _current_assets = _sidebar_release.replace("?v=3", "?v=4") + (
        '\n<script defer src="/assets/portal-phase-two-activity.js?v=1"></script>'
    )
    _activity_client = (
        '<script defer src="/assets/portal-phase-two-activity-client.js?v=1"></script>'
    )
    _activity_route = "require dirname(__DIR__).'/lib/portal-activity-routes.php';"
    _activity_card = """
<details id="gpPortalActivity" class="card" hidden>
  <summary>فعالیت کاربران و سبدهای خرید</summary>
  <p>آنلاین بر اساس آخرین حضور در برنامه یا وب سنجیده می‌شود. سبد رهاشده تا پایان روز تهران در گزارش دیده می‌شود.</p>
  <div class="sales-custom-range">
    <label>جست‌وجوی مشتری <input type="search"></label>
    <label>وضعیت <select><option value="">همه</option><option value="online">آنلاین</option><option value="abandoned">سبد رهاشده</option></select></label>
    <button type="button" class="btn2">به‌روزرسانی گزارش</button>
  </div>
  <p role="status"></p>
  <div class="tablewrap"><table>
    <thead><tr><th>مشتری</th><th>وضعیت حضور</th><th>آخرین حضور</th><th>انتخاب محصولات در دورهٔ گزارش</th><th>سفارش‌های ثبت‌شده</th><th>سفارش‌های ارسال‌شده یا تحویل‌شده</th><th>سبدهای امروز</th></tr></thead>
    <tbody></tbody>
  </table></div>
</details>
"""
    sidebar_assets = (
        "ui-v53435-menu2.js",
        "nav-restructure-v1.js",
        "menu-live-v4.js",
    )
    _sales_entry = """nav.querySelector('[data-tab="salesReports"]'),"""
    _portal_entry = _sales_entry + '\n      nav.querySelector("#gpPortalReportsMenu"),'
    _customer_section = '<section id="customers" class="tab hidden">'
    _legacy_registration = (
        "let showPanel=x.dataset.portalPanel===key || "
        "(key==='accounts'&&x.dataset.portalPanel==='registrations');"
    )
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
        "assets/portal-phase-two-navigation.js",
        "assets/portal-phase-two.css",
        "lib/portal-messages.php",
        "lib/portal-messages-routes.php",
        "config/portal-messages.yaml",
        "config/portal-stock.yaml",
        "config/portal-activity.yaml",
        "lib/portal-activity.php",
        "lib/portal-activity-routes.php",
        "assets/portal-phase-two-activity.js",
        "assets/portal-phase-two-activity-client.js",
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
        report_loader = "require __DIR__.'/lib/customer-purchase-report-route.php';"
        index = self._insert(
            index,
            report_loader,
            "require __DIR__.'/lib/portal-activity-routes.php';\n" + report_loader,
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
        app = self._insert(
            app,
            self._section + self._card,
            self._section + self._card + self._activity_card,
        )
        closing = "\n</body></html>"
        if self._messages_v2 not in app:
            if self._messages_script not in app:
                app = self._insert(
                    app,
                    closing,
                    "\n" + self._script + "\n" + self._messages_script + closing,
                )
            app = self._insert(app, self._script, self._reports_v2)
            app = self._insert(
                app, self._messages_script, self._messages_v2 + "\n" + self._new_assets
            )
        app = self._insert(
            app, self._legacy_registration, "let showPanel=x.dataset.portalPanel===key;"
        )
        if self._current_assets not in app:
            if self._sidebar_release not in app:
                app = self._insert(app, self._old_assets, self._new_assets)
                app = self._insert(app, self._new_assets, self._sidebar_release)
            app = self._insert(app, self._sidebar_release, self._current_assets)
        for name in self.sidebar_assets:
            asset = Path("assets", name)
            text = (source / asset).read_text()
            target = output / asset
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(self._insert(text, self._sales_entry, self._portal_entry))
            start = f'src="/{asset.as_posix()}?'
            _, found, tail = app.partition(start)
            query, end, _ = tail.partition('"')
            if not found or not end:
                raise ValueError(f"Expected a versioned loader for {asset}")
            if not query.endswith("&portalreports=3"):
                app = self._insert(
                    app, start + query + end, start + query + "&portalreports=3" + end
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
            membership_loader = "require __DIR__.'/lib/portal-membership-route.php';"
            router = self._insert(
                router,
                membership_loader,
                self._activity_route + "\n" + membership_loader,
            )
            stock = "function warehouse_free_stock($s,$product){$n=0;"
            router = self._insert(
                router,
                stock + "foreach($s['inventory']??[] as $iv)",
                stock
                + "$policy=json_decode(file_get_contents(dirname(__DIR__).'/config/portal-stock.yaml'),true,512,JSON_THROW_ON_ERROR);"
                + "$wholesale=$policy['wholesale_warehouse_id']??null;"
                + "if(!is_int($wholesale)||$wholesale<1)throw new RuntimeException('Invalid portal stock policy');"
                + "foreach($s['inventory']??[] as $iv)",
            )
            # The web catalog uses bootstrap while Android uses /api/catalog.
            router = self._insert(
                router,
                "if(!empty($iv['order_id']))continue;\n            $name=(string)($iv['product']??'');",
                "if(!empty($iv['order_id'])||(int)($iv['warehouse_id']??$wholesale)!==$wholesale)continue;\n"
                "            $name=(string)($iv['product']??'');",
            )
            router = self._insert(
                router,
                "        $free=[];\n        foreach($s['inventory']",
                "        $policy=json_decode(file_get_contents(dirname(__DIR__).'/config/portal-stock.yaml'),true,512,JSON_THROW_ON_ERROR);\n"
                "        $wholesale=$policy['wholesale_warehouse_id'];\n        $free=[];\n        foreach($s['inventory']",
            )
            router = self._insert(
                router,
                "&&empty($iv['order_id']))$n++;return $n;}",
                "&&empty($iv['order_id'])&&(int)($iv['warehouse_id']??$wholesale)===$wholesale)$n++;return $n;}",
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
            web = (source / "partners/portal.html").read_text()
            policy = json.loads(
                (self._package / "config/portal-activity.yaml").read_text()
            )
            heartbeat = policy["heartbeat_seconds"]
            if type(heartbeat) is not int or heartbeat <= 0:
                raise ValueError("Invalid activity heartbeat.")
            web = self._insert(
                web,
                '<div id="app" ',
                f'<div id="app" data-portal-heartbeat="{heartbeat}" ',
            )
            hook = "window.gpPortalR521?.cartChanged();}"
            web = self._insert(
                web,
                hook,
                hook[:-1] + 'document.dispatchEvent(new Event("gp-portal-cart"));}',
            )
            discard = (
                "this.draft.clear(this.accountKey());\n            banner.remove();"
            )
            web = self._insert(
                web,
                discard,
                "this.draft.clear(this.accountKey());\n"
                '            document.dispatchEvent(new Event("gp-portal-cart-clear"));\n'
                "            banner.remove();",
            )
            submitted = 'this.draft.clear(this.accountKey());\n                    r521Node("orderItems").replaceChildren();'
            web = self._insert(
                web,
                submitted,
                "this.draft.clear(this.accountKey());\n"
                '                    document.dispatchEvent(new Event("gp-portal-cart-clear"));\n'
                '                    r521Node("orderItems").replaceChildren();',
            )
            web = self._insert(
                web, "</body></html>", self._activity_client + "\n</body></html>"
            )
            (target / "portal.html").write_text(web)

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

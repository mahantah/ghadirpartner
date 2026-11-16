"""Stage the customer purchase report against the owner's application source."""

import json
import re
from argparse import ArgumentParser
from hashlib import sha256
from html import unescape
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
    _messages_v3 = _messages_v2.replace("?v=2", "?v=3")
    _new_assets = (
        '<link rel="stylesheet" href="/assets/portal-phase-two.css?v=2">'
        '\n<script defer src="/assets/portal-phase-two-navigation.js?v=2"></script>'
    )
    _old_assets = _new_assets.replace("?v=2", "")
    _sidebar_release = _new_assets.replace("?v=2", "?v=3")
    _current_assets = _sidebar_release.replace("?v=3", "?v=4") + (
        '\n<script defer src="/assets/portal-phase-two-activity.js?v=1"></script>'
    )
    _report_submenu_assets = _current_assets.replace("?v=4", "?v=5")
    _report_icon_assets = _report_submenu_assets.replace(
        "navigation.js?v=5", "navigation.js?v=6"
    )
    _sidebar_rail_assets = _report_icon_assets.replace(
        "navigation.js?v=6", "navigation.js?v=7"
    )
    _recipient_assets = _sidebar_rail_assets.replace("css?v=5", "css?v=6")
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
    console_assets = (
        "production-login-v1.css",
        "customer-ops-stabilize-v1.js",
        "session-keep-v1.js",
    )
    dock_asset = "account-logout-access-v1.css"
    proof_asset = "order-details-v2-approved-20261024.js"
    _credit_base_hashes = {
        "d1a5e6706afca7d98619dc7ce9c6dee7fb4417da5d8be6c58b8621fe7afa8d8b",
        "9342209c672e847095bceaca176cd3b72ffdba8fcd3247aec6ed0283073ad55f",
    }
    credit_library = "lib/customer-credit.php"
    followup_bridge = "production-order-details-bridge-v1.js"
    followup_asset = "order-followup.js"
    native_proof_router = "partners/native-r54.php"
    order_flow_library = "lib/native-order-flow.php"
    _sales_entry = """nav.querySelector('[data-tab="salesReports"]'),"""
    _portal_entry = _sales_entry + '\n      nav.querySelector("#gpPortalReportsMenu"),'
    _reports_entry = """nav.querySelector(':scope > #gpPortalReportsMenu') || nav.querySelector(':scope > [data-tab="salesReports"]'),"""
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
        "lib/portal-panel-switches.php",
        "lib/portal-panel-switches-route.php",
        "lib/customer-purchase-report.php",
        "lib/customer-purchase-report-route.php",
        "assets/customer-purchase-report.js",
        "assets/portal-messages.js",
        "assets/portal-phase-two-navigation.js",
        "assets/portal-phase-two.css",
        "lib/portal-messages.php",
        "lib/portal-messages-routes.php",
        "lib/order-proof-upload.php",
        "lib/order-followup.php",
        "lib/credit-checkout.php",
        "lib/order-wallet.php",
        "lib/order-settlement-progress.php",
        "lib/order-followup-route.php",
        "config/order-followup.yaml",
        "assets/order-followup.js",
        "assets/order-followup.css",
        "lib/order-proof-upload-route.php",
        "config/order-proof-upload.yaml",
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

    def stage_console(self, app: str, source: Path, output: Path) -> str:
        """Patch the live login stylesheet and avoid polling an expired session."""
        app = self._insert(
            app,
            "background:#f3f6fa;-webkit-text-size-adjust:100%;padding-bottom:",
            "background:#f3f6fa;text-size-adjust:100%;padding-bottom:",
        )
        app = self._insert(
            app,
            "async function pollNotif(){try{",
            "async function pollNotif(){if(!ME)return;try{",
        )
        patches = (
            (
                "@font-face{font-family:GhadirIranSans;src:url('/assets/fonts/IRANSansWeb.woff2') format('woff2');font-display:swap;font-weight:100 900}\n",
                "",
            ),
            (
                "if (login || notify || (err && err.status !== 401)) throw err;",
                "if (login || notify || (err && err.status !== 401) || !ME) throw err;",
            ),
            (
                "        var me = await peekMe();",
                "        if (notify) {\n"
                "          window.showSessionExpired();\n"
                "          return [];\n"
                "        }\n"
                "        var me = await peekMe();",
            ),
        )
        for name, (old, new) in zip(self.console_assets, patches, strict=True):
            asset = Path("assets", name)
            data = (source / asset).read_text()
            if new:
                data = self._insert(data, old, new)
            else:
                if old in data:
                    data = self._insert(data, old, "")
                data = data.replace("GhadirIranSans,IRANSans", "IRANSans", 1)
            target = output / asset
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(data)
            attribute = "href" if name.endswith(".css") else "src"
            start = f'{attribute}="/{asset.as_posix()}?'
            _, found, tail = app.partition(start)
            query, end, _ = tail.partition('"')
            if not found or not end:
                raise ValueError(f"Expected a versioned loader for {asset}")
            if not query.endswith("&console=1"):
                app = self._insert(
                    app, start + query + end, start + query + "&console=1" + end
                )
        return app

    def stage_proof_documents(self, app: str, source: Path, output: Path) -> str:
        """Add PDF downloads alongside the existing photo previews."""
        asset = Path("assets", self.proof_asset)
        data = self._insert(
            (source / asset).read_text(),
            "extension:proof.proof_mime==='image/png'?'png':'jpg'",
            "extension:proof.proof_mime==='application/pdf'?'pdf':proof.proof_mime==='image/png'?'png':'jpg'",
        )
        if "if(image.extension==='pdf')" not in data:
            label = "    const label=image.label;\n"
            data = self._insert(
                data,
                label,
                label
                + """    if(image.extension==='pdf')return '<figure class="od2-evidence"><figcaption>'+label.replace(/^تصویر /,'')+'</figcaption><a class="btn2" href="'+image.src+'" download="payment-'+String(Number(o.id)||0)+'-'+index+'.pdf">دانلود فایل PDF</a></figure>';\n""",
            )
        doc_label = "label:proof.kind"
        data = self._insert(data, doc_label, "note:gpOdEsc(proof.note)," + doc_label)
        data = self._insert(
            data,
            "'+label+'</figcaption>",
            "'+label+(image.note?' · '+image.note:'')+'</figcaption>",
        )
        data = self._insert(
            data,
            "label.replace(/^تصویر /,'')+'</figcaption>",
            "label.replace(/^تصویر /,'')+(image.note?' · '+image.note:'')+'</figcaption>",
        )
        bridge = Path("assets", self.followup_bridge)
        bridge_source = (source / bridge).read_text()
        (output / bridge).write_text(
            self._insert(
                bridge_source,
                "return legacy.open(id);",
                "return legacy.open(id, section);",
            )
        )
        bridge_url = f'src="/{bridge.as_posix()}?'
        _, found_bridge, bridge_tail = app.partition(bridge_url)
        bridge_query, bridge_end, _ = bridge_tail.partition('"')
        if not found_bridge or not bridge_end:
            raise ValueError(f"Expected a versioned loader for {bridge}")
        if not bridge_query.endswith("&followup=1"):
            app = self._insert(
                app,
                bridge_url + bridge_query + bridge_end,
                bridge_url + bridge_query + "&followup=1" + bridge_end,
            )
        hook = "  overlay.classList.remove('hidden');gpOdActivate(section);"
        data = self._insert(
            data, hook, hook + "\n  window.gpOrderFollowup?.mount(root,o.id);"
        )
        payment = "gpOdEsc(o.payment_status||'پرداخت نشده')"
        data = self._insert(
            data,
            payment,
            "(window.gpOrderFollowup?.settlementHtml(o,"
            + payment
            + ")??"
            + payment
            + ")",
        )
        (output / asset).write_text(data)
        start = f'src="/{asset.as_posix()}?'
        _, found, tail = app.partition(start)
        query, end, _ = tail.partition('"')
        if not found or not end:
            raise ValueError(f"Expected a versioned loader for {asset}")
        if not query.endswith("&proofs=4"):
            app = self._insert(
                app,
                start + query + end,
                start
                + query.removesuffix("&proofs=2").removesuffix("&proofs=3")
                + "&proofs=4"
                + end,
            )
        return app

    def stage_checkout_proofs(self, router: str, source: Path, output: Path) -> str:
        """Run multi-file checkout inside the existing order write transaction."""
        native = Path(self.native_proof_router)
        header = "header('Content-Type: '.$proof['proof_mime']);"
        (output / native).parent.mkdir(parents=True, exist_ok=True)
        (output / native).write_text(
            self._insert(
                (source / native).read_text(),
                header,
                header
                + """if($proof['proof_mime']==='application/pdf')header('Content-Disposition: attachment; filename="payment-document.pdf"');""",
            )
        )
        if "if($checkoutProofs!==null)$checkoutProofs->commit();" in router:
            return router
        method_guard = "    if($isCustomer&&!isset($paymentLabels[$requestedPayment]))"
        router = self._insert(
            router,
            method_guard,
            "    $paymentLabels['mixed']=$paymentLabels['mixed']??'تسویه ترکیبی';\n"
            + method_guard,
        )
        checkout = "    $result=db(true,function(&$s)use($x,$u,$isCustomer,$requestedPayment,$paymentLabels,$promoInput,$gpCustomerOrderFlow){"
        router = self._insert(
            router,
            checkout,
            """    $paymentFiles=$isCustomer?($x['settlement_details']['payment_files']??null):null;
    $checkoutProofs=null;
    if($paymentFiles!==null){
        if(!is_array($paymentFiles))fail('فایل‌های پرداخت معتبر نیستند.',422);
        require_once dirname(__DIR__).'/lib/order-proof-upload.php';
        $checkoutProofs=GpOrderProofUpload::configured(dirname($file).'/native-proofs');
    }
"""
            + checkout.replace(
                "$gpCustomerOrderFlow){",
                "$gpCustomerOrderFlow,$checkoutProofs,$paymentFiles){",
            ),
        )
        order = "        $history=$isCustomer?'سفارش توسط مشتری با فاکتور "
        router = self._insert(
            router,
            order,
            """        if($isCustomer&&$requestedPayment==='mixed'){
            foreach(['cash','check'] as $kind){
                $amount=$kind.'_amount';
                $o['native_settlement'][$amount]=$o['native_settlement'][$amount]??($x['settlement_details'][$amount]??0);
            }
        }
        if($checkoutProofs!==null){
            try {
                $checkoutProofs->appendCheckout($o,$paymentFiles,$o['created_at']);
            } catch (DomainException $error) {
                fail($error->getMessage(),$error->getCode());
            }
        }
"""
            + order,
        )
        result = "    [$order,$customer,$adminMobiles]=$result;"
        return self._insert(
            router,
            result,
            "    if($checkoutProofs!==null)$checkoutProofs->commit();\n" + result,
        )

    def stage_order_revision(self, router: str) -> str:
        """Reuse the priced checkout for an owner editing a returned order in place."""
        if "if($revisionId>0)out($order);" in router:
            return router
        loader = "    $paymentFiles=$isCustomer?"
        router = self._insert(
            router,
            loader,
            """    $revisionId=$isCustomer?($x['revision_order_id']??0):0;
    $revisionVersion=$isCustomer?($x['revision_version']??0):0;
    if(!is_int($revisionId)||$revisionId<0||!is_int($revisionVersion)||$revisionVersion<0
        ||(($revisionId>0)!==($revisionVersion>0)))fail('شماره یا نسخه سفارش معتبر نیست.',422);
    unset($x['revision_order_id'],$x['revision_version']);
    $revisionService=null;
    if($revisionId>0){
        require_once dirname(__DIR__).'/lib/order-followup.php';
        $revisionService=GpOrderFollowup::configured(dirname($file).'/native-proofs');
    }
"""
            + loader,
        )
        capture = "$gpCustomerOrderFlow,$checkoutProofs,$paymentFiles){"
        router = self._insert(
            router,
            capture,
            "$gpCustomerOrderFlow,$checkoutProofs,$paymentFiles,$revisionService,$revisionId,$revisionVersion){\n"
            """        $revisionIndex=null;
        if($revisionService!==null){
            try{
                $revisionIndex=$revisionService->revisionIndex($s,$revisionId,(int)$x['customer_id'],$revisionVersion);
            }catch(DomainException $error){fail($error->getMessage(),$error->getCode());}
        }""",
        )
        router = self._insert(
            router,
            "$id=$s['next_order']++;$c=$s['customers'][$ci];$o=$x;",
            "$id=$revisionIndex===null?$s['next_order']++:$revisionId;$c=$s['customers'][$ci];$o=$x;",
        )
        offer = "$offer=offer_by_code($s,$promoInput,(int)$x['customer_id']);"
        router = self._insert(
            router,
            offer,
            """if($revisionIndex!==null){
                $s['offer_usages']=array_values(array_filter($s['offer_usages']??[],
                    static fn(array $entry):bool=>(int)($entry['order_id']??0)!==$revisionId));
            }"""
            + offer,
        )
        history = "        $history=$isCustomer?'سفارش توسط مشتری با فاکتور "
        router = self._insert(
            router,
            history,
            """        if($revisionIndex!==null){
            try{$revisionService->preserveRevision($s['orders'][$revisionIndex],$o,$paymentFiles??[],$o['updated_at']);}
            catch(DomainException $error){fail($error->getMessage(),$error->getCode());}
        }
"""
            + history,
        )
        store = "hist($o,$u['username'],$history);$s['orders'][]=$o;"
        router = self._insert(
            router,
            store,
            """if($revisionIndex!==null){
            hist($o,$u['username'],'سفارش پس از اصلاح دوباره ارسال شد');
            $s['orders'][$revisionIndex]=$o;
            if($promoInput===''){
                $s['offer_usages']=array_values(array_filter($s['offer_usages']??[],
                    static fn(array $entry):bool=>(int)($entry['order_id']??0)!==$id));
            }
        }else{hist($o,$u['username'],$history);$s['orders'][]=$o;}""",
        )
        return self._insert(
            router,
            "    sms_status($customer,$order,'','order_created');",
            "    if($revisionId>0)out($order);\n    sms_status($customer,$order,'','order_created');",
        )

    def stage_credit_checkout(self, router: str, *, partner: bool) -> str:
        """Bind credit checkout to priced orders and guard the existing approval entry points."""
        if partner:
            revision = "$revisionService->preserveRevision($s['orders'][$revisionIndex],$o,$paymentFiles??[],$o['updated_at']);"
            if revision in router:
                router = self._insert(
                    router,
                    revision,
                    "try{" + revision + "}\n"
                    "            catch(DomainException $error){fail($error->getMessage(),$error->getCode());}",
                )
        if partner and "->initialize($o,$prior,$walletAmount)" not in router:
            order = "$c=$s['customers'][$ci];$o=$x;"
            router = self._insert(
                router,
                order,
                order
                + "\n        if($isCustomer){"
                + "$o=array_intersect_key($o,array_flip(['invoice_type','address_id','notes']));"
                + "}",
            )
            history = "        $history=$isCustomer?'سفارش توسط مشتری با فاکتور "
            router = self._insert(
                router,
                history,
                """        if($isCustomer){
            require_once dirname(__DIR__).'/lib/credit-checkout.php';
            $prior=$revisionIndex===null?null:$s['orders'][$revisionIndex];
            $walletAmount=$x['settlement_details']['wallet_amount']??0;
            if(!is_int($walletAmount)||$walletAmount<0)fail('مبلغ کیف پول معتبر نیست.',422);
            try{
                (new GpCreditCheckout())->initialize($o,$prior,$walletAmount);
                (new GpOrderWallet())->assertReservation($s,$o);
            }
            catch(DomainException $error){fail($error->getMessage(),$error->getCode());}
        }
"""
                + history,
            )
        if "->assertApproval($o," in router:
            return router
        approval = (
            "$o['approved_total']=max(0,$total);"
            if partner
            else "$o['approved_total']=max(0,(int)($x['total']??$o['estimated_total']??0));"
        )
        total = "$total" if partner else "(int)($x['total']??$o['estimated_total']??0)"
        library = "dirname(__DIR__)" if partner else "__DIR__"
        route = router.index("if($p==='/api/customer-order/approve'")
        end = router.index("\n", route)
        return (
            router[:route]
            + self._insert(
                router[route:end],
                approval,
                f"require_once {library}.'/lib/credit-checkout.php';"
                + "try{"
                + f"(new GpCreditCheckout())->assertApproval($o,{total});"
                + "(new GpOrderWallet())->purchase($s,$o,now());}"
                + "catch(DomainException $error){fail($error->getMessage(),$error->getCode());}"
                + "(new GpCreditCheckout())->recordApproval($o);"
                + approval,
            )
            + router[end:]
        )

    def stage_settlement_progress(self, index: str, app: str) -> tuple[str, str]:
        """Use the accounting projection in the existing automation payment column and detail views."""
        decorator = "function gp_decorate_order($s,$o){\n"
        index = self._insert(
            index,
            decorator,
            decorator + " require_once __DIR__.'/lib/order-settlement-progress.php';\n"
            " static $settlementProgress;\n"
            " $settlementProgress=$settlementProgress??new GpOrderSettlementProgress(new GpCreditModel());\n"
            " $o['settlement_progress']=$settlementProgress->read($o);\n",
        )
        row = '<td><span class="badge ${payClass(o.payment_status)}">${esc(o.payment_status)}</span></td><td><span class="badge ${statusClass(o.status)}">'
        new_row = '<td>${window.gpOrderFollowup?.settlementHtml(o,detailPayBadge(o.payment_status))??detailPayBadge(o.payment_status)}</td><td><span class="badge ${statusClass(o.status)}">'
        # The dashboard has a similar row, so scope the patch to the Orders list.
        prefix, marker, rest = app.partition("function renderOrders(){")
        orders, end, suffix = rest.partition("function goOrderPage(")
        if not marker or not end:
            raise ValueError("Orders list renderer not found.")
        app = prefix + marker + self._insert(orders, row, new_row) + end + suffix
        old_badge = "${detailPayBadge(o.payment_status)}${o.payment_method_label?"
        new_badge = "${window.gpOrderFollowup?.settlementHtml(o,detailPayBadge(o.payment_status))??detailPayBadge(o.payment_status)}${o.payment_method_label?"
        app = self._insert(app, old_badge, new_badge)
        modal = '${paymentDetailHtml(o)}<select id="pstatus"'
        app = self._insert(
            app, modal, "${window.gpOrderFollowup?.settlementHtml(o)??''}" + modal
        )
        return index, app

    def stage_followup(
        self, index: str, app: str, source: Path, output: Path
    ) -> tuple[str, str]:
        """Publish both authenticated follow-up routes and the staff order controls."""
        loader = "require __DIR__.'/lib/portal-activity-routes.php';"
        index = self._insert(
            index, loader, "require __DIR__.'/lib/order-followup-route.php';\n" + loader
        )
        # Refuse to replace a credit implementation changed independently on the host.
        credit = Path(self.credit_library)
        live = (source / credit).read_bytes()
        candidate = (self._package / credit).read_bytes()
        if (
            live != candidate
            and sha256(live).hexdigest() not in self._credit_base_hashes
        ):
            raise ValueError(
                "The live credit library differs from the reviewed baseline."
            )
        (output / credit).parent.mkdir(parents=True, exist_ok=True)
        (output / credit).write_bytes(candidate)
        script = '<script defer src="/assets/order-followup.js?v=5"></script>'
        for previous_version in (1, 2, 3, 4):
            old_script = f'<script defer src="/assets/order-followup.js?v={previous_version}"></script>'
            if old_script in app:
                app = self._insert(app, old_script, script)
        if script not in app:
            app = self._insert(
                app, self._messages_v3, self._messages_v3 + "\n" + script
            )
        alerts = """<button class="gp-order-alerts" type="button" id="gpOrderAlerts" aria-haspopup="dialog" aria-label="اعلان‌های سفارش" title="اعلان‌های سفارش" hidden>
  <span aria-hidden="true">🔔</span><span class="gp-order-alert-badge" id="gpOrderAlertsCount" hidden></span>
</button>
<dialog class="gp-order-alerts-dialog" id="gpOrderAlertsDialog" aria-labelledby="gpOrderAlertsTitle" dir="rtl">
  <div><div class="gp-order-alerts-heading"><h2 id="gpOrderAlertsTitle">اعلان‌های سفارش</h2>
  <form method="dialog"><button class="btn2" type="submit" autofocus>بستن</button></form></div>
  <p id="gpOrderAlertsStatus" role="status">در حال دریافت اعلان‌ها…</p><ul id="gpOrderAlertsList"></ul></div>
</dialog>
"""
        header = '<div id="app" class="hidden"><header>'
        old_button = """<button class="gp-order-alerts" type="button" id="gpOrderAlerts" aria-haspopup="dialog" hidden>
  <span aria-hidden="true">🔔</span><span>اعلان‌های سفارش</span><span class="gp-order-alert-badge" id="gpOrderAlertsCount" hidden></span>
</button>"""
        if old_button in app:
            app = self._insert(app, old_button, alerts.split("\n<dialog", 1)[0])
        elif 'id="gpOrderAlerts"' not in app:
            app = self._insert(app, header, header + alerts)
        stylesheet = '<link rel="stylesheet" href="/assets/order-followup.css?v=3">'
        for previous_version in (1, 2):
            old_stylesheet = stylesheet.replace("?v=3", f"?v={previous_version}")
            if old_stylesheet in app:
                app = self._insert(app, old_stylesheet, stylesheet)

        dock = '<link rel="stylesheet" href="/assets/order-details-v2-approved-20261024.css'
        app = self._insert(app, dock, stylesheet + "\n" + dock)
        legacy = "$('orderDetailOverlay').classList.remove('hidden')}\nfunction closeOrderDetails()"
        app = self._insert(
            app,
            legacy,
            "$('orderDetailOverlay').classList.remove('hidden');"
            "window.gpOrderFollowup?.mount($('orderDetailBody'),o.id,section)}\nfunction closeOrderDetails()",
        )
        app = self._insert(
            app,
            "async function openOrderDetails(id){await ensureOrderSerialMeta(id);",
            "async function openOrderDetails(id,section='overview'){await ensureOrderSerialMeta(id);",
        )
        poll = "async function pollNotif(){if(!ME)return;try{"
        app = self._insert(app, poll, poll + "window.gpOrderFollowup?.updateAlerts();")
        return index, app

    def stage_panel_switches(
        self, app: str, router: str, source: Path, output: Path
    ) -> str:
        """Publish the form's current switch options and preserve each order line's choice."""
        form = re.search(r'<div id="pspSelect"[^>]*>(.*?)</div>', app, re.DOTALL)
        if form is None:
            raise ValueError("Automation switch list is missing.")
        options = [
            unescape(label)
            for label in re.findall(r'<input\b[^>]*\bvalue="([^"]+)"', form[1])
        ]
        if not options or len(set(options)) != len(options):
            raise ValueError("Automation switch options are empty or duplicated.")
        policy = output / "config/portal-panel-switches.yaml"
        policy.parent.mkdir(parents=True, exist_ok=True)
        policy.write_text(json.dumps(options, ensure_ascii=False) + "\n")
        flow = Path(self.order_flow_library)
        identity = '$identity = $name . "\\0" . $key;'
        (output / flow).parent.mkdir(parents=True, exist_ok=True)
        (output / flow).write_text(
            self._insert(
                (source / flow).read_text(),
                identity,
                "$identity = $name . \"\\0\" . $key . \"\\0\" . (is_string($item['panel_switch'] ?? null) ? $item['panel_switch'] : '');",
            )
        )
        loader = "require_once dirname(__DIR__).'/lib/native-order-flow-routes.php';"
        router = self._insert(
            router,
            loader,
            "require dirname(__DIR__).'/lib/portal-panel-switches-route.php';\n"
            + loader,
        )
        prepare = "        $subtotal=0;$items=[];$requested=[];$seenItems=[];"
        router = self._insert(
            router,
            prepare,
            "        $panelSwitches=null;$selectedPanels=[];\n" + prepare,
        )
        key = "$purchaseIdentity=$isCustomer?$name.\"\\0\".trim((string)($it['price_key']??'')):$name;"
        router = self._insert(
            router,
            key,
            "$switch='';if($isCustomer&&array_key_exists('panel_switch',$it)){"
            "require_once dirname(__DIR__).'/lib/portal-panel-switches.php';"
            "$panelSwitches=$panelSwitches??GpPortalPanelSwitches::published();"
            "try{$switch=$panelSwitches->choice($it);}catch(InvalidArgumentException $e){fail($e->getMessage(),422);}"
            "if($switch!=='')$selectedPanels[$switch]=true;}\n            "
            "$purchaseIdentity=$isCustomer?$name.\"\\0\".trim((string)($it['price_key']??'')).\"\\0\".$switch:$name;",
        )
        amount = "$subtotal+=$line;"
        router = self._insert(
            router,
            amount,
            "if($switch!=='')$items[count($items)-1]['panel_switch']=$switch;" + amount,
        )
        store = "$o['purchase_items']=$purchaseItems;"
        return self._insert(
            router,
            store,
            store
            + "if($selectedPanels){$o['panels']=array_keys($selectedPanels);$o['psp']=$o['panels'][0];}",
        )

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
        if self._messages_v2 not in app and self._messages_v3 not in app:
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
        app = self._insert(app, self._messages_v2, self._messages_v3)
        app = self._insert(
            app, self._legacy_registration, "let showPanel=x.dataset.portalPanel===key;"
        )
        if (
            self._recipient_assets not in app
            and self._sidebar_rail_assets not in app
            and self._report_icon_assets not in app
            and self._report_submenu_assets not in app
        ):
            if self._current_assets not in app:
                if self._sidebar_release not in app:
                    app = self._insert(app, self._old_assets, self._new_assets)
                    app = self._insert(app, self._new_assets, self._sidebar_release)
                app = self._insert(app, self._sidebar_release, self._current_assets)
            app = self._insert(app, self._current_assets, self._report_submenu_assets)
        if self._sidebar_rail_assets not in app and self._recipient_assets not in app:
            app = self._insert(
                app, self._report_submenu_assets, self._report_icon_assets
            )
            app = self._insert(app, self._report_icon_assets, self._sidebar_rail_assets)
        app = self._insert(app, self._sidebar_rail_assets, self._recipient_assets)
        for name in self.sidebar_assets:
            asset = Path("assets", name)
            text = (source / asset).read_text()
            target = output / asset
            target.parent.mkdir(parents=True, exist_ok=True)
            if self._reports_entry not in text:
                text = self._insert(text, self._sales_entry, self._portal_entry)
            target.write_text(
                self._insert(text, self._portal_entry, self._reports_entry)
            )
            start = f'src="/{asset.as_posix()}?'
            _, found, tail = app.partition(start)
            query, end, _ = tail.partition('"')
            if not found or not end:
                raise ValueError(f"Expected a versioned loader for {asset}")
            next_query = query.removesuffix("&portalreports=3")
            if not next_query.endswith("&portalreports=4"):
                app = self._insert(
                    app,
                    start + query + end,
                    start + next_query + "&portalreports=4" + end,
                )
        app = self.stage_console(app, source, output)
        app = self.stage_proof_documents(app, source, output)
        index, app = self.stage_followup(index, app, source, output)
        index, app = self.stage_settlement_progress(index, app)
        dock_path = Path("assets", self.dock_asset)
        copyfile(self._package / dock_path, output / dock_path)
        dock_url = f'href="/{dock_path.as_posix()}?v=1&whfix=20261028a'
        if dock_url + '&dock=4"' not in app:
            if dock_url + '&dock=3"' not in app:
                app = self._insert(app, dock_url + '"', dock_url + '&dock=2"')
                app = self._insert(app, dock_url + '&dock=2"', dock_url + '&dock=3"')
            app = self._insert(app, dock_url + '&dock=3"', dock_url + '&dock=4"')
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
            proof_route = (
                "require dirname(__DIR__).'/lib/order-proof-upload-route.php';"
            )
            router = self._insert(
                router, self._activity_route, proof_route + "\n" + self._activity_route
            )
            router = self._insert(
                router,
                proof_route,
                "require dirname(__DIR__).'/lib/order-followup-route.php';\n"
                + proof_route,
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
        (output / "index.php").write_text(
            self.stage_credit_checkout(index, partner=False)
        )
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
            (target / "index.php").write_text(
                self.stage_credit_checkout(
                    self.stage_order_revision(
                        self.stage_checkout_proofs(
                            self.stage_panel_switches(app, router, source, output),
                            source,
                            output,
                        )
                    ),
                    partner=True,
                )
            )
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

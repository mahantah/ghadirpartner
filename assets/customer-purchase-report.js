(() => {
    "use strict";

    const section = document.getElementById("gpCustomerPurchaseReport");
    if (!section) return;
    const membership = document.getElementById("gpMembershipRequests");
    const membershipRows = membership.querySelector("tbody");
    const membershipStatus = membership.querySelector("[role=status]");

    const form = section.querySelector("form");
    const customer = form.elements.namedItem("customer_id");
    const status = section.querySelector("[role=status]");
    const result = section.querySelector("dl");
    const products = section.querySelector("ul");
    const orders = section.querySelector("tbody");
    const ordersWrap = section.querySelector(".tablewrap");
    const number = new Intl.NumberFormat("fa-IR");
    let generation = 0;
    let customersLoading = false;
    let membershipLoading = false;

    async function loadMembership() {
        if (membershipLoading) return;
        membershipLoading = true;
        const request = generation;
        membershipStatus.textContent = "در حال دریافت درخواست‌ها…";
        try {
            const rows = await req("/api/registration-requests");
            if (request !== generation) return;
            membershipRows.replaceChildren();
            for (const applicant of rows) {
                const row = membershipRows.insertRow();
                const labels = { pending: "در انتظار بررسی", approved: "تأیید شده", rejected: "رد شده" };
                const verified = applicant.mobile_verified_at ? "تأیید پیامکی" : "ثبت نشده";
                for (const field of [applicant.name, applicant.mobile, verified, applicant.national_id ?? "—", labels[applicant.status] ?? applicant.status]) {
                    row.insertCell().textContent = field;
                }
                const actions = row.insertCell();
                if (applicant.status !== "pending") continue;
                for (const [action, label] of [["approve", "تأیید و فعال‌سازی"], ["reject", "رد درخواست"]]) {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.textContent = label;
                    button.addEventListener("click", async () => {
                        const review = action === "approve" && Boolean(applicant.national_id);
                        const prompt = review ? "هویت متقاضی را بررسی کرده‌اید و حساب فعال شود؟" : label + " انجام شود؟";
                        if (request !== generation || !has("admin") || !window.confirm(prompt)) return;
                        for (const control of actions.querySelectorAll("button")) control.disabled = true;
                        try {
                            membershipStatus.textContent = "در حال ثبت نتیجه…";
                            const outcome = await req("/api/registration-requests/review", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: applicant.id, action, identity_reviewed: review }),
                            });
                            if (!outcome?.ok) throw new Error("سامانه نتیجهٔ بررسی را تأیید نکرد.");
                            if (request === generation) {
                                row.cells[4].textContent = labels[outcome.status] ?? outcome.status;
                                actions.replaceChildren();
                                membershipStatus.textContent = action === "approve"
                                    ? "درخواست تأیید شد و حساب فعال شد."
                                    : "درخواست رد شد.";
                            }
                        } catch (error) {
                            if (request === generation) {
                                const reason = error instanceof Error ? error.message.trim() : "";
                                membershipStatus.textContent = reason && !reason.startsWith("<") && reason.length < 300
                                    ? reason : "ثبت نتیجه ناموفق بود. درخواست را دوباره بررسی کنید.";
                            }
                        } finally {
                            for (const control of actions.querySelectorAll("button")) control.disabled = false;
                        }
                    });
                    actions.append(button, " ");
                }
            }
            membershipStatus.textContent = rows.length ? "" : "درخواستی ثبت نشده است.";
        } catch {
            if (request === generation) membershipStatus.textContent = "دریافت درخواست‌ها ناموفق بود.";
        } finally {
            membershipLoading = false;
        }
    }

    membership.querySelector("summary").addEventListener("click", () => {
        if (!membership.open) void loadMembership();
    });
    membership.querySelector("button").addEventListener("click", loadMembership);

    function clearResult() {
        metrics.replaceChildren();
        productRows.replaceChildren();
        orders.replaceChildren();
        ordersWrap.hidden = true;
    }

    function value(label, amount) {
        appendRow(metrics, [label, amount]);
    }

    function appendRow(container, values) {
        const row = document.createElement("tr");
        for (const value of values) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.append(cell);
        }
        container.append(row);
    }

    function tableFor(element, title, columns) {
        const table = document.createElement("table");
        table.createCaption().textContent = title;
        const headers = table.createTHead().insertRow();
        for (const label of columns) {
            const header = document.createElement("th");
            header.scope = "col";
            header.textContent = label;
            headers.append(header);
        }
        const body = table.createTBody();
        element.replaceWith(table);
        return body;
    }

    const metrics = tableFor(result, "خلاصهٔ خرید و اعتبار", ["شاخص", "مقدار"]);
    const productRows = tableFor(products, "اقلام خریداری‌شده", ["محصول", "تعداد"]);

    async function loadCustomers() {
        if (customersLoading) return;
        customersLoading = true;
        const request = generation;
        status.textContent = "در حال دریافت فهرست مشتریان…";
        try {
            const rows = await req("/api/reports/customers");
            if (request !== generation) return;
            customer.replaceChildren(new Option("انتخاب مشتری", ""));
            for (const row of rows) {
                customer.add(new Option(
                    [row.name, row.company, row.code].filter(Boolean).join(" · "),
                    String(row.customer_id),
                ));
            }
            status.textContent = rows.length ? "" : "مشتری فعالی برای گزارش پیدا نشد.";
        } catch {
            if (request === generation) status.textContent = "دریافت فهرست مشتریان ناموفق بود.";
        } finally {
            customersLoading = false;
        }
    }

    section.querySelector("summary").addEventListener("click", () => {
        if (!section.open && customer.options.length <= 1) void loadCustomers();
    });
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submit = form.querySelector("button[type=submit]");
        if (submit.disabled) return;
        const request = generation;
        submit.disabled = true;
        status.textContent = "در حال دریافت گزارش…";
        clearResult();
        try {
            const query = new URLSearchParams(new FormData(form));
            const data = await req("/api/reports/customer-purchases?" + query.toString());
            if (request !== generation) return;
            const money = (amount) => number.format(amount) + " تومان";
            const persianDate = (date) => date.replace(/\d/g, (digit) => number.format(Number(digit)));
            value("خریدهای قطعی در بازه", number.format(data.counts.purchased));
            value("مبلغ خرید قطعی در بازه", money(data.total_amount));
            value("در انتظار تأیید", number.format(data.counts.pending));
            value("لغوشده یا ردشده", number.format(data.counts.cancelled));
            value("سایر سفارش‌های ثبت‌شده", number.format(data.counts.other));
            const credit = data.credit;
            value("ماه شمسی اعتبار", persianDate(credit.month));
            value("وضعیت اعتبار", credit.enabled ? "فعال" : "غیرفعال");
            value("سقف اعتبار", money(credit.limit));
            value("مصرف ماه جاری", money(credit.monthly_used));
            value("رزرو بابت سفارش‌های در انتظار تأیید", money(credit.reserved));
            value("بدهی تسویه‌نشده", money(credit.outstanding));
            value("اعتبار قابل‌استفاده", money(credit.available));
            for (const [name, quantity] of Object.entries(data.products)) {
                appendRow(productRows, [name, number.format(quantity)]);
            }
            for (const order of data.orders) {
                const row = orders.insertRow();
                for (const field of [
                    order.number, persianDate(order.date), order.status,
                    order.approval || "—", money(order.amount),
                ]) row.insertCell().textContent = field;
            }
            ordersWrap.hidden = !data.orders.length;
            status.textContent = productRows.childElementCount
                ? "گزارش آماده است."
                : "در این بازه کالای خریداری‌شده‌ای ثبت نشده است.";
        } catch {
            if (request === generation) {
                status.textContent = "دریافت گزارش ناموفق بود. بازهٔ شمسی و انتخاب مشتری را بررسی کنید.";
            }
        } finally {
            submit.disabled = false;
        }
    });

    function syncVisibility() {
        const hidden = !has("admin");
        if (section.hidden === hidden) return;
        section.hidden = hidden;
        membership.hidden = hidden;
        if (section.hidden) {
            generation++;
            membership.open = false;
            membershipRows.replaceChildren();
            membershipStatus.textContent = "";
            section.open = false;
            form.reset();
            customer.replaceChildren(new Option("انتخاب مشتری", ""));
            clearResult();
            status.textContent = "";
        }
    }

    const app = document.getElementById("app");
    if (app) new MutationObserver(syncVisibility).observe(app, { attributes: true });
    syncVisibility();
})();

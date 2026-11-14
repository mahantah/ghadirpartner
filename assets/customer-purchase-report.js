(() => {
    "use strict";

    const section = document.getElementById("gpCustomerPurchaseReport");
    if (!section) return;

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

    function clearResult() {
        result.replaceChildren();
        products.replaceChildren();
        orders.replaceChildren();
        ordersWrap.hidden = true;
    }

    function value(label, amount) {
        const term = document.createElement("dt");
        const definition = document.createElement("dd");
        term.textContent = label;
        definition.textContent = amount;
        result.append(term, definition);
    }

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
                const item = document.createElement("li");
                item.textContent = name + " · " + number.format(quantity) + " دستگاه";
                products.append(item);
            }
            for (const order of data.orders) {
                const row = orders.insertRow();
                for (const field of [
                    order.number, persianDate(order.date), order.status,
                    order.approval || "—", money(order.amount),
                ]) row.insertCell().textContent = field;
            }
            ordersWrap.hidden = !data.orders.length;
            status.textContent = products.childElementCount
                ? "اقلام خریداری‌شده در بازه در انتهای گزارش آمده‌اند."
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
        if (section.hidden) {
            generation++;
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

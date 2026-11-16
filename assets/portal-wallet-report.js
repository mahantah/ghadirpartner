(() => {
    "use strict";

    const panel = document.getElementById("gpPortalWallet");
    if (!panel) return;
    const endpoint = "/api/reports/portal-wallet";
    const form = panel.querySelector("form");
    const customer = form.elements.namedItem("customer_id");
    const status = panel.querySelector("[role=status]");
    const totals = panel.querySelector("dl");
    const table = panel.querySelector(".tablewrap");
    const rows = table.querySelector("tbody");
    const formatter = new Intl.NumberFormat("fa-IR");
    /** Keep the recorded Tehran wall clock as stored, using Persian digits. */
    const formatDate = value => String(value ?? "").replace(/\d/g, digit => formatter.format(Number(digit)));
    const money = amount => formatter.format(amount) + " تومان";
    const types = {
        order_purchase: "پرداخت سفارش",
        order_cancellation: "بازگشت وجه سفارش به کیف پول",
        credit_repayment: "تسویهٔ اعتبار",
    };
    let generation = 0;
    let loadingCustomers = false;

    function clear() {
        totals.replaceChildren();
        rows.replaceChildren();
        table.hidden = true;
    }

    async function loadCustomers() {
        if (loadingCustomers || customer.options.length > 1 || !has("finance")) return;
        loadingCustomers = true;
        const request = generation;
        status.textContent = "در حال دریافت فهرست مشتریان…";
        try {
            const customers = await req(endpoint);
            if (request !== generation) return;
            for (const entry of customers) {
                customer.add(new Option(
                    [entry.name, entry.company, entry.code].filter(Boolean).join(" · "),
                    String(entry.id),
                ));
            }
            status.textContent = customers.length ? "" : "مشتری فعالی پیدا نشد.";
        } catch {
            if (request === generation) status.textContent = "دریافت فهرست مشتریان ناموفق بود.";
        } finally {
            loadingCustomers = false;
        }
    }

    customer.addEventListener("change", () => {
        generation++;
        status.textContent = "";
        clear();
    });
    panel.addEventListener("toggle", () => {
        if (panel.open) void loadCustomers();
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!has("finance") || !customer.value) return;
        const request = ++generation;
        clear();
        status.textContent = "در حال دریافت کیف پول…";
        try {
            const query = new URLSearchParams({customer_id: customer.value});
            const wallet = await req(endpoint + "?" + query.toString());
            if (request !== generation) return;
            for (const [label, amount] of [
                ["موجودی", wallet.balance],
                ["مبلغ رزروشده", wallet.reserved],
                ["موجودی قابل استفاده", wallet.available],
            ]) {
                const term = document.createElement("dt");
                const value = document.createElement("dd");
                term.textContent = label;
                value.textContent = money(amount);
                totals.append(term, value);
            }
            for (const movement of wallet.transactions) {
                const row = document.createElement("tr");
                for (const value of [formatDate(movement.at), types[movement.source] ?? "تراکنش کیف پول", movement.number, money(movement.amount)]) {
                    const cell = document.createElement("td");
                    cell.textContent = value || "—";
                    row.append(cell);
                }
                rows.append(row);
            }
            table.hidden = !wallet.transactions.length;
            status.textContent = wallet.transactions.length ? "" : "گردش کیف پولی برای این مشتری ثبت نشده است.";
        } catch {
            if (request === generation) status.textContent = "دریافت کیف پول مشتری ناموفق بود.";
        }
    });

    const app = document.getElementById("app");
    function syncVisibility() {
        const hidden = !has("finance") || app.classList.contains("hidden");
        panel.hidden = hidden;
        if (!hidden) return;
        generation++;
        panel.open = false;
        customer.replaceChildren(new Option("انتخاب مشتری", ""));
        status.textContent = "";
        clear();
    }
    new MutationObserver(syncVisibility).observe(app, {attributeFilter: ["class"]});
    syncVisibility();
})();

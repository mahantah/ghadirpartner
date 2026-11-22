(() => {
    "use strict";

    const panel = document.getElementById("gpPortalWallet");
    if (!panel) return;
    const endpoint = "/api/reports/portal-wallet";
    const form = panel.querySelector("form");
    const creditForm = panel.querySelector("[data-wallet-credit]");
    const creditAmount = creditForm?.elements.namedItem("amount");
    const creditNote = creditForm?.elements.namedItem("note");
    const creditButton = creditForm?.querySelector('button[type="submit"]');
    const reportButton = form.querySelector('button[type="submit"]');
    const customer = form.elements.namedItem("customer_id");
    const search = form.elements.namedItem("customer_search");
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
        manual_credit: "افزایش دستی موجودی",
        irankish_credit: "شارژ آنلاین ایران‌کیش",
        wallet_refund: "عودت وجه به حساب",
    };
    let generation = 0;
    let listGeneration = 0;
    let searchTimer = 0;
    let savingCredit = false;
    const pendingCredits = new Map();
    const refundSection = panel.querySelector("[data-wallet-refunds]");
    const refundStatus = refundSection?.querySelector("[role=status]");
    const refundRows = refundSection?.querySelector("tbody");
    let refundGeneration = 0;
    let writingRefund = false;

    /** Render the finance queue without interpreting customer or bank data as markup. */
    function renderRefunds(refunds) {
        refundRows.replaceChildren();
        const names = {pending: "در انتظار بررسی", approved: "تأیید شده، در انتظار واریز",
            paid: "واریز شده", completed: "واریز شده", rejected: "رد شده"};
        for (const refund of refunds) {
            const row = refundRows.insertRow();
            const type = refund.kind === "order" ? "لغو سفارش " + refund.number : "عودت از کیف پول";
            for (const value of [refund.customer || String(refund.customer_id), type, money(refund.amount), refund.destination || "—"]) {
                row.insertCell().textContent = value;
            }
            const actions = row.insertCell();
            actions.append(names[refund.status] || "—");
            if (refund.reference) actions.append(" · " + refund.reference);
            const addAction = (label, action, reference) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "btn2";
                button.textContent = label;
                button.addEventListener("click", () => {
                    const value = reference?.value.trim();
                    if (reference && !value) {
                        refundStatus.textContent = "شماره پیگیری واریز را وارد کنید.";
                        reference.focus();
                        return;
                    }
                    void loadRefunds({action, kind: refund.kind, customer_id: refund.customer_id,
                        request_id: refund.request_id, order_id: refund.order_id, reference: value});
                });
                actions.append(button);
            };
            if (refund.status === "pending" && refund.kind === "wallet") {
                addAction("تأیید و کسر از کیف پول", "approve");
                addAction("رد درخواست", "reject");
            } else if (refund.status === "approved" || (refund.kind === "order" && refund.status === "pending")) {
                const reference = document.createElement("input");
                reference.type = "text";
                reference.maxLength = 200;
                reference.placeholder = "شماره پیگیری واریز";
                reference.setAttribute("aria-label", reference.placeholder);
                actions.append(reference);
                addAction("ثبت واریز انجام‌شده", "paid", reference);
            }
        }
    }

    /** Keep responses scoped to the current finance session and serialize staff actions. */
    async function loadRefunds(payload) {
        if (!refundSection || !has("finance") || panel.hidden || writingRefund) return;
        const token = ++refundGeneration;
        writingRefund = Boolean(payload);
        refundStatus.textContent = "در حال دریافت درخواست‌های عودت…";
        try {
            const options = payload ? {method: "POST", headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload)} : undefined;
            const refunds = await req(endpoint + "?refunds=1", options);
            if (token !== refundGeneration) return;
            renderRefunds(refunds);
            refundStatus.textContent = refunds.length ? "" : "درخواستی برای عودت وجه ثبت نشده است.";
            if (payload?.action === "approve" && Number(customer.value) === payload.customer_id) {
                form.dispatchEvent(new Event("submit", {cancelable: true}));
            }
        } catch (error) {
            if (token === refundGeneration) refundStatus.textContent = error.message || "دریافت درخواست‌ها ناموفق بود.";
        } finally {
            writingRefund = false;
        }
    }
    refundSection?.querySelector("[data-refund-refresh]").addEventListener("click", () => void loadRefunds());

    /** Clear the previous customer's balances and movements. */
    function clear() {
        totals.replaceChildren();
        rows.replaceChildren();
        table.hidden = true;
    }

    /** Render the same report after either a read or a committed credit. */
    function renderWallet(wallet) {
        clear();
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
            const label = types[movement.source] ?? "تراکنش کیف پول";
            const description = movement.note ? label + " · " + movement.note : label;
            for (const value of [formatDate(movement.at), description, movement.number || movement.reference, money(movement.amount)]) {
                const cell = document.createElement("td");
                cell.textContent = value || "—";
                row.append(cell);
            }
            rows.append(row);
        }
        table.hidden = !wallet.transactions.length;
    }

    /** Replace the selector only for the latest search in the current staff session. */
    async function loadCustomers() {
        if (!has("finance") || panel.hidden) return;
        const request = ++listGeneration;
        const query = new URLSearchParams({q: search.value.trim()});
        status.textContent = "در حال دریافت فهرست مشتریان…";
        try {
            const customers = await req(endpoint + "?" + query);
            if (request !== listGeneration) return;
            const placeholder = customers.length ? "انتخاب مشتری" : "مشتری پیدا نشد";
            customer.replaceChildren(new Option(placeholder, ""));
            for (const entry of customers) {
                customer.add(new Option(
                    [entry.name, entry.company, entry.code].filter(Boolean).join(" · "),
                    String(entry.id),
                ));
            }
            status.textContent = customers.length ? "" : "مشتری مطابق جست‌وجو پیدا نشد.";
        } catch {
            if (request === listGeneration) status.textContent = "دریافت فهرست مشتریان ناموفق بود.";
        }
    }

    /** Clear the old recipient before offering results for a different search. */
    function queueSearch(immediate = false) {
        window.clearTimeout(searchTimer);
        listGeneration++;
        customer.replaceChildren(new Option("انتخاب مشتری", ""));
        customer.dispatchEvent(new Event("change"));
        if (immediate) void loadCustomers();
        else searchTimer = window.setTimeout(loadCustomers, 250);
    }

    search.addEventListener("input", () => queueSearch());
    search.addEventListener("keydown", event => {
        if (event.key !== "Enter" || event.isComposing) return;
        event.preventDefault();
        queueSearch(true);
    });

    customer.addEventListener("change", () => {
        generation++;
        creditForm?.reset();
        creditForm?.classList.toggle("hidden", !customer.value);
        status.textContent = "";
        clear();
    });
    panel.addEventListener("toggle", () => {
        if (panel.open && customer.options.length <= 1) void loadCustomers();
        if (panel.open) void loadRefunds();
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!has("finance") || !customer.value || savingCredit) return;
        const request = ++generation;
        clear();
        status.textContent = "در حال دریافت کیف پول…";
        try {
            const query = new URLSearchParams({customer_id: customer.value});
            const wallet = await req(endpoint + "?" + query.toString());
            if (request !== generation) return;
            renderWallet(wallet);
            status.textContent = wallet.transactions.length ? "" : "گردش کیف پولی برای این مشتری ثبت نشده است.";
        } catch {
            if (request === generation) status.textContent = "دریافت کیف پول مشتری ناموفق بود.";
        }
    });

    creditForm?.addEventListener("submit", async event => {
        event.preventDefault();
        if (!has("finance") || !customer.value || savingCredit) return;
        const localDigits = "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩";
        const digits = creditAmount.value.trim().replace(/[۰-۹٠-٩]/g, digit => String(localDigits.indexOf(digit) % 10));
        const amount = Number(digits);
        const note = creditNote.value.trim();
        if (!/^\d+$/.test(digits) || !Number.isSafeInteger(amount) || amount < 1 || !note) {
            status.textContent = "مبلغ صحیح به تومان و علت افزایش موجودی را وارد کنید.";
            return;
        }
        const customerId = Number(customer.value);
        let attempt = pendingCredits.get(customerId);
        if (attempt?.amount !== amount || attempt?.note !== note) {
            const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
            attempt = {customer_id: customerId, amount, note, request_id: requestId};
            pendingCredits.set(customerId, attempt);
        }
        const request = ++generation;
        savingCredit = true;
        for (const control of [search, customer, reportButton, creditAmount, creditNote, creditButton]) control.disabled = true;
        status.textContent = "در حال ثبت افزایش موجودی…";
        try {
            const wallet = await req(endpoint, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(attempt),
            });
            pendingCredits.delete(customerId);
            if (request !== generation) return;
            renderWallet(wallet);
            creditForm.reset();
            status.textContent = "افزایش موجودی کیف پول ثبت شد.";
        } catch (error) {
            if (request === generation) {
                const message = error instanceof Error ? error.message : "";
                status.textContent = /^[\u0600-\u06FF]/u.test(message)
                    ? message
                    : "نتیجهٔ ثبت روشن نیست. برای پیگیری همین درخواست، مبلغ و علت را تغییر ندهید و دوباره ثبت کنید.";
            }
        } finally {
            savingCredit = false;
            for (const control of [search, customer, reportButton, creditAmount, creditNote, creditButton]) control.disabled = false;
        }
    });

    const app = document.getElementById("app");
    /** Reset the report when the staff session ends or changes permissions. */
    function syncVisibility() {
        const hidden = !has("finance") || app.classList.contains("hidden");
        panel.hidden = hidden;
        if (!hidden) return;
        generation++;
        listGeneration++;
        refundGeneration++;
        refundRows?.replaceChildren();
        if (refundStatus) refundStatus.textContent = "";
        window.clearTimeout(searchTimer);
        search.value = "";
        panel.open = false;
        customer.replaceChildren(new Option("انتخاب مشتری", ""));
        creditForm?.reset();
        creditForm?.classList.add("hidden");
        pendingCredits.clear();
        status.textContent = "";
        clear();
    }
    new MutationObserver(syncVisibility).observe(app, {attributeFilter: ["class"]});
    syncVisibility();
})();

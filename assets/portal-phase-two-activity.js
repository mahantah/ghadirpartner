(() => {
    "use strict";
    const panel = document.getElementById("gpPortalActivity");
    if (!panel) return;
    const body = panel.querySelector("tbody");
    const status = panel.querySelector("[role=status]");
    const search = panel.querySelector("input");
    const filter = panel.querySelector("select");
    const refresh = panel.querySelector("button");
    const date = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tehran" });
    const number = new Intl.NumberFormat("fa-IR");
    let rows = [];
    let generation = 0;

    /** Render the current filter without issuing another request. */
    function render() {
        body.replaceChildren();
        const query = search.value.trim().replace(/ي/g, "ی").replace(/ك/g, "ک");
        for (const customer of rows) {
            const abandoned = customer.carts.filter((cart) => cart.abandoned);
            if ((query && !customer.name.replace(/ي/g, "ی").replace(/ك/g, "ک").includes(query)) ||
                (filter.value === "online" && !customer.online) ||
                (filter.value === "abandoned" && !abandoned.length)) continue;
            const products = (items) => Object.entries(items).map(([name, qty]) => name + " × " + number.format(qty)).join("، ") || "—";
            const row = body.insertRow();
            for (const item of [
                customer.name || number.format(customer.customer_id),
                customer.online ? "آنلاین" : "آفلاین",
                date.format(customer.last_seen * 1000),
                products(customer.selected),
                number.format(customer.orders),
                number.format(customer.purchases),
                customer.carts.map((cart) => (cart.channel === "android" ? "اندروید" : "وب") +
                    " · " + (cart.abandoned ? "رهاشده" : "در جریان") + " · " + products(cart.products)).join("\n") || "—",
            ]) row.insertCell().textContent = item;
        }
        if (!body.rows.length) {
            const cell = body.insertRow().insertCell();
            cell.colSpan = 7;
            cell.textContent = "فعالیتی برای این فیلتر ثبت نشده است.";
        }
    }

    /** Update the report on demand and discard a response if the session ends. */
    async function load() {
        if (refresh.disabled || !has("admin")) return;
        const request = generation;
        refresh.disabled = true;
        status.textContent = "در حال دریافت گزارش…";
        try {
            const report = await req("/api/reports/portal-activity");
            if (request !== generation || !has("admin")) return;
            rows = report.customers;
            status.textContent = number.format(rows.filter((row) => row.online).length) + " مشتری آنلاین · " +
                number.format(rows.filter((row) => row.carts.some((cart) => cart.abandoned)).length) + " مشتری با سبد رهاشده" +
                " · دورهٔ گزارش " + number.format(report.history_days) + " روز";
            render();
        } catch {
            if (request === generation) status.textContent = "دریافت گزارش فعالیت ناموفق بود.";
        } finally {
            refresh.disabled = false;
        }
    }
    refresh.addEventListener("click", load);
    search.addEventListener("input", render);
    filter.addEventListener("change", render);
    panel.addEventListener("toggle", () => { if (panel.open) void load(); });
    const update = () => {
        panel.hidden = !has("admin");
        if (!panel.hidden) return;
        generation++;
        panel.open = false;
        rows = [];
        body.replaceChildren();
        status.textContent = "";
    };
    new MutationObserver(update).observe(document.getElementById("app"), { attributes: true });
    update();
})();

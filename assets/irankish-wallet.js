(() => {
    "use strict";

    const app = document.getElementById("app");
    const panel = document.getElementById("gpIranKishWallet");
    if (!app || !panel) return;

    const endpoint = "/partners/api/wallet/irankish";
    const form = panel.querySelector("form");
    const amount = form.elements.namedItem("amount");
    const status = panel.querySelector("[role=status]");
    const balance = panel.querySelector("output");
    const list = panel.querySelector("ul");
    const format = new Intl.NumberFormat("fa-IR");
    const dateFormat = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Asia/Tehran",
    });
    let version = 0;

    /** Send wallet operations only on the authenticated portal origin. */
    async function request(data) {
        const response = await fetch(endpoint, data ? {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data),
        } : {});
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    }

    /** Refresh this customer's posted balance and recoverable payments. */
    async function refresh() {
        const current = ++version;
        if (app.classList.contains("hidden")) {
            panel.hidden = true;
            list.replaceChildren();
            balance.textContent = "";
            return;
        }
        try {
            const result = await request();
            if (current !== version) return;
            if (!result.enabled) {
                panel.hidden = true;
                return;
            }
            panel.hidden = false;
            balance.textContent = format.format(result.balance) + " تومان";
            list.replaceChildren();
            for (const payment of result.payments) {
                const row = document.createElement("li");
                const paidAt = new Date(payment.at.replace(" ", "T") + "+03:30");
                const time = Number.isNaN(paidAt.getTime()) ? "" : dateFormat.format(paidAt) + "، ";
                row.append(format.format(payment.amount) + " تومان، " + time);
                if (payment.reference) {
                    row.append("شماره پیگیری: " + payment.reference);
                } else {
                    const retry = document.createElement("button");
                    retry.type = "button";
                    retry.textContent = "بررسی وضعیت پرداخت";
                    retry.onclick = async () => {
                        retry.disabled = true;
                        try {
                            const result = await request({action: "recheck", id: payment.id});
                            if (current !== version) return;
                            status.textContent = result.credited ? "مبلغ به کیف پول اضافه شد." : "پرداخت هنوز تأیید نشده است.";
                            if (result.credited) await refresh();
                        } catch {
                            if (current === version) status.textContent = "بررسی وضعیت پرداخت ناموفق بود.";
                        } finally {
                            retry.disabled = false;
                        }
                    };
                    row.append(retry);
                }
                list.append(row);
            }
        } catch {
            if (current === version) panel.hidden = true;
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const digits = "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩";
        const normalized = amount.value.trim().replace(/[۰-۹٠-٩]/g, digit => String(digits.indexOf(digit) % 10));
        const tomans = Number(normalized);
        if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(tomans) || tomans < 1) {
            status.textContent = "مبلغ درست به تومان وارد کنید.";
            return;
        }
        const current = version;
        const button = form.querySelector('button[type="submit"]');
        if (button.disabled) return;
        button.disabled = true;
        try {
            const payment = await request({action: "start", amount: tomans});
            if (current !== version) return;
            const target = document.createElement("form");
            target.method = "POST";
            target.action = payment.url;
            const token = document.createElement("input");
            token.type = "hidden";
            token.name = "tokenIdentity";
            token.value = payment.token;
            target.append(token);
            document.body.append(target);
            target.submit();
        } catch {
            if (current === version) status.textContent = "اتصال به درگاه انجام نشد. مبلغ و وضعیت درگاه را بررسی کنید.";
        } finally {
            button.disabled = false;
        }
    });

    const result = new URLSearchParams(location.search).get("wallet");
    if (result === "return") status.textContent = "نتیجهٔ پرداخت را در فهرست شارژها بررسی کنید.";
    new MutationObserver(() => void refresh()).observe(app, {attributeFilter: ["class"]});
    void refresh();
})();

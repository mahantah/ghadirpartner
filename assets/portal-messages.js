(() => {
    "use strict";
    const panel = document.getElementById("gpPortalMessages");
    if (!panel) return;
    const form = panel.querySelector("form");
    const recipients = form.elements.namedItem("recipients");
    const status = panel.querySelector("[role=status]");
    const history = panel.querySelector("tbody");
    const smsLabels = { off: "—", queued: "در صف", sending: "در حال ارسال", accepted: "پذیرفته‌شده توسط هما", failed: "ناموفق", unavailable: "بدون شمارهٔ معتبر" };
    let pending = null;
    let generation = 0;

    const post = (url, body) => req(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    function visibility() {
        const hide = !has("admin");
        if (hide && !panel.hidden) {
            generation++;
            pending = null;
            form.reset();
            recipients.replaceChildren();
            history.replaceChildren();
            status.textContent = "";
            panel.open = false;
        }
        panel.hidden = hide;
    }

    async function loadHistory() {
        const request = generation;
        const rows = await req("/api/portal-messages");
        if (request !== generation) return;
        history.replaceChildren();
        for (const message of rows) {
            for (const target of Object.values(message.targets)) {
                const row = history.insertRow();
                for (const field of [
                    message.title, target.name, message.app ? (target.read_at ? "خوانده شد" : "خوانده نشده") : "—",
                    smsLabels[target.sms] ?? "—",
                ]) row.insertCell().textContent = field;
            }
        }
    }

    panel.addEventListener("toggle", async () => {
        if (!panel.open || panel.hidden) return;
        const request = generation;
        try {
            const rows = await req("/api/portal-messages/recipients");
            if (request !== generation) return;
            recipients.replaceChildren(...rows.map((row) => new Option(row.name + (row.mobile ? " · " + row.mobile : ""), row.id)));
            await loadHistory();
        } catch {
            if (request === generation) status.textContent = "دریافت اطلاعات ارسال ناموفق بود.";
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button[type=submit]");
        if (button.disabled || !has("admin")) return;
        const audience = [...recipients.selectedOptions];
        const payload = {
            title: form.elements.namedItem("title").value.trim(),
            body: form.elements.namedItem("body").value.trim(),
            recipients: audience.map((option) => Number(option.value)),
            app: form.elements.namedItem("app").checked,
            sms: form.elements.namedItem("sms").checked,
        };
        if (!payload.app && !payload.sms) {
            status.textContent = "حداقل یک مسیر ارسال را انتخاب کنید.";
            return;
        }
        if (!window.confirm("ارسال به " + audience.length.toLocaleString("fa-IR") + " مشتری انجام شود؟")) return;
        const key = JSON.stringify(payload);
        if (pending?.key !== key) {
            const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
            pending = { key, id };
        }
        const request = generation;
        button.disabled = true;
        status.textContent = "در حال ثبت ارسال…";
        try {
            const message = await post("/api/portal-messages", { ...payload, id: pending.id });
            for (const target of Object.values(message.targets)) {
                if (request !== generation) return;
                if (target.sms === "queued") {
                    status.textContent = "در حال ارسال پیامک…";
                    await post("/api/portal-messages/sms", { id: message.id, customer_id: target.id });
                }
            }
            if (request !== generation) return;
            pending = null;
            form.reset();
            status.textContent = "ارسال ثبت شد. نتیجهٔ هر گیرنده در جدول آمده است.";
            await loadHistory();
        } catch {
            if (request === generation) status.textContent = "ارتباط کامل نشد. برای ادامه همین ارسال، دوباره دکمهٔ ارسال را بزنید.";
        } finally {
            button.disabled = false;
        }
    });
    new MutationObserver(visibility).observe(document.getElementById("app"), { attributes: true });
    visibility();
})();

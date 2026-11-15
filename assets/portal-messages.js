(() => {
    "use strict";
    const panel = document.getElementById("gpPortalMessages");
    if (!panel) return;
    const form = panel.querySelector("form");
    const oldPicker = form.elements.namedItem("recipients").closest("label");
    const recipients = document.createElement("fieldset");
    recipients.className = "gp-message-recipients";
    const legend = document.createElement("legend");
    legend.textContent = "گیرندگان";
    const all = document.createElement("input");
    all.type = "checkbox";
    const allLabel = document.createElement("label");
    allLabel.append(all, " انتخاب همهٔ مشتریان");
    const options = document.createElement("div");
    options.className = "gp-message-recipient-options";
    recipients.append(legend, allLabel, options);
    oldPicker.replaceWith(recipients);
    const status = panel.querySelector("[role=status]");
    const history = panel.querySelector("tbody");
    const smsLabels = { off: "—", queued: "در صف", sending: "در حال ارسال", accepted: "پذیرفته‌شده توسط هما", failed: "ناموفق", unavailable: "بدون شمارهٔ معتبر" };
    let pending = null;
    let generation = 0;
    let allRecipients = [];
    let batchSize = 0;
    let templates = [];
    const chosen = new Set();
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "نام یا شماره همراه";
    search.setAttribute("aria-label", "جست‌وجوی مشتری");
    recipients.before(search);
    const saved = document.createElement("select");
    saved.setAttribute("aria-label", "پیام‌های آماده");
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "ذخیره به‌عنوان پیام آماده";
    const count = document.createElement("small");
    search.before(saved, save);
    recipients.after(count);
    const digits = (text) => text.replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) & 15));
    const normalize = (text) => digits(text).toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").trim();

    /** Keep the selected audience when filtering by name or mobile. */
    function updateSelection() {
        all.disabled = allRecipients.length === 0;
        all.checked = !all.disabled && chosen.size === allRecipients.length;
        all.indeterminate = chosen.size > 0 && !all.checked;
        count.textContent = chosen.size.toLocaleString("fa-IR") + " گیرنده انتخاب شده";
    }

    /** Render independently selectable customer rows. */
    function renderRecipients() {
        const query = normalize(search.value);
        const rows = allRecipients.filter((row) => normalize(row.name + " " + row.mobile).includes(query));
        const fragment = document.createDocumentFragment();
        for (const row of rows) {
            const choice = document.createElement("input");
            choice.type = "checkbox";
            choice.value = String(row.id);
            choice.checked = chosen.has(Number(row.id));
            const label = document.createElement("label");
            label.append(choice, " " + row.name + (row.mobile ? " · " + row.mobile : ""));
            fragment.append(label);
        }
        options.replaceChildren(fragment);
        updateSelection();
    }

    all.addEventListener("change", () => {
        chosen.clear();
        if (all.checked) for (const row of allRecipients) chosen.add(Number(row.id));
        renderRecipients();
    });
    options.addEventListener("change", (event) => {
        const choice = event.target;
        if (choice.checked) chosen.add(Number(choice.value));
        else chosen.delete(Number(choice.value));
        updateSelection();
    });
    search.addEventListener("input", renderRecipients);

    const post = (url, body) => req(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    function renderTemplates(rows) {
        templates = rows;
        saved.replaceChildren(new Option("پیام‌های آماده", ""), ...rows.map((row, index) => new Option(row.title, index)));
    }
    saved.addEventListener("change", () => {
        if (saved.value === "") return;
        const template = templates[Number(saved.value)];
        form.elements.namedItem("title").value = template.title;
        form.elements.namedItem("body").value = template.body;
    });
    save.addEventListener("click", async () => {
        const request = generation;
        save.disabled = true;
        try {
            const rows = await post("/api/portal-messages/templates", {
                title: form.elements.namedItem("title").value,
                body: form.elements.namedItem("body").value,
            });
            if (request !== generation) return;
            renderTemplates(rows);
            status.textContent = "پیام آماده ذخیره شد.";
        } catch {
            if (request === generation) status.textContent = "ذخیره انجام نشد. عنوان و متن را بررسی کنید.";
        } finally {
            save.disabled = false;
        }
    });

    function visibility() {
        const hide = !has("admin");
        if (hide && !panel.hidden) {
            generation++;
            pending = null;
            chosen.clear();
            allRecipients = [];
            search.value = "";
            renderTemplates([]);
            renderRecipients();
            form.reset();
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
            const [rows, drafts] = await Promise.all([
                req("/api/portal-messages/recipients?with_limit=1"), req("/api/portal-messages/templates"),
            ]);
            if (request !== generation) return;
            allRecipients = rows.recipients;
            batchSize = rows.max_recipients;
            const eligible = new Set(allRecipients.map((row) => Number(row.id)));
            for (const id of chosen) if (!eligible.has(id)) chosen.delete(id);
            renderRecipients();
            renderTemplates(drafts);
            await loadHistory();
        } catch {
            if (request === generation) status.textContent = "دریافت اطلاعات ارسال ناموفق بود.";
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button[type=submit]");
        if (button.disabled || !has("admin")) return;
        const audience = [...chosen].sort((a, b) => a - b);
        if (!audience.length) {
            status.textContent = "دست‌کم یک مشتری انتخاب کنید.";
            return;
        }
        const payload = {
            title: form.elements.namedItem("title").value.trim(),
            body: form.elements.namedItem("body").value.trim(),
            recipients: audience,
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
            if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
                status.textContent = "فهرست گیرندگان را دوباره باز کنید.";
                return;
            }
            const batches = [];
            for (let offset = 0; offset < audience.length; offset += batchSize) {
                const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
                batches.push({ ...payload, recipients: audience.slice(offset, offset + batchSize), id });
            }
            pending = { key, batches };
        }
        const batches = pending.batches;
        const request = generation;
        button.disabled = true;
        status.textContent = "در حال ثبت ارسال…";
        try {
            for (const batch of batches) {
                if (request !== generation) return;
                const message = await post("/api/portal-messages", batch);
                for (const target of Object.values(message.targets)) {
                    if (request !== generation) return;
                    if (target.sms === "queued") {
                        status.textContent = "در حال ارسال پیامک…";
                        await post("/api/portal-messages/sms", { id: message.id, customer_id: target.id });
                    }
                }
            }
            if (request !== generation) return;
            pending = null;
            form.reset();
            chosen.clear();
            search.value = "";
            renderRecipients();
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

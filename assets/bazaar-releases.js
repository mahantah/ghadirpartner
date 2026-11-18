"use strict";
(() => {
    /** Keep the session CSRF token private to this authenticated page instance. */
    class BazaarClient {
        constructor() {
            this.csrf = "";
            this.endpoint = "/api/admin/app-releases";
        }
        /** Load local history without contacting the Bazaar service. */
        async summary() {
            const value = await this.request(this.endpoint);
            this.csrf = value.csrf;
            return value;
        }
        /** Execute an explicitly requested admin action. */
        async action(action, values = {}) {
            return this.request(this.endpoint, { action, ...values });
        }
        /** Upload a bounded binary chunk under the same authenticated CSRF contract. */
        async chunk(id, offset, bytes) {
            const form = new FormData();
            form.set("id", id);
            form.set("offset", String(offset));
            form.set("chunk", bytes, "chunk.bin");
            return this.request(this.endpoint + "/chunk", form);
        }
        async request(path, payload) {
            const options = {
                cache: "no-store",
                credentials: "same-origin",
            };
            if (payload !== undefined) {
                options.method = "POST";
                options.headers = { "X-GP-Release-CSRF": this.csrf };
                if (payload instanceof FormData)
                    options.body = payload;
                else {
                    options.headers["Content-Type"] = "application/json";
                    options.body = JSON.stringify(payload);
                }
            }
            const response = await fetch(path, options);
            const raw = await response.text();
            let value = null;
            try {
                value = JSON.parse(raw);
            }
            catch {
                /* The existing automation returns text for rejected requests. */
            }
            if (!response.ok) {
                const candidate = typeof value === "object" &&
                    value !== null &&
                    "error" in value &&
                    typeof value.error === "string"
                    ? value.error
                    : raw;
                const message = candidate.length > 0 &&
                    candidate.length <= 500 &&
                    !/[<>]/.test(candidate)
                    ? candidate
                    : "عملیات انجام نشد؛ دوباره وضعیت را بررسی کنید.";
                throw new Error(message);
            }
            if (value === null)
                throw new Error("پاسخ سرور قابل پردازش نیست؛ وضعیت را دوباره بررسی کنید.");
            return value;
        }
    }
    /** Provide a compact RTL release page under the administrator's system settings menu. */
    class BazaarPage {
        constructor(app, menu, client) {
            this.app = app;
            this.client = client;
            this.page = document.createElement("section");
            this.link = document.createElement("button");
            this.status = document.createElement("p");
            this.history = document.createElement("div");
            this.remote = document.createElement("div");
            this.tokenHint = document.createElement("p");
            this.progress = document.createElement("progress");
            this.controls = document.createElement("fieldset");
            this.uploadForm = document.createElement("form");
            this.tokenForm = document.createElement("form");
            this.summary = null;
            this.busy = false;
            this.generation = 0;
            this.page.id = "gpAppReleasesPage";
            this.page.className = "tab hidden gp-app-releases";
            this.page.dir = "rtl";
            this.link.type = "button";
            this.link.className = "adminOnly hidden";
            this.link.dataset.gpAppReleases = "";
            this.link.setAttribute("aria-controls", this.page.id);
            const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            icon.setAttribute("viewBox", "0 0 24 24");
            icon.setAttribute("aria-hidden", "true");
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", "M8 3h8v18H8zM10 18h4M3 10l3-3 3 3M6 7v9m9-2 3 3 3-3m-3 3V8");
            icon.append(path);
            icon.classList.add("gp-menu-icon");
            const label = this.text("span", "مدیریت نسخه‌های اپ");
            label.className = "gp-menu-text";
            this.link.append(icon, label);
            menu.append(this.link);
            const workspace = this.app.querySelector(".tab")?.parentElement ?? this.app;
            workspace.append(this.page);
        }
        /** Mount the forms once and forget all loaded state when the admin session ends. */
        mount() {
            const heading = this.text("h2", "مدیریت نسخه‌های اپ");
            this.status.setAttribute("role", "status");
            this.status.setAttribute("aria-live", "polite");
            this.controls.className = "gp-release-controls";
            const tokenCard = this.card("اتصال به API پیشخان بازار");
            const token = this.input("token", "password", "توکن API برنامه در بازار");
            token.autocomplete = "new-password";
            token.maxLength = 8192;
            this.tokenForm.append(this.label("توکن برنامهٔ قدیر پارتنر", token), this.button("ذخیره توکن"));
            this.tokenForm.addEventListener("submit", (event) => {
                event.preventDefault();
                void this.run(async () => {
                    await this.client.action("save_token", { token: token.value });
                    token.value = "";
                    await this.load();
                    this.status.textContent = "توکن در سرور ذخیره شد.";
                });
            });
            tokenCard.append(this.tokenHint, this.tokenForm, this.text("p", "توکن را از برنامهٔ قدیر پارتنر در پیشخان بازار ← API پیشخان بازار دریافت کنید. مقدار ذخیره‌شده دوباره نمایش داده نمی‌شود."));
            const uploadCard = this.card("بارگذاری نسخهٔ جدید");
            const file = this.input("apk", "file", "انتخاب فایل APK");
            file.accept = ".apk";
            file.required = true;
            const fa = document.createElement("textarea");
            fa.name = "changelog_fa";
            fa.required = true;
            fa.rows = 3;
            const en = document.createElement("textarea");
            en.name = "changelog_en";
            en.rows = 2;
            en.dir = "ltr";
            const note = document.createElement("textarea");
            note.name = "developer_note";
            note.rows = 2;
            this.progress.max = 100;
            this.progress.value = 0;
            this.progress.hidden = true;
            this.progress.setAttribute("aria-label", "پیشرفت بارگذاری فایل APK");
            this.uploadForm.append(this.label("فایل APK امضاشده", file), this.label("توضیحات فارسی نسخه", fa), this.label("توضیحات انگلیسی ـ اختیاری", en), this.label("یادداشت برای تیم بررسی بازار ـ اختیاری", note), this.progress, this.button("بارگذاری و بررسی فایل"));
            this.uploadForm.addEventListener("submit", (event) => {
                event.preventDefault();
                void this.run(() => this.upload(file, fa, en, note));
            });
            uploadCard.append(this.text("p", "نام بسته، شمارهٔ نسخه، امضای دیجیتال و سلامت کامل فایل بررسی می‌شوند. پس از بارگذاری، روش ارسال به بازار را از کارت نسخه انتخاب کنید."), this.uploadForm);
            const historyCard = this.card("نسخه‌ها و نتیجهٔ ارسال");
            const refresh = this.button("بررسی وضعیت در بازار", () => this.run(async () => {
                const result = await this.client.action("refresh");
                this.remote.replaceChildren();
                for (const [key, title] of [
                    ["draft", "پیش‌نویس"],
                    ["committed", "ارسال‌شده برای بررسی"],
                    ["published", "منتشرشده"],
                ]) {
                    if (!key)
                        continue;
                    this.remote.append(this.text("p", `${title}: ${result[key]?.packages.map((p) => `${p.version_name ?? ""} (${p.version_code ?? ""})`).join("، ") || "وجود ندارد"}`));
                }
                this.status.textContent = "وضعیت بازار دریافت شد.";
            }));
            historyCard.append(refresh, this.remote, this.history);
            this.controls.append(tokenCard, uploadCard, historyCard);
            this.page.append(heading, this.status, this.controls);
            this.link.addEventListener("click", (event) => {
                event.stopPropagation();
                if (!this.admin())
                    return;
                document
                    .querySelectorAll(".tab")
                    .forEach((tab) => tab.classList.add("hidden"));
                this.page.classList.remove("hidden");
                document
                    .querySelectorAll(".topnav [data-tab]")
                    .forEach((button) => button.classList.remove("active"));
                this.link.classList.add("active");
                if (typeof setSidebar === "function")
                    setSidebar(false);
                void this.run(() => this.load());
            });
            const update = () => {
                const allowed = this.admin();
                this.link.classList.toggle("hidden", !allowed);
                if (!allowed) {
                    this.generation++;
                    this.page.classList.add("hidden");
                    this.summary = null;
                    this.history.replaceChildren();
                    this.remote.replaceChildren();
                    this.status.textContent = "";
                    token.value = "";
                    this.uploadForm.reset();
                }
            };
            new MutationObserver(update).observe(this.app, { attributes: true });
            update();
        }
        async load() {
            const generation = this.generation;
            const summary = await this.client.summary();
            if (generation !== this.generation || !this.admin())
                return;
            this.summary = summary;
            this.tokenHint.textContent = summary.token_configured
                ? "توکن بازار تنظیم شده است."
                : "برای ارسال به بازار، ابتدا توکن را وارد کنید. بارگذاری و بررسی فایل بدون توکن هم ممکن است.";
            if (summary.environment_token)
                this.tokenHint.textContent +=
                    " توکن فعال از تنظیمات محیط سرور خوانده می‌شود.";
            for (const field of this.uploadForm.querySelectorAll("textarea"))
                field.maxLength = summary.policy.maximum_changelog_chars;
            this.renderHistory();
            if (!summary.ready)
                throw new Error("ابزار بررسی امضای APK روی سرور آماده نیست؛ افزونه‌های OpenSSL، iconv و zlib را بررسی کنید.");
            if (!summary.network_ready)
                this.status.textContent =
                    "بارگذاری محلی آماده است؛ برای ارتباط با بازار باید cURL روی سرور فعال باشد.";
        }
        async upload(input, fa, en, note) {
            const file = input.files?.[0];
            const summary = this.summary;
            if (!file ||
                !summary ||
                !file.name.toLowerCase().endsWith(".apk") ||
                file.size > summary.policy.maximum_apk_bytes)
                throw new Error("فایل APK با اندازهٔ مجاز انتخاب کنید.");
            const generation = this.generation;
            this.status.textContent = "در حال آماده‌سازی فایل…";
            const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
            const sha256 = Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
            let current = await this.client.action("start", {
                bytes: file.size,
                sha256,
                changelog_fa: fa.value,
                changelog_en: en.value,
                developer_note: note.value,
            });
            this.progress.hidden = false;
            while (current.received < file.size) {
                if (generation !== this.generation || !this.admin())
                    throw new Error("نشست مدیریت پایان یافته است.");
                const before = current.received;
                current = await this.client.chunk(current.id, before, file.slice(before, before + summary.policy.chunk_bytes));
                if (current.received <= before || current.received > file.size)
                    throw new Error("پاسخ بارگذاری معتبر نیست.");
                this.progress.value = Math.round((100 * current.received) / file.size);
                this.status.textContent = `بارگذاری فایل: ${new Intl.NumberFormat("fa-IR").format(this.progress.value)}٪`;
            }
            this.status.textContent = "در حال بررسی امضا و نسخهٔ APK…";
            await this.client.action("finish", { id: current.id });
            await this.load();
            this.status.textContent =
                "فایل تأیید شد. برای ارسال به بازار، روش دلخواه را از کارت نسخه انتخاب کنید.";
        }
        renderHistory() {
            this.history.replaceChildren();
            if (!this.summary?.releases.length) {
                this.history.append(this.text("p", "هنوز نسخه‌ای بارگذاری نشده است."));
                return;
            }
            const titles = {
                receiving: "بارگذاری ناتمام",
                ready: "آمادهٔ ارسال",
                draft: "پیش‌نویس در بازار",
                submitted: "ارسال‌شده برای بررسی",
                published: "منتشرشده",
                working: "نیازمند بررسی نتیجه",
                error: "نیازمند بررسی",
                expired: "بارگذاری منقضی‌شده",
            };
            for (const row of this.summary.releases) {
                const card = document.createElement("article");
                card.className = "gp-release-item";
                card.append(this.text("h4", row.version_name ?? "فایل در حال بارگذاری"), this.text("p", `${titles[row.state] ?? row.state} · ${new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at))}`));
                if (row.version_code)
                    card.append(this.text("p", `کد نسخه: ${row.version_code} · حجم: ${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(row.bytes / 1048576)} مگابایت`));
                if (row.auto_publish)
                    card.append(this.text("p", "انتشار خودکار پس از تأیید بازار فعال است."));
                if (row.error) {
                    const error = this.text("p", row.error);
                    error.className = "gp-release-error";
                    card.append(error);
                }
                const actions = document.createElement("div");
                actions.className = "gp-release-actions";
                if (row.sha256 &&
                    !row.file_removed &&
                    !["submitted", "published"].includes(row.state)) {
                    for (const [mode, label] of [
                        ["draft", "ذخیره پیش‌نویس در بازار"],
                        ["review", "ارسال برای بررسی"],
                        ["publish", "بررسی و انتشار خودکار"],
                    ]) {
                        if (!mode || !label)
                            continue;
                        const action = this.button(label, () => this.run(async () => {
                            this.status.textContent =
                                "در حال ارتباط با بازار؛ این صفحه را باز نگه دارید…";
                            await this.client.action(mode, { id: row.id });
                            await this.load();
                            this.status.textContent =
                                mode === "draft"
                                    ? "پیش‌نویس در بازار ذخیره شد."
                                    : "نسخه برای بررسی بازار ارسال شد.";
                        }));
                        action.disabled =
                            !this.summary.token_configured || !this.summary.network_ready;
                        actions.append(action);
                    }
                }
                if (!row.file_removed)
                    actions.append(this.button("حذف فایل محلی", () => this.run(async () => {
                        await this.client.action("remove_file", { id: row.id });
                        await this.load();
                        this.status.textContent =
                            "فایل از سرور اتوماسیون حذف شد؛ سابقه و وضعیت بازار تغییر نکرد.";
                    })));
                card.append(actions);
                this.history.append(card);
            }
        }
        admin() {
            return typeof has === "function" && Boolean(has("admin"));
        }
        text(tag, value) {
            const element = document.createElement(tag);
            element.textContent = value;
            return element;
        }
        card(title) {
            const card = document.createElement("section");
            card.className = "card gp-release-card";
            card.append(this.text("h3", title));
            return card;
        }
        input(name, type, label) {
            const input = document.createElement("input");
            input.type = type;
            input.name = name;
            input.setAttribute("aria-label", label);
            return input;
        }
        label(text, input) {
            const label = document.createElement("label");
            label.append(this.text("span", text), input);
            return label;
        }
        button(text, action) {
            const button = this.text("button", text);
            button.type = action ? "button" : "submit";
            button.className = "btn2";
            if (action)
                button.addEventListener("click", () => {
                    void action();
                });
            return button;
        }
        async run(operation) {
            if (this.busy || !this.admin())
                return;
            this.busy = true;
            this.controls.disabled = true;
            this.page.setAttribute("aria-busy", "true");
            const generation = this.generation;
            try {
                await operation();
            }
            catch (error) {
                if (generation === this.generation && this.admin())
                    this.status.textContent =
                        error instanceof Error
                            ? error.message
                            : "عملیات انجام نشد؛ دوباره وضعیت را بررسی کنید.";
            }
            finally {
                this.busy = false;
                this.controls.disabled = false;
                this.page.removeAttribute("aria-busy");
            }
        }
    }
    const app = document.getElementById("app");
    const menu = document.querySelector("#gpSystem .nav-submenu");
    if (app && menu && !document.getElementById("gpAppReleasesPage"))
        new BazaarPage(app, menu, new BazaarClient()).mount();
})();

"use strict";
(() => {
    /** Load and update the customer consignment register through its own staff endpoint. */
    class ConsignmentPage {
        constructor(panel, app) {
            this.panel = panel;
            this.app = app;
            this.path = "/api/customer-consignments";
            this.formatter = new Intl.NumberFormat("fa-IR");
            this.attempts = new Map();
            this.records = [];
            this.customers = [];
            this.products = [];
            this.selected = null;
            this.generation = 0;
            this.pending = false;
            this.send = this.require("[data-consignment-send]");
            this.returned = this.require("[data-consignment-return]");
            this.rows = this.require("tbody");
            this.status = this.require("[role=status]");
        }
        /** Load the register when staff members open it, and drop it when the session ends. */
        start() {
            this.panel.addEventListener("toggle", () => {
                if (this.panel.open)
                    void this.load();
            });
            this.require("[data-consignment-refresh]").addEventListener("click", () => void this.load());
            this.require("[data-consignment-cancel]").addEventListener("click", () => this.closeReturn());
            this.send.addEventListener("submit", (event) => {
                event.preventDefault();
                void this.save(this.send);
            });
            this.returned.addEventListener("submit", (event) => {
                event.preventDefault();
                void this.save(this.returned);
            });
            for (const input of this.send.querySelectorAll("input[type=search]")) {
                input.addEventListener("input", () => this.filterOptions());
                input.addEventListener("keydown", (event) => {
                    if (event.key === "Enter" && !event.isComposing)
                        event.preventDefault();
                });
            }
            this.require("[data-consignment-filter]").addEventListener("input", () => this.render());
            new MutationObserver(() => this.visibility()).observe(this.app, {
                attributeFilter: ["class"],
            });
            this.visibility();
        }
        require(selector) {
            const element = this.panel.querySelector(selector);
            if (!element)
                throw new Error("فرم ثبت امانی ناقص است.");
            return element;
        }
        visibility() {
            const hidden = this.app.classList.contains("hidden") ||
                (!has("admin") && !has("sales"));
            if (this.panel.hidden === hidden)
                return;
            this.panel.hidden = hidden;
            if (!hidden)
                return;
            this.generation++;
            this.panel.open = false;
            this.records = [];
            this.customers = [];
            this.products = [];
            this.require("[data-consignment-filter]").value = "";
            this.attempts.clear();
            this.send.reset();
            this.fill("customer_id", [], "انتخاب مشتری");
            this.fill("product", [], "انتخاب کالا");
            this.closeReturn();
            this.rows.replaceChildren();
            this.status.textContent = "";
        }
        async load() {
            if (this.pending || this.panel.hidden)
                return;
            const generation = ++this.generation;
            this.status.textContent = "در حال دریافت کالاهای امانی…";
            try {
                const report = (await req(this.path));
                if (generation !== this.generation)
                    return;
                this.customers = report.customers;
                this.products = report.products;
                this.filterOptions();
                this.records = report.records;
                this.render();
                this.status.textContent = this.records.length
                    ? ""
                    : "هنوز کالای امانی ثبت نشده است.";
            }
            catch {
                if (generation === this.generation)
                    this.status.textContent = "دریافت کالاهای امانی ناموفق بود.";
            }
        }
        /** Normalize Persian and Arabic spellings and digits before matching a visible label. */
        searchKey(value) {
            return value
                .normalize("NFKC")
                .toLowerCase()
                .replace(/[يك]/g, (letter) => (letter === "ي" ? "ی" : "ک"))
                .replace(/[۰-۹٠-٩]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10))
                .replace(/[\s\u200c]+/g, " ")
                .trim();
        }
        filterOptions() {
            const customer = this.searchKey(this.require("[data-consignment-customer-search]")
                .value);
            const product = this.searchKey(this.require("[data-consignment-product-search]")
                .value);
            const people = this.customers
                .filter(({ name, code }) => this.searchKey(name + " " + code).includes(customer))
                .map(({ id, name, code }) => [
                String(id),
                code ? name + " · " + code : name,
            ]);
            const goods = this.products
                .filter((name) => this.searchKey(name).includes(product))
                .map((name) => [name, name]);
            this.fill("customer_id", people, customer && !people.length ? "مشتری پیدا نشد" : "انتخاب مشتری");
            this.fill("product", goods, product && !goods.length ? "کالا پیدا نشد" : "انتخاب کالا");
        }
        fill(field, rows, placeholder) {
            const select = this.send.elements.namedItem(field);
            const previous = select.value;
            select.replaceChildren(new Option(placeholder, ""), ...rows.map(([value, name]) => new Option(name, value)));
            select.value = rows.some(([value]) => value === previous) ? previous : "";
        }
        render() {
            this.rows.replaceChildren();
            const query = this.searchKey(this.require("[data-consignment-filter]").value);
            const matches = this.records.filter((record) => this.searchKey(record.customer_name + " " + record.product).includes(query));
            if (query && !matches.length) {
                const row = document.createElement("tr");
                const cell = row.insertCell();
                cell.colSpan = 8;
                cell.textContent = "ثبت امانی مطابق جست‌وجو پیدا نشد.";
                this.rows.append(row);
            }
            for (const record of matches) {
                const row = document.createElement("tr");
                for (const value of [
                    record.customer_name,
                    record.product,
                    this.date(record.at),
                    this.formatter.format(record.quantity),
                    this.formatter.format(record.quantity - record.remaining),
                    this.formatter.format(record.remaining),
                ])
                    row.insertCell().textContent = value;
                const history = document.createElement("details");
                const heading = document.createElement("summary");
                heading.textContent = "سوابق";
                history.append(heading);
                for (const movement of [
                    { ...record, label: "تحویل" },
                    ...Object.values(record.returns).map((event) => ({
                        ...event,
                        label: "برگشت",
                    })),
                ]) {
                    const item = document.createElement("p");
                    item.textContent = [
                        movement.label,
                        this.formatter.format(movement.quantity),
                        this.date(movement.at),
                        movement.note,
                    ]
                        .filter(Boolean)
                        .join(" · ");
                    history.append(item);
                }
                row.insertCell().append(history);
                const action = row.insertCell();
                if (record.remaining === 0) {
                    action.textContent = "کامل برگشته";
                }
                else {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "btn2";
                    button.textContent = "ثبت برگشت";
                    button.addEventListener("click", () => this.openReturn(record));
                    action.append(button);
                }
                this.rows.append(row);
            }
        }
        date(value) {
            return jalaliDateTime(value).replace(/\d/g, (digit) => this.formatter.format(Number(digit)));
        }
        openReturn(record) {
            if (this.pending)
                return;
            this.selected = record;
            this.returned.reset();
            this.returned.classList.remove("hidden");
            this.require("[data-consignment-recipient]").textContent =
                record.customer_name +
                    " · " +
                    record.product +
                    " · مانده " +
                    this.formatter.format(record.remaining);
            const quantity = this.returned.elements.namedItem("quantity");
            quantity.focus();
        }
        closeReturn() {
            this.selected = null;
            this.returned.reset();
            this.returned.classList.add("hidden");
        }
        async save(form) {
            if (this.pending || this.panel.hidden)
                return;
            const data = new FormData(form);
            const quantityText = String(data.get("quantity") ?? "")
                .trim()
                .replace(/[۰-۹٠-٩]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10));
            const quantity = Number(quantityText);
            if (!/^\d+$/.test(quantityText) ||
                !Number.isSafeInteger(quantity) ||
                quantity < 1) {
                this.status.textContent = "تعداد را به‌صورت عدد صحیح وارد کنید.";
                return;
            }
            const selected = form === this.returned ? this.selected : null;
            if (form === this.returned && !selected)
                return;
            const common = { quantity, note: String(data.get("note") ?? "").trim() };
            const payload = selected
                ? { ...common, action: "return", id: selected.id }
                : {
                    ...common,
                    action: "send",
                    customer_id: Number(data.get("customer_id")),
                    product: String(data.get("product") ?? ""),
                };
            const fingerprint = JSON.stringify(payload);
            const key = this.attempts.get(fingerprint) ?? crypto.randomUUID().replace(/-/g, "");
            this.attempts.set(fingerprint, key);
            this.pending = true;
            const generation = ++this.generation;
            const buttons = this.panel.querySelectorAll("button");
            buttons.forEach((button) => {
                button.disabled = true;
            });
            this.status.textContent = "در حال ثبت…";
            try {
                const record = (await req(this.path, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...payload, request_id: key }),
                }));
                if (generation !== this.generation)
                    return;
                this.attempts.delete(fingerprint);
                const index = this.records.findIndex((entry) => entry.id === record.id);
                if (index < 0)
                    this.records.unshift(record);
                else
                    this.records.splice(index, 1, record);
                form.reset();
                if (form === this.send)
                    this.filterOptions();
                this.closeReturn();
                this.render();
                this.status.textContent = selected
                    ? "برگشت کالا ثبت شد."
                    : "تحویل کالای امانی ثبت شد.";
            }
            catch (error) {
                if (generation === this.generation) {
                    this.status.textContent =
                        error instanceof Error ? error.message : "ثبت عملیات ممکن نشد.";
                }
            }
            finally {
                this.pending = false;
                buttons.forEach((button) => {
                    button.disabled = false;
                });
                if (generation !== this.generation &&
                    this.panel.open &&
                    !this.panel.hidden)
                    void this.load();
            }
        }
    }
    const panel = document.getElementById("gpCustomerConsignments");
    const app = document.getElementById("app");
    if (panel instanceof HTMLDetailsElement && app)
        new ConsignmentPage(panel, app).start();
})();

/** Use the automation's same-origin session transport and Jalali date display. */
declare function req(path: string, options?: RequestInit): Promise<unknown>;
declare function has(role: string): boolean;
declare function jalaliDateTime(value: string): string;

(() => {
  interface Movement {
    quantity: number;
    note: string;
    at: string;
  }
  interface Consignment extends Movement {
    id: string;
    customer_name: string;
    product: string;
    remaining: number;
    returns: Record<string, Movement>;
  }
  interface Report {
    customers: { id: number; name: string; code: string }[];
    products: string[];
    records: Consignment[];
  }

  /** Load and update the customer consignment register through its own staff endpoint. */
  class ConsignmentPage {
    private readonly path = "/api/customer-consignments";
    private readonly send: HTMLFormElement;
    private readonly returned: HTMLFormElement;
    private readonly rows: HTMLElement;
    private readonly status: HTMLElement;
    private readonly formatter = new Intl.NumberFormat("fa-IR");
    private readonly attempts = new Map<string, string>();
    private records: Consignment[] = [];
    private customers: Report["customers"] = [];
    private products: string[] = [];
    private selected: Consignment | null = null;
    private generation = 0;
    private pending = false;

    constructor(
      private readonly panel: HTMLDetailsElement,
      private readonly app: HTMLElement,
    ) {
      this.send = this.require<HTMLFormElement>("[data-consignment-send]");
      this.returned = this.require<HTMLFormElement>(
        "[data-consignment-return]",
      );
      this.rows = this.require("tbody");
      this.status = this.require("[role=status]");
    }

    /** Load the register when staff members open it, and drop it when the session ends. */
    start(): void {
      this.panel.addEventListener("toggle", () => {
        if (this.panel.open) void this.load();
      });
      this.require("[data-consignment-refresh]").addEventListener(
        "click",
        () => void this.load(),
      );
      this.require("[data-consignment-cancel]").addEventListener("click", () =>
        this.closeReturn(),
      );
      this.send.addEventListener("submit", (event) => {
        event.preventDefault();
        void this.save(this.send);
      });
      this.returned.addEventListener("submit", (event) => {
        event.preventDefault();
        void this.save(this.returned);
      });
      for (const input of this.send.querySelectorAll<HTMLInputElement>(
        "input[type=search]",
      )) {
        input.addEventListener("input", () => this.filterOptions());
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && !event.isComposing)
            event.preventDefault();
        });
      }
      this.require("[data-consignment-filter]").addEventListener("input", () =>
        this.render(),
      );
      new MutationObserver(() => this.visibility()).observe(this.app, {
        attributeFilter: ["class"],
      });
      this.visibility();
    }

    private require<T extends HTMLElement>(selector: string): T {
      const element = this.panel.querySelector<T>(selector);
      if (!element) throw new Error("فرم ثبت امانی ناقص است.");
      return element;
    }

    private visibility(): void {
      const hidden =
        this.app.classList.contains("hidden") ||
        (!has("admin") && !has("sales"));
      if (this.panel.hidden === hidden) return;
      this.panel.hidden = hidden;
      if (!hidden) return;
      this.generation++;
      this.panel.open = false;
      this.records = [];
      this.customers = [];
      this.products = [];
      this.require<HTMLInputElement>("[data-consignment-filter]").value = "";
      this.attempts.clear();
      this.send.reset();
      this.fill("customer_id", [], "انتخاب مشتری");
      this.fill("product", [], "انتخاب کالا");
      this.closeReturn();
      this.rows.replaceChildren();
      this.status.textContent = "";
    }

    private async load(): Promise<void> {
      if (this.pending || this.panel.hidden) return;
      const generation = ++this.generation;
      this.status.textContent = "در حال دریافت کالاهای امانی…";
      try {
        const report = (await req(this.path)) as Report;
        if (generation !== this.generation) return;
        this.customers = report.customers;
        this.products = report.products;
        this.filterOptions();
        this.records = report.records;
        this.render();
        this.status.textContent = this.records.length
          ? ""
          : "هنوز کالای امانی ثبت نشده است.";
      } catch {
        if (generation === this.generation)
          this.status.textContent = "دریافت کالاهای امانی ناموفق بود.";
      }
    }

    /** Normalize Persian and Arabic spellings and digits before matching a visible label. */
    private searchKey(value: string): string {
      return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[يك]/g, (letter) => (letter === "ي" ? "ی" : "ک"))
        .replace(/[۰-۹٠-٩]/g, (digit) =>
          String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10),
        )
        .replace(/[\s\u200c]+/g, " ")
        .trim();
    }

    private filterOptions(): void {
      const customer = this.searchKey(
        this.require<HTMLInputElement>("[data-consignment-customer-search]")
          .value,
      );
      const product = this.searchKey(
        this.require<HTMLInputElement>("[data-consignment-product-search]")
          .value,
      );
      const people: [string, string][] = this.customers
        .filter(({ name, code }) =>
          this.searchKey(name + " " + code).includes(customer),
        )
        .map(({ id, name, code }) => [
          String(id),
          code ? name + " · " + code : name,
        ]);
      const goods: [string, string][] = this.products
        .filter((name) => this.searchKey(name).includes(product))
        .map((name) => [name, name]);
      this.fill(
        "customer_id",
        people,
        customer && !people.length ? "مشتری پیدا نشد" : "انتخاب مشتری",
      );
      this.fill(
        "product",
        goods,
        product && !goods.length ? "کالا پیدا نشد" : "انتخاب کالا",
      );
    }

    private fill(
      field: string,
      rows: [string, string][],
      placeholder: string,
    ): void {
      const select = this.send.elements.namedItem(field) as HTMLSelectElement;
      const previous = select.value;
      select.replaceChildren(
        new Option(placeholder, ""),
        ...rows.map(([value, name]) => new Option(name, value)),
      );
      select.value = rows.some(([value]) => value === previous) ? previous : "";
    }

    private render(): void {
      this.rows.replaceChildren();
      const query = this.searchKey(
        this.require<HTMLInputElement>("[data-consignment-filter]").value,
      );
      const matches = this.records.filter((record) =>
        this.searchKey(record.customer_name + " " + record.product).includes(
          query,
        ),
      );
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
        } else {
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

    private date(value: string): string {
      return jalaliDateTime(value).replace(/\d/g, (digit) =>
        this.formatter.format(Number(digit)),
      );
    }

    private openReturn(record: Consignment): void {
      if (this.pending) return;
      this.selected = record;
      this.returned.reset();
      this.returned.classList.remove("hidden");
      this.require("[data-consignment-recipient]").textContent =
        record.customer_name +
        " · " +
        record.product +
        " · مانده " +
        this.formatter.format(record.remaining);
      const quantity = this.returned.elements.namedItem(
        "quantity",
      ) as HTMLInputElement;
      quantity.focus();
    }

    private closeReturn(): void {
      this.selected = null;
      this.returned.reset();
      this.returned.classList.add("hidden");
    }

    private async save(form: HTMLFormElement): Promise<void> {
      if (this.pending || this.panel.hidden) return;
      const data = new FormData(form);
      const quantityText = String(data.get("quantity") ?? "")
        .trim()
        .replace(/[۰-۹٠-٩]/g, (digit) =>
          String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10),
        );
      const quantity = Number(quantityText);
      if (
        !/^\d+$/.test(quantityText) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1
      ) {
        this.status.textContent = "تعداد را به‌صورت عدد صحیح وارد کنید.";
        return;
      }
      const selected = form === this.returned ? this.selected : null;
      if (form === this.returned && !selected) return;
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
      const key =
        this.attempts.get(fingerprint) ?? crypto.randomUUID().replace(/-/g, "");
      this.attempts.set(fingerprint, key);
      this.pending = true;
      const generation = ++this.generation;
      const buttons = this.panel.querySelectorAll<HTMLButtonElement>("button");
      buttons.forEach((button) => {
        button.disabled = true;
      });
      this.status.textContent = "در حال ثبت…";
      try {
        const record = (await req(this.path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, request_id: key }),
        })) as Consignment;
        if (generation !== this.generation) return;
        this.attempts.delete(fingerprint);
        const index = this.records.findIndex((entry) => entry.id === record.id);
        if (index < 0) this.records.unshift(record);
        else this.records.splice(index, 1, record);
        form.reset();
        if (form === this.send) this.filterOptions();
        this.closeReturn();
        this.render();
        this.status.textContent = selected
          ? "برگشت کالا ثبت شد."
          : "تحویل کالای امانی ثبت شد.";
      } catch (error: unknown) {
        if (generation === this.generation) {
          this.status.textContent =
            error instanceof Error ? error.message : "ثبت عملیات ممکن نشد.";
        }
      } finally {
        this.pending = false;
        buttons.forEach((button) => {
          button.disabled = false;
        });
        if (
          generation !== this.generation &&
          this.panel.open &&
          !this.panel.hidden
        )
          void this.load();
      }
    }
  }

  const panel = document.getElementById("gpCustomerConsignments");
  const app = document.getElementById("app");
  if (panel instanceof HTMLDetailsElement && app)
    new ConsignmentPage(panel, app).start();
})();

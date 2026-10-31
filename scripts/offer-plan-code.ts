/** Complete the active page/modal discount contracts without changing server permissions. */
declare function parseMoneyInput(value: string): number;
declare function req(path: string): Promise<unknown>;

(() => {
  interface OfferSource {
    product?: string;
    products?: string[];
    discount_type?: string;
    discount_value?: number | string;
    promo_code?: string;
    one_time_per_customer?: boolean;
  }
  interface DiscountPayload {
    product: string;
    products: string[];
    discount_type: string;
    discount_value: number;
    promo_code: string;
    one_time_per_customer: boolean;
  }
  class OfferPlanEditor {
    private catalog: string[] | null = null;
    private scopes = new Map<string, string[]>();
    private ready = new Set<string>();
    constructor(
      private readonly doc: Document,
      private readonly parseMoney: (value: string) => number,
      private readonly loadCatalog: () => Promise<unknown>,
    ) {}
    /** Prefixes distinguish the page from the customer-operation modal. */
    markup(prefix: string): string {
      return `<div class="gp-offer-editor"><div class="gp-offer-row"><label>نوع تخفیف<select id="${prefix}DiscountType"><option value="none">بدون تخفیف مبلغی</option><option value="percent">درصد تخفیف</option><option value="amount">مبلغ تخفیف (تومان)</option></select></label><label>مقدار تخفیف<input id="${prefix}Discount" inputmode="numeric" placeholder="درصد یا مبلغ به تومان"></label></div><label>کد تخفیف<input id="${prefix}PromoCode" dir="ltr" placeholder="مثال GHADIR10" autocomplete="off"><span class="small">برای تخفیف درصدی یا مبلغی، کد دلخواه و غیرتکراری وارد کنید.</span></label><label>کالاهای مشمول تخفیف<select id="${prefix}Products" multiple aria-describedby="${prefix}ProductHint" disabled></select><span id="${prefix}ProductHint" class="small">بدون انتخاب = همه کالاها. برای چند انتخاب در کامپیوتر Ctrl را نگه دارید.</span></label><div id="${prefix}CatalogStatus" role="status">در حال دریافت کالاها…</div><button type="button" id="${prefix}CatalogRetry">دریافت دوباره کالاها</button></div>`;
    }
    /** Restore existing financial fields so changing the audience cannot erase them. */
    fill(prefix: string, source: OfferSource = {}): void {
      const names = source.products ?? (source.product ? [source.product] : []);
      this.scopes.set(prefix, names);
      if (this.ready.has(prefix)) this.selectNames(prefix, names);
      this.field(prefix + "DiscountType").value =
        source.discount_type || "none";
      this.field(prefix + "PromoCode").value = source.promo_code || "";
      this.field(prefix + "Discount").value = String(
        source.discount_value || "",
      );
    }
    /** Load product choices once and preserve the most recently selected offer during async loading. */
    async mount(prefix: string): Promise<void> {
      const select = this.productField(prefix);
      const status = this.doc.getElementById(prefix + "CatalogStatus");
      const retry = this.doc.getElementById(prefix + "CatalogRetry");
      if (retry)
        retry.onclick = () => {
          void this.mount(prefix);
        };
      select.disabled = true;
      this.ready.delete(prefix);
      try {
        if (this.catalog === null) {
          const response = await this.loadCatalog();
          if (!Array.isArray(response))
            throw new Error("فهرست کالاها دریافت نشد");
          this.catalog = response.map((row: unknown) => {
            if (
              typeof row !== "object" ||
              row === null ||
              !("name" in row) ||
              typeof row.name !== "string" ||
              !row.name.trim()
            )
              throw new Error("فهرست کالاها معتبر نیست");
            return row.name;
          });
        }
        const selected = this.scopes.get(prefix) ?? [];
        const names = [...new Set([...this.catalog, ...selected])];
        select.replaceChildren();
        for (const name of names) {
          const option = this.doc.createElement("option");
          option.value = name;
          option.textContent = name;
          option.selected = selected.includes(name);
          select.append(option);
        }
        select.disabled = false;
        this.ready.add(prefix);
        select.onchange = () =>
          this.scopes.set(
            prefix,
            Array.from(select.selectedOptions, (o) => o.value),
          );
        if (status)
          status.textContent =
            "خالی بگذارید تا تخفیف برای همه کالاها باشد؛ یا یک یا چند کالا انتخاب کنید.";
        if (retry) retry.hidden = true;
      } catch (error: unknown) {
        if (status)
          status.textContent =
            error instanceof Error ? error.message : "دریافت کالاها ناموفق بود";
        if (retry) retry.hidden = false;
      }
    }
    private selectNames(prefix: string, names: string[]): void {
      const select = this.productField(prefix);
      const existing = new Set(
        Array.from(select.options, (option) => option.value),
      );
      for (const name of names)
        if (!existing.has(name)) {
          const option = this.doc.createElement("option");
          option.value = name;
          option.textContent = name;
          select.append(option);
        }
      for (const option of this.productField(prefix).options)
        option.selected = names.includes(option.value);
    }
    private productField(prefix: string): HTMLSelectElement {
      const field = this.field(prefix + "Products");
      if (!(field instanceof HTMLSelectElement))
        throw new Error("انتخاب کالاها در دسترس نیست");
      return field;
    }
    /** Validate before I/O and submit canonical numeric amounts and codes. */
    read(prefix: string, source: OfferSource = {}): DiscountPayload {
      if (!this.ready.has(prefix))
        throw new Error("ابتدا فهرست کالاهای طرح را دریافت کنید");
      const products = Array.from(
        this.productField(prefix).selectedOptions,
        (option) => option.value,
      );
      const type = this.field(prefix + "DiscountType").value;
      const codeField = this.field(prefix + "PromoCode");
      const code = codeField.value.replace(/\s+/gu, "").toUpperCase();
      const amount =
        type === "none"
          ? 0
          : this.parseMoney(this.field(prefix + "Discount").value);
      if (!["none", "percent", "amount"].includes(type))
        throw new Error("نوع تخفیف را انتخاب کنید");
      if (
        !Number.isSafeInteger(amount) ||
        amount < 0 ||
        (type !== "none" && amount < 1)
      )
        throw new Error("مقدار تخفیف معتبر وارد کنید");
      if (type === "percent" && amount > 100)
        throw new Error("درصد تخفیف باید بین ۱ تا ۱۰۰ باشد");
      if (type !== "none" && !code) {
        codeField.scrollIntoView({ block: "center" });
        codeField.focus();
        throw new Error(
          "کد تخفیف را در کادر «کد تخفیف» وارد کنید؛ مثال GHADIR10",
        );
      }
      codeField.value = code;
      return {
        products,
        product: products.length === 1 ? (products[0] ?? "") : "",
        discount_type: type,
        discount_value: amount,
        promo_code: code,
        one_time_per_customer: !!source.one_time_per_customer,
      };
    }
    private field(id: string): HTMLInputElement | HTMLSelectElement {
      const field = this.doc.getElementById(id);
      if (
        !(field instanceof HTMLInputElement) &&
        !(field instanceof HTMLSelectElement)
      )
        throw new Error("فرم طرح کامل بارگذاری نشده؛ صفحه را تازه‌سازی کنید");
      return field;
    }
  }
  Object.assign(window, {
    gpOfferPlanEditor: new OfferPlanEditor(
      document,
      (value) => parseMoneyInput(value),
      () => req("/api/catalog"),
    ),
  });
})();

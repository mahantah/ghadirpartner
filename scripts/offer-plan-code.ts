/** Complete the active page/modal discount contracts without changing server permissions. */
declare function parseMoneyInput(value: string): number;

(() => {
  interface OfferSource {
    discount_type?: string;
    discount_value?: number | string;
    promo_code?: string;
    one_time_per_customer?: boolean;
  }
  interface DiscountPayload {
    discount_type: string;
    discount_value: number;
    promo_code: string;
    one_time_per_customer: boolean;
  }
  class OfferPlanEditor {
    constructor(
      private readonly doc: Document,
      private readonly parseMoney: (value: string) => number,
    ) {}
    /** Prefixes distinguish the page from the customer-operation modal. */
    markup(prefix: string): string {
      return `<label>نوع تخفیف<select id="${prefix}DiscountType"><option value="none">بدون تخفیف مبلغی</option><option value="percent">درصد تخفیف</option><option value="amount">مبلغ تخفیف (تومان)</option></select></label><label style="grid-column:1 / -1">کد تخفیف — الزامی برای تخفیف<input id="${prefix}PromoCode" dir="ltr" placeholder="مثال GHADIR10" autocomplete="off"><span class="small">کد دلخواه و غیرتکراری خود را وارد کنید.</span></label>`;
    }
    /** Restore existing financial fields so changing the audience cannot erase them. */
    fill(prefix: string, source: OfferSource = {}): void {
      this.field(prefix + "DiscountType").value =
        source.discount_type || "none";
      this.field(prefix + "PromoCode").value = source.promo_code || "";
      this.field(prefix + "Discount").value = String(
        source.discount_value || "",
      );
    }
    /** Validate before I/O and submit canonical numeric amounts and codes. */
    read(prefix: string, source: OfferSource = {}): DiscountPayload {
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
    gpOfferPlanEditor: new OfferPlanEditor(document, (value) =>
      parseMoneyInput(value),
    ),
  });
})();

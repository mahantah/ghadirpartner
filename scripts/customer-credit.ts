/** Existing authenticated transports remain the sole network entrypoints. */
declare function req(path: string, options?: RequestInit): Promise<unknown>;
declare function api(path: string, options?: RequestInit): Promise<unknown>;
interface Window {
  gpCustomerCredit: CustomerCreditFacade;
}
interface CreditBalance {
  credit_commitment: string;
  credit_commitment_sha256: string;
  enabled: boolean;
  limit: number;
  monthly_used: number;
  outstanding: number;
  reserved: number;
  available: number;
  month: string;
}
/** Validate the server boundary before rendering money or settings. */
class CreditClient {
  constructor(private readonly portal: boolean) {}
  /** Fetch or update only the selected authorized customer. */
  async balance(
    id?: number,
    body?: { id: number; enabled: boolean; limit: number },
  ): Promise<CreditBalance> {
    const path = "/api/customer-credit" + (id === undefined ? "" : "?id=" + id);
    const options: RequestInit =
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          };
    const raw: unknown = await (this.portal
      ? api(path, options)
      : req(path, options));
    if (typeof raw !== "object" || raw === null)
      throw new Error("پاسخ اعتبار معتبر نیست");
    const value = raw as Record<string, unknown>;
    for (const key of [
      "limit",
      "monthly_used",
      "outstanding",
      "reserved",
      "available",
    ])
      if (
        typeof value[key] !== "number" ||
        !Number.isSafeInteger(value[key]) ||
        Number(value[key]) < 0
      )
        throw new Error("مبلغ اعتبار معتبر نیست");
    if (typeof value.enabled !== "boolean" || typeof value.month !== "string")
      throw new Error("وضعیت اعتبار معتبر نیست");
    if (
      typeof value.credit_commitment !== "string" ||
      typeof value.credit_commitment_sha256 !== "string"
    )
      throw new Error("متن تعهد دریافت نشد");
    return value as unknown as CreditBalance;
  }
}
/** Render escaped, scoped settings and account balances without replacing site menus. */
class CreditView {
  /** Format server-owned numeric money values. */
  money(value: number): string {
    return value.toLocaleString("fa-IR") + " تومان";
  }
  /** Build account totals from validated data only. */
  summary(b: CreditBalance): string {
    return `<p>اعتبار: <b>${b.enabled ? "فعال" : "غیرفعال"}</b></p><p>سقف ماهانه: ${this.money(b.limit)}</p><p>خرید اعتباری این ماه: ${this.money(b.monthly_used)}</p><p>بدهی و سفارش‌های رزروشده: ${this.money(b.outstanding)}</p><p><b>مانده قابل خرید: ${this.money(b.available)}</b></p>`;
  }
  /** Create a native keyboard-accessible settings dialog. */
  dialog(b: CreditBalance): HTMLDialogElement {
    document.getElementById("gp-credit-dialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "gp-credit-dialog";
    dialog.dir = "rtl";
    dialog.style.cssText =
      "border:1px solid #d9e2ec;border-radius:14px;padding:22px;color:#102a43;width:420px;max-width:94vw;font:14px Tahoma;max-height:90vh;overflow:auto";
    dialog.innerHTML = `<form><h3>اعتبار ماهانه مشتری</h3>${this.summary(b)}<p><label><input id="gp-credit-enabled" type="checkbox" ${b.enabled ? "checked" : ""}> خرید اعتباری فعال باشد</label></p><label>سقف ماهانه (تومان)<input id="gp-credit-limit" type="number" min="0" step="1" required value="${b.limit}" style="display:block;width:100%;padding:10px;box-sizing:border-box"></label><p>بدهی ماه‌های قبل از اعتبار کم می‌شود. سفارش‌های منتظر تأیید نیز اعتبار را رزرو می‌کنند.</p><p role="status" id="gp-credit-message"></p><button type="submit" style="padding:10px 16px;background:#102a43;color:white;border:0;border-radius:8px">ذخیره</button> <button type="button" id="gp-credit-close" style="padding:10px">بستن</button></form>`;
    dialog
      .querySelector("#gp-credit-close")
      ?.addEventListener("click", () => dialog.close());
    document.body.append(dialog);
    dialog.showModal();
    return dialog;
  }
}
/** Single public facade for the two existing website surfaces. */
class CustomerCreditFacade {
  private current: CreditBalance | undefined;
  /** Require the displayed server-owned commitment on each credit purchase. */
  settlement(
    method: string,
  ): { terms_accepted: true; commitment_sha256: string } | undefined {
    if (method !== "credit") return undefined;
    const check =
      document.querySelector<HTMLInputElement>("#gp-credit-consent");
    if (!this.current?.enabled || !check?.checked)
      throw new Error("فعال بودن اعتبار و تأیید تعهد تسویه الزامی است");
    return {
      terms_accepted: true,
      commitment_sha256: this.current.credit_commitment_sha256,
    };
  }
  constructor(
    private readonly client: CreditClient,
    private readonly view: CreditView,
  ) {}
  /** Open manager settings using freshly fetched financial balances. */
  async open(id: number): Promise<void> {
    try {
      const b = await this.client.balance(id);
      const dialog = this.view.dialog(b);
      const form = dialog.querySelector("form");
      form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const message = dialog.querySelector("#gp-credit-message");
        const input =
          dialog.querySelector<HTMLInputElement>("#gp-credit-limit");
        const enabled =
          dialog.querySelector<HTMLInputElement>("#gp-credit-enabled");
        if (
          !input ||
          !enabled ||
          !message ||
          !(button instanceof HTMLButtonElement)
        )
          return;
        const limit = Number(input.value);
        if (!Number.isSafeInteger(limit) || limit < 0) {
          message.textContent = "سقف معتبر وارد کنید";
          return;
        }
        button.disabled = true;
        try {
          await this.client.balance(id, {
            id,
            enabled: enabled.checked,
            limit,
          });
          dialog.close();
        } catch (error: unknown) {
          message.textContent =
            error instanceof Error ? error.message : "ذخیره اعتبار انجام نشد";
        } finally {
          button.disabled = false;
        }
      });
    } catch (error: unknown) {
      alert(
        error instanceof Error ? error.message : "اطلاعات اعتبار دریافت نشد",
      );
    }
  }
  /** Refresh the customer's own balance after the existing portal data refresh. */
  async refresh(): Promise<void> {
    if (!document.body.classList.contains("customer-mode")) return;
    const host = document.getElementById("dashboard");
    if (!host) return;
    let card = document.getElementById("gp-credit-balance");
    if (!card) {
      card = document.createElement("section");
      card.id = "gp-credit-balance";
      card.className = "card";
      host.prepend(card);
    }
    try {
      const b = await this.client.balance();
      this.current = b;
      const target = document.querySelector("#newOrder .card");
      if (target) {
        let field = document.getElementById("gp-credit-purchase");
        if (!field) {
          field = document.createElement("fieldset");
          field.id = "gp-credit-purchase";
          field.innerHTML =
            '<legend>خرید اعتباری</legend><label><input type="radio" name="orderPaymentMethod" value="credit"> اعتباری</label><p id="gp-credit-terms"></p><label><input type="checkbox" id="gp-credit-consent"> متعهد می‌شوم و تأیید می‌کنم</label>';
          target.append(field);
        }
        const radio = field.querySelector<HTMLInputElement>(
          'input[type="radio"]',
        );
        const terms = field.querySelector("#gp-credit-terms");
        const consent =
          field.querySelector<HTMLInputElement>("#gp-credit-consent");
        if (radio) {
          radio.disabled = !b.enabled || b.available <= 0;
          if (radio.disabled) radio.checked = false;
        }
        if (terms) terms.textContent = b.credit_commitment;
        if (consent && !radio?.checked) consent.checked = false;
      }
      card.innerHTML = "<h3>اعتبار ماهانه شما</h3>" + this.view.summary(b);
    } catch (error: unknown) {
      card.textContent =
        error instanceof Error ? error.message : "اطلاعات اعتبار دریافت نشد";
    }
  }
}
(() => {
  const portal = !!document.currentScript?.hasAttribute("data-credit-portal");
  window.gpCustomerCredit = new CustomerCreditFacade(
    new CreditClient(portal),
    new CreditView(),
  );
  if (portal) void window.gpCustomerCredit.refresh();
})();

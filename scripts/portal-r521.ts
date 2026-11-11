interface R521Nav {
  page: string;
  title: string;
  icon: string;
}
interface R521Policy {
  reference: string;
  timezone: string;
  serialTierThreshold: number;
  imageMaxPixels: number;
  imageMaxBytes: number;
  imageQuality: number;
  formalPayee: string;
  informalPayee: string;
  banks: string[];
  stageNames: string[];
  navigation: R521Nav[];
  assets: Record<string, string>;
}
interface R521CartLine {
  product: string;
  key: string;
  qty: number;
  unit: number;
  line: number;
}
interface R521Record {
  [key: string]: unknown;
}
interface R521Legacy {
  customer(): boolean;
  account(): R521Record;
  cart(): R521CartLine[];
  offers(): R521Record[];
  products(): R521Record[];
  navigate(page: string): void;
  add(product?: string, key?: string): void;
  total(): void;
  reload(): Promise<void>;
  applyPromo(): boolean;
  clearPromo(): void;
  login(): Promise<void>;
  logout(): Promise<void>;
  orderDetail(id: number): void;
}
declare function api(path: string, options?: RequestInit): Promise<unknown>;
declare function isCustomer(): boolean;
declare function show(page: string): void;
declare function boot(): Promise<void>;
declare function cartSnapshot(): R521CartLine[];
declare function addItem(product?: string, key?: string): void;
declare function updateDraft(): void;
declare function loadAll(): Promise<void>;
declare function applyPromoCode(): boolean;
declare function clearAppliedPromo(clear?: boolean): void;
declare function logout(): Promise<void>;
declare function details(id: number): void;
declare const me: unknown;
declare const offers: unknown;
declare const catalog: unknown;
declare const orders: unknown;
declare const BASE: string;
declare const PRICE_LABELS: Record<string, string>;
declare function visiblePriceGroups(): string[];
declare function downloadOrderSerials(id: number): Promise<void>;
interface Window {
  GP_PORTAL_R521_POLICY?: unknown;
  gpPortalR521?: R521Portal;
}

/** Read the existing API's optional objects without trusting unknown values. */
function r521Record(value: unknown): R521Record {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as R521Record)
    : {};
}
/** Read a string field while accepting numeric API identifiers. */
function r521Text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
/** Decode decimal digits typed with a Persian or Arabic keyboard. */
function r521Ascii(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) =>
    String(digit.charCodeAt(0) % 16),
  );
}
/** Normalize integer amounts for display and validation. */
function r521Amount(value: string): number {
  const digits = r521Ascii(value).replace(/[٬,\s]/g, "");
  return /^\d+$/.test(digits) && Number.isSafeInteger(Number(digits))
    ? Number(digits)
    : 0;
}
/** Display amounts in the same locale as the app. */
function r521Money(value: number): string {
  return value.toLocaleString("fa-IR") + " تومان";
}
/** Find a required, stable portal element. */
function r521Node<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error("بخش موردنظر در دسترس نیست");
  return node as T;
}
/** Create an action without inserting remote content into HTML. */
function r521Button(
  label: string,
  click: () => void,
  primary = false,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = primary ? "orange" : "light";
  button.textContent = label;
  button.addEventListener("click", click);
  return button;
}
/** Explain a failed user action in its current form. */
function r521Error(error: unknown): string {
  if (!(error instanceof Error)) return "عملیات انجام نشد. دوباره تلاش کنید.";
  try {
    const body = r521Record(JSON.parse(error.message));
    return r521Text(body.error ?? body.message) || error.message;
  } catch {
    return error.message;
  }
}
/** Validate the version-specific settings before using them. */
function r521Policy(raw: unknown): R521Policy {
  const value = r521Record(raw);
  if (
    value.reference !== "5.4.3.3-r5.21" ||
    typeof value.timezone !== "string" ||
    typeof value.formalPayee !== "string" ||
    typeof value.informalPayee !== "string" ||
    !Array.isArray(value.banks) ||
    !value.banks.every((x: unknown) => typeof x === "string" && x.trim()) ||
    !Array.isArray(value.stageNames) ||
    value.stageNames.length !== 3 ||
    !value.stageNames.every((x: unknown) => typeof x === "string") ||
    !Array.isArray(value.navigation) ||
    value.navigation.length !== 5 ||
    !value.navigation.every((x: unknown) =>
      ["page", "title", "icon"].every(
        (k) => typeof r521Record(x)[k] === "string",
      ),
    ) ||
    !Object.values(r521Record(value.assets)).every(
      (x) =>
        typeof x === "string" &&
        /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(x),
    )
  )
    throw new Error("تنظیمات پرتال معتبر نیست");
  for (const key of ["serialTierThreshold", "imageMaxPixels", "imageMaxBytes"])
    if (
      typeof value[key] !== "number" ||
      !Number.isSafeInteger(value[key]) ||
      Number(value[key]) < 1
    )
      throw new Error("تنظیمات سفارش معتبر نیست");
  if (
    typeof value.imageQuality !== "number" ||
    value.imageQuality <= 0 ||
    value.imageQuality > 1
  )
    throw new Error("تنظیم تصویر معتبر نیست");
  new Intl.DateTimeFormat("fa-IR", { timeZone: value.timezone });
  return value as unknown as R521Policy;
}

/** Reuse the authenticated portal transport for native-compatible requests. */
class R521Repository {
  constructor(
    private readonly request: (
      path: string,
      options?: RequestInit,
    ) => Promise<unknown>,
  ) {}
  /** Get an account-scoped collection. */
  async list(path: string): Promise<R521Record[]> {
    const response = await this.request(path);
    if (!Array.isArray(response)) throw new Error("پاسخ سامانه معتبر نیست");
    return response.map(r521Record);
  }
  /** Get the current account's credit terms and amount. */
  async credit(): Promise<R521Record> {
    return r521Record(await this.request("/api/customer-credit"));
  }
  /** Submit one existing API action. */
  async post(path: string, body: R521Record): Promise<unknown> {
    return this.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}

/** Select a Persian date without converting the value to a Gregorian date on submission. */
class R521Calendar {
  private readonly parts: Intl.DateTimeFormat;
  private readonly title: Intl.DateTimeFormat;
  private readonly weekday: Intl.DateTimeFormat;
  constructor(timezone: string) {
    this.weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    });
    this.parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    this.title = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      timeZone: timezone,
      year: "numeric",
      month: "long",
    });
  }
  /** Open the same month grid used for selecting a check due date. */
  open(input: HTMLInputElement): void {
    const dialog = document.createElement("dialog");
    dialog.className = "r521-date";
    dialog.setAttribute("aria-label", "انتخاب تاریخ شمسی");
    let month = this.first(new Date());
    const draw = (): void => {
      const heading = document.createElement("strong");
      heading.textContent = this.title.format(month);
      const days = document.createElement("div");
      days.className = "r521-date-grid";
      for (const label of ["ش", "ی", "د", "س", "چ", "پ", "ج"]) {
        const span = document.createElement("b");
        span.textContent = label;
        days.append(span);
      }
      for (
        let i = 0;
        i <
        ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].indexOf(
          this.weekday.format(month),
        );
        i++
      )
        days.append(document.createElement("span"));
      let cursor = month;
      for (let i = 0; i < 31; i++) {
        const value = this.values(cursor);
        if (value.month !== this.values(month).month) break;
        const iso = `${value.year}/${value.month.padStart(2, "0")}/${value.day.padStart(2, "0")}`;
        days.append(
          r521Button(Number(value.day).toLocaleString("fa-IR"), () => {
            input.value = iso;
            dialog.close();
          }),
        );
        cursor = this.shift(cursor, 1);
      }
      const controls = document.createElement("div");
      controls.className = "r521-actions";
      controls.append(
        r521Button("ماه قبل", () => {
          month = this.first(this.shift(month, -1));
          draw();
        }),
        r521Button("ماه بعد", () => {
          month = this.first(cursor);
          draw();
        }),
      );
      dialog.replaceChildren(
        heading,
        controls,
        days,
        r521Button("بستن", () => dialog.close()),
      );
    };
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    document.body.append(dialog);
    draw();
    dialog.showModal();
  }
  private shift(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86400000);
  }
  private values(date: Date): { year: string; month: string; day: string } {
    const parts = this.parts.formatToParts(date);
    return {
      year: parts.find((x) => x.type === "year")?.value ?? "",
      month: parts.find((x) => x.type === "month")?.value ?? "",
      day: parts.find((x) => x.type === "day")?.value ?? "1",
    };
  }
  private first(date: Date): Date {
    return this.shift(date, 1 - Number(this.values(date).day));
  }
}

/** Keep only the non-sensitive cart draft until Tehran midnight. */
class R521Draft {
  private readonly day: Intl.DateTimeFormat;
  constructor(timezone: string) {
    this.day = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
  /** Retrieve a current-day draft scoped to this authenticated account. */
  read(id: string): R521Record {
    try {
      const value = r521Record(
        JSON.parse(localStorage.getItem("gp-r521-cart:" + id) ?? "{}"),
      );
      if (
        value.day === this.day.format(new Date()) &&
        Array.isArray(value.lines)
      )
        return value;
      this.clear(id);
    } catch {
      /* Storage may be blocked in private mode. */
    }
    return {};
  }
  /** Store product selections, quantity and invoice type for resuming checkout. */
  save(id: string, lines: R521CartLine[], invoice: string): void {
    if (!lines.length) {
      this.clear(id);
      return;
    }
    try {
      localStorage.setItem(
        "gp-r521-cart:" + id,
        JSON.stringify({
          day: this.day.format(new Date()),
          invoice,
          lines: lines.map(({ product, key, qty }) => ({ product, key, qty })),
        }),
      );
    } catch {
      /* Checkout works without local storage. */
    }
  }
  /** Discard a submitted or explicitly discarded cart. */
  clear(id: string): void {
    try {
      localStorage.removeItem("gp-r521-cart:" + id);
    } catch {
      /* Optional storage. */
    }
  }
}

/** Connect the existing cart, account and checkout endpoints to the three app stages. */
class R521Checkout {
  private stage = 0;
  private busy = false;
  private installed = false;
  private addresses: R521Record[] = [];
  private addressRead: Promise<void> | undefined;
  private creditTerms: R521Record = {};
  private creditRead: Promise<void> | undefined;
  private cashEdited = false;
  private draftReady = false;
  private readonly calendar: R521Calendar;
  private readonly draft: R521Draft;
  constructor(
    private readonly policy: R521Policy,
    private readonly repository: R521Repository,
    private readonly legacy: R521Legacy,
  ) {
    this.calendar = new R521Calendar(policy.timezone);
    this.draft = new R521Draft(policy.timezone);
  }
  /** Keep the order form stable while a single submission is pending. */
  submitting(): boolean {
    return this.busy;
  }
  /** Build the stage containers once while reusing the live cart inputs. */
  install(): void {
    if (this.installed) return;
    const card = document.querySelector<HTMLElement>("#newOrder > .card");
    const toolbar = r521Node("draftTotal").closest(".toolbar");
    if (!card || !toolbar) throw new Error("فرم سفارش در دسترس نیست");
    const legacyPayment = card.querySelector(".order-payment-choice");
    const legacySubmit = toolbar.querySelector(
      'button[onclick="createOrder()"]',
    );
    const existing = [...card.children];
    const header = document.createElement("div");
    header.className = "r521-stage-head";
    header.innerHTML =
      '<h3 id="r521-stage-title"></h3><progress id="r521-progress" max="3" value="1" aria-label="پیشرفت ثبت سفارش"></progress>';
    const message = document.createElement("p");
    message.id = "r521-checkout-error";
    message.className = "r521-error";
    message.setAttribute("role", "alert");
    message.hidden = true;
    const cart = document.createElement("div");
    cart.id = "r521-stage-0";
    cart.className = "r521-grid";
    for (const child of existing)
      if (
        child !== legacyPayment &&
        child !== toolbar &&
        child.id !== "gp-credit-purchase" &&
        !child.classList.contains("section-head")
      )
        cart.append(child);
    if (legacyPayment instanceof HTMLElement) legacyPayment.hidden = true;
    if (legacySubmit instanceof HTMLElement) legacySubmit.hidden = true;
    for (const element of card.querySelectorAll<HTMLElement>(
      ":scope > .section-head",
    ))
      element.hidden = true;
    const delivery = document.createElement("div");
    delivery.id = "r521-stage-1";
    delivery.className = "r521-grid";
    delivery.innerHTML = `<h3>نشانی تحویل</h3><label>انتخاب نشانی<select id="r521-address-select"></select></label><p id="r521-address-text" class="r521-address"></p><div id="r521-address-action"></div><h3>روش تسویه</h3><p class="hint">نقد، چک و اعتباری قابل ترکیب‌اند.</p>
    <fieldset class="r521-method"><legend>نقد</legend><label><input id="r521-cash-on" type="checkbox" checked> پرداخت نقدی</label><div id="r521-cash-fields" class="r521-grid"><label>مبلغ نقدی (تومان)<input id="r521-cash" inputmode="numeric"></label><label>تصویر رسید<input id="r521-cash-image" type="file" accept="image/*"></label></div></fieldset>
    <fieldset class="r521-method"><legend>چک</legend><label><input id="r521-check-on" type="checkbox"> تسویه با چک</label><div id="r521-check-fields" class="r521-grid" hidden><p id="r521-payee"></p><label>مبلغ چک (تومان)<input id="r521-check" inputmode="numeric"></label><label>شناسه صیادی<input id="r521-check-number" inputmode="numeric" maxlength="16" dir="ltr"></label><label>بانک<input id="r521-bank" list="r521-banks" autocomplete="off"></label><datalist id="r521-banks"></datalist><label>تاریخ سررسید<input id="r521-due" readonly placeholder="انتخاب از تقویم شمسی"></label><div id="r521-calendar-action"></div><label>تصویر چک<input id="r521-check-image" type="file" accept="image/*"></label></div></fieldset>
    <fieldset class="r521-method"><legend>اعتباری</legend><label><input id="r521-credit-on" type="checkbox"> تسویه اعتباری</label><div id="r521-credit-fields" class="r521-grid" hidden><label>مبلغ اعتباری (تومان)<input id="r521-credit" inputmode="numeric"></label><p id="r521-credit-balance" role="status"></p><p id="r521-credit-terms"></p><label><input id="r521-consent" type="checkbox"> تعهد تسویه اعتباری را می‌پذیرم</label></div></fieldset><div id="r521-remaining" class="hint" role="status"></div>`;
    const review = document.createElement("div");
    review.id = "r521-stage-2";
    review.className = "r521-grid";
    const actions = document.createElement("div");
    actions.className = "r521-actions";
    const back = r521Button("بازگشت و ویرایش", () =>
      this.setStage(Math.max(0, this.stage - 1)),
    );
    back.id = "r521-back";
    const next = r521Button(
      "ادامه و بررسی سفارش",
      () => {
        void this.advance();
      },
      true,
    );
    next.id = "r521-next";
    actions.append(back, next);
    card.prepend(header, message);
    card.append(cart, delivery, review, toolbar, actions);
    for (const bank of this.policy.banks) {
      const option = document.createElement("option");
      option.value = bank;
      r521Node("r521-banks").append(option);
    }
    r521Node("r521-address-action").append(
      r521Button("ثبت آدرس جدید", () => this.addressDialog(true)),
    );
    const due = r521Node<HTMLInputElement>("r521-due");
    r521Node("r521-calendar-action").append(
      r521Button("انتخاب سررسید", () => this.calendar.open(due)),
    );
    due.addEventListener("click", () => this.calendar.open(due));
    delivery.addEventListener("input", (event) => {
      if (event.target === r521Node("r521-cash")) this.cashEdited = true;
      this.paymentView();
    });
    delivery.addEventListener("change", () => {
      this.paymentView();
      if (this.checked("r521-credit-on")) void this.loadCredit();
    });
    cart.addEventListener("change", () => this.changed());
    this.installed = true;
    this.setStage(0);
    this.restoreBanner();
    this.changed();
  }
  /** Keep the free-serial price tier consistent for all lines of each model. */
  normalize(): void {
    if (!this.installed) return;
    const rows = [...document.querySelectorAll("#orderItems .form-row")];
    const serial = new Map<string, number>();
    for (const row of rows) {
      const product =
        row.querySelector<HTMLSelectElement>(".prod")?.value ?? "";
      const key =
        row.querySelector<HTMLSelectElement>(".price-key")?.value ?? "";
      if (product && key.startsWith("serial_"))
        serial.set(
          product,
          (serial.get(product) ?? 0) +
            r521Amount(
              row.querySelector<HTMLInputElement>(".qty")?.value ?? "",
            ),
        );
    }
    for (const row of rows) {
      const select = row.querySelector<HTMLSelectElement>(".price-key");
      const product =
        row.querySelector<HTMLSelectElement>(".prod")?.value ?? "";
      const qty = serial.get(product);
      if (!select?.value.startsWith("serial_") || qty === undefined) continue;
      const key =
        qty > this.policy.serialTierThreshold ? "serial_51_200" : "serial_1_50";
      if (
        select.value !== key &&
        Array.from(select.options).some((x) => x.value === key)
      )
        select.value = key;
    }
  }
  /** Refresh stable line summaries without rebuilding the customer's inputs. */
  changed(): void {
    if (!this.installed) return;
    const lines = this.legacy.cart();
    for (const row of document.querySelectorAll<HTMLElement>(
      "#orderItems .form-row",
    )) {
      const prod = row.querySelector<HTMLSelectElement>(".prod");
      const price = row.querySelector<HTMLSelectElement>(".price-key");
      const qty = row.querySelector<HTMLInputElement>(".qty");
      if (!prod || !price || !qty) continue;
      prod.setAttribute("aria-label", "مدل کالا");
      price.setAttribute("aria-label", "نوع قیمت");
      qty.setAttribute("aria-label", "تعداد");
      let summary = row.querySelector<HTMLElement>(".r521-line");
      if (!summary) {
        summary = document.createElement("div");
        summary.className = "r521-line";
        row.prepend(summary);
      }
      const product = this.legacy
        .products()
        .find((x) => r521Text(x.name) === prod.value);
      const priceMap = r521Record(product?.prices);
      const unit = Number(priceMap[price.value] ?? 0);
      const name = document.createElement("b");
      name.textContent = prod.value;
      const detail = document.createElement("small");
      const manufacturer = r521Text(product?.manufacturer);
      detail.textContent =
        prod.value && unit > 0
          ? `${manufacturer ? manufacturer + " · " : ""}قیمت واحد ${r521Money(unit)} · مبلغ ردیف ${r521Money(unit * Number(qty.value))}`
          : manufacturer;
      summary.replaceChildren(name, detail);
      summary.hidden = !prod.value;
    }
    if (this.draftReady || lines.length) {
      this.draftReady = true;
      this.draft.save(this.accountKey(), lines, this.invoice());
      if (lines.length) document.getElementById("r521-restore")?.remove();
    }
    if (!this.cashEdited)
      r521Node<HTMLInputElement>("r521-cash").value = String(this.total());
    this.paymentView();
  }
  /** Return checkout to the cart when entered from another screen. */
  enter(): void {
    if (this.installed && !this.busy) this.setStage(0);
  }
  /** Open the address book from either the profile or checkout. */
  addressDialog(selectNew = false): void {
    void this.openAddresses(selectNew);
  }
  private async openAddresses(selectNew: boolean): Promise<void> {
    const dialog = document.createElement("dialog");
    dialog.className = "r521-date r521-grid";
    dialog.setAttribute("aria-label", "آدرس‌ها");
    const title = document.createElement("h3");
    title.textContent = "آدرس‌ها";
    const list = document.createElement("div");
    list.className = "r521-grid";
    const error = document.createElement("p");
    error.className = "r521-error";
    error.setAttribute("role", "alert");
    const form = document.createElement("form");
    form.className = "r521-grid";
    form.innerHTML =
      '<label>عنوان<input name="title" maxlength="60" required></label><label>استان<input name="province" maxlength="80" required></label><label>شهر<input name="city" maxlength="80" required></label><label>نشانی<textarea name="address" maxlength="1000" required></textarea></label><label>کد پستی<input name="postal_code" inputmode="numeric" maxlength="10"></label><button class="orange" type="submit">ذخیره آدرس</button>';
    let editing = "";
    const edit = (row: R521Record): void => {
      editing = r521Text(row.id);
      for (const name of [
        "title",
        "province",
        "city",
        "address",
        "postal_code",
      ]) {
        const field = form.elements.namedItem(name);
        if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement
        )
          field.value = r521Text(row[name]);
      }
      form.querySelector("input")?.focus();
    };
    const draw = (): void => {
      list.replaceChildren();
      for (const row of this.addresses) {
        const item = document.createElement("div");
        item.className = "r521-panel";
        const text = document.createElement("p");
        text.textContent = [row.title, row.province, row.city, row.address]
          .map(r521Text)
          .filter(Boolean)
          .join("، ");
        item.append(
          text,
          r521Button("ویرایش", () => edit(row)),
          r521Button("حذف", () => {
            if (!window.confirm("این نشانی حذف شود؟")) return;
            void change({ delete_id: r521Text(row.id) });
          }),
        );
        list.append(item);
      }
    };
    let saving = false;
    const change = async (payload: R521Record): Promise<void> => {
      if (saving) return;
      saving = true;
      error.textContent = "";
      const oldIds = new Set(this.addresses.map((x) => r521Text(x.id)));
      try {
        const raw = await this.repository.post("/api/addresses", payload);
        if (!Array.isArray(raw)) throw new Error("پاسخ ذخیره نشانی معتبر نیست");
        this.addresses = raw.map(r521Record);
        this.addressOptions();
        draw();
        edit({});
        if (selectNew && !payload.delete_id) {
          const next =
            this.addresses.find((x) => !oldIds.has(r521Text(x.id))) ??
            this.addresses.find((x) => x.id === payload.id);
          if (next)
            r521Node<HTMLSelectElement>("r521-address-select").value = r521Text(
              next.id,
            );
          this.addressText();
          if (dialog.open) dialog.close();
        }
      } catch (cause: unknown) {
        error.textContent = r521Error(cause);
      } finally {
        saving = false;
      }
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      void change({
        ...values,
        id: editing,
        postal_code: r521Ascii(r521Text(values.postal_code)),
      });
    });
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.append(
      title,
      list,
      error,
      form,
      r521Button("بستن", () => dialog.close()),
    );
    document.body.append(dialog);
    dialog.showModal();
    try {
      await this.loadAddresses();
      draw();
    } catch (cause: unknown) {
      error.textContent = r521Error(cause);
    }
  }
  private accountKey(): string {
    const account = this.legacy.account();
    return r521Text(account.customer_id ?? account.username);
  }
  private restoreBanner(): void {
    const saved = this.draft.read(this.accountKey());
    if (!Array.isArray(saved.lines) || !saved.lines.length) return;
    const banner = document.createElement("div");
    banner.id = "r521-restore";
    banner.className = "r521-panel r521-grid";
    const title = document.createElement("strong");
    title.textContent = "سفارش ناتمام امروز";
    banner.append(
      title,
      r521Button(
        "ادامه همان سفارش",
        () => {
          if (this.legacy.cart().length) return;
          r521Node("orderItems").replaceChildren();
          for (const raw of saved.lines as unknown[]) {
            const line = r521Record(raw);
            const product = r521Text(line.product);
            const qty = Number(line.qty);
            if (!product || !Number.isSafeInteger(qty) || qty < 1) continue;
            if (
              !this.legacy
                .products()
                .some((x) => x.name === product && x.available)
            )
              continue;
            this.legacy.add(product, r521Text(line.key));
            const input =
              r521Node(
                "orderItems",
              ).lastElementChild?.querySelector<HTMLInputElement>(".qty");
            if (input) input.value = String(qty);
          }
          for (const input of document.querySelectorAll<HTMLInputElement>(
            '[name="invoiceType"]',
          ))
            input.checked = input.value === saved.invoice;
          if (!r521Node("orderItems").children.length) this.legacy.add();
          banner.remove();
          this.legacy.total();
        },
        true,
      ),
      r521Button("حذف پیش‌نویس", () => {
        this.draft.clear(this.accountKey());
        banner.remove();
      }),
    );
    r521Node("r521-stage-0").prepend(banner);
  }
  private checked(id: string): boolean {
    return r521Node<HTMLInputElement>(id).checked;
  }
  private value(id: string): string {
    return r521Node<HTMLInputElement>(id).value.trim();
  }
  private invoice(): string {
    return (
      document.querySelector<HTMLInputElement>('[name="invoiceType"]:checked')
        ?.value ?? ""
    );
  }
  private total(): number {
    return r521Amount(r521Node("draftTotal").textContent ?? "");
  }
  private paymentView(): void {
    for (const method of ["cash", "check", "credit"])
      r521Node(`r521-${method}-fields`).hidden = !this.checked(
        `r521-${method}-on`,
      );
    r521Node("r521-payee").textContent =
      "چک در وجه " +
      (this.invoice() === "رسمی"
        ? this.policy.formalPayee
        : this.policy.informalPayee);
    r521Node("r521-remaining").textContent =
      "مانده فاکتور: " +
      r521Money(Math.max(0, this.total() - this.allocated()));
    this.addressText();
  }
  private amount(method: string): number {
    return this.checked(`r521-${method}-on`)
      ? r521Amount(this.value(`r521-${method}`))
      : 0;
  }
  private allocated(): number {
    return this.amount("cash") + this.amount("check") + this.amount("credit");
  }
  private error(text: string): void {
    const error = r521Node("r521-checkout-error");
    error.textContent = text;
    error.hidden = !text;
    if (text) error.scrollIntoView({ block: "nearest" });
  }
  private setStage(stage: number): void {
    this.stage = stage;
    for (let i = 0; i < 3; i++)
      r521Node(`r521-stage-${i}`).hidden = i !== stage;
    r521Node("r521-stage-title").textContent =
      `${(stage + 1).toLocaleString("fa-IR")}. ${this.policy.stageNames[stage] ?? ""}`;
    r521Node<HTMLProgressElement>("r521-progress").value = stage + 1;
    r521Node("r521-back").hidden = stage === 0;
    r521Node("r521-next").textContent =
      ["ادامه و بررسی سفارش", "ادامه به بررسی نهایی", "تأیید و ثبت نهایی"][
        stage
      ] ?? "";
    this.error("");
    this.paymentView();
  }
  private async loadAddresses(): Promise<void> {
    if (!this.addressRead)
      this.addressRead = this.repository
        .list("/api/addresses")
        .then((rows) => {
          this.addresses = rows;
          this.addressOptions();
        })
        .finally(() => {
          this.addressRead = undefined;
        });
    await this.addressRead;
  }
  private addressOptions(): void {
    const select = r521Node<HTMLSelectElement>("r521-address-select");
    const current = select.value;
    const main = document.createElement("option");
    main.value = "";
    main.textContent = "آدرس اصلی پروفایل";
    select.replaceChildren(main);
    for (const row of this.addresses) {
      const id = r521Text(row.id);
      if (!id) continue;
      const option = document.createElement("option");
      option.value = id;
      option.textContent = `${r521Text(row.title)} — ${r521Text(row.address)}`;
      select.append(option);
    }
    if (Array.from(select.options).some((x) => x.value === current))
      select.value = current;
    this.addressText();
  }
  private addressText(): string {
    const row =
      this.addresses.find(
        (x) => r521Text(x.id) === this.value("r521-address-select"),
      ) ?? r521Record(this.legacy.account().customer);
    const text = [row.province, row.city, row.address]
      .map(r521Text)
      .filter(Boolean)
      .join("، ");
    r521Node("r521-address-text").textContent =
      text || "نشانی در پروفایل ثبت نشده است.";
    return r521Text(row.address) ? text : "";
  }
  private async loadCredit(): Promise<void> {
    if (this.creditRead) {
      await this.creditRead;
      return;
    }
    if (typeof this.creditTerms.credit_commitment_sha256 === "string") return;
    r521Node("r521-credit-balance").textContent = "در حال دریافت اعتبار…";
    this.creditRead = this.repository
      .credit()
      .then((value) => {
        this.creditTerms = value;
        r521Node("r521-credit-balance").textContent =
          value.enabled === true
            ? "اعتبار قابل استفاده: " + r521Money(Number(value.available ?? 0))
            : "اعتبار این حساب فعال نیست.";
        r521Node("r521-credit-terms").textContent = r521Text(
          value.credit_commitment,
        );
      })
      .catch((error: unknown) => {
        r521Node("r521-credit-balance").textContent = r521Error(error);
      })
      .finally(() => {
        this.creditRead = undefined;
      });
    await this.creditRead;
  }
  private cartLines(): R521CartLine[] {
    this.legacy.total();
    const lines = this.legacy.cart();
    if (!lines.length) throw new Error("حداقل یک کالا به سفارش اضافه کنید");
    if (!["رسمی", "غیررسمی"].includes(this.invoice()))
      throw new Error("نوع فاکتور را انتخاب کنید");
    if (this.value("promoCode") && !this.legacy.applyPromo())
      throw new Error("کد تخفیف را بررسی کنید");
    const quantities = new Map<string, number>();
    for (const line of lines) {
      if (
        !line.key ||
        line.unit <= 0 ||
        !Number.isSafeInteger(line.qty) ||
        line.qty < 1
      )
        throw new Error("نوع قیمت و تعداد همه کالاها را بررسی کنید");
      quantities.set(
        line.product,
        (quantities.get(line.product) ?? 0) + line.qty,
      );
    }
    for (const [product, quantity] of quantities) {
      const model = this.legacy.products().find((x) => x.name === product);
      if (!model?.available || quantity > Number(model.stock ?? 0))
        throw new Error("موجودی «" + product + "» برای این تعداد کافی نیست");
    }
    return lines;
  }
  private async settlement(): Promise<{ method: string; data: R521Record }> {
    if (!this.addressText()) throw new Error("نشانی تحویل را انتخاب کنید");
    const cash = this.amount("cash"),
      check = this.amount("check"),
      credit = this.amount("credit"),
      total = this.total();
    if (cash + check + credit <= 0 || cash + check + credit > total)
      throw new Error("مبالغ تسویه را بررسی کنید");
    const data: R521Record = {
      split: true,
      invoice_total: total,
      cash_enabled: cash > 0,
      cash_amount: cash,
      check_enabled: check > 0,
      check_amount: check,
      credit_enabled: credit > 0,
      credit_amount: credit,
      invoice_remaining: total - cash - check - credit,
      company_invoice_remaining: total - cash - check - credit,
    };
    if (check > 0) {
      const number = r521Ascii(this.value("r521-check-number"));
      if (
        !/^\d{16}$/.test(number) ||
        !this.policy.banks.includes(this.value("r521-bank")) ||
        !this.value("r521-due")
      )
        throw new Error("شناسه صیادی ۱۶ رقمی، بانک و سررسید چک را وارد کنید");
      Object.assign(data, {
        check_number: number,
        bank_name: this.value("r521-bank"),
        due_date: this.value("r521-due"),
      });
    }
    if (credit > 0) {
      await this.loadCredit();
      if (
        this.creditTerms.enabled !== true ||
        credit > Number(this.creditTerms.available ?? 0)
      )
        throw new Error("اعتبار قابل استفاده برای این مبلغ کافی نیست");
      if (
        !this.checked("r521-consent") ||
        !r521Text(this.creditTerms.credit_commitment_sha256)
      )
        throw new Error("تعهد تسویه اعتباری را تأیید کنید");
      Object.assign(data, {
        terms_accepted: true,
        commitment_sha256: this.creditTerms.credit_commitment_sha256,
      });
    }
    const selected = [
      cash && "cash",
      check && "check",
      credit && "credit",
    ].filter(Boolean);
    return {
      method: selected.length > 1 ? "mixed" : String(selected[0]),
      data,
    };
  }
  private async image(id: string): Promise<string> {
    const file = r521Node<HTMLInputElement>(id).files?.[0];
    if (!file) return "";
    if (!file.type.startsWith("image/"))
      throw new Error("فایل انتخاب‌شده باید تصویر باشد");
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(
        1,
        this.policy.imageMaxPixels / Math.max(bitmap.width, bitmap.height),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("آماده‌سازی تصویر انجام نشد");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const data =
        canvas
          .toDataURL("image/jpeg", this.policy.imageQuality)
          .split(",")[1] ?? "";
      if (!data || data.length * 0.75 >= this.policy.imageMaxBytes)
        throw new Error("تصویر کوچک‌تری انتخاب کنید");
      return data;
    } finally {
      bitmap.close();
    }
  }
  private review(lines: R521CartLine[], settlement: R521Record): void {
    const root = r521Node("r521-stage-2");
    root.replaceChildren();
    const title = document.createElement("h3");
    title.textContent = "بررسی سفارش";
    root.append(title);
    for (const line of lines) {
      const row = document.createElement("div");
      row.className = "r521-panel";
      const name = document.createElement("b");
      name.textContent = line.product;
      const text = document.createElement("p");
      text.textContent = `${line.qty.toLocaleString("fa-IR")} عدد · قیمت واحد ${r521Money(line.unit)} · ${r521Money(line.line)}`;
      row.append(name, text);
      root.append(row);
    }
    const info = document.createElement("div");
    info.className = "r521-panel";
    for (const line of [
      `فاکتور ${this.invoice()}`,
      `نشانی تحویل: ${this.addressText()}`,
      `نقد ${r521Money(Number(settlement.cash_amount))}، چک ${r521Money(Number(settlement.check_amount))}، اعتباری ${r521Money(Number(settlement.credit_amount))}`,
      `جمع سفارش: ${r521Money(this.total())}`,
    ]) {
      const row = document.createElement("p");
      row.textContent = line;
      info.append(row);
    }
    root.append(info);
  }
  private async advance(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const next = r521Node<HTMLButtonElement>("r521-next");
    const back = r521Node<HTMLButtonElement>("r521-back");
    next.disabled = true;
    back.disabled = true;
    this.error("");
    try {
      const lines = this.cartLines();
      if (this.stage === 0) {
        this.setStage(1);
        try {
          await this.loadAddresses();
        } catch (error: unknown) {
          this.addressOptions();
          this.error(r521Error(error));
        }
      } else {
        const settlement = await this.settlement();
        if (this.stage === 1) {
          this.review(lines, settlement.data);
          this.setStage(2);
        } else {
          if (Number(settlement.data.cash_amount) > 0)
            settlement.data.cash_image_base64 =
              await this.image("r521-cash-image");
          if (Number(settlement.data.check_amount) > 0) {
            const image = await this.image("r521-check-image");
            Object.assign(settlement.data, {
              check_image_base64: image,
              image_base64: image,
            });
          }
          const merged = new Map<
            string,
            { product: string; price_key: string; qty: number }
          >();
          for (const line of lines) {
            const key = `${line.product}\u0000${line.key}`;
            merged.set(key, {
              product: line.product,
              price_key: line.key,
              qty: (merged.get(key)?.qty ?? 0) + line.qty,
            });
          }
          const result = r521Record(
            await this.repository.post("/api/orders/add", {
              items: [...merged.values()],
              address_id: this.value("r521-address-select"),
              invoice_type: this.invoice(),
              requested_payment_method: settlement.method,
              settlement_details: settlement.data,
              notes: this.value("notes"),
              promo_code: this.value("promoCode"),
            }),
          );
          this.draft.clear(this.accountKey());
          r521Node("orderItems").replaceChildren();
          r521Node<HTMLInputElement>("notes").value = "";
          for (const input of document.querySelectorAll<HTMLInputElement>(
            '#newOrder input[type="radio"],#r521-stage-1 input[type="file"]',
          )) {
            if (input.type === "file") input.value = "";
            else input.checked = false;
          }
          this.cashEdited = false;
          r521Node<HTMLInputElement>("r521-cash-on").checked = true;
          for (const id of ["r521-check-on", "r521-credit-on", "r521-consent"])
            r521Node<HTMLInputElement>(id).checked = false;
          for (const id of [
            "r521-check",
            "r521-credit",
            "r521-bank",
            "r521-check-number",
            "r521-due",
          ])
            r521Node<HTMLInputElement>(id).value = "";
          this.legacy.clearPromo();
          this.legacy.add();
          this.setStage(0);
          this.busy = false;
          this.legacy.navigate("orders");
          try {
            await this.legacy.reload();
          } catch {
            /* The order is already registered. */
          }
          const confirmation = document.createElement("p");
          confirmation.className = "r521-panel";
          confirmation.setAttribute("role", "status");
          confirmation.textContent = `سفارش ${r521Text(result.number)} ثبت شد و در انتظار تأیید شرکت است.`;
          document.getElementById("r521-confirmation")?.remove();
          confirmation.id = "r521-confirmation";
          r521Node("orders").prepend(confirmation);
        }
      }
    } catch (error: unknown) {
      this.error(r521Error(error));
    } finally {
      this.busy = false;
      next.disabled = false;
      back.disabled = false;
    }
  }
}

/** Match the app's account navigation and preserve existing portal actions. */
class R521Portal {
  private readonly checkout: R521Checkout;
  private mounted = false;
  private dark = false;
  private pageTitle: HTMLElement | undefined;
  private readonly headerImages: { image: HTMLImageElement; name: string }[] =
    [];
  private readNotifications: Promise<void> | undefined;
  private notificationsLoaded = false;
  constructor(
    private readonly policy: R521Policy,
    private readonly repository: R521Repository,
    private readonly legacy: R521Legacy,
  ) {
    this.checkout = new R521Checkout(policy, repository, legacy);
    try {
      this.dark = localStorage.getItem("gp-r521-theme") === "dark";
    } catch {
      /* Optional preference. */
    }
    this.theme();
    this.loginAction();
  }
  /** Attach the new customer UI after the existing server-authenticated bootstrap. */
  mount(): void {
    if (this.mounted || !this.legacy.customer()) return;
    const header = document.querySelector<HTMLElement>("#app > header");
    const title = header?.querySelector<HTMLElement>(".brand b");
    if (!header || !title) return;
    this.pageTitle = title;
    const identity = r521Node("identity");
    identity.textContent = "قدیر پارتنر";
    const logo = header.querySelector<HTMLImageElement>(".brand img");
    if (logo && this.policy.assets.r54_logo)
      logo.src = this.policy.assets.r54_logo;
    const actions = document.createElement("div");
    actions.className = "r521-header-actions";
    actions.append(
      this.iconButton("طرح‌ها و آفرها", "r54_offers", () =>
        this.legacy.navigate("r521-offers-page"),
      ),
      this.iconButton("حالت روز و شب", "r54_theme", () => {
        this.dark = !this.dark;
        this.theme();
      }),
      this.iconButton("اعلان‌ها", "r54_bell", () =>
        this.legacy.navigate("r521-inbox-page"),
      ),
    );
    header.append(actions);
    for (const item of this.policy.navigation) {
      const button = r521Node("nav").querySelector<HTMLButtonElement>(
        `[data-page="${item.page}"]`,
      );
      const icon = this.policy.assets[item.icon];
      if (!button || !icon) continue;
      const image = document.createElement("span");
      image.className = "r521-nav-icon";
      image.setAttribute("aria-hidden", "true");
      image.style.setProperty("--r521-icon", `url("${icon}")`);
      const label = document.createElement("span");
      label.textContent = item.title;
      button.replaceChildren(image, label);
      r521Node("nav").append(button);
    }
    this.home();
    this.profile();
    this.catalogSearch();
    this.orderFilters();
    this.checkout.install();
    this.mounted = true;
    document.body.dataset.r521 = this.policy.reference;
    this.page("dashboard");
    this.refresh();
  }
  /** Prevent duplicate submission and navigation while checkout commits. */
  blocked(page: string): boolean {
    return this.mounted && page !== "newOrder" && this.checkout.submitting();
  }
  /** Keep the top bar and selected tab aligned with the active screen. */
  page(page: string): void {
    if (!this.mounted || !this.pageTitle) return;
    const titles: Record<string, string> = {
      "r521-offers-page": "طرح‌ها و آفرها",
      "r521-inbox-page": "اعلان‌ها",
      "r521-report-page": "گزارش خرید",
      "r521-documents-page": "اسناد و پیش‌فاکتورها",
      "r521-serials-page": "سریال دستگاه‌ها",
    };
    this.pageTitle.textContent =
      this.policy.navigation.find((x) => x.page === page)?.title ??
      titles[page] ??
      "قدیر پارتنر";
    const selected = [
      "r521-report-page",
      "r521-documents-page",
      "r521-serials-page",
    ].includes(page)
      ? "profilePage"
      : page.startsWith("r521-")
        ? "dashboard"
        : page;
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "#nav [data-page]",
    )) {
      const active = button.dataset.page === selected;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    if (page === "newOrder") this.checkout.enter();
    if (page === "r521-inbox-page") void this.inbox();
    if (page === "r521-documents-page" || page === "r521-serials-page")
      this.documents(page === "r521-serials-page");
  }
  /** Normalize price tiers immediately before the existing calculation. */
  normalizeCart(): void {
    if (this.mounted) this.checkout.normalize();
  }
  /** Refresh summaries after the existing cart recalculation. */
  cartChanged(): void {
    if (this.mounted) this.checkout.changed();
  }
  /** Reflect refreshed customer data without replacing registered event handlers. */
  refresh(): void {
    if (!this.mounted) return;
    const customer = r521Record(this.legacy.account().customer);
    r521Node("r521-greeting").textContent =
      "سلام، " + (r521Text(customer.name) || "همکار گرامی");
    const activeOrders = this.accountOrders().filter(
      (order) => order.status !== "تحویل شد" && order.status !== "لغو شد",
    ).length;
    r521Node("r521-open-orders").textContent =
      activeOrders.toLocaleString("fa-IR") + " سفارش";
    const month = r521Node("buyMonthAmount").textContent || "۰";
    r521Node("r521-month-total").textContent = month.includes("تومان")
      ? month
      : month + " تومان";
    const offers = this.legacy.offers().filter((x) => !x.used_by_customer);
    const featured =
      offers.find((x) => r521Text(x.title).includes("میکس")) ?? offers[0];
    r521Node("r521-offer-title").textContent =
      r521Text(featured?.title) || "طرح‌ها و آفرهای قدیر پارتنر";
    r521Node("r521-offer-text").textContent =
      r521Text(featured?.description) ||
      "پیشنهادهای مجاز حساب شما در بخش آفرها نمایش داده می‌شوند.";
    if (!this.notificationsLoaded)
      this.countNotices(r521Amount(r521Node("noticeCount").textContent ?? ""));
    this.renderOrderCards();
    this.applyOrderFilter();
    this.applyCatalogSearch();
    const balance = document.getElementById("gp-credit-balance");
    if (balance) r521Node("profilePage").append(balance);
  }
  private iconButton(
    label: string,
    name: string,
    click: () => void,
  ): HTMLButtonElement {
    const button = r521Button("", click);
    button.className = "r521-icon-btn";
    button.setAttribute("aria-label", label);
    button.title = label;
    const img = document.createElement("img");
    img.alt = "";
    img.src =
      this.policy.assets[this.dark ? name + "_dark" : name] ??
      this.policy.assets[name] ??
      "";
    button.append(img);
    this.headerImages.push({ image: img, name });
    if (name === "r54_bell") {
      const count = document.createElement("span");
      count.id = "r521-unread";
      count.className = "r521-unread";
      count.hidden = true;
      button.append(count);
    }
    return button;
  }
  private theme(): void {
    document.documentElement.dataset.r521Theme = this.dark ? "dark" : "light";
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", this.dark ? "#0c131d" : "#e9eff5");
    for (const { image, name } of this.headerImages)
      image.src =
        this.policy.assets[this.dark ? name + "_dark" : name] ??
        this.policy.assets[name] ??
        "";
    try {
      localStorage.setItem("gp-r521-theme", this.dark ? "dark" : "light");
    } catch {
      /* Optional preference. */
    }
  }
  private newPage(id: string, title: string, content: HTMLElement): void {
    const page = document.createElement("section");
    page.id = id;
    page.className = "page hidden";
    const card = document.createElement("div");
    card.className = "r521-panel r521-grid";
    const heading = document.createElement("h2");
    heading.textContent = title;
    card.append(
      heading,
      content,
      r521Button("بازگشت", () =>
        this.legacy.navigate(
          [
            "r521-report-page",
            "r521-documents-page",
            "r521-serials-page",
          ].includes(id)
            ? "profilePage"
            : "dashboard",
        ),
      ),
    );
    page.append(card);
    r521Node("dashboard").parentElement?.append(page);
  }
  private home(): void {
    const root = document.querySelector<HTMLElement>("#dashboard .portal-home");
    if (!root) throw new Error("پیشخوان در دسترس نیست");
    const recent = r521Node("dashboardRecentOrders").closest<HTMLElement>(
      ".recent-orders-card",
    );
    this.newPage(
      "r521-offers-page",
      "طرح‌ها و آفرها",
      r521Node("specialOffers"),
    );
    const inbox = document.createElement("div");
    inbox.id = "r521-inbox-list";
    inbox.className = "r521-grid";
    inbox.append(r521Node("dashboardNotices"));
    this.newPage("r521-inbox-page", "اعلان‌ها", inbox);
    this.newPage(
      "r521-report-page",
      "گزارش خرید من",
      r521Node("customerPurchaseReport"),
    );
    for (const child of root.children) child.classList.add("r521-legacy-home");
    const greeting = document.createElement("div");
    greeting.className = "r521-greeting";
    greeting.innerHTML = '<h2 id="r521-greeting"></h2><p>خلاصه حساب شما</p>';
    const overview = document.createElement("div");
    overview.className = "r521-panel";
    overview.innerHTML =
      '<div class="r521-detail"><span>سفارش در جریان</span><b id="r521-open-orders">۰ سفارش</b></div><div class="r521-detail"><span>خرید این ماه</span><b id="r521-month-total">۰ تومان</b></div>';
    const create = r521Button(
      "ثبت سفارش جدید",
      () => this.legacy.navigate("newOrder"),
      true,
    );
    create.classList.add("r521-full");
    const offer = document.createElement("div");
    offer.className = "r521-panel r521-offer";
    offer.innerHTML =
      '<h3 id="r521-offer-title"></h3><p id="r521-offer-text"></p>';
    offer.append(
      r521Button("مشاهده آفر", () => this.legacy.navigate("r521-offers-page")),
    );
    root.prepend(greeting, overview, create, offer);
    if (recent) {
      recent.classList.remove("r521-legacy-home");
      root.append(recent);
    }
  }
  private profile(): void {
    const card = document.createElement("div");
    card.className = "r521-panel r521-grid";
    card.append(
      r521Button("آدرس‌ها", () => this.checkout.addressDialog()),
      r521Button("گزارش خرید", () => this.legacy.navigate("r521-report-page")),
      r521Button("خروج از حساب", () => {
        void this.legacy.logout();
      }),
    );
    for (const [id, label] of [
      ["r521-documents-page", "اسناد و پیش‌فاکتورها"],
      ["r521-serials-page", "سریال دستگاه‌ها"],
    ] as const) {
      const list = document.createElement("div");
      list.id = id + "-list";
      list.className = "r521-grid";
      this.newPage(id, label, list);
      card.prepend(r521Button(label, () => this.legacy.navigate(id)));
    }
    r521Node("profilePage").append(card);
  }
  private catalogSearch(): void {
    const grid = r521Node("catalogGrid");
    const bar = document.createElement("div");
    bar.className = "r521-grid r521-order-filters";
    bar.innerHTML =
      '<label>جست‌وجوی مدل<input id="r521-catalog-search" type="search" placeholder="نام دستگاه یا سازنده"></label><label>نوع قیمت<select id="r521-price-group"></select></label><label>موجودی<select id="r521-stock-filter"><option value="">همه کالاها</option><option value="available">موجود</option><option value="unavailable">ناموجود</option></select></label>';
    const list = document.createElement("div");
    list.id = "r521-catalog-list";
    list.className = "r521-grid";
    bar.addEventListener("input", () => this.applyCatalogSearch());
    grid.before(bar, list);
    grid.classList.add("r521-legacy-list");
  }
  private applyCatalogSearch(): void {
    const search = document.querySelector<HTMLInputElement>(
      "#r521-catalog-search",
    );
    if (!search) return;
    const group = r521Node<HTMLSelectElement>("r521-price-group");
    const active = group.value;
    const groups: Record<string, string> = {
      agent: "عامل فروش",
      panel: "ثبت در پنل",
      serial: "سریال آزاد",
    };
    const allowed = visiblePriceGroups().filter((key) => groups[key]);
    group.replaceChildren(
      ...allowed.map((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = groups[key] ?? key;
        return option;
      }),
    );
    if (allowed.includes(active)) group.value = active;
    else if (allowed.includes("serial")) group.value = "serial";
    const keys: Record<string, string[]> = {
      agent: ["sales_agent"],
      panel: ["panel_cash", "panel_7d", "panel_1m"],
      serial: ["serial_1_50", "serial_51_200"],
    };
    const list = r521Node("r521-catalog-list");
    list.replaceChildren();
    const query = r521Ascii(search.value).trim().toLocaleLowerCase("fa-IR");
    const stockFilter = r521Node<HTMLSelectElement>("r521-stock-filter").value;
    for (const product of this.legacy.products()) {
      const name = r521Text(product.name),
        maker = r521Text(product.manufacturer);
      const stock = !!product.available && Number(product.stock) > 0;
      if (
        !name ||
        !r521Ascii(name + " " + maker)
          .toLocaleLowerCase("fa-IR")
          .includes(query) ||
        (stockFilter === "available" && !stock) ||
        (stockFilter === "unavailable" && stock)
      )
        continue;
      const prices = r521Record(product.prices);
      const priceKeys = (keys[group.value] ?? []).filter(
        (key) => Number(prices[key] ?? 0) > 0,
      );
      const card = document.createElement("article");
      card.className = "r521-panel r521-grid";
      const title = document.createElement("h3");
      title.textContent = name;
      card.append(title);
      const sub = document.createElement("small");
      sub.textContent = [maker, stock ? "موجود" : "ناموجود"]
        .filter(Boolean)
        .join(" · ");
      card.append(sub);
      for (const key of priceKeys)
        card.append(
          this.detailLine(
            PRICE_LABELS[key] ?? key,
            r521Money(Number(prices[key])),
          ),
        );
      if (stock && priceKeys.length)
        card.append(
          r521Button(
            "ثبت سفارش",
            () => {
              this.legacy.navigate("newOrder");
              this.legacy.add(name, priceKeys[0]);
            },
            true,
          ),
        );
      list.append(card);
    }
    if (!list.children.length)
      list.textContent = "کالایی با این فیلتر پیدا نشد.";
  }
  private detailLine(label: string, value: string): HTMLElement {
    const row = document.createElement("div");
    row.className = "r521-detail";
    const title = document.createElement("span");
    title.textContent = label;
    const text = document.createElement("b");
    text.textContent = value;
    row.append(title, text);
    return row;
  }
  private accountOrders(): R521Record[] {
    return Array.isArray(orders)
      ? orders
          .map(r521Record)
          .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
      : [];
  }
  private renderOrderCards(): void {
    const list = document.getElementById("r521-order-list");
    if (!list) return;
    list.replaceChildren();
    for (const order of this.accountOrders()) {
      const id = Number(order.id ?? 0);
      if (!Number.isSafeInteger(id) || id < 1) continue;
      const card = document.createElement("article");
      card.className = "r521-panel r521-grid r521-order-card";
      card.dataset.status = r521Text(order.status);
      const title = document.createElement("h3");
      title.textContent = "سفارش " + r521Text(order.number);
      card.append(title);
      const items = Array.isArray(order.items)
        ? order.items.map(r521Record)
        : [];
      const line = items
        .map(
          (item) =>
            r521Text(item.product) +
            " × " +
            Number(item.qty ?? 0).toLocaleString("fa-IR"),
        )
        .join("، ");
      if (line) card.append(this.detailLine("اقلام سفارش", line));
      card.append(
        this.detailLine("وضعیت", r521Text(order.status)),
        this.detailLine("تسویه", r521Text(order.payment_status)),
        this.detailLine(
          "مبلغ",
          r521Money(Number(order.approved_total || order.estimated_total || 0)),
        ),
      );
      const actions = document.createElement("div");
      actions.className = "r521-actions";
      const old = [...r521Node("ordersBody").querySelectorAll("tr")].find(
        (row) =>
          row.querySelector('[data-label="شماره"]')?.textContent?.trim() ===
          r521Text(order.number),
      );
      const existing = old?.querySelector('[data-label="عملیات"]');
      if (existing?.children.length)
        for (const child of existing.children)
          actions.append(child.cloneNode(true));
      else
        actions.append(
          r521Button("مشاهده سفارش", () => this.legacy.orderDetail(id)),
        );
      card.append(actions);
      list.append(card);
    }
    if (!list.children.length) {
      const empty = document.createElement("p");
      empty.textContent = "هنوز سفارشی ندارید.";
      list.append(
        empty,
        r521Button(
          "ثبت اولین سفارش",
          () => this.legacy.navigate("newOrder"),
          true,
        ),
      );
    }
  }
  private documents(serials: boolean): void {
    const list = r521Node(
      serials ? "r521-serials-page-list" : "r521-documents-page-list",
    );
    list.replaceChildren();
    for (const order of this.accountOrders()) {
      const id = Number(order.id ?? 0);
      if (
        !Number.isSafeInteger(id) ||
        id < 1 ||
        (serials && order.status !== "تحویل شد")
      )
        continue;
      const row = document.createElement("div");
      row.className = "r521-panel r521-grid";
      const title = document.createElement("strong");
      title.textContent = "سفارش " + r521Text(order.number);
      row.append(title);
      row.append(
        this.detailLine("وضعیت", r521Text(order.status)),
        r521Button("مشاهده سفارش", () => this.legacy.orderDetail(id)),
      );
      if (serials)
        row.append(
          r521Button(
            "دانلود اکسل سریال‌ها",
            () => {
              void downloadOrderSerials(id);
            },
            true,
          ),
        );
      else {
        const pdf = document.createElement("a");
        pdf.href =
          BASE + "pdf/order-details?id=" + encodeURIComponent(String(id));
        pdf.target = "_blank";
        pdf.rel = "noopener";
        pdf.className = "r521-link";
        pdf.textContent = "پیش‌فاکتور / PDF";
        row.append(pdf);
      }
      list.append(row);
    }
    if (!list.children.length)
      list.textContent = serials
        ? "سفارش تحویل‌شده‌ای وجود ندارد."
        : "هنوز سندی برای نمایش وجود ندارد.";
  }
  private orderFilters(): void {
    const wrap = document.querySelector<HTMLElement>("#orders .tablewrap");
    if (!wrap) return;
    const bar = document.createElement("div");
    bar.className = "r521-grid r521-order-filters";
    bar.innerHTML =
      '<label>جست‌وجوی سفارش<input id="r521-order-search" type="search" placeholder="شماره سفارش یا نام کالا"></label><label>وضعیت<select id="r521-order-filter"><option value="">همه سفارش‌ها</option><option>در انتظار تأیید</option><option>در حال آماده سازی</option><option>آماده ارسال</option><option>ارسال شد</option><option>تحویل شد</option><option>لغو شد</option></select></label>';
    bar.addEventListener("input", () => this.applyOrderFilter());
    const cards = document.createElement("div");
    cards.id = "r521-order-list";
    cards.className = "r521-grid";
    wrap.before(bar, cards);
    wrap.classList.add("r521-legacy-list");
  }
  private applyOrderFilter(): void {
    const search =
      document.querySelector<HTMLInputElement>("#r521-order-search");
    const filter =
      document.querySelector<HTMLSelectElement>("#r521-order-filter");
    if (!search || !filter) return;
    const query = r521Ascii(search.value).trim().toLocaleLowerCase("fa-IR");
    for (const row of document.querySelectorAll<HTMLTableRowElement>(
      "#ordersBody > tr",
    )) {
      const text = r521Ascii(row.textContent ?? "").toLocaleLowerCase("fa-IR");
      const status =
        row.querySelector('[data-label="مرحله"]')?.textContent ?? "";
      row.hidden =
        (query !== "" && !text.includes(query)) ||
        (filter.value !== "" && !status.includes(filter.value));
    }
    for (const card of document.querySelectorAll<HTMLElement>(
      "#orders .mobile-order-card,#r521-order-list .r521-order-card",
    )) {
      const text = r521Ascii(card.textContent ?? "").toLocaleLowerCase("fa-IR");
      card.hidden =
        (query !== "" && !text.includes(query)) ||
        (filter.value !== "" && !text.includes(filter.value));
    }
  }
  private countNotices(count: number): void {
    const node = document.getElementById("r521-unread");
    if (!node) return;
    node.hidden = count < 1;
    node.textContent = count.toLocaleString("fa-IR");
  }
  private async inbox(): Promise<void> {
    if (this.readNotifications) {
      await this.readNotifications;
      return;
    }
    this.readNotifications = this.renderInbox().finally(() => {
      this.readNotifications = undefined;
    });
    await this.readNotifications;
  }
  private async renderInbox(): Promise<void> {
    const root = r521Node("r521-inbox-list");
    try {
      const raw = await api("/api/notifications");
      const result = r521Record(raw);
      const rows = Array.isArray(raw) ? raw : result.items;
      if (!Array.isArray(rows) || !rows.length) return;
      this.notificationsLoaded = true;
      root.replaceChildren();
      const entries = rows.map(r521Record).filter((x) => r521Text(x.id));
      this.countNotices(entries.filter((x) => !x.read).length);
      for (const item of entries) {
        const card = document.createElement("article");
        card.className = "r521-panel";
        const heading = document.createElement("b");
        heading.textContent = r521Text(item.title);
        const message = document.createElement("p");
        message.textContent = r521Text(item.body);
        const open = r521Button(item.read ? "مشاهده" : "خواندم", () => {
          void (async () => {
            try {
              if (!item.read && !Array.isArray(raw))
                await this.repository.post("/api/notifications/read", {
                  ids: [r521Text(item.id)],
                });
              item.read = true;
              this.countNotices(entries.filter((x) => !x.read).length);
              open.textContent = "مشاهده";
              const order = Number(item.order_id ?? 0);
              if (order > 0 && Number.isSafeInteger(order))
                this.legacy.orderDetail(order);
              else if (item.offer_id) this.legacy.navigate("r521-offers-page");
            } catch (error: unknown) {
              message.textContent = r521Error(error);
            }
          })();
        });
        card.append(heading, message, open);
        root.append(card);
      }
    } catch {
      /* The existing account activity feed is available here. */
    }
  }
  private loginAction(): void {
    const form = document.getElementById("loginForm");
    if (!form) return;
    const logo = form.querySelector<HTMLImageElement>("img");
    if (logo && this.policy.assets.r54_logo)
      logo.src = this.policy.assets.r54_logo;
    form.append(r521Button("ورود با کد پیامکی", () => this.otp()));
  }
  private otp(): void {
    const dialog = document.createElement("dialog");
    dialog.className = "r521-date r521-grid";
    dialog.setAttribute("aria-label", "ورود با کد پیامکی");
    dialog.innerHTML =
      '<h3>ورود با کد پیامکی</h3><label>شماره همراه<input id="r521-otp-mobile" type="tel" inputmode="tel" autocomplete="tel"></label><label id="r521-otp-wrap" hidden>کد تأیید<input id="r521-login-otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label><p id="r521-otp-message" role="status"></p>';
    document.body.append(dialog);
    r521Node<HTMLInputElement>("r521-otp-mobile").value =
      r521Node<HTMLInputElement>("username").value;
    let sent = false;
    const send = r521Button(
      "ارسال کد",
      () => {
        void (async () => {
          const mobile = r521Ascii(
            r521Node<HTMLInputElement>("r521-otp-mobile").value,
          ).trim();
          const status = r521Node("r521-otp-message");
          if (!/^09\d{9}$/.test(mobile)) {
            status.textContent = "شماره همراه را وارد کنید";
            return;
          }
          const otp = r521Ascii(
            r521Node<HTMLInputElement>("r521-login-otp").value,
          ).trim();
          if (sent && !/^\d{6}$/.test(otp)) {
            status.textContent = "کد شش‌رقمی را وارد کنید";
            return;
          }
          send.disabled = true;
          try {
            if (sent) {
              await this.repository.post("/api/native/login-otp/confirm", {
                mobile,
                otp,
              });
              dialog.close();
              await this.legacy.login();
            } else {
              await this.repository.post("/api/native/login-otp/request", {
                mobile,
              });
              sent = true;
              r521Node("r521-otp-wrap").hidden = false;
              r521Node<HTMLInputElement>("r521-otp-mobile").readOnly = true;
              status.textContent = "کد تأیید ارسال شد.";
              send.textContent = "تأیید و ورود";
              r521Node("r521-login-otp").focus();
            }
          } catch (error: unknown) {
            status.textContent = r521Error(error);
          } finally {
            send.disabled = false;
          }
        })();
      },
      true,
    );
    dialog.append(
      send,
      r521Button("بستن", () => dialog.close()),
    );
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
  }
}

(() => {
  const view: Window = window;
  const policy = r521Policy(view.GP_PORTAL_R521_POLICY);
  const legacy: R521Legacy = {
    customer: () => isCustomer(),
    account: () => r521Record(me),
    cart: () => cartSnapshot(),
    offers: () => (Array.isArray(offers) ? offers.map(r521Record) : []),
    products: () => (Array.isArray(catalog) ? catalog.map(r521Record) : []),
    navigate: (page) => show(page),
    add: (product, key) => addItem(product, key),
    total: () => updateDraft(),
    reload: () => loadAll(),
    applyPromo: () => applyPromoCode(),
    clearPromo: () => clearAppliedPromo(true),
    login: () => boot(),
    logout: () => logout(),
    orderDetail: (id) => details(id),
  };
  view.gpPortalR521 = new R521Portal(policy, new R521Repository(api), legacy);
})();

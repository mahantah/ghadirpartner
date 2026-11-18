/** Use the automation session's existing access control and sidebar behaviour. */
declare function has(role: string): boolean;
declare function setSidebar(open: boolean): void;

interface BazaarReleaseRow {
  id: string;
  state: string;
  version_name?: string;
  version_code?: number;
  bytes: number;
  created_at: string;
  error?: string;
  file_removed: boolean;
  sha256?: string;
  auto_publish?: boolean;
}
interface BazaarSummary {
  csrf: string;
  releases: BazaarReleaseRow[];
  token_configured: boolean;
  environment_token: boolean;
  ready: boolean;
  network_ready: boolean;
  policy: {
    maximum_apk_bytes: number;
    chunk_bytes: number;
    maximum_changelog_chars: number;
    package_name: string;
  };
}
interface BazaarUpload {
  id: string;
  received: number;
  state?: string;
}

(() => {
  /** Keep the session CSRF token private to this authenticated page instance. */
  class BazaarClient {
    private csrf = "";
    private readonly endpoint = "/api/admin/app-releases";

    /** Load local history without contacting the Bazaar service. */
    async summary(): Promise<BazaarSummary> {
      const value = await this.request<BazaarSummary>(this.endpoint);
      this.csrf = value.csrf;
      return value;
    }

    /** Execute an explicitly requested admin action. */
    async action<T>(
      action: string,
      values: Record<string, unknown> = {},
    ): Promise<T> {
      return this.request<T>(this.endpoint, { action, ...values });
    }

    /** Upload a bounded binary chunk under the same authenticated CSRF contract. */
    async chunk(
      id: string,
      offset: number,
      bytes: Blob,
    ): Promise<BazaarUpload> {
      const form = new FormData();
      form.set("id", id);
      form.set("offset", String(offset));
      form.set("chunk", bytes, "chunk.bin");
      return this.request<BazaarUpload>(this.endpoint + "/chunk", form);
    }

    private async request<T>(
      path: string,
      payload?: Record<string, unknown> | FormData,
    ): Promise<T> {
      const options: RequestInit = {
        cache: "no-store",
        credentials: "same-origin",
      };
      if (payload !== undefined) {
        options.method = "POST";
        options.headers = { "X-GP-Release-CSRF": this.csrf };
        if (payload instanceof FormData) options.body = payload;
        else {
          options.headers["Content-Type"] = "application/json";
          options.body = JSON.stringify(payload);
        }
      }
      const response = await fetch(path, options);
      const raw = await response.text();
      let value: unknown = null;
      try {
        value = JSON.parse(raw) as unknown;
      } catch {
        /* The existing automation returns text for rejected requests. */
      }
      if (!response.ok) {
        const candidate =
          typeof value === "object" &&
          value !== null &&
          "error" in value &&
          typeof value.error === "string"
            ? value.error
            : raw;
        const message =
          candidate.length > 0 &&
          candidate.length <= 500 &&
          !/[<>]/.test(candidate)
            ? candidate
            : "عملیات انجام نشد؛ دوباره وضعیت را بررسی کنید.";
        throw new Error(message);
      }
      if (value === null)
        throw new Error(
          "پاسخ سرور قابل پردازش نیست؛ وضعیت را دوباره بررسی کنید.",
        );
      return value as T;
    }
  }

  /** Provide a compact RTL release page under the administrator's system settings menu. */
  class BazaarPage {
    private readonly page = document.createElement("section");
    private readonly link = document.createElement("button");
    private readonly status = document.createElement("p");
    private readonly history = document.createElement("div");
    private readonly remote = document.createElement("div");
    private readonly tokenHint = document.createElement("p");
    private readonly progress = document.createElement("progress");
    private readonly controls = document.createElement("fieldset");
    private readonly uploadForm = document.createElement("form");
    private readonly tokenForm = document.createElement("form");
    private summary: BazaarSummary | null = null;
    private busy = false;
    private generation = 0;

    constructor(
      private readonly app: HTMLElement,
      menu: Element,
      private readonly client: BazaarClient,
    ) {
      this.page.id = "gpAppReleasesPage";
      this.page.className = "tab hidden gp-app-releases";
      this.page.dir = "rtl";
      this.link.type = "button";
      this.link.className = "adminOnly hidden";
      this.link.dataset.gpAppReleases = "";
      this.link.setAttribute("aria-controls", this.page.id);
      const icon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute(
        "d",
        "M8 3h8v18H8zM10 18h4M3 10l3-3 3 3M6 7v9m9-2 3 3 3-3m-3 3V8",
      );
      icon.append(path);
      this.link.append(icon, this.text("span", "مدیریت نسخه‌های اپ"));
      menu.append(this.link);
      this.app.append(this.page);
    }

    /** Mount the forms once and forget all loaded state when the admin session ends. */
    mount(): void {
      const heading = this.text("h2", "مدیریت نسخه‌های اپ");
      this.status.setAttribute("role", "status");
      this.status.setAttribute("aria-live", "polite");
      this.controls.className = "gp-release-controls";
      const tokenCard = this.card("اتصال به API پیشخان بازار");
      const token = this.input("token", "password", "توکن API برنامه در بازار");
      token.autocomplete = "new-password";
      token.maxLength = 8192;
      this.tokenForm.append(
        this.label("توکن برنامهٔ قدیر پارتنر", token),
        this.button("ذخیره توکن"),
      );
      this.tokenForm.addEventListener("submit", (event) => {
        event.preventDefault();
        void this.run(async () => {
          await this.client.action("save_token", { token: token.value });
          token.value = "";
          await this.load();
          this.status.textContent = "توکن در سرور ذخیره شد.";
        });
      });
      tokenCard.append(
        this.tokenHint,
        this.tokenForm,
        this.text(
          "p",
          "توکن را از برنامهٔ قدیر پارتنر در پیشخان بازار ← API پیشخان بازار دریافت کنید. مقدار ذخیره‌شده دوباره نمایش داده نمی‌شود.",
        ),
      );
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
      this.uploadForm.append(
        this.label("فایل APK امضاشده", file),
        this.label("توضیحات فارسی نسخه", fa),
        this.label("توضیحات انگلیسی ـ اختیاری", en),
        this.label("یادداشت برای تیم بررسی بازار ـ اختیاری", note),
        this.progress,
        this.button("بارگذاری و بررسی فایل"),
      );
      this.uploadForm.addEventListener("submit", (event) => {
        event.preventDefault();
        void this.run(() => this.upload(file, fa, en, note));
      });
      uploadCard.append(
        this.text(
          "p",
          "نام بسته، شمارهٔ نسخه، امضای دیجیتال و سلامت کامل فایل بررسی می‌شوند. پس از بارگذاری، روش ارسال به بازار را از کارت نسخه انتخاب کنید.",
        ),
        this.uploadForm,
      );
      const historyCard = this.card("نسخه‌ها و نتیجهٔ ارسال");
      const refresh = this.button("بررسی وضعیت در بازار", () =>
        this.run(async () => {
          const result =
            await this.client.action<
              Record<
                string,
                { packages: { version_name?: string; version_code?: number }[] }
              >
            >("refresh");
          this.remote.replaceChildren();
          for (const [key, title] of [
            ["draft", "پیش‌نویس"],
            ["committed", "ارسال‌شده برای بررسی"],
            ["published", "منتشرشده"],
          ]) {
            if (!key) continue;
            this.remote.append(
              this.text(
                "p",
                `${title}: ${result[key]?.packages.map((p) => `${p.version_name ?? ""} (${p.version_code ?? ""})`).join("، ") || "وجود ندارد"}`,
              ),
            );
          }
          this.status.textContent = "وضعیت بازار دریافت شد.";
        }),
      );
      historyCard.append(refresh, this.remote, this.history);
      this.controls.append(tokenCard, uploadCard, historyCard);
      this.page.append(heading, this.status, this.controls);
      this.link.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!this.admin()) return;
        document
          .querySelectorAll(".tab")
          .forEach((tab) => tab.classList.add("hidden"));
        this.page.classList.remove("hidden");
        document
          .querySelectorAll(".topnav [data-tab]")
          .forEach((button) => button.classList.remove("active"));
        this.link.classList.add("active");
        if (typeof setSidebar === "function") setSidebar(false);
        void this.run(() => this.load());
      });
      const update = (): void => {
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

    private async load(): Promise<void> {
      const generation = this.generation;
      const summary = await this.client.summary();
      if (generation !== this.generation || !this.admin()) return;
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
        throw new Error(
          "ابزار بررسی امضای APK روی سرور آماده نیست؛ افزونه‌های OpenSSL، iconv و zlib را بررسی کنید.",
        );
      if (!summary.network_ready)
        this.status.textContent =
          "بارگذاری محلی آماده است؛ برای ارتباط با بازار باید cURL روی سرور فعال باشد.";
    }

    private async upload(
      input: HTMLInputElement,
      fa: HTMLTextAreaElement,
      en: HTMLTextAreaElement,
      note: HTMLTextAreaElement,
    ): Promise<void> {
      const file = input.files?.[0];
      const summary = this.summary;
      if (
        !file ||
        !summary ||
        !file.name.toLowerCase().endsWith(".apk") ||
        file.size > summary.policy.maximum_apk_bytes
      )
        throw new Error("فایل APK با اندازهٔ مجاز انتخاب کنید.");
      const generation = this.generation;
      this.status.textContent = "در حال آماده‌سازی فایل…";
      const hash = await crypto.subtle.digest(
        "SHA-256",
        await file.arrayBuffer(),
      );
      const sha256 = Array.from(new Uint8Array(hash), (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("");
      let current = await this.client.action<BazaarUpload>("start", {
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
        current = await this.client.chunk(
          current.id,
          before,
          file.slice(before, before + summary.policy.chunk_bytes),
        );
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

    private renderHistory(): void {
      this.history.replaceChildren();
      if (!this.summary?.releases.length) {
        this.history.append(this.text("p", "هنوز نسخه‌ای بارگذاری نشده است."));
        return;
      }
      const titles: Record<string, string> = {
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
        card.append(
          this.text("h4", row.version_name ?? "فایل در حال بارگذاری"),
          this.text(
            "p",
            `${titles[row.state] ?? row.state} · ${new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at))}`,
          ),
        );
        if (row.version_code)
          card.append(
            this.text(
              "p",
              `کد نسخه: ${row.version_code} · حجم: ${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(row.bytes / 1048576)} مگابایت`,
            ),
          );
        if (row.auto_publish)
          card.append(
            this.text("p", "انتشار خودکار پس از تأیید بازار فعال است."),
          );
        if (row.error) {
          const error = this.text("p", row.error);
          error.className = "gp-release-error";
          card.append(error);
        }
        const actions = document.createElement("div");
        actions.className = "gp-release-actions";
        if (
          row.sha256 &&
          !row.file_removed &&
          !["submitted", "published"].includes(row.state)
        ) {
          for (const [mode, label] of [
            ["draft", "ذخیره پیش‌نویس در بازار"],
            ["review", "ارسال برای بررسی"],
            ["publish", "بررسی و انتشار خودکار"],
          ]) {
            if (!mode || !label) continue;
            const action = this.button(label, () =>
              this.run(async () => {
                this.status.textContent =
                  "در حال ارتباط با بازار؛ این صفحه را باز نگه دارید…";
                await this.client.action(mode, { id: row.id });
                await this.load();
                this.status.textContent =
                  mode === "draft"
                    ? "پیش‌نویس در بازار ذخیره شد."
                    : "نسخه برای بررسی بازار ارسال شد.";
              }),
            );
            action.disabled =
              !this.summary.token_configured || !this.summary.network_ready;
            actions.append(action);
          }
        }
        if (!row.file_removed)
          actions.append(
            this.button("حذف فایل محلی", () =>
              this.run(async () => {
                await this.client.action("remove_file", { id: row.id });
                await this.load();
                this.status.textContent =
                  "فایل از سرور اتوماسیون حذف شد؛ سابقه و وضعیت بازار تغییر نکرد.";
              }),
            ),
          );
        card.append(actions);
        this.history.append(card);
      }
    }

    private admin(): boolean {
      return typeof has === "function" && Boolean(has("admin"));
    }
    private text<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      value: string,
    ): HTMLElementTagNameMap[K] {
      const element = document.createElement(tag);
      element.textContent = value;
      return element;
    }
    private card(title: string): HTMLElement {
      const card = document.createElement("section");
      card.className = "card gp-release-card";
      card.append(this.text("h3", title));
      return card;
    }
    private input(name: string, type: string, label: string): HTMLInputElement {
      const input = document.createElement("input");
      input.type = type;
      input.name = name;
      input.setAttribute("aria-label", label);
      return input;
    }
    private label(text: string, input: HTMLElement): HTMLLabelElement {
      const label = document.createElement("label");
      label.append(this.text("span", text), input);
      return label;
    }
    private button(
      text: string,
      action?: () => Promise<void>,
    ): HTMLButtonElement {
      const button = this.text("button", text);
      button.type = action ? "button" : "submit";
      button.className = "btn2";
      if (action)
        button.addEventListener("click", () => {
          void action();
        });
      return button;
    }
    private async run(operation: () => Promise<void>): Promise<void> {
      if (this.busy || !this.admin()) return;
      this.busy = true;
      this.controls.disabled = true;
      this.page.setAttribute("aria-busy", "true");
      const generation = this.generation;
      try {
        await operation();
      } catch (error: unknown) {
        if (generation === this.generation && this.admin())
          this.status.textContent =
            error instanceof Error
              ? error.message
              : "عملیات انجام نشد؛ دوباره وضعیت را بررسی کنید.";
      } finally {
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

/** Use the automation session's staff capabilities and Jalali display. */
declare function has(role: string): boolean;
declare function jalaliDateTime(value: string): string;

interface ShippingPolicy {
  max_receipts_per_order: number;
  max_carrier_chars: number;
  max_tracking_chars: number;
  max_note_chars: number;
  staff_roles: string[];
  image_dimension: number;
  jpeg_quality: number;
}
interface ShippingProof {
  proof_token: string;
  proof_mime: string;
  note: string;
}
interface ShippingReceipt {
  id: string;
  carrier: string;
  tracking_code: string;
  note: string;
  created_at: string;
  files: ShippingProof[];
}
interface ShippingSummary {
  order_id: number;
  receipts: ShippingReceipt[];
  policy: ShippingPolicy;
  upload: {
    max_encoded_bytes: number;
    max_per_kind: number;
    max_batch_bytes: number;
  };
}
interface Window {
  gpOrderShippingReceipts?: { mount(root: HTMLElement, id: number): void };
}

(() => {
  /** Exchange receipt metadata and protected bytes using the current session. */
  class ShippingClient {
    private readonly endpoint = "/api/order-shipping-receipts";

    /** Load the selected order without enlarging list responses. */
    async read(id: number): Promise<ShippingSummary> {
      return this.request<ShippingSummary>(this.endpoint + "?order_id=" + id);
    }

    /** Append one retry-identifiable receipt. */
    async save(
      id: number,
      payload: Record<string, unknown>,
    ): Promise<ShippingSummary> {
      return this.request<ShippingSummary>(this.endpoint, {
        order_id: id,
        ...payload,
      });
    }

    /** Resolve a document with server-side order ownership checks. */
    async document(
      id: number,
      token: string,
    ): Promise<{ mime: string; data: string }> {
      const query = new URLSearchParams({ order_id: String(id), token });
      return this.request(this.endpoint + "/document?" + query);
    }

    private async request<T>(
      path: string,
      payload?: Record<string, unknown>,
    ): Promise<T> {
      const options: RequestInit = {
        cache: "no-store",
        credentials: "same-origin",
      };
      if (payload) {
        options.method = "POST";
        options.headers = { "Content-Type": "application/json" };
        options.body = JSON.stringify(payload);
      }
      const response = await fetch(path, options);
      if (!response.ok)
        throw new Error("دریافت یا ثبت رسید انجام نشد. دوباره تلاش کنید.");
      return (await response.json()) as T;
    }
  }

  /** Render receipt history and a bounded staff upload form in the shipping panel. */
  class ShippingPanel {
    private readonly card = document.createElement("section");
    private readonly status = document.createElement("p");
    private readonly history = document.createElement("div");
    private form: HTMLFormElement | null = null;
    private requestId = crypto.randomUUID().replace(/-/g, "");

    constructor(
      private readonly host: HTMLElement,
      private readonly orderId: number,
      private readonly client: ShippingClient,
    ) {}

    /** Mount once and fetch only metadata until a document is opened. */
    async start(): Promise<void> {
      if (this.host.querySelector("[data-shipping-receipts]")) return;
      this.card.dataset.shippingReceipts = "";
      this.card.className = "od2-card gp-shipping-receipts";
      this.status.setAttribute("role", "status");
      const heading = document.createElement("h4");
      heading.textContent = "رسیدهای ارسال";
      this.card.append(heading, this.status, this.history);
      this.host.append(this.card);
      await this.load();
    }

    private async load(): Promise<void> {
      this.status.textContent = "در حال دریافت رسیدهای ارسال…";
      try {
        this.render(await this.client.read(this.orderId));
        this.status.textContent = "";
      } catch {
        this.status.replaceChildren(
          document.createTextNode("دریافت رسیدها ناموفق بود. "),
        );
        this.status.append(this.button("تلاش دوباره", () => this.load()));
      }
    }

    private render(data: ShippingSummary): void {
      if (!this.card.isConnected) return;
      this.history.replaceChildren();
      if (!data.receipts.length) {
        const empty = document.createElement("p");
        empty.textContent = "هنوز رسید ارسالی برای این سفارش ثبت نشده است.";
        this.history.append(empty);
      }
      for (const receipt of data.receipts) {
        const row = document.createElement("article");
        const title = document.createElement("strong");
        title.textContent = receipt.carrier;
        row.append(title);
        for (const text of [
          typeof jalaliDateTime === "function"
            ? jalaliDateTime(receipt.created_at)
            : receipt.created_at,
          receipt.tracking_code ? "کد رهگیری " + receipt.tracking_code : "",
          receipt.note,
        ]) {
          if (!text) continue;
          const line = document.createElement("p");
          line.textContent = text;
          row.append(line);
        }
        receipt.files.forEach((proof, index) => {
          const preview = document.createElement("div");
          row.append(
            this.button(
              "مشاهده رسید " + (index + 1).toLocaleString("fa-IR"),
              async () => {
                const file = await this.client.document(
                  this.orderId,
                  proof.proof_token,
                );
                if (
                  !["image/jpeg", "image/png", "application/pdf"].includes(
                    file.mime,
                  )
                ) {
                  throw new Error("فایل قابل نمایش نیست.");
                }
                if (file.mime === "application/pdf") {
                  const link = document.createElement("a");
                  link.textContent = "دانلود PDF رسید ارسال";
                  link.download = "shipping-receipt.pdf";
                  link.href = "data:application/pdf;base64," + file.data;
                  preview.replaceChildren(link);
                } else {
                  const image = document.createElement("img");
                  image.alt = "رسید ارسال " + receipt.carrier;
                  image.src = "data:" + file.mime + ";base64," + file.data;
                  preview.replaceChildren(image);
                }
              },
            ),
            preview,
          );
        });
        this.history.append(row);
      }
      this.form?.remove();
      if (
        typeof has === "function" &&
        data.policy.staff_roles.some((role) => has(role))
      ) {
        this.uploadForm(data);
      }
    }

    private uploadForm(data: ShippingSummary): void {
      const form = document.createElement("form");
      this.form = form;
      const carrier = this.field(
        form,
        "نام پیک یا باربری",
        data.policy.max_carrier_chars,
      );
      carrier.placeholder = "پیک، کالارسان یا نام باربری";
      carrier.required = true;
      const tracking = this.field(
        form,
        "کد رهگیری یا شماره بارنامه",
        data.policy.max_tracking_chars,
      );
      const note = this.field(
        form,
        "توضیحات ارسال",
        data.policy.max_note_chars,
      );
      const label = document.createElement("label");
      label.textContent = "عکس یا PDF رسید ارسال";
      const files = document.createElement("input");
      files.type = "file";
      files.accept = "image/jpeg,image/png,application/pdf";
      files.multiple = true;
      files.required = true;
      label.append(files);
      const save = document.createElement("button");
      save.type = "submit";
      save.className = "btn";
      save.textContent = "ثبت رسید ارسال";
      const hint = document.createElement("p");
      hint.textContent =
        "حداکثر " +
        data.upload.max_per_kind.toLocaleString("fa-IR") +
        " فایل در هر رسید";
      form.append(label, hint, save);
      form.addEventListener("input", () => {
        this.requestId = crypto.randomUUID().replace(/-/g, "");
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const controls = [
          ...form.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
            "input, button",
          ),
        ];
        controls.forEach((control) => {
          control.disabled = true;
        });
        void (async () => {
          try {
            const selection = [...(files.files ?? [])];
            if (
              !selection.length ||
              selection.length > data.upload.max_per_kind
            ) {
              throw new Error("تعداد فایل‌های رسید را بررسی کنید.");
            }
            this.status.textContent = "در حال ثبت رسید ارسال…";
            const encoded = await Promise.all(
              selection.map((file) => this.encode(file, data)),
            );
            if (
              encoded.reduce((size, file) => size + file.length, 0) >
              data.upload.max_batch_bytes
            ) {
              throw new Error("حجم مجموع فایل‌ها بیش از حد مجاز است.");
            }
            const result = await this.client.save(this.orderId, {
              request_id: this.requestId,
              carrier: carrier.value,
              tracking_code: tracking.value,
              note: note.value,
              files: encoded,
            });
            this.requestId = crypto.randomUUID().replace(/-/g, "");
            this.render(result);
            this.status.textContent =
              "رسید ثبت شد و در جزئیات سفارش مشتری قابل مشاهده است.";
          } catch (error) {
            this.status.textContent =
              error instanceof Error ? error.message : "ثبت رسید ناموفق بود.";
          } finally {
            controls.forEach((control) => {
              control.disabled = false;
            });
          }
        })();
      });
      this.card.append(form);
    }

    private field(
      form: HTMLFormElement,
      text: string,
      limit: number,
    ): HTMLInputElement {
      const label = document.createElement("label");
      label.textContent = text;
      const input = document.createElement("input");
      input.maxLength = limit;
      label.append(input);
      form.append(label);
      return input;
    }

    private async encode(file: File, data: ShippingSummary): Promise<string> {
      let blob: Blob = file;
      if (file.type !== "application/pdf") {
        const image = await createImageBitmap(file);
        try {
          const scale = Math.min(
            1,
            data.policy.image_dimension / Math.max(image.width, image.height),
          );
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          if (!context) throw new Error("آماده‌سازی تصویر ممکن نشد.");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (value) =>
                value ? resolve(value) : reject(new Error("تصویر خوانده نشد.")),
              "image/jpeg",
              data.policy.jpeg_quality / 100,
            ),
          );
        } finally {
          image.close();
        }
      }
      if (Math.ceil(blob.size / 3) * 4 > data.upload.max_encoded_bytes) {
        throw new Error("حجم فایل زیاد است. فایل کوچک‌تری انتخاب کنید.");
      }
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("فایل خوانده نشد."));
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== "string") reject(new Error("فایل خوانده نشد."));
          else resolve(result.slice(result.indexOf(",") + 1));
        };
        reader.readAsDataURL(blob);
      });
    }

    private button(
      text: string,
      action: () => Promise<void>,
    ): HTMLButtonElement {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn2";
      button.textContent = text;
      button.addEventListener("click", () => {
        button.disabled = true;
        void action()
          .catch(() => {
            this.status.textContent =
              "دریافت رسید ناموفق بود. دوباره تلاش کنید.";
          })
          .finally(() => {
            button.disabled = false;
          });
      });
      return button;
    }
  }

  window.gpOrderShippingReceipts = {
    /** Attach receipt controls to the current order's existing shipping information. */
    mount(root: HTMLElement, id: number): void {
      if (!root || !Number.isSafeInteger(id) || id < 1) return;
      const host =
        root.querySelector<HTMLElement>('[data-od2-panel="shipping"]') ?? root;
      void new ShippingPanel(host, id, new ShippingClient()).start();
    },
  };
})();

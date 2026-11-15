(() => {
  "use strict";
  const endpoint = "/api/order-followup";
  const money = value => Number(value).toLocaleString("fa-IR") + " تومان";
  const ascii = value => value.replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) & 15));
  const requestId = () => crypto.randomUUID().replaceAll("-", "");
  const element = (name, text) => {
    const node = document.createElement(name);
    if (text) node.textContent = text;
    return node;
  };
  async function request(path, payload) {
    const options = {cache: "no-store"};
    if (payload) Object.assign(options, {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload),
    });
    const response = await fetch(path, options);
    const body = await response.text();
    if (!response.ok) throw new Error(body.length < 320 && !body.includes("<") ? body : "عملیات انجام نشد.");
    return JSON.parse(body);
  }
  function button(text, action) {
    const node = element("button", text);
    node.type = "button";
    node.className = "btn2";
    node.addEventListener("click", async () => {
      node.disabled = true;
      try { await action(); } finally { node.disabled = false; }
    });
    return node;
  }
  function field(form, label, value = "", isAmount = false) {
    const wrapper = element("label", label + " ");
    const input = element(isAmount ? "input" : "textarea");
    input.value = String(value);
    if (isAmount) input.inputMode = "numeric";
    else input.maxLength = 500;
    wrapper.append(input);
    form.append(wrapper);
    return input;
  }
  function section(parent, title) {
    const panel = element("section");
    panel.className = "od2-card";
    panel.append(element("h4", title));
    parent.append(panel);
    return panel;
  }
  async function preview(target, id, proof) {
    const query = new URLSearchParams({order_id: id, token: proof.proof_token});
    const {mime, data} = await request(endpoint + "/document?" + query);
    if (!["application/pdf", "image/jpeg", "image/png"].includes(mime)) throw new Error("نوع فایل قابل نمایش نیست.");
    if (mime === "application/pdf") {
      const link = element("a", "دانلود PDF فیش");
      link.download = "receipt.pdf";
      link.href = "data:" + mime + ";base64," + data;
      target.replaceChildren(link);
      return;
    }
    const image = element("img");
    image.alt = "تصویر فیش مشتری";
    image.style.maxWidth = "100%";
    image.src = "data:" + mime + ";base64," + data;
    await image.decode();
    target.replaceChildren(image);
  }
  const allowed = () => typeof has === "function" && (has("finance") || has("sales"));
  async function mount(root, id, activeSection) {
    if (!root || !allowed() || root.querySelector("[data-order-followup-mounted]")) return;
    const modern = root.querySelector('[data-od2-panel="overview"]');
    const overview = modern || element("div");
    const payment = root.querySelector('[data-od2-panel="payment"]') || overview;
    if (!modern) {
      overview.className = "gp-followup-legacy";
      const heading = root.querySelector(".detail-head");
      if (heading) heading.after(overview);
      else root.prepend(overview);
    }
    const marker = element("span");
    marker.hidden = true;
    marker.dataset.orderFollowupMounted = "";
    overview.append(marker);
    const correction = section(overview, "اصلاح سفارش مشتری");
    const credit = has("finance") ? section(payment, "بازپرداخت اعتبار") : null;
    const status = element("p");
    const paymentStatus = credit ? element("p") : null;
    if (paymentStatus) {
      paymentStatus.setAttribute("role", "status");
      credit.append(paymentStatus);
    }
    status.setAttribute("role", "status");
    status.textContent = "در حال دریافت وضعیت سفارش…";
    if (paymentStatus) paymentStatus.textContent = status.textContent;
    correction.append(status);
    function safe(target, action) {
      return async () => {
        try { await action(); } catch (error) {
          target.textContent = error.message;
          if (target === status && paymentStatus?.textContent) paymentStatus.textContent = error.message;
        }
      };
    }
    await safe(status, async () => {
      const data = await request(endpoint + "?order_id=" + id);
      if (!root.contains(correction)) return;
      status.textContent = "";
      if (paymentStatus) paymentStatus.textContent = "";
      const send = (action, fields) => request(endpoint, {order_id: id, action, ...fields});
      const review = data.correction;
      if (review?.reason) correction.append(element("p", review.reason));
      if (review?.status === "resubmitted") {
        correction.append(element("p", "مشتری سفارش را دوباره ارسال کرده است."));
        if (has("sales")) correction.append(button("اعلان بررسی شد", safe(status, async () => {
          await send("ack_revision", {version: review.version});
          status.textContent = "اعلان بررسی شد.";
          await updateAlerts();
        })));
      }
      if (has("sales") && data.can_return && review?.status !== "requested") {
        const reason = field(correction, "علت بازگشت سفارش");
        let key = requestId();
        correction.append(button("بازگشت به مشتری", safe(status, async () => {
          const result = await send("return", {request_id: key, note: reason.value});
          reason.disabled = true;
          status.textContent = result.correction.reason + " · درخواست اصلاح برای مشتری ارسال شد.";
        })));
      } else if (!review) {
        status.textContent = "امکان بازگشت این سفارش در وضعیت فعلی وجود ندارد.";
      }
      if (!credit) return;
      const payments = data.repayments ?? [];
      const initialProofs = data.proofs ?? [];
      credit.hidden = !data.credit_amount && !payments.length && (modern || !initialProofs.length);
      if (!modern && initialProofs.length) {
        const documents = section(credit, "مدارک پرداخت سفارش");
        for (const [index, proof] of initialProofs.entries()) {
          const area = element("div");
          const prefix = proof.kind === "check" ? "چک " : "رسید ";
          documents.append(button("مشاهده " + prefix + (index + 1).toLocaleString("fa-IR"), safe(status, () => preview(area, id, proof))), area);
          if (proof.note) documents.append(element("p", proof.note));
        }
      }
      const creditStatus = element("p");
      creditStatus.setAttribute("role", "status");
      const content = element("div");
      credit.append(creditStatus, content);
      const showPayments = summary => {
        content.replaceChildren(element("p", "ماندهٔ اعتباری سفارش " + money(summary.outstanding)));
        for (const item of summary.repayments ?? []) {
          const labels = {pending: "در انتظار بررسی", approved: "تأییدشده", rejected: "ردشده"};
          const block = section(content, labels[item.status] + " · " + money(item.status === "approved" ? item.amount : item.claimed_amount));
          if (item.review_note) block.append(element("p", item.review_note));
          const proofs = item.proofs ?? [];
          const viewed = new Set();
          for (const [index, proof] of proofs.entries()) {
            const area = element("div");
            block.append(button("مشاهده فیش " + (index + 1).toLocaleString("fa-IR"), safe(creditStatus, async () => {
              await preview(area, id, proof);
              viewed.add(proof.proof_token);
            })), area);
            if (proof.note) block.append(element("p", proof.note));
          }
          if (item.status === "rejected") continue;
          const amount = field(block, "مبلغ تومان", item.status === "approved" ? item.amount : item.claimed_amount, true);
          const note = field(block, "توضیحات بررسی");
          const update = action => safe(creditStatus, async () => {
            if (action === "approve" && viewed.size !== proofs.length) throw new Error("ابتدا همهٔ مدارک را باز کنید.");
            showPayments(await send(action, {
              request_id: item.id, amount: Number(ascii(amount.value)), note: note.value,
              seen: viewed.size === proofs.length, previous_amount: item.amount,
            }));
            creditStatus.textContent = "نتیجه ثبت شد.";
            await updateAlerts();
          });
          if (item.status === "pending") block.append(button("تأیید فیش", update("approve")), button("رد فیش", update("reject")));
          else block.append(button("اصلاح مبلغ ثبت‌شده", update("adjust")));
        }
        if (summary.outstanding > 0) {
          const manual = section(content, "ثبت دستی تسویهٔ تأییدشده");
          const amount = field(manual, "مبلغ تومان", "", true);
          const note = field(manual, "توضیحات تسویه");
          const key = requestId();
          manual.append(button("ثبت تسویه", safe(creditStatus, async () => {
            showPayments(await send("manual", {request_id: key, amount: Number(ascii(amount.value)), note: note.value}));
            creditStatus.textContent = "تسویه دستی ثبت شد.";
          })));
        }
      };
      showPayments(data);
      if (!modern && activeSection === "payment" && !credit.hidden) credit.scrollIntoView({block: "nearest"});
    })();
  }
  const shell = document.getElementById("app");
  const trigger = document.getElementById("gpOrderAlerts");
  const badge = document.getElementById("gpOrderAlertsCount");
  const dialog = document.getElementById("gpOrderAlertsDialog");
  const list = document.getElementById("gpOrderAlertsList");
  const message = document.getElementById("gpOrderAlertsStatus");
  let incoming = null;

  async function openAlert(entry) {
    const id = Number(entry.order_id);
    if (!Number.isSafeInteger(id) || id < 1) return;
    if (typeof ORD !== "undefined" && !ORD.some(order => Number(order.id) === id)) {
      if (typeof refresh === "function") await refresh();
      if (!ORD.some(order => Number(order.id) === id)) throw new Error("این سفارش در فهرست قابل دسترسی نیست.");
    }
    if (typeof window.openOrderDetails !== "function") throw new Error("جزئیات سفارش در دسترس نیست.");
    const target = entry.kind === "credit_proof" ? "payment" : "overview";
    dialog.close();
    try { await window.openOrderDetails(id, target); }
    catch (error) { dialog.showModal(); throw error; }
  }

  async function updateAlerts() {
    if (!shell || !trigger || !badge || !dialog || !list || !message) return;
    const visible = !shell.classList.contains("hidden") && allowed();
    trigger.hidden = !visible;
    if (!visible) {
      if (dialog.open) dialog.close();
      badge.hidden = true;
      list.replaceChildren();
      message.textContent = "";
      return;
    }
    if (incoming) return incoming;
    const session = typeof ME === "undefined" ? null : ME;
    incoming = (async () => {
      try {
        const result = await request(endpoint + "/alerts");
        if (typeof ME !== "undefined" && ME !== session) return;
        const entries = result.items ?? [];
        const count = Number(result.count) || 0;
        badge.textContent = count.toLocaleString("fa-IR");
        badge.hidden = count === 0;
        trigger.setAttribute("aria-label", count ? `اعلان‌های سفارش، ${badge.textContent} مورد` : "اعلان‌های سفارش");
        message.textContent = entries.length ? "" : "اعلان تازه‌ای برای بررسی وجود ندارد.";
        list.replaceChildren(...entries.map(entry => {
          const proof = entry.kind === "credit_proof";
          const row = element("li");
          row.append(button((proof ? "فیش واریز اعتباری" : "سفارش اصلاح‌شده") + " · " + entry.number, async () => {
            try { await openAlert(entry); } catch (error) { message.textContent = error.message; }
          }));
          return row;
        }));
      } catch (error) {
        if (typeof ME === "undefined" || session === ME) message.textContent = error.message;
      }
    })();
    try { await incoming; } finally { incoming = null; }
  }

  if (shell && trigger && dialog) {
    trigger.addEventListener("click", () => {
      if (!dialog.open) dialog.showModal();
      updateAlerts();
    });
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    new MutationObserver(() => updateAlerts()).observe(shell, {attributes: true, attributeFilter: ["class"]});
    updateAlerts();
  }
  window.gpOrderFollowup = {mount, updateAlerts};
})();

(() => {
  "use strict";
  const endpoint = "/api/order-followup";
  const money = value => Number(value).toLocaleString("fa-IR") + " تومان";
  const ascii = value => value.replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) & 15));
  const requestId = () => crypto.randomUUID().replaceAll("-", "");
  let amendmentToOpen = null;
  const element = (name, text) => {
    const node = document.createElement(name);
    if (text) node.textContent = text;
    return node;
  };
  function settlementHtml(order, fallback = "") {
    const progress = order.settlement_progress;
    const review = order.order_edit_review;
    const pending = review && !(review.checked?.settlement && review.checked?.shipping);
    const editBadge = pending
      ? '<span class="badge pay-check">ویرایش شده · نیاز به بررسی</span>'
      : review ? '<span class="badge">ویرایش شده · بررسی شد</span>' : "";
    const selector = `data-settlement-order="${Number(order.id) || 0}"`;
    const pendingCredit = ["اعتباری · در انتظار تأیید", "ترکیبی با اعتبار · در انتظار تأیید"];
    if (progress?.awaiting_approval === true && pendingCredit.includes(progress.label)) {
      return `<span class="gp-settlement-display" ${selector}><span class="badge pay-check">${progress.label}</span>${editBadge}</span>`;
    }
    const labels = ["پرداخت بخشی", "تسویه کامل", "بخش اعتباری تسویه شد"];
    if (!progress || !labels.includes(progress.label)) return `<span ${selector}>${fallback}${editBadge}</span>`;
    const status = progress.settled ? "pay-paid" : "pay-deposit";
    return `<span class="gp-settlement-display" ${selector}>
      <span class="badge ${status}">${progress.label}</span>
      <small>واریزی تأییدشده ${money(progress.paid)}</small>
      <small>ماندهٔ اعتباری ${money(progress.outstanding)}</small>${editBadge}
    </span>`;
  }

  function updateSettlement(summary) {
    const id = Number(summary.order_id);
    if (!Number.isSafeInteger(id) || id < 1 || !Object.hasOwn(summary, "settlement_progress")) return;
    const order = typeof ORD !== "undefined" ? ORD.find(item => Number(item.id) === id) : null;
    if (order) order.settlement_progress = summary.settlement_progress;
    const shown = {id, settlement_progress: summary.settlement_progress, order_edit_review: order?.order_edit_review};
    for (const node of document.querySelectorAll(`[data-settlement-order="${id}"]`)) {
      node.outerHTML = settlementHtml(shown, order && typeof detailPayBadge === "function" ? detailPayBadge(order.payment_status) : "");
    }
    if (order && typeof renderActiveCore === "function") renderActiveCore();
  }

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
    const wrapper = element("label");
    wrapper.className = "gp-followup-field";
    wrapper.append(element("span", label));
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
    panel.className = "od2-card gp-followup-card";
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
    image.className = "gp-followup-proof-image";
    image.src = "data:" + mime + ";base64," + data;
    await image.decode();
    target.replaceChildren(image);
  }
  function group(parent, className) {
    const node = element("div");
    node.className = className;
    parent.append(node);
    return node;
  }
  function enteredAmount(input, minimum = 1) {
    const value = ascii(input.value).replace(/[٬,\s]/g, "");
    const amount = Number(value);
    if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(amount) || amount < minimum) {
      throw new Error("مبلغ معتبر به تومان وارد کنید.");
    }
    return amount;
  }
  function showProof(card, id, proof, label, seen, safe, message) {
    const row = group(card, "gp-followup-proof");
    const area = element("div");
    row.append(button(label, safe(message, async () => {
      await preview(area, id, proof);
      const link = area.querySelector("a");
      if (link) link.addEventListener("click", () => seen.add(proof.proof_token), {once: true});
      else seen.add(proof.proof_token);
    })));
    if (proof.note) row.append(element("p", proof.note));
    row.append(area);
  }
  function receiptCard(card, {id, proofs, review, initialToken, safe, creditStatus, update}) {
    const status = review.status ?? "pending";
    const labels = {pending: "در انتظار بررسی", approved: "تأییدشده", rejected: "ردشده"};
    const badge = element("span", labels[status]);
    badge.className = "gp-followup-state";
    badge.dataset.state = status;
    card.append(badge);
    if (review.review_note) card.append(element("p", review.review_note));
    if (review.source === "wallet") {
      card.append(element("p", "پرداخت از کیف پول · " + money(review.amount)));
      return;
    }
    const seen = new Set();
    for (const [index, proof] of proofs.entries()) {
      const suffix = proofs.length > 1 ? " " + (index + 1).toLocaleString("fa-IR") : "";
      showProof(card, id, proof, "پیش‌نمایش فیش" + suffix, seen, safe, creditStatus);
    }
    if (status === "rejected") return;
    const fields = group(card, "gp-followup-fields");
    const amount = field(fields, "مبلغ (تومان)", status === "approved" ? review.amount : review.claimed_amount ?? "", true);
    const note = field(fields, "توضیحات بررسی");
    const actions = group(card, "gp-followup-actions");
    const run = action => safe(creditStatus, async () => {
      if (action === "approve" && (!proofs.length || seen.size !== proofs.length)) {
        throw new Error("برای تأیید، ابتدا پیش‌نمایش همهٔ مدارک را باز کنید. برای PDF، فایل را باز یا دانلود کنید.");
      }
      if (action !== "approve" && !note.value.trim()) throw new Error("دلیل رد یا اصلاح فیش را بنویسید.");
      const payload = {amount: action === "reject" ? 0 : enteredAmount(amount), note: note.value,
        seen: proofs.length > 0 && seen.size === proofs.length, previous_amount: review.amount};
      if (initialToken) payload.token = initialToken;
      else payload.request_id = review.id;
      await update(initialToken ? action + "_order_receipt" : action, payload);
    });
    if (status === "pending") {
      actions.append(button("تأیید فیش", run("approve")));
      const reject = button("رد فیش", run("reject"));
      reject.classList.add("gp-followup-reject");
      actions.append(reject);
    } else {
      actions.append(button("اصلاح مبلغ فیش", run("adjust")));
    }
  }
  const purchaseTypes = {serial: "سریال آزاد", panel: "ثبت در پنل", agent: "عامل فروش"};
  const settlementParts = {cash_amount: "نقد", check_amount: "چک", credit_amount: "اعتبار", wallet_amount: "کیف پول"};

  function choice(parent, label, values, selected) {
    const wrapper = element("label");
    wrapper.className = "gp-followup-field";
    const input = element("select");
    wrapper.append(element("span", label), input);
    input.append(new Option("انتخاب کنید", ""));
    for (const [value, caption] of Object.entries(values)) input.append(new Option(caption, value));
    input.value = selected ?? "";
    parent.append(wrapper);
    return input;
  }

  function mountAmendment(overview, data, send, safe) {
    if (!data.can_propose_amendment && !data.amendment) return;
    const panel = section(overview, "اصلاحیهٔ سفارش برای مشتری");
    overview.prepend(panel);
    const message = element("p");
    message.setAttribute("role", "status");
    message.dataset.amendmentStatus = "";
    panel.append(message);
    const pending = data.amendment;
    if (pending) {
      const status = {pending: "در انتظار پاسخ مشتری", accepted: "تأیید مشتری ثبت شد", rejected: "مشتری اصلاحیه را رد کرد"}[pending.status];
      panel.append(element("p", "نسخهٔ " + pending.version.toLocaleString("fa-IR") + " · " + status));
      panel.append(element("p", "مبلغ قبلی " + money(pending.previous_total) + " · مبلغ پیشنهادی " + money(pending.total)));
      panel.append(element("p", "تغییر مبلغ فاکتور: " + money(pending.difference)));
      panel.append(element("p", "فاکتور " + pending.invoice + " · ارسال " + pending.shipping + (pending.address ? " · " + pending.address : "")));
      panel.append(element("p", pending.reason));
      const lines = element("ul");
      for (const row of pending.items) {
        lines.append(element("li", row.product + " · " + purchaseTypes[row.type] + " · " + row.quantity.toLocaleString("fa-IR") +
          " عدد × " + money(row.unit) + (row.switch ? " · " + row.switch : "")));
      }
      panel.append(lines);
      panel.append(element("p", Object.entries(settlementParts).map(([key, label]) =>
        label + " " + money(pending.settlement[key])).join(" · ")));
      if (pending.status === "accepted") {
        for (const [part, role, label] of [["finance", "finance", "مابه‌التفاوت و تسویه"], ["shipping", "sales", "تغییر ارسال"]]) {
          const done = Boolean(pending.checked?.[part]);
          const note = element("p", label + (done ? " · رسیدگی شد" : " · در انتظار رسیدگی"));
          panel.append(note);
          if (!done && has(role)) {
            const check = button("ثبت رسیدگی " + label, safe(message, async () => {
              await send("check_amendment_" + part, {amendment_id: pending.id});
              note.textContent = label + " · رسیدگی شد";
              check.remove();
              await updateAlerts();
            }));
            panel.append(check);
          }
        }
        if (!pending.checked?.finance || !pending.checked?.shipping) return;
      }
    }
    if (data.can_propose_amendment && has("finance")) {
      const authorization = element("details");
      authorization.append(element("summary", "مجوز ترکیب چک و اعتبار برای این سفارش"));
      const fields = group(authorization, "gp-followup-fields");
      const configured = data.amendment_mixed_terms ?? data.amendment_current.settlement;
      const editable = Object.entries(settlementParts).filter(([key]) => key !== "wallet_amount").map(([key, label]) =>
        [key, field(fields, label + " (تومان)", configured[key], true)]);
      authorization.append(element("p", "مبالغ تأییدشده فقط برای اصلاحیهٔ همین سفارش قابل استفاده‌اند."));
      authorization.append(button("ثبت مجوز ترکیب چک و اعتبار", safe(message, async () => {
        const settlement = Object.fromEntries(editable.map(([key, input]) => [key, enteredAmount(input, 0)]));
        const response = await send("approve_amendment_mixed_terms", {
          basis: data.amendment_basis, settlement: {...settlement, wallet_amount: 0},
        });
        panel.remove();
        mountAmendment(overview, response, send, safe);
        const refreshed = overview.querySelector("[data-amendment-status]");
        if (refreshed) refreshed.textContent = "مجوز مالی ثبت شد. اکنون می‌توانید اصلاحیه را تنظیم کنید.";
      })));
      panel.append(authorization);
    }
    if (!has("sales") || !data.can_propose_amendment) return;
    const editor = element("details");
    editor.append(element("summary", pending?.status === "pending" ? "ارسال نسخهٔ تازهٔ اصلاحیه" : "تنظیم اصلاحیه"));
    editor.dataset.orderAmendmentEditor = "";
    panel.append(editor);
    const original = pending?.status === "pending" ? pending : data.amendment_current;
    const terms = data.amendment_mixed_terms;
    const initial = terms ? {...original, settlement: terms, total: Object.values(terms).reduce((a, b) => a + b, 0)} : original;
    const fields = group(editor, "gp-followup-fields");
    const invoice = choice(fields, "نوع فاکتور", {"رسمی": "رسمی", "غیررسمی": "غیررسمی"}, initial.invoice);
    const shipping = field(fields, "روش ارسال", initial.shipping);
    const address = field(fields, "نشانی ارسال", initial.address);
    const total = field(fields, "مبلغ نهایی فاکتور (تومان)", initial.total, true);
    const parts = Object.entries(settlementParts).map(([key, label]) =>
      [key, field(fields, label + " (تومان)", initial.settlement[key], true)]);
    const note = field(fields, "توضیح اصلاحیه برای مشتری");
    const rows = group(editor, "gp-followup-list");
    const items = new Map();
    const add = row => {
      const line = group(rows, "gp-followup-fields");
      const product = field(line, "نام کالا", row.product ?? "");
      const quantity = field(line, "تعداد", row.quantity ?? 1, true);
      const unit = field(line, "قیمت واحد (تومان)", row.unit ?? 0, true);
      const type = choice(line, "نوع خرید", purchaseTypes, row.type);
      const panelSwitch = field(line, "سوییچ", row.switch ?? "");
      items.set(line, () => ({
        product: product.value, quantity: enteredAmount(quantity), unit: enteredAmount(unit, 0),
        type: type.value, switch: panelSwitch.value,
      }));
      line.append(button("حذف قلم", () => { items.delete(line); line.remove(); }));
    };
    initial.items.forEach(add);
    editor.append(button("افزودن قلم", () => add({})));
    let retry = null;
    const saveStatus = element("p");
    saveStatus.setAttribute("role", "status");
    editor.append(button("ارسال اصلاحیه به اپ مشتری", safe(saveStatus, async () => {
      saveStatus.textContent = "";
      const proposal = {
        invoice: invoice.value, shipping: shipping.value, address: address.value, total: enteredAmount(total, 0),
        settlement: Object.fromEntries(parts.map(([key, input]) => [key, enteredAmount(input, 0)])),
        items: Array.from(items.values(), read => read()),
      };
      if (!note.value.trim() || !proposal.items.length) throw new Error("اقلام و توضیح اصلاحیه را وارد کنید.");
      const signature = JSON.stringify([proposal, note.value]);
      if (retry?.signature !== signature) retry = {signature, key: requestId()};
      const response = await send("propose_amendment", {
        request_id: retry.key, basis: data.amendment_basis, note: note.value, proposal,
      });
      panel.remove();
      mountAmendment(overview, response, send, safe);
      await updateAlerts();
    })), saveStatus);
  }

  const allowed = () => typeof has === "function" && (has("finance") || has("sales"));
  async function mount(root, id, activeSection) {
    window.gpOrderShippingReceipts?.mount(root, id);
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
    const credit = has("finance") ? section(payment, "بررسی فیش‌ها") : null;
    if (credit && modern) payment.prepend(credit);
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
      if (data.order_edit_review) {
        const edit = section(overview, "بررسی پس از ویرایش سفارش");
        overview.prepend(edit);
        const record = data.order_edit_review;
        edit.append(element("p", "ویرایش در مرحلهٔ «" + (record.stage || "ثبت سفارش") + "» · " + record.edited_at));
        edit.append(element("p", "موارد تغییرکرده: " + record.changed.join("، ")));
        for (const [part, label, role] of [
          ["settlement", "نحوه تسویه", "finance"],
          ["shipping", "نحوه ارسال", "sales"],
        ]) {
          const reviewed = Boolean(record.checked?.[part]);
          const note = element("p", label + (reviewed ? " بررسی شد" : " نیاز به بررسی دارد"));
          edit.append(note);
          if (reviewed || !has(role)) continue;
          const control = button("تأیید بررسی " + label, async () => {
            control.disabled = true;
            try {
              const result = await send("confirm_edited_" + part, {version: record.version});
              const order = typeof ORD !== "undefined" ? ORD.find(item => Number(item.id) === Number(id)) : null;
              if (order) order.order_edit_review = result.order_edit_review;
              if (typeof renderActiveCore === "function") renderActiveCore();
              control.remove();
              note.textContent = label + " بررسی شد";
              await updateAlerts();
            } catch (error) {
              control.disabled = false;
              note.textContent = error.message;
            }
          });
          edit.append(control);
        }
      }
      mountAmendment(overview, data, send, safe);
      if (amendmentToOpen === Number(id)) {
        amendmentToOpen = null;
        const editor = overview.querySelector("[data-order-amendment-editor]");
        if (editor) {
          editor.open = true;
          editor.querySelector("summary").focus();
        } else if (!data.amendment) {
          status.textContent = "فرم اصلاحیه برای این سفارش در دسترس نیست.";
        }
      }
      const review = data.correction;
      const agentReview = data.agent_settlement_review;
      if (review?.reason) correction.append(element("p", review.reason));
      if (agentReview?.reason) correction.append(element("p", "درخواست تغییر شرایط عامل فروش: " + agentReview.reason));
      if (review?.status === "resubmitted") {
        correction.append(element("p", "مشتری سفارش را دوباره ارسال کرده است."));
        if (has("sales") && data.agent_final_review) {
          correction.append(button("تأیید نهایی سفارش عامل فروش", safe(status, async () => {
            const total = Object.values(review.settlement_amounts).reduce((sum, amount) => sum + amount, 0);
            await request("/api/customer-order/approve", {id: Number(id), total});
            status.textContent = "سفارش تأیید شد و در سفارشات کلی نمایش داده می‌شود.";
            if (typeof refresh === "function") await refresh();
            await updateAlerts();
          })));
        }
        if (has("sales") && !agentReview) correction.append(button("اعلان بررسی شد", safe(status, async () => {
          await send("ack_revision", {version: review.version});
          status.textContent = "اعلان بررسی شد.";
          await updateAlerts();
        })));
      }
      if (has("sales") && data.can_return && review?.status !== "requested") {
        const fields = group(correction, "gp-followup-fields");
        const reason = field(fields, agentReview ? "توضیح شرایط برای مشتری" : "علت بازگشت سفارش");
        const amounts = agentReview ? Object.entries({cash_amount: "نقد", check_amount: "چک", credit_amount: "اعتبار", wallet_amount: "کیف پول"})
          .map(([key, label]) => [key, field(fields, label + " (تومان)", data.agent_settlement_amounts?.[key] ?? 0, true)]) : [];
        const key = requestId();
        const actions = group(correction, "gp-followup-actions");
        actions.append(button(agentReview ? "ارسال شرایط تسویه به مشتری" : "بازگشت به مشتری", safe(status, async () => {
          const payload = {request_id: key, note: reason.value};
          if (agentReview) payload.settlement_amounts = Object.fromEntries(amounts.map(([key, input]) => [key, enteredAmount(input, 0)]));
          const result = await send("return", payload);
          reason.disabled = true;
          amounts.forEach(([, input]) => { input.disabled = true; });
          status.textContent = result.correction.reason + " · درخواست اصلاح برای مشتری ارسال شد.";
          await updateAlerts();
        })));
      } else if (!review) {
        status.textContent = "امکان بازگشت این سفارش در وضعیت فعلی وجود ندارد.";
      }
      if (!credit) return;
      const content = group(credit, "gp-followup-list");
      const creditStatus = paymentStatus;
      const update = async (action, payload) => {
        const result = await send(action, payload);
        showPayments(result);
        updateSettlement(result);
        creditStatus.textContent = "نتیجه ثبت شد.";
        await updateAlerts();
      };
      const showPayments = summary => {
        const receipts = summary.proofs ?? [];
        const repayments = summary.repayments ?? [];
        content.replaceChildren();
        const initial = summary.initial_payment;
        if (initial?.cash_required > 0) {
          content.append(element("p", "تأیید واریز اولیه: " + money(initial.cash_confirmed) +
            " · مانده: " + money(initial.cash_remaining)));
        }
        const refund = summary.cancellation;
        if (refund?.destination === "refund") {
          const block = section(content, "بازگشت وجه سفارش");
          block.append(element("p", money(refund.amount) + " · " +
            (refund.status === "completed" ? "واریز شد" : "در انتظار واریز")));
          if (refund.status === "pending") {
            const reference = field(group(block, "gp-followup-fields"), "مرجع واریز");
            group(block, "gp-followup-actions").append(button("ثبت بازگشت وجه", safe(creditStatus, () =>
              update("complete_refund", {reference: reference.value}))));
          } else if (refund.reference) {
            block.append(element("p", refund.reference));
          }
        }
        if (receipts.length) {
          const documents = section(content, "مدارک پرداخت هنگام سفارش");
          for (const [index, proof] of receipts.entries()) {
            if (proof.kind === "check") {
              const block = section(documents, "چک " + (index + 1).toLocaleString("fa-IR"));
              showProof(block, id, proof, "پیش‌نمایش چک", new Set(), safe, creditStatus);
              continue;
            }
            const block = section(documents, "فیش سفارش " + (index + 1).toLocaleString("fa-IR"));
            const review = proof.review ?? {};
            receiptCard(block, {id, proofs: [proof], review, initialToken: proof.proof_token, safe, creditStatus, update});
          }
        }
        if (summary.credit_amount > 0 || repayments.length) {
          const repaymentsSection = section(content, "بازپرداخت اعتبار");
          repaymentsSection.append(element("p", "ماندهٔ اعتباری سفارش " + money(summary.outstanding)));
          for (const [index, item] of repayments.entries()) {
            const block = section(repaymentsSection, "فیش بازپرداخت " + (index + 1).toLocaleString("fa-IR"));
            receiptCard(block, {id, proofs: item.proofs ?? [], review: item, safe, creditStatus, update});
          }
          if (summary.outstanding > 0 && (!summary.initial_payment || summary.can_submit)) {
            const manual = section(repaymentsSection, "ثبت دستی تسویهٔ تأییدشده");
            const fields = group(manual, "gp-followup-fields");
            const amount = field(fields, "مبلغ (تومان)", "", true);
            const note = field(fields, "توضیحات تسویه");
            const key = requestId();
            group(manual, "gp-followup-actions").append(button("ثبت تسویه", safe(creditStatus, () =>
              update("manual", {request_id: key, amount: enteredAmount(amount), note: note.value}))));
          }
        }
        if (!content.children.length) content.append(element("p", "هنوز فیشی برای این سفارش ثبت نشده است."));
      };
      showPayments(data);
      if (modern && (data.proofs?.length || data.repayments?.length || data.credit_amount > 0)) {
        const actions = root.querySelector(".od2-header-actions");
        if (actions) {
          const jump = element("button", "بررسی فیش‌ها");
          jump.type = "button";
          jump.className = "btn2";
          jump.dataset.od2Jump = "payment";
          actions.prepend(jump);
        }
      }
      if (!modern && activeSection === "payment") credit.scrollIntoView({block: "nearest"});
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
    const target = ["credit_proof", "refund"].includes(entry.kind) ? "payment" : "overview";
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
          const label = {credit_proof: "فیش واریز اعتباری", refund: "بازگشت وجه", revision: "سفارش اصلاح‌شده",
            order_edit_review: "ویرایش سفارش · بازبینی تسویه و ارسال", amendment_accepted: "اصلاحیه تأیید شد · رسیدگی مالی و ارسال", agent_settlement: "بررسی تسویه عامل فروش", agent_final_review: "تأیید نهایی سفارش عامل فروش"}[entry.kind] ?? "اعلان سفارش";
          const row = element("li");
          row.append(button(label + " · " + entry.number, async () => {
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
  function showInOrderList(order) {
    return !order.agent_settlement_review || order.approval_status === "تأیید شده" || order.status === "لغو شد";
  }
  const legacyEdit = window.openOrderEdit;
  if (typeof legacyEdit === "function") {
    window.openOrderEdit = async function (id) {
      const order = typeof ORD === "undefined" ? null : ORD.find(item => Number(item.id) === Number(id));
      const customerPurchase = Number(order?.customer_id) > 0 && order?.purchase_items?.length > 0 &&
        ["", "customer"].includes(order.source ?? "customer");
      const separatePrices = order?.items?.some(item => item.purchase_lines?.length > 1);
      if (!(customerPurchase || separatePrices) || !has("sales") || typeof window.openOrderDetails !== "function") {
        return legacyEdit.call(this, id);
      }
      amendmentToOpen = Number(id);
      try {
        await window.openOrderDetails(id, "overview");
      } catch (error) {
        amendmentToOpen = null;
        window.alert(error.message);
      }
    };
  }
  window.gpOrderFollowup = {mount, updateAlerts, settlementHtml, showInOrderList};
})();

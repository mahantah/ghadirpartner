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
  async function mount(root, id) {
    if (typeof has !== "function" || !(has("finance") || has("sales"))) return;
    const overview = root.querySelector('[data-od2-panel="overview"]');
    const payment = root.querySelector('[data-od2-panel="payment"]');
    if (!overview || !payment) return;
    const correction = section(overview, "اصلاح سفارش مشتری");
    const credit = has("finance") ? section(payment, "بازپرداخت اعتبار") : null;
    const status = element("p");
    status.setAttribute("role", "status");
    correction.append(status);
    function safe(target, action) {
      return async () => {
        try { await action(); } catch (error) { target.textContent = error.message; }
      };
    }
    await safe(status, async () => {
      const data = await request(endpoint + "?order_id=" + id);
      if (!root.contains(correction)) return;
      const send = (action, fields) => request(endpoint, {order_id: id, action, ...fields});
      const review = data.correction;
      if (review?.reason) correction.append(element("p", review.reason));
      if (review?.status === "resubmitted") {
        correction.append(element("p", "مشتری سفارش را دوباره ارسال کرده است."));
        if (has("sales")) correction.append(button("اعلان بررسی شد", safe(status, async () => {
          await send("ack_revision", {version: review.version});
          status.textContent = "اعلان بررسی شد.";
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
      } else if (!review) correction.hidden = true;
      if (!credit) return;
      const payments = data.repayments ?? [];
      credit.hidden = !data.credit_amount && !payments.length;
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
    })();
  }
  window.gpOrderFollowup = {mount};
})();

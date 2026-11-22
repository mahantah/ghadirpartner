(() => {
    "use strict";

    const openCustomerEdit = window.openCustomerEdit;
    if (typeof openCustomerEdit !== "function") return;

    function appendText(parent, tag, message) {
        const element = document.createElement(tag);
        element.textContent = message;
        parent.append(element);
        return element;
    }

    /** Display only the account associated with the currently open customer record. */
    async function showAccount(container, customerId) {
        const status = appendText(container, "p", "در حال دریافت اطلاعات حساب…");
        status.setAttribute("role", "status");
        try {
            const account = await req("/api/customer-accounts/access?" + new URLSearchParams({customer_id: String(customerId)}));
            if (!container.isConnected) return;
            status.remove();
            const bank = account.bank;
            if (bank.iban) {
                const line = appendText(container, "p", "شماره شبا: ");
                const iban = appendText(line, "bdi", bank.iban);
                iban.dir = "ltr";
                appendText(container, "p", "نام بانک: " + bank.bank_name);
            } else {
                appendText(container, "p", "اطلاعات بانکی ثبت نشده است.");
            }
            if (account.users.length === 0) {
                appendText(container, "p", "کاربر دیگری دسترسی فعال ندارد.");
                return;
            }
            const list = document.createElement("ul");
            for (const user of account.users) {
                const row = appendText(list, "li", user.name + " · ");
                appendText(row, "bdi", user.mobile).dir = "ltr";
            }
            container.append(list);
        } catch (error) {
            if (container.isConnected) status.textContent = error.message || "اطلاعات حساب دریافت نشد.";
        }
    }

    window.openCustomerEdit = function (customerId) {
        const result = openCustomerEdit.apply(this, arguments);
        const modal = document.getElementById("modalbody");
        if (typeof has !== "function" || !has("admin") || !modal || !document.getElementById("ecn")) return result;
        modal.querySelector("[data-portal-customer-access]")?.remove();
        const section = document.createElement("section");
        section.dataset.portalCustomerAccess = "";
        section.className = "card";
        appendText(section, "h4", "دسترسی کاربران و اطلاعات بانکی");
        modal.append(section);
        void showAccount(section, customerId);
        return result;
    };
})();

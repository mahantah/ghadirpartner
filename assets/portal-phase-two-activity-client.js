(() => {
    "use strict";
    const app = document.getElementById("app");
    if (!app) return;
    let timer;
    let pending;
    let captured;
    let sending = false;
    let heartbeat = Number(app.dataset.portalHeartbeat) * 1000;

    /** Track only a customer-visible, foreground portal session. */
    function active() {
        return !document.hidden && !app.classList.contains("hidden") && isCustomer() && !has("admin");
    }

    /** Serialize writes so a delayed cart update cannot overtake a clear. */
    async function send() {
        if (!active() || sending) return;
        sending = true;
        const cart = pending;
        pending = undefined;
        try {
            const result = await api("/api/portal-activity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channel: "web", cart }),
                keepalive: true,
            });
            const interval = Number(result.heartbeat_seconds) * 1000;
            if (interval > 0) heartbeat = interval;
        } catch {
            if (pending === undefined) pending = cart;
        } finally {
            sending = false;
            // A failed report must not block checkout or trigger a retry loop.
            if (Number.isFinite(heartbeat) && heartbeat > 0) {
                clearTimeout(timer);
                if (pending === undefined || pending === cart) timer = setTimeout(send, heartbeat);
                else timer = setTimeout(send, 500);
            }
        }
    }

    /** Ignore the empty form during initial render and send meaningful cart changes only. */
    function capture() {
        if (!active()) return;
        const rows = cartSnapshot().filter((item) => item.unit > 0).map(({ product, qty }) => ({ product, qty }));
        const state = JSON.stringify(rows);
        if (captured === state || (captured === undefined && rows.length === 0)) return;
        captured = state;
        pending = rows;
        clearTimeout(timer);
        timer = setTimeout(send, 500);
    }

    document.addEventListener("gp-portal-cart", capture);
    document.addEventListener("gp-portal-cart-clear", () => {
        captured = "[]";
        pending = [];
        void send();
    });
    function resume() {
        clearTimeout(timer);
        if (active()) void send();
    }
    document.addEventListener("visibilitychange", resume);
    new MutationObserver(resume).observe(app, { attributeFilter: ["class"] });
    resume();
})();

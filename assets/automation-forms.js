(() => {
    "use strict";

    /** Keep standalone report pages open and soften transitions between visible tabs. */
    class AutomationForms {
        /** @param {HTMLElement} app @param {MediaQueryList} reducedMotion */
        constructor(app, reducedMotion) {
            this.app = app;
            this.reducedMotion = reducedMotion;
            /** @type {HTMLElement | null} */
            this.activePage = null;
            this.frame = 0;
            this.observer = new MutationObserver((changes) => {
                if (changes.some(({ target }) => target instanceof HTMLElement && (
                    target === app || target.matches(".tab, .gp-report-page > details")
                ))) {
                    this.schedule();
                }
            });
        }

        /** Follow the existing navigation and permission changes without changing their handlers. */
        start() {
            this.observer.observe(this.app, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ["class", "hidden"],
            });
            this.schedule();
        }

        /** Coalesce tab visibility updates into one render. */
        schedule() {
            if (this.frame) return;
            this.frame = requestAnimationFrame(() => {
                this.frame = 0;
                this.refresh();
            });
        }

        /** Open page content after its existing permission checks have made it visible. */
        refresh() {
            const previous = this.activePage;
            const page = Array.from(this.app.querySelectorAll(".tab")).find(
                (tab) => tab instanceof HTMLElement && !tab.closest(".hidden, [hidden]"),
            );
            this.activePage = page instanceof HTMLElement ? page : null;
            if (!this.activePage) return;

            for (const panel of this.activePage.querySelectorAll(":scope.gp-report-page > details:not([hidden])")) {
                if (!(panel instanceof HTMLDetailsElement) || panel.open) continue;
                // Existing report listeners use the summary to start their first data load.
                panel.querySelector("summary")?.click();
            }

            if (previous && previous !== this.activePage && !this.reducedMotion.matches) {
                void this.animate(this.activePage);
            }
        }

        /** @param {HTMLElement} page */
        async animate(page) {
            const target = page.querySelector(":scope > h2, :scope > h3, :scope > .card");
            if (!target) return;
            try {
                const { waapi } = await import("./anime-waapi-4.5.0.min.js");
                if (page !== this.activePage || this.reducedMotion.matches) return;
                waapi.animate(target, { opacity: [0.94, 1], duration: 150, ease: "outQuad" });
            } catch {
                // Navigation and form controls are usable while the optional animation module loads.
            }
        }
    }

    const app = document.getElementById("app");
    if (app) new AutomationForms(app, matchMedia("(prefers-reduced-motion: reduce)")).start();
})();

import type { CatalogSnapshot, ProductPrice, SessionState, WidgetSettings } from '../shared/contracts';

class PriceWidgetController {
  private snapshot: CatalogSnapshot | null = null;

  private readonly loginView = this.element<HTMLElement>('loginView');
  private readonly catalogView = this.element<HTMLElement>('catalogView');
  private readonly identityInput = this.element<HTMLInputElement>('identityInput');
  private readonly passwordInput = this.element<HTMLInputElement>('passwordInput');
  private readonly loginButton = this.element<HTMLButtonElement>('loginButton');
  private readonly loginError = this.element<HTMLElement>('loginError');
  private readonly identityLabel = this.element<HTMLElement>('identityLabel');
  private readonly refreshButton = this.element<HTMLButtonElement>('refreshButton');
  private readonly compactButton = this.element<HTMLButtonElement>('compactButton');
  private readonly autoStartInput = this.element<HTMLInputElement>('autoStartInput');
  private readonly logoutButton = this.element<HTMLButtonElement>('logoutButton');
  private readonly searchInput = this.element<HTMLInputElement>('searchInput');
  private readonly statusText = this.element<HTMLElement>('statusText');
  private readonly productList = this.element<HTMLElement>('productList');

  /**
   * Initializes session state and UI event bindings.
   */
  public async start(): Promise<void> {
    this.loginButton.addEventListener('click', () => {
      void this.login();
    });
    this.passwordInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        void this.login();
      }
    });
    this.refreshButton.addEventListener('click', () => {
      void this.refresh();
    });
    this.logoutButton.addEventListener('click', () => {
      void this.logout();
    });
    this.searchInput.addEventListener('input', () => this.render());
    this.compactButton.addEventListener('click', () => {
      void this.toggleCompact();
    });
    this.autoStartInput.addEventListener('change', () => {
      void this.changeStartup();
    });
    window.ghadirPrices.onLayout((settings) => this.applyWidgetSettings(settings));
    try {
      this.applyWidgetSettings(await window.ghadirPrices.widgetSettings());
    } catch (error: unknown) {
      this.loginError.textContent = this.errorMessage(error);
    }

    window.ghadirPrices.onCatalog((snapshot) => {
      this.snapshot = snapshot;
      this.render();
    });

    try {
      const session = await window.ghadirPrices.session();
      this.applySession(session);
      if (session.authenticated) {
        await this.refresh();
      }
    } catch (error: unknown) {
      this.applySession({ authenticated: false, identity: '' });
      this.loginError.textContent = this.errorMessage(error);
    }
  }

  private applyWidgetSettings(settings: WidgetSettings): void {
    this.compactButton.textContent = settings.compact ? '⤢' : '⤡';
    this.compactButton.title = settings.compact ? 'نمایش کامل' : 'حالت کوچک';
    this.autoStartInput.checked = settings.autoStart;
    document.body.classList.toggle('compact', settings.compact);
  }

  private async toggleCompact(): Promise<void> {
    this.compactButton.disabled = true;
    try {
      const current = await window.ghadirPrices.widgetSettings();
      this.applyWidgetSettings(await window.ghadirPrices.setCompact(!current.compact));
    } catch (error: unknown) {
      this.statusText.textContent = this.errorMessage(error);
    } finally {
      this.compactButton.disabled = false;
    }
  }

  private async changeStartup(): Promise<void> {
    this.autoStartInput.disabled = true;
    try {
      this.applyWidgetSettings(await window.ghadirPrices.setAutoStart(this.autoStartInput.checked));
    } catch (error: unknown) {
      this.statusText.textContent = this.errorMessage(error);
      this.applyWidgetSettings(await window.ghadirPrices.widgetSettings());
    } finally {
      this.autoStartInput.disabled = false;
    }
  }

  private async login(): Promise<void> {
    this.loginError.textContent = '';
    this.loginButton.disabled = true;

    try {
      const state = await window.ghadirPrices.login(
        this.identityInput.value,
        this.passwordInput.value,
      );
      this.passwordInput.value = '';
      this.applySession(state);
      await this.refresh();
    } catch (error: unknown) {
      this.loginError.textContent = this.errorMessage(error);
    } finally {
      this.loginButton.disabled = false;
    }
  }

  private async logout(): Promise<void> {
    await window.ghadirPrices.logout();
    this.snapshot = null;
    this.applySession({ authenticated: false, identity: '' });
  }

  private async refresh(): Promise<void> {
    this.statusText.textContent = 'در حال دریافت قیمت‌های جدید...';
    this.refreshButton.disabled = true;

    try {
      this.snapshot = await window.ghadirPrices.refresh();
      this.render();
    } catch (error: unknown) {
      this.statusText.textContent = this.errorMessage(error);
      const state = await window.ghadirPrices.session();
      if (!state.authenticated) {
        this.applySession(state);
      }
    } finally {
      this.refreshButton.disabled = false;
    }
  }

  private applySession(state: SessionState): void {
    this.loginView.classList.toggle('hidden', state.authenticated);
    this.catalogView.classList.toggle('hidden', !state.authenticated);
    this.identityLabel.textContent = state.identity;
  }

  private render(): void {
    if (this.snapshot === null) {
      return;
    }

    const query = this.searchInput.value.trim().toLocaleLowerCase('fa-IR');
    const items = this.snapshot.items.filter((item) =>
      item.name.toLocaleLowerCase('fa-IR').includes(query),
    );

    this.statusText.textContent =
      'آخرین بروزرسانی: ' +
      new Intl.DateTimeFormat('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(this.snapshot.refreshedAt));

    this.productList.replaceChildren();
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'دستگاهی با این نام پیدا نشد.';
      this.productList.appendChild(empty);
      return;
    }

    items.forEach((item) => this.productList.appendChild(this.productCard(item)));
  }

  private productCard(item: ProductPrice): HTMLElement {
    const card = document.createElement('article');
    card.className = 'product-card';

    const head = document.createElement('div');
    head.className = 'product-head';

    const name = document.createElement('div');
    name.className = 'product-name';
    name.textContent = item.name;

    const stock = document.createElement('div');
    stock.className = 'stock';
    stock.textContent = `موجودی: ${item.stock.toLocaleString('fa-IR')}`;

    head.append(name, stock);
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'price-grid';

    item.prices.forEach((price) => {
      const row = document.createElement('div');
      row.className = 'price-row';

      const label = document.createElement('span');
      label.className = 'price-label';
      label.textContent = price.label;

      const value = document.createElement('strong');
      value.className = 'price-value';
      value.textContent = `${price.value.toLocaleString('fa-IR')} تومان`;

      const delta = document.createElement('span');
      delta.className =
        price.delta > 0 ? 'delta up' : price.delta < 0 ? 'delta down' : 'delta';
      delta.textContent = price.delta > 0 ? '▲' : price.delta < 0 ? '▼' : '—';

      row.append(label, value, delta);
      grid.appendChild(row);
    });

    if (item.prices.length === 0) {
      const emptyPrice = document.createElement('div');
      emptyPrice.className = 'muted small';
      emptyPrice.textContent = 'برای این حساب ستون قیمت قابل نمایش نیست.';
      grid.appendChild(emptyPrice);
    }

    card.appendChild(grid);
    return card;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'خطای نامشخص';
  }

  private element<T extends HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (node === null) {
      throw new Error(`Missing required element: ${id}`);
    }
    return node as T;
  }
}

void new PriceWidgetController().start();

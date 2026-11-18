export interface SessionState {
  readonly authenticated: boolean;
  readonly identity: string;
}

export interface PriceValue {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly delta: number;
}

export interface ProductPrice {
  readonly name: string;
  readonly stock: number;
  readonly available: boolean;
  readonly prices: readonly PriceValue[];
}

export interface CatalogSnapshot {
  readonly items: readonly ProductPrice[];
  readonly refreshedAt: string;
  readonly hasPriceChanges: boolean;
}

export interface WidgetSettings {
  readonly compact: boolean;
  readonly autoStart: boolean;
}

export interface GhadirPriceBridge {
  login(identity: string, password: string): Promise<SessionState>;
  logout(): Promise<void>;
  session(): Promise<SessionState>;
  refresh(): Promise<CatalogSnapshot>;
  widgetSettings(): Promise<WidgetSettings>;
  setCompact(compact: boolean): Promise<WidgetSettings>;
  setAutoStart(enabled: boolean): Promise<WidgetSettings>;
  onLayout(listener: (settings: WidgetSettings) => void): () => void;
  onCatalog(listener: (snapshot: CatalogSnapshot) => void): () => void;
}

export const IPC_CHANNELS = {
  login: 'ghadir-prices:login',
  logout: 'ghadir-prices:logout',
  session: 'ghadir-prices:session',
  refresh: 'ghadir-prices:refresh',
  catalogUpdated: 'ghadir-prices:catalog-updated',
  widgetSettings: 'ghadir-prices:widget-settings',
  setCompact: 'ghadir-prices:set-compact',
  setAutoStart: 'ghadir-prices:set-auto-start',
  layout: 'ghadir-prices:layout',
} as const;

declare global {
  interface Window {
    ghadirPrices: GhadirPriceBridge;
  }
}

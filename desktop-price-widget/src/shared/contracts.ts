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

export interface GhadirPriceBridge {
  login(identity: string, password: string): Promise<SessionState>;
  logout(): Promise<void>;
  session(): Promise<SessionState>;
  refresh(): Promise<CatalogSnapshot>;
  onCatalog(listener: (snapshot: CatalogSnapshot) => void): () => void;
}

export const IPC_CHANNELS = {
  login: 'ghadir-prices:login',
  logout: 'ghadir-prices:logout',
  session: 'ghadir-prices:session',
  refresh: 'ghadir-prices:refresh',
  catalogUpdated: 'ghadir-prices:catalog-updated',
} as const;

declare global {
  interface Window {
    ghadirPrices: GhadirPriceBridge;
  }
}

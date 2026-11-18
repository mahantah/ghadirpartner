import type { CatalogSnapshot, ProductPrice } from '../../shared/contracts';
import type { RawCatalog, SnapshotStore } from '../models/GhadirModels';

export class PriceMapper {
  public constructor(
    private readonly labels: Readonly<Record<string, string>>,
    private readonly hideZeroPrices: boolean,
  ) {}

  /**
   * Maps the API catalog to the renderer contract and calculates price deltas.
   *
   * @param catalog Raw permitted catalog returned by Ghadir Partner.
   * @param previous Previously persisted visible prices.
   * @param refreshedAt ISO timestamp for the refresh.
   * @returns Renderer-ready catalog snapshot.
   */
  public map(
    catalog: RawCatalog,
    previous: SnapshotStore,
    refreshedAt: string,
  ): CatalogSnapshot {
    const items = catalog.map((item): ProductPrice => {
      const previousPrices = previous[item.name] ?? {};
      const prices = Object.entries(item.prices)
        .filter(([, value]) => !this.hideZeroPrices || value > 0)
        .map(([key, value]) => ({
          key,
          label: this.labels[key] ?? key,
          value,
          delta: value - (previousPrices[key] ?? value),
        }));

      return {
        name: item.name,
        stock: item.stock,
        available: item.available,
        prices,
      };
    });

    return {
      items,
      refreshedAt,
      hasPriceChanges: items.some((item) => item.prices.some((price) => price.delta !== 0)),
    };
  }

  /**
   * Converts a raw catalog to the minimal persisted snapshot.
   *
   * @param catalog Raw permitted catalog returned by Ghadir Partner.
   * @returns Snapshot containing only currently visible price fields.
   */
  public toStore(catalog: RawCatalog): SnapshotStore {
    return Object.fromEntries(
      catalog.map((item) => [
        item.name,
        Object.fromEntries(
          Object.entries(item.prices).filter(([, value]) => !this.hideZeroPrices || value > 0),
        ),
      ]),
    );
  }
}

import { describe, expect, it } from 'vitest';

import type { RawCatalog } from '../models/GhadirModels';
import { PriceMapper } from './PriceMapper';

describe('PriceMapper', () => {
  it('keeps only visible prices and calculates change direction', () => {
    const mapper = new PriceMapper(
      {
        panel_cash: 'نقد پنل',
        sales_agent: 'عامل فروش',
      },
      true,
    );
    const catalog: RawCatalog = [
      {
        name: 'SZZT I90',
        price: 12_000_000,
        stock: 8,
        available: true,
        prices: {
          panel_cash: 12_000_000,
          sales_agent: 11_900_000,
          serial_1_50: 0,
        },
      },
    ];

    const snapshot = mapper.map(
      catalog,
      {
        'SZZT I90': {
          panel_cash: 11_800_000,
          sales_agent: 12_000_000,
        },
      },
      '2026-11-17T08:00:00.000Z',
    );

    expect(snapshot.items[0]?.prices).toEqual([
      {
        key: 'panel_cash',
        label: 'نقد پنل',
        value: 12_000_000,
        delta: 200_000,
      },
      {
        key: 'sales_agent',
        label: 'عامل فروش',
        value: 11_900_000,
        delta: -100_000,
      },
    ]);
    expect(snapshot.hasPriceChanges).toBe(true);
  });
});

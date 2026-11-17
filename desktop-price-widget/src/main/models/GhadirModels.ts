import { z } from 'zod';

export const MeSchema = z.object({
  username: z.string(),
  roles: z.array(z.string()).default([]),
});

export type MeResponse = z.infer<typeof MeSchema>;

export const RawCatalogItemSchema = z
  .object({
    name: z.string().min(1),
    price: z.coerce.number().default(0),
    stock: z.coerce.number().int().default(0),
    available: z.boolean().default(true),
    prices: z.record(z.string(), z.coerce.number()).default({}),
  })
  .passthrough();

export const RawCatalogSchema = z.array(RawCatalogItemSchema);

export type RawCatalogItem = z.infer<typeof RawCatalogItemSchema>;
export type RawCatalog = z.infer<typeof RawCatalogSchema>;

export const SnapshotStoreSchema = z.record(z.string(), z.record(z.string(), z.number()));

export type SnapshotStore = z.infer<typeof SnapshotStoreSchema>;

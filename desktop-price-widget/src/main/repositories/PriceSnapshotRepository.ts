import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { SnapshotStoreSchema, type SnapshotStore } from '../models/GhadirModels';

export class PriceSnapshotRepository {
  public constructor(private readonly filePath: string) {}

  /**
   * Loads the last known visible prices.
   *
   * @returns Stored snapshot, or an empty snapshot when none exists or the cache is invalid.
   */
  public async load(): Promise<SnapshotStore> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      return SnapshotStoreSchema.parse(parsed);
    } catch {
      return {};
    }
  }

  /**
   * Persists the latest visible prices for change detection.
   *
   * @param snapshot Current visible price snapshot.
   */
  public async save(snapshot: SnapshotStore): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  }
}

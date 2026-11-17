import { readFile } from 'node:fs/promises';

import { parse } from 'yaml';
import { z } from 'zod';

const AppConfigSchema = z.object({
  api: z.object({
    base_url: z.string().url(),
    request_timeout_ms: z.number().int().min(1000).max(60000),
    endpoints: z.object({
      login: z.string().min(1),
      logout: z.string().min(1),
      me: z.string().min(1),
      catalog: z.string().min(1),
    }),
  }),
  refresh: z.object({
    interval_seconds: z.number().int().min(10).max(3600),
  }),
  ui: z.object({
    title: z.string().min(1),
    window_width: z.number().int().min(320).max(1200),
    window_height: z.number().int().min(420).max(1400),\n    compact_width: z.number().int().min(320).max(700),\n    compact_height: z.number().int().min(420).max(900),\n    start_compact: z.boolean(),\n    auto_start_on_install: z.boolean(),\n    edge_margin: z.number().int().min(0).max(100),
    always_on_top: z.boolean(),
    hide_zero_prices: z.boolean(),
  }),
  notifications: z.object({
    price_changes: z.boolean(),
  }),
  price_labels: z.record(z.string(), z.string().min(1)),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export class AppConfigLoader {
  public constructor(private readonly configPath: string) {}

  /**
   * Loads and validates the desktop widget configuration.
   *
   * @returns Validated application configuration.
   */
  public async load(): Promise<AppConfig> {
    const rawText = await readFile(this.configPath, 'utf8');
    const parsed: unknown = parse(rawText);
    return AppConfigSchema.parse(parsed);
  }
}

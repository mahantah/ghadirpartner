import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AppConfigLoader } from './AppConfig';

describe('Desktop configuration', () => {
  it('parses and validates the exact YAML file that is bundled in Windows releases', async () => {
    const loader = new AppConfigLoader(resolve('config/app.yaml'));

    const config = await loader.load();

    expect(config.api.base_url).toBe('https://ghadirpartner.ir/partners/');
    expect(config.ui.window_height).toBe(680);
    expect(config.ui.compact_width).toBe(380);
    expect(config.ui.compact_height).toBe(530);
    expect(config.ui.start_compact).toBe(true);
    expect(config.ui.auto_start_on_install).toBe(false);
  });
});

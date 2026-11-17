import { PriceWidgetApplication } from './PriceWidgetApplication';

class MainEntry {
  /**
   * Boots the desktop live-price application.
   */
  public async run(): Promise<void> {
    await new PriceWidgetApplication().start();
  }
}

void new MainEntry().run();

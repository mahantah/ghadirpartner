import { AppDiagnostics } from './diagnostics/AppDiagnostics';
import { PriceWidgetApplication } from './PriceWidgetApplication';

class MainEntry {
  /**
   * Boots the desktop live-price application and reports startup failures.
   */
  public async run(): Promise<void> {
    const diagnostics = new AppDiagnostics();
    process.on('uncaughtException', (error: Error) => diagnostics.showStartupFailure(error));
    process.on('unhandledRejection', (reason: unknown) => diagnostics.record(reason));
    await new PriceWidgetApplication(diagnostics).start();
  }
}

void new MainEntry().run().catch((error: unknown) => {
  new AppDiagnostics().showStartupFailure(error);
});

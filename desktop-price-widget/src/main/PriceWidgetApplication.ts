import { join } from 'node:path';

import {
  app,
  ipcMain,
  Notification,
  session,
  type IpcMainInvokeEvent,
} from 'electron';

import { IPC_CHANNELS, type CatalogSnapshot } from '../shared/contracts';
import { GhadirPartnerClient } from './clients/GhadirPartnerClient';
import { AppConfigLoader, type AppConfig } from './config/AppConfig';
import { PriceSnapshotRepository } from './repositories/PriceSnapshotRepository';
import { DesktopWidgetController } from './services/DesktopWidgetController';
import { PriceMapper } from './services/PriceMapper';
import { PriceServiceFacade } from './services/PriceServiceFacade';

export class PriceWidgetApplication {
  private widget: DesktopWidgetController | null = null;
  private facade: PriceServiceFacade | null = null;
  private config: AppConfig | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

  /**
   * Starts the Electron application and live-price polling.
   */
  public async start(): Promise<void> {
    await app.whenReady();

    const configPath = app.isPackaged
      ? join(process.resourcesPath, 'config', 'app.yaml')
      : join(process.cwd(), 'config', 'app.yaml');
    this.config = await new AppConfigLoader(configPath).load();

    const portalSession = session.fromPartition('persist:ghadir-price-widget');
    const client = new GhadirPartnerClient(portalSession, this.config.api);
    const repository = new PriceSnapshotRepository(
      join(app.getPath('userData'), 'price-snapshot.json'),
    );
    const mapper = new PriceMapper(this.config.price_labels, this.config.ui.hide_zero_prices);
    this.facade = new PriceServiceFacade(client, repository, mapper);

    this.widget = new DesktopWidgetController(this.config.ui);
    this.widget.initializeAutoStart();
    this.registerIpc();
    this.widget.start();
    this.beginPolling(this.config.refresh.interval_seconds);

    app.on('activate', () => this.widget?.show());
    app.on('before-quit', () => this.stopPolling());
  }

  private registerIpc(): void {
    ipcMain.handle(
      IPC_CHANNELS.login,
      async (_event: IpcMainInvokeEvent, identity: string, password: string) =>
        this.requireFacade().login(identity, password),
    );
    ipcMain.handle(IPC_CHANNELS.logout, async () => this.requireFacade().logout());
    ipcMain.handle(IPC_CHANNELS.session, async () => this.requireFacade().session());
    ipcMain.handle(IPC_CHANNELS.refresh, async () => this.refreshAndBroadcast(false));
    ipcMain.handle(IPC_CHANNELS.widgetSettings, () => this.requireWidget().settings());
    ipcMain.handle(IPC_CHANNELS.setCompact, (_event: IpcMainInvokeEvent, compact: boolean) =>
      this.requireWidget().setCompact(compact),
    );
    ipcMain.handle(IPC_CHANNELS.setAutoStart, (_event: IpcMainInvokeEvent, enabled: boolean) =>
      this.requireWidget().setAutoStart(enabled),
    );
  }

  private beginPolling(intervalSeconds: number): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.refreshIfAuthenticated().catch((error: unknown) => {
        this.reportBackgroundError(error);
      });
    }, intervalSeconds * 1000);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async refreshIfAuthenticated(): Promise<void> {
    const state = await this.requireFacade().session();
    if (state.authenticated) {
      await this.refreshAndBroadcast(true);
    }
  }

  private async refreshAndBroadcast(notifyOnChange: boolean): Promise<CatalogSnapshot> {
    const snapshot = await this.requireFacade().refresh();
    this.widget?.send(IPC_CHANNELS.catalogUpdated, snapshot);

    const config = this.requireConfig();
    if (
      notifyOnChange &&
      config.notifications.price_changes &&
      snapshot.hasPriceChanges &&
      Notification.isSupported()
    ) {
      new Notification({
        title: config.ui.title,
        body: 'یک یا چند قیمت در قدیر پارتنر تغییر کرده است.',
      }).show();
    }

    return snapshot;
  }

  private reportBackgroundError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Desktop price refresh failed: ${message}\n`);
  }

  private requireWidget(): DesktopWidgetController {
    if (this.widget === null) {
      throw new Error('Desktop widget is not initialized.');
    }
    return this.widget;
  }

  private requireFacade(): PriceServiceFacade {
    if (this.facade === null) {
      throw new Error('Price service is not initialized.');
    }
    return this.facade;
  }

  private requireConfig(): AppConfig {
    if (this.config === null) {
      throw new Error('Application configuration is not initialized.');
    }
    return this.config;
  }
}

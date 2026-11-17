import { app, BrowserWindow, Menu, nativeImage, screen, Tray } from 'electron';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import type { WidgetSettings } from '../../shared/contracts';
import type { AppConfig } from '../config/AppConfig';

const TRAY_ICON =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA/0lEQVR4nNWXOw7CMAyGXcRKRhZyguZaHItrwQk6MXIBmIjSxHZj18HCUpem8v/JrzrT6TK/wdEOnuIAAEfu8Hl9mIicbzN5NmEpsBLuAWlSMEqc8r2KQP0BF7o9wqVfsgitxLd8ZYCS0lIc81lqubehOwA7Bzh7LffmXYhJ7EcVAUyce28KsCUihRAB1M5DTPnRQqiLsBbV5H8XgJX9L0CdZ00HAAjnQIhpJaQVLU0cgd5i64VTpcASQj2KKQisNjhg8y7AxLhIDGlDCcSwOdA7KTMAtbFYQISYyI2LjIAlBOeruReMXMsB2n2zicCIhZTzjd6MvuZ2Nfuluf+OP9Y9ZX6x1xgKAAAAAElFTkSuQmCC';

export class DesktopWidgetController {
  private window: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private exiting = false;
  private compact: boolean;

  public constructor(private readonly config: AppConfig['ui']) {
    this.compact = config.start_compact;
  }

  /**
   * Creates the window and notification-area icon.
   */
  public start(): void {
    this.createWindow();
    this.tray = new Tray(nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_ICON}`));
    this.tray.setToolTip(this.config.title);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'نمایش قیمت‌ها', click: () => this.show() },
        { label: 'حالت کوچک / کامل', click: () => this.setCompact(!this.compact) },
        { type: 'separator' },
        {
          label: 'خروج کامل',
          click: () => {
            this.exiting = true;
            app.quit();
          },
        },
      ]),
    );
    this.tray.on('double-click', () => this.show());
  }

  /**
   * Allows the application to close its window during a real quit.
   */
  public allowExit(): void {
    this.exiting = true;
  }

  /**
   * Shows the existing widget without losing authentication state.
   */
  public show(): void {
    if (this.window === null || this.window.isDestroyed()) {
      this.createWindow();
    }
    this.window?.show();
    this.window?.focus();
  }

  /**
   * Returns the widget's current layout and Windows startup setting.
   *
   * @returns User-controllable desktop settings.
   */
  public settings(): WidgetSettings {
    return {
      compact: this.compact,
      autoStart: process.platform === 'win32' && app.isPackaged && !this.isPortable()
        ? app.getLoginItemSettings().openAtLogin
        : false,
    };
  }

  /**
   * Switches between the compact and full-size layouts.
   *
   * @param compact Whether compact layout is requested.
   * @returns Updated widget settings.
   */
  public setCompact(compact: boolean): WidgetSettings {
    this.compact = compact;
    const window = this.window;
    if (window !== null && !window.isDestroyed()) {
      const size = this.windowSize();
      const area = screen.getDisplayMatching(window.getBounds()).workArea;
      window.setMinimumSize(size.width, size.height);
      window.setBounds({
        x: area.x + Math.max(0, area.width - size.width - this.config.edge_margin),
        y: area.y + Math.max(0, area.height - size.height - this.config.edge_margin),
        ...size,
      });
      window.webContents.send('ghadir-prices:layout', this.settings());
    }
    return this.settings();
  }

  /**
   * Configures Windows login startup only for an installed Windows build.
   *
   * @param enabled Whether the widget should start after login.
   * @returns Updated widget settings.
   */
  public setAutoStart(enabled: boolean): WidgetSettings {
    if (process.platform !== 'win32' || !app.isPackaged || this.isPortable()) {
      throw new Error('اجرای خودکار فقط در نسخه نصب‌شده ویندوز قابل تنظیم است.');
    }
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: false });
    writeFileSync(this.startupPreferencePath(), JSON.stringify({ enabled }), 'utf8');
    return this.settings();
  }

  /**
   * Applies the default Windows login behavior on first installation only.
   */
  public initializeAutoStart(): void {
    if (process.platform === 'win32' && app.isPackaged && !this.isPortable()) {
      const current = app.getLoginItemSettings().openAtLogin;
      const preferencePath = this.startupPreferencePath();
      if (existsSync(preferencePath)) {
        try {
          const preference: unknown = JSON.parse(readFileSync(preferencePath, 'utf8'));
          if (this.isStartupPreference(preference)) {
            if (preference.enabled !== current) {
              app.setLoginItemSettings({ openAtLogin: preference.enabled, openAsHidden: false });
            }
            return;
          }
        } catch {
          // Recover invalid local preferences using validated application defaults.
        }
      }
      app.setLoginItemSettings({
        openAtLogin: this.config.auto_start_on_install,
        openAsHidden: false,
      });
      writeFileSync(
        preferencePath,
        JSON.stringify({ enabled: this.config.auto_start_on_install }),
        'utf8',
      );
    }
  }

  /**
   * Sends a live catalog snapshot to the active renderer.
   *
   * @param channel Whitelisted IPC channel name.
   * @param payload Typed serializable snapshot.
   */
  public send(channel: string, payload: object): void {
    if (this.window !== null && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, payload);
    }
  }

  private isPortable(): boolean {
    return Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
  }

  private startupPreferencePath(): string {
    return join(app.getPath('userData'), 'startup-preference.json');
  }

  private isStartupPreference(value: unknown): value is { enabled: boolean } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'enabled' in value &&
      typeof value.enabled === 'boolean'
    );
  }

  private createWindow(): void {
    const size = this.windowSize();
    const area = screen.getPrimaryDisplay().workArea;
    const window = new BrowserWindow({
      title: this.config.title,
      width: size.width,
      height: size.height,
      x: area.x + Math.max(0, area.width - size.width - this.config.edge_margin),
      y: area.y + Math.max(0, area.height - size.height - this.config.edge_margin),
      minWidth: size.width,
      minHeight: size.height,
      alwaysOnTop: this.config.always_on_top,
      autoHideMenuBar: true,
      backgroundColor: '#0d1b2a',
      webPreferences: {
        preload: join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    window.on('close', (event) => {
      if (!this.exiting) {
        event.preventDefault();
        window.hide();
      }
    });
    void window.loadFile(join(__dirname, 'index.html'));
    this.window = window;
  }

  private windowSize(): { width: number; height: number } {
    return this.compact
      ? { width: this.config.compact_width, height: this.config.compact_height }
      : { width: this.config.window_width, height: this.config.window_height };
  }
}

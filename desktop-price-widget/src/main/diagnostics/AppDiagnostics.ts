import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { app, dialog } from 'electron';

export class AppDiagnostics {
  /**
   * Records a startup or runtime failure without collecting account credentials.
   *
   * @param error The thrown failure.
   * @returns Full path to the local diagnostic log.
   */
  public record(error: unknown): string {
    const directory = app.getPath('userData');
    const logPath = join(directory, 'desktop-errors.log');
    try {
      mkdirSync(directory, { recursive: true });
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      appendFileSync(logPath, `[${new Date().toISOString()}] ${message.slice(0, 3000)}\n`);
    } catch {
      // Avoid recursively failing while collecting a failure report.
    }
    return logPath;
  }

  /**
   * Displays a local diagnostic path when application startup fails.
   *
   * @param error The startup error.
   */
  public showStartupFailure(error: unknown): void {
    const path = this.record(error);
    dialog.showErrorBox(
      'قدیر پارتنر — خطا در اجرای برنامه',
      `برنامه نتوانست شروع شود. متن خطا در فایل زیر ثبت شد:\n${path}\n\n${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

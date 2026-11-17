import { contextBridge, ipcRenderer } from 'electron';

import {
  IPC_CHANNELS,
  type CatalogSnapshot,
  type GhadirPriceBridge,
  type SessionState,
} from '../shared/contracts';

class PreloadBridge {
  /**
   * Registers the isolated renderer API.
   */
  public expose(): void {
    const bridge: GhadirPriceBridge = {
      login: (identity: string, password: string): Promise<SessionState> =>
        ipcRenderer.invoke(IPC_CHANNELS.login, identity, password) as Promise<SessionState>,
      logout: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.logout) as Promise<void>,
      session: (): Promise<SessionState> =>
        ipcRenderer.invoke(IPC_CHANNELS.session) as Promise<SessionState>,
      refresh: (): Promise<CatalogSnapshot> =>
        ipcRenderer.invoke(IPC_CHANNELS.refresh) as Promise<CatalogSnapshot>,
      onCatalog: (listener: (snapshot: CatalogSnapshot) => void): (() => void) => {
        const handler = (_event: Electron.IpcRendererEvent, snapshot: CatalogSnapshot): void => {
          listener(snapshot);
        };
        ipcRenderer.on(IPC_CHANNELS.catalogUpdated, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.catalogUpdated, handler);
      },
    };

    contextBridge.exposeInMainWorld('ghadirPrices', bridge);
  }
}

new PreloadBridge().expose();

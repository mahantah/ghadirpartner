import type { Session } from 'electron';
import type { ZodType } from 'zod';

import type { AppConfig } from '../config/AppConfig';
import {
  MeSchema,
  RawCatalogSchema,
  type MeResponse,
  type RawCatalog,
} from '../models/GhadirModels';

export class GhadirApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'GhadirApiError';
  }
}

export class GhadirPartnerClient {
  public constructor(
    private readonly electronSession: Session,
    private readonly config: AppConfig['api'],
  ) {}

  /**
   * Authenticates against the Ghadir Partner customer portal.
   *
   * @param identity Mobile number or username accepted by the portal.
   * @param password Account password. It is sent only to the portal and is not persisted.
   */
  public async login(identity: string, password: string): Promise<void> {
    await this.request(
      this.config.endpoints.login,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: identity, password }),
      },
      undefined,
    );
  }

  /**
   * Ends the current Ghadir Partner session.
   */
  public async logout(): Promise<void> {
    await this.request(this.config.endpoints.logout, { method: 'POST' }, undefined);
  }

  /**
   * Reads the currently authenticated user.
   *
   * @returns Current portal identity.
   */
  public async me(): Promise<MeResponse> {
    return this.request(this.config.endpoints.me, { method: 'GET' }, MeSchema);
  }

  /**
   * Fetches the catalog exactly as filtered by the authenticated account permissions.
   *
   * @returns Live catalog and permitted price columns.
   */
  public async catalog(): Promise<RawCatalog> {
    return this.request(this.config.endpoints.catalog, { method: 'GET' }, RawCatalogSchema);
  }

  private async request<T>(
    endpoint: string,
    init: RequestInit,
    schema: ZodType<T> | undefined,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.request_timeout_ms);

    try {
      const response = await this.electronSession.fetch(new URL(endpoint, this.config.base_url), {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = (await response.text()).trim() || `HTTP ${response.status}`;
        throw new GhadirApiError(message, response.status);
      }

      if (schema === undefined) {
        return undefined as T;
      }

      const payload: unknown = await response.json();
      return schema.parse(payload);
    } finally {
      clearTimeout(timeout);
    }
  }
}

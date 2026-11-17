import type { CatalogSnapshot, SessionState } from '../../shared/contracts';
import { GhadirApiError, type GhadirPartnerClient } from '../clients/GhadirPartnerClient';
import type { PriceSnapshotRepository } from '../repositories/PriceSnapshotRepository';
import type { PriceMapper } from './PriceMapper';

export class PriceServiceFacade {
  public constructor(
    private readonly client: GhadirPartnerClient,
    private readonly repository: PriceSnapshotRepository,
    private readonly mapper: PriceMapper,
  ) {}

  /**
   * Authenticates the user and returns the resulting session state.
   *
   * @param identity Mobile number or username.
   * @param password Account password.
   * @returns Authenticated session state.
   */
  public async login(identity: string, password: string): Promise<SessionState> {
    await this.client.login(identity.trim(), password);
    return this.session();
  }

  /**
   * Logs out the current user.
   */
  public async logout(): Promise<void> {
    await this.client.logout();
  }

  /**
   * Determines whether the persisted portal session is still valid.
   *
   * @returns Current authentication state.
   */
  public async session(): Promise<SessionState> {
    try {
      const me = await this.client.me();
      return { authenticated: true, identity: me.username };
    } catch (error: unknown) {
      if (error instanceof GhadirApiError && error.status === 401) {
        return { authenticated: false, identity: '' };
      }
      throw error;
    }
  }

  /**
   * Fetches and maps the latest permitted prices.
   *
   * @returns Live catalog snapshot.
   */
  public async refresh(): Promise<CatalogSnapshot> {
    const [catalog, previous] = await Promise.all([
      this.client.catalog(),
      this.repository.load(),
    ]);
    const refreshedAt = new Date().toISOString();
    const snapshot = this.mapper.map(catalog, previous, refreshedAt);
    await this.repository.save(this.mapper.toStore(catalog));
    return snapshot;
  }
}

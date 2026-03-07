/**
 * StorachaBountyClient - A TypeScript wrapper for Storacha (w3up) client
 * Provides a simplified interface for the data bounty marketplace
 */

import * as Client from "@storacha/client";
import {
  DEFAULT_GATEWAYS,
  IPFSFetchError,
  type AccountInfo,
  type AuthorizationStatus,
  type CacheEntry,
  type CID,
  type CreateSpaceOptions,
  type DelegationOptions,
  type DelegationResult,
  type DID,
  type Email,
  type FetchOptions,
  type FetchRawResult,
  type FetchResult,
  type FileInput,
  type SpaceInfo,
  type StorachaBountyClientConfig,
  type UploadOptions,
  type UploadResult,
} from "./types.js";

/**
 * StorachaBountyClient provides a simplified interface to Storacha
 * for uploading and managing data in the bounty marketplace.
 *
 * @example
 * ```typescript
 * import { StorachaBountyClient } from '@storacha-chainlink/sdk';
 *
 * const client = await StorachaBountyClient.create();
 * await client.authorize('user@example.com');
 * const space = await client.createSpace({ name: 'my-bounty-data' });
 * await client.setCurrentSpace(space.did);
 *
 * const result = await client.uploadFile(myFile);
 * console.log('Uploaded:', result.cidString);
 * ```
 */
export class StorachaBountyClient {
  private client: Client.Client;
  private cache: Map<string, CacheEntry> = new Map();
  private gatewayBaseUrl: string;
  private gateways: string[];

  private constructor(
    client: Client.Client,
    config?: StorachaBountyClientConfig,
  ) {
    this.client = client;
    const raw =
      config?.serviceUrl && config.serviceUrl.length > 0
        ? config.serviceUrl
        : "https://w3s.link/ipfs/";
    const withPath = raw.includes("/ipfs")
      ? raw
      : `${raw.replace(/\/+$/, "")}/ipfs/`;
    const normalizedBase = withPath.endsWith("/") ? withPath : `${withPath}/`;
    this.gatewayBaseUrl = normalizedBase;
    this.gateways =
      config?.serviceUrl && config.serviceUrl.length > 0
        ? [normalizedBase, ...DEFAULT_GATEWAYS]
        : [...DEFAULT_GATEWAYS];
  }

  private getGatewayList(gateways?: string[]): string[] {
    return gateways ?? [...this.gateways];
  }

  /**
   * Create a new StorachaBountyClient instance
   * @param config - Optional configuration options
   * @returns A new StorachaBountyClient instance
   */
  static async create(
    config?: StorachaBountyClientConfig,
  ): Promise<StorachaBountyClient> {
    const client = await Client.create(config?.clientOptions);
    return new StorachaBountyClient(client, config);
  }

  // ============ Authentication ============

  /**
   * Authorize the client with an email address.
   * This sends a verification email to the provided address.
   * The promise resolves when the user clicks the confirmation link.
   *
   * @param email - The email address to authorize with
   * @throws Error if authorization fails
   *
   * @example
   * ```typescript
   * await client.authorize('user@example.com');
   * // User receives email, clicks link
   * // Promise resolves when verified
   * ```
   */
  async authorize(email: Email): Promise<void> {
    await this.client.authorize(email, {
      signal: AbortSignal.timeout(300000), // 5 minute timeout
    });
  }

  /**
   * Check the current authorization status
   * @returns The current authorization status
   */
  async getAuthorizationStatus(): Promise<AuthorizationStatus> {
    const accounts = this.client.accounts();
    const accountEntries = Object.entries(accounts);

    if (accountEntries.length === 0) {
      return { isAuthorized: false };
    }

    const [did, account] = accountEntries[0]!;
    const currentSpace = this.client.currentSpace();

    return {
      isAuthorized: true,
      account: {
        did: did as DID,
        email: (account as unknown as { email: () => string }).email() as Email,
      },
      currentSpace: currentSpace
        ? {
            did: currentSpace.did() as DID,
            name: currentSpace.name,
            isCurrentSpace: true,
          }
        : undefined,
    };
  }

  /**
   * Get all authorized accounts
   * @returns Array of account information
   */
  getAccounts(): AccountInfo[] {
    const accounts = this.client.accounts();
    return Object.entries(accounts).map(([did, account]) => ({
      did: did as DID,
      email: (account as unknown as { email: () => string }).email() as Email,
    }));
  }

  // ============ Space Management ============

  /**
   * Create a new space for storing data
   * @param options - Options for creating the space
   * @returns The created space information
   *
   * @example
   * ```typescript
   * const space = await client.createSpace({ name: 'bounty-submissions' });
   * console.log('Space DID:', space.did);
   * ```
   */
  async createSpace(options?: CreateSpaceOptions): Promise<SpaceInfo> {
    const accounts = this.client.accounts();
    const accountEntries = Object.entries(accounts);

    if (accountEntries.length === 0) {
      throw new Error("No authorized account found. Call authorize() first.");
    }

    const [, account] = accountEntries[0]!;
    const space = await this.client.createSpace(
      options?.name ?? "bounty-space",
      {
        account,
      } as Parameters<typeof this.client.createSpace>[1],
    );

    // Automatically set as current space
    await this.client.setCurrentSpace(space.did());

    return {
      did: space.did() as DID,
      name: options?.name,
      isCurrentSpace: true,
    };
  }

  /**
   * Get all available spaces
   * @returns Array of space information
   */
  getSpaces(): SpaceInfo[] {
    const spaces = this.client.spaces();
    const currentSpace = this.client.currentSpace();

    return spaces.map((space: { did: () => string; name?: string }) => ({
      did: space.did() as DID,
      name: space.name,
      isCurrentSpace: currentSpace?.did() === space.did(),
    }));
  }

  /**
   * Get the current active space
   * @returns The current space or undefined if none is set
   */
  getCurrentSpace(): SpaceInfo | undefined {
    const space = this.client.currentSpace();
    if (!space) return undefined;

    return {
      did: space.did() as DID,
      name: space.name,
      isCurrentSpace: true,
    };
  }

  /**
   * Set the current active space
   * @param spaceDid - The DID of the space to set as current
   *
   * @example
   * ```typescript
   * await client.setCurrentSpace('did:key:z6Mk...');
   * ```
   */
  async setCurrentSpace(spaceDid: DID): Promise<void> {
    await this.client.setCurrentSpace(spaceDid);
  }

  /**
   * Add a space from a delegation proof
   * @param proof - The delegation proof (as Uint8Array or base64 string)
   * @returns The added space information
   */
  async addSpace(proof: Uint8Array | string): Promise<SpaceInfo> {
    const proofBytes =
      typeof proof === "string" ? base64ToUint8Array(proof) : proof;

    // Import the delegation and add the space
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegation = await (Client as any).Delegation.extract(proofBytes);
    const space = await this.client.addSpace(delegation);

    return {
      did: space.did() as DID,
      name: space.name,
      isCurrentSpace: false,
    };
  }

  // ============ File Upload ============

  /**
   * Upload a single file to Storacha
   * @param file - The file to upload (File, Blob, or FileInput)
   * @param options - Upload options
   * @returns The upload result with CID
   *
   * @example
   * ```typescript
   * const file = new File(['Hello, World!'], 'hello.txt', { type: 'text/plain' });
   * const result = await client.uploadFile(file);
   * console.log('CID:', result.cidString);
   * ```
   */
  async uploadFile(
    file: File | Blob | FileInput,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    this.ensureCurrentSpace();

    let blob: Blob;
    if ("content" in file) {
      // FileInput type
      const content =
        file.content instanceof Uint8Array
          ? new Blob([new Uint8Array(file.content)], { type: file.type })
          : file.content;
      blob = content;
    } else {
      blob = file;
    }

    const cid = await this.client.uploadFile(blob, {
      onShardStored: options?.onShardStored
        ? (meta: { cid: unknown; size: number }) => {
            options.onShardStored?.({
              cid: meta.cid as CID,
              size: meta.size,
            });
          }
        : undefined,
    });

    return {
      cid: cid as unknown as CID,
      cidString: cid.toString(),
    };
  }

  /**
   * Upload multiple files as a directory
   * @param files - Array of files to upload
   * @param options - Upload options
   * @returns The upload result with root CID
   *
   * @example
   * ```typescript
   * const files = [
   *   new File(['data1'], 'file1.txt'),
   *   new File(['data2'], 'file2.txt'),
   * ];
   * const result = await client.uploadDirectory(files);
   * ```
   */
  async uploadDirectory(
    files: File[],
    options?: UploadOptions,
  ): Promise<UploadResult> {
    this.ensureCurrentSpace();

    const cid = await this.client.uploadDirectory(files, {
      onShardStored: options?.onShardStored
        ? (meta: { cid: unknown; size: number }) => {
            options.onShardStored?.({
              cid: meta.cid as CID,
              size: meta.size,
            });
          }
        : undefined,
    });

    return {
      cid: cid as unknown as CID,
      cidString: cid.toString(),
    };
  }

  /**
   * Upload JSON data directly
   * @param data - The JSON-serializable data to upload
   * @param filename - Optional filename (defaults to 'data.json')
   * @returns The upload result with CID
   *
   * @example
   * ```typescript
   * const result = await client.uploadJSON({
   *   bountyId: 1,
   *   data: { temperature: 25, humidity: 60 }
   * });
   * ```
   */
  async uploadJSON(
    data: unknown,
    filename = "data.json",
  ): Promise<UploadResult> {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const file = new File([blob], filename, { type: "application/json" });
    return this.uploadFile(file);
  }

  // ============ UCAN Delegation ============

  /**
   * Create a delegation to share capabilities with another agent
   * @param audienceDid - The DID of the agent to delegate to
   * @param options - Delegation options including capabilities
   * @returns The delegation result with serialized proof
   *
   * @example
   * ```typescript
   * const delegation = await client.createDelegation(
   *   'did:key:z6Mk...',
   *   { capabilities: ['upload/add', 'store/add'] }
   * );
   * // Share delegation.base64 with the other agent
   * ```
   */
  async createDelegation(
    audienceDid: DID,
    options: DelegationOptions,
  ): Promise<DelegationResult> {
    this.ensureCurrentSpace();

    // Parse the audience DID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audience = (Client as any).DID.parse(audienceDid);

    const expiration = options.expiration
      ? Math.floor(Date.now() / 1000) + options.expiration
      : undefined;

    const delegation = await this.client.createDelegation(
      audience,
      options.capabilities as Parameters<
        typeof this.client.createDelegation
      >[1],
      { expiration },
    );

    const archive = await delegation.archive();
    if (!archive.ok) {
      throw new Error("Failed to archive delegation");
    }

    return {
      archive: archive.ok,
      base64: uint8ArrayToBase64(archive.ok),
    };
  }

  /**
   * Get all proofs (delegations) available to the client
   * @returns Array of delegation information
   */
  getProofs(): unknown[] {
    return this.client.proofs();
  }

  // ============ Content Management ============

  /**
   * Remove content from the space
   * @param cid - The CID of the content to remove (as string or CID object)
   *
   * @example
   * ```typescript
   * await client.remove(uploadResult.cidString);
   * ```
   */
  async remove(cid: string | { toString(): string }): Promise<void> {
    this.ensureCurrentSpace();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cidLink = (Client as any).Link.parse(cid.toString());
    await this.client.remove(cidLink);
  }

  /**
   * Get the retrieval URL for a CID
   * @param cid - The CID to get the URL for
   * @returns The IPFS gateway URL
   */
  getRetrievalUrl(cid: string | { toString(): string }): string {
    const cidString = typeof cid === "string" ? cid : cid.toString();
    return `${this.gatewayBaseUrl}${cidString}`;
  }

  // ============ IPFS Data Retrieval ============

  /**
   * Fetch data from IPFS by CID with automatic gateway fallback
   * @param cid - The CID to fetch
   * @param options - Fetch options
   * @returns The fetched data with metadata
   *
   * @example
   * ```typescript
   * // Fetch JSON data
   * const result = await client.fetchByCID<{ name: string }>('bafybeig...');
   * console.log(result.data.name);
   *
   * // Fetch with custom options
   * const result = await client.fetchByCID('bafybeig...', {
   *   timeout: 5000,
   *   useCache: false
   * });
   * ```
   */
  async fetchByCID<T = unknown>(
    cid: string | { toString(): string },
    options?: FetchOptions,
  ): Promise<FetchResult<T>> {
    const cidString = typeof cid === "string" ? cid : cid.toString();
    const {
      timeout = 10000,
      maxRetries = 2,
      useCache = true,
      cacheTTL = 300000,
      gateways,
    } = options ?? {};
    const gatewayList = this.getGatewayList(gateways);

    // Check cache first
    if (useCache) {
      const cached = this.getFromCache<T>(cidString);
      if (cached) {
        return {
          data: cached.data,
          cid: cidString,
          gateway: cached.gateway,
          contentType: cached.contentType,
          cached: true,
        };
      }
    }

    const gatewayErrors = new Map<string, Error>();

    for (const gateway of gatewayList) {
      const url = `${gateway}${cidString}`;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await this.fetchWithTimeout(url, timeout);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType =
            response.headers.get("content-type") ?? "application/octet-stream";
          let data: T;

          if (contentType.includes("application/json")) {
            data = (await response.json()) as T;
          } else {
            // For non-JSON, return as text and let caller handle parsing
            data = (await response.text()) as unknown as T;
          }

          // Cache the result
          if (useCache) {
            this.setCache(cidString, {
              data,
              contentType,
              gateway,
              cachedAt: Date.now(),
              ttl: cacheTTL,
            });
          }

          return {
            data,
            cid: cidString,
            gateway,
            contentType,
            cached: false,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          // Only store the last error for this gateway
          if (attempt === maxRetries) {
            gatewayErrors.set(gateway, new Error(errorMessage));
          }

          // Exponential backoff before retry
          if (attempt < maxRetries) {
            await this.delay(Math.pow(2, attempt) * 100);
          }
        }
      }
    }

    throw new IPFSFetchError(cidString, gatewayErrors);
  }

  /**
   * Fetch raw bytes from IPFS by CID with automatic gateway fallback
   * @param cid - The CID to fetch
   * @param options - Fetch options
   * @returns The raw bytes with metadata
   *
   * @example
   * ```typescript
   * const result = await client.fetchRawByCID('bafybeig...');
   * console.log(result.data); // Uint8Array
   * ```
   */
  async fetchRawByCID(
    cid: string | { toString(): string },
    options?: FetchOptions,
  ): Promise<FetchRawResult> {
    const cidString = typeof cid === "string" ? cid : cid.toString();
    const {
      timeout = 10000,
      maxRetries = 2,
      useCache = true,
      cacheTTL = 300000,
      gateways,
    } = options ?? {};
    const gatewayList = this.getGatewayList(gateways);

    // Check cache first
    if (useCache) {
      const cached = this.getFromCache<Uint8Array>(cidString);
      if (cached && cached.data instanceof Uint8Array) {
        return {
          data: cached.data,
          cid: cidString,
          gateway: cached.gateway,
          contentType: cached.contentType,
          cached: true,
        };
      }
    }

    const gatewayErrors = new Map<string, Error>();

    for (const gateway of gatewayList) {
      const url = `${gateway}${cidString}`;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await this.fetchWithTimeout(url, timeout);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType =
            response.headers.get("content-type") ?? "application/octet-stream";
          const arrayBuffer = await response.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);

          // Cache the result
          if (useCache) {
            this.setCache(cidString, {
              data,
              contentType,
              gateway,
              cachedAt: Date.now(),
              ttl: cacheTTL,
            });
          }

          return {
            data,
            cid: cidString,
            gateway,
            contentType,
            cached: false,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          if (attempt === maxRetries) {
            gatewayErrors.set(gateway, new Error(errorMessage));
          }

          if (attempt < maxRetries) {
            await this.delay(Math.pow(2, attempt) * 100);
          }
        }
      }
    }

    throw new IPFSFetchError(cidString, gatewayErrors);
  }

  /**
   * Clear the fetch cache
   * @param cid - Optional CID to clear. If not provided, clears entire cache.
   */
  clearCache(cid?: string): void {
    if (cid) {
      this.cache.delete(cid);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   * @returns Cache size and entry count
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  // ============ Utility Methods ============

  /**
   * Get the underlying Storacha client for advanced usage
   * @returns The raw Storacha client
   */
  getRawClient(): Client.Client {
    return this.client;
  }

  /**
   * Get the client's agent DID
   * @returns The agent DID
   */
  getAgentDid(): DID {
    return this.client.agent.did() as DID;
  }

  /**
   * Ensure a current space is set
   * @throws Error if no space is set
   */
  private ensureCurrentSpace(): void {
    if (!this.client.currentSpace()) {
      throw new Error(
        "No current space set. Call createSpace() or setCurrentSpace() first.",
      );
    }
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(
    url: string,
    timeout: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get an item from cache if it exists and is not expired
   */
  private getFromCache<T>(cid: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(cid) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.cachedAt > entry.ttl) {
      // Entry expired, remove it
      this.cache.delete(cid);
      return undefined;
    }

    return entry;
  }

  /**
   * Set an item in cache
   */
  private setCache<T>(cid: string, entry: CacheEntry<T>): void {
    this.cache.set(cid, entry as CacheEntry);
  }

  /**
   * Delay for a specified number of milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============ Helper Functions ============

/**
 * Convert a base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

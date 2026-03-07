import type { ClientFactoryOptions } from "@storacha/client";

/**
 * Types for the Storacha Bounty SDK
 */

/**
 * Content Identifier (CID) - a unique identifier for content on IPFS
 * This is a simplified interface compatible with multiformats CID
 */
export interface CID {
  /** CID version (0 or 1) */
  readonly version: 0 | 1;
  /** The multicodec code */
  readonly code: number;
  /** The multihash bytes */
  readonly multihash: {
    readonly code: number;
    readonly size: number;
    readonly digest: Uint8Array;
    readonly bytes: Uint8Array;
  };
  /** The raw bytes of the CID */
  readonly bytes: Uint8Array;
  /** Convert to string representation */
  toString(): string;
}

/**
 * Decentralized Identifier (DID) for spaces and agents
 */
export type DID = `did:${string}:${string}`;

/**
 * Email address type for authentication
 */
export type Email = `${string}@${string}`;

/**
 * Space information returned from Storacha
 */
export interface SpaceInfo {
  /** The DID of the space */
  did: DID;
  /** Human-readable name of the space */
  name?: string;
  /** Whether this is the current active space */
  isCurrentSpace: boolean;
}

/**
 * Account information after authentication
 */
export interface AccountInfo {
  /** The DID of the account */
  did: DID;
  /** The email associated with the account */
  email: Email;
}

/**
 * Upload result containing the CID and metadata
 */
export interface UploadResult {
  /** The root CID of the uploaded content */
  cid: CID;
  /** String representation of the CID */
  cidString: string;
  /** Size of the uploaded content in bytes */
  size?: number;
}

/**
 * Options for uploading files
 */
export interface UploadOptions {
  /** Callback when a shard is stored */
  onShardStored?: (meta: ShardMeta) => void;
  /** Optional name for the upload */
  name?: string;
}

/**
 * Metadata for uploaded shards
 */
export interface ShardMeta {
  /** CID of the shard */
  cid: CID;
  /** Size of the shard in bytes */
  size: number;
}

/**
 * Options for creating a space
 */
export interface CreateSpaceOptions {
  /** Name for the new space */
  name?: string;
}

/**
 * UCAN delegation capabilities
 */
export type Capability =
  | "blob/add"
  | "blob/remove"
  | "blob/list"
  | "upload/add"
  | "upload/remove"
  | "upload/list"
  | "space/info"
  | "store/add"
  | "store/remove"
  | "store/list"
  | "*";

/**
 * Options for creating a delegation
 */
export interface DelegationOptions {
  /** Capabilities to delegate */
  capabilities: Capability[];
  /** Expiration time in seconds from now (optional) */
  expiration?: number;
}

/**
 * Delegation result
 */
export interface DelegationResult {
  /** The delegation as a serialized archive */
  archive: Uint8Array;
  /** The delegation as a base64 string for easy transport */
  base64: string;
}

/**
 * Client configuration options
 */
export interface StorachaBountyClientConfig {
  /** Custom service URL (optional, defaults to Storacha) */
  serviceUrl?: string;
  clientOptions?: ClientFactoryOptions;
}

/**
 * Authorization status
 */
export interface AuthorizationStatus {
  /** Whether the client is authorized */
  isAuthorized: boolean;
  /** The account info if authorized */
  account?: AccountInfo;
  /** The current space if set */
  currentSpace?: SpaceInfo;
}

/**
 * File input type - can be a File, Blob, or a simple object with content
 */
export interface FileInput {
  /** The file content as a Blob or Uint8Array */
  content: Blob | Uint8Array;
  /** The file name */
  name: string;
  /** Optional MIME type */
  type?: string;
}

// ============ IPFS Data Retrieval Types ============

/**
 * Default IPFS gateways for data retrieval
 */
export const DEFAULT_GATEWAYS = [
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://nftstorage.link/ipfs/",
] as const;

/**
 * Options for fetching data from IPFS
 */
export interface FetchOptions {
  /** Timeout per gateway in milliseconds (default: 10000) */
  timeout?: number;
  /** Maximum retries per gateway (default: 2) */
  maxRetries?: number;
  /** Enable caching (default: true) */
  useCache?: boolean;
  /** Cache TTL in milliseconds (default: 300000 - 5 minutes) */
  cacheTTL?: number;
  /** Custom gateway list (optional, uses DEFAULT_GATEWAYS if not provided) */
  gateways?: string[];
}

/**
 * Result from fetching data from IPFS
 */
export interface FetchResult<T = unknown> {
  /** The fetched and parsed data */
  data: T;
  /** The CID that was fetched */
  cid: string;
  /** The gateway that successfully served the content */
  gateway: string;
  /** The content type of the response */
  contentType: string;
  /** Whether the result was served from cache */
  cached: boolean;
}

/**
 * Result from fetching raw bytes from IPFS
 */
export interface FetchRawResult {
  /** The raw bytes of the content */
  data: Uint8Array;
  /** The CID that was fetched */
  cid: string;
  /** The gateway that successfully served the content */
  gateway: string;
  /** The content type of the response */
  contentType: string;
  /** Whether the result was served from cache */
  cached: boolean;
}

/**
 * Cache entry for storing fetched data
 */
export interface CacheEntry<T = unknown> {
  /** The cached data */
  data: T;
  /** The content type */
  contentType: string;
  /** The gateway that served the content */
  gateway: string;
  /** Timestamp when the entry was cached */
  cachedAt: number;
  /** TTL in milliseconds */
  ttl: number;
}

/**
 * Error thrown when all gateways fail to fetch content
 */
export class IPFSFetchError extends Error {
  /** The CID that failed to fetch */
  readonly cid: string;
  /** Errors from each gateway attempt */
  readonly gatewayErrors: Map<string, Error>;

  constructor(cid: string, gatewayErrors: Map<string, Error>) {
    const errorMessages = Array.from(gatewayErrors.entries())
      .map(([gateway, error]) => `  ${gateway}: ${error.message}`)
      .join("\n");
    super(`Failed to fetch CID ${cid} from all gateways:\n${errorMessages}`);
    this.name = "IPFSFetchError";
    this.cid = cid;
    this.gatewayErrors = gatewayErrors;
  }
}

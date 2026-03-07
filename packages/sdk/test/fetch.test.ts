/**
 * Unit tests for IPFS data retrieval functionality
 * Tests fetchByCID, fetchRawByCID, and caching behavior
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { StorachaBountyClient } from "../src/client.js";
import { DEFAULT_GATEWAYS, IPFSFetchError } from "../src/types.js";
import type { FetchResult, FetchRawResult } from "../src/types.js";

// Mock the @storacha/client module
vi.mock("@storacha/client", () => {
  const mockClient = {
    authorize: vi.fn().mockResolvedValue(undefined),
    accounts: vi.fn().mockReturnValue({}),
    spaces: vi.fn().mockReturnValue([]),
    currentSpace: vi.fn().mockReturnValue(null),
    agent: { did: () => "did:key:z6MkAgent123" },
  };

  return {
    create: vi.fn().mockResolvedValue(mockClient),
  };
});

// Store original fetch
const originalFetch = global.fetch;

describe("IPFS Data Retrieval", () => {
  let client: StorachaBountyClient;
  let mockFetch: Mock;

  beforeEach(async () => {
    // Create a fresh client for each test
    client = await StorachaBountyClient.create();

    // Clear the cache before each test
    client.clearCache();

    // Setup mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  // ============ fetchByCID Tests ============

  describe("fetchByCID", () => {
    it("should fetch JSON data successfully from first gateway", async () => {
      const testData = { name: "test", value: 42 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(testData),
      });

      const result: FetchResult<typeof testData> =
        await client.fetchByCID("bafytest123");

      expect(result.data).toEqual(testData);
      expect(result.cid).toBe("bafytest123");
      expect(result.gateway).toBe(DEFAULT_GATEWAYS[0]);
      expect(result.contentType).toBe("application/json");
      expect(result.cached).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should fallback to second gateway if first fails", async () => {
      const testData = { success: true };

      // First gateway fails
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Second gateway succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(testData),
      });

      const result = await client.fetchByCID("bafytest123", { maxRetries: 2 });

      expect(result.data).toEqual(testData);
      expect(result.gateway).toBe(DEFAULT_GATEWAYS[1]);
    });

    it("should handle non-JSON content as text", async () => {
      const textContent = "Hello, World!";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "text/plain" }),
        text: () => Promise.resolve(textContent),
      });

      const result = await client.fetchByCID<string>("bafytest123");

      expect(result.data).toBe(textContent);
      expect(result.contentType).toBe("text/plain");
    });

    it("should return cached result on second fetch", async () => {
      const testData = { cached: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(testData),
      });

      // First fetch
      const result1 = await client.fetchByCID("bafytest123");
      expect(result1.cached).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second fetch should be cached
      const result2 = await client.fetchByCID("bafytest123");
      expect(result2.cached).toBe(true);
      expect(result2.data).toEqual(testData);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it("should skip cache when useCache is false", async () => {
      const testData = { value: 1 };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(testData),
      });

      // First fetch
      await client.fetchByCID("bafytest123");

      // Second fetch with cache disabled
      const result = await client.fetchByCID("bafytest123", {
        useCache: false,
      });
      expect(result.cached).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should use custom gateways when provided", async () => {
      const customGateway = "https://my-gateway.com/ipfs/";
      const testData = { custom: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(testData),
      });

      const result = await client.fetchByCID("bafytest123", {
        gateways: [customGateway],
      });

      expect(result.gateway).toBe(customGateway);
      expect(mockFetch).toHaveBeenCalledWith(
        `${customGateway}bafytest123`,
        expect.any(Object),
      );
    });

    it("should prefer configured serviceUrl gateway when provided", async () => {
      client = await StorachaBountyClient.create({
        serviceUrl: "https://custom.gateway/ipfs/",
      });
      client.clearCache();
      const testData = { fromCustomGateway: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(testData),
      });

      const result = await client.fetchByCID("bafytestcustom");

      expect(result.gateway).toBe("https://custom.gateway/ipfs/");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.gateway/ipfs/bafytestcustom",
        expect.any(Object),
      );
    });

    it("should throw IPFSFetchError when all gateways fail", async () => {
      mockFetch.mockRejectedValue(new Error("All failed"));

      await expect(
        client.fetchByCID("bafytest123", { maxRetries: 0 }),
      ).rejects.toThrow(IPFSFetchError);
    });

    it("should include gateway errors in IPFSFetchError", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      try {
        await client.fetchByCID("bafytest123", {
          maxRetries: 0,
          gateways: [
            "https://gateway1.com/ipfs/",
            "https://gateway2.com/ipfs/",
          ],
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IPFSFetchError);
        const fetchError = error as IPFSFetchError;
        expect(fetchError.cid).toBe("bafytest123");
        expect(fetchError.gatewayErrors.size).toBe(2);
      }
    });

    it("should handle HTTP error responses", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(
        client.fetchByCID("bafynotfound", { maxRetries: 0 }),
      ).rejects.toThrow(IPFSFetchError);
    });

    it("should accept CID object with toString method", async () => {
      const testData = { fromObject: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(testData),
      });

      const cidObject = { toString: () => "bafyfromobject" };
      const result = await client.fetchByCID(cidObject);

      expect(result.cid).toBe("bafyfromobject");
    });

    it("should retry with exponential backoff", async () => {
      const testData = { retried: true };

      // Fail twice, succeed on third attempt
      mockFetch
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockRejectedValueOnce(new Error("Fail 2"))
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(testData),
        });

      const result = await client.fetchByCID("bafytest123", { maxRetries: 2 });

      expect(result.data).toEqual(testData);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  // ============ fetchRawByCID Tests ============

  describe("fetchRawByCID", () => {
    it("should fetch raw bytes successfully", async () => {
      const rawData = new Uint8Array([1, 2, 3, 4, 5]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/octet-stream" }),
        arrayBuffer: () => Promise.resolve(rawData.buffer),
      });

      const result: FetchRawResult = await client.fetchRawByCID("bafyraw123");

      expect(result.data).toBeInstanceOf(Uint8Array);
      expect(Array.from(result.data)).toEqual([1, 2, 3, 4, 5]);
      expect(result.cid).toBe("bafyraw123");
      expect(result.cached).toBe(false);
    });

    it("should cache raw bytes", async () => {
      const rawData = new Uint8Array([10, 20, 30]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: () => Promise.resolve(rawData.buffer),
      });

      // First fetch
      await client.fetchRawByCID("bafyimage");

      // Second fetch should be cached
      const result = await client.fetchRawByCID("bafyimage");
      expect(result.cached).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should fallback to next gateway on failure", async () => {
      const rawData = new Uint8Array([100, 200]);

      mockFetch.mockRejectedValueOnce(new Error("Fail")).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/octet-stream" }),
        arrayBuffer: () => Promise.resolve(rawData.buffer),
      });

      const result = await client.fetchRawByCID("bafyraw", { maxRetries: 0 });

      expect(result.gateway).toBe(DEFAULT_GATEWAYS[1]);
    });

    it("should throw IPFSFetchError when all gateways fail", async () => {
      mockFetch.mockRejectedValue(new Error("All failed"));

      await expect(
        client.fetchRawByCID("bafyraw", { maxRetries: 0 }),
      ).rejects.toThrow(IPFSFetchError);
    });
  });

  // ============ Cache Management Tests ============

  describe("cache management", () => {
    it("should clear specific CID from cache", async () => {
      const testData = { value: 1 };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(testData),
      });

      await client.fetchByCID("bafycache1");
      await client.fetchByCID("bafycache2");

      expect(client.getCacheStats().size).toBe(2);

      client.clearCache("bafycache1");
      expect(client.getCacheStats().size).toBe(1);
      expect(client.getCacheStats().entries).toContain("bafycache2");
    });

    it("should clear entire cache", async () => {
      const testData = { value: 1 };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(testData),
      });

      await client.fetchByCID("bafycache1");
      await client.fetchByCID("bafycache2");
      await client.fetchByCID("bafycache3");

      expect(client.getCacheStats().size).toBe(3);

      client.clearCache();
      expect(client.getCacheStats().size).toBe(0);
    });

    it("should return cache statistics", async () => {
      const testData = { value: 1 };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(testData),
      });

      await client.fetchByCID("bafystats1");
      await client.fetchByCID("bafystats2");

      const stats = client.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries).toContain("bafystats1");
      expect(stats.entries).toContain("bafystats2");
    });

    it("should expire cached entries after TTL", async () => {
      const testData = { value: 1 };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(testData),
      });

      // Fetch with very short TTL
      await client.fetchByCID("bafyttl", { cacheTTL: 1 });

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should fetch again since cache expired
      const result = await client.fetchByCID("bafyttl", { cacheTTL: 1 });
      expect(result.cached).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ============ DEFAULT_GATEWAYS Tests ============

  describe("DEFAULT_GATEWAYS", () => {
    it("should have correct gateway URLs", () => {
      expect(DEFAULT_GATEWAYS).toContain("https://w3s.link/ipfs/");
      expect(DEFAULT_GATEWAYS).toContain("https://dweb.link/ipfs/");
      expect(DEFAULT_GATEWAYS).toContain("https://ipfs.io/ipfs/");
      expect(DEFAULT_GATEWAYS).toContain("https://nftstorage.link/ipfs/");
    });

    it("should have w3s.link as first gateway", () => {
      expect(DEFAULT_GATEWAYS[0]).toBe("https://w3s.link/ipfs/");
    });
  });

  // ============ IPFSFetchError Tests ============

  describe("IPFSFetchError", () => {
    it("should have correct error name", () => {
      const error = new IPFSFetchError("bafytest", new Map());
      expect(error.name).toBe("IPFSFetchError");
    });

    it("should include CID in error", () => {
      const error = new IPFSFetchError("bafymycid", new Map());
      expect(error.cid).toBe("bafymycid");
    });

    it("should include gateway errors", () => {
      const gatewayErrors = new Map([
        ["https://gateway1.com/", new Error("Error 1")],
        ["https://gateway2.com/", new Error("Error 2")],
      ]);
      const error = new IPFSFetchError("bafytest", gatewayErrors);

      expect(error.gatewayErrors.size).toBe(2);
      expect(error.message).toContain("gateway1.com");
      expect(error.message).toContain("gateway2.com");
    });
  });
});

/**
 * Unit tests for StorachaBountyClient
 * Uses vitest with mocked @storacha/client dependency
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { StorachaBountyClient } from "../src/client.js";
import type {
  AuthorizationStatus,
  SpaceInfo,
  UploadResult,
  DelegationResult,
} from "../src/types.js";

// Mock the @storacha/client module
vi.mock("@storacha/client", () => {
  const mockSpace = {
    did: () => "did:key:z6Mktest123",
    name: "test-space",
  };

  const mockAccount = {
    email: () => "test@example.com",
  };

  const mockCid = {
    toString: () =>
      "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    version: 1,
    code: 0x70,
    multihash: {
      code: 0x12,
      size: 32,
      digest: new Uint8Array(32),
      bytes: new Uint8Array(34),
    },
    bytes: new Uint8Array(36),
  };

  const mockDelegation = {
    archive: vi.fn().mockResolvedValue({
      ok: new Uint8Array([1, 2, 3, 4, 5]),
    }),
  };

  const mockClient = {
    authorize: vi.fn().mockResolvedValue(undefined),
    accounts: vi.fn().mockReturnValue({}),
    spaces: vi.fn().mockReturnValue([]),
    currentSpace: vi.fn().mockReturnValue(null),
    createSpace: vi.fn().mockResolvedValue(mockSpace),
    setCurrentSpace: vi.fn().mockResolvedValue(undefined),
    uploadFile: vi.fn().mockResolvedValue(mockCid),
    uploadDirectory: vi.fn().mockResolvedValue(mockCid),
    remove: vi.fn().mockResolvedValue(undefined),
    createDelegation: vi.fn().mockResolvedValue(mockDelegation),
    proofs: vi.fn().mockReturnValue([]),
    addSpace: vi.fn().mockResolvedValue(mockSpace),
    agent: {
      did: () => "did:key:z6MkAgent123",
    },
  };

  return {
    create: vi.fn().mockResolvedValue(mockClient),
    DID: {
      parse: vi.fn().mockReturnValue({ did: () => "did:key:z6MkAudience" }),
    },
    Link: {
      parse: vi.fn().mockReturnValue(mockCid),
    },
    Delegation: {
      extract: vi.fn().mockResolvedValue(mockDelegation),
    },
    __mockClient: mockClient,
    __mockSpace: mockSpace,
    __mockAccount: mockAccount,
    __mockCid: mockCid,
  };
});

// Define mock types
interface MockSpace {
  did: () => string;
  name: string;
}

interface MockAccount {
  email: () => string;
}

interface MockCid {
  toString: () => string;
  version: number;
  code: number;
  multihash: {
    code: number;
    size: number;
    digest: Uint8Array;
    bytes: Uint8Array;
  };
  bytes: Uint8Array;
}

interface MockClient {
  authorize: Mock;
  accounts: Mock;
  spaces: Mock;
  currentSpace: Mock;
  createSpace: Mock;
  setCurrentSpace: Mock;
  uploadFile: Mock;
  uploadDirectory: Mock;
  remove: Mock;
  createDelegation: Mock;
  proofs: Mock;
  addSpace: Mock;
  agent: {
    did: () => string;
  };
}

interface MockClientModule {
  __mockClient: MockClient;
  __mockSpace: MockSpace;
  __mockAccount: MockAccount;
  __mockCid: MockCid;
  create: Mock;
  DID: { parse: Mock };
  Link: { parse: Mock };
  Delegation: { extract: Mock };
}

// Get the mock client for test manipulation
import * as ClientModule from "@storacha/client";
const mockModule = ClientModule as unknown as MockClientModule;
const mockClient = mockModule.__mockClient;
const mockSpace = mockModule.__mockSpace;
const mockAccount = mockModule.__mockAccount;
const mockCid = mockModule.__mockCid;

describe("StorachaBountyClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock client state
    mockClient.accounts.mockReturnValue({});
    mockClient.spaces.mockReturnValue([]);
    mockClient.currentSpace.mockReturnValue(null);
  });

  // ============ Client Creation ============

  describe("create", () => {
    it("should create a new client instance", async () => {
      const client = await StorachaBountyClient.create();
      expect(client).toBeInstanceOf(StorachaBountyClient);
      expect(ClientModule.create).toHaveBeenCalled();
    });

    it("should accept optional configuration", async () => {
      const config = {
        serviceUrl: "https://custom.storacha.network/ipfs/",
        clientOptions: { principal: "test-principal" },
      };
      const client = await StorachaBountyClient.create(config);
      expect(client).toBeInstanceOf(StorachaBountyClient);
      expect(ClientModule.create).toHaveBeenCalledWith(config.clientOptions);
    });
  });

  // ============ Authentication Tests ============

  describe("authorize", () => {
    it("should call client.authorize with email and timeout", async () => {
      const client = await StorachaBountyClient.create();
      const email = "test@example.com" as const;

      await client.authorize(email);

      expect(mockClient.authorize).toHaveBeenCalledWith(email, {
        signal: expect.any(AbortSignal),
      });
    });

    it("should throw error if authorization fails", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.authorize.mockRejectedValueOnce(
        new Error("Authorization failed"),
      );

      await expect(client.authorize("test@example.com")).rejects.toThrow(
        "Authorization failed",
      );
    });
  });

  describe("getAuthorizationStatus", () => {
    it("should return unauthorized status when no accounts exist", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.accounts.mockReturnValue({});

      const status: AuthorizationStatus = await client.getAuthorizationStatus();

      expect(status.isAuthorized).toBe(false);
      expect(status.account).toBeUndefined();
    });

    it("should return authorized status with account info", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.accounts.mockReturnValue({
        "did:key:z6MkAccount": mockAccount,
      });

      const status: AuthorizationStatus = await client.getAuthorizationStatus();

      expect(status.isAuthorized).toBe(true);
      expect(status.account?.did).toBe("did:key:z6MkAccount");
      expect(status.account?.email).toBe("test@example.com");
    });

    it("should include current space when set", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.accounts.mockReturnValue({
        "did:key:z6MkAccount": mockAccount,
      });
      mockClient.currentSpace.mockReturnValue(mockSpace);

      const status: AuthorizationStatus = await client.getAuthorizationStatus();

      expect(status.currentSpace).toBeDefined();
      expect(status.currentSpace?.did).toBe("did:key:z6Mktest123");
      expect(status.currentSpace?.isCurrentSpace).toBe(true);
    });
  });

  describe("getAccounts", () => {
    it("should return empty array when no accounts", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.accounts.mockReturnValue({});

      const accounts = client.getAccounts();

      expect(accounts).toEqual([]);
    });

    it("should return array of account info", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.accounts.mockReturnValue({
        "did:key:z6MkAccount1": mockAccount,
      });

      const accounts = client.getAccounts();

      expect(accounts).toHaveLength(1);
      expect(accounts[0]?.did).toBe("did:key:z6MkAccount1");
      expect(accounts[0]?.email).toBe("test@example.com");
    });
  });

  // ============ Space Management Tests ============

  describe("createSpace", () => {
    it("should throw error when not authorized", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.accounts.mockReturnValue({});

      await expect(client.createSpace()).rejects.toThrow(
        "No authorized account found",
      );
    });

    it("should create space with default name", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.accounts.mockReturnValue({
        "did:key:z6MkAccount": mockAccount,
      });

      const space: SpaceInfo = await client.createSpace();

      expect(mockClient.createSpace).toHaveBeenCalledWith(
        "bounty-space",
        expect.any(Object),
      );
      expect(space.did).toBe("did:key:z6Mktest123");
      expect(space.isCurrentSpace).toBe(true);
    });

    it("should create space with custom name", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.accounts.mockReturnValue({
        "did:key:z6MkAccount": mockAccount,
      });

      const space: SpaceInfo = await client.createSpace({
        name: "my-bounty-space",
      });

      expect(mockClient.createSpace).toHaveBeenCalledWith(
        "my-bounty-space",
        expect.any(Object),
      );
      expect(space.name).toBe("my-bounty-space");
    });

    it("should automatically set created space as current", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.accounts.mockReturnValue({
        "did:key:z6MkAccount": mockAccount,
      });

      await client.createSpace();

      expect(mockClient.setCurrentSpace).toHaveBeenCalledWith(
        "did:key:z6Mktest123",
      );
    });
  });

  describe("getSpaces", () => {
    it("should return empty array when no spaces", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.spaces.mockReturnValue([]);

      const spaces: SpaceInfo[] = client.getSpaces();

      expect(spaces).toEqual([]);
    });

    it("should return array of space info", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.spaces.mockReturnValue([mockSpace]);

      const spaces: SpaceInfo[] = client.getSpaces();

      expect(spaces).toHaveLength(1);
      expect(spaces[0]?.did).toBe("did:key:z6Mktest123");
      expect(spaces[0]?.name).toBe("test-space");
    });

    it("should mark current space correctly", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.spaces.mockReturnValue([mockSpace]);
      mockClient.currentSpace.mockReturnValue(mockSpace);

      const spaces: SpaceInfo[] = client.getSpaces();

      expect(spaces[0]?.isCurrentSpace).toBe(true);
    });
  });

  describe("getCurrentSpace", () => {
    it("should return undefined when no current space", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(null);

      const space = client.getCurrentSpace();

      expect(space).toBeUndefined();
    });

    it("should return current space info", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);

      const space = client.getCurrentSpace();

      expect(space?.did).toBe("did:key:z6Mktest123");
      expect(space?.isCurrentSpace).toBe(true);
    });
  });

  describe("setCurrentSpace", () => {
    it("should call client.setCurrentSpace", async () => {
      const client = await StorachaBountyClient.create();
      const spaceDid = "did:key:z6MkNewSpace" as const;

      await client.setCurrentSpace(spaceDid);

      expect(mockClient.setCurrentSpace).toHaveBeenCalledWith(spaceDid);
    });
  });

  describe("addSpace", () => {
    it("should add space from Uint8Array proof", async () => {
      const client = await StorachaBountyClient.create();
      const proof = new Uint8Array([1, 2, 3, 4]);

      const space: SpaceInfo = await client.addSpace(proof);

      expect(space.did).toBe("did:key:z6Mktest123");
      expect(space.isCurrentSpace).toBe(false);
    });

    it("should add space from base64 string proof", async () => {
      const client = await StorachaBountyClient.create();
      const base64Proof = btoa(String.fromCharCode(1, 2, 3, 4));

      const space: SpaceInfo = await client.addSpace(base64Proof);

      expect(space.did).toBe("did:key:z6Mktest123");
    });
  });

  // ============ File Upload Tests ============

  describe("uploadFile", () => {
    it("should throw error when no current space", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(null);
      const file = new Blob(["test content"], { type: "text/plain" });

      await expect(client.uploadFile(file)).rejects.toThrow(
        "No current space set",
      );
    });

    it("should upload a Blob", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const blob = new Blob(["test content"], { type: "text/plain" });

      const result: UploadResult = await client.uploadFile(blob);

      expect(mockClient.uploadFile).toHaveBeenCalledWith(
        blob,
        expect.any(Object),
      );
      expect(result.cidString).toBe(mockCid.toString());
      expect(result.cid).toBeDefined();
    });

    it("should upload a File", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const file = new File(["test content"], "test.txt", {
        type: "text/plain",
      });

      const result: UploadResult = await client.uploadFile(file);

      expect(mockClient.uploadFile).toHaveBeenCalled();
      expect(result.cidString).toBeDefined();
    });

    it("should upload a FileInput with Uint8Array content", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const fileInput = {
        content: new Uint8Array([116, 101, 115, 116]), // "test"
        name: "test.txt",
        type: "text/plain",
      };

      const result: UploadResult = await client.uploadFile(fileInput);

      expect(mockClient.uploadFile).toHaveBeenCalled();
      expect(result.cidString).toBeDefined();
    });

    it("should upload a FileInput with Blob content", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const fileInput = {
        content: new Blob(["test"]),
        name: "test.txt",
        type: "text/plain",
      };

      const result: UploadResult = await client.uploadFile(fileInput);

      expect(mockClient.uploadFile).toHaveBeenCalled();
      expect(result.cidString).toBeDefined();
    });

    it("should call onShardStored callback when provided", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const file = new Blob(["test"]);
      const onShardStored = vi.fn();

      // Capture the callback and call it
      mockClient.uploadFile.mockImplementationOnce(
        (
          _blob: Blob,
          options: {
            onShardStored?: (meta: { cid: unknown; size: number }) => void;
          },
        ) => {
          if (options.onShardStored) {
            options.onShardStored({ cid: mockCid, size: 100 });
          }
          return Promise.resolve(mockCid);
        },
      );

      await client.uploadFile(file, { onShardStored });

      expect(onShardStored).toHaveBeenCalledWith({
        cid: mockCid,
        size: 100,
      });
    });
  });

  describe("uploadDirectory", () => {
    it("should throw error when no current space", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(null);
      const files = [new File(["test"], "test.txt")];

      await expect(client.uploadDirectory(files)).rejects.toThrow(
        "No current space set",
      );
    });

    it("should upload multiple files as directory", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const files = [
        new File(["content1"], "file1.txt"),
        new File(["content2"], "file2.txt"),
      ];

      const result: UploadResult = await client.uploadDirectory(files);

      expect(mockClient.uploadDirectory).toHaveBeenCalledWith(
        files,
        expect.any(Object),
      );
      expect(result.cidString).toBeDefined();
    });

    it("should call onShardStored callback when provided", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const files = [new File(["test"], "test.txt")];
      const onShardStored = vi.fn();

      mockClient.uploadDirectory.mockImplementationOnce(
        (
          _files: File[],
          options: {
            onShardStored?: (meta: { cid: unknown; size: number }) => void;
          },
        ) => {
          if (options.onShardStored) {
            options.onShardStored({ cid: mockCid, size: 200 });
          }
          return Promise.resolve(mockCid);
        },
      );

      await client.uploadDirectory(files, { onShardStored });

      expect(onShardStored).toHaveBeenCalledWith({
        cid: mockCid,
        size: 200,
      });
    });
  });

  describe("uploadJSON", () => {
    it("should upload JSON data", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const data = { bountyId: 1, temperature: 25 };

      const result: UploadResult = await client.uploadJSON(data);

      expect(mockClient.uploadFile).toHaveBeenCalled();
      expect(result.cidString).toBeDefined();
    });

    it("should use custom filename", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const data = { test: true };

      await client.uploadJSON(data, "custom.json");

      // Verify the file was created with the correct name
      const calledBlob = (mockClient.uploadFile as Mock).mock
        .calls[0]?.[0] as File;
      expect(calledBlob.name).toBe("custom.json");
    });

    it("should use default filename when not specified", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const data = { test: true };

      await client.uploadJSON(data);

      const calledBlob = (mockClient.uploadFile as Mock).mock
        .calls[0]?.[0] as File;
      expect(calledBlob.name).toBe("data.json");
    });

    it("should throw error when no current space", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(null);

      await expect(client.uploadJSON({ test: true })).rejects.toThrow(
        "No current space set",
      );
    });
  });

  // ============ UCAN Delegation Tests ============

  describe("createDelegation", () => {
    it("should throw error when no current space", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(null);

      await expect(
        client.createDelegation("did:key:z6MkAudience", {
          capabilities: ["upload/add"],
        }),
      ).rejects.toThrow("No current space set");
    });

    it("should create delegation with capabilities", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);

      const result: DelegationResult = await client.createDelegation(
        "did:key:z6MkAudience",
        { capabilities: ["upload/add", "store/add"] },
      );

      expect(mockClient.createDelegation).toHaveBeenCalled();
      expect(result.archive).toBeInstanceOf(Uint8Array);
      expect(result.base64).toBeDefined();
    });

    it("should include expiration when specified", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);

      await client.createDelegation("did:key:z6MkAudience", {
        capabilities: ["upload/add"],
        expiration: 3600, // 1 hour
      });

      expect(mockClient.createDelegation).toHaveBeenCalledWith(
        expect.any(Object),
        ["upload/add"],
        expect.objectContaining({ expiration: expect.any(Number) }),
      );
    });

    it("should throw error if archive fails", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);

      const failedDelegation = {
        archive: vi.fn().mockResolvedValue({ ok: null, error: "Failed" }),
      };
      mockClient.createDelegation.mockResolvedValueOnce(failedDelegation);

      await expect(
        client.createDelegation("did:key:z6MkAudience", {
          capabilities: ["upload/add"],
        }),
      ).rejects.toThrow("Failed to archive delegation");
    });
  });

  describe("getProofs", () => {
    it("should return empty array when no proofs", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.proofs.mockReturnValue([]);

      const proofs = client.getProofs();

      expect(proofs).toEqual([]);
    });

    it("should return array of proofs", async () => {
      const client = await StorachaBountyClient.create();
      const mockProofs = [{ delegation: "test1" }, { delegation: "test2" }];
      mockClient.proofs.mockReturnValue(mockProofs);

      const proofs = client.getProofs();

      expect(proofs).toEqual(mockProofs);
    });
  });

  // ============ Content Management Tests ============

  describe("remove", () => {
    it("should throw error when no current space", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(null);

      await expect(client.remove("bafytest123")).rejects.toThrow(
        "No current space set",
      );
    });

    it("should remove content by CID string", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);

      await client.remove("bafytest123");

      expect(mockModule.Link.parse).toHaveBeenCalledWith("bafytest123");
      expect(mockClient.remove).toHaveBeenCalled();
    });

    it("should remove content by CID object", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const cidObject = { toString: () => "bafytest456" };

      await client.remove(cidObject);

      expect(mockModule.Link.parse).toHaveBeenCalledWith("bafytest456");
      expect(mockClient.remove).toHaveBeenCalled();
    });
  });

  describe("getRetrievalUrl", () => {
    it("should return correct IPFS gateway URL for string CID", async () => {
      const client = await StorachaBountyClient.create();
      const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

      const url = client.getRetrievalUrl(cid);

      expect(url).toBe(`https://w3s.link/ipfs/${cid}`);
    });

    it("should return correct IPFS gateway URL for CID object", async () => {
      const client = await StorachaBountyClient.create();
      const cidObject = { toString: () => "bafytest789" };

      const url = client.getRetrievalUrl(cidObject);

      expect(url).toBe("https://w3s.link/ipfs/bafytest789");
    });

    it("should use custom serviceUrl when configured", async () => {
      const client = await StorachaBountyClient.create({
        serviceUrl: "https://custom.gateway/ipfs/",
      });
      const cid = "bafycustom";

      const url = client.getRetrievalUrl(cid);

      expect(url).toBe("https://custom.gateway/ipfs/bafycustom");
    });
  });

  // ============ Utility Method Tests ============

  describe("getRawClient", () => {
    it("should return the underlying Storacha client", async () => {
      const client = await StorachaBountyClient.create();

      const rawClient = client.getRawClient();

      expect(rawClient).toBeDefined();
      expect(rawClient.authorize).toBeDefined();
    });
  });

  describe("getAgentDid", () => {
    it("should return the agent DID", async () => {
      const client = await StorachaBountyClient.create();

      const agentDid = client.getAgentDid();

      expect(agentDid).toBe("did:key:z6MkAgent123");
    });
  });

  // ============ UploadResult Validation Tests ============

  describe("UploadResult validation", () => {
    it("should contain required cid property", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const file = new Blob(["test"]);

      const result: UploadResult = await client.uploadFile(file);

      expect(result).toHaveProperty("cid");
      expect(result.cid).toBeDefined();
    });

    it("should contain required cidString property", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const file = new Blob(["test"]);

      const result: UploadResult = await client.uploadFile(file);

      expect(result).toHaveProperty("cidString");
      expect(typeof result.cidString).toBe("string");
    });
  });

  // ============ Error Scenarios and Edge Cases ============

  describe("error scenarios", () => {
    it("should handle network errors during upload", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      mockClient.uploadFile.mockRejectedValueOnce(new Error("Network error"));

      await expect(client.uploadFile(new Blob(["test"]))).rejects.toThrow(
        "Network error",
      );
    });

    it("should handle invalid space DID in setCurrentSpace", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.setCurrentSpace.mockRejectedValueOnce(
        new Error("Invalid DID"),
      );

      await expect(
        client.setCurrentSpace("invalid-did" as `did:${string}:${string}`),
      ).rejects.toThrow("Invalid DID");
    });

    it("should handle createSpace failure", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.accounts.mockReturnValue({
        "did:key:z6MkAccount": mockAccount,
      });
      mockClient.createSpace.mockRejectedValueOnce(
        new Error("Space creation failed"),
      );

      await expect(client.createSpace()).rejects.toThrow(
        "Space creation failed",
      );
    });

    it("should handle remove failure", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      mockClient.remove.mockRejectedValueOnce(new Error("Content not found"));

      await expect(client.remove("bafynotfound")).rejects.toThrow(
        "Content not found",
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty file upload", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const emptyFile = new Blob([]);

      const result = await client.uploadFile(emptyFile);

      expect(result.cidString).toBeDefined();
    });

    it("should handle empty directory upload", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);

      await client.uploadDirectory([]);

      expect(mockClient.uploadDirectory).toHaveBeenCalledWith(
        [],
        expect.any(Object),
      );
    });

    it("should handle uploadJSON with null value", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);

      const result = await client.uploadJSON(null);

      expect(result.cidString).toBeDefined();
    });

    it("should handle uploadJSON with nested objects", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);
      const nestedData = {
        level1: {
          level2: {
            level3: { value: "deep" },
          },
        },
        array: [1, 2, { nested: true }],
      };

      const result = await client.uploadJSON(nestedData);

      expect(result.cidString).toBeDefined();
    });

    it("should handle multiple sequential uploads", async () => {
      const client = await StorachaBountyClient.create();
      mockClient.currentSpace.mockReturnValue(mockSpace);

      const result1 = await client.uploadFile(new Blob(["file1"]));
      const result2 = await client.uploadFile(new Blob(["file2"]));
      const result3 = await client.uploadFile(new Blob(["file3"]));

      expect(result1.cidString).toBeDefined();
      expect(result2.cidString).toBeDefined();
      expect(result3.cidString).toBeDefined();
      expect(mockClient.uploadFile).toHaveBeenCalledTimes(3);
    });
  });
});

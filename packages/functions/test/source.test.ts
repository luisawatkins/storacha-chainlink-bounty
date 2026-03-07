import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  simulateScript,
  decodeResult,
  ReturnType,
} from "@chainlink/functions-toolkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOURCE_PATH = join(__dirname, "..", "src", "source.js");
const source = readFileSync(SOURCE_PATH, "utf-8");

// --- Test fixtures ---

const VALID_SCHEMA = {
  type: "object",
  required: ["name", "age"],
  properties: {
    name: { type: "string", minLength: 1 },
    age: { type: "integer", minimum: 0 },
    email: { type: "string", pattern: "^\\S+@\\S+\\.\\S+$" },
  },
};

const VALID_DATA = {
  name: "Alice",
  age: 30,
  email: "alice@example.com",
};

const MISSING_REQUIRED_DATA = {
  name: "Bob",
};

const WRONG_TYPE_DATA = {
  name: "Charlie",
  age: "thirty",
};

const ENUM_SCHEMA = {
  type: "object",
  required: ["status"],
  properties: {
    status: { type: "string", enum: ["active", "inactive", "pending"] },
  },
};

const VALID_ENUM_DATA = { status: "active" };
const INVALID_ENUM_DATA = { status: "deleted" };

const STRING_LENGTH_SCHEMA = {
  type: "object",
  required: ["code"],
  properties: {
    code: { type: "string", minLength: 3, maxLength: 10 },
  },
};

const SHORT_STRING_DATA = { code: "AB" };

const ARRAY_SCHEMA = {
  type: "object",
  required: ["tags"],
  properties: {
    tags: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
    },
  },
};

const VALID_ARRAY_DATA = { tags: ["web3", "ipfs"] };
const INVALID_ARRAY_ITEMS_DATA = { tags: ["web3", 42] };

// --- Local HTTP server for test fixtures ---

type Fixtures = Record<string, unknown>;
let server: Server;
let gatewayUrl: string;
const fixtures: Fixtures = {};

function addFixture(cid: string, data: unknown) {
  fixtures[cid] = data;
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const cid = req.url?.replace("/", "");
    if (cid && cid in fixtures) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(fixtures[cid]));
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const addr = server.address();
  if (addr && typeof addr === "object") {
    gatewayUrl = `http://127.0.0.1:${addr.port}/`;
  }
});

afterAll(() => {
  server?.close();
});

// --- Helpers ---

async function runSource(args: string[]) {
  return simulateScript({
    source,
    args,
    maxOnChainResponseBytes: 256,
    maxExecutionTimeMs: 10_000,
    numAllowedQueries: 5,
  });
}

function decodeUint256(hex: string): bigint {
  return BigInt(decodeResult(hex, ReturnType.uint256));
}

// --- Tests ---

describe("Verification Source", () => {
  it("should load the source file", () => {
    expect(source).toBeDefined();
    expect(source.length).toBeGreaterThan(0);
    expect(source).toContain("Functions.encodeUint256");
    expect(source).toContain("args[0]");
    expect(source).toContain("args[1]");
  });

  it("should return 0 for missing arguments", async () => {
    const result = await runSource([]);
    expect(result.errorString).toBeFalsy();
    expect(decodeUint256(result.responseBytesHexstring!)).toBe(0n);
  });

  it("should return 1 for valid data matching schema", async () => {
    addFixture("valid-schema", VALID_SCHEMA);
    addFixture("valid-data", VALID_DATA);

    const result = await runSource(["valid-data", "valid-schema", gatewayUrl]);
    expect(result.errorString).toBeFalsy();
    expect(decodeUint256(result.responseBytesHexstring!)).toBe(1n);
  });

  it("should return 0 for missing required field", async () => {
    addFixture("missing-required-schema", VALID_SCHEMA);
    addFixture("missing-required-data", MISSING_REQUIRED_DATA);

    const result = await runSource([
      "missing-required-data",
      "missing-required-schema",
      gatewayUrl,
    ]);
    expect(result.errorString).toBeFalsy();
    expect(decodeUint256(result.responseBytesHexstring!)).toBe(0n);
  });

  it("should return 0 for wrong type", async () => {
    addFixture("wrong-type-schema", VALID_SCHEMA);
    addFixture("wrong-type-data", WRONG_TYPE_DATA);

    const result = await runSource([
      "wrong-type-data",
      "wrong-type-schema",
      gatewayUrl,
    ]);
    expect(result.errorString).toBeFalsy();
    expect(decodeUint256(result.responseBytesHexstring!)).toBe(0n);
  });

  it("should return 0 for fetch failure (bad CID)", async () => {
    const result = await runSource([
      "nonexistent-data",
      "nonexistent-schema",
      gatewayUrl,
    ]);
    expect(result.errorString).toBeFalsy();
    expect(decodeUint256(result.responseBytesHexstring!)).toBe(0n);
  });

  it("should return 0 for invalid enum value", async () => {
    addFixture("enum-schema", ENUM_SCHEMA);
    addFixture("invalid-enum-data", INVALID_ENUM_DATA);

    const result = await runSource([
      "invalid-enum-data",
      "enum-schema",
      gatewayUrl,
    ]);
    expect(result.errorString).toBeFalsy();
    expect(decodeUint256(result.responseBytesHexstring!)).toBe(0n);
  });

  it("should return 1 for valid enum value", async () => {
    addFixture("enum-schema-v", ENUM_SCHEMA);
    addFixture("valid-enum-data", VALID_ENUM_DATA);

    const result = await runSource([
      "valid-enum-data",
      "enum-schema-v",
      gatewayUrl,
    ]);
    expect(result.errorString).toBeFalsy();
    expect(decodeUint256(result.responseBytesHexstring!)).toBe(1n);
  });

  it("should return 0 for string length violation", async () => {
    addFixture("strlen-schema", STRING_LENGTH_SCHEMA);
    addFixture("short-string-data", SHORT_STRING_DATA);

    const result = await runSource([
      "short-string-data",
      "strlen-schema",
      gatewayUrl,
    ]);
    expect(result.errorString).toBeFalsy();
    expect(decodeUint256(result.responseBytesHexstring!)).toBe(0n);
  });

  it("should return 0 for invalid array items", async () => {
    addFixture("array-schema", ARRAY_SCHEMA);
    addFixture("invalid-array-data", INVALID_ARRAY_ITEMS_DATA);

    const result = await runSource([
      "invalid-array-data",
      "array-schema",
      gatewayUrl,
    ]);
    expect(result.errorString).toBeFalsy();
    expect(decodeUint256(result.responseBytesHexstring!)).toBe(0n);
  });

  it("should return 1 for valid array items", async () => {
    addFixture("array-schema-v", ARRAY_SCHEMA);
    addFixture("valid-array-data", VALID_ARRAY_DATA);

    const result = await runSource([
      "valid-array-data",
      "array-schema-v",
      gatewayUrl,
    ]);
    expect(result.errorString).toBeFalsy();
    expect(decodeUint256(result.responseBytesHexstring!)).toBe(1n);
  });
});

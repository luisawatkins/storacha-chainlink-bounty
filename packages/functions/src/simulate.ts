import {
  simulateScript,
  decodeResult,
  ReturnType,
} from "@chainlink/functions-toolkit";
import { getVerificationSource } from "./index.js";

export interface SimulationResult {
  /** Whether the data passed schema validation */
  verified: boolean;
  /** Raw response hex string from the simulation */
  responseHex: string | null;
  /** Error message if the simulation failed */
  error: string | null;
  /** Captured console.log output from the source code */
  logs: string;
}

/**
 * Simulate the verification source code locally using the Chainlink Functions toolkit.
 * Requires Deno to be installed.
 *
 * @param dataCid - IPFS CID of the data to verify
 * @param schemaCid - IPFS CID of the JSON Schema
 * @param gatewayOverride - Optional gateway base URL (for testing with local server)
 * @returns Simulation result with verification outcome and logs
 */
export async function simulateVerification(
  dataCid: string,
  schemaCid: string,
  gatewayOverride?: string,
): Promise<SimulationResult> {
  const source = getVerificationSource();

  const simArgs = [dataCid, schemaCid];
  if (gatewayOverride) {
    simArgs.push(gatewayOverride);
  }

  const result = await simulateScript({
    source,
    args: simArgs,
    maxOnChainResponseBytes: 256,
    maxExecutionTimeMs: 10_000,
    maxMemoryUsageMb: 128,
    numAllowedQueries: 5,
    maxQueryDurationMs: 9_000,
    maxQueryUrlLength: 2048,
    maxQueryRequestBytes: 2048,
    maxQueryResponseBytes: 2_097_152,
  });

  const logs = result.capturedTerminalOutput ?? "";

  if (result.errorString) {
    return {
      verified: false,
      responseHex: null,
      error: result.errorString,
      logs,
    };
  }

  if (!result.responseBytesHexstring) {
    return {
      verified: false,
      responseHex: null,
      error: "No response returned from simulation",
      logs,
    };
  }

  const decoded = decodeResult(
    result.responseBytesHexstring,
    ReturnType.uint256,
  );

  return {
    verified: BigInt(decoded) === 1n,
    responseHex: result.responseBytesHexstring,
    error: null,
    logs,
  };
}

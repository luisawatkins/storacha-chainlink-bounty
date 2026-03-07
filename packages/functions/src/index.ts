import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Network-specific Chainlink Functions configuration.
 */
export const FUNCTIONS_CONFIG = {
  /** Sepolia testnet */
  sepolia: {
    chainId: 11155111,
    router: "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0",
    donId: "fun-ethereum-sepolia-1",
    donIdBytes32:
      "0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000",
    gasLimit: 300_000,
    subscriptionId: 0, // must be set per deployment
  },
  /** Arbitrum Sepolia testnet */
  arbitrumSepolia: {
    chainId: 421614,
    router: "0x234a5fb5Bd614a7AA2FfAB244D603abFA0Ac5C5C",
    donId: "fun-arbitrum-sepolia-1",
    donIdBytes32:
      "0x66756e2d617262697472756d2d7365706f6c69612d31000000000000000000000",
    gasLimit: 300_000,
    subscriptionId: 0, // must be set per deployment
  },
} as const;

/**
 * Read the verification JavaScript source code from disk.
 * This is the string that gets stored on-chain via
 * `FunctionsConsumer.updateVerificationSource()`.
 */
export function getVerificationSource(): string {
  const sourcePath = join(__dirname, "source.js");
  return readFileSync(sourcePath, "utf-8");
}

export type { SimulationResult } from "./simulate.js";
export { simulateVerification } from "./simulate.js";

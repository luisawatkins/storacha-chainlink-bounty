#!/usr/bin/env node

import { simulateVerification } from "../src/simulate.js";

function usage(): never {
  console.error("Usage: pnpm simulate -- --data-cid <CID> --schema-cid <CID>");
  process.exit(2);
}

function parseArgs(argv: string[]): { dataCid: string; schemaCid: string } {
  let dataCid: string | undefined;
  let schemaCid: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--data-cid" && argv[i + 1]) {
      dataCid = argv[++i];
    } else if (argv[i] === "--schema-cid" && argv[i + 1]) {
      schemaCid = argv[++i];
    }
  }

  if (!dataCid || !schemaCid) usage();
  return { dataCid, schemaCid };
}

async function main() {
  const { dataCid, schemaCid } = parseArgs(process.argv.slice(2));

  console.log(`Simulating verification...`);
  console.log(`  Data CID:   ${dataCid}`);
  console.log(`  Schema CID: ${schemaCid}`);
  console.log();

  const result = await simulateVerification(dataCid, schemaCid);

  if (result.logs) {
    console.log("--- DON Console Output ---");
    console.log(result.logs);
    console.log("--- End Console Output ---");
    console.log();
  }

  if (result.error) {
    console.error(`Simulation error: ${result.error}`);
    process.exit(1);
  }

  console.log(`Result: ${result.verified ? "VERIFIED" : "REJECTED"}`);
  console.log(`Response hex: ${result.responseHex}`);
  process.exit(result.verified ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

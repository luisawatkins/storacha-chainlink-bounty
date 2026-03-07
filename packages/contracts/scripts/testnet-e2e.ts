/**
 * End-to-end testnet verification script.
 *
 * Steps:
 * 1. Push verification source to FunctionsConsumer
 * 2. Upload test schema + data to IPFS (via public gateway PUT or pre-existing CIDs)
 * 3. Create a bounty on BountyRegistry
 * 4. Submit data on DataRegistry (triggers verification)
 * 5. Poll for VerificationFulfilled event
 *
 * Usage:
 *   npx hardhat run scripts/testnet.ts --network sepolia
 *   (run from packages/contracts/ with env vars set)
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Deployed addresses on Sepolia
const ADDRESSES = {
  bountyRegistry: "0xFCa4ec41EB01C058EBa43A907405697aac01432B",
  escrowManager: "0xf5731596561a80087bcfe71B974b38F710700897",
  functionsConsumer: "0x77d550F9C13D3756574772Acc26Dec3560Ef6455",
  dataRegistry: "0x1ac3218bD6A5Dad8dF5799e7a3A87e419eb1cEfd",
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(signer.address)),
    "ETH",
  );

  // Get contract instances
  const functionsConsumer = await ethers.getContractAt(
    "FunctionsConsumer",
    ADDRESSES.functionsConsumer,
  );
  const bountyRegistry = await ethers.getContractAt(
    "BountyRegistry",
    ADDRESSES.bountyRegistry,
  );
  const dataRegistry = await ethers.getContractAt(
    "DataRegistry",
    ADDRESSES.dataRegistry,
  );

  // Step 1: Push verification source on-chain
  console.log("\n--- Step 1: Pushing verification source on-chain ---");
  const sourcePath = path.join(
    __dirname,
    "..",
    "..",
    "functions",
    "src",
    "source.js",
  );
  const source = fs.readFileSync(sourcePath, "utf-8");
  console.log(`Source length: ${source.length} chars`);

  const currentSource = await functionsConsumer.verificationSource();
  if (currentSource === source) {
    console.log("Source already up to date, skipping.");
  } else {
    const tx1 = await functionsConsumer.updateVerificationSource(source);
    console.log("Tx:", tx1.hash);
    await tx1.wait();
    console.log("Verification source updated on-chain.");
  }

  // Step 2: Use pre-pinned test CIDs
  // For a real test, you'd upload via Storacha SDK. For now, we'll use
  // publicly available IPFS content or create a bounty with placeholder CIDs.
  // The DON will attempt to fetch these - if they exist, validation runs;
  // if not, the source returns 0 (rejected).
  console.log("\n--- Step 2: Test CIDs ---");
  const schemaCid = "bafkreitest_schema_placeholder";
  const dataCid = "bafkreitest_data_placeholder";
  console.log("Schema CID:", schemaCid);
  console.log("Data CID:", dataCid);
  console.log(
    "NOTE: Using placeholder CIDs. For a real test, upload via Storacha SDK.",
  );

  // Step 3: Create a bounty
  console.log("\n--- Step 3: Creating bounty ---");
  const reward = ethers.parseEther("0.01");
  const deadline = Math.floor(Date.now() / 1000) + 86400; // 24h from now
  const maxSubmissions = 5;

  const tx2 = await bountyRegistry.createBounty(
    "Test Bounty",
    "Testing Chainlink Functions verification",
    schemaCid,
    deadline,
    maxSubmissions,
    { value: reward },
  );
  console.log("Tx:", tx2.hash);
  const receipt2 = await tx2.wait();

  // Find bounty ID from event
  const bountyCreatedEvent = receipt2?.logs.find((log: any) => {
    try {
      return bountyRegistry.interface.parseLog(log)?.name === "BountyCreated";
    } catch {
      return false;
    }
  });

  let bountyId: bigint;
  if (bountyCreatedEvent) {
    const parsed = bountyRegistry.interface.parseLog(bountyCreatedEvent);
    bountyId = parsed?.args[0];
    console.log("Bounty created with ID:", bountyId.toString());
  } else {
    console.log("Could not parse BountyCreated event, assuming ID = 1");
    bountyId = 1n;
  }

  // Step 4: Submit data (triggers verification request)
  console.log("\n--- Step 4: Submitting data ---");
  const tx3 = await dataRegistry.submitData(bountyId, dataCid, "test metadata");
  console.log("Tx:", tx3.hash);
  const receipt3 = await tx3.wait();
  console.log("Data submitted. Verification request sent to DON.");

  // Step 5: Poll for verification result
  console.log("\n--- Step 5: Waiting for verification result ---");
  console.log("Polling for VerificationFulfilled event...");
  console.log("(This may take 30-90 seconds for the DON to respond)");

  const filter = functionsConsumer.filters.VerificationFulfilled();

  const timeout = 120_000; // 2 minutes
  const start = Date.now();

  const result = await new Promise<boolean>((resolve) => {
    const interval = setInterval(async () => {
      if (Date.now() - start > timeout) {
        clearInterval(interval);
        console.log("Timeout waiting for DON response.");
        resolve(false);
        return;
      }

      const events = await functionsConsumer.queryFilter(
        filter,
        receipt3!.blockNumber,
      );
      if (events.length > 0) {
        clearInterval(interval);
        const event = events[events.length - 1];
        console.log("\nVerificationFulfilled event received!");
        console.log("  Request ID:", event.args?.[0]);
        console.log("  Submission ID:", event.args?.[1]?.toString());
        console.log("  Verified:", event.args?.[2]);
        resolve(event.args?.[2] ?? false);
      } else {
        process.stdout.write(".");
      }
    }, 5000);
  });

  console.log(
    `\nFinal result: ${result ? "VERIFIED" : "REJECTED (expected with placeholder CIDs)"}`,
  );
  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

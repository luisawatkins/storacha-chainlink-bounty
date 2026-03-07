import { StorachaBountyClient } from "@storacha-chainlink/sdk";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
const dataRegistryAddress = process.env.DATA_REGISTRY_ADDRESS;
const bountyIdEnv = process.env.BOUNTY_ID;
const storachaEmail = process.env.STORACHA_EMAIL;

async function main() {
  if (!rpcUrl || !privateKey || !dataRegistryAddress || !storachaEmail) {
    throw new Error(
      "RPC_URL, PRIVATE_KEY, DATA_REGISTRY_ADDRESS, STORACHA_EMAIL must be set",
    );
  }

  const storacha = await StorachaBountyClient.create();
  await storacha.authorize(storachaEmail);
  await storacha.createSpace({ name: "bounty-submissions" });

  const bountyId =
    bountyIdEnv && Number.isFinite(Number(bountyIdEnv))
      ? Number(bountyIdEnv)
      : 1;

  const bountyData = {
    bountyId,
    timestamp: Date.now(),
    data: {
      value: Math.random(),
    },
  };

  const upload = await storacha.uploadJSON(bountyData);

  console.log("Uploaded CID:", upload.cidString);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const abi = [
    "function submitData(uint256 bountyId, string cid, string metadata) external returns (uint256)",
  ];

  const dataRegistry = new ethers.Contract(
    dataRegistryAddress,
    abi,
    wallet,
  );

  const metadata = JSON.stringify({
    name: "SDK Node example submission",
  });

  const tx = await dataRegistry.submitData(
    bountyId,
    upload.cidString,
    metadata,
  );

  console.log("Submitted transaction:", tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


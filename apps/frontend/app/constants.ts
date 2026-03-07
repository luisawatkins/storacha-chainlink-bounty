import BountyRegistryArtifact from "../../../packages/contracts/artifacts/contracts/BountyRegistry.sol/BountyRegistry.json";

export const BOUNTY_REGISTRY_ADDRESS = process.env
  .NEXT_PUBLIC_BOUNTY_REGISTRY_ADDRESS as `0x${string}`;

export const BOUNTY_REGISTRY_ABI = BountyRegistryArtifact.abi;

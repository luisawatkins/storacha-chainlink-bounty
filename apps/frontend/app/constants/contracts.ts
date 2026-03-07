// Addresses would normally be loaded from environment variables or a config file
// populated during deployment. For now, we use placeholders.

export const BOUNTY_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_BOUNTY_REGISTRY_ADDRESS as `0x${string}`) ||
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const DATA_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_DATA_REGISTRY_ADDRESS as `0x${string}`) ||
  "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

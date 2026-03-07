# @storacha-chainlink/sdk

TypeScript SDK for Storacha integration with the data bounty marketplace. Provides a simplified interface for uploading data to decentralized storage, managing spaces, and handling UCAN delegations.

## Installation

```bash
pnpm add @storacha-chainlink/sdk
```

## Quick Start

```typescript
import { StorachaBountyClient } from "@storacha-chainlink/sdk";

// Create a client instance
const client = await StorachaBountyClient.create();

// Authorize with your email (check your inbox for verification link)
await client.authorize("user@example.com");

// Create a storage space
const space = await client.createSpace({ name: "my-bounty-data" });

// Upload data for a bounty
const result = await client.uploadJSON({
  bountyId: 1,
  submissionData: {
    temperature: 25.5,
    humidity: 60,
    timestamp: Date.now(),
  },
});

console.log("Uploaded CID:", result.cidString);
console.log("Retrieve from:", client.getRetrievalUrl(result.cid));
```

## Features

- **Email-based Authentication**: Simple authorization flow via email verification
- **Space Management**: Create and manage storage spaces for organizing data
- **File Upload**: Upload files, directories, or JSON data directly
- **UCAN Delegation**: Share capabilities with other agents using UCAN
- **TypeScript First**: Full type definitions for all APIs

## API Reference

### Creating a Client

```typescript
import { StorachaBountyClient } from "@storacha-chainlink/sdk";

// Basic creation
const client = await StorachaBountyClient.create();

// With custom configuration
const client = await StorachaBountyClient.create({
  serviceUrl: "https://custom-storacha-instance.com/ipfs/",
  clientOptions: {
    principal: "did:key:z6MkYourAgentDid",
  },
});
```

### Authentication

```typescript
// Authorize with email
// This sends a verification email - the promise resolves when verified
await client.authorize("user@example.com");

// Check authorization status
const status = await client.getAuthorizationStatus();
if (status.isAuthorized) {
  console.log("Logged in as:", status.account?.email);
  console.log("Current space:", status.currentSpace?.did);
}

// Get all authorized accounts
const accounts = client.getAccounts();
```

### Space Management

Spaces are storage namespaces that organize your uploaded content.

```typescript
// Create a new space
const space = await client.createSpace({ name: "bounty-submissions" });
console.log("Space DID:", space.did);

// List all spaces
const spaces = client.getSpaces();
spaces.forEach((s) => {
  console.log(`${s.name}: ${s.did} ${s.isCurrentSpace ? "(current)" : ""}`);
});

// Switch to a different space
await client.setCurrentSpace("did:key:z6Mk...");

// Get current space
const current = client.getCurrentSpace();
```

### Uploading Data

```typescript
// Upload a file
const file = new File(["Hello, World!"], "hello.txt", { type: "text/plain" });
const result = await client.uploadFile(file);
console.log("CID:", result.cidString);

// Upload JSON data directly
const jsonResult = await client.uploadJSON({
  bountyId: 123,
  data: { sensor: "temp", value: 25.5 },
});

// Upload a directory of files
const files = [
  new File(["data1"], "data/file1.txt"),
  new File(["data2"], "data/file2.txt"),
];
const dirResult = await client.uploadDirectory(files);

// Track upload progress
const result = await client.uploadFile(largeFile, {
  onShardStored: (meta) => {
    console.log(`Shard stored: ${meta.cid} (${meta.size} bytes)`);
  },
});

// Get retrieval URL
const url = client.getRetrievalUrl(result.cid);
// => https://w3s.link/ipfs/bafy...
```

### UCAN Delegation

Share capabilities with other agents using UCAN (User Controlled Authorization Networks).

```typescript
// Create a delegation for another agent
const delegation = await client.createDelegation("did:key:z6MkTarget...", {
  capabilities: ["upload/add", "blob/add"],
  expiration: 60 * 60 * 24, // 24 hours in seconds
});

// Share the base64-encoded delegation
console.log("Share this with the other agent:", delegation.base64);

// The other agent can add the space using the delegation
const otherClient = await StorachaBountyClient.create();
await otherClient.addSpace(delegation.base64);
```

### Content Management

```typescript
// Remove uploaded content
await client.remove(result.cid);

// Get retrieval URL for any CID
const url = client.getRetrievalUrl("bafy...");
```

### Advanced Usage

```typescript
// Access the underlying Storacha client for advanced operations
const rawClient = client.getRawClient();

// Get your agent's DID
const agentDid = client.getAgentDid();

// Get available proofs/delegations
const proofs = client.getProofs(["upload/add"]);
```

## Types

The SDK exports all TypeScript types for full type safety:

```typescript
import type {
  CID,
  DID,
  Email,
  SpaceInfo,
  AccountInfo,
  UploadResult,
  UploadOptions,
  DelegationResult,
  DelegationOptions,
  Capability,
  AuthorizationStatus,
  StorachaBountyClientConfig,
} from "@storacha-chainlink/sdk";
```

## Integration with Bounty Contracts

Example of submitting data for a bounty:

```typescript
import { StorachaBountyClient } from "@storacha-chainlink/sdk";
import { ethers } from "ethers";

const storacha = await StorachaBountyClient.create();
await storacha.authorize("contributor@example.com");
await storacha.createSpace({ name: "my-submissions" });

const bountyData = {
  bountyId: 1,
  timestamp: Date.now(),
  data: {},
};

const upload = await storacha.uploadJSON(bountyData);

const dataRegistry = new ethers.Contract(DATA_REGISTRY_ADDRESS, ABI, signer);
await dataRegistry.submitData(
  1,
  upload.cidString,
  JSON.stringify({ name: "My Submission" }),
);
```

## Examples

### Node script example

An end-to-end Node script that uploads JSON and submits the resulting CID to `DataRegistry` is available at:

- `packages/sdk/examples/node/submit-bounty.mjs`

Prerequisites:

- Build the SDK:

```bash
pnpm build --filter @storacha-chainlink/sdk
```

- Set environment variables:

```bash
export RPC_URL="https://sepolia.example"
export PRIVATE_KEY="0x..."
export DATA_REGISTRY_ADDRESS="0x..."
export STORACHA_EMAIL="contributor@example.com"
export BOUNTY_ID="1"
```

Run the script:

```bash
node packages/sdk/examples/node/submit-bounty.mjs
```

### Browser example

A minimal browser example that authorizes with email, creates a space, and uploads JSON is available at:

- `packages/sdk/examples/browser/index.html`

Prerequisites:

- Build the SDK:

```bash
pnpm build --filter @storacha-chainlink/sdk
```

- Serve the examples directory with any static file server, then open the HTML file in a browser:

```bash
npx serve packages/sdk/examples/browser
```

## Security Considerations

- All data uploaded to Storacha is publicly accessible via its CID
- Do not upload sensitive or private information without encryption
- UCAN delegations should be shared securely and can be scoped with expiration
- Store your agent keys securely - they control access to your spaces

## Resources

- [Storacha Documentation](https://docs.storacha.network)
- [UCAN Specification](https://ucan.xyz)
- [IPFS Documentation](https://docs.ipfs.tech)

## License

MIT

/* global Functions, args, console */
// Chainlink Functions verification source code
// Runs on the Chainlink DON (Deno sandbox)
//
// args[0] = IPFS CID of the submitted data
// args[1] = IPFS CID of the JSON Schema to validate against
// args[2] = (optional) Gateway base URL override (for testing)
//
// Returns: Functions.encodeUint256(1) if valid, Functions.encodeUint256(0) if invalid

const dataCid = args[0];
const schemaCid = args[1];
const gatewayOverride = args[2];

if (!dataCid || !schemaCid) {
  console.log("Missing required arguments: dataCid and schemaCid");
  return Functions.encodeUint256(0);
}

console.log(`Data CID: ${dataCid}`);
console.log(`Schema CID: ${schemaCid}`);

// --- IPFS Fetching ---

const GATEWAYS = gatewayOverride
  ? [gatewayOverride]
  : ["https://w3s.link/ipfs/", "https://ipfs.io/ipfs/"];

async function fetchFromIPFS(cid) {
  for (const gw of GATEWAYS) {
    const sep = gw.endsWith("/") ? "" : "/";
    const url = `${gw}${sep}${cid}`;
    console.log(`Fetching: ${url}`);
    const res = await Functions.makeHttpRequest({ url, timeout: 8000 });
    if (!res.error) {
      return res.data;
    }
    console.log(`Gateway failed: ${gw} — ${res.message || "unknown error"}`);
  }
  return null;
}

// --- JSON Schema Validator ---

function getType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function validate(data, schema) {
  if (typeof schema !== "object" || schema === null) return true;

  // type
  if (schema.type) {
    const actual = getType(data);
    if (schema.type === "integer") {
      if (typeof data !== "number" || !Number.isInteger(data)) return false;
    } else if (actual !== schema.type) {
      return false;
    }
  }

  // enum
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(data))) {
      return false;
    }
  }

  // const
  if ("const" in schema) {
    if (JSON.stringify(data) !== JSON.stringify(schema.const)) return false;
  }

  // number constraints
  if (typeof data === "number") {
    if (schema.minimum !== undefined && data < schema.minimum) return false;
    if (schema.maximum !== undefined && data > schema.maximum) return false;
  }

  // string constraints
  if (typeof data === "string") {
    if (schema.minLength !== undefined && data.length < schema.minLength)
      return false;
    if (schema.maxLength !== undefined && data.length > schema.maxLength)
      return false;
    if (schema.pattern) {
      const re = new RegExp(schema.pattern);
      if (!re.test(data)) return false;
    }
  }

  // array constraints
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems)
      return false;
    if (schema.maxItems !== undefined && data.length > schema.maxItems)
      return false;
    if (schema.items) {
      for (const item of data) {
        if (!validate(item, schema.items)) return false;
      }
    }
  }

  // object constraints
  if (getType(data) === "object") {
    // required
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in data)) return false;
      }
    }
    // properties
    if (schema.properties) {
      for (const key of Object.keys(schema.properties)) {
        if (key in data) {
          if (!validate(data[key], schema.properties[key])) return false;
        }
      }
    }
    // additionalProperties
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(data)) {
        if (!allowed.has(key)) return false;
      }
    }
  }

  return true;
}

// --- Main Logic ---

const schema = await fetchFromIPFS(schemaCid);
if (schema === null) {
  console.log("Failed to fetch schema from IPFS");
  return Functions.encodeUint256(0);
}

const data = await fetchFromIPFS(dataCid);
if (data === null) {
  console.log("Failed to fetch data from IPFS");
  return Functions.encodeUint256(0);
}

console.log("Schema fetched successfully");
console.log("Data fetched successfully");

const valid = validate(data, schema);
console.log(`Validation result: ${valid ? "VALID" : "INVALID"}`);

return Functions.encodeUint256(valid ? 1 : 0);

import { StorachaBountyClient } from "../../dist/index.js";

const form = document.querySelector("form");
const output = document.getElementById("output");

async function handleSubmit(event) {
  event.preventDefault();

  if (!form || !output) {
    return;
  }

  const emailInput = document.getElementById("email");
  const bountyIdInput = document.getElementById("bountyId");

  if (!(emailInput instanceof HTMLInputElement)) {
    return;
  }

  const email = emailInput.value.trim();

  if (!email) {
    output.textContent = "Email is required";
    return;
  }

  const bountyId =
    bountyIdInput instanceof HTMLInputElement &&
    Number.isFinite(Number(bountyIdInput.value))
      ? Number(bountyIdInput.value)
      : 1;

  output.textContent = "Authorizing and uploading...";

  try {
    const client = await StorachaBountyClient.create();
    await client.authorize(email);

    await client.createSpace({ name: "browser-bounty-space" });

    const bountyData = {
      bountyId,
      timestamp: Date.now(),
      data: {
        value: Math.random(),
      },
    };

    const result = await client.uploadJSON(bountyData);

    const metadata = JSON.stringify({
      name: "Browser example submission",
    });

    const submitArgs = {
      bountyId,
      cid: result.cidString,
      metadata,
    };

    output.textContent = [
      `Uploaded CID: ${result.cidString}`,
      "",
      "Example submitData arguments:",
      `bountyId: ${submitArgs.bountyId}`,
      `cid: ${submitArgs.cid}`,
      `metadata: ${submitArgs.metadata}`,
    ].join("\n");
  } catch (error) {
    output.textContent = String(error);
  }
}

if (form) {
  form.addEventListener("submit", (event) => {
    handleSubmit(event);
  });
}

"use client";

import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { parseEther } from "viem";
import Link from "next/link";
import styles from "./page.module.css";
import { ThemeToggle } from "../components/ThemeToggle";
import { ConnectWallet } from "../components/ConnectWallet";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "../constants";

export default function CreateBounty() {
  const { isConnected } = useAccount();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    schemaUri: "",
    reward: "",
    deadline: "",
    maxSubmissions: "",
  });

  const [error, setError] = useState<string | null>(null);

  const {
    data: hash,
    isPending,
    writeContract,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const deadlineTimestamp = Math.floor(
      new Date(formData.deadline).getTime() / 1000,
    );

    if (!deadlineTimestamp || Number.isNaN(deadlineTimestamp)) {
      setError("Please provide a valid deadline");
      return;
    }

    if (deadlineTimestamp <= nowInSeconds) {
      setError("Deadline must be in the future");
      return;
    }

    const reward = parseFloat(formData.reward);

    if (Number.isNaN(reward) || reward < 0.01) {
      setError("Minimum reward is 0.01 ETH");
      return;
    }

    const maxSubmissions = parseInt(formData.maxSubmissions, 10);

    if (Number.isNaN(maxSubmissions) || maxSubmissions <= 0) {
      setError("Max submissions must be at least 1");
      return;
    }

    setError(null);

    try {
      const rewardWei = parseEther(formData.reward);

      writeContract({
        address: BOUNTY_REGISTRY_ADDRESS,
        abi: BOUNTY_REGISTRY_ABI,
        functionName: "createBounty",
        args: [
          formData.title,
          formData.description,
          formData.schemaUri,
          BigInt(deadlineTimestamp),
          BigInt(maxSubmissions),
        ],
        value: rewardWei,
      });
    } catch (error) {
      console.error("Error creating bounty:", error);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>
        <div className={styles.headerRight}>
          <ThemeToggle />
          <ConnectWallet />
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>Create New Bounty</h1>

        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="title">
              Bounty Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              className={styles.input}
              placeholder="e.g. Weather Data Collection"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              className={styles.textarea}
              placeholder="Describe what data you need..."
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="schemaUri">
              Schema URI (IPFS CID)
            </label>
            <input
              type="text"
              id="schemaUri"
              name="schemaUri"
              className={styles.input}
              placeholder="ipfs://..."
              value={formData.schemaUri}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="reward">
                Reward (ETH)
              </label>
              <input
                type="number"
                id="reward"
                name="reward"
                className={styles.input}
                placeholder="0.1"
                step="0.001"
                min="0.01"
                value={formData.reward}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="maxSubmissions">
                Max Submissions
              </label>
              <input
                type="number"
                id="maxSubmissions"
                name="maxSubmissions"
                className={styles.input}
                placeholder="100"
                min="1"
                value={formData.maxSubmissions}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="deadline">
              Deadline
            </label>
            <input
              type="datetime-local"
              id="deadline"
              name="deadline"
              className={styles.input}
              value={formData.deadline}
              onChange={handleChange}
              required
            />
          </div>

          {error && <div className={styles.error}>Error: {error}</div>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isPending || isConfirming || !isConnected}
          >
            {isPending
              ? "Confirm in Wallet..."
              : isConfirming
                ? "Creating Bounty..."
                : "Create Bounty"}
          </button>

          {writeError && (
            <div className={styles.error}>Error: {writeError.message}</div>
          )}

          {isSuccess && (
            <div className={styles.success}>
              Bounty created successfully! <br />
              Transaction Hash: {hash}
            </div>
          )}
        </form>
      </main>
    </div>
  );
}

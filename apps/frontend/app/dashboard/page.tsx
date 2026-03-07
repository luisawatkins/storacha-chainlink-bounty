"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import styles from "./dashboard.module.css";
import { BOUNTY_REGISTRY_ABI, DATA_REGISTRY_ABI } from "../constants/abis";
import {
  BOUNTY_REGISTRY_ADDRESS,
  DATA_REGISTRY_ADDRESS,
} from "../constants/contracts";
import { ConnectWallet } from "../components/ConnectWallet";

const formatDate = (timestamp: bigint) => {
  return new Date(Number(timestamp) * 1000).toLocaleDateString();
};

const getBountyStatus = (status: number) => {
  const statuses = ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"];
  return statuses[status] || "UNKNOWN";
};

const getSubmissionStatus = (status: number) => {
  const statuses = ["PENDING", "VERIFYING", "VERIFIED", "REJECTED"];
  return statuses[status] || "UNKNOWN";
};

function BountySubmissionsList({
  bountyId,
  onBack,
}: {
  bountyId: bigint;
  onBack: () => void;
}) {
  const { data: submissionIds, isLoading: isLoadingIds } = useReadContract({
    address: DATA_REGISTRY_ADDRESS,
    abi: DATA_REGISTRY_ABI,
    functionName: "getBountySubmissions",
    args: [bountyId],
  });

  const { data: submissions, isLoading: isLoadingSubmissions } =
    useReadContracts({
      contracts: (submissionIds || []).map((id) => ({
        address: DATA_REGISTRY_ADDRESS,
        abi: DATA_REGISTRY_ABI,
        functionName: "getSubmission",
        args: [id],
      })),
    });

  if (isLoadingIds || isLoadingSubmissions) {
    return (
      <div className={styles.grid}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onBack}
        className={styles.actionButton}
        style={{ marginBottom: "1rem" }}
      >
        ← Back to Bounties
      </button>

      {!submissionIds || submissionIds.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>No submissions yet</h3>
          <p>Wait for contributors to submit data for this bounty.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {submissions?.map((result, index) => {
            if (!result.result) return null;
            const submission = result.result;
            const status = getSubmissionStatus(submission.status);

            return (
              <div key={index} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.bountyTitle}>
                    Submission #{submission.id.toString()}
                  </h3>
                  <span
                    className={`${styles.statusBadge} ${styles[`status${status.charAt(0) + status.slice(1).toLowerCase()}`]}`}
                  >
                    {status}
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--foreground-secondary)",
                    }}
                  >
                    <p>
                      <strong>Contributor:</strong>{" "}
                      {submission.contributor.substring(0, 6)}...
                      {submission.contributor.substring(38)}
                    </p>
                    <p>
                      <strong>CID:</strong>{" "}
                      <span title={submission.cid}>
                        {submission.cid.substring(0, 10)}...
                      </span>
                    </p>
                    <p>
                      <strong>Submitted:</strong>{" "}
                      {formatDate(submission.submittedAt)}
                    </p>
                    {submission.verifiedAt > 0n && (
                      <p>
                        <strong>Verified:</strong>{" "}
                        {formatDate(submission.verifiedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MyBountiesList({ address }: { address: `0x${string}` }) {
  const [selectedBountyId, setSelectedBountyId] = useState<bigint | null>(null);

  const {
    data: bountyIds,
    isLoading: isLoadingIds,
    refetch: refetchIds,
  } = useReadContract({
    address: BOUNTY_REGISTRY_ADDRESS,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "getBountiesByCreator",
    args: [address],
  });

  const {
    data: bounties,
    isLoading: isLoadingBounties,
    refetch: refetchBounties,
  } = useReadContracts({
    contracts: (bountyIds || []).map((id) => ({
      address: BOUNTY_REGISTRY_ADDRESS,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "getBounty",
      args: [id],
    })),
  });

  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isCancelling, isSuccess: isCancelled } =
    useWaitForTransactionReceipt({
      hash,
    });

  useEffect(() => {
    if (isCancelled) {
      refetchIds();
      refetchBounties();
    }
  }, [isCancelled, refetchIds, refetchBounties]);

  const handleCancel = (id: bigint) => {
    if (
      !confirm(
        "Are you sure you want to cancel this bounty? This action is irreversible.",
      )
    )
      return;
    writeContract({
      address: BOUNTY_REGISTRY_ADDRESS,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "cancelBounty",
      args: [id],
    });
  };

  if (selectedBountyId !== null) {
    return (
      <BountySubmissionsList
        bountyId={selectedBountyId}
        onBack={() => setSelectedBountyId(null)}
      />
    );
  }

  if (isLoadingIds || isLoadingBounties) {
    return (
      <div className={styles.grid}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (!bountyIds || bountyIds.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h3>No bounties created yet</h3>
        <p>Create your first bounty to start collecting data.</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {bounties?.map((result, index) => {
        if (!result.result) return null;
        const bounty = result.result;
        const status = getBountyStatus(bounty.status);

        return (
          <div key={index} className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.bountyTitle}>
                #{bounty.id.toString()} {bounty.title}
              </h3>
              <span
                className={`${styles.statusBadge} ${styles[`status${status.charAt(0) + status.slice(1).toLowerCase()}`]}`}
              >
                {status}
              </span>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.description}>{bounty.description}</p>
              <div
                style={{
                  marginTop: "1rem",
                  fontSize: "0.875rem",
                  color: "#64748b",
                }}
              >
                <div>Deadline: {formatDate(bounty.deadline)}</div>
                <div>
                  Submissions: {bounty.submissionCount.toString()} /{" "}
                  {bounty.maxSubmissions.toString()}
                </div>
              </div>
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.reward}>
                {formatEther(bounty.reward)} ETH
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className={styles.actionButton}
                  onClick={() => setSelectedBountyId(bounty.id)}
                >
                  View Submissions
                </button>
                {status === "ACTIVE" && (
                  <button
                    className={`${styles.actionButton} ${styles.cancelButton}`}
                    onClick={() => handleCancel(bounty.id)}
                    disabled={isCancelling}
                  >
                    {isCancelling ? "Cancelling..." : "Cancel Bounty"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MySubmissionsList({ address }: { address: `0x${string}` }) {
  const { data: submissionIds, isLoading: isLoadingIds } = useReadContract({
    address: DATA_REGISTRY_ADDRESS,
    abi: DATA_REGISTRY_ABI,
    functionName: "getSubmissionsByContributor",
    args: [address],
  });

  const { data: submissions, isLoading: isLoadingSubmissions } =
    useReadContracts({
      contracts: (submissionIds || []).map((id) => ({
        address: DATA_REGISTRY_ADDRESS,
        abi: DATA_REGISTRY_ABI,
        functionName: "getSubmission",
        args: [id],
      })),
    });

  if (isLoadingIds || isLoadingSubmissions) {
    return (
      <div className={styles.grid}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (!submissionIds || submissionIds.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h3>No submissions yet</h3>
        <p>Browse active bounties and start contributing data.</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {submissions?.map((result, index) => {
        if (!result.result) return null;
        const submission = result.result;
        const status = getSubmissionStatus(submission.status);

        return (
          <div key={index} className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.bountyTitle}>
                Submission #{submission.id.toString()}
              </h3>
              <span
                className={`${styles.statusBadge} ${styles[`status${status.charAt(0) + status.slice(1).toLowerCase()}`]}`}
              >
                {status}
              </span>
            </div>
            <div className={styles.cardBody}>
              <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                <p>
                  <strong>Bounty ID:</strong> {submission.bountyId.toString()}
                </p>
                <p>
                  <strong>CID:</strong>{" "}
                  <span title={submission.cid}>
                    {submission.cid.substring(0, 10)}...
                  </span>
                </p>
                <p>
                  <strong>Submitted:</strong>{" "}
                  {formatDate(submission.submittedAt)}
                </p>
                {submission.verifiedAt > 0n && (
                  <p>
                    <strong>Verified:</strong>{" "}
                    {formatDate(submission.verifiedAt)}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"bounties" | "submissions">(
    "bounties",
  );

  if (!isConnected || !address) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>Please connect your wallet to view your dashboard</h2>
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <ConnectWallet />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>My Dashboard</h1>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "bounties" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("bounties")}
        >
          My Bounties
        </button>
        <button
          className={`${styles.tab} ${activeTab === "submissions" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("submissions")}
        >
          My Submissions
        </button>
      </div>

      {activeTab === "bounties" ? (
        <MyBountiesList address={address} />
      ) : (
        <MySubmissionsList address={address} />
      )}
    </div>
  );
}

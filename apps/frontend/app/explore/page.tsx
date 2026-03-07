"use client";

import styles from "./page.module.css";
import { MOCK_BOUNTIES } from "../lib/mockData";

export default function ExplorePage() {
  return (
    <main className={styles.main}>
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "2rem", marginBottom: "12px" }}>
          Explore Bounties
        </h2>
        <p style={{ color: "var(--muted)" }}>
          Discover and contribute to data bounties. Earn rewards for valid data
          submissions.
        </p>
      </div>

      <div className={styles.grid}>
        {MOCK_BOUNTIES.map((bounty) => (
          <div key={bounty.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.bountyTitle}>{bounty.title}</h3>
              <span className={styles.reward}>{bounty.reward}</span>
            </div>

            <p className={styles.description}>{bounty.description}</p>

            <div className={styles.footer}>
              <div
                className={`${styles.status} ${
                  bounty.status === "closed" ? styles.statusClosed : ""
                }`}
              >
                <span className={styles.statusDot} />
                <span style={{ textTransform: "capitalize" }}>
                  {bounty.status}
                </span>
              </div>
              <span>{bounty.participants} Contributors</span>
            </div>

            <a
              href={`/explore/${bounty.id}`}
              className={styles.button}
              style={{
                textDecoration: "none",
                display: "inline-block",
                textAlign: "center",
              }}
            >
              View Details
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}

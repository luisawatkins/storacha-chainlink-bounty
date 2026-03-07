import Link from "next/link";
import styles from "./page.module.css";
import { MOCK_BOUNTIES } from "../../lib/mockData";

export default async function BountyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bounty = MOCK_BOUNTIES.find((b) => b.id === parseInt(id));

  if (!bounty) {
    return (
      <main className={styles.main}>
        <h1>Bounty not found</h1>
        <Link href="/explore" className={styles.backLink}>
          ← Back to Explore
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Link href="/explore" className={styles.backLink}>
        ← Back to Explore
      </Link>

      <div className={styles.content}>
        <div className={styles.bountyHeader}>
          <div>
            <div
              className={`${styles.status} ${
                bounty.status === "closed" ? styles.statusClosed : ""
              }`}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "currentColor",
                }}
              />
              <span style={{ textTransform: "capitalize" }}>
                {bounty.status}
              </span>
            </div>
            <h1 className={styles.bountyTitle}>{bounty.title}</h1>
            <div className={styles.meta}>
              <span>Created by {bounty.issuer || "0x..."}</span>
              <span>•</span>
              <span>{bounty.participants} Contributors</span>
              <span>•</span>
              <span>Ends {bounty.deadline}</span>
            </div>
          </div>
          <div className={styles.reward}>{bounty.reward}</div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Description</h3>
          <p className={styles.description}>{bounty.description}</p>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Requirements</h3>
          <ul className={styles.list}>
            {bounty.requirements?.map((req, index) => (
              <li key={index} className={styles.listItem}>
                {req}
              </li>
            )) || (
              <li className={styles.listItem}>
                No specific requirements listed.
              </li>
            )}
          </ul>
        </div>

        <div className={styles.actions}>
          <button className={styles.primaryButton}>Submit Data</button>
          <button className={styles.secondaryButton}>Share Bounty</button>
        </div>
      </div>
    </main>
  );
}

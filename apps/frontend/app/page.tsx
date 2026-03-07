import Link from "next/link";
import styles from "./page.module.css";
import { ThemeToggle } from "./components/ThemeToggle";
import { ConnectWallet } from "./components/ConnectWallet";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <span className={styles.badge}>Powered by Web3</span>

          <h1 className={styles.title}>
            Decentralized Data{" "}
            <span className={styles.titleGradient}>Bounty Marketplace</span>
          </h1>

          <p className={styles.subtitle}>
            A trustless marketplace where creators post bounties, contributors
            upload data to decentralized storage, and smart contracts
            automatically release payments upon verification.
          </p>

          <div className={styles.ctas}>
            <Link href="/explore" className={styles.primary}>
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
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Explore Bounties
            </Link>
            <Link href="/create-bounty" className={styles.secondary}>
              Create Bounty
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className={styles.features}>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.storage}`}>📦</div>
            <h3 className={styles.featureTitle}>Storacha Storage</h3>
            <p className={styles.featureDescription}>
              Data is stored on IPFS and backed by Filecoin through Storacha,
              ensuring permanent, censorship-resistant storage.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.oracle}`}>🔗</div>
            <h3 className={styles.featureTitle}>Chainlink Verification</h3>
            <p className={styles.featureDescription}>
              Chainlink Functions validate data quality and schema compliance
              off-chain before triggering on-chain rewards.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.payment}`}>💰</div>
            <h3 className={styles.featureTitle}>Automatic Payments</h3>
            <p className={styles.featureDescription}>
              Smart contracts hold bounty funds in escrow and automatically
              release payments when data passes verification.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.trust}`}>🛡️</div>
            <h3 className={styles.featureTitle}>Trustless System</h3>
            <p className={styles.featureDescription}>
              No intermediaries needed. The entire flow from submission to
              payment is handled by decentralized protocols.
            </p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <a
            href="https://docs.storacha.network"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Storacha Docs
          </a>
          <a
            href="https://docs.chain.link/chainlink-functions"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Chainlink Functions
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

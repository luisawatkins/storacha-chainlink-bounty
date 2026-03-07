import Link from "next/link";
import styles from "./page.module.css";
import { ThemeToggle } from "../components/ThemeToggle";
import { ConnectWallet } from "../components/ConnectWallet";

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.nav}>
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <h1 className={styles.title}>Storacha Bounty</h1>
          </Link>
        </div>
        <div className={styles.nav}>
          <ThemeToggle />
          <ConnectWallet />
        </div>
      </header>
      {children}
    </div>
  );
}

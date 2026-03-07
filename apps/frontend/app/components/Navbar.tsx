"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { ConnectWallet } from "./ConnectWallet";
import styles from "./Navbar.module.css";
import { useAccount } from "wagmi";

export function Navbar() {
  const { isConnected } = useAccount();

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        Storacha Bounty
      </Link>

      <nav className={styles.nav}>
        <Link href="/" className={styles.navLink}>
          Home
        </Link>
        {isConnected && (
          <Link href="/dashboard" className={styles.navLink}>
            Dashboard
          </Link>
        )}
      </nav>

      <div className={styles.actions}>
        <ThemeToggle />
        <ConnectWallet />
      </div>
    </header>
  );
}

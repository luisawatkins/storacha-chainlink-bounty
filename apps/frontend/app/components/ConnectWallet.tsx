"use client";

import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import styles from "./ConnectWallet.module.css";

export function ConnectWallet() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className={styles.connectButton}
                  >
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
                      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                      <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
                    </svg>
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className={`${styles.connectButton} ${styles.error}`}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                    Wrong Network
                  </button>
                );
              }

              return (
                <div className={styles.connectedContainer}>
                  <button
                    onClick={openChainModal}
                    className={styles.chainButton}
                    type="button"
                    title="Switch network"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <Image
                        alt={chain.name ?? "Chain icon"}
                        src={chain.iconUrl}
                        width={24}
                        height={24}
                        className={styles.chainIcon}
                        unoptimized
                      />
                    )}
                    <span className={styles.chainName}>{chain.name}</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className={styles.accountButton}
                  >
                    {account.ensAvatar && (
                      <Image
                        alt="Avatar"
                        src={account.ensAvatar}
                        width={32}
                        height={32}
                        className={styles.avatar}
                        unoptimized
                      />
                    )}
                    <span className={styles.accountInfo}>
                      <span className={styles.displayName}>
                        {account.ensName || account.displayName}
                      </span>
                      {account.displayBalance && (
                        <span className={styles.balance}>
                          {account.displayBalance}
                        </span>
                      )}
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

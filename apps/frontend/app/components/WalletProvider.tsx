"use client";

import { ReactNode, useState, useEffect } from "react";
import { WagmiProvider } from "wagmi";
import {
  mainnet,
  sepolia,
  polygon,
  arbitrum,
  base,
  optimism,
  localhost,
} from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

// Configure chains - includes testnets and popular L2s for the bounty marketplace
const config = getDefaultConfig({
  appName: "Storacha × Chainlink Bounty",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "demo",
  chains: [mainnet, sepolia, polygon, arbitrum, base, optimism, localhost],
  ssr: true,
});

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Custom RainbowKit theme that matches our app
const customLightTheme = lightTheme({
  accentColor: "#6366f1",
  accentColorForeground: "white",
  borderRadius: "medium",
  fontStack: "system",
});

const customDarkTheme = darkTheme({
  accentColor: "#818cf8",
  accentColorForeground: "#18181b",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

// Hook to detect theme from DOM class (syncs with ThemeProvider)
function useDetectTheme() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Initial check
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkTheme();

    // Watch for class changes on html element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  return isDark;
}

// Inner provider that detects theme
function WalletProviderInner({ children }: { children: ReactNode }) {
  const isDark = useDetectTheme();

  return (
    <RainbowKitProvider
      theme={isDark ? customDarkTheme : customLightTheme}
      modalSize="compact"
      appInfo={{
        appName: "Storacha × Chainlink Bounty",
        learnMoreUrl: "https://docs.storacha.network",
      }}
    >
      {children}
    </RainbowKitProvider>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletProviderInner>{children}</WalletProviderInner>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

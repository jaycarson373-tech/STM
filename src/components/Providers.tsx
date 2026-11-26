'use client';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import type { ReactNode } from 'react';

// Wallets are discovered through the Wallet Standard (Phantom, Solflare,
// Backpack, Jupiter and others register themselves), so no adapters are bundled.
export default function Providers({ children }: { children: ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

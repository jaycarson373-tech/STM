'use client';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { useEffect, useState } from 'react';
import { short } from '@/lib/format';

export default function WalletButton() {
  const { wallets, wallet, publicKey, connected, connecting, select, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  // select() is async inside the adapter; connect once the choice has landed
  useEffect(() => {
    if (pending && wallet?.adapter.name === pending && !connected && !connecting) {
      connect().catch(() => {}).finally(() => setPending(null));
    }
  }, [pending, wallet, connected, connecting, connect]);

  const installed = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);

  if (connected && publicKey) {
    return (
      <button className="btn btn-sm mono" onClick={() => disconnect()} title="Disconnect">
        <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--up)' }} />
        {short(publicKey.toBase58())}
      </button>
    );
  }

  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)} disabled={connecting}>
        {connecting ? 'Connecting…' : 'Connect wallet'}
      </button>
      {open && (
        <div className="modal-bg" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Connect a wallet" onClick={(e) => e.stopPropagation()}>
            <h3>Connect a wallet</h3>
            <p className="hint">STM never sees your keys. Every launch is a transaction you review and sign in your wallet.</p>
            <div className="wallet-list">
              {installed.length === 0 && (
                <p className="hint">
                  No Solana wallet found in this browser. Install{' '}
                  <a className="up" href="https://phantom.com" target="_blank" rel="noreferrer">Phantom</a>,{' '}
                  <a className="up" href="https://solflare.com" target="_blank" rel="noreferrer">Solflare</a> or{' '}
                  <a className="up" href="https://backpack.app" target="_blank" rel="noreferrer">Backpack</a>, then reload.
                </p>
              )}
              {installed.map((w) => (
                <button
                  key={w.adapter.name}
                  className="wallet-item"
                  onClick={() => { select(w.adapter.name); setPending(w.adapter.name); setOpen(false); }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.adapter.icon} alt="" />
                  <span>{w.adapter.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

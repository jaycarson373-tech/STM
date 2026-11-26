'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Mark from './Mark';

const WalletButton = dynamic(() => import('./WalletButton'), { ssr: false, loading: () => <span className="btn btn-sm" aria-hidden>Connect wallet</span> });

const LINKS = [
  { href: '/', label: 'Time Machine' },
  { href: '/eras', label: 'Explore Eras' },
  { href: '/launch', label: 'Launch' },
  { href: '/markets', label: 'Markets' },
  { href: '/engine', label: 'Liquidity Engine' },
  { href: '/docs', label: 'Docs' },
];

export default function Header() {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return (
    <header className="top">
      <div className="wrap top-inner">
        <Link href="/" className="brand" aria-label="Solana Time Machine home">
          <Mark />
          <span className="brand-name">Time Machine <span>STM</span></span>
        </Link>
        <nav className="nav" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined}>{l.label}</Link>
          ))}
        </nav>
        <div className="top-tools">
          <span className="chrono">2021 <b>→</b> {new Date().getUTCFullYear()}</span>
          <WalletButton />
          <button className="menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><span /><span /></button>
        </div>
      </div>
      {open && (
        <nav className="mobile-nav" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined}>{l.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}

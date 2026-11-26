import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Instrument_Serif } from 'next/font/google';
import Link from 'next/link';
import Header from '@/components/Header';
import Providers from '@/components/Providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Solana Time Machine', template: '%s · Solana Time Machine' },
  description: 'Six years of Solana culture, an archive of the memes that made it, and a multi-launchpad with a liquidity-first fee engine. The past has a future.',
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  openGraph: { title: 'Solana Time Machine', description: 'The past has a future.', type: 'website' },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
          <footer className="foot">
            <div className="wrap foot-inner">
              <span className="serif">The past has a future.</span>
              <span>Market data: DexScreener and GeckoTerminal, fetched live. Nothing here is investment advice.</span>
              <div className="foot-links">
                <Link href="/docs">Docs</Link>
                <Link href="/engine">Ledger</Link>
                <Link href="/docs#integrations">Integrations</Link>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

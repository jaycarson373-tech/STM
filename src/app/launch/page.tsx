import type { Metadata } from 'next';
import { ARCHIVE, ERAS, archiveToken } from '@/data/eras';
import LaunchForm from '@/components/LaunchForm';
import { VENUES } from '@/lib/capabilities';
import { vaultsEnabled } from '@/lib/solana';
import { storeConfigured } from '@/lib/store';
import { venueAvailability } from '@/lib/venues';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Launch' };

export default async function Launch({ searchParams }: { searchParams: Promise<{ era?: string; tribute?: string }> }) {
  const q = await searchParams;
  const tribute = q.tribute ? archiveToken(q.tribute) : undefined;
  const era = q.era && ERAS.some((e) => String(e.year) === q.era) ? Number(q.era) : tribute?.year ?? null;
  const venues = (['pump', 'raydium', 'meteora'] as const).map((v) => ({ id: v, name: VENUES[v].name, ...venueAvailability(v) }));
  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <span className="label">Launch</span>
          <h1>Send something into the future.</h1>
          <p>Launch an original token, one inspired by an era, or a clearly labelled tribute to a historical meme, on Pump.fun, Raydium LaunchLab or Meteora. You sign the exact transaction in your own wallet.</p>
        </div>
      </div>
      <LaunchForm
        eras={ERAS.map((e) => ({ year: e.year, codename: e.codename, accent: e.accent }))}
        relics={ARCHIVE.map((t) => ({ mint: t.mint, symbol: t.symbol, name: t.name, year: t.year }))}
        venues={venues}
        engineAvailable={vaultsEnabled()}
        registryAvailable={storeConfigured()}
        initial={{ kind: tribute ? 'tribute' : era ? 'inspired' : 'original', era, tributeOf: tribute?.mint ?? null }}
      />
    </div>
  );
}

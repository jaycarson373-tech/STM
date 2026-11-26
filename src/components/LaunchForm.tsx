'use client';
import Link from 'next/link';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { useMemo, useState } from 'react';
import { short } from '@/lib/format';

type Kind = 'original' | 'inspired' | 'tribute';
type VenueId = 'pump' | 'raydium' | 'meteora';
interface Props {
  eras: { year: number; codename: string; accent: string }[];
  relics: { mint: string; symbol: string; name: string; year: number }[];
  venues: { id: VenueId; name: string; ok: boolean; reason?: string }[];
  engineAvailable: boolean;
  registryAvailable: boolean;
  initial: { kind: Kind; era: number | null; tributeOf: string | null };
}

const VENUE_NOTE: Record<VenueId, string> = {
  pump: 'Bonding curve, graduates to PumpSwap. Create and first buy in one transaction.',
  raydium: 'LaunchLab curve, migrates to Raydium CPMM. With the engine on, the first buy is a second signature.',
  meteora: 'Dynamic Bonding Curve, migrates to DAMM v2. Create and first buy in one transaction.',
};

const toB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export default function LaunchForm({ eras, relics, venues, engineAvailable, registryAvailable, initial }: Props) {
  const { publicKey, signTransaction, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const orig = relics.find((r) => r.mint === initial.tributeOf);

  const [kind, setKind] = useState<Kind>(initial.kind);
  const [era, setEra] = useState<number | null>(initial.era);
  const [tributeOf, setTributeOf] = useState<string | null>(initial.tributeOf);
  const [venue, setVenue] = useState<VenueId>('pump');
  const [name, setName] = useState(orig ? `${orig.name} Revival`.slice(0, 32) : '');
  const [symbol, setSymbol] = useState(orig ? `${orig.symbol.slice(0, 8)}R` : '');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [socials, setSocials] = useState({ twitter: '', telegram: '', website: '' });
  const [devBuy, setDevBuy] = useState('0.1');
  const [engine, setEngine] = useState(engineAvailable);
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'err' | 'ok'; text: string }>({ kind: 'idle', text: '' });
  const [result, setResult] = useState<{ mint: string; signature: string } | null>(null);

  const accent = eras.find((e) => e.year === (kind === 'tribute' ? relics.find((r) => r.mint === tributeOf)?.year : era))?.accent ?? '#a78bfa';
  const chosen = relics.find((r) => r.mint === tributeOf);
  const venueInfo = venues.find((v) => v.id === venue)!;
  const tributePrefix = chosen ? `Unofficial tribute to ${chosen.name} ($${chosen.symbol}, CA ${short(chosen.mint)}). Not affiliated with the original project.` : '';

  const problems = useMemo(() => {
    const p: string[] = [];
    if (!registryAvailable) p.push('This deployment has no launch registry configured.');
    if (!venueInfo.ok) p.push(venueInfo.reason || `${venueInfo.name} is not available.`);
    if (name.trim().length < 2) p.push('Add a name.');
    if (!/^[A-Z0-9]{2,10}$/.test(symbol.trim().toUpperCase().replace(/^\$/, ''))) p.push('Ticker: 2 to 10 letters or digits.');
    if (!image) p.push('Add an image.');
    if (kind === 'inspired' && !era) p.push('Pick the era that inspired it.');
    if (kind === 'tribute' && !chosen) p.push('Pick the relic this is a tribute to.');
    if (kind === 'tribute' && chosen && symbol.trim().toUpperCase() === chosen.symbol.toUpperCase()) p.push(`A tribute can't reuse $${chosen.symbol}.`);
    const d = Number(devBuy || 0);
    if (!Number.isFinite(d) || d < 0 || d > 10) p.push('First buy must be 0 to 10 SOL.');
    return p;
  }, [registryAvailable, venueInfo, name, symbol, image, kind, era, chosen, devBuy]);

  function pickImage(f: File | null) {
    setImage(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function launch() {
    if (!publicKey || !signTransaction) return setStatus({ kind: 'err', text: 'Connect a wallet that can sign transactions.' });
    if (problems.length) return setStatus({ kind: 'err', text: problems[0] });
    setResult(null);
    try {
      setStatus({ kind: 'busy', text: 'Uploading metadata and building the transaction…' });
      const f = new FormData();
      f.set('venue', venue); f.set('wallet', publicKey.toBase58()); f.set('name', name.trim()); f.set('symbol', symbol.trim());
      f.set('description', description.trim()); f.set('devBuySol', String(Number(devBuy || 0))); f.set('engine', String(engine && engineAvailable));
      f.set('kind', kind); if (era && kind !== 'original') f.set('era', String(era)); if (kind === 'tribute' && tributeOf) f.set('tributeOf', tributeOf);
      f.set('twitter', socials.twitter); f.set('telegram', socials.telegram); f.set('website', socials.website);
      if (image) f.set('image', image);
      const prep = await fetch('/api/launch/prepare', { method: 'POST', body: f }).then((r) => r.json());
      if (prep.error) throw new Error(prep.error);

      setStatus({ kind: 'busy', text: 'Review the transaction in your wallet. It creates the token and runs your first buy.' });
      const raw = fromB64(prep.tx);
      const signed = prep.legacy ? await signTransaction(Transaction.from(raw)) : await signTransaction(VersionedTransaction.deserialize(raw));
      const signedRaw = signed instanceof VersionedTransaction ? signed.serialize() : (signed as Transaction).serialize({ requireAllSignatures: true });

      setStatus({ kind: 'busy', text: 'Sending and waiting for confirmation…' });
      const sub = await fetch('/api/launch/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ launchId: prep.launchId, signedTx: toB64(signedRaw) }) }).then((r) => r.json());
      if (sub.error) throw new Error(sub.error);
      setResult({ mint: sub.mint, signature: sub.signature });

      if (sub.next?.tx) {
        setStatus({ kind: 'busy', text: 'Token created. Sign your first buy (a second transaction for LaunchLab with the engine on).' });
        const sig = await sendTransaction(VersionedTransaction.deserialize(fromB64(sub.next.tx)), connection);
        await connection.confirmTransaction(sig, 'confirmed');
      }
      setStatus({ kind: 'ok', text: sub.firstBuyError ? `Token is live. The first buy could not be built: ${sub.firstBuyError}` : 'Your token is live.' });
    } catch (e) {
      setStatus({ kind: 'err', text: (e as Error).message || 'Something went wrong.' });
    }
  }

  return (
    <div className="form" style={{ ['--era' as string]: accent }}>
      <div>
        <div className="step">
          <div className="step-h"><span className="n">01</span><h3>What are you launching?</h3></div>
          <div className="choices">
            <button className="choice" aria-pressed={kind === 'original'} onClick={() => setKind('original')}><b>Original</b><span>A brand-new token with no historical reference.</span></button>
            <button className="choice" aria-pressed={kind === 'inspired'} onClick={() => setKind('inspired')}><b>Inspired by an era</b><span>A new token tagged to the year whose narrative it continues.</span></button>
            <button className="choice" aria-pressed={kind === 'tribute'} onClick={() => setKind('tribute')}><b>Tribute to a relic</b><span>Always labelled unofficial. It can&rsquo;t reuse the original ticker or name.</span></button>
          </div>
          {kind === 'inspired' && (
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="era">Era</label>
              <select id="era" className="select" value={era ?? ''} onChange={(e) => setEra(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Choose a year</option>
                {eras.map((e) => <option key={e.year} value={e.year}>{e.year} · {e.codename}</option>)}
              </select>
            </div>
          )}
          {kind === 'tribute' && (
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="relic">Relic</label>
              <select id="relic" className="select" value={tributeOf ?? ''} onChange={(e) => { setTributeOf(e.target.value || null); const r = relics.find((x) => x.mint === e.target.value); if (r) setEra(r.year); }}>
                <option value="">Choose a historical token</option>
                {relics.map((r) => <option key={r.mint} value={r.mint}>{r.year} · {r.name} (${r.symbol})</option>)}
              </select>
              {chosen && <span className="hint">The description will start with: &ldquo;{tributePrefix}&rdquo;</span>}
            </div>
          )}
        </div>

        <div className="step">
          <div className="step-h"><span className="n">02</span><h3>Where does it launch?</h3></div>
          <div className="choices">
            {venues.map((v) => (
              <button key={v.id} className="choice" aria-pressed={venue === v.id} disabled={!v.ok} onClick={() => setVenue(v.id)} title={v.reason}>
                <b>{v.name}</b><span>{v.ok ? VENUE_NOTE[v.id] : v.reason}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="step">
          <div className="step-h"><span className="n">03</span><h3>Token details</h3></div>
          <div className="row2">
            <div className="field"><label htmlFor="n">Name</label><input id="n" className="input" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} placeholder="Solana Summer Forever" /></div>
            <div className="field"><label htmlFor="s">Ticker</label><input id="s" className="input mono" maxLength={11} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="SUMMER" /></div>
          </div>
          <div className="field"><label htmlFor="d">Description</label><textarea id="d" className="textarea" maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this coin about?" /></div>
          <div className="field">
            <label>Image</label>
            <label className="drop">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview ? <img src={preview} alt="" /> : <span className="ph" />}
              <span><b>{image ? image.name : 'Choose an image'}</b><span className="hint" style={{ display: 'block' }}>PNG, JPEG, WebP or GIF, up to 2 MB</span></span>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="row3">
            <div className="field"><label htmlFor="x">X</label><input id="x" className="input" value={socials.twitter} onChange={(e) => setSocials({ ...socials, twitter: e.target.value })} placeholder="https://x.com/…" /></div>
            <div className="field"><label htmlFor="t">Telegram</label><input id="t" className="input" value={socials.telegram} onChange={(e) => setSocials({ ...socials, telegram: e.target.value })} placeholder="https://t.me/…" /></div>
            <div className="field"><label htmlFor="w">Website</label><input id="w" className="input" value={socials.website} onChange={(e) => setSocials({ ...socials, website: e.target.value })} placeholder="https://…" /></div>
          </div>
        </div>

        <div className="step">
          <div className="step-h"><span className="n">04</span><h3>First buy and fees</h3></div>
          <div className="field" style={{ maxWidth: 240 }}>
            <label htmlFor="b">First buy (SOL)</label>
            <input id="b" className="input mono" inputMode="decimal" value={devBuy} onChange={(e) => setDevBuy(e.target.value)} />
            <span className="hint">0 for no buy. Network fees and account rent are extra.</span>
          </div>
          <label className="toggle" style={{ opacity: engineAvailable ? 1 : 0.55 }}>
            <input type="checkbox" checked={engine && engineAvailable} disabled={!engineAvailable} onChange={(e) => setEngine(e.target.checked)} />
            <span>
              <b>Retro Liquidity Engine</b>
              <span className="hint" style={{ display: 'block', marginTop: 4 }}>
                {engineAvailable
                  ? 'A dedicated engine vault becomes this coin’s creator-fee recipient. 80% of claimed fees are added back to its liquidity after graduation, 20% go to the STM treasury. You do not receive creator fees with this on.'
                  : 'Not configured on this deployment. Creator fees will go to your wallet.'}
              </span>
              <Link href="/engine" className="hint" style={{ color: 'var(--cyan)' }}>How the engine works →</Link>
            </span>
          </label>
        </div>
      </div>

      <aside className="summary">
        <span className="label">Review</span>
        <dl>
          <dt>Type</dt><dd>{kind === 'tribute' ? 'Unofficial tribute' : kind === 'inspired' ? `Inspired by ${era ?? '—'}` : 'Original'}</dd>
          <dt>Venue</dt><dd>{venueInfo.name}</dd>
          <dt>Token</dt><dd>{name || '—'} {symbol ? `$${symbol}` : ''}</dd>
          <dt>First buy</dt><dd>{Number(devBuy || 0)} SOL</dd>
          <dt>Creator fees</dt><dd>{engine && engineAvailable ? 'Engine vault (80/20)' : 'Your wallet'}</dd>
          <dt>Payer</dt><dd>{publicKey ? short(publicKey.toBase58()) : 'Not connected'}</dd>
        </dl>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={!connected || status.kind === 'busy'} onClick={launch}>
          {!connected ? 'Connect a wallet to launch' : status.kind === 'busy' ? 'Working…' : 'Review and sign'}
        </button>
        {status.text && <p className={`status-line ${status.kind === 'err' ? 'err' : status.kind === 'ok' ? 'ok' : ''}`}>{status.text}</p>}
        {!status.text && problems.length > 0 && connected && <p className="status-line">{problems[0]}</p>}
        {result && (
          <p className="status-line">
            <Link href={`/token/${result.mint}`} style={{ color: 'var(--cyan)' }}>Open ${symbol} →</Link>{' '}
            · <a href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noreferrer" className="dim">transaction</a>
          </p>
        )}
        <p className="hint" style={{ marginTop: 16 }}>STM builds the transaction with the venue&rsquo;s official SDK and co-signs only the new mint (plus the engine vault where the venue requires it). Your wallet shows everything before you approve.</p>
      </aside>
    </div>
  );
}

'use client';
import { useState } from 'react';

export default function CopyText({ text, display }: { text: string; display?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="ca"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch {} }}
      title="Copy"
    >
      <span>{display ?? text}</span>
      <span className="dim">{done ? 'copied' : 'copy'}</span>
    </button>
  );
}

import { useState } from 'react';
import type { Card } from '../lib/supabase';

/* ─────────────────────────────────────────────
   HoloCardViewer — embeds the standalone holographic
   card renderer (served as static files from
   /public/holocard) inside the app via an iframe,
   the same pattern already used for /public/3daura.

   All the card's real data (name, hp, stats, moves,
   description, rarity, image_url) is passed through
   the URL query string. The iframe then loads the
   card's image directly from wherever image_url points
   (Cloudflare R2) — this never touches Supabase, so it
   adds zero Supabase egress beyond what the app already
   does today.
───────────────────────────────────────────── */

function truncate(str: string | undefined, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1).trimEnd() + '…' : str;
}

function buildHoloCardUrl(card: Card): string {
  const p = new URLSearchParams();
  p.set('name', truncate(card.card_name, 40));
  p.set('hp', String(card.hp ?? ''));
  p.set('type', card.type || '');
  // The card face only ever displays ~180 chars anyway (see truncate() inside
  // holocard/index.html) - truncating here too is what actually fixes the
  // 414: without it, a long AI-generated description alone can push the
  // whole URL past the length limit before it ever reaches the iframe.
  p.set('desc', truncate(card.description, 200));
  p.set('rarity', card.rarity);
  p.set('img', card.image_url || '');
  p.set('s1n', truncate(card.stat1_name, 24)); p.set('s1v', String(card.stat1_val ?? ''));
  p.set('s2n', truncate(card.stat2_name, 24)); p.set('s2v', String(card.stat2_val ?? ''));
  p.set('s3n', truncate(card.stat3_name, 24)); p.set('s3v', String(card.stat3_val ?? ''));
  p.set('m1n', truncate(card.move1_name, 30)); p.set('m1v', String(card.move1_dmg ?? ''));
  p.set('m2n', truncate(card.move2_name, 30)); p.set('m2v', String(card.move2_dmg ?? ''));
  return `/holocard/index.html?${p.toString()}`;
}

export default function HoloCardViewer({ card, onClose }: { card: Card; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 200, overflow: 'hidden' }}>
      <button
        onClick={onClose}
        title="Close"
        style={{
          position: 'fixed', top: 12, right: 12, zIndex: 210,
          background: 'linear-gradient(135deg,#f06292,#ab47bc,#64b5f6)',
          border: 'none', borderRadius: 10, color: '#fff',
          fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: '0.72rem',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '10px 16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        ✕ Close
      </button>

      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, color: '#ffd88a',
          fontFamily: "'Nunito', sans-serif",
        }}>
          <div style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
            Loading card…
          </div>
        </div>
      )}

      <iframe
        title="Holographic Card"
        src={buildHoloCardUrl(card)}
        onLoad={() => setLoaded(true)}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          border: 'none', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s',
        }}
        allow="fullscreen"
      />
    </div>
  );
}

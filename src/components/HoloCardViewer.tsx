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

function buildHoloCardUrl(card: Card): string {
  const p = new URLSearchParams();
  p.set('name', card.card_name || '');
  p.set('hp', String(card.hp ?? ''));
  p.set('type', card.type || '');
  p.set('desc', card.description || '');
  p.set('rarity', card.rarity);
  p.set('img', card.image_url || '');
  p.set('s1n', card.stat1_name || ''); p.set('s1v', String(card.stat1_val ?? ''));
  p.set('s2n', card.stat2_name || ''); p.set('s2v', String(card.stat2_val ?? ''));
  p.set('s3n', card.stat3_name || ''); p.set('s3v', String(card.stat3_val ?? ''));
  p.set('m1n', card.move1_name || ''); p.set('m1v', String(card.move1_dmg ?? ''));
  p.set('m2n', card.move2_name || ''); p.set('m2v', String(card.move2_dmg ?? ''));
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

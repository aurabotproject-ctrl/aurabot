import { useRef, useEffect } from 'react';
import type { Card } from '../lib/supabase';

const TYPE_COLORS: Record<string, string> = {
  fire: '#ef4444', water: '#3b82f6', nature: '#22c55e',
  electric: '#eab308', psychic: '#a855f7',
};
const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af', silver: '#94a3b8', 'gold-rare': '#f59e0b', prismatic: '#a855f7',
};

const HOLO_CSS_ID = 'built-card-holo-global';
const HOLO_CSS = `
  .bc-holo { position:absolute; inset:0; pointer-events:none; opacity:0; transition:opacity 0.3s; z-index:2; border-radius:6px; }
  .bc-wrap:hover .bc-holo { opacity:1; }
  .bc-rarity-silver .bc-holo { background:linear-gradient(105deg,transparent 20%,rgba(255,255,255,0.45) 25%,transparent 30%); background-size:200% 200%; animation:bcg-shimmer 3s infinite linear; mix-blend-mode:overlay; }
  .bc-rarity-gold-rare .bc-holo { background:linear-gradient(105deg,transparent 20%,rgba(160,196,255,0.55) 25%,rgba(185,251,192,0.55) 30%,transparent 35%),url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='10' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'/%3E%3Ccircle cx='28' cy='12' r='4' fill='rgba(255,255,255,0.4)'/%3E%3C/svg%3E"); background-size:200% 200%,40px 40px; animation:bcg-shimmer-gold 2.5s infinite linear; mix-blend-mode:color-dodge; }
  .bc-rarity-prismatic .bc-holo { background:linear-gradient(125deg,#ff000055,#ff7f0055,#ffff0055,#00ff0055,#0000ff55,#4b008255,#9400d355),url("data:image/svg+xml,%3Csvg width='50' height='50' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M25 8L31.2 18.5L43 20.8L35 29.5L36.5 41.5L25 36.5L13.5 41.5L15 29.5L7 20.8L18.8 18.5L25 8Z' fill='rgba(255,255,255,0.5)'/%3E%3Cpath d='M20 28.5L18.5 27.1C13.4 22.5 10 19.4 10 15.5C10 12.4 12.4 10 15.5 10C17.2 10 18.9 10.8 20 12.1C21.1 10.8 22.8 10 24.5 10C27.6 10 30 12.4 30 15.5C30 19.4 26.6 22.5 21.5 27.1L20 28.5Z' fill='rgba(255,120,220,0.4)'/%3E%3Ccircle cx='10' cy='10' r='5' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='1.5'/%3E%3C/svg%3E"); background-size:400% 400%,60px 60px; animation:bcg-rainbow 4s ease infinite; mix-blend-mode:color-dodge; }
  @keyframes bcg-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
  @keyframes bcg-shimmer-gold{0%{background-position:200% 0,0 0}100%{background-position:-200% 0,40px 40px}}
  @keyframes bcg-rainbow{0%{background-position:0% 50%,0 0}50%{background-position:100% 50%,30px 30px}100%{background-position:0% 50%,60px 60px}}
  .bc-wrap { transition:transform 0.12s ease-out; transform-style:preserve-3d; will-change:transform; }
`;

function injectStyles() {
  if (document.getElementById(HOLO_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = HOLO_CSS_ID;
  s.textContent = HOLO_CSS;
  document.head.appendChild(s);
}

type Props = { card: Card; size?: 'full' | 'mini'; onClick?: () => void };

function BuiltCard({ card, size = 'full', onClick }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => { injectStyles(); }, []);

  const typeColor = TYPE_COLORS[card.type?.toLowerCase()] || '#ef4444';
  const rarityColor = RARITY_COLORS[card.rarity] || '#9ca3af';
  const rarityLabel = card.rarity === 'gold-rare' ? 'GOLD' : (card.rarity || 'COMMON').toUpperCase();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el || size !== 'full') return;
    const rect = el.getBoundingClientRect();
    const rotX = (((e.clientY - rect.top) / rect.height) - 0.5) * -28;
    const rotY = (((e.clientX - rect.left) / rect.width) - 0.5) * 28;
    el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.04,1.04,1.04)`;
  };
  const handleMouseLeave = () => {
    if (cardRef.current) cardRef.current.style.transform = '';
  };

  // ── Mini version ─────────────────────────────────────────────
  if (size === 'mini') {
    return (
      <div
        onClick={onClick}
        style={{
          width: 90, aspectRatio: '2.5/3.5', borderRadius: 8, overflow: 'hidden',
          border: `3px solid ${typeColor}`, background: '#111827',
          display: 'flex', flexDirection: 'column',
          cursor: onClick ? 'pointer' : 'default', position: 'relative',
          boxShadow: `0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px ${rarityColor}44`,
        }}
      >
        <div style={{ flex: 1, overflow: 'hidden', background: '#1a1a2e' }}>
          {card.image_url
            ? <img src={card.image_url} alt={card.card_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎭</div>
          }
        </div>
        <div style={{ padding: '2px 4px', background: 'rgba(0,0,0,0.85)', color: 'white', fontSize: '0.55rem', fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {card.card_name}
        </div>
      </div>
    );
  }

  // ── Full version ─────────────────────────────────────────────
  return (
    <div className="card-stage flex flex-col items-center">
      <div
        ref={cardRef}
        className={`bc-wrap bc-rarity-${card.rarity}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        style={{
          width: 260, aspectRatio: '2.5/3.5', borderRadius: 14, overflow: 'hidden',
          border: `6px solid ${typeColor}`,
          background: '#111827',
          display: 'flex', flexDirection: 'column',
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${rarityColor}44`,
          position: 'relative',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        {/* Holo overlay — z-index 2, image stays at z-index 3 on top */}
        <div className="bc-holo" />

        {/* Gradient bg */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${typeColor}55, transparent 50%, #000)`, pointerEvents: 'none', zIndex: 0 }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.7rem', zIndex: 1, position: 'relative' }}>
          <span style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem', textShadow: '1px 1px 3px black', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '68%' }}>
            {card.card_name}
          </span>
          <span style={{ fontSize: '0.55rem', fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: rarityColor, color: '#fff', textTransform: 'uppercase', flexShrink: 0, letterSpacing: '0.06em' }}>
            {rarityLabel}
          </span>
        </div>

        {/* Image — z-index 3 above holo overlay */}
        <div style={{ margin: '0 0.5rem', aspectRatio: '4/3', background: '#1a1a2e', border: '2px solid #333', borderRadius: 6, overflow: 'hidden', zIndex: 3, position: 'relative', flexShrink: 0 }}>
          {card.image_url
            ? <img src={card.image_url} alt={card.card_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '2rem' }}>🎭</div>
          }
        </div>

        {/* Type badge */}
        <div style={{ textAlign: 'center', padding: '3px 0', fontSize: '0.62rem', fontWeight: 800, color: typeColor, background: 'rgba(0,0,0,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase', zIndex: 1, position: 'relative' }}>
          ✦ {card.type} ✦
        </div>

        {/* Description */}
        <div style={{ flex: 1, margin: '0.25rem 0.5rem', padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', zIndex: 1, position: 'relative' }}>
          <p style={{ color: '#ccc', fontSize: '0.63rem', lineHeight: 1.45, fontStyle: 'italic', margin: 0 }}>
            {card.description || 'A mysterious creature of untold power...'}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0.4rem 0.5rem', background: 'rgba(0,0,0,0.75)', margin: '0 0.5rem 0.5rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', zIndex: 1, position: 'relative' }}>
          <span style={{ color: '#ff9999', fontSize: '0.75rem', fontWeight: 800 }}>⚔️ {card.stat1_val}</span>
          <span style={{ color: '#99ccff', fontSize: '0.75rem', fontWeight: 800 }}>🛡️ {card.stat2_val}</span>
          <span style={{ color: '#99ffcc', fontSize: '0.75rem', fontWeight: 800 }}>💨 {card.stat3_val}</span>
        </div>
      </div>
    </div>
  );
}

export default BuiltCard;

import { useRef, useCallback, useState } from 'react';
import type { Card } from '../lib/supabase';

type PokeCardProps = {
  card: Card;
  size?: 'full' | 'mini';
  showShimmerBtn?: boolean;
  onClick?: () => void;
};

const RARITY_LABELS: Record<string, string> = {
  common: 'COMMON',
  silver: 'SILVER',
  'gold-rare': 'GOLD',
  prismatic: 'PRISMATIC',
};

const RARITY_ICONS: Record<string, string> = {
  common: '⭐', silver: '✦', 'gold-rare': '★', prismatic: '✦✦',
};

function PokeCard({ card, size = 'full', showShimmerBtn = false, onClick }: PokeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const holoRef = useRef<HTMLDivElement>(null);
  const [shimmering, setShimmering] = useState(false);

  // 3D tilt + holo
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el || size !== 'full') return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const rotY = (dx / (rect.width / 2)) * 14;
    const rotX = -(dy / (rect.height / 2)) * 10;
    el.style.transform = `rotateY(${rotY}deg) rotateX(${rotX}deg) scale(1.04)`;

    // Shadow direction
    const sx = -(dx / (rect.width / 2)) * 15;
    const sy = -(dy / (rect.height / 2)) * 15;
    el.style.boxShadow = getShadow(card.rarity, sx, sy);

    // Holo rotation
    if (holoRef.current) {
      const h = holoRef.current;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      h.style.transform = `rotate(${angle}deg)`;
    }
  }, [size, card.rarity]);

  const handleMouseLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el || size !== 'full') return;
    el.style.transform = 'rotateY(0deg) rotateX(0deg) scale(1)';
    el.style.boxShadow = getDefaultShadow(card.rarity);
  }, [size, card.rarity]);

  // Shimmer (touch)
  const handleShimmer = useCallback(() => {
    if (shimmering) return;
    setShimmering(true);
    setTimeout(() => setShimmering(false), 1600);
  }, [shimmering]);

  // Mini card
  if (size === 'mini') {
    const mcClass = card.rarity === 'prismatic' ? 'mc-prism'
      : card.rarity === 'gold-rare' ? 'mc-gold'
      : card.rarity === 'silver' ? 'mc-silver'
      : 'mc-common';
    const stars = generateStars(card.rarity, 8);
    return (
      <div className={`mini-card ${mcClass}`} onClick={onClick}>
        {stars.map((s, i) => (
          <span key={i} className="hstar" style={{ left: s.x, top: s.y, animationDelay: s.delay, color: s.color }}>✦</span>
        ))}
        <div className="mc-img">
          {card.image_url ? (
            <img src={card.image_url} alt={card.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : '🎭'}
        </div>
        <div className="mc-name">{card.card_name}</div>
        <div className="mc-rar">{RARITY_ICONS[card.rarity]}</div>
      </div>
    );
  }

  // Full card
  const defaultShadow = getDefaultShadow(card.rarity);
  const stars = generateStars(card.rarity, card.rarity === 'prismatic' ? 30 : 20);

  return (
    <div className="card-stage flex flex-col items-center">
      <div
        ref={cardRef}
        className={`poke-card ${shimmering ? 'shimmer-playing' : ''}`}
        data-rarity={card.rarity}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ boxShadow: defaultShadow }}
      >
        {/* Sparkle overlay */}
        <div className="card-sparkle" data-rarity={card.rarity} />

        {/* Holofoil layer */}
        <div className="holo-layer">
          <div className="holo-sheen" ref={holoRef} />
          <div className="holo-stars">
            {stars.map((s, i) => (
              <span
                key={i}
                className="holo-star"
                style={{
                  left: s.x, top: s.y,
                  fontSize: s.size,
                  color: s.color,
                  textShadow: `0 0 ${s.glow}px ${s.color}`,
                  animationDelay: s.delay,
                }}
              >
                ✦
              </span>
            ))}
          </div>
        </div>

        {/* Card content */}
        <div className="card-content">
          <div className="card-header">
            <span className="card-name">{card.card_name}</span>
            <span className="card-hp">{card.hp} HP</span>
          </div>

          <div className="card-img-box">
            {card.image_url ? (
              <img src={card.image_url} alt={card.card_name} />
            ) : (
              <span style={{ fontSize: 40 }}>🎭</span>
            )}
            <span className="card-type-badge">{card.type || 'SCHOLAR'}</span>
          </div>

          <div className="card-desc">{card.description}</div>

          <div className="card-stats">
            <div className="stat-box">
              <span className="stat-label">{card.stat1_name}</span>
              <span className="stat-val">{card.stat1_val}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">{card.stat2_name}</span>
              <span className="stat-val">{card.stat2_val}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">{card.stat3_name}</span>
              <span className="stat-val">{card.stat3_val}</span>
            </div>
          </div>

          <div className="card-move">
            <span className="move-name">{card.move1_name}</span>
            <span className="move-dmg">{card.move1_dmg}</span>
          </div>
          <div className="card-move">
            <span className="move-name">{card.move2_name}</span>
            <span className="move-dmg">{card.move2_dmg}</span>
          </div>

          <div className="card-footer">
            <span className="card-rarity-tag">{RARITY_LABELS[card.rarity] || 'COMMON'}</span>
            <span className="card-student-name">{card.students?.name || ''}</span>
          </div>
        </div>
      </div>

      {showShimmerBtn && (
        <button className="shimmer-btn" onClick={(e) => { e.stopPropagation(); handleShimmer(); }}>
          ✦ Shimmer ✦
        </button>
      )}
    </div>
  );
}

function getDefaultShadow(rarity: string): string {
  switch (rarity) {
    case 'prismatic': return '0 0 0 3px #c080ff, 0 8px 50px rgba(180,100,255,0.5), 0 0 30px rgba(255,150,255,0.2)';
    case 'gold-rare': return '0 0 0 3px #d4a017, 0 8px 40px rgba(212,160,23,0.35)';
    case 'silver': return '0 0 0 2px #7a9ab0, 0 8px 30px rgba(120,160,200,0.2)';
    default: return '0 8px 25px rgba(200,160,0,0.2)';
  }
}

function getShadow(rarity: string, sx: number, sy: number): string {
  const base = getDefaultShadow(rarity);
  return `${base}, ${sx}px ${sy}px 30px rgba(0,0,0,0.3)`;
}

function generateStars(rarity: string, count: number) {
  const colors: Record<string, string[]> = {
    common: ['#c8a000', '#ffe680', '#f0e097'],
    silver: ['#7a9ab0', '#c0d4e4', '#e0eaf2', '#d8e4ee'],
    'gold-rare': ['#c07800', '#ffe090', '#ffd060', '#ffdc80'],
    prismatic: ['#ffb3b3', '#ffd9a0', '#b3ffb3', '#a0e8ff', '#b3b3ff', '#e8b3ff'],
  };
  const palette = colors[rarity] || colors.common;
  return Array.from({ length: count }, () => ({
    x: `${5 + Math.random() * 90}%`,
    y: `${5 + Math.random() * 90}%`,
    size: 7 + Math.random() * 6,
    color: palette[Math.floor(Math.random() * palette.length)],
    glow: 4 + Math.random() * 6,
    delay: `${Math.random() * 2}s`,
  }));
}

export default PokeCard;

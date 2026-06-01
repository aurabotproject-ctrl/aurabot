import React, { useState, useEffect } from 'react';
import { sb } from '../lib/supabase';
import type { Session } from '../lib/auth';

// ── Re-export constants needed by PackOpeningOverlay ─────────────────
export const PACK_TYPES = [
  { id: 'xanimals',  label: 'Xanimals Pack',  subtitle: 'Crossed Animals!',         color: '#7c3aed', glow: '#a855f7', emoji: '🧬' },
  { id: 'animals',   label: 'Animals Pack',   subtitle: 'Real World Animals!',      color: '#16a34a', glow: '#22c55e', emoji: '🐾' },
  { id: 'creatures', label: 'Creatures Pack', subtitle: 'Magical & Mythical!',      color: '#0369a1', glow: '#38bdf8', emoji: '👾' },
  { id: 'humanoids', label: 'Humanoids Pack', subtitle: 'People & Warriors!',       color: '#b45309', glow: '#f59e0b', emoji: '🧑' },
  { id: 'robots',    label: 'Robots Pack',    subtitle: 'Mechanical & Futuristic!', color: '#374151', glow: '#9ca3af', emoji: '🤖' },
  { id: 'luckydip',  label: 'Lucky Dip Pack', subtitle: 'Mix of All Themes!',      color: '#be123c', glow: '#f43f5e', emoji: '🎲' },
];

const PACK_TIERS = [
  { id: 'basic',   label: 'Basic Pack',   stars: 5,  color: '#6366f1', desc: 'Mostly common cards' },
  { id: 'mod',     label: 'Mod Pack',     stars: 10, color: '#8b5cf6', desc: 'Better odds, more fun!' },
  { id: 'premium', label: 'Premium Pack', stars: 20, color: '#f59e0b', desc: 'Best odds for rare cards' },
];

const RARITY_ODDS: Record<string, { common: number; silver: number; 'gold-rare': number; prismatic: number }> = {
  basic:   { common: 0.70, silver: 0.22, 'gold-rare': 0.07, prismatic: 0.01 },
  mod:     { common: 0.45, silver: 0.35, 'gold-rare': 0.16, prismatic: 0.04 },
  premium: { common: 0.20, silver: 0.40, 'gold-rare': 0.30, prismatic: 0.10 },
};

const STAT_RANGES: Record<string, { hpMin: number; hpMax: number; weakMin: number; weakMax: number; strongMin: number; strongMax: number; skillPts: number }> = {
  common:      { hpMin: 80,  hpMax: 100, weakMin: 40, weakMax: 50,  strongMin: 50,  strongMax: 70,  skillPts: 1 },
  silver:      { hpMin: 100, hpMax: 120, weakMin: 50, weakMax: 60,  strongMin: 60,  strongMax: 80,  skillPts: 2 },
  'gold-rare': { hpMin: 120, hpMax: 140, weakMin: 60, weakMax: 75,  strongMin: 80,  strongMax: 100, skillPts: 3 },
  prismatic:   { hpMin: 150, hpMax: 180, weakMin: 75, weakMax: 95,  strongMin: 100, strongMax: 130, skillPts: 5 },
};

const TEST_ACCOUNTS = ['Bella Clark', 'Benji Clark'];

const UNLOCK_ITEMS = [
  { id: 'color',     label: 'New Bot Colour',  desc: 'Unlock extra colour for your AuraBot', emoji: '🎨', cost: 5 },
  { id: 'face',      label: 'Face Colour Pack', desc: 'Unlock a new face pixel colour palette', emoji: '✨', cost: 5 },
  { id: 'buildabot', label: 'Build-a-Bot',      desc: 'Unlock the full bot customisation studio', emoji: '🔧', cost: 5 },
];

function rollRarity(tier: string): 'common' | 'silver' | 'gold-rare' | 'prismatic' {
  const odds = RARITY_ODDS[tier] || RARITY_ODDS.basic;
  const r = Math.random();
  if (r < odds.prismatic) return 'prismatic';
  if (r < odds.prismatic + odds['gold-rare']) return 'gold-rare';
  if (r < odds.prismatic + odds['gold-rare'] + odds.silver) return 'silver';
  return 'common';
}

function rollStats(rarity: string) {
  const r = STAT_RANGES[rarity] || STAT_RANGES.common;
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  return { hp: rand(r.hpMin, r.hpMax), weakDmg: rand(r.weakMin, r.weakMax), strongDmg: rand(r.strongMin, r.strongMax), skillPts: r.skillPts };
}

interface OpenedCard {
  id: string; card_name: string; type: string;
  rarity: 'common' | 'silver' | 'gold-rare' | 'prismatic';
  description: string; image_url: string; hp: number;
  stat1_name: string; stat1_val: number;
  stat2_name: string; stat2_val: number;
  stat3_name: string; stat3_val: number;
  move1_name: string; move1_dmg: number;
  move2_name: string; move2_dmg: number;
  skill_points: number;
}

// ── Lazy import PokeCard to keep bundle separate ─────────────────────
import PokeCard from '../components/PokeCard';

export default function ShopPage({ session, onBack, onCardsAdded }: {
  session: NonNullable<Session>;
  onBack: () => void;
  onCardsAdded?: () => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [starPoints, setStarPoints] = useState<number | null>(null);
  const [packImages, setPackImages] = useState<Record<string, string>>({});
  const [unlockedChoices, setUnlockedChoices] = useState<string[]>([]);
  const [openingPack, setOpeningPack] = useState<typeof PACK_TYPES[0] | null>(null);
  const [msg, setMsg] = useState('');
  const [unlocking, setUnlocking] = useState<string | null>(null);

  const isTestAccount = TEST_ACCOUNTS.includes(studentName);

  useEffect(() => {
    (async () => {
      const profile = session.profile;
      setStudentName(profile.name || '');
      let sid = profile.student_id;
      if (!sid) {
        const { data } = await sb.from('students').select('id, teacher_id').eq('auth_user_id', session.user.id).maybeSingle();
        if (data) { sid = data.id; setTeacherId(data.teacher_id || ''); }
      }
      if (sid) {
        setStudentId(sid);
        const { data: starData } = await sb.from('student_star_points').select('points').eq('student_id', sid).maybeSingle();
        setStarPoints(starData?.points ?? 0);
        const { data: unlockData } = await sb.from('student_unlocks').select('choices').eq('student_id', sid).maybeSingle();
        setUnlockedChoices(unlockData?.choices || []);
      }
      const { data: imgs } = await sb.from('pack_images').select('pack_id, image_url');
      const map: Record<string, string> = {};
      (imgs || []).forEach((r: any) => { map[r.pack_id] = r.image_url; });
      setPackImages(map);
    })();
  }, [session]);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleUnlock = async (item: typeof UNLOCK_ITEMS[0]) => {
    if (!isTestAccount && (starPoints === null || starPoints < item.cost)) { showMsg(`Not enough ⭐ — need ${item.cost}`); return; }
    if (unlockedChoices.includes(item.id)) { showMsg('Already unlocked!'); return; }
    setUnlocking(item.id);
    try {
      await sb.from('student_star_points').update({ points: (starPoints || 0) - item.cost }).eq('student_id', studentId);
      setStarPoints(p => (p || 0) - item.cost);
      const newChoices = [...unlockedChoices, item.id];
      await sb.from('student_unlocks').upsert({ student_id: studentId, choices: newChoices }, { onConflict: 'student_id' });
      setUnlockedChoices(newChoices);
      showMsg(`✓ ${item.label} unlocked!`);
    } catch { showMsg('Error — try again'); }
    setUnlocking(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0d0f1a 0%,#141628 100%)', fontFamily: "'DM Sans', system-ui, sans-serif", color: 'white' }}>
      <style>{`
        @keyframes packFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .pack-card { transition: all 0.25s ease; }
        .pack-card:hover { transform: translateY(-4px) scale(1.02); }
      `}</style>

      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: '1rem', color: 'white', flexShrink: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: '1rem' }}>🛒 Shop & Trade</div>
          <div style={{ fontSize: '0.7rem', color: '#6070a0' }}>Spend your star points on card packs</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,200,50,0.12)', border: '1px solid rgba(255,200,50,0.25)', borderRadius: 20, padding: '6px 14px' }}>
          <span>⭐</span>
          <span style={{ fontWeight: 900, color: '#f59e0b' }}>{isTestAccount ? '∞' : (starPoints ?? '…')}</span>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        {msg && (
          <div style={{ background: msg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: msg.startsWith('✓') ? '#4ade80' : '#f87171', borderRadius: 12, padding: '10px 16px', fontSize: '0.84rem', fontWeight: 700 }}>
            {msg}
          </div>
        )}

        {/* ── Card Packs ── */}
        <div>
          <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5060a0', marginBottom: 14 }}>🃏 Card Packs — 5 ⭐ each • 3 cards per pack</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>
            {PACK_TYPES.map(pack => {
              const canBuy = isTestAccount || (starPoints !== null && starPoints >= 5);
              return (
                <div key={pack.id} className="pack-card">
                  <div style={{ borderRadius: 14, overflow: 'hidden', border: `2.5px solid ${pack.color}`, boxShadow: `0 8px 24px ${pack.glow}44`, background: `linear-gradient(160deg, ${pack.color}ee, ${pack.color}99)`, position: 'relative', aspectRatio: '3/4', cursor: 'pointer' }}
                    onClick={() => setOpeningPack(pack)}>
                    {packImages[pack.id] ? (
                      <>
                        <img src={packImages[pack.id]} alt={pack.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7))' }} />
                        <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, textAlign: 'center' }}>
                          <div style={{ fontSize: '0.62rem', fontWeight: 900, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{pack.label}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: 'rgba(255,255,255,0.15)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, padding: 10 }}>
                          <div style={{ fontSize: '0.55rem', fontWeight: 900, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.08em', textAlign: 'center' }}>COLLECTOR CARDS</div>
                          <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '3px 6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: 900, color: pack.id === 'luckydip' ? '#ffd700' : 'white', textTransform: 'uppercase' }}>{pack.label.replace(' Pack', '')}</div>
                            <div style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.7)' }}>{pack.subtitle}</div>
                          </div>
                          <div style={{ fontSize: '2.5rem', animation: 'packFloat 3s ease-in-out infinite' }}>{pack.emoji}</div>
                        </div>
                      </>
                    )}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', padding: '4px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.4rem', fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em' }}>COLLECT • TRADE • BATTLE</div>
                    </div>
                  </div>
                  <button disabled={!canBuy}
                    onClick={() => setOpeningPack(pack)}
                    style={{ width: '100%', marginTop: 8, padding: '7px 0', borderRadius: 10, border: 'none', background: canBuy ? `linear-gradient(135deg,${pack.color},${pack.glow})` : 'rgba(60,60,80,0.5)', color: canBuy ? 'white' : '#5060a0', fontWeight: 800, fontSize: '0.72rem', cursor: canBuy ? 'pointer' : 'not-allowed' }}>
                    {canBuy ? '⭐ 5 pts — Buy' : '⭐ Need 5 pts'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Unlocks ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24 }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5060a0', marginBottom: 14 }}>🔓 Unlocks — 5 ⭐ each</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {UNLOCK_ITEMS.map(item => {
              const owned = unlockedChoices.includes(item.id);
              const canAfford = isTestAccount || (starPoints !== null && starPoints >= item.cost);
              return (
                <div key={item.id} style={{ flex: '1', minWidth: 160, background: owned ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${owned ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.4rem' }}>{item.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.82rem', color: owned ? '#4ade80' : 'white' }}>{item.label}</div>
                      <div style={{ fontSize: '0.68rem', color: '#5060a0', lineHeight: 1.3 }}>{item.desc}</div>
                    </div>
                  </div>
                  <button disabled={owned || unlocking === item.id || (!isTestAccount && !canAfford)}
                    onClick={() => handleUnlock(item)}
                    style={{ width: '100%', padding: '7px 0', borderRadius: 9, border: 'none', fontWeight: 800, fontSize: '0.76rem', cursor: owned || (!isTestAccount && !canAfford) ? 'not-allowed' : 'pointer', background: owned ? 'rgba(34,197,94,0.15)' : canAfford ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'rgba(60,60,80,0.5)', color: owned ? '#4ade80' : canAfford ? 'white' : '#5060a0' }}>
                    {owned ? '✓ Owned' : unlocking === item.id ? '…' : `⭐ ${item.cost} — Unlock`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Trade ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24 }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5060a0', marginBottom: 14 }}>🔄 Trade Cards</div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔄</div>
            <div style={{ fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>Coming Soon</div>
            <div style={{ fontSize: '0.76rem', color: '#5060a0', lineHeight: 1.5 }}>Soon you'll be able to swap cards with classmates.</div>
          </div>
        </div>
      </div>

      {/* Pack Opening Overlay */}
      {openingPack && (
        <PackOpeningOverlay
          pack={openingPack}
          packImage={packImages[openingPack.id] || null}
          starPoints={starPoints || 0}
          isTestAccount={isTestAccount}
          studentId={studentId}
          teacherId={teacherId}
          onClose={() => setOpeningPack(null)}
          onStarsSpent={amt => setStarPoints(p => (p || 0) - amt)}
          onComplete={() => { setOpeningPack(null); onCardsAdded?.(); onBack(); }}
        />
      )}
    </div>
  );
}

// ── Pack Opening Overlay (self-contained) ─────────────────────────────
type OpenPhase = 'tiers' | 'confirm' | 'zoom' | 'tear' | 'reveal' | 'done';

function PackOpeningOverlay({ pack, packImage, starPoints, isTestAccount, studentId, teacherId, onClose, onComplete, onStarsSpent }: {
  pack: typeof PACK_TYPES[0]; packImage: string | null;
  starPoints: number; isTestAccount: boolean;
  studentId: string; teacherId: string;
  onClose: () => void; onComplete: (cards: OpenedCard[]) => void;
  onStarsSpent: (amt: number) => void;
}) {
  const [phase, setPhase] = useState<OpenPhase>('tiers');
  const [selectedTier, setSelectedTier] = useState<typeof PACK_TIERS[0] | null>(null);
  const [openedCards, setOpenedCards] = useState<OpenedCard[]>([]);
  const [slottedCards, setSlottedCards] = useState<(OpenedCard | null)[]>([null, null, null]);
  const [saving, setSaving] = useState(false);
  const [tearProgress, setTearProgress] = useState(0);
  const [tearComplete, setTearComplete] = useState(false);
  const [slideY, setSlideY] = useState(0);
  const [sliding, setSliding] = useState(false);
  const [cardPositions, setCardPositions] = useState([0, 0, 0]);
  const [cardSwiped, setCardSwiped] = useState([false, false, false]);
  const tearStartX = React.useRef(0);
  const tearStarted = React.useRef(false);
  const swipeDragIdx = React.useRef(-1);
  const swipeStartY = React.useRef(0);

  const rarityGlow: Record<string, string> = { common: 'rgba(156,163,175,0.5)', silver: 'rgba(148,163,184,0.7)', 'gold-rare': 'rgba(245,158,11,0.8)', prismatic: 'rgba(168,85,247,0.9)' };

  const handleConfirm = async () => {
    if (!selectedTier) return;
    if (!isTestAccount) {
      await sb.from('student_star_points').update({ points: starPoints - selectedTier.stars }).eq('student_id', studentId);
      onStarsSpent(selectedTier.stars);
    }
    const { data: dbCards } = await sb.from('card_database').select('*').limit(100);
    const pool = (dbCards || []).filter((c: any) => pack.id === 'luckydip' || c.type === pack.id);
    const allCards = dbCards || [];
    const rolled: OpenedCard[] = [];
    for (let i = 0; i < 3; i++) {
      const rarity = rollRarity(selectedTier.id);
      const stats = rollStats(rarity);
      const src = (pool.length > 0 ? pool : allCards)[Math.floor(Math.random() * (pool.length > 0 ? pool.length : allCards.length))] as any;
      rolled.push({ id: `opened-${Date.now()}-${i}`, card_name: src?.card_name || 'Mystery Card', type: src?.type || pack.id, rarity, description: src?.description || '', image_url: src?.image_url || '', hp: stats.hp, stat1_name: 'HP', stat1_val: stats.hp, stat2_name: src?.move1_name || 'Attack', stat2_val: stats.weakDmg, stat3_name: src?.move2_name || 'Power', stat3_val: stats.strongDmg, move1_name: src?.move1_name || 'Attack', move1_dmg: stats.weakDmg, move2_name: src?.move2_name || 'Power', move2_dmg: stats.strongDmg, skill_points: stats.skillPts });
    }
    setOpenedCards(rolled);
    setPhase('zoom');
    setTimeout(() => setPhase('tear'), 1200);
  };

  const onTearStart = (x: number) => { if (tearComplete) return; tearStartX.current = x; tearStarted.current = true; };
  const onTearMove = (x: number) => { if (!tearStarted.current || tearComplete) return; const p = Math.min(Math.max((x - tearStartX.current) / 280, 0), 1); setTearProgress(p); if (p >= 1) { setTearComplete(true); tearStarted.current = false; } };
  const onTearEnd = () => { tearStarted.current = false; };
  const onSlideStart = (y: number) => { if (!tearComplete || sliding) return; setSliding(true); swipeStartY.current = y; };
  const onSlideMove = (y: number) => { if (!sliding) return; const dy = Math.max(0, y - swipeStartY.current); setSlideY(dy); if (dy > 220) { setSliding(false); setPhase('reveal'); } };
  const onSlideEnd = () => { if (slideY < 220) setSlideY(0); setSliding(false); };
  const onCardSwipeStart = (idx: number, y: number) => { if (cardSwiped[idx]) return; swipeDragIdx.current = idx; swipeStartY.current = y; };
  const onCardSwipeMove = (y: number) => { const idx = swipeDragIdx.current; if (idx < 0 || cardSwiped[idx]) return; const dy = Math.max(0, y - swipeStartY.current); setCardPositions(prev => prev.map((p, i) => i === idx ? dy : p)); if (dy > 160) { setCardSwiped(prev => prev.map((s, i) => i === idx ? true : s)); setSlottedCards(prev => { const n = [...prev]; n[idx] = openedCards[idx]; return n; }); swipeDragIdx.current = -1; } };
  const onCardSwipeEnd = () => { const idx = swipeDragIdx.current; if (idx >= 0 && !cardSwiped[idx]) setCardPositions(prev => prev.map((p, i) => i === idx ? 0 : p)); swipeDragIdx.current = -1; };

  const allSwiped = cardSwiped.every(Boolean);

  const handleAddToCollection = async () => {
    setSaving(true);
    try {
      for (const card of openedCards) {
        await sb.from('cards').insert({ student_id: studentId, teacher_id: teacherId, card_name: card.card_name, type: card.type, rarity: card.rarity, description: card.description, image_url: card.image_url, hp: card.hp, stat1_name: card.stat1_name, stat1_val: card.stat1_val, stat2_name: card.stat2_name, stat2_val: card.stat2_val, stat3_name: card.stat3_name, stat3_val: card.stat3_val, move1_name: card.move1_name, move1_dmg: card.move1_dmg, move2_name: card.move2_name, move2_dmg: card.move2_dmg, card_source: 'pack' });
      }
      onComplete(openedCards);
    } catch (err: any) { alert('Error: ' + err.message); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,20,0.97)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      onMouseMove={e => { if (phase === 'tear') { onTearMove(e.clientX); onSlideMove(e.clientY); } if (phase === 'reveal') onCardSwipeMove(e.clientY); }}
      onMouseUp={() => { onTearEnd(); onSlideEnd(); onCardSwipeEnd(); }}
      onTouchMove={e => { const t = e.touches[0]; if (phase === 'tear') { onTearMove(t.clientX); onSlideMove(t.clientY); } if (phase === 'reveal') onCardSwipeMove(t.clientY); }}
      onTouchEnd={() => { onTearEnd(); onSlideEnd(); onCardSwipeEnd(); }}
    >
      <style>{`
        @keyframes packZoomIn { from{transform:scale(0.6);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes cardFlyUp { from{transform:translateY(120px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 8px 32px rgba(124,58,237,0.4)} 50%{box-shadow:0 8px 60px rgba(124,58,237,0.8)} }
      `}</style>

      {phase !== 'reveal' && (
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', zIndex: 10 }}>✕</button>
      )}

      {/* TIERS */}
      {phase === 'tiers' && (
        <div style={{ width: '100%', maxWidth: 480, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', marginBottom: 4 }}>{pack.label}</div>
            <div style={{ fontSize: '0.8rem', color: '#8080c0' }}>Choose your pack tier</div>
          </div>
          {PACK_TIERS.map((tier, i) => {
            const canBuy = isTestAccount || starPoints >= tier.stars;
            return (
              <div key={tier.id} onClick={() => canBuy && (setSelectedTier(tier), setPhase('confirm'))}
                style={{ background: canBuy ? `${tier.color}18` : 'rgba(255,255,255,0.02)', border: `2px solid ${canBuy ? tier.color + '66' : 'rgba(255,255,255,0.06)'}`, borderRadius: 16, padding: '16px 20px', cursor: canBuy ? 'pointer' : 'not-allowed', opacity: canBuy ? 1 : 0.45, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 900, color: 'white', fontSize: '0.9rem', marginBottom: 4 }}>{['⭐','⭐⭐','⭐⭐⭐'][i]} {tier.label}</div>
                  <div style={{ fontSize: '0.7rem', color: '#7080a0' }}>{tier.desc}</div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                    {Object.entries(RARITY_ODDS[tier.id]).map(([r, v]) => (
                      <span key={r} style={{ fontSize: '0.58rem', padding: '2px 6px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: r === 'prismatic' ? '#c084fc' : r === 'gold-rare' ? '#fbbf24' : r === 'silver' ? '#94a3b8' : '#9ca3af', fontWeight: 700 }}>
                        {r === 'gold-rare' ? 'Gold' : r.charAt(0).toUpperCase() + r.slice(1)}: {(v * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: tier.color }}>⭐{tier.stars}</div>
                  <div style={{ fontSize: '0.6rem', color: '#5060a0' }}>star pts</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONFIRM */}
      {phase === 'confirm' && selectedTier && (
        <div style={{ width: '100%', maxWidth: 340, padding: 28, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 10 }}>🛒</div>
          <div style={{ fontWeight: 900, color: 'white', fontSize: '1.05rem', marginBottom: 6 }}>Confirm Purchase</div>
          <div style={{ fontSize: '0.82rem', color: '#8090b0', marginBottom: 20, lineHeight: 1.6 }}>
            <strong style={{ color: 'white' }}>{pack.label} — {selectedTier.label}</strong><br />
            Cost: <strong style={{ color: '#f59e0b' }}>⭐ {selectedTier.stars}</strong><br />
            {!isTestAccount && <span>Remaining: <strong style={{ color: '#a78bfa' }}>⭐ {starPoints - selectedTier.stars}</strong></span>}
            {isTestAccount && <span style={{ color: '#4ade80', fontSize: '0.72rem' }}>✦ Test account — free!</span>}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => setPhase('tiers')} style={{ padding: '10px 22px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#8090b0', cursor: 'pointer', fontWeight: 700 }}>Back</button>
            <button onClick={handleConfirm} style={{ padding: '10px 26px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${selectedTier.color},${selectedTier.color}bb)`, color: 'white', cursor: 'pointer', fontWeight: 900, fontSize: '0.88rem' }}>Open Pack! 🎉</button>
          </div>
        </div>
      )}

      {/* ZOOM */}
      {phase === 'zoom' && selectedTier && (
        <div style={{ animation: 'packZoomIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
          <div style={{ width: 220, aspectRatio: '3/4', borderRadius: 18, overflow: 'hidden', border: `3px solid ${selectedTier.color}`, boxShadow: `0 0 60px ${selectedTier.color}88` }}>
            {packImage ? <img src={packImage} alt="pack" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: `linear-gradient(160deg,${pack.color}ee,${pack.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>{pack.emoji}</div>}
          </div>
        </div>
      )}

      {/* TEAR */}
      {phase === 'tear' && selectedTier && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ color: '#8090b0', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>
            {!tearComplete ? '👆 Drag across the top to tear open' : '👇 Slide the pack down'}
          </div>
          <div style={{ position: 'relative', width: 220, userSelect: 'none' }}>
            {tearProgress > 0 && <div style={{ position: 'absolute', top: -36, left: 0, right: 0, height: 54, background: `linear-gradient(160deg,${pack.color}cc,${pack.color}88)`, borderRadius: '18px 18px 0 0', transform: `rotate(${tearProgress * -15}deg) translateX(${tearProgress * 20}px)`, opacity: 1 - tearProgress * 0.3, zIndex: 2, borderBottom: tearProgress > 0.1 ? '2px dashed rgba(255,255,255,0.4)' : 'none' }} />}
            <div style={{ width: 220, aspectRatio: '3/4', borderRadius: tearComplete ? '0 0 18px 18px' : 18, overflow: 'hidden', border: `3px solid ${selectedTier.color}`, boxShadow: `0 0 40px ${selectedTier.color}66`, transform: `translateY(${slideY}px)`, transition: sliding ? 'none' : 'transform 0.3s', cursor: tearComplete ? 'grab' : 'crosshair' }}
              onMouseDown={e => tearComplete ? onSlideStart(e.clientY) : onTearStart(e.clientX)}
              onTouchStart={e => { const t = e.touches[0]; tearComplete ? onSlideStart(t.clientY) : onTearStart(t.clientX); }}>
              {packImage ? <img src={packImage} alt="pack" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: `linear-gradient(160deg,${pack.color}ee,${pack.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>{pack.emoji}</div>}
            </div>
            {!tearComplete && (
              <div style={{ position: 'absolute', top: 28, left: 0, right: 0, height: 4, zIndex: 3, cursor: 'crosshair' }}
                onMouseDown={e => onTearStart(e.clientX)} onTouchStart={e => onTearStart(e.touches[0].clientX)}>
                <div style={{ height: '100%', background: `linear-gradient(90deg,${selectedTier.color},white)`, width: `${tearProgress * 100}%`, boxShadow: '0 0 8px white', borderRadius: 2 }} />
                <div style={{ position: 'absolute', inset: 0, borderTop: '2px dashed rgba(255,255,255,0.3)' }} />
              </div>
            )}
          </div>
          {!tearComplete && (
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: 10 }).map((_, i) => <div key={i} style={{ width: 20, height: 4, borderRadius: 2, background: i < tearProgress * 10 ? selectedTier.color : 'rgba(255,255,255,0.1)' }} />)}
            </div>
          )}
        </div>
      )}

      {/* REVEAL */}
      {phase === 'reveal' && (
        <div style={{ width: '100%', maxWidth: 560, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ textAlign: 'center', color: '#8090b0', fontSize: '0.78rem', fontWeight: 700 }}>
            {allSwiped ? '✦ All cards collected!' : '👇 Swipe each card down to your slots'}
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {openedCards.map((card, idx) => (
              <div key={idx} style={{ flexShrink: 0, opacity: cardSwiped[idx] ? 0 : 1, transform: `translateY(${cardPositions[idx]}px)`, transition: swipeDragIdx.current === idx ? 'none' : 'transform 0.3s, opacity 0.3s', animation: `cardFlyUp 0.6s ${idx * 0.15}s cubic-bezier(0.34,1.56,0.64,1) both`, cursor: cardSwiped[idx] ? 'default' : 'grab', userSelect: 'none', filter: `drop-shadow(0 0 16px ${rarityGlow[card.rarity]})` }}
                onMouseDown={e => onCardSwipeStart(idx, e.clientY)} onTouchStart={e => onCardSwipeStart(idx, e.touches[0].clientY)}>
                <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center', marginBottom: '-100px' }}>
                  <PokeCard card={{ id: card.id, student_id: '', teacher_id: '', card_name: card.card_name, hp: card.hp, type: card.type, rarity: card.rarity, description: card.description, stat1_name: card.stat1_name, stat1_val: card.stat1_val, stat2_name: card.stat2_name, stat2_val: card.stat2_val, stat3_name: card.stat3_name, stat3_val: card.stat3_val, move1_name: card.move1_name, move1_dmg: card.move1_dmg, move2_name: card.move2_name, move2_dmg: card.move2_dmg, image_url: card.image_url, created_at: '' }} />
                </div>
                {!cardSwiped[idx] && <div style={{ textAlign: 'center', fontSize: '1.4rem', color: 'white', marginTop: 4, animation: 'shimmer 1.5s infinite' }}>↓</div>}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            {slottedCards.map((card, idx) => (
              <div key={idx} style={{ flexShrink: 0 }}>
                {card ? (
                  <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center', marginBottom: '-100px', filter: `drop-shadow(0 0 16px ${rarityGlow[card.rarity]})`, animation: 'packZoomIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
                    <PokeCard card={{ id: card.id, student_id: '', teacher_id: '', card_name: card.card_name, hp: card.hp, type: card.type, rarity: card.rarity, description: card.description, stat1_name: card.stat1_name, stat1_val: card.stat1_val, stat2_name: card.stat2_name, stat2_val: card.stat2_val, stat3_name: card.stat3_name, stat3_val: card.stat3_val, move1_name: card.move1_name, move1_dmg: card.move1_dmg, move2_name: card.move2_name, move2_dmg: card.move2_dmg, image_url: card.image_url, created_at: '' }} />
                  </div>
                ) : (
                  <div style={{ width: 180, height: 252, borderRadius: 16, border: '2px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 6 }}>🃏</div>Slot {idx + 1}
                  </div>
                )}
              </div>
            ))}
          </div>
          {allSwiped && (
            <button onClick={handleAddToCollection} disabled={saving}
              style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', color: 'white', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', marginTop: 16, animation: 'glowPulse 2s infinite' }}>
              {saving ? 'Saving…' : '✦ Add Cards to Collection ✦'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

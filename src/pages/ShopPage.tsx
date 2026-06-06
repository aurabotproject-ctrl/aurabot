import { useState, useEffect } from 'react';
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
  { id: 'color',     label: 'Unlock Grape & Ocean',    desc: 'Adds 2 new bot colours: Grape purple & Ocean teal', emoji: '🎨', cost: 5 },
  { id: 'color2',    label: 'Unlock Gold & Silver',    desc: 'Adds shiny Gold & Silver bot colours ✨',            emoji: '⭐', cost: 10 },
  { id: 'color3',    label: 'Unlock Rainbow & Black Chrome', desc: 'Adds the rare Rainbow & Black Chrome bots 🌈🖤', emoji: '💎', cost: 20 },
  { id: 'face',      label: 'Face Colour Pack',         desc: 'Unlock a new face pixel colour palette',            emoji: '✨', cost: 5 },
  { id: 'buildabot', label: 'Build-a-Bot',              desc: 'Unlock the full bot customisation studio',          emoji: '🔧', cost: 5 },
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
      
      // Get student row - try profile.student_id first, then lookup by auth_user_id
      let sid = profile.student_id;
      let tid = '';
      if (!sid) {
        const { data } = await sb.from('students')
          .select('id, teacher_id')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();
        if (data) { sid = data.id; tid = data.teacher_id || ''; }
      } else {
        const { data } = await sb.from('students')
          .select('teacher_id')
          .eq('id', sid)
          .maybeSingle();
        if (data) tid = data.teacher_id || '';
      }

      console.log('ShopPage loaded studentId:', sid, 'teacherId:', tid);

      if (sid) {
        setStudentId(sid);
        setTeacherId(tid);

        const { data: starData } = await sb.from('student_star_points')
          .select('points').eq('student_id', sid).maybeSingle();
        setStarPoints(starData?.points ?? 0);

        // student_unlocks uses unlock_key rows, not a choices array
        const { data: unlockData } = await sb.from('student_unlocks')
          .select('unlock_key').eq('student_id', sid);
        setUnlockedChoices((unlockData || []).map((r: any) => r.unlock_key));
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
      // Insert unlock_key row
      await sb.from('student_unlocks').upsert({ student_id: studentId, unlock_key: item.id });
      setUnlockedChoices(prev => [...prev, item.id]);
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
          onComplete={() => { setOpeningPack(null); onCardsAdded?.(); }}
        />
      )}
    </div>
  );
}

// ── Pack Opening Overlay (self-contained) ─────────────────────────────
type OpenPhase = 'tiers' | 'confirm' | 'zoom' | 'tear' | 'reveal';

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
  const [loadingCards, setLoadingCards] = useState(false);
  // Tear state
  const [torn, setTorn] = useState(false);
  const [topY, setTopY] = useState(0);    // top piece flies up
  const [botY, setBotY] = useState(0);    // bottom piece falls down
  // Card swipe state
  const [cardSwiped, setCardSwiped] = useState([false, false, false]);

  const rarityGlow: Record<string, string> = {
    common: 'rgba(156,163,175,0.5)', silver: 'rgba(148,163,184,0.7)',
    'gold-rare': 'rgba(245,158,11,0.8)', prismatic: 'rgba(168,85,247,0.9)',
  };

  const handleConfirm = async () => {
    if (!selectedTier) return;
    setLoadingCards(true);
    if (!isTestAccount) {
      await sb.from('student_star_points').update({ points: starPoints - selectedTier.stars }).eq('student_id', studentId);
      onStarsSpent(selectedTier.stars);
    }
    const fetchWithTimeout = Promise.race([
      sb.from('card_database')
        .select('id, card_name, type, description, image_url, move1_name, move2_name')
        .limit(50),
      new Promise<{data: null}>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    ]);
    
    let dbCards: any[] = [];
    try {
      const result = await fetchWithTimeout as any;
      dbCards = result.data || [];
    } catch {
      dbCards = [];
    }
    const pool = dbCards.filter((c: any) => pack.id === 'luckydip' || c.type === pack.id);
    const src = (pool.length >= 3 ? pool : dbCards) as any[];
    const shuffled = [...src].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 3);
    const rolled: OpenedCard[] = [];
    for (let i = 0; i < 3; i++) {
      const rarity = rollRarity(selectedTier.id);
      const stats = rollStats(rarity);
      const card = picked[i] || null;
      rolled.push({
        id: `opened-${Date.now()}-${i}`,
        card_name: card?.card_name || 'Mystery Card', type: card?.type || pack.id, rarity,
        description: card?.description || '', image_url: card?.image_url || '', hp: stats.hp,
        stat1_name: 'HP', stat1_val: stats.hp,
        stat2_name: card?.move1_name || 'Attack', stat2_val: stats.weakDmg,
        stat3_name: card?.move2_name || 'Power',  stat3_val: stats.strongDmg,
        move1_name: card?.move1_name || 'Attack', move1_dmg: stats.weakDmg,
        move2_name: card?.move2_name || 'Power',  move2_dmg: stats.strongDmg,
        skill_points: stats.skillPts,
      });
    }
    setOpenedCards(rolled);
    setLoadingCards(false);
    setPhase('zoom');
    setTimeout(() => setPhase('tear'), 1000);
  };

  // Click the top zone → animate tear open
  const handleTear = () => {
    if (torn) return;
    setTorn(true);
    // Animate top flying up, bottom falling down
    let frame = 0;
    const animate = () => {
      frame++;
      setTopY(prev => prev - 18);
      setBotY(prev => prev + 14);
      if (frame < 25) requestAnimationFrame(animate);
      else {
        setTimeout(() => setPhase('reveal'), 200);
      }
    };
    requestAnimationFrame(animate);
  };

  // Card swipe handlers
  const onCardClick = (idx: number) => {
    const isTop = !cardSwiped[idx] && cardSwiped.slice(0, idx).every(Boolean);
    if (!isTop) return;
    setCardSwiped(prev => prev.map((s, i) => i === idx ? true : s));
    setSlottedCards(prev => { const n = [...prev]; n[idx] = openedCards[idx]; return n; });
  };

  const allSwiped = cardSwiped.every(Boolean);

  const handleAddToCollection = async () => {
    setSaving(true);
    try {
      console.log('Saving cards:', { studentId, teacherId, cardCount: openedCards.length });
      for (const card of openedCards) {
        console.log('Inserting card:', card.card_name, 'student_id:', studentId);
        const { data, error } = await sb.from('cards').insert({
          student_id: studentId,
          teacher_id: teacherId || null,
          card_name: card.card_name,
          type: card.type,
          rarity: card.rarity,
          description: card.description,
          image_url: card.image_url,
          hp: card.hp,
          stat1_name: card.stat1_name, stat1_val: card.stat1_val,
          stat2_name: card.stat2_name, stat2_val: card.stat2_val,
          stat3_name: card.stat3_name, stat3_val: card.stat3_val,
          move1_name: card.move1_name, move1_dmg: card.move1_dmg,
          move2_name: card.move2_name, move2_dmg: card.move2_dmg,
          card_source: 'pack',
        }).select();
        console.log('Result:', { data, error });
        if (error) throw error;
      }
      onComplete(openedCards);
    } catch (err: any) {
      console.error('Save error:', err);
      alert('Error saving cards: ' + (err.message || err.code || JSON.stringify(err)));
    }
    setSaving(false);
  };

  const TEAR_LINE = 0.27; // 27% from top is the tear line

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,20,0.97)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      <style>{`
        @keyframes packZoomIn { from{transform:scale(0.6);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes cardFlyUp { from{transform:translateY(100px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 8px 32px rgba(124,58,237,0.4)} 50%{box-shadow:0 8px 60px rgba(124,58,237,0.8)} }
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .tearzone-top:hover { background: rgba(255,255,255,0.08) !important; }
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
            <button onClick={() => setPhase('tiers')} disabled={loadingCards} style={{ padding: '10px 22px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#8090b0', cursor: 'pointer', fontWeight: 700 }}>Back</button>
            <button onClick={handleConfirm} disabled={loadingCards} style={{ padding: '10px 26px', borderRadius: 12, border: 'none', background: loadingCards ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg,${selectedTier.color},${selectedTier.color}bb)`, color: 'white', cursor: loadingCards ? 'not-allowed' : 'pointer', fontWeight: 900, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              {loadingCards ? (
                <>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Preparing cards…
                </>
              ) : 'Open Pack! 🎉'}
            </button>
          </div>
        </div>
      )}

      {/* ZOOM IN */}
      {phase === 'zoom' && selectedTier && (
        <div style={{ animation: 'packZoomIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
          <div style={{ width: 240, aspectRatio: '3/4', borderRadius: 18, overflow: 'hidden', border: `3px solid ${selectedTier.color}`, boxShadow: `0 0 60px ${selectedTier.color}88` }}>
            {packImage
              ? <img src={packImage} alt="pack" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: `linear-gradient(160deg,${pack.color}ee,${pack.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>{pack.emoji}</div>
            }
          </div>
        </div>
      )}

      {/* TEAR — click top zone to open */}
      {phase === 'tear' && selectedTier && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {!torn && (
            <div style={{ color: '#8090b0', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>
              👆 Tap the top of the pack to tear it open
            </div>
          )}

          {/* Pack split into top and bottom halves */}
          <div style={{ position: 'relative', width: 240, height: 336 }}>

            {/* TOP half — flies up when torn */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${TEAR_LINE * 100}%`, overflow: 'hidden', transform: `translateY(${topY}px)`, transition: torn ? 'none' : 'transform 0.1s', zIndex: torn ? 2 : 3, cursor: torn ? 'default' : 'pointer', borderRadius: '18px 18px 0 0' }}
              onClick={handleTear}
              className="tearzone-top"
            >
              <div style={{ width: '100%', height: `${100 / TEAR_LINE}%`, borderRadius: 18, overflow: 'hidden', border: `3px solid ${selectedTier.color}`, boxShadow: `0 0 40px ${selectedTier.color}66` }}>
                {packImage
                  ? <img src={packImage} alt="pack top" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                  : <div style={{ width: '100%', height: '100%', background: `linear-gradient(160deg,${pack.color}ee,${pack.color}88)`, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 16 }}>
                      <span style={{ fontSize: '1.5rem', opacity: 0.6 }}>{pack.emoji}</span>
                    </div>
                }
                {/* Hover hint overlay on top half */}
                {!torn && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                    <span style={{ fontSize: '1.2rem', animation: 'shimmer 1.5s infinite' }}>✂️</span>
                  </div>
                )}
              </div>
              {/* Dotted tear line at bottom of top piece */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderBottom: '3px dashed rgba(255,255,255,0.7)', zIndex: 4 }} />
            </div>

            {/* BOTTOM half — falls down when torn */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: `${(1 - TEAR_LINE) * 100}%`, overflow: 'hidden', transform: `translateY(${botY}px)`, transition: torn ? 'none' : 'transform 0.1s', borderRadius: '0 0 18px 18px' }}>
              <div style={{ width: '100%', height: `${100 / (1 - TEAR_LINE)}%`, position: 'absolute', bottom: 0, left: 0, borderRadius: 18, overflow: 'hidden', border: `3px solid ${selectedTier.color}`, boxShadow: `0 0 40px ${selectedTier.color}66` }}>
                {packImage
                  ? <img src={packImage} alt="pack bottom" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'bottom' }} />
                  : <div style={{ width: '100%', height: '100%', background: `linear-gradient(160deg,${pack.color}88,${pack.color}55)`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 16 }}>
                      <span style={{ fontSize: '2rem' }}>{pack.emoji}</span>
                    </div>
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVEAL — cards stacked, swipe each down to slot */}
      {phase === 'reveal' && (
        <div style={{ width: '100%', maxWidth: 600, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}
        >
          {/* Add Cards button — sits at top, activates when all swiped */}
          <button onClick={allSwiped ? handleAddToCollection : undefined} disabled={saving}
            style={{ width: '100%', maxWidth: 400, padding: '14px', borderRadius: 14, border: 'none', background: allSwiped ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'rgba(80,60,120,0.3)', color: allSwiped ? 'white' : 'rgba(255,255,255,0.25)', fontWeight: 900, fontSize: '1rem', cursor: allSwiped ? 'pointer' : 'default', animation: allSwiped ? 'glowPulse 2s infinite' : 'none', transition: 'all 0.4s', borderWidth: 1, borderStyle: 'solid', borderColor: allSwiped ? 'transparent' : 'rgba(255,255,255,0.08)' }}>
            {saving ? 'Saving…' : allSwiped ? '✦ Add Cards to Collection ✦' : '👆 Tap each card to collect it'}
          </button>

          {/* Stacked cards + slots side by side */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>

            {/* Left: stacked draggable cards */}
            <div style={{ position: 'relative', width: 180, height: 252, flexShrink: 0 }}>
              {openedCards.map((card, idx) => {
                const isTop = !cardSwiped[idx] && cardSwiped.slice(0, idx).every(Boolean);
                return (
                  <div key={idx}
                    style={{ position: 'absolute', top: idx * 6, left: idx * 3, width: '100%', zIndex: openedCards.length - idx, transform: `translateY(${cardSwiped[idx] ? 600 : 0}px) rotate(${cardSwiped[idx] ? 0 : (idx - 1) * 2}deg)`, transition: 'transform 0.45s cubic-bezier(0.4,0,1,1), opacity 0.4s', opacity: cardSwiped[idx] ? 0 : 1, cursor: isTop ? 'pointer' : 'default', filter: `drop-shadow(0 0 ${isTop ? 20 : 6}px ${rarityGlow[card.rarity]})`, animation: `cardFlyUp 0.5s ${idx * 0.1}s both` }}
                    onClick={() => onCardClick(idx)}
                  >
                    <div style={{ transform: 'scale(0.72)', transformOrigin: 'top left', width: 250 }}>
                      <PokeCard card={{ id: card.id, student_id: '', teacher_id: '', card_name: card.card_name, hp: card.hp, type: card.type, rarity: card.rarity, description: card.description, stat1_name: card.stat1_name, stat1_val: card.stat1_val, stat2_name: card.stat2_name, stat2_val: card.stat2_val, stat3_name: card.stat3_name, stat3_val: card.stat3_val, move1_name: card.move1_name, move1_dmg: card.move1_dmg, move2_name: card.move2_name, move2_dmg: card.move2_dmg, image_url: card.image_url, created_at: '' }} />
                    </div>
                    {isTop && <div style={{ position: 'absolute', bottom: -26, left: 0, right: 0, textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, animation: 'shimmer 1s infinite', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}>👆 TAP</div>}
                  </div>
                );
              })}
            </div>

            {/* Right: 3 slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
              {slottedCards.map((card, idx) => (
                <div key={idx} style={{ width: 130, height: 74, borderRadius: 10, border: `2px dashed ${card ? rarityGlow[card.rarity] : 'rgba(255,255,255,0.12)'}`, background: card ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', overflow: 'hidden', position: 'relative' }}>
                  {card ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', width: '100%' }}>
                      {card.image_url
                        ? <img src={card.image_url} alt={card.card_name} style={{ width: 40, height: 30, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                        : <div style={{ width: 40, height: 30, background: 'rgba(255,255,255,0.05)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🃏</div>
                      }
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.65rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.card_name}</div>
                        <div style={{ fontSize: '0.55rem', color: card.rarity === 'prismatic' ? '#c084fc' : card.rarity === 'gold-rare' ? '#fbbf24' : card.rarity === 'silver' ? '#94a3b8' : '#9ca3af', fontWeight: 700 }}>{card.rarity === 'gold-rare' ? 'Gold' : card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.62rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1rem' }}>🃏</div>
                      Slot {idx + 1}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { sb } from '../lib/supabase';
import { Dashboard } from '../lib/dashboard';
import PokeCard from '../components/PokeCard';
import type { Session } from '../lib/auth';
import type { Card } from '../lib/supabase';

export default function MyCardsPage({ session, onBack }: { session: NonNullable<Session>; onBack: () => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      // Get student row ID from auth user ID
      let sid = session.profile.student_id;
      if (!sid) {
        const { data } = await sb.from('students')
          .select('id')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();
        if (data) sid = data.id;
      }
      if (sid) {
        const c = await Dashboard.getStudentCards(sid);
        setCards(c);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [session]);

  useEffect(() => { loadCards(); }, [loadCards]);

  useEffect(() => {
    const onFocus = () => loadCards();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadCards]);

  const RARITIES = ['all', 'common', 'silver', 'gold-rare', 'prismatic'];
  const RARITY_LABELS: Record<string, string> = { all: 'All', common: 'Common', silver: 'Silver', 'gold-rare': 'Gold', prismatic: '🌈 Rainbow' };
  const RARITY_COLORS: Record<string, string> = { all: '#6060a0', common: '#9ca3af', silver: '#94a3b8', 'gold-rare': '#f59e0b', prismatic: '#a855f7' };

  const filtered = filter === 'all' ? cards : cards.filter(c => c.rarity === filter);

  const counts = RARITIES.reduce((acc, r) => {
    acc[r] = r === 'all' ? cards.length : cards.filter(c => c.rarity === r).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#f0ecff 0%,#e8f0ff 50%,#f5f0ff 100%)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(160,140,220,0.15)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'rgba(160,140,220,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5040a0', flexShrink: 0 }}>←</button>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1rem', color: '#3040a0' }}>🃏 My Cards</div>
          <div style={{ fontSize: '0.7rem', color: '#8090b0' }}>{cards.length} card{cards.length !== 1 ? 's' : ''} collected</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>
        {/* Rarity filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {RARITIES.map(r => (
            <button key={r} onClick={() => setFilter(r)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', border: filter === r ? `2px solid ${RARITY_COLORS[r]}` : '1.5px solid rgba(160,140,220,0.2)', background: filter === r ? `${RARITY_COLORS[r]}18` : 'rgba(255,255,255,0.7)', color: filter === r ? RARITY_COLORS[r] : '#8090b0', transition: 'all 0.2s' }}>
              {RARITY_LABELS[r]} {counts[r] > 0 && <span style={{ opacity: 0.7 }}>({counts[r]})</span>}
            </button>
          ))}
        </div>

        {/* Cards grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9090c0' }}>Loading your cards…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9090c0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🃏</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{filter === 'all' ? 'No cards yet!' : `No ${RARITY_LABELS[filter]} cards yet`}</div>
            <div style={{ fontSize: '0.8rem' }}>Open packs in the Shop to collect cards</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            {filtered.map(card => (
              <div key={card.id} onClick={() => setDetailCard(card)} style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                <PokeCard card={card} showShimmerBtn />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDetailCard(null)}>
          <div onClick={e => e.stopPropagation()}>
            <PokeCard card={detailCard} showShimmerBtn />
          </div>
        </div>
      )}
    </div>
  );
}

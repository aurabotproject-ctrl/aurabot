import { useState, useEffect, useCallback } from 'react';
import { sb } from '../lib/supabase';
import { Dashboard } from '../lib/dashboard';
import PokeCard from '../components/PokeCard';
import type { Session } from '../lib/auth';
import type { Card } from '../lib/supabase';

const PAGE_SIZE = 12;

const RARITIES = ['all', 'common', 'silver', 'gold-rare', 'prismatic'];
const RARITY_LABELS: Record<string, string> = { all: 'All', common: 'Common', silver: 'Silver', 'gold-rare': 'Gold', prismatic: '🌈 Prismatic' };
const RARITY_COLORS: Record<string, string> = { all: '#6060a0', common: '#9ca3af', silver: '#94a3b8', 'gold-rare': '#f59e0b', prismatic: '#a855f7' };

const TYPES = [
  { id: 'all',       label: 'All Types', emoji: '🃏', color: '#6060a0' },
  { id: 'animals',   label: 'Animals',   emoji: '🐾', color: '#16a34a' },
  { id: 'xanimals',  label: 'Xanimals',  emoji: '🧬', color: '#7c3aed' },
  { id: 'creatures', label: 'Creatures', emoji: '👾', color: '#0369a1' },
  { id: 'humanoids', label: 'Humanoids', emoji: '🧑', color: '#b45309' },
  { id: 'robots',    label: 'Robots',    emoji: '🤖', color: '#374151' },
  { id: 'luckydip',  label: 'Lucky Dip', emoji: '🎲', color: '#be123c' },
];

export default function MyCardsPage({ session, onBack }: { session: NonNullable<Session>; onBack: () => void }) {
  const [cards, setCards]           = useState<Card[]>([]);
  const [loading, setLoading]       = useState(true);
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [rarityFilter, setRarityFilter] = useState('all');
  const [typeFilter, setTypeFilter]     = useState('all');
  const [page, setPage]             = useState(0);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      let sid = session.profile.student_id;
      if (!sid) {
        const { data } = await sb.from('students').select('id').eq('auth_user_id', session.user.id).maybeSingle();
        if (data) sid = data.id;
      }
      if (sid) setCards(await Dashboard.getStudentCards(sid));
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [session]);

  useEffect(() => { loadCards(); }, [loadCards]);
  useEffect(() => {
    const onFocus = () => loadCards();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadCards]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [rarityFilter, typeFilter]);

  const filtered = cards.filter(c => {
    const rarityOk = rarityFilter === 'all' || c.rarity === rarityFilter;
    const typeOk   = typeFilter   === 'all' || c.type   === typeFilter;
    return rarityOk && typeOk;
  });

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages - 1);
  const pageCards   = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const startNum    = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const endNum      = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

  const FilterBtn = ({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
      border: active ? `2px solid ${color}` : '1.5px solid rgba(160,140,220,0.2)',
      background: active ? `${color}20` : 'rgba(255,255,255,0.7)',
      color: active ? color : '#8090b0', transition: 'all 0.18s', whiteSpace: 'nowrap',
    }}>{children}</button>
  );

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

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* Rarity filters */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: '#a0a0c0', textTransform: 'uppercase', marginBottom: 6 }}>Rarity</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {RARITIES.map(r => {
              const count = r === 'all' ? cards.length : cards.filter(c => c.rarity === r).length;
              return (
                <FilterBtn key={r} active={rarityFilter === r} color={RARITY_COLORS[r]} onClick={() => setRarityFilter(r)}>
                  {RARITY_LABELS[r]}{count > 0 && <span style={{ opacity: 0.65, marginLeft: 4 }}>({count})</span>}
                </FilterBtn>
              );
            })}
          </div>
        </div>

        {/* Type filters */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: '#a0a0c0', textTransform: 'uppercase', marginBottom: 6 }}>Category</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {TYPES.map(t => {
              const count = t.id === 'all' ? cards.length : cards.filter(c => c.type === t.id).length;
              return (
                <FilterBtn key={t.id} active={typeFilter === t.id} color={t.color} onClick={() => setTypeFilter(t.id)}>
                  {t.emoji} {t.label}{count > 0 && <span style={{ opacity: 0.65, marginLeft: 4 }}>({count})</span>}
                </FilterBtn>
              );
            })}
          </div>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9090c0' }}>Loading your cards…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9090c0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🃏</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No cards match these filters</div>
            <div style={{ fontSize: '0.8rem' }}>Try a different rarity or category</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            {pageCards.map(card => (
              <div key={card.id} onClick={() => setDetailCard(card)} style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                <PokeCard card={card} showShimmerBtn />
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 32 }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid rgba(160,140,220,0.3)', background: safePage === 0 ? 'rgba(160,140,220,0.05)' : 'rgba(160,140,220,0.12)', color: safePage === 0 ? '#c0c0d8' : '#5040a0', cursor: safePage === 0 ? 'default' : 'pointer', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
              ←
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#3040a0' }}>
                {startNum}–{endNum} <span style={{ color: '#a0a0c0', fontWeight: 500 }}>of</span> {filtered.length}
              </div>
              <div style={{ fontSize: '0.62rem', color: '#b0b0d0', fontWeight: 600 }}>
                Page {safePage + 1} of {totalPages}
              </div>
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid rgba(160,140,220,0.3)', background: safePage >= totalPages - 1 ? 'rgba(160,140,220,0.05)' : 'rgba(160,140,220,0.12)', color: safePage >= totalPages - 1 ? '#c0c0d8' : '#5040a0', cursor: safePage >= totalPages - 1 ? 'default' : 'pointer', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
              →
            </button>
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

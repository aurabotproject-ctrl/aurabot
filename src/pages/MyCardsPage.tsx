import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '../lib/supabase';
import { Dashboard } from '../lib/dashboard';
import type { CatalogueCard } from '../lib/dashboard';
import PokeCard from '../components/PokeCard';
import type { Session } from '../lib/auth';
import type { Card } from '../lib/supabase';

const PAGE_SIZE = 12;

/* ── Rarities ──────────────────────────────────────────────────────────────
   Displayed as clickable circles above every slot. 'common' is the bronze
   tier — the circle is bronze-coloured, the label stays "Common" so it
   matches the rest of the app. */
const RARITY_ORDER = ['common', 'silver', 'gold-rare', 'prismatic'] as const;
type Rarity = typeof RARITY_ORDER[number];

const RARITY_META: Record<Rarity, { label: string; ring: string; fill: string; glow: string }> = {
  common:      { label: 'Common',    ring: '#8b5a2b', fill: 'linear-gradient(145deg,#d9a06a,#8b5a2b)', glow: 'rgba(139,90,43,0.55)' },
  silver:      { label: 'Silver',    ring: '#8fa9bd', fill: 'linear-gradient(145deg,#eef4f9,#8fa9bd)', glow: 'rgba(143,169,189,0.6)' },
  'gold-rare': { label: 'Gold',      ring: '#d4a017', fill: 'linear-gradient(145deg,#ffe28a,#d4a017)', glow: 'rgba(212,160,23,0.6)' },
  prismatic:   { label: 'Prismatic', ring: '#b06bff', fill: 'linear-gradient(145deg,#ffc2f0,#a8e8ff 45%,#c9a3ff)', glow: 'rgba(176,107,255,0.65)' },
};

/* ── Categories ────────────────────────────────────────────────────────────
   These mirror the decks in the teacher's card builder. Any category that
   turns up in card_database but isn't listed here still gets a tab, built
   on the fly, so the album never hides cards. */
const KNOWN_TYPES: { id: string; label: string; emoji: string; color: string }[] = [
  { id: 'animals',   label: 'Animals',   emoji: '🐾', color: '#16a34a' },
  { id: 'xanimals',  label: 'Xanimals',  emoji: '🧬', color: '#06b6d4' },
  { id: 'creatures', label: 'Creatures', emoji: '👾', color: '#0369a1' },
  { id: 'humanoids', label: 'Humanoids', emoji: '🧑', color: '#b45309' },
  { id: 'robots',    label: 'Robots',    emoji: '🤖', color: '#374151' },
  { id: 'special',   label: 'Special',   emoji: '✨', color: '#be123c' },
];
const FALLBACK_TYPE = { emoji: '🃏', color: '#6060a0' };

const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();

type Slot = {
  key: string;
  num: number;               // #1, #2 … within this category
  name: string;
  entry: CatalogueCard;
  copies: Card[];            // every copy the student owns of this design
  byRarity: Record<string, Card[]>;
};

export default function MyCardsPage({ session, onBack }: { session: NonNullable<Session>; onBack: () => void }) {
  const [cards, setCards]           = useState<Card[]>([]);
  const [catalogue, setCatalogue]   = useState<CatalogueCard[]>([]);
  const [loading, setLoading]       = useState(true);
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showMode, setShowMode]     = useState<'all' | 'have' | 'need'>('all');
  const [page, setPage]             = useState(0);

  /* ── Load owned cards + the master catalogue ─────────────────────────── */
  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      let sid = session.profile.student_id;
      let tid = '';
      const { data: srow } = await sb.from('students')
        .select('id, teacher_id')
        .eq(sid ? 'id' : 'auth_user_id', sid || session.user.id)
        .maybeSingle();
      if (srow) { sid = sid || srow.id; tid = srow.teacher_id || ''; }

      const [owned, cat] = await Promise.all([
        sid ? Dashboard.getStudentCards(sid) : Promise.resolve([] as Card[]),
        Dashboard.getCardCatalogue(tid || undefined).catch(err => { console.error('[Album] catalogue load failed', err); return [] as CatalogueCard[]; }),
      ]);
      setCards(owned);
      setCatalogue(cat);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [session]);

  useEffect(() => { loadCards(); }, [loadCards]);
  // Re-fetch on focus so newly added database cards / newly opened packs show up
  useEffect(() => {
    const onFocus = () => loadCards();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadCards]);

  /* ── Build the album: every category, every slot, numbered ───────────── */
  const album = useMemo(() => {
    // Owned copies indexed by card name (the only link between a collected
    // card and its database design — collected rows copy the name, not the id)
    const ownedByName: Record<string, Card[]> = {};
    for (const c of cards) {
      const k = norm(c.card_name);
      (ownedByName[k] ||= []).push(c);
    }

    const byType: Record<string, Slot[]> = {};
    for (const entry of catalogue) {
      const t = norm(entry.type) || 'special';
      const list = (byType[t] ||= []);
      const copies = ownedByName[norm(entry.card_name)] || [];
      const byRarity: Record<string, Card[]> = {};
      for (const c of copies) (byRarity[c.rarity] ||= []).push(c);
      list.push({
        key: entry.id,
        num: list.length + 1,          // stable: catalogue is oldest-first
        name: entry.card_name,
        entry,
        copies,
        byRarity,
      });
    }
    return byType;
  }, [cards, catalogue]);

  /* Tabs: known decks first (only those with cards), then any extras */
  const tabs = useMemo(() => {
    const present = Object.keys(album);
    const known = KNOWN_TYPES.filter(t => present.includes(t.id));
    const extra = present
      .filter(t => !KNOWN_TYPES.some(k => k.id === t))
      .map(t => ({ id: t, label: t.charAt(0).toUpperCase() + t.slice(1), ...FALLBACK_TYPE }));
    return [...known, ...extra];
  }, [album]);

  // Default to the first available category once the catalogue lands
  useEffect(() => {
    if (!typeFilter && tabs.length) setTypeFilter(tabs[0].id);
  }, [tabs, typeFilter]);

  useEffect(() => { setPage(0); }, [typeFilter, showMode]);

  const activeTab   = tabs.find(t => t.id === typeFilter) || tabs[0];
  const allSlots    = album[typeFilter] || [];
  const ownedCount  = allSlots.filter(s => s.copies.length > 0).length;
  const slots       = allSlots.filter(s =>
    showMode === 'all' ? true : showMode === 'have' ? s.copies.length > 0 : s.copies.length === 0
  );

  const totalPages = Math.max(1, Math.ceil(slots.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageSlots  = slots.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const totalOwnedDesigns = Object.values(album).reduce((n, list) => n + list.filter(s => s.copies.length > 0).length, 0);
  const totalDesigns      = catalogue.length;

  /* ── Small pieces ───────────────────────────────────────────────────── */
  const FilterBtn = ({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
      border: active ? `2px solid ${color}` : '1.5px solid rgba(160,140,220,0.2)',
      background: active ? `${color}20` : 'rgba(255,255,255,0.7)',
      color: active ? color : '#8090b0', transition: 'all 0.18s', whiteSpace: 'nowrap',
    }}>{children}</button>
  );

  /** The four rarity circles that sit above each slot. A filled circle means
   * the student owns that card in that rarity; a badge appears when they own
   * more than one (their spare — the card they can trade away). */
  const RarityDots = ({ slot }: { slot: Slot }) => (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 6, minHeight: 22 }}>
      {RARITY_ORDER.map(r => {
        const copies = slot.byRarity[r] || [];
        const has    = copies.length > 0;
        const meta   = RARITY_META[r];
        return (
          <div key={r} style={{ position: 'relative' }}>
            <button
              title={has
                ? `${meta.label} — you have ${copies.length}${copies.length > 1 ? ' (spares to trade!)' : ''}`
                : `${meta.label} — not collected yet`}
              onClick={e => { e.stopPropagation(); if (has) setDetailCard(copies[0]); }}
              style={{
                width: 18, height: 18, borderRadius: '50%', padding: 0,
                cursor: has ? 'pointer' : 'default',
                border: has ? `1.5px solid ${meta.ring}` : '1.5px dashed rgba(150,140,190,0.45)',
                background: has ? meta.fill : 'rgba(255,255,255,0.55)',
                boxShadow: has ? `0 0 7px ${meta.glow}` : 'none',
                opacity: has ? 1 : 0.5,
                transition: 'transform 0.15s',
              }}
              onMouseEnter={e => { if (has) e.currentTarget.style.transform = 'scale(1.22)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            />
            {copies.length > 1 && (
              <span style={{
                position: 'absolute', top: -6, right: -7, minWidth: 14, height: 14, padding: '0 3px',
                borderRadius: 8, background: '#3040a0', color: '#fff', fontSize: '0.55rem', fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid #fff', lineHeight: 1,
              }}>×{copies.length}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  /** One album space. Filled = the student's best copy sits in the frame.
   * Empty = a dashed outline with the slot number, waiting to be filled. */
  const SlotBox = ({ slot }: { slot: Slot }) => {
    // Show the rarest copy in the frame
    const best = [...slot.copies].sort(
      (a, b) => RARITY_ORDER.indexOf(b.rarity as Rarity) - RARITY_ORDER.indexOf(a.rarity as Rarity)
    )[0];
    const meta = best ? RARITY_META[best.rarity as Rarity] || RARITY_META.common : null;

    return (
      <div style={{ width: 150 }}>
        <RarityDots slot={slot} />
        <div
          onClick={() => best && setDetailCard(best)}
          style={{
            width: 150, height: 196, borderRadius: 12, overflow: 'hidden', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: best ? 'pointer' : 'default',
            border: best ? `2.5px solid ${meta!.ring}` : '2.5px dashed rgba(150,140,200,0.42)',
            background: best
              ? 'linear-gradient(160deg,#ffffff,#f3efff)'
              : 'repeating-linear-gradient(135deg, rgba(255,255,255,0.6) 0 10px, rgba(232,228,248,0.6) 10px 20px)',
            boxShadow: best ? `0 4px 16px ${meta!.glow}` : 'inset 0 2px 10px rgba(120,110,170,0.09)',
            transition: 'transform 0.18s, box-shadow 0.18s',
          }}
          onMouseEnter={e => { if (best) { e.currentTarget.style.transform = 'translateY(-4px)'; } }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {best ? (
            <>
              {best.image_url
                ? <img src={best.image_url} alt={slot.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                : <span style={{ fontSize: '2.4rem' }}>🎭</span>}
              <span style={{
                position: 'absolute', top: 6, left: 6, fontSize: '0.58rem', fontWeight: 900,
                color: '#fff', background: 'rgba(48,64,160,0.78)', borderRadius: 6, padding: '2px 6px',
              }}>#{slot.num}</span>
              {slot.copies.length > 1 && (
                <span style={{
                  position: 'absolute', bottom: 6, right: 6, fontSize: '0.55rem', fontWeight: 800,
                  color: '#3040a0', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(48,64,160,0.25)',
                  borderRadius: 6, padding: '2px 6px',
                }}>{slot.copies.length} copies</span>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'rgba(120,110,175,0.5)' }}>
              <div style={{ fontSize: '2.1rem', fontWeight: 900, letterSpacing: '-0.02em' }}>#{slot.num}</div>
              <div style={{ fontSize: '1.2rem', marginTop: 2 }}>🔒</div>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 900, color: best ? '#3040a0' : '#a8a2c8' }}>#{slot.num}</div>
          <div style={{
            fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.2,
            color: best ? '#3a3560' : '#9a95bb',
            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: 30,
          }}>{slot.name}</div>
        </div>
      </div>
    );
  };

  const pct = allSlots.length ? Math.round((ownedCount / allSlots.length) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#f0ecff 0%,#e8f0ff 50%,#f5f0ff 100%)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(160,140,220,0.15)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'rgba(160,140,220,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5040a0', flexShrink: 0 }}>←</button>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1rem', color: '#3040a0' }}>🃏 My Collection</div>
          <div style={{ fontSize: '0.7rem', color: '#8090b0' }}>
            {totalDesigns > 0
              ? <>{totalOwnedDesigns} of {totalDesigns} different cards • {cards.length} card{cards.length !== 1 ? 's' : ''} in total</>
              : <>{cards.length} card{cards.length !== 1 ? 's' : ''} collected</>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* Category tabs */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: '#a0a0c0', textTransform: 'uppercase', marginBottom: 6 }}>Category</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {tabs.map(t => {
              const list = album[t.id] || [];
              const have = list.filter(s => s.copies.length > 0).length;
              return (
                <FilterBtn key={t.id} active={typeFilter === t.id} color={t.color} onClick={() => setTypeFilter(t.id)}>
                  {t.emoji} {t.label}<span style={{ opacity: 0.65, marginLeft: 4 }}>{have}/{list.length}</span>
                </FilterBtn>
              );
            })}
          </div>
        </div>

        {/* Progress bar for the open category */}
        {allSlots.length > 0 && (
          <div style={{ marginBottom: 16, background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(160,140,220,0.18)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
              <div style={{ fontWeight: 900, fontSize: '0.82rem', color: '#3040a0' }}>
                {activeTab?.emoji} {activeTab?.label} set
              </div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: pct === 100 ? '#16a34a' : '#8090b0' }}>
                {ownedCount}/{allSlots.length} filled {pct === 100 ? '🎉 Complete!' : `• ${pct}%`}
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: 'rgba(160,140,220,0.16)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: `linear-gradient(90deg,${activeTab?.color || '#6060a0'},#a855f7)`, transition: 'width 0.4s' }} />
            </div>
          </div>
        )}

        {/* Show: all / collected / still needed */}
        <div style={{ marginBottom: 20, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <FilterBtn active={showMode === 'all'}  color="#6060a0" onClick={() => setShowMode('all')}>All spaces</FilterBtn>
          <FilterBtn active={showMode === 'have'} color="#16a34a" onClick={() => setShowMode('have')}>✓ Collected</FilterBtn>
          <FilterBtn active={showMode === 'need'} color="#be123c" onClick={() => setShowMode('need')}>🔒 Still needed</FilterBtn>
        </div>

        {/* Album grid — 12 spaces per page */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9090c0' }}>Loading your collection…</div>
        ) : totalDesigns === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9090c0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🃏</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No cards have been added to the collection yet</div>
            <div style={{ fontSize: '0.8rem' }}>Once your teacher adds cards, their spaces will appear here.</div>
          </div>
        ) : slots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9090c0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>{showMode === 'need' ? '🎉' : '🔒'}</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {showMode === 'need' ? 'You have every card in this set!' : 'Nothing here yet'}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              {showMode === 'have' ? 'Open a pack or trade with a classmate to start filling these spaces.' : 'Try another category.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'center' }}>
            {pageSlots.map(slot => <SlotBox key={slot.key} slot={slot} />)}
          </div>
        )}

        {/* Pagination */}
        {slots.length > PAGE_SIZE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 32 }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid rgba(160,140,220,0.3)', background: safePage === 0 ? 'rgba(160,140,220,0.05)' : 'rgba(160,140,220,0.12)', color: safePage === 0 ? '#c0c0d8' : '#5040a0', cursor: safePage === 0 ? 'default' : 'pointer', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
              ←
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#3040a0' }}>
                Page {safePage + 1} <span style={{ color: '#a0a0c0', fontWeight: 500 }}>of</span> {totalPages}
              </div>
              <div style={{ fontSize: '0.62rem', color: '#b0b0d0', fontWeight: 600 }}>
                {slots.length} space{slots.length !== 1 ? 's' : ''} in this view
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

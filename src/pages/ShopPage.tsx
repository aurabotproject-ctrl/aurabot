import { useState, useEffect, useCallback } from 'react';
import { sb } from '../lib/supabase';
import type { Session } from '../lib/auth';
import type { Card } from '../lib/supabase';

// ── Trade fairness rules ──────────────────────────────────────────────
// Point values double each tier up, so any combination of cards whose
// point totals match on both sides is considered a fair trade —
// e.g. 2 commons (1+1=2) = 1 silver (2); 2 golds (4+4=8) = 1 prismatic (8).
export const RARITY_VALUE: Record<string, number> = { common: 1, silver: 2, 'gold-rare': 4, prismatic: 8 };
const RARITY_LABEL: Record<string, string> = { common: 'Common', silver: 'Silver', 'gold-rare': 'Gold', prismatic: 'Prismatic' };
const RARITY_COLOR: Record<string, string> = { common: '#8b5a2b', silver: '#94a3b8', 'gold-rare': '#f59e0b', prismatic: '#a855f7' };

function OfferCardRow({ label, cards }: { label: string; cards: Card[] }) {
  const value = cards.reduce((sum, c) => sum + (RARITY_VALUE[c.rarity] || 0), 0);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label} <span style={{ opacity: 0.7 }}>({value} pts)</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {cards.length === 0 ? (
          <span style={{ fontSize: '0.7rem', color: '#5060a0', fontStyle: 'italic' }}>Loading…</span>
        ) : cards.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: `1px solid ${RARITY_COLOR[c.rarity]}55`, borderRadius: 8, padding: '4px 8px' }}>
            {c.image_url && <img src={c.image_url} alt={c.card_name} style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 4 }} />}
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'white' }}>{c.card_name}</span>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: RARITY_COLOR[c.rarity] }}>{RARITY_LABEL[c.rarity]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  { id: 'basic',   label: 'Basic Pack',   stars: 5,  color: '#6366f1',
    desc: '2 Commons + 50/50 Common or Silver',
    guarantee: ['common','common'] as const,
    bonus: ['common','silver'] as const },
  { id: 'mod',     label: 'Mod Pack',     stars: 10, color: '#8b5cf6',
    desc: '2 Silvers + 50/50 Silver or Gold',
    guarantee: ['silver','silver'] as const,
    bonus: ['silver','gold-rare'] as const },
  { id: 'premium', label: 'Premium Pack', stars: 20, color: '#f59e0b',
    desc: '2 Golds + 50/50 Gold or Rainbow',
    guarantee: ['gold-rare','gold-rare'] as const,
    bonus: ['gold-rare','prismatic'] as const },
];

/** Returns exactly 3 rarities matching the guaranteed pack contents */
function rollPackRarities(tierId: string): ['common'|'silver'|'gold-rare'|'prismatic', 'common'|'silver'|'gold-rare'|'prismatic', 'common'|'silver'|'gold-rare'|'prismatic'] {
  const tier = PACK_TIERS.find(t => t.id === tierId) || PACK_TIERS[0];
  // Use two separate Math.random() calls combined for better entropy
  const r1 = Math.random();
  const r2 = Math.random();
  const coinFlip = ((r1 + r2) / 2) < 0.5; // true = lower rarity (index 0), false = higher (index 1)
  const bonusRarity = tier.bonus[coinFlip ? 0 : 1];
  return [tier.guarantee[0], tier.guarantee[1], bonusRarity];
}

const STAT_RANGES: Record<string, { hpMin: number; hpMax: number; weakMin: number; weakMax: number; strongMin: number; strongMax: number; skillPts: number }> = {
  common:      { hpMin: 80,  hpMax: 100, weakMin: 40, weakMax: 50,  strongMin: 50,  strongMax: 70,  skillPts: 1 },
  silver:      { hpMin: 100, hpMax: 120, weakMin: 50, weakMax: 60,  strongMin: 60,  strongMax: 80,  skillPts: 2 },
  'gold-rare': { hpMin: 120, hpMax: 140, weakMin: 60, weakMax: 75,  strongMin: 80,  strongMax: 100, skillPts: 3 },
  prismatic:   { hpMin: 150, hpMax: 180, weakMin: 75, weakMax: 95,  strongMin: 100, strongMax: 130, skillPts: 5 },
};

const TEST_ACCOUNTS = ['Bella Clark', 'Benji Clark'];

const UNLOCK_ITEMS = [
  { id: 'color',     label: 'Unlock Grape & Ocean',    desc: 'Adds 2 new bot colours: Grape purple & Ocean teal', emoji: '🎨', cost: 5 },
  { id: 'color2',    label: 'Unlock Gold & Silver',    desc: 'Adds shiny Gold & Silver bot colours ✨',            emoji: '⭐', cost: 5, requires: 'color' },
  { id: 'color3',    label: 'Unlock Rainbow & Black Chrome', desc: 'Adds the rare Rainbow & Black Chrome bots 🌈🖤', emoji: '💎', cost: 5, requires: 'color2' },
  { id: 'face',      label: 'Face Colour Pack',         desc: 'Unlock a new face pixel colour palette',            emoji: '✨', cost: 5 },
  { id: 'buildabot', label: 'Build-a-Bot',              desc: 'Unlock the full bot customisation studio',          emoji: '🔧', cost: 5 },
];

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

  // ── Trade state ─────────────────────────────────────────────────────
  const [myCards, setMyCards] = useState<Card[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);       // open listings I've put up
  const [browseListings, setBrowseListings] = useState<any[]>([]); // open listings from classmates
  const [incomingOffers, setIncomingOffers] = useState<any[]>([]); // pending offers on my listings
  const [sentOffers, setSentOffers] = useState<any[]>([]);         // pending offers I've made
  const [offerCardDetails, setOfferCardDetails] = useState<Record<string, Card>>({}); // full card data for cards in others' offers
  const [classmates, setClassmates] = useState<Record<string, string>>({}); // id -> name
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeMsg, setTradeMsg] = useState('');
  const [showListPicker, setShowListPicker] = useState(false);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [wantedOwnerId, setWantedOwnerId] = useState<string | null>(null);
  const [wantedCardIds, setWantedCardIds] = useState<string[]>([]);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offeredCardIds, setOfferedCardIds] = useState<string[]>([]);
  const [tradeBusy, setTradeBusy] = useState(false);
  const [expandedTraderId, setExpandedTraderId] = useState<string | null>(null);

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

  // ── Trade data loading ──────────────────────────────────────────────
  const loadTradeData = useCallback(async () => {
    if (!studentId || !teacherId) return;
    setTradeLoading(true);
    try {
      const [cardsRes, classmatesRes, listingsRes, offersRes] = await Promise.all([
        sb.from('cards').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
        sb.from('students').select('id, name').eq('teacher_id', teacherId),
        sb.from('trade_listings').select('*, cards(*)').eq('teacher_id', teacherId).eq('status', 'open').order('created_at', { ascending: false }),
        sb.from('trade_offers').select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false }),
      ]);

      if (cardsRes.error) console.error('[Trade] cards query failed:', cardsRes.error);
      if (classmatesRes.error) console.error('[Trade] students query failed:', classmatesRes.error);
      if (listingsRes.error) console.error('[Trade] trade_listings query failed:', listingsRes.error);
      if (offersRes.error) console.error('[Trade] trade_offers query failed:', offersRes.error);

      const firstError = cardsRes.error || classmatesRes.error || listingsRes.error || offersRes.error;
      if (firstError) showTradeMsg(`Trade data failed to load: ${firstError.message || 'unknown error'}`);

      setMyCards((cardsRes.data || []) as Card[]);

      const nameMap: Record<string, string> = {};
      (classmatesRes.data || []).forEach((s: any) => { nameMap[s.id] = s.name; });
      setClassmates(nameMap);

      const allListings = listingsRes.data || [];
      setMyListings(allListings.filter((l: any) => l.student_id === studentId));
      setBrowseListings(allListings.filter((l: any) => l.student_id !== studentId));

      const allOffers = (offersRes.data || []).filter((o: any) => o.status === 'pending');
      const incoming = allOffers.filter((o: any) => o.to_student_id === studentId);
      setIncomingOffers(incoming);
      setSentOffers(allOffers.filter((o: any) => o.from_student_id === studentId));

      // Fetch full card details for the "what you'd receive" side of incoming offers
      const offeredIds = Array.from(new Set(incoming.flatMap((o: any) => o.offered_card_ids || [])));
      if (offeredIds.length > 0) {
        const { data: offeredCardsData, error: offeredErr } = await sb.from('cards').select('*').in('id', offeredIds);
        if (offeredErr) console.error('[Trade] offered-card-details query failed:', offeredErr);
        const detailMap: Record<string, Card> = {};
        (offeredCardsData || []).forEach((c: any) => { detailMap[c.id] = c; });
        setOfferCardDetails(detailMap);
      } else {
        setOfferCardDetails({});
      }
    } catch (err) {
      console.error('[Trade] load failed (exception)', err);
    }
    setTradeLoading(false);
  }, [studentId, teacherId]);

  useEffect(() => { loadTradeData(); }, [loadTradeData]);
  useEffect(() => {
    const onFocus = () => loadTradeData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadTradeData]);

  const showTradeMsg = (m: string) => { setTradeMsg(m); setTimeout(() => setTradeMsg(''), 3500); };

  // A card is "listed" if it has an open trade_listings row
  const listedCardIds = new Set(myListings.map((l: any) => l.card_id));

  // Group classmates' open listings by who owns them, for the trader-list view
  const tradersGrouped: Record<string, any[]> = {};
  browseListings.forEach((l: any) => {
    if (!tradersGrouped[l.student_id]) tradersGrouped[l.student_id] = [];
    tradersGrouped[l.student_id].push(l);
  });
  const traderIds = Object.keys(tradersGrouped).sort((a, b) => (classmates[a] || '').localeCompare(classmates[b] || ''));

  // ── List cards for trade (multi-select) ──────────────────────────────
  const toggleSelectedListCard = (card: Card) => {
    setSelectedListIds(prev => prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]);
  };

  const handleListCards = async () => {
    if (selectedListIds.length === 0) return;
    setTradeBusy(true);
    try {
      const rows = selectedListIds.map(cardId => ({
        teacher_id: teacherId, student_id: studentId, card_id: cardId, status: 'open',
      }));
      const { error } = await sb.from('trade_listings').insert(rows);
      if (error) throw error;
      setShowListPicker(false);
      setSelectedListIds([]);
      await loadTradeData();
      showTradeMsg(`✓ ${rows.length} card${rows.length !== 1 ? 's' : ''} now up for trade!`);
    } catch (err: any) { showTradeMsg('Could not list those cards — try again.'); console.error(err); }
    setTradeBusy(false);
  };

  const handleCancelListing = async (listing: any) => {
    setTradeBusy(true);
    try {
      await sb.from('trade_listings').update({ status: 'cancelled' }).eq('id', listing.id);
      // Auto-decline any pending offers that were requesting this card
      const affected = sentOffers.concat(incomingOffers).filter((o: any) =>
        (o.requested_card_ids || []).includes(listing.card_id) && o.status === 'pending'
      );
      for (const o of affected) {
        await sb.from('trade_offers').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', o.id);
      }
      await loadTradeData();
      showTradeMsg('Listing removed.');
    } catch (err) { console.error(err); }
    setTradeBusy(false);
  };

  // ── Browse & select cards to request ────────────────────────────────
  const toggleWantedCard = (listing: any) => {
    if (wantedOwnerId && wantedOwnerId !== listing.student_id && wantedCardIds.length > 0) {
      showTradeMsg('You can only trade with one classmate at a time — clear your selection first.');
      return;
    }
    setWantedOwnerId(listing.student_id);
    setWantedCardIds(prev => {
      const next = prev.includes(listing.card_id) ? prev.filter(id => id !== listing.card_id) : [...prev, listing.card_id];
      if (next.length === 0) setWantedOwnerId(null);
      return next;
    });
  };

  const clearWantedSelection = () => { setWantedCardIds([]); setWantedOwnerId(null); };

  const wantedCards = browseListings.filter((l: any) => wantedCardIds.includes(l.card_id)).map((l: any) => l.cards as Card);
  const wantedValue = wantedCards.reduce((sum, c) => sum + (RARITY_VALUE[c.rarity] || 0), 0);

  const offeredCards = myCards.filter(c => offeredCardIds.includes(c.id));
  const offeredValue = offeredCards.reduce((sum, c) => sum + (RARITY_VALUE[c.rarity] || 0), 0);
  const tradeBalanced = wantedValue > 0 && wantedValue === offeredValue;

  const toggleOfferedCard = (card: Card) => {
    setOfferedCardIds(prev => prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]);
  };

  const handleSendOffer = async () => {
    if (!tradeBalanced || !wantedOwnerId) return;
    setTradeBusy(true);
    try {
      const { error } = await sb.from('trade_offers').insert({
        teacher_id: teacherId,
        to_student_id: wantedOwnerId,
        from_student_id: studentId,
        requested_card_ids: wantedCardIds,
        offered_card_ids: offeredCardIds,
        status: 'pending',
      });
      if (error) throw error;
      setShowOfferModal(false);
      clearWantedSelection();
      setOfferedCardIds([]);
      await loadTradeData();
      showTradeMsg('✓ Trade offer sent! Waiting for them to respond.');
    } catch (err: any) { showTradeMsg('Could not send that offer — try again.'); console.error(err); }
    setTradeBusy(false);
  };

  const handleCancelOffer = async (offer: any) => {
    setTradeBusy(true);
    try {
      await sb.from('trade_offers').update({ status: 'cancelled', responded_at: new Date().toISOString() }).eq('id', offer.id);
      await loadTradeData();
    } catch (err) { console.error(err); }
    setTradeBusy(false);
  };

  // ── Respond to an incoming offer ────────────────────────────────────
  const handleRespondOffer = async (offer: any, accept: boolean) => {
    setTradeBusy(true);
    try {
      if (!accept) {
        await sb.from('trade_offers').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', offer.id);
        await loadTradeData();
        showTradeMsg('Offer declined.');
        setTradeBusy(false);
        return;
      }

      // Re-verify both sides still own exactly what they're claiming to trade —
      // protects against a card already having moved in a different trade.
      const allIds = [...offer.requested_card_ids, ...offer.offered_card_ids];
      const { data: liveCards } = await sb.from('cards').select('id, student_id').in('id', allIds);
      const liveMap: Record<string, string> = {};
      (liveCards || []).forEach((c: any) => { liveMap[c.id] = c.student_id; });
      const requestedOk = offer.requested_card_ids.every((id: string) => liveMap[id] === offer.to_student_id);
      const offeredOk = offer.offered_card_ids.every((id: string) => liveMap[id] === offer.from_student_id);

      if (!requestedOk || !offeredOk) {
        await sb.from('trade_offers').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', offer.id);
        await loadTradeData();
        showTradeMsg('This trade is no longer valid — one of the cards has already been traded.');
        setTradeBusy(false);
        return;
      }

      // Swap ownership
      await sb.from('cards').update({ student_id: offer.from_student_id }).in('id', offer.requested_card_ids);
      await sb.from('cards').update({ student_id: offer.to_student_id }).in('id', offer.offered_card_ids);

      // Close out the listings for the traded cards
      await sb.from('trade_listings').update({ status: 'completed' }).in('card_id', offer.requested_card_ids).eq('status', 'open');

      // Mark this offer accepted
      await sb.from('trade_offers').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('id', offer.id);

      // Trade fee — 1 ⭐ from each side of the trade (skip for test accounts)
      const feeStudentIds = [offer.to_student_id, offer.from_student_id].filter(
        id => !TEST_ACCOUNTS.includes(classmates[id] || (id === studentId ? studentName : ''))
      );
      if (feeStudentIds.length > 0) {
        const { data: pointsRows } = await sb.from('student_star_points').select('student_id, points').in('student_id', feeStudentIds);
        for (const row of (pointsRows || [])) {
          const newPoints = Math.max(0, (row.points || 0) - 1);
          await sb.from('student_star_points').update({ points: newPoints }).eq('student_id', row.student_id);
          if (row.student_id === studentId) setStarPoints(newPoints);
        }
      }

      // Auto-decline any other pending offers that referenced the now-moved cards
      const { data: otherPending } = await sb.from('trade_offers').select('*').eq('teacher_id', teacherId).eq('status', 'pending');
      for (const o of (otherPending || [])) {
        if (o.id === offer.id) continue;
        const refs = [...(o.requested_card_ids || []), ...(o.offered_card_ids || [])];
        if (refs.some((id: string) => allIds.includes(id))) {
          await sb.from('trade_offers').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', o.id);
        }
      }

      await loadTradeData();
      onCardsAdded?.();
      showTradeMsg('✓ Trade complete! (1 ⭐ trade fee charged to each player)');
    } catch (err: any) { console.error(err); showTradeMsg('Something went wrong completing this trade.'); }
    setTradeBusy(false);
  };

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleUnlock = async (item: typeof UNLOCK_ITEMS[0]) => {
    if (!isTestAccount && (starPoints === null || starPoints < item.cost)) { showMsg(`Not enough ⭐ — need ${item.cost}`); return; }
    if (unlockedChoices.includes(item.id)) { showMsg('Already unlocked!'); return; }
    const req = (item as any).requires;
    if (req && !unlockedChoices.includes(req)) {
      const reqItem = UNLOCK_ITEMS.find(u => u.id === req);
      showMsg(`Unlock "${reqItem?.label || req}" first!`);
      return;
    }
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
                    {(packImages[`${pack.id}_mod`] || packImages[`${pack.id}_basic`] || packImages[pack.id]) ? (
                      <>
                        <img src={packImages[`${pack.id}_mod`] || packImages[`${pack.id}_basic`] || packImages[pack.id]} alt={pack.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
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
          <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5060a0', marginBottom: 14 }}>🔓 Unlocks — 5 ⭐ each · unlock in order</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {UNLOCK_ITEMS.map(item => {
              const owned = unlockedChoices.includes(item.id);
              const req = (item as any).requires as string | undefined;
              const reqMet = !req || unlockedChoices.includes(req);
              const reqItem = req ? UNLOCK_ITEMS.find(u => u.id === req) : null;
              const canAfford = isTestAccount || (starPoints !== null && starPoints >= item.cost);
              const isLocked = !owned && !reqMet;
              const isDisabled = owned || isLocked || unlocking === item.id || (!isTestAccount && !canAfford);
              return (
                <div key={item.id} style={{ flex: '1', minWidth: 160, background: owned ? 'rgba(34,197,94,0.06)' : isLocked ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.04)', border: `1px solid ${owned ? 'rgba(34,197,94,0.25)' : isLocked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, opacity: isLocked ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.4rem', filter: isLocked ? 'grayscale(1)' : 'none' }}>{isLocked ? '🔒' : item.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.82rem', color: owned ? '#4ade80' : isLocked ? '#5060a0' : 'white' }}>{item.label}</div>
                      <div style={{ fontSize: '0.68rem', color: '#5060a0', lineHeight: 1.3 }}>
                        {isLocked ? `Requires "${reqItem?.label}" first` : item.desc}
                      </div>
                    </div>
                  </div>
                  <button disabled={isDisabled}
                    onClick={() => handleUnlock(item)}
                    style={{ width: '100%', padding: '7px 0', borderRadius: 9, border: 'none', fontWeight: 800, fontSize: '0.76rem', cursor: isDisabled ? 'not-allowed' : 'pointer', background: owned ? 'rgba(34,197,94,0.15)' : isLocked ? 'rgba(60,60,80,0.3)' : canAfford ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'rgba(60,60,80,0.5)', color: owned ? '#4ade80' : isLocked ? '#4a5580' : canAfford ? 'white' : '#5060a0' }}>
                    {owned ? '✓ Owned' : isLocked ? '🔒 Locked' : unlocking === item.id ? '…' : `⭐ ${item.cost} — Unlock`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Trade ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5060a0' }}>🔄 Trade Cards</div>
            <button onClick={() => loadTradeData()} style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6070a0', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>↻ Refresh</button>
          </div>

          {tradeMsg && (
            <div style={{ background: tradeMsg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${tradeMsg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: tradeMsg.startsWith('✓') ? '#4ade80' : '#f87171', borderRadius: 12, padding: '9px 14px', fontSize: '0.78rem', fontWeight: 700, marginBottom: 16 }}>
              {tradeMsg}
            </div>
          )}

          {tradeLoading ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#5060a0', fontSize: '0.8rem' }}>Loading trades…</div>
          ) : (
            <>
              {/* Incoming offers — needs my response */}
              {incomingOffers.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f472b6', marginBottom: 10 }}>📥 Offers waiting on you ({incomingOffers.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {incomingOffers.map((offer: any) => {
                      const reqCards = myCards.filter(c => offer.requested_card_ids.includes(c.id));
                      // offered cards belong to from_student_id, which may not be in myCards — fetch via browseListings' embedded card or fallback name
                      return (
                        <div key={offer.id} style={{ background: 'rgba(244,114,182,0.06)', border: '1.5px solid rgba(244,114,182,0.25)', borderRadius: 14, padding: 14 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f472b6', marginBottom: 8 }}>
                            {classmates[offer.from_student_id] || 'A classmate'} wants to trade with you
                          </div>
                          <OfferCardRow label="They get (yours)" cards={reqCards} />
                          <OfferCardRow label="You get (theirs)" cards={offer.offered_card_ids.map((id: string) => offerCardDetails[id]).filter(Boolean)} />
                          <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontStyle: 'italic', marginTop: 6 }}>Accepting costs 1 ⭐ for each of you.</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button disabled={tradeBusy} onClick={() => handleRespondOffer(offer, true)} style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', fontWeight: 800, fontSize: '0.76rem', cursor: 'pointer', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white' }}>✓ Accept</button>
                            <button disabled={tradeBusy} onClick={() => handleRespondOffer(offer, false)} style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)', fontWeight: 800, fontSize: '0.76rem', cursor: 'pointer', background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>✕ Decline</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* My sent offers — pending */}
              {sentOffers.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', marginBottom: 10 }}>📤 Offers you've sent ({sentOffers.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sentOffers.map((offer: any) => (
                      <div key={offer.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px' }}>
                        <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                          Waiting on <strong style={{ color: 'white' }}>{classmates[offer.to_student_id] || 'a classmate'}</strong> — {offer.offered_card_ids.length} of yours for {offer.requested_card_ids.length} of theirs
                        </span>
                        <button disabled={tradeBusy} onClick={() => handleCancelOffer(offer)} style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f87171', background: 'transparent', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Cancel</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* My listings */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#a78bfa' }}>🃏 My cards up for trade ({myListings.length})</div>
                  <button onClick={() => setShowListPicker(true)} style={{ fontSize: '0.72rem', fontWeight: 800, color: 'white', background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', border: 'none', borderRadius: 9, padding: '6px 12px', cursor: 'pointer' }}>+ List Cards</button>
                </div>
                {myListings.length === 0 ? (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px', textAlign: 'center', fontSize: '0.76rem', color: '#5060a0' }}>
                    You haven't listed any cards yet. Click "+ List Cards" to offer some up for trade.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                    {myListings.map((l: any) => (
                      <div key={l.id} style={{ position: 'relative', flexShrink: 0 }}>
                        <PokeCard card={l.cards} size="mini" />
                        <button disabled={tradeBusy} onClick={() => handleCancelListing(l)} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#f87171', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Browse trade hub */}
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#60a5fa', marginBottom: 10 }}>🔍 Browse classmates' trades ({traderIds.length})</div>
                {traderIds.length === 0 ? (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px', textAlign: 'center', fontSize: '0.76rem', color: '#5060a0' }}>
                    No classmates have listed cards yet — check back soon!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {traderIds.map(traderId => {
                      const listings = tradersGrouped[traderId];
                      const isExpanded = expandedTraderId === traderId;
                      const totalValue = listings.reduce((sum: number, l: any) => sum + (RARITY_VALUE[l.cards?.rarity] || 0), 0);
                      return (
                        <div key={traderId} style={{ background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${isExpanded ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, overflow: 'hidden' }}>
                          <div
                            onClick={() => {
                              if (isExpanded) { setExpandedTraderId(null); return; }
                              setExpandedTraderId(traderId);
                              if (wantedOwnerId && wantedOwnerId !== traderId) { setWantedCardIds([]); setWantedOwnerId(null); }
                            }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.85rem', color: 'white', flexShrink: 0 }}>
                                {(classmates[traderId] || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'white' }}>{classmates[traderId] || 'Classmate'}</div>
                                <div style={{ fontSize: '0.68rem', color: '#6070a0' }}>
                                  {listings.length} card{listings.length !== 1 ? 's' : ''} up for trade · {totalValue} pts total
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {/* Tiny rarity-dot preview strip */}
                              <div style={{ display: 'flex', gap: 3 }}>
                                {listings.slice(0, 6).map((l: any) => (
                                  <span key={l.id} style={{ width: 8, height: 8, borderRadius: '50%', background: RARITY_COLOR[l.cards?.rarity] || '#6070a0' }} />
                                ))}
                                {listings.length > 6 && <span style={{ fontSize: '0.62rem', color: '#6070a0' }}>+{listings.length - 6}</span>}
                              </div>
                              <span style={{ color: '#6070a0', fontSize: '0.8rem', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                              {listings.map((l: any) => {
                                const selected = wantedCardIds.includes(l.card_id);
                                return (
                                  <div key={l.id} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => toggleWantedCard(l)}>
                                    <div style={{ borderRadius: 12, outline: selected ? '3px solid #60a5fa' : 'none', outlineOffset: 2 }}>
                                      <PokeCard card={l.cards} size="mini" />
                                    </div>
                                    {selected && <div style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: '#60a5fa', color: 'white', fontSize: '0.7rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sticky selection bar */}
              {wantedCardIds.length > 0 && (
                <div style={{ position: 'sticky', bottom: 12, marginTop: 16, background: 'rgba(20,22,40,0.95)', backdropFilter: 'blur(10px)', border: '1.5px solid rgba(96,165,250,0.35)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'white' }}>
                    Wanting {wantedCardIds.length} card{wantedCardIds.length !== 1 ? 's' : ''} from <strong>{classmates[wantedOwnerId || ''] || 'classmate'}</strong> · worth <strong style={{ color: '#60a5fa' }}>{wantedValue} pts</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={clearWantedSelection} style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}>Clear</button>
                    <button onClick={() => { setOfferedCardIds([]); setShowOfferModal(true); }} style={{ fontSize: '0.72rem', fontWeight: 800, color: 'white', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Offer My Cards →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── List Cards modal ── */}
      {showListPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => { setShowListPicker(false); setSelectedListIds([]); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#141628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 22, maxWidth: 640, width: '100%', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: 4 }}>Pick cards to list for trade</div>
            <div style={{ fontSize: '0.76rem', color: '#6070a0', marginBottom: 16 }}>Select one or more cards — classmates will be able to see and request them.</div>
            {tradeMsg && (
              <div style={{ background: tradeMsg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${tradeMsg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: tradeMsg.startsWith('✓') ? '#4ade80' : '#f87171', borderRadius: 10, padding: '8px 12px', fontSize: '0.76rem', fontWeight: 700, marginBottom: 14 }}>
                {tradeMsg}
              </div>
            )}
            {myCards.filter(c => !listedCardIds.has(c.id)).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#5060a0', fontSize: '0.8rem' }}>All your cards are already listed, or you don't have any cards yet.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {myCards.filter(c => !listedCardIds.has(c.id)).map(card => {
                  const selected = selectedListIds.includes(card.id);
                  return (
                    <div key={card.id} onClick={() => !tradeBusy && toggleSelectedListCard(card)} style={{ position: 'relative', cursor: tradeBusy ? 'default' : 'pointer', opacity: tradeBusy ? 0.5 : 1 }}>
                      <div style={{ borderRadius: 12, outline: selected ? '3px solid #7c3aed' : 'none', outlineOffset: 2 }}>
                        <PokeCard card={card} size="mini" />
                      </div>
                      {selected && <div style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: '#7c3aed', color: 'white', fontSize: '0.7rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
              <button onClick={() => { setShowListPicker(false); setSelectedListIds([]); }} style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, padding: '8px 14px', cursor: 'pointer' }}>Cancel</button>
              <button disabled={selectedListIds.length === 0 || tradeBusy} onClick={handleListCards} style={{ fontSize: '0.74rem', fontWeight: 800, color: 'white', background: selectedListIds.length > 0 ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'rgba(60,60,80,0.5)', border: 'none', borderRadius: 9, padding: '8px 16px', cursor: selectedListIds.length > 0 ? 'pointer' : 'not-allowed' }}>
                {tradeBusy ? 'Listing…' : `🃏 List ${selectedListIds.length || ''} Card${selectedListIds.length !== 1 ? 's' : ''} for Trade`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Offer my cards modal ── */}
      {showOfferModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowOfferModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#141628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 22, maxWidth: 680, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: 4 }}>Offer your cards</div>
            <div style={{ fontSize: '0.76rem', color: '#6070a0', marginBottom: 14 }}>Select your own cards until the value matches exactly — trades must be fair.</div>
            {tradeMsg && (
              <div style={{ background: tradeMsg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${tradeMsg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: tradeMsg.startsWith('✓') ? '#4ade80' : '#f87171', borderRadius: 10, padding: '8px 12px', fontSize: '0.76rem', fontWeight: 700, marginBottom: 14 }}>
                {tradeMsg}
              </div>
            )}

            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#60a5fa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>You're requesting ({wantedValue} pts)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {wantedCards.map(c => <PokeCard key={c.id} card={c} size="mini" />)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#f472b6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your cards — pick {offeredValue} / {wantedValue} pts</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {myCards.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#5060a0' }}>You don't have any cards to offer.</div>
              ) : myCards.map(card => {
                const selected = offeredCardIds.includes(card.id);
                return (
                  <div key={card.id} onClick={() => toggleOfferedCard(card)} style={{ position: 'relative', cursor: 'pointer' }}>
                    <div style={{ borderRadius: 12, outline: selected ? '3px solid #f472b6' : 'none', outlineOffset: 2 }}>
                      <PokeCard card={card} size="mini" />
                    </div>
                    {selected && <div style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: '#f472b6', color: 'white', fontSize: '0.7rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: 8 }}>If accepted, this trade costs 1 ⭐ for each of you.</div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderRadius: 12, background: tradeBalanced ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${tradeBalanced ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)'}` }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: tradeBalanced ? '#4ade80' : '#94a3b8' }}>
                {tradeBalanced ? '✓ Fair trade — values match!' : `Requesting ${wantedValue} pts · Offering ${offeredValue} pts`}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowOfferModal(false)} style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, padding: '8px 14px', cursor: 'pointer' }}>Cancel</button>
                <button disabled={!tradeBalanced || tradeBusy} onClick={handleSendOffer} style={{ fontSize: '0.74rem', fontWeight: 800, color: 'white', background: tradeBalanced ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(60,60,80,0.5)', border: 'none', borderRadius: 9, padding: '8px 16px', cursor: tradeBalanced ? 'pointer' : 'not-allowed' }}>
                  {tradeBusy ? 'Sending…' : '🤝 Send Offer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pack Opening Overlay */}
      {openingPack && (
        <PackOpeningOverlay
          pack={openingPack}
          packImages={packImages}
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

function PackOpeningOverlay({ pack, packImages, starPoints, isTestAccount, studentId, teacherId, onClose, onComplete, onStarsSpent }: {
  pack: typeof PACK_TYPES[0]; packImages: Record<string, string>;
  starPoints: number; isTestAccount: boolean;
  studentId: string; teacherId: string;
  onClose: () => void; onComplete: (cards: OpenedCard[]) => void;
  onStarsSpent: (amt: number) => void;
}) {
  const [phase, setPhase] = useState<OpenPhase>('tiers');
  const [selectedTier, setSelectedTier] = useState<typeof PACK_TIERS[0] | null>(null);

  // Resolve image: try tier-specific first, fall back to mod, then basic, then generic
  const packImage = selectedTier
    ? (packImages[`${pack.id}_${selectedTier.id}`] || packImages[pack.id] || null)
    : (packImages[`${pack.id}_mod`] || packImages[`${pack.id}_basic`] || packImages[pack.id] || null);
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
    common: 'rgba(139,90,43,0.5)', silver: 'rgba(148,163,184,0.7)',
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
      pack.id === 'luckydip'
        ? sb.from('card_database').select('id, card_name, type, description, image_url, move1_name, move2_name').neq('type', 'project').limit(100)
        : sb.from('card_database').select('id, card_name, type, description, image_url, move1_name, move2_name').eq('type', pack.id).limit(100),
      new Promise<{data: null}>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    ]);

    let dbCards: any[] = [];
    try {
      const result = await fetchWithTimeout as any;
      dbCards = result.data || [];
    } catch {
      dbCards = [];
    }

    // Fisher-Yates shuffle — far better randomness than sort(() => Math.random() - 0.5)
    const fisherYates = (arr: any[]) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    // Shuffle the full pool and pick 3 distinct cards
    const shuffled = fisherYates(dbCards);
    // Extra entropy: do a second shuffle pass on the top portion
    const topSlice = shuffled.slice(0, Math.min(20, shuffled.length));
    const reshuffled = [...fisherYates(topSlice), ...shuffled.slice(topSlice.length)];
    const picked = reshuffled.slice(0, 3);

    // Roll the 3 guaranteed rarities for this tier
    const rarities = rollPackRarities(selectedTier.id);
    console.log('[Pack Roll] tier:', selectedTier.id, '| rarities:', rarities);

    const rolled: OpenedCard[] = [];
    for (let i = 0; i < 3; i++) {
      const rarity = rarities[i];
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

    // Shuffle the presentation order so the bonus card isn't always last
    for (let i = rolled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolled[i], rolled[j]] = [rolled[j], rolled[i]];
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

  // Card click handler — instantly slot the card
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,20,0.97)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'clip' }}
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
            const tierImage = packImages[`${pack.id}_${tier.id}`] || packImages[pack.id] || null;
            const rarityColor = (r: string) =>
              r === 'prismatic' ? '#c084fc' : r === 'gold-rare' ? '#fbbf24' : r === 'silver' ? '#94a3b8' : '#9ca3af';
            const rarityLabel = (r: string) =>
              r === 'gold-rare' ? 'Gold' : r.charAt(0).toUpperCase() + r.slice(1);
            return (
              <div key={tier.id} onClick={() => canBuy && (setSelectedTier(tier), setPhase('confirm'))}
                style={{ background: canBuy ? `${tier.color}18` : 'rgba(255,255,255,0.02)', border: `2px solid ${canBuy ? tier.color + '66' : 'rgba(255,255,255,0.06)'}`, borderRadius: 16, padding: '16px 20px', cursor: canBuy ? 'pointer' : 'not-allowed', opacity: canBuy ? 1 : 0.45, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                {tierImage && (
                  <img src={tierImage} alt={tier.label} style={{ width: 44, height: 58, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: `1px solid ${tier.color}44` }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, color: 'white', fontSize: '0.9rem', marginBottom: 4 }}>{['⭐','⭐⭐','⭐⭐⭐'][i]} {tier.label}</div>
                  <div style={{ fontSize: '0.7rem', color: '#7080a0', marginBottom: 6 }}>{tier.desc}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {tier.guarantee.map((r, gi) => (
                      <span key={gi} style={{ fontSize: '0.58rem', padding: '2px 7px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: rarityColor(r), fontWeight: 700, border: `1px solid ${rarityColor(r)}44` }}>
                        {rarityLabel(r)}
                      </span>
                    ))}
                    <span style={{ fontSize: '0.58rem', color: '#5060a0' }}>+</span>
                    <span style={{ fontSize: '0.58rem', padding: '2px 7px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: rarityColor(tier.bonus[0]), fontWeight: 700, border: `1px solid ${rarityColor(tier.bonus[0])}44` }}>
                      {rarityLabel(tier.bonus[0])}
                    </span>
                    <span style={{ fontSize: '0.55rem', color: '#5060a0' }}>or</span>
                    <span style={{ fontSize: '0.58rem', padding: '2px 7px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: rarityColor(tier.bonus[1]), fontWeight: 700, border: `1px solid ${rarityColor(tier.bonus[1])}44` }}>
                      {rarityLabel(tier.bonus[1])}
                    </span>
                    <span style={{ fontSize: '0.55rem', color: '#5060a0' }}>50/50</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
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
                    style={{ position: 'absolute', top: idx * 6, left: idx * 3, width: '100%', zIndex: openedCards.length - idx,
                      transform: `translateY(${cardSwiped[idx] ? 600 : 0}px) rotate(${cardSwiped[idx] ? 0 : (idx - 1) * 2}deg)`,
                      transition: 'transform 0.4s ease-in, opacity 0.3s',
                      opacity: cardSwiped[idx] ? 0 : 1,
                      cursor: isTop ? 'pointer' : 'default',
                      filter: `drop-shadow(0 0 ${isTop ? 20 : 6}px ${rarityGlow[card.rarity]})`,
                      animation: cardSwiped[idx] ? 'none' : `cardFlyUp 0.5s ${idx * 0.1}s both`,
                    }}
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

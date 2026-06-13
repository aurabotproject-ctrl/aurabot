import { useState, useEffect, useRef, useCallback } from 'react';
import PokeCard from '../components/PokeCard';
import BuiltCard from '../components/BuiltCard';
import { Dashboard } from '../lib/dashboard';
import { sb, recordArenaWin, hasPlayedThisWeek } from '../lib/supabase';
import type { Session } from '../lib/auth';
import type { Card, Student } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────
type GameScreen = 'setup' | 'cardpick' | 'battle' | 'gameover';

// Each turn goes through these phases in order:
// roll → math → resolve → (next turn roll)
type TurnPhase =
  | 'roll'       // Player clicks the dice
  | 'math'       // 20-second math challenge
  | 'resolve'    // Show result + apply damage
  | 'gameover';

interface BattleState {
  p1Cards: Card[];
  p2Cards: Card[];
  p1Idx: number;
  p2Idx: number;
  p1HP: number;
  p2HP: number;
  p1MaxHP: number;
  p2MaxHP: number;
  turn: 'p1' | 'p2';
  log: string[];
  p1CorrectAnswers: number;
  p2CorrectAnswers: number;
  totalDamageP1: number;
  totalDamageP2: number;
}

interface MathState {
  questions: { num1: number; num2: number; answer: number }[];
  currentQ: number;
  correct: number;     // running tally (can go down on wrong answer)
  answered: number;    // total attempts this turn
  timeLeft: number;
  input: string;
  flash: 'correct' | 'wrong' | null;  // brief flash feedback
  statUsed: 1 | 2;
  diceValue: number;
}

const RARITY_ORDER: Record<string, number> = {
  common: 0, silver: 1, 'gold-rare': 2, prismatic: 3,
};
const RARITY_LABEL: Record<string, string> = {
  common: 'Common', silver: 'Silver', 'gold-rare': 'Gold Rare', prismatic: 'Prismatic',
};
const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af', silver: '#cbd5e1', 'gold-rare': '#f59e0b', prismatic: '#c084fc',
};

// ── Helpers ───────────────────────────────────────────────────────────
const STRENGTH_TABLE: Record<number, number> = {
  0: 0, 1: 0, 2: 0,
  3: 10, 4: 20, 5: 30, 6: 40, 7: 50,
  8: 60, 9: 70, 10: 80, 11: 90, 12: 100,
};

function getStrengthPct(correct: number): number {
  const clamped = Math.max(0, Math.min(12, correct));
  return STRENGTH_TABLE[clamped] ?? 100;
}

function getRarityMultiplier(rarity: string): number {
  switch (rarity) {
    case 'prismatic': return 2;
    case 'gold-rare': return 1.5;
    case 'silver': return 1.25;
    default: return 1;
  }
}

function getHPColor(hp: number, max: number): string {
  const pct = hp / max;
  if (pct > 0.5) return 'linear-gradient(90deg,#4caf82,#8bc34a)';
  if (pct > 0.25) return 'linear-gradient(90deg,#ff9800,#ffc107)';
  return 'linear-gradient(90deg,#f44336,#e91e63)';
}

function genQuestion(): { num1: number; num2: number; answer: number } {
  const num1 = Math.floor(Math.random() * 12) + 1;
  const num2 = Math.floor(Math.random() * 12) + 1;
  return { num1, num2, answer: num1 * num2 };
}

function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// ── Transfer a card from loser to winner in DB ───────────────────────
async function transferCard(cardId: string, newStudentId: string): Promise<void> {
  const { error } = await sb.from('cards').update({ student_id: newStudentId }).eq('id', cardId);
  if (error) throw error;
}

// ── Card Picker ───────────────────────────────────────────────────────
function CardPicker({
  playerName,
  allCards,
  onConfirm,
  accentColor,
  monoStyle,
}: {
  playerName: string;
  allCards: Card[];
  onConfirm: (selected: Card[]) => void;
  accentColor: string;
  monoStyle: React.CSSProperties;
}) {
  const [selected, setSelected] = useState<Card[]>([]);
  const [error, setError] = useState('');

  const toggleCard = (card: Card) => {
    setError('');
    const alreadyIdx = selected.findIndex(c => c.id === card.id);

    if (alreadyIdx >= 0) {
      // Deselect
      setSelected(prev => prev.filter(c => c.id !== card.id));
      return;
    }

    if (selected.length >= 3) {
      setError('You can only pick 3 cards. Deselect one first.');
      return;
    }

    // Check rarity uniqueness
    const rarityAlready = selected.find(c => c.rarity === card.rarity);
    if (rarityAlready) {
      setError(`You already have a ${RARITY_LABEL[card.rarity] ?? card.rarity} card selected. Each card must be a different rarity.`);
      return;
    }

    setSelected(prev => [...prev, card]);
  };

  const canConfirm = selected.length === 3;

  // Group cards by rarity for display
  const grouped: Record<string, Card[]> = {};
  for (const c of allCards) {
    if (!grouped[c.rarity]) grouped[c.rarity] = [];
    grouped[c.rarity].push(c);
  }
  const rarityKeys = Object.keys(grouped).sort(
    (a, b) => (RARITY_ORDER[b] ?? 0) - (RARITY_ORDER[a] ?? 0)
  );

  const selectedRarities = new Set(selected.map(c => c.rarity));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 900, margin: '0 auto', padding: '1rem' }}>
      <h2 style={{
        fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: 'clamp(1.2rem,3vw,1.8rem)',
        color: accentColor, letterSpacing: '0.1em', marginBottom: '0.3rem', textAlign: 'center',
      }}>
        {playerName.toUpperCase()} — PICK YOUR 3 CARDS
      </h2>
      <p style={{ ...monoStyle, color: 'rgba(168,230,255,0.4)', fontSize: '0.72rem', letterSpacing: '0.15em', marginBottom: '1.2rem', textAlign: 'center' }}>
        Each card must be a different rarity &nbsp;·&nbsp; Common · Silver · Gold · Prismatic
      </p>

      {/* Selected slots */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        {[0, 1, 2].map(i => {
          const card = selected[i];
          return (
            <div key={i} style={{
              width: 140, height: 56, borderRadius: 10,
              border: card
                ? `1.5px solid ${RARITY_COLOR[card.rarity] ?? '#a8e6ff'}`
                : '1.5px dashed rgba(168,230,255,0.2)',
              background: card ? 'rgba(168,230,255,0.05)' : 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: card ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
              onClick={() => card && toggleCard(card)}
              title={card ? 'Click to deselect' : ''}
            >
              {card ? (
                <>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: RARITY_COLOR[card.rarity], ...monoStyle }}>
                    {card.card_name}
                  </span>
                  <span style={{ fontSize: '0.58rem', color: 'rgba(168,230,255,0.4)', ...monoStyle }}>
                    {RARITY_LABEL[card.rarity]} · tap to remove
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '0.65rem', color: 'rgba(168,230,255,0.2)', ...monoStyle }}>
                  Slot {i + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.3)',
          color: '#ff8080', borderRadius: 8, padding: '8px 14px',
          fontSize: '0.76rem', ...monoStyle, marginBottom: '0.8rem', textAlign: 'center',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Cards grouped by rarity */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.2rem', maxHeight: '55vh', overflowY: 'auto', paddingBottom: '0.5rem' }}>
        {rarityKeys.map(rarity => {
          const rarityKey = rarity as 'common' | 'silver' | 'gold-rare' | 'prismatic';
          const isRarityTaken = selectedRarities.has(rarityKey);
          return (
            <div key={rarity}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: RARITY_COLOR[rarityKey] ?? '#fff', boxShadow: `0 0 6px ${RARITY_COLOR[rarityKey] ?? '#fff'}` }} />
                <span style={{ ...monoStyle, fontSize: '0.7rem', fontWeight: 700, color: RARITY_COLOR[rarityKey] ?? '#fff', letterSpacing: '0.15em' }}>
                  {RARITY_LABEL[rarityKey] ?? rarity.toUpperCase()} ({grouped[rarity].length})
                </span>
                {isRarityTaken && (
                  <span style={{ ...monoStyle, fontSize: '0.58rem', color: 'rgba(168,230,255,0.3)' }}>✓ slot filled</span>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {grouped[rarity].map(card => {
                  const isSelected = selected.some(c => c.id === card.id);
                  const isDisabled = !isSelected && isRarityTaken;
                  return (
                    <button
                      key={card.id}
                      onClick={() => !isDisabled && toggleCard(card)}
                      style={{
                        padding: '8px 14px', borderRadius: 9,
                        border: isSelected
                          ? `1.5px solid ${RARITY_COLOR[rarityKey]}`
                          : isDisabled
                            ? '1.5px solid rgba(168,230,255,0.07)'
                            : '1.5px solid rgba(168,230,255,0.18)',
                        background: isSelected
                          ? `${RARITY_COLOR[rarityKey]}22`
                          : isDisabled
                            ? 'rgba(168,230,255,0.01)'
                            : 'rgba(168,230,255,0.04)',
                        color: isSelected
                          ? RARITY_COLOR[rarityKey]
                          : isDisabled
                            ? 'rgba(168,230,255,0.2)'
                            : 'rgba(168,230,255,0.7)',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        ...monoStyle, fontSize: '0.75rem', fontWeight: isSelected ? 800 : 400,
                        transition: 'all 0.15s',
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                        minWidth: 110,
                        opacity: isDisabled ? 0.45 : 1,
                      }}
                    >
                      <span>{isSelected ? '✓ ' : ''}{card.card_name}</span>
                      <span style={{ fontSize: '0.58rem', opacity: 0.6 }}>HP {card.hp} · {card.type}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => canConfirm && onConfirm(selected)}
        disabled={!canConfirm}
        style={{
          marginTop: '1.5rem', padding: '13px 48px', borderRadius: 12,
          border: 'none', cursor: canConfirm ? 'pointer' : 'not-allowed',
          background: canConfirm
            ? `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`
            : 'rgba(168,230,255,0.06)',
          color: canConfirm ? '#0d1117' : 'rgba(168,230,255,0.25)',
          fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: '1rem', letterSpacing: '0.12em',
          boxShadow: canConfirm ? `0 4px 24px ${accentColor}55` : 'none',
          transition: 'all 0.2s',
        }}
      >
        {canConfirm ? `✓ LOCK IN ${playerName.toUpperCase()}'S DECK` : `SELECT ${3 - selected.length} MORE CARD${3 - selected.length !== 1 ? 'S' : ''}`}
      </button>
    </div>
  );
}

// ── Dice SVG ──────────────────────────────────────────────────────────
function DiceFace({ value, rolling }: { value: number; rolling: boolean }) {
  const dots: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
  };
  return (
    <svg viewBox="0 0 100 100" width="100" height="100"
      style={{ filter: rolling ? 'drop-shadow(0 0 12px #a8e6ff)' : 'drop-shadow(0 0 6px rgba(168,230,255,0.4))', transition: 'filter 0.3s' }}>
      <rect x="5" y="5" width="90" height="90" rx="18"
        fill="#0d1117" stroke="#a8e6ff" strokeWidth="2.5"
        opacity={rolling ? 0.7 : 1}
      />
      {(dots[value] || []).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="7" fill="#a8e6ff"
          style={{ filter: 'drop-shadow(0 0 4px #a8e6ffbb)' }}
        />
      ))}
    </svg>
  );
}

// ── HP Bar ────────────────────────────────────────────────────────────
function HPBar({ hp, maxHP, name }: { hp: number; maxHP: number; name: string }) {
  const pct = maxHP > 0 ? (hp / maxHP) * 100 : 0;
  return (
    <div style={{ width: 260 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.7rem', color: 'rgba(168,230,255,0.6)', fontFamily: 'monospace', letterSpacing: '0.06em' }}>{name}</span>
        <span style={{ fontSize: '0.7rem', color: '#a8e6ff', fontFamily: 'monospace', fontWeight: 700 }}>{hp}/{maxHP}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'rgba(168,230,255,0.08)', overflow: 'hidden', border: '1px solid rgba(168,230,255,0.12)' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: getHPColor(hp, maxHP), transition: 'width 0.5s ease, background 0.5s ease' }} />
      </div>
    </div>
  );
}

// ── Strength meter ────────────────────────────────────────────────────
function StrengthMeter({ correct }: { correct: number }) {
  const pct = getStrengthPct(correct);
  const color = pct === 0 ? '#f44336' : pct < 50 ? '#ff9800' : pct < 100 ? '#4caf82' : '#c080ff';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: '0.62rem', color: 'rgba(168,230,255,0.45)', fontFamily: 'monospace', letterSpacing: '0.12em' }}>ATTACK STRENGTH</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 800, fontFamily: 'monospace', color }}>{pct}%</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: 'rgba(168,230,255,0.06)', overflow: 'hidden', border: '1px solid rgba(168,230,255,0.1)' }}>
        <div style={{ height: '100%', borderRadius: 5, width: `${pct}%`, background: color, transition: 'width 0.3s ease', boxShadow: `0 0 8px ${color}88` }} />
      </div>
      <div style={{ fontSize: '0.58rem', color: 'rgba(168,230,255,0.3)', fontFamily: 'monospace', marginTop: 3, textAlign: 'right' }}>
        {correct < 3 ? 'Answer 3+ correctly to deal damage' : `${correct} correct → ${pct}% strength`}
      </div>
    </div>
  );
}

// ── Scoreboard dots ───────────────────────────────────────────────────
function ScoreDots({ correct, total }: { correct: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', margin: '8px 0' }}>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} style={{
          width: 14, height: 14, borderRadius: '50%',
          background: i < correct ? '#4caf82' : i < total ? '#f44336' : 'rgba(168,230,255,0.1)',
          border: `1.5px solid ${i < correct ? '#4caf82' : i < total ? '#f44336' : 'rgba(168,230,255,0.15)'}`,
          boxShadow: i < correct ? '0 0 5px #4caf8299' : 'none',
          transition: 'all 0.2s',
        }} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
function ArenaPage({ session }: { session: NonNullable<Session> }) {
  const [screen, setScreen] = useState<GameScreen>('setup');
  // 'p1pick' → p1 picks cards, 'p2pick' → p2 picks cards
  const [cardPickStep, setCardPickStep] = useState<'p1pick' | 'p2pick'>('p1pick');

  const [p1Ready, setP1Ready] = useState(false);
  const [p2Ready, setP2Ready] = useState(false);

  // All cards loaded from DB (full collections)
  const [p1AllCards, setP1AllCards] = useState<Card[]>([]);
  const [p2AllCards, setP2AllCards] = useState<Card[]>([]);

  // The 3 battle cards each player chose
  const [p1Cards, setP1Cards] = useState<Card[]>([]);

  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [opponentId, setOpponentId] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [verifyPin, setVerifyPin] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [myStudentId, setMyStudentId] = useState('');
  const [opponentStudentId, setOpponentStudentId] = useState('');
  const winRecordedRef = useRef(false);

  // Card transfer state (shown on gameover screen)
  const [transferredCard, setTransferredCard] = useState<Card | null>(null);
  const [transferError, setTransferError] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  // We need to know who won (p1 or p2) for transfer
  const [winnerSide, setWinnerSide] = useState<'p1' | 'p2' | null>(null);

  const [battle, setBattle] = useState<BattleState>({
    p1Cards: [], p2Cards: [], p1Idx: 0, p2Idx: 0,
    p1HP: 0, p2HP: 0, p1MaxHP: 0, p2MaxHP: 0,
    turn: 'p1', log: [],
    p1CorrectAnswers: 0, p2CorrectAnswers: 0,
    totalDamageP1: 0, totalDamageP2: 0,
  });

  const [turnPhase, setTurnPhase] = useState<TurnPhase>('roll');
  const [winner, setWinner] = useState('');
  const [diceRolling, setDiceRolling] = useState(false);
  const [diceValue, setDiceValue] = useState(1);
  const [mathState, setMathState] = useState<MathState | null>(null);
  const [resolveMsg, setResolveMsg] = useState('');
  const [resolveDamage, setResolveDamage] = useState(0);
  const [shakingCard, setShakingCard] = useState<'p1' | 'p2' | null>(null);
  const [damageFloats, setDamageFloats] = useState<{ id: number; side: 'p1' | 'p2'; value: string }[]>([]);
  const floatIdRef = useRef(0);
  const mathTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mathInputRef = useRef<HTMLInputElement>(null);

  // ── Load P1's cards ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const profile = session.profile;
        let studentId = profile.student_id;
        if (!studentId) {
          const { data } = await sb.from('students').select('id').eq('auth_user_id', session.user.id).maybeSingle();
          if (data) studentId = data.id;
        }
        if (studentId) {
          const cards = await Dashboard.getStudentCards(studentId);
          setP1AllCards(cards);
          setP1Ready(true);
          setMyStudentId(studentId);
        }
      } catch (e: any) { setSetupError(e.message); }
    })();
    Dashboard.getAllStudents().then(s => {
      setAllStudents(s.filter(st => st.auth_user_id !== session.user.id));
    }).catch(() => {});
  }, [session]);

  const handleChallengeOpponent = async () => {
    if (!opponentId) return;
    const opp = allStudents.find(s => s.id === opponentId);
    if (!opp) return;
    setSetupError('');
    try {
      if (myStudentId) {
        const played = await hasPlayedThisWeek(myStudentId, opp.id);
        if (played) {
          setSetupError(`You've already battled ${opp.name} this week! Try another opponent.`);
          return;
        }
      }
      const cards = await Dashboard.getStudentCards(opp.id);
      if (cards.length === 0) { setSetupError('This student has no cards!'); return; }
      if (cards.length < 3) { setSetupError(`${opp.name} only has ${cards.length} card(s). They need at least 3 to battle.`); return; }
      // Check p2 has at least 3 different rarities
      const oppRarities = new Set(cards.map(c => c.rarity));
      if (oppRarities.size < 3) {
        setSetupError(`${opp.name} doesn't have cards of 3 different rarities yet.`);
        return;
      }
      setP2AllCards(cards);
      setOpponentName(opp.name);
      setOpponentStudentId(opp.id);
      setVerifyPin('');
    } catch (e: any) { setSetupError(e.message); }
  };

  // Check P1 eligibility
  const p1Rarities = new Set(p1AllCards.map(c => c.rarity));
  const p1CanBattle = p1AllCards.length >= 3 && p1Rarities.size >= 3;

  const [verifying, setVerifying] = useState(false);

  const handleVerifyOpponent = async () => {
    if (verifying) return;
    setVerifyError('');
    const opp = allStudents.find(s => s.id === opponentId);
    if (!opp) return;
    if (verifyPin.length !== 6) {
      setVerifyError('Please enter the full 6-digit PIN.');
      return;
    }
    if (!opp.login_email) {
      setVerifyError("This student doesn't have a login email on record.");
      return;
    }
    setVerifying(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const tempSb = createClient(
        'https://iunoahajcaaxmttdpgem.supabase.co',
        'sb_publishable_rUgPdjSjCcQfaEY0uc1mZw_vKqC_itL'
      );
      const { error } = await tempSb.auth.signInWithPassword({
        email: opp.login_email,
        password: verifyPin,
      });
      if (error) {
        setVerifyError('Incorrect PIN. Try again.');
        setVerifyPin('');
        setVerifying(false);
        return;
      }
      setP2Ready(true);
    } catch {
      setVerifyError('Verification failed. Try again.');
    }
    setVerifying(false);
  };

  const handlePinKey = (key: string) => {
    if (key === '⌫') {
      setVerifyPin(p => p.slice(0, -1));
    } else if (verifyPin.length < 6) {
      setVerifyPin(p => p + key);
    }
  };

  // ── Move to card picking ──────────────────────────────────────────
  const handleGoToCardPick = () => {
    setCardPickStep('p1pick');
    setP1Cards([]);
    setScreen('cardpick');
  };

  const handleP1CardsPicked = (cards: Card[]) => {
    setP1Cards(cards);
    setCardPickStep('p2pick');
  };

  const handleP2CardsPicked = (cards: Card[]) => {
    startBattle(p1Cards, cards);
  };

  // ── Start battle ─────────────────────────────────────────────────
  const startBattle = (p1: Card[], p2: Card[]) => {
    if (!p1.length || !p2.length) return;
    const b: BattleState = {
      p1Cards: [...p1], p2Cards: [...p2],
      p1Idx: 0, p2Idx: 0,
      p1HP: p1[0].hp, p2HP: p2[0].hp,
      p1MaxHP: p1[0].hp, p2MaxHP: p2[0].hp,
      turn: 'p1', log: ['⚔ Battle started! Player 1 goes first.'],
      p1CorrectAnswers: 0, p2CorrectAnswers: 0,
      totalDamageP1: 0, totalDamageP2: 0,
    };
    setBattle(b);
    setTurnPhase('roll');
    setScreen('battle');
  };

  // ── Dice roll ─────────────────────────────────────────────────────
  const handleRoll = () => {
    if (diceRolling || turnPhase !== 'roll') return;
    setDiceRolling(true);

    let ticks = 0;
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      ticks++;
      if (ticks >= 10) {
        clearInterval(interval);
        const final = rollDice();
        setDiceValue(final);
        setDiceRolling(false);

        const statUsed: 1 | 2 = final % 2 === 1 ? 1 : 2;

        const questions = Array.from({ length: 12 }, genQuestion);
        const ms: MathState = {
          questions, currentQ: 0, correct: 0, answered: 0,
          timeLeft: 20, input: '', flash: null,
          statUsed, diceValue: final,
        };
        setMathState(ms);

        setTimeout(() => {
          setTurnPhase('math');
        }, 800);
      }
    }, 80);
  };

  // ── Math timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (turnPhase !== 'math' || !mathState) return;

    setTimeout(() => mathInputRef.current?.focus(), 100);

    mathTimerRef.current = setInterval(() => {
      setMathState(prev => {
        if (!prev) return null;
        if (prev.timeLeft <= 1) {
          clearInterval(mathTimerRef.current!);
          setTimeout(() => finishMath(prev.correct, prev.statUsed, prev.diceValue), 50);
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => { if (mathTimerRef.current) clearInterval(mathTimerRef.current); };
  }, [turnPhase]);

  // ── Submit answer ─────────────────────────────────────────────────
  const handleAnswer = useCallback(() => {
    if (!mathState || turnPhase !== 'math' || mathState.timeLeft === 0) return;
    const input = parseInt(mathState.input);
    if (isNaN(input)) return;

    const correct = input === mathState.questions[mathState.currentQ].answer;
    const newCorrect = correct
      ? mathState.correct + 1
      : Math.max(0, mathState.correct - 1);

    const nextQ = mathState.currentQ + 1;

    if (nextQ >= 12) {
      clearInterval(mathTimerRef.current!);
      const final = { ...mathState, correct: newCorrect, answered: mathState.answered + 1, input: '', flash: correct ? 'correct' as const : 'wrong' as const };
      setMathState(final);
      setTimeout(() => finishMath(newCorrect, mathState.statUsed, mathState.diceValue), 400);
    } else {
      setMathState(prev => prev ? {
        ...prev,
        correct: newCorrect,
        answered: prev.answered + 1,
        currentQ: nextQ,
        input: '',
        flash: correct ? 'correct' : 'wrong',
      } : null);
      setTimeout(() => setMathState(prev => prev ? { ...prev, flash: null } : null), 300);
    }
  }, [mathState, turnPhase]);

  // ── Finish math, compute and apply damage ────────────────────────
  const finishMath = useCallback((correct: number, statUsed: 1 | 2, diceVal: number) => {
    setTurnPhase('resolve');

    setBattle(prev => {
      const isP1 = prev.turn === 'p1';
      const attacker = isP1 ? prev.p1Cards[prev.p1Idx] : prev.p2Cards[prev.p2Idx];
      const defender  = isP1 ? prev.p2Cards[prev.p2Idx] : prev.p1Cards[prev.p1Idx];
      if (!attacker || !defender) return prev;

      const baseStat = statUsed === 1 ? attacker.stat1_val : attacker.stat2_val;
      const statName = statUsed === 1 ? attacker.stat1_name : attacker.stat2_name;
      const strengthPct = getStrengthPct(correct);
      const rarityMult = getRarityMultiplier(attacker.rarity);
      const damage = strengthPct === 0
        ? 0
        : Math.max(1, Math.floor(baseStat * (strengthPct / 100) * rarityMult));

      const attackerName = isP1 ? (session.profile.name || 'Player 1') : (opponentName || 'Player 2');
      let msg = '';
      if (strengthPct === 0) {
        msg = `💀 ${attackerName} got fewer than 3 correct — 0% strength, no damage!`;
      } else {
        msg = `${attackerName} used ${statName} (${baseStat}) at ${strengthPct}% strength → ${damage} damage!`;
      }

      setTimeout(() => {
        if (damage > 0) {
          setShakingCard(isP1 ? 'p2' : 'p1');
          setTimeout(() => setShakingCard(null), 400);
          const id = ++floatIdRef.current;
          setDamageFloats(fs => [...fs, { id, side: isP1 ? 'p2' : 'p1', value: `-${damage}` }]);
          setTimeout(() => setDamageFloats(fs => fs.filter(f => f.id !== id)), 1500);
        }
      }, 200);

      setResolveMsg(msg);
      setResolveDamage(damage);

      const newState = { ...prev, log: [...prev.log, `🎲 Dice: ${diceVal} (${diceVal%2===1?'odd→stat 1':'even→stat 2'}) · ${correct}/12 correct · ${strengthPct}% · ${damage} dmg`, msg] };

      if (isP1) {
        newState.p2HP = Math.max(0, prev.p2HP - damage);
        newState.totalDamageP1 = prev.totalDamageP1 + damage;
        if (isP1) newState.p1CorrectAnswers = prev.p1CorrectAnswers + correct;
      } else {
        newState.p1HP = Math.max(0, prev.p1HP - damage);
        newState.totalDamageP2 = prev.totalDamageP2 + damage;
        newState.p2CorrectAnswers = prev.p2CorrectAnswers + correct;
      }

      // Check fainted
      if (isP1 && newState.p2HP <= 0) {
        newState.log.push(`💀 ${defender.card_name} fainted!`);
        const nextIdx = prev.p2Idx + 1;
        newState.p2Idx = nextIdx;
        if (nextIdx >= prev.p2Cards.length) {
          newState.log.push('', `🏆 ${attackerName} WINS!`);
          setTimeout(() => {
            setWinner(attackerName);
            setWinnerSide('p1');
            setScreen('gameover');
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4000);
            if (!winRecordedRef.current && myStudentId && opponentStudentId) {
              winRecordedRef.current = true;
              recordArenaWin(myStudentId, opponentStudentId).catch(console.warn);
              // Transfer: p2 loses → pick random card from p2's battle cards
              doCardTransfer(prev.p2Cards, myStudentId);
            }
          }, 1200);
          return newState;
        }
        newState.p2HP = prev.p2Cards[nextIdx]?.hp || 0;
        newState.p2MaxHP = prev.p2Cards[nextIdx]?.hp || 0;
      } else if (!isP1 && newState.p1HP <= 0) {
        newState.log.push(`💀 ${defender.card_name} fainted!`);
        const nextIdx = prev.p1Idx + 1;
        newState.p1Idx = nextIdx;
        if (nextIdx >= prev.p1Cards.length) {
          newState.log.push('', `🏆 ${attackerName} WINS!`);
          setTimeout(() => {
            setWinner(attackerName);
            setWinnerSide('p2');
            setScreen('gameover');
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4000);
            if (!winRecordedRef.current && myStudentId && opponentStudentId) {
              winRecordedRef.current = true;
              recordArenaWin(opponentStudentId, myStudentId).catch(console.warn);
              // Transfer: p1 loses → pick random card from p1's battle cards, give to p2
              doCardTransfer(prev.p1Cards, opponentStudentId);
            }
          }, 1200);
          return newState;
        }
        newState.p1HP = prev.p1Cards[nextIdx]?.hp || 0;
        newState.p1MaxHP = prev.p1Cards[nextIdx]?.hp || 0;
      }

      return newState;
    });
  }, [session, opponentName, myStudentId, opponentStudentId]);

  // ── Card transfer after loss ──────────────────────────────────────
  const doCardTransfer = async (loserBattleCards: Card[], winnerStudentId: string) => {
    setTransferLoading(true);
    setTransferError('');
    try {
      // Pick a random card from the loser's 3 battle cards
      const idx = Math.floor(Math.random() * loserBattleCards.length);
      const card = loserBattleCards[idx];
      await transferCard(card.id, winnerStudentId);
      setTransferredCard(card);
    } catch (e: any) {
      setTransferError(e.message || 'Card transfer failed.');
    }
    setTransferLoading(false);
  };

  // ── Next turn ─────────────────────────────────────────────────────
  const handleNextTurn = () => {
    setBattle(prev => ({
      ...prev,
      turn: prev.turn === 'p1' ? 'p2' : 'p1',
    }));
    setMathState(null);
    setResolveMsg('');
    setResolveDamage(0);
    setTurnPhase('roll');
  };

  // ── Derived values ────────────────────────────────────────────────
  const p1Card = battle.p1Cards[battle.p1Idx];
  const p2Card = battle.p2Cards[battle.p2Idx];
  const p1Name = session.profile.name || 'Player 1';
  const p2Name = opponentName || 'Player 2';
  const currentPlayerName = battle.turn === 'p1' ? p1Name : p2Name;

  const monoStyle: React.CSSProperties = { fontFamily: 'monospace' };
  const panelStyle: React.CSSProperties = {
    background: 'rgba(13,17,23,0.88)', backdropFilter: 'blur(14px)',
    border: '1px solid rgba(168,230,255,0.15)', borderRadius: 16,
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at center, #131b35 0%, #0a0f20 100%)', color: '#e8e4f0', position: 'relative', overflow: 'hidden' }}>

      {/* Scanlines */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1, backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(168,230,255,0.01) 2px,rgba(168,230,255,0.01) 4px)' }} />

      {/* ── SETUP ─────────────────────────────────────────────────── */}
      {screen === 'setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
          <h1 style={{
            fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: 'clamp(1.8rem,4vw,2.8rem)',
            background: 'linear-gradient(90deg,#a8e6ff,#60b8e0,#a8e6ff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            letterSpacing: '0.12em', marginBottom: '0.4rem', textAlign: 'center',
          }}>⚔ BATTLE ARENA ⚔</h1>
          <p style={{ ...monoStyle, color: 'rgba(168,230,255,0.4)', fontSize: '0.72rem', letterSpacing: '0.2em', marginBottom: '2.5rem' }}>CARD COMBAT SYSTEM v2</p>

          {setupError && <div style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', color: '#ff8080', borderRadius: 10, padding: '10px 16px', fontSize: '0.82rem', marginBottom: '1rem' }}>{setupError}</div>}

          <div style={{ ...panelStyle, width: '100%', maxWidth: 820, padding: '2rem' }}>
            <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>

              {/* P1 */}
              <div style={{ border: '1px solid rgba(80,200,120,0.25)', borderRadius: 12, padding: '1.5rem', background: 'rgba(80,200,120,0.04)', textAlign: 'center' }}>
                {!p1Ready ? (
                  <><div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 8px' }} /><p style={{ color: 'rgba(168,230,255,0.4)', ...monoStyle, fontSize: '0.75rem' }}>Loading your cards…</p></>
                ) : (
                  <>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#4a90d9,#6ab0f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>{p1Name[0].toUpperCase()}</div>
                    <div style={{ fontWeight: 800, color: '#a8e6ff', ...monoStyle, marginBottom: 4 }}>{p1Name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(168,230,255,0.4)', ...monoStyle }}>{p1AllCards.length} cards</div>
                    {!p1CanBattle && (
                      <div style={{ marginTop: 8, color: '#ff8080', fontSize: '0.68rem', ...monoStyle }}>
                        ⚠ You need cards of at least 3 different rarities to battle.
                      </div>
                    )}
                    {p1CanBattle && (
                      <div style={{ marginTop: 10, color: '#4caf82', fontSize: '0.75rem', ...monoStyle }}>✓ Ready to pick deck</div>
                    )}
                  </>
                )}
              </div>

              {/* P2 */}
              <div style={{ border: `1px solid ${p2Ready ? 'rgba(255,152,0,0.3)' : 'rgba(168,230,255,0.08)'}`, borderRadius: 12, padding: '1.5rem', background: p2Ready ? 'rgba(255,152,0,0.04)' : 'transparent', textAlign: 'center' }}>
                {!p2Ready ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: '2rem', opacity: 0.3 }}>👤</div>
                    <div style={{ fontWeight: 800, color: '#a8e6ff', ...monoStyle }}>Choose Opponent</div>
                    <select style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'rgba(168,230,255,0.04)', border: '1px solid rgba(168,230,255,0.2)', color: '#a8e6ff', ...monoStyle, fontSize: '0.82rem' }}
                      value={opponentId} onChange={e => setOpponentId(e.target.value)}>
                      <option value="">Select a student…</option>
                      {allStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {opponentId && !p2AllCards.length && (
                      <button onClick={handleChallengeOpponent} style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'rgba(168,230,255,0.1)', border: '1px solid rgba(168,230,255,0.3)', color: '#a8e6ff', cursor: 'pointer', ...monoStyle, fontWeight: 700, fontSize: '0.8rem' }}>
                        Challenge →
                      </button>
                    )}
                    {opponentId && p2AllCards.length > 0 && (
                      <>
                        <p style={{ fontSize: '0.75rem', color: 'rgba(168,230,255,0.7)', ...monoStyle, marginBottom: 4 }}>
                          Hand the device to <strong style={{ color: '#a8e6ff' }}>{opponentName}</strong>
                        </p>
                        <p style={{ fontSize: '0.68rem', color: 'rgba(168,230,255,0.4)', ...monoStyle, marginBottom: 10 }}>
                          Enter your 6-digit login PIN to confirm
                        </p>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
                          {[0,1,2,3,4,5].map(i => (
                            <div key={i} style={{ width: 32, height: 44, borderRadius: 8, background: 'rgba(168,230,255,0.06)', border: `1.5px solid ${verifyPin.length > i ? '#a8e6ff' : 'rgba(168,230,255,0.18)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 900, color: '#a8e6ff', ...monoStyle, transition: 'border-color 0.2s' }}>
                              {verifyPin[i] ? '●' : ''}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, width: '100%', maxWidth: 200, margin: '0 auto 10px' }}>
                          {['1','2','3','4','5','6','7','8','9','⌫','0','✓'].map(key => (
                            <button key={key} onClick={() => key === '✓' ? handleVerifyOpponent() : handlePinKey(key)}
                              disabled={verifying}
                              style={{ padding: '12px 0', borderRadius: 8, border: key === '✓' ? '1px solid rgba(76,175,130,0.5)' : '1px solid rgba(168,230,255,0.18)', background: key === '✓' ? 'rgba(76,175,130,0.15)' : key === '⌫' ? 'rgba(255,80,80,0.08)' : 'rgba(168,230,255,0.06)', color: key === '✓' ? '#4caf82' : key === '⌫' ? '#ff8080' : '#a8e6ff', ...monoStyle, fontWeight: 700, fontSize: '1rem', cursor: verifying ? 'not-allowed' : 'pointer', opacity: verifying ? 0.5 : 1, transition: 'background 0.15s' }}>
                              {key === '✓' && verifying ? '…' : key}
                            </button>
                          ))}
                        </div>
                        {verifyError && <div style={{ color: '#ff8080', fontSize: '0.72rem', ...monoStyle, marginBottom: 6 }}>{verifyError}</div>}
                        <button onClick={() => { setP2AllCards([]); setOpponentId(''); setVerifyPin(''); setVerifyError(''); }} style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(168,230,255,0.2)', color: 'rgba(168,230,255,0.5)', cursor: 'pointer', ...monoStyle, fontSize: '0.75rem' }}>← Back</button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#c8a000,#ff6b00)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>{p2Name[0].toUpperCase()}</div>
                    <div style={{ fontWeight: 800, color: '#ffe080', ...monoStyle, marginBottom: 4 }}>{p2Name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(168,230,255,0.4)', ...monoStyle }}>{p2AllCards.length} cards</div>
                    <div style={{ marginTop: 10, color: '#ff9800', fontSize: '0.75rem', ...monoStyle }}>✓ Ready to pick deck</div>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: '1.5rem' }}>

              {/* Rules reminder */}
              <div style={{ ...monoStyle, fontSize: '0.68rem', color: 'rgba(168,230,255,0.35)', textAlign: 'center', lineHeight: 1.7, maxWidth: 480 }}>
                ⚠ Each player must choose <strong style={{ color: 'rgba(168,230,255,0.55)' }}>3 cards of 3 different rarities</strong> before the battle.
                <br />The loser forfeits one random card to the winner.
              </div>

              <button onClick={handleGoToCardPick} disabled={!p1Ready || !p2Ready || !p1CanBattle} style={{
                padding: '14px 48px', borderRadius: 12, border: 'none', cursor: p1Ready && p2Ready && p1CanBattle ? 'pointer' : 'not-allowed',
                background: p1Ready && p2Ready && p1CanBattle ? 'linear-gradient(135deg,#a8e6ff,#60b8e0)' : 'rgba(168,230,255,0.1)',
                color: p1Ready && p2Ready && p1CanBattle ? '#0d1117' : 'rgba(168,230,255,0.3)',
                fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.12em',
                boxShadow: p1Ready && p2Ready && p1CanBattle ? '0 4px 24px rgba(168,230,255,0.3)' : 'none',
                transition: 'all 0.2s',
              }}>⚔ PICK YOUR DECKS ⚔</button>
              <button onClick={() => { window.location.hash = '/student'; }}
                style={{ background: 'transparent', border: '1px solid rgba(168,230,255,0.15)', borderRadius: 8, color: 'rgba(168,230,255,0.4)', padding: '8px 20px', cursor: 'pointer', ...monoStyle, fontSize: '0.75rem' }}>
                ← Back to Collection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CARD PICK ─────────────────────────────────────────────── */}
      {screen === 'cardpick' && (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '2rem 1rem' }}>
          <div style={{ ...panelStyle, width: '100%', maxWidth: 900, padding: '2rem' }}>
            {cardPickStep === 'p1pick' && (
              <CardPicker
                playerName={p1Name}
                allCards={p1AllCards}
                onConfirm={handleP1CardsPicked}
                accentColor="#a8e6ff"
                monoStyle={monoStyle}
              />
            )}
            {cardPickStep === 'p2pick' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ ...monoStyle, fontSize: '0.7rem', color: 'rgba(168,230,255,0.35)', letterSpacing: '0.2em' }}>
                    ✓ {p1Name} locked in their deck. Hand device to {p2Name}.
                  </div>
                </div>
                <CardPicker
                  playerName={p2Name}
                  allCards={p2AllCards}
                  onConfirm={handleP2CardsPicked}
                  accentColor="#ffe080"
                  monoStyle={monoStyle}
                />
              </>
            )}
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button onClick={() => {
                if (cardPickStep === 'p2pick') { setCardPickStep('p1pick'); setP1Cards([]); }
                else { setScreen('setup'); }
              }} style={{ background: 'transparent', border: '1px solid rgba(168,230,255,0.15)', borderRadius: 8, color: 'rgba(168,230,255,0.4)', padding: '8px 20px', cursor: 'pointer', ...monoStyle, fontSize: '0.75rem' }}>
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BATTLE ───────────────────────────────────────────────── */}
      {screen === 'battle' && p1Card && p2Card && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '1rem' }}>

          {/* Turn header */}
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{
              display: 'inline-block', padding: '6px 28px', borderRadius: 20,
              background: 'rgba(168,230,255,0.08)', border: '1px solid rgba(168,230,255,0.2)',
              color: '#a8e6ff', fontFamily: "'Cinzel',serif", fontWeight: 800, fontSize: '1rem', letterSpacing: '0.1em',
            }}>
              {currentPlayerName.toUpperCase()}'S TURN
            </div>
          </div>

          {/* Cards row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>

            {/* P1 card */}
            <div id="p1-card-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'transform 0.3s', transform: shakingCard === 'p1' ? 'translateX(-8px)' : 'none' }}>
              {p1Card.card_source === 'built' ? <BuiltCard card={p1Card} /> : <PokeCard card={p1Card} />}
              <HPBar hp={battle.p1HP} maxHP={battle.p1MaxHP} name={p1Name} />
              {damageFloats.filter(f => f.side === 'p1').map(f => (
                <div key={f.id} style={{ position: 'absolute', fontSize: '1.4rem', fontWeight: 900, color: '#f44336', fontFamily: "'Cinzel',serif", animation: 'float 1.2s ease-out forwards', pointerEvents: 'none', textShadow: '0 0 10px #f44336' }}>{f.value}</div>
              ))}
            </div>

            {/* VS */}
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#a8e6ff22,#60b8e022)', border: '2px solid rgba(168,230,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: '1rem', color: '#a8e6ff', flexShrink: 0, boxShadow: '0 0 20px rgba(168,230,255,0.15)' }}>VS</div>

            {/* P2 card */}
            <div id="p2-card-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'transform 0.3s', transform: shakingCard === 'p2' ? 'translateX(8px)' : 'none' }}>
              {p2Card.card_source === 'built' ? <BuiltCard card={p2Card} /> : <PokeCard card={p2Card} />}
              <HPBar hp={battle.p2HP} maxHP={battle.p2MaxHP} name={p2Name} />
              {damageFloats.filter(f => f.side === 'p2').map(f => (
                <div key={f.id} style={{ position: 'absolute', fontSize: '1.4rem', fontWeight: 900, color: '#f44336', fontFamily: "'Cinzel',serif", animation: 'float 1.2s ease-out forwards', pointerEvents: 'none', textShadow: '0 0 10px #f44336' }}>{f.value}</div>
              ))}
            </div>
          </div>

          {/* Phase panel */}
          <div style={{ ...panelStyle, maxWidth: 560, margin: '0 auto', width: '100%', padding: '1.5rem' }}>

            {/* ── ROLL phase ── */}
            {turnPhase === 'roll' && (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '0.6rem', letterSpacing: '0.3em', color: 'rgba(168,230,255,0.4)', ...monoStyle }}>
                  ◈ {currentPlayerName.toUpperCase()} — ROLL THE DICE
                </div>
                <p style={{ fontSize: '0.78rem', color: 'rgba(168,230,255,0.5)', ...monoStyle }}>
                  Odd = Stat 1 &nbsp;·&nbsp; Even = Stat 2
                </p>

                <div onClick={handleRoll} style={{
                  cursor: diceRolling ? 'default' : 'pointer',
                  transition: 'transform 0.15s',
                  transform: diceRolling ? `rotate(${Math.random() * 40 - 20}deg) scale(1.1)` : 'scale(1)',
                  userSelect: 'none',
                }}>
                  <DiceFace value={diceValue} rolling={diceRolling} />
                </div>

                <button onClick={handleRoll} disabled={diceRolling} style={{
                  padding: '12px 36px', borderRadius: 10, border: '1px solid rgba(168,230,255,0.3)',
                  background: diceRolling ? 'rgba(168,230,255,0.04)' : 'rgba(168,230,255,0.1)',
                  color: diceRolling ? 'rgba(168,230,255,0.3)' : '#a8e6ff',
                  fontFamily: "'Cinzel',serif", fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.12em',
                  cursor: diceRolling ? 'not-allowed' : 'pointer',
                  boxShadow: diceRolling ? 'none' : '0 0 16px rgba(168,230,255,0.15)',
                  transition: 'all 0.2s',
                }}>
                  {diceRolling ? 'ROLLING…' : '🎲 ROLL DICE'}
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', marginTop: 4 }}>
                  {[1, 2].map(s => {
                    const card = battle.turn === 'p1' ? p1Card : p2Card;
                    const name = s === 1 ? card.stat1_name : card.stat2_name;
                    const val = s === 1 ? card.stat1_val : card.stat2_val;
                    return (
                      <div key={s} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(168,230,255,0.1)', background: 'rgba(168,230,255,0.03)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.55rem', color: 'rgba(168,230,255,0.35)', letterSpacing: '0.2em', ...monoStyle }}>STAT {s} ({s === 1 ? 'ODD' : 'EVEN'})</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#a8e6ff', ...monoStyle, marginTop: 2 }}>{val}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(168,230,255,0.5)', ...monoStyle }}>{name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── MATH phase ── */}
            {turnPhase === 'math' && mathState && (() => {
              const q = mathState.questions[mathState.currentQ];
              return (
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(168,230,255,0.4)', ...monoStyle, letterSpacing: '0.2em' }}>
                      STAT {mathState.statUsed} (DICE: {mathState.diceValue})
                    </div>
                    <div style={{
                      fontSize: '1.4rem', fontWeight: 900, ...monoStyle,
                      color: mathState.timeLeft <= 5 ? '#f44336' : mathState.timeLeft <= 10 ? '#ff9800' : '#a8e6ff',
                      textShadow: mathState.timeLeft <= 5 ? '0 0 12px #f44336' : 'none',
                      minWidth: 60, textAlign: 'right',
                    }}>
                      {mathState.timeLeft}s
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(168,230,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${(mathState.timeLeft / 20) * 100}%`, background: mathState.timeLeft <= 5 ? '#f44336' : mathState.timeLeft <= 10 ? '#ff9800' : '#a8e6ff', transition: 'width 0.9s linear, background 0.3s' }} />
                  </div>

                  <ScoreDots correct={mathState.correct} total={mathState.answered} />
                  <StrengthMeter correct={mathState.correct} />

                  <div style={{
                    fontSize: 'clamp(1.8rem,5vw,2.8rem)', fontWeight: 900, fontFamily: "'Cinzel',serif",
                    color: mathState.flash === 'correct' ? '#4caf82' : mathState.flash === 'wrong' ? '#f44336' : '#a8e6ff',
                    textShadow: mathState.flash === 'correct' ? '0 0 20px #4caf82' : mathState.flash === 'wrong' ? '0 0 20px #f44336' : '0 0 20px rgba(168,230,255,0.4)',
                    transition: 'color 0.15s, text-shadow 0.15s',
                    padding: '0.5rem 0',
                  }}>
                    {q.num1} × {q.num2} = ?
                  </div>

                  <input
                    ref={mathInputRef}
                    type="number"
                    inputMode="numeric"
                    value={mathState.input}
                    onChange={e => setMathState(prev => prev ? { ...prev, input: e.target.value } : null)}
                    onKeyDown={e => e.key === 'Enter' && handleAnswer()}
                    style={{
                      width: 140, padding: '12px', textAlign: 'center', fontSize: '1.5rem',
                      fontWeight: 900, ...monoStyle, borderRadius: 10,
                      border: `2px solid ${mathState.flash === 'correct' ? '#4caf82' : mathState.flash === 'wrong' ? '#f44336' : 'rgba(168,230,255,0.25)'}`,
                      background: 'rgba(13,17,23,0.8)', color: '#a8e6ff',
                      outline: 'none', transition: 'border-color 0.15s',
                    }}
                    autoFocus
                    placeholder="?"
                  />
                  <button onClick={handleAnswer} style={{
                    padding: '11px 40px', borderRadius: 10, border: '1px solid rgba(168,230,255,0.3)',
                    background: 'rgba(168,230,255,0.1)', color: '#a8e6ff',
                    fontFamily: "'Cinzel',serif", fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.1em',
                    cursor: 'pointer', boxShadow: '0 0 14px rgba(168,230,255,0.12)',
                  }}>ANSWER</button>

                  <div style={{ fontSize: '0.62rem', color: 'rgba(168,230,255,0.28)', ...monoStyle }}>
                    {mathState.currentQ + 1}/12 · Wrong answers subtract from your score!
                  </div>
                </div>
              );
            })()}

            {/* ── RESOLVE phase ── */}
            {turnPhase === 'resolve' && mathState && (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '0.6rem', letterSpacing: '0.3em', color: 'rgba(168,230,255,0.4)', ...monoStyle }}>◈ RESULT</div>

                <ScoreDots correct={mathState.correct} total={mathState.answered} />

                <div style={{
                  padding: '1.2rem 2rem', borderRadius: 14,
                  border: `1px solid ${resolveDamage > 0 ? 'rgba(244,67,54,0.3)' : 'rgba(168,230,255,0.15)'}`,
                  background: resolveDamage > 0 ? 'rgba(244,67,54,0.06)' : 'rgba(168,230,255,0.04)',
                }}>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(168,230,255,0.35)', letterSpacing: '0.25em', ...monoStyle, marginBottom: 6 }}>ATTACK STRENGTH {getStrengthPct(mathState.correct)}%</div>
                  <div style={{
                    fontSize: resolveDamage > 0 ? '2.5rem' : '1.5rem', fontWeight: 900, fontFamily: "'Cinzel',serif",
                    color: resolveDamage > 0 ? '#f44336' : '#a8e6ff',
                    textShadow: resolveDamage > 0 ? '0 0 20px #f44336' : 'none',
                  }}>
                    {resolveDamage > 0 ? `-${resolveDamage} HP` : '0 DAMAGE'}
                  </div>
                  {resolveDamage === 0 && <div style={{ fontSize: '0.72rem', color: 'rgba(168,230,255,0.4)', ...monoStyle, marginTop: 4 }}>Need 3+ correct to deal damage</div>}
                </div>

                <p style={{ fontSize: '0.78rem', color: 'rgba(168,230,255,0.55)', ...monoStyle, maxWidth: 340, lineHeight: 1.6 }}>{resolveMsg}</p>

                <button onClick={handleNextTurn} style={{
                  padding: '12px 36px', borderRadius: 10,
                  background: 'rgba(168,230,255,0.1)', border: '1px solid rgba(168,230,255,0.3)',
                  color: '#a8e6ff', fontFamily: "'Cinzel',serif", fontWeight: 800,
                  fontSize: '0.9rem', letterSpacing: '0.1em', cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(168,230,255,0.12)',
                }}>
                  {battle.turn === 'p1' ? `${p2Name.toUpperCase()}'S TURN →` : `${p1Name.toUpperCase()}'S TURN →`}
                </button>
              </div>
            )}
          </div>

          {/* Battle log */}
          <div style={{ ...panelStyle, maxWidth: 560, margin: '1rem auto 0', width: '100%', padding: '1rem 1.2rem' }}>
            <div style={{ fontSize: '0.55rem', letterSpacing: '0.25em', color: 'rgba(168,230,255,0.3)', ...monoStyle, marginBottom: 8 }}>◈ BATTLE LOG</div>
            <div style={{ maxHeight: 100, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[...battle.log].reverse().map((entry, i) => (
                <div key={i} style={{
                  fontSize: '0.68rem', ...monoStyle, padding: '2px 0',
                  color: entry.includes('WINS') ? '#f0c040' : entry.includes('fainted') ? '#f09090' : 'rgba(168,230,255,0.5)',
                  fontWeight: entry.includes('WINS') ? 800 : 400,
                  borderBottom: '1px solid rgba(168,230,255,0.04)',
                }}>{entry}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── GAME OVER ─────────────────────────────────────────────── */}
      {screen === 'gameover' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 20px rgba(168,230,255,0.5))' }}>🏆</div>
          <h1 style={{
            fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: 'clamp(2rem,5vw,3.5rem)',
            background: 'linear-gradient(135deg,#a8e6ff,#60b8e0,#a8e6ff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            marginBottom: '0.5rem',
          }}>{winner} WINS!</h1>
          <p style={{ color: 'rgba(168,230,255,0.4)', ...monoStyle, letterSpacing: '0.2em', fontSize: '0.72rem', marginBottom: '2rem' }}>BATTLE COMPLETE</p>

          {/* Stats */}
          <div style={{ ...panelStyle, maxWidth: 360, width: '100%', padding: '1.5rem', marginBottom: '1.5rem' }}>
            {[
              { l: 'TOTAL DAMAGE', v: battle.totalDamageP1 + battle.totalDamageP2 },
              { l: 'P1 CORRECT ANSWERS', v: battle.p1CorrectAnswers },
              { l: 'P2 CORRECT ANSWERS', v: battle.p2CorrectAnswers },
              { l: 'CARDS DEFEATED', v: battle.p1Idx + battle.p2Idx },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(168,230,255,0.06)' }}>
                <span style={{ fontSize: '0.65rem', color: 'rgba(168,230,255,0.4)', ...monoStyle, letterSpacing: '0.12em' }}>{s.l}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#a8e6ff', ...monoStyle }}>{s.v}</span>
              </div>
            ))}
          </div>

          {/* ── Card transfer result ── */}
          <div style={{ ...panelStyle, maxWidth: 400, width: '100%', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.6rem', letterSpacing: '0.25em', color: 'rgba(168,230,255,0.3)', ...monoStyle, marginBottom: 12 }}>◈ CARD TRANSFER</div>

            {transferLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 20, height: 20 }} />
                <span style={{ ...monoStyle, fontSize: '0.75rem', color: 'rgba(168,230,255,0.4)' }}>Transferring card…</span>
              </div>
            )}

            {!transferLoading && transferError && (
              <div style={{ color: '#ff8080', fontSize: '0.75rem', ...monoStyle }}>{transferError}</div>
            )}

            {!transferLoading && transferredCard && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: '1.8rem' }}>💸</div>
                <p style={{ ...monoStyle, fontSize: '0.8rem', color: 'rgba(168,230,255,0.7)', lineHeight: 1.6 }}>
                  <strong style={{ color: winnerSide === 'p1' ? '#a8e6ff' : '#ffe080' }}>{winner}</strong> won{' '}
                  <strong style={{ color: RARITY_COLOR[transferredCard.rarity] ?? '#fff' }}>
                    {transferredCard.card_name}
                  </strong>{' '}
                  <span style={{ color: RARITY_COLOR[transferredCard.rarity] ?? '#aaa', fontSize: '0.68rem' }}>
                    ({RARITY_LABEL[transferredCard.rarity] ?? transferredCard.rarity})
                  </span>
                  {' '}from the loser's deck!
                </p>
                <div style={{
                  padding: '8px 18px', borderRadius: 8,
                  border: `1px solid ${RARITY_COLOR[transferredCard.rarity] ?? 'rgba(168,230,255,0.2)'}`,
                  background: `${RARITY_COLOR[transferredCard.rarity] ?? '#a8e6ff'}11`,
                  ...monoStyle, fontSize: '0.72rem', color: RARITY_COLOR[transferredCard.rarity],
                }}>
                  {RARITY_LABEL[transferredCard.rarity]} · {transferredCard.type} · HP {transferredCard.hp}
                </div>
              </div>
            )}

            {!transferLoading && !transferredCard && !transferError && (
              <p style={{ ...monoStyle, fontSize: '0.72rem', color: 'rgba(168,230,255,0.3)' }}>Processing…</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => {
              setScreen('setup');
              setP2Ready(false);
              setP2AllCards([]);
              setP1Cards([]);
              setOpponentId('');
              setOpponentStudentId('');
              setTurnPhase('roll');
              setMathState(null);
              setVerifyPin('');
              setVerifyError('');
              setTransferredCard(null);
              setTransferError('');
              setWinnerSide(null);
              winRecordedRef.current = false;
            }}
              style={{ padding: '12px 28px', borderRadius: 10, background: 'rgba(168,230,255,0.1)', border: '1px solid rgba(168,230,255,0.3)', color: '#a8e6ff', fontFamily: "'Cinzel',serif", fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', letterSpacing: '0.1em' }}>
              ⚔ PLAY AGAIN
            </button>
            <button onClick={() => { window.location.hash = '/student'; }}
              style={{ padding: '12px 28px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(168,230,255,0.15)', color: 'rgba(168,230,255,0.5)', cursor: 'pointer', ...monoStyle, fontSize: '0.8rem' }}>
              ← Collection
            </button>
          </div>
        </div>
      )}

      {/* Confetti */}
      {showConfetti && Array.from({ length: 32 }, (_, i) => (
        <div key={i} className="confetti-piece" style={{
          left: `${Math.random() * 100}%`,
          backgroundColor: ['#a8e6ff','#60b8e0','#c080ff','#f0c040','#4caf82'][i % 5],
          animationDuration: `${2 + Math.random() * 2}s`,
          animationDelay: `${Math.random()}s`,
          width: `${4 + Math.random() * 6}px`,
          height: `${4 + Math.random() * 6}px`,
        }} />
      ))}
    </div>
  );
}

export default ArenaPage;

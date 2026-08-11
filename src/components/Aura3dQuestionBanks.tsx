import { useCallback, useEffect, useState } from 'react';
import {
  AURA3D_BANK_KEYS,
  buildAura3dClaudePrompt,
  loadAura3dDefaultBanks,
  loadAura3dQuestionBanks,
  parseAura3dQuestionsFromText,
  resetAura3dQuestionBank,
  saveAura3dQuestionBank,
  validateAura3dQuestions,
} from '../lib/supabase';
import type { Aura3dBankKey, Aura3dQuestion, Aura3dQuestionBank } from '../lib/supabase';

/* ─────────────────────────────────────────────────────────────
   3D AURA — KIOSK QUIZ QUESTION EDITOR (Teacher page)

   The kiosk in 3D Aura has four quiz buttons. Each one is a "slot" a
   teacher can take over with their own topic and 10 questions; a slot with
   no saved row keeps showing the built-in questions, and "Restore Default"
   just deletes the row again. Nothing here is per-student — whatever a
   teacher saves is what every one of their students sees.

   The "Ask Claude" flow exists because writing 40 good multiple-choice
   questions by hand is the actual barrier to using this at all: it hands
   the teacher a ready-made prompt with their topic and year level already
   filled in, and accepts the reply pasted straight back in.
───────────────────────────────────────────────────────────── */

const SLOT_LABELS: Record<Aura3dBankKey, string> = {
  landmark: 'Quiz Button 1',
  words: 'Quiz Button 2',
  people: 'Quiz Button 3',
  art: 'Quiz Button 4',
};

function blankQuestion(): Aura3dQuestion {
  return { q: '', o: ['', '', '', ''], a: 0 };
}

function tenBlankQuestions(): Aura3dQuestion[] {
  return Array.from({ length: 10 }, blankQuestion);
}

/** Deep copy so editing the form can never mutate the shared defaults object. */
function cloneQuestions(questions: Aura3dQuestion[]): Aura3dQuestion[] {
  return questions.map(item => ({ q: item.q, o: [...item.o], a: item.a }));
}

export default function Aura3dQuestionBanks({ teacherId }: { teacherId: string }) {
  const [defaults, setDefaults] = useState<Record<Aura3dBankKey, Aura3dQuestionBank> | null>(null);
  const [saved, setSaved] = useState<Partial<Record<Aura3dBankKey, Aura3dQuestionBank>>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [openKey, setOpenKey] = useState<Aura3dBankKey | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [defs, mine] = await Promise.all([loadAura3dDefaultBanks(), loadAura3dQuestionBanks(teacherId)]);
      setDefaults(defs);
      setSaved(mine);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load the quiz questions.');
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { reload(); }, [reload]);

  if (loading) {
    return <p style={{ fontSize: '0.78rem', color: 'var(--tp-muted)' }}>Loading quiz questions…</p>;
  }
  if (loadError || !defaults) {
    return <p style={{ fontSize: '0.78rem', color: '#f87171' }}>{loadError || 'Could not load the quiz questions.'}</p>;
  }

  return (
    <div>
      <p style={{ fontSize: '0.78rem', color: 'var(--tp-muted)', marginBottom: 16, lineHeight: 1.55 }}>
        The kiosk in 3D Aura has four quiz buttons. Replace any of them with your own topic and 10 questions,
        or leave them on the built-in ones. Students get $1 in-game for each correct answer.
        Changes apply to all of your students the next time they open 3D Aura.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {AURA3D_BANK_KEYS.map(key => (
          <BankRow
            key={key}
            bankKey={key}
            teacherId={teacherId}
            defaultBank={defaults[key]}
            savedBank={saved[key]}
            isOpen={openKey === key}
            onToggle={() => setOpenKey(openKey === key ? null : key)}
            onChanged={reload}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   One quiz slot: collapsed summary + the full editor when opened.
───────────────────────────────────────────────────────────── */
function BankRow({
  bankKey, teacherId, defaultBank, savedBank, isOpen, onToggle, onChanged,
}: {
  bankKey: Aura3dBankKey;
  teacherId: string;
  defaultBank: Aura3dQuestionBank;
  savedBank?: Aura3dQuestionBank;
  isOpen: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const isCustom = !!savedBank;
  const activeBank = savedBank ?? defaultBank;

  const [title, setTitle] = useState(activeBank.title);
  const [questions, setQuestions] = useState<Aura3dQuestion[]>(() =>
    isCustom ? cloneQuestions(activeBank.questions) : tenBlankQuestions()
  );
  const [ageLevel, setAgeLevel] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // "Ask Claude" state
  const [promptOpen, setPromptOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [copied, setCopied] = useState(false);

  // Re-sync the form whenever the underlying saved data changes (e.g. after a
  // save or a restore), so the editor never shows stale values.
  useEffect(() => {
    setTitle(activeBank.title);
    setQuestions(isCustom ? cloneQuestions(activeBank.questions) : tenBlankQuestions());
    setMsg('');
    setErr('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedBank]);

  function updateQuestion(index: number, patch: Partial<Aura3dQuestion>) {
    setQuestions(prev => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function updateOption(index: number, optIndex: number, value: string) {
    setQuestions(prev => prev.map((item, i) =>
      i === index ? { ...item, o: item.o.map((o, oi) => (oi === optIndex ? value : o)) } : item
    ));
  }

  const filledCount = questions.filter(item => item.q.trim()).length;

  async function handleSave() {
    setErr(''); setMsg('');
    const check = validateAura3dQuestions(questions);
    if (!check.ok) { setErr(check.error); return; }
    if (!title.trim()) { setErr('Give the quiz a title first — students see it on the kiosk button.'); return; }
    setBusy(true);
    try {
      await saveAura3dQuestionBank(teacherId, bankKey, { title, questions: check.questions });
      setMsg('Saved. Your students will see these next time they open 3D Aura.');
      onChanged();
    } catch (e: any) {
      setErr(e?.message || 'Could not save. Has the 3D Aura shared-worlds migration been run?');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreDefault() {
    setErr(''); setMsg('');
    if (!window.confirm(`Put "${SLOT_LABELS[bankKey]}" back to the original ${defaultBank.title} questions? Your custom questions for this button will be deleted.`)) return;
    setBusy(true);
    try {
      await resetAura3dQuestionBank(teacherId, bankKey);
      setMsg('Restored to the original questions.');
      onChanged();
    } catch (e: any) {
      setErr(e?.message || 'Could not restore the default questions.');
    } finally {
      setBusy(false);
    }
  }

  /** Loads the built-in questions into the editor as a starting point to tweak. */
  function handleStartFromDefaults() {
    setTitle(defaultBank.title);
    setQuestions(cloneQuestions(defaultBank.questions));
    setErr(''); setMsg('Loaded the original questions into the boxes below — edit them, then Save.');
  }

  const claudePrompt = buildAura3dClaudePrompt(title, ageLevel);

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(claudePrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setErr('Copying was blocked by the browser — select the text in the box and copy it manually.');
    }
  }

  function handleUsePasted() {
    setErr(''); setMsg('');
    const parsed = parseAura3dQuestionsFromText(pasteText);
    if (!parsed.ok) { setErr(parsed.error); return; }
    setQuestions(parsed.questions);
    setPasteText('');
    setMsg('10 questions loaded below. Check them over, then press Save.');
  }

  return (
    <div className="tp-panel" style={{ padding: 0, overflow: 'hidden' }}>
      {/* ── Collapsed header ── */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '14px 16px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', color: 'inherit',
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tp-muted)' }}>
            {SLOT_LABELS[bankKey]}
          </span>
          <span style={{ display: 'block', fontSize: '0.92rem', fontWeight: 800, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeBank.title}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{
            fontSize: '0.62rem', fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '4px 9px', borderRadius: 999,
            background: isCustom ? 'rgba(34,197,94,0.16)' : 'rgba(140,150,190,0.16)',
            color: isCustom ? '#22c55e' : 'var(--tp-muted)',
          }}>
            {isCustom ? 'Your questions' : 'Default'}
          </span>
          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{isOpen ? '▲' : '▼'}</span>
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: '0 16px 18px', borderTop: '1px solid var(--tp-border)' }}>

          {/* ── Title + year level ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0' }}>
            <div>
              <label className="tp-label">Quiz title (shown on the button)</label>
              <input
                className="tp-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Fractions"
                maxLength={40}
              />
            </div>
            <div>
              <label className="tp-label">Year level or age</label>
              <input
                className="tp-input"
                value={ageLevel}
                onChange={e => setAgeLevel(e.target.value)}
                placeholder="e.g. Year 4 (age 9)"
                maxLength={40}
              />
            </div>
          </div>

          {/* ── Ask Claude ── */}
          <div style={{
            border: '1px solid var(--tp-border)', borderRadius: 12, padding: 14, marginBottom: 16,
            background: 'rgba(140,120,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>✨ Let Claude write the questions</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--tp-muted)', marginTop: 3 }}>
                  Copy a ready-made prompt, paste it into Claude, then paste the answer back here.
                </div>
              </div>
              <button className="tp-btn-outline" onClick={() => setPromptOpen(o => !o)}>
                {promptOpen ? 'Hide' : 'Ask Claude'}
              </button>
            </div>

            {promptOpen && (
              <div style={{ marginTop: 14 }}>
                <label className="tp-label">Step 1 — copy this into Claude</label>
                <textarea
                  className="tp-input"
                  readOnly
                  value={claudePrompt}
                  rows={10}
                  onFocus={e => e.currentTarget.select()}
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.7rem', lineHeight: 1.5, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 16px' }}>
                  <button className="tp-btn-primary" onClick={handleCopyPrompt}>📋 Copy Prompt</button>
                  {copied && <span style={{ fontSize: '0.78rem', color: '#22c55e', fontWeight: 700 }}>✓ Copied</span>}
                  {!title.trim() && (
                    <span style={{ fontSize: '0.72rem', color: '#fbbf24' }}>Tip: fill in the title and year level first.</span>
                  )}
                </div>

                <label className="tp-label">Step 2 — paste Claude's answer here</label>
                <textarea
                  className="tp-input"
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  rows={6}
                  placeholder="Paste Claude's whole reply (or just the code block) here…"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.7rem', resize: 'vertical' }}
                />
                <button className="tp-btn-primary" onClick={handleUsePasted} style={{ marginTop: 8 }}>
                  ⬇ Fill in the 10 questions
                </button>
              </div>
            )}
          </div>

          {/* ── The 10 questions ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tp-label-color)' }}>
              Questions ({filledCount}/10 filled in)
            </div>
            <button className="tp-btn-outline" onClick={handleStartFromDefaults}>
              Start from the original {defaultBank.title} questions
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {questions.map((item, i) => (
              <div key={i} style={{ border: '1px solid var(--tp-border)', borderRadius: 10, padding: 12 }}>
                <label className="tp-label">Question {i + 1}</label>
                <input
                  className="tp-input"
                  value={item.q}
                  onChange={e => updateQuestion(i, { q: e.target.value })}
                  placeholder="Type the question…"
                />
                <div style={{ fontSize: '0.68rem', color: 'var(--tp-muted)', margin: '10px 0 6px' }}>
                  Tick the circle next to the correct answer.
                </div>
                {item.o.map((opt, oi) => (
                  <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                    <input
                      type="radio"
                      name={`${bankKey}-correct-${i}`}
                      checked={item.a === oi}
                      onChange={() => updateQuestion(i, { a: oi })}
                      style={{ width: 16, height: 16, flexShrink: 0 }}
                      title="Mark this as the correct answer"
                    />
                    <input
                      className="tp-input"
                      value={opt}
                      onChange={e => updateOption(i, oi, e.target.value)}
                      placeholder={`Answer ${String.fromCharCode(65 + oi)}`}
                      style={{ margin: 0 }}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>

          {/* ── Actions ── */}
          {err && <p style={{ fontSize: '0.78rem', color: '#f87171', marginTop: 14, fontWeight: 600 }}>{err}</p>}
          {msg && <p style={{ fontSize: '0.78rem', color: '#22c55e', marginTop: 14, fontWeight: 600 }}>{msg}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="tp-btn-primary" onClick={handleSave} disabled={busy}>
              {busy ? 'Saving…' : 'Save These Questions'}
            </button>
            <button className="tp-btn-outline" onClick={handleRestoreDefault} disabled={busy || !isCustom}>
              ↺ Restore Default Questions
            </button>
          </div>
          {!isCustom && (
            <p style={{ fontSize: '0.72rem', color: 'var(--tp-muted)', marginTop: 8 }}>
              This button is still using the original {defaultBank.title} questions — there's nothing to restore yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

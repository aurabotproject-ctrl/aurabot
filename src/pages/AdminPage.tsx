import { useState, useEffect, useCallback } from 'react';
import PokeCard from '../components/PokeCard';
import { Dashboard } from '../lib/dashboard';
import { Auth } from '../lib/auth';
import { sb } from '../lib/supabase';
import type { Session } from '../lib/auth';
import type { Card, Student } from '../lib/supabase';

type TabKey = 'teachers' | 'students' | 'allCards';

function AdminPage({ session, onSignOut }: { session: NonNullable<Session>; onSignOut: () => void }) {
  const [tab, setTab] = useState<TabKey>('teachers');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [stats, setStats] = useState({ teachers: 0, students: 0, totalCards: 0, goldRare: 0 });
  const [modal, setModal] = useState<{ type: string; data?: any } | null>(null);
  const [modalError, setModalError] = useState('');
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [grantingAll, setGrantingAll] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pList, sList, cList] = await Promise.all([
        Dashboard.getAllProfiles(),
        Dashboard.getAllStudents(),
        Dashboard.getAllCards(),
      ]);
      setProfiles(pList);
      setStudents(sList);
      setCards(cList);
      setStats({
        teachers: pList.filter((p: any) => p.role === 'teacher').length,
        students: sList.length,
        totalCards: cList.length,
        goldRare: cList.filter((c: Card) => c.rarity === 'gold-rare').length,
      });
    } catch (err: any) {
      console.error(err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showStatus = (msg: string) => { setStatusMsg(msg); setTimeout(() => setStatusMsg(''), 2000); };

  return (
    <div className="min-h-screen font-body" style={{ background: '#0f1629', color: '#f0ece0' }}>
      {/* Header */}
      <header className="sticky top-0 z-[100]" style={{ background: '#13151f', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mx-auto" style={{ maxWidth: 1200, padding: '0.9rem 2rem' }}>
          <span className="logo-gradient" style={{ fontSize: '1.3rem' }}>✦ ClassCard ✦</span>
          <div className="flex items-center gap-3">
            <span className="text-xs px-3 py-1 rounded-[20px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-dark)', color: '#8a8a9a' }}>
              {session.user.email}
            </span>
            <span className="text-xs px-3 py-1 rounded-[20px] font-extrabold tracking-widest uppercase" style={{ background: 'rgba(180,80,255,0.2)', color: '#d08fff', border: '1px solid rgba(180,80,255,0.4)' }}>
              Admin
            </span>
            <button onClick={onSignOut} className="btn-outline">Sign Out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto" style={{ maxWidth: 1200, padding: '1.5rem 2rem' }}>
        {/* Stat Counters */}
        <div className="stat-counters mb-6">
          {[
            { num: stats.teachers, label: 'Teachers' },
            { num: stats.students, label: 'Students' },
            { num: stats.totalCards, label: 'Cards Generated' },
            { num: stats.goldRare, label: 'Gold Rare' },
          ].map((s, i) => (
            <div key={i} className="stat-counter">
              <div className="sc-num">{s.num}</div>
              <div className="sc-label">{s.label}</div>
            </div>
          ))}
        </div>

        {statusMsg && <div className="alert-success mb-4">{statusMsg}</div>}

        {/* Welcome card bulk grant */}
        <div className="mb-4 p-4" style={{ background: 'linear-gradient(135deg,rgba(252,228,236,0.6),rgba(232,220,248,0.6))', borderRadius: 16, border: '1.5px solid rgba(244,143,177,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#8b3a6a', marginBottom: 2 }}>✦✦ Aura-Bot Welcome Card</div>
            <div style={{ fontSize: '0.75rem', color: '#a06080' }}>Grant the prismatic founder card to all existing students who don't have it yet.</div>
          </div>
          <button
            className="btn-gold"
            disabled={grantingAll}
            onClick={async () => {
              setGrantingAll(true);
              try {
                const count = await Dashboard.giveWelcomeCardToAll();
                showStatus(count === 0 ? 'All students already have the Welcome Card ✓' : `✦ Welcome Card granted to ${count} student${count !== 1 ? 's' : ''}!`);
                loadData();
              } catch (e: any) {
                showStatus('Error: ' + e.message);
              } finally {
                setGrantingAll(false);
              }
            }}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {grantingAll ? 'Granting…' : '✦ Grant to All'}
          </button>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          {([
            { key: 'teachers' as TabKey, label: 'Teachers' },
            { key: 'students' as TabKey, label: 'Students' },
            { key: 'allCards' as TabKey, label: 'All Cards' },
          ]).map(t => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Teachers Tab */}
        {tab === 'teachers' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display font-bold text-xs uppercase tracking-[0.15em]" style={{ color: '#c8a000' }}>
                Teacher Accounts
              </h2>
              <button onClick={() => setModal({ type: 'createTeacher' })} className="btn-gold btn-sm">+ Create Teacher</button>
            </div>
            {profiles.filter((p: any) => p.role === 'teacher').length === 0 ? (
              <div className="text-center py-8 text-sm" style={{ color: '#8a8a9a' }}>No teachers yet.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Name</th><th>Email</th><th>Students</th><th>Cards</th><th>Actions</th></tr></thead>
                <tbody>
                  {profiles.filter((p: any) => p.role === 'teacher').map((t: any) => (
                    <tr key={t.id}>
                      <td className="font-semibold">{t.name}</td>
                      <td className="text-xs" style={{ color: '#8a8a9a' }}>{t.email}</td>
                      <td>{students.filter(s => s.teacher_id === t.id).length}</td>
                      <td>{cards.filter(c => c.teacher_id === t.id).length}</td>
                      <td>
                        <div className="flex gap-1.5 flex-wrap">
                          <button onClick={() => setModal({ type: 'editTeacher', data: t })} className="btn-outline btn-sm" style={{ borderColor: 'rgba(200,160,0,0.35)', color: '#ffe080' }}>✏ Edit</button>
                          <button onClick={() => setModal({ type: 'resetPw', data: t })} className="btn-outline btn-sm" style={{ borderColor: 'rgba(80,200,120,0.35)', color: '#80e0a0' }}>🔑 Reset PW</button>
                          <button onClick={() => setModal({ type: 'deleteTeacher', data: t })} className="btn-danger btn-sm">🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Students Tab */}
        {tab === 'students' && (
          <div>
            <h2 className="font-display font-bold text-xs uppercase tracking-[0.15em] mb-4" style={{ color: '#c8a000' }}>All Students</h2>
            {students.length === 0 ? (
              <div className="text-center py-8 text-sm" style={{ color: '#8a8a9a' }}>No students yet.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Name</th><th>Teacher</th><th>Login Email</th><th>Cards</th><th>Actions</th></tr></thead>
                <tbody>
                  {students.map(s => {
                    const teacher = profiles.find((p: any) => p.id === s.teacher_id);
                    const hasWelcome = cards.some(c => c.student_id === s.id && c.card_name === Dashboard.WELCOME_CARD_NAME);
                    return (
                      <tr key={s.id}>
                        <td className="font-semibold">{s.name}</td>
                        <td className="text-xs" style={{ color: '#8a8a9a' }}>{teacher?.name || '—'}</td>
                        <td className="text-xs" style={{ color: '#8a8a9a' }}>{s.login_email || '—'}</td>
                        <td>{cards.filter(c => c.student_id === s.id).length}</td>
                        <td>
                          <div className="flex gap-1.5 flex-wrap">
                            <button onClick={() => setModal({ type: 'editStudent', data: s })} className="btn-outline btn-sm" style={{ borderColor: 'rgba(200,160,0,0.35)', color: '#ffe080' }}>✏ Edit</button>
                            <button onClick={() => setModal({ type: 'resetPwStudent', data: s })} className="btn-outline btn-sm" style={{ borderColor: 'rgba(80,200,120,0.35)', color: '#80e0a0' }}>🔑 Reset PW</button>
                            <button
                              disabled={hasWelcome}
                              title={hasWelcome ? 'Already has Welcome Card' : 'Give Aura-Bot Welcome Card'}
                              onClick={async () => {
                                try {
                                  await Dashboard.giveWelcomeCard(s.id, s.teacher_id);
                                  showStatus(`✦ Welcome Card given to ${s.name}!`);
                                  loadData();
                                } catch (e: any) {
                                  showStatus('Error: ' + e.message);
                                }
                              }}
                              className="btn-outline btn-sm"
                              style={{
                                borderColor: hasWelcome ? 'rgba(150,100,150,0.2)' : 'rgba(220,130,200,0.5)',
                                color: hasWelcome ? 'rgba(180,130,180,0.4)' : '#f0a0d8',
                                cursor: hasWelcome ? 'default' : 'pointer',
                              }}
                            >
                              {hasWelcome ? '✦ Has Card' : '✦ Give Card'}
                            </button>
                            <button onClick={() => setModal({ type: 'deleteStudentAdmin', data: s })} className="btn-danger btn-sm">🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* All Cards Tab */}
        {tab === 'allCards' && (
          <div>
            <h2 className="font-display font-bold text-xs uppercase tracking-[0.15em] mb-4" style={{ color: '#c8a000' }}>All Cards</h2>
            {cards.length === 0 ? (
              <div className="text-center py-8 text-sm" style={{ color: '#8a8a9a' }}>No cards yet.</div>
            ) : (
              <div className="flex flex-wrap gap-8">
                {cards.map(c => (
                  <div key={c.id} className="relative">
                    <PokeCard card={c} showShimmerBtn onClick={() => setDetailCard(c)} />
                    <div className="flex gap-1.5 justify-center mt-2 flex-wrap">
                      <button onClick={() => setModal({ type: 'editCard', data: c })} className="btn-outline btn-sm" style={{ borderColor: 'rgba(200,160,0,0.35)', color: '#ffe080' }}>✏ Edit</button>
                      <button onClick={() => handleRegenImage(c)} className="btn-outline btn-sm" style={{ borderColor: 'rgba(80,160,255,0.35)', color: '#a0b8f0' }}>🎨 New Image</button>
                      <button onClick={() => setModal({ type: 'deleteCard', data: c })} className="btn-danger btn-sm">🗑 Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {renderModal()}

      {/* Card Detail */}
      {detailCard && (
        <div className="modal-backdrop visible" onClick={() => setDetailCard(null)}>
          <div className="modal-card modal-card--wide" onClick={e => e.stopPropagation()}>
            <button onClick={() => setDetailCard(null)} className="absolute top-4 right-4 text-xl cursor-pointer" style={{ color: '#8a8a9a', background: 'none', border: 'none' }}>✕</button>
            <div className="flex gap-6 items-start flex-col md:flex-row">
              <div className="flex-shrink-0 self-center md:self-start"><PokeCard card={detailCard} /></div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-black text-2xl mb-2" style={{ color: '#f0ece0' }}>{detailCard.card_name}</h2>
                <p className="text-sm italic mb-4" style={{ color: '#8a8a9a' }}>"{detailCard.description}"</p>
                <div className="space-y-0">
                  {[
                    { l: 'HP', v: detailCard.hp.toString() },
                    { l: 'Type', v: detailCard.type },
                    { l: detailCard.stat1_name, v: detailCard.stat1_val.toString() },
                    { l: detailCard.stat2_name, v: detailCard.stat2_val.toString() },
                    { l: detailCard.stat3_name, v: detailCard.stat3_val.toString() },
                    { l: detailCard.move1_name, v: `${detailCard.move1_dmg} dmg` },
                    { l: detailCard.move2_name, v: `${detailCard.move2_dmg} dmg` },
                    { l: 'Awarded', v: new Date(detailCard.created_at).toLocaleDateString() },
                  ].map((r, i) => (
                    <div key={i} className="flex justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-xs uppercase tracking-wider" style={{ color: '#8a8a9a' }}>{r.l}</span>
                      <span className="text-sm font-bold text-white">{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderModal() {
    if (!modal) return null;
    switch (modal.type) {
      case 'createTeacher':
        return <AdminModal title="Create Teacher Account" onClose={() => setModal(null)}>
          <AdminForm fields={[
            { label: 'Teacher Name', name: 'name', type: 'text', placeholder: 'e.g. Ms. Smith' },
            { label: 'Email', name: 'email', type: 'email', placeholder: 'teacher@school.edu' },
            { label: 'Password', name: 'password', type: 'password', placeholder: 'Min. 6 characters' },
          ]} onSubmit={async vals => {
            setModalError('');
            try { await Auth.signUp(vals.email, vals.password, 'teacher', vals.name); showStatus('Teacher created'); loadData(); setModal(null); }
            catch (e: any) { setModalError(e.message); }
          }} submitLabel="Create Teacher" error={modalError} onCancel={() => setModal(null)} />
        </AdminModal>;
      case 'editTeacher':
        return <AdminModal title="✏ Edit Teacher" onClose={() => setModal(null)}>
          <AdminForm fields={[
            { label: 'Name', name: 'name', type: 'text', default: modal.data.name },
            { label: 'Email', name: 'email', type: 'email', default: modal.data.email },
          ]} onSubmit={async vals => {
            await sb.from('profiles').update({ name: vals.name, email: vals.email }).eq('id', modal.data.id);
            showStatus('Saved'); loadData(); setModal(null);
          }} submitLabel="Save Changes" error={modalError} onCancel={() => setModal(null)} />
        </AdminModal>;
      case 'resetPw':
        return <AdminModal title="🔑 Reset Teacher Password" onClose={() => setModal(null)}>
          <p className="text-sm mb-4" style={{ color: '#a0a0b0' }}>
            Setting new password for <strong className="text-white">{modal.data.name}</strong>
          </p>
          <ResetPasswordForm
            userId={modal.data.id}
            onSuccess={() => { showStatus('Password updated'); setModal(null); }}
            onCancel={() => setModal(null)}
            supabaseUrl="https://iunoahajcaaxmttdpgem.supabase.co"
            getToken={async () => { const { data: { session } } = await sb.auth.getSession(); return session?.access_token ?? ''; }}
          />
        </AdminModal>;
      case 'deleteTeacher':
        return <AdminModal title="🗑 Delete Account" onClose={() => setModal(null)} danger>
          <p className="text-sm mb-2 text-white">Delete <strong>{modal.data.name}</strong>?</p>
          <p className="text-sm mb-4" style={{ color: '#f09090' }}>Removes the teacher profile. Their students and cards are kept.</p>
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="btn-outline">Cancel</button>
          </div>
        </AdminModal>;
      case 'editStudent':
        return <AdminModal title="✏ Edit Student" onClose={() => setModal(null)}>
          <AdminForm fields={[
            { label: 'Student Name', name: 'name', type: 'text', default: modal.data.name },
            { label: 'Login Email', name: 'email', type: 'email', default: modal.data.login_email || '' },
          ]} onSubmit={async vals => {
            await sb.from('students').update({ name: vals.name, login_email: vals.email }).eq('id', modal.data.id);
            showStatus('Saved'); loadData(); setModal(null);
          }} submitLabel="Save Changes" error={modalError} onCancel={() => setModal(null)} />
        </AdminModal>;
      case 'resetPwStudent':
        return <AdminModal title="🔑 Reset Student Password" onClose={() => setModal(null)}>
          <p className="text-sm mb-4" style={{ color: '#a0a0b0' }}>
            Setting new password for <strong className="text-white">{modal.data.name}</strong>
          </p>
          <ResetPasswordForm
            userId={modal.data.auth_user_id}
            onSuccess={() => { showStatus('Password updated'); setModal(null); }}
            onCancel={() => setModal(null)}
            supabaseUrl="https://iunoahajcaaxmttdpgem.supabase.co"
            getToken={async () => { const { data: { session } } = await sb.auth.getSession(); return session?.access_token ?? ''; }}
          />
        </AdminModal>;
      case 'deleteStudentAdmin':
        return <AdminModal title="🗑 Delete Student" onClose={() => setModal(null)} danger>
          <p className="text-sm mb-2 text-white">Delete <strong>{modal.data.name}</strong>?</p>
          <p className="text-sm mb-4" style={{ color: '#f09090' }}>Also deletes ALL of this student's cards. Cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={async () => { await Dashboard.deleteStudent(modal.data.id); showStatus('Student deleted'); loadData(); setModal(null); }} className="btn-danger">Yes, Delete Everything</button>
            <button onClick={() => setModal(null)} className="btn-outline">Cancel</button>
          </div>
        </AdminModal>;
      case 'editCard':
        return <AdminModal title="✏ Edit Card" onClose={() => setModal(null)}>
          <AdminForm fields={[
            { label: 'Card Name', name: 'cardName', type: 'text', default: modal.data.card_name },
            { label: 'HP', name: 'hp', type: 'number', default: String(modal.data.hp) },
            { label: 'Description', name: 'description', type: 'textarea', default: modal.data.description },
            { label: 'Move 1 Name', name: 'm1n', type: 'text', default: modal.data.move1_name },
            { label: 'Move 1 Damage', name: 'm1d', type: 'number', default: String(modal.data.move1_dmg) },
            { label: 'Move 2 Name', name: 'm2n', type: 'text', default: modal.data.move2_name },
            { label: 'Move 2 Damage', name: 'm2d', type: 'number', default: String(modal.data.move2_dmg) },
          ]} onSubmit={async vals => {
            await Dashboard.updateCard(modal.data.id, {
              card_name: vals.cardName, hp: Number(vals.hp), description: vals.description,
              move1_name: vals.m1n, move1_dmg: Number(vals.m1d), move2_name: vals.m2n, move2_dmg: Number(vals.m2d),
            });
            showStatus('Card updated'); loadData(); setModal(null);
          }} submitLabel="Save Changes" error={modalError} onCancel={() => setModal(null)} />
        </AdminModal>;
      case 'deleteCard':
        return <AdminModal title="🗑 Delete Card" onClose={() => setModal(null)} danger>
          <p className="text-sm mb-2 text-white">Delete <strong>{modal.data.card_name}</strong>?</p>
          <p className="text-sm mb-4" style={{ color: '#f09090' }}>Cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={async () => { await Dashboard.deleteCard(modal.data.id); showStatus('Card deleted'); loadData(); setModal(null); }} className="btn-danger">Yes, Delete Card</button>
            <button onClick={() => setModal(null)} className="btn-outline">Cancel</button>
          </div>
        </AdminModal>;
      default: return null;
    }
  }

  async function handleRegenImage(card: Card) {
    try {
      const { AI } = await import('../lib/ai');
      const newUrl = AI.generateImageUrl(card.card_name + ' ' + card.type);
      await new Promise<void>(r => { const img = new Image(); img.onload = () => r(); img.onerror = () => r(); img.src = newUrl; setTimeout(r, 2000); });
      await Dashboard.updateCard(card.id, { image_url: newUrl });
      showStatus('Image regenerated'); loadData();
    } catch (e: any) { showStatus(e.message); }
  }
}

function AdminModal({ title, children, onClose, danger }: { title: string; children: React.ReactNode; onClose: () => void; danger?: boolean }) {
  return (
    <div className="modal-backdrop visible" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-xl cursor-pointer" style={{ color: '#8a8a9a', background: 'none', border: 'none' }}>✕</button>
        <h3 className="font-display font-bold text-lg mb-4" style={{ color: danger ? '#f09090' : '#f0ece0' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function AdminForm({ fields, onSubmit, submitLabel, error, onCancel }: {
  fields: { label: string; name: string; type: string; placeholder?: string; default?: string }[];
  onSubmit: (vals: Record<string, string>) => void;
  submitLabel: string;
  error: string;
  onCancel: () => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => { const i: Record<string, string> = {}; fields.forEach(f => i[f.name] = f.default || ''); return i; });
  const [submitting, setSubmitting] = useState(false);
  return (
    <form onSubmit={async e => { e.preventDefault(); setSubmitting(true); await onSubmit(vals); setSubmitting(false); }}>
      {fields.map(f => (
        <div key={f.name} className="mb-3">
          <label className="form-label">{f.label}</label>
          {f.type === 'textarea' ? (
            <textarea className="form-input resize-none" rows={2} placeholder={f.placeholder} value={vals[f.name] || ''} onChange={e => setVals(p => ({ ...p, [f.name]: e.target.value }))} />
          ) : (
            <input type={f.type} className="form-input" placeholder={f.placeholder} value={vals[f.name] || ''} onChange={e => setVals(p => ({ ...p, [f.name]: e.target.value }))} />
          )}
        </div>
      ))}
      {error && <div className="alert-error mb-3 text-xs">{error}</div>}
      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="btn-gold">{submitting ? 'Saving…' : submitLabel}</button>
        <button type="button" onClick={onCancel} className="btn-outline">Cancel</button>
      </div>
    </form>
  );
}


function ResetPasswordForm({ userId, onSuccess, onCancel, supabaseUrl, getToken }: {
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
  supabaseUrl: string;
  getToken: () => Promise<string>;
}) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setErr('');
    if (!pw || pw.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (pw !== pw2) { setErr('Passwords do not match.'); return; }
    if (!userId) { setErr('No linked account found for this user.'); return; }
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${supabaseUrl}/functions/v1/update-user-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId, newPassword: pw }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      onSuccess();
    } catch (e: any) {
      setErr(e.message);
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="mb-3">
        <label className="form-label">New Password</label>
        <input type="password" className="form-input" placeholder="Min. 6 characters" value={pw} onChange={e => setPw(e.target.value)} />
      </div>
      <div className="mb-3">
        <label className="form-label">Confirm Password</label>
        <input type="password" className="form-input" placeholder="Repeat new password" value={pw2} onChange={e => setPw2(e.target.value)} />
      </div>
      {err && <div className="alert-error mb-3 text-xs">{err}</div>}
      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={saving} className="btn-gold">{saving ? 'Saving…' : 'Set Password'}</button>
        <button onClick={onCancel} className="btn-outline">Cancel</button>
      </div>
    </div>
  );
}

export default AdminPage;

import { useState } from 'react';
import { sb } from '../lib/supabase';
import { Dashboard } from '../lib/dashboard';
import type { Session } from '../lib/auth';

const DEFAULT_PIN = '87654321';

export default function SetPinPage({ session, onDone, onSignOut }: {
  session: NonNullable<Session>;
  onDone: () => void;
  onSignOut: () => void;
}) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.length !== 8) { setError('Your new PIN must be exactly 8 digits.'); return; }
    if (/^(\d)\1{7}$/.test(pin)) { setError('PIN cannot be 8 of the same digit (e.g. 11111111).'); return; }
    if (pin === DEFAULT_PIN) { setError("You can't keep the starting PIN — please choose your own."); return; }
    if (pin !== confirmPin) { setError("Those PINs don't match — try typing them again."); return; }

    setSaving(true);
    try {
      const { error: authErr } = await sb.auth.updateUser({ password: pin });
      if (authErr) throw authErr;

      if (session.profile.student_id) {
        await Dashboard.markPinChanged(session.profile.student_id);
      }
      onDone();
    } catch (err: any) {
      setError(err.message || 'Could not set your new PIN — please try again.');
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at top, #1a2050 0%, #0a0e22 70%)', padding: 20 }}>
      <div style={{ maxWidth: 420, width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 22, padding: '34px 30px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: '2.4rem', textAlign: 'center', marginBottom: 6 }}>🔐</div>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white', textAlign: 'center', marginBottom: 6 }}>
          Set Your Secret PIN
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', marginBottom: 26, lineHeight: 1.5 }}>
          Welcome! Before you continue, choose your own 8-digit PIN.<br />Don't share it with anyone except your teacher.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            New 8-Digit PIN
          </label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="••••••••"
            autoFocus
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)', color: 'white', fontSize: '1.3rem', letterSpacing: '0.3em', textAlign: 'center', marginBottom: 16 }}
          />

          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Confirm New PIN
          </label>
          <input
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="••••••••"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)', color: 'white', fontSize: '1.3rem', letterSpacing: '0.3em', textAlign: 'center', marginBottom: 20 }}
          />

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 10, padding: '9px 14px', fontSize: '0.78rem', fontWeight: 700, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={saving} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#c084fc)', color: 'white', fontWeight: 900, fontSize: '0.95rem', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}>
            {saving ? 'Saving…' : '✓ Set My PIN'}
          </button>
        </form>

        <button onClick={onSignOut} style={{ display: 'block', margin: '18px auto 0', background: 'none', border: 'none', color: '#6070a0', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>
          Sign out instead
        </button>
      </div>
    </div>
  );
}

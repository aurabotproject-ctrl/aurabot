import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';

/* ─────────────────────────────────────────────
   3D Aura — embeds the standalone 3dAura Three.js
   app (served as static files from /public/3daura)
   inside the main ClassCard app via an iframe.

   Auth handshake: 3D Aura is a plain static page and can't read
   import.meta.env, so it can't know the Supabase project URL/anon key on
   its own, and relying on it independently finding a shared session via
   localStorage is fragile (it silently breaks if anything about how the
   client is constructed ever differs). Instead, once the iframe has
   loaded, this component - which already has a guaranteed-working,
   authenticated `sb` client - hands it the URL/key and the current
   session's tokens directly via postMessage. 3D Aura builds its own
   Supabase client from those exact values, so it's always talking to the
   same project this app just authenticated with.
───────────────────────────────────────────── */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function ThreeDAuraPage() {
  const [loaded, setLoaded] = useState(false);
  // Teachers come in as read-only visitors, and Back should return them to
  // their own page rather than dumping them on the student dashboard.
  const [isTeacher, setIsTeacher] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const { data: profile } = await sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
      setIsTeacher(profile?.role === 'teacher');
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;

    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      iframeWindow.postMessage({
        type: 'AURA3D_INIT',
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY,
        accessToken: session?.access_token ?? null,
        refreshToken: session?.refresh_token ?? null,
      }, window.location.origin);
    })();
  }, [loaded]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05070f', overflow: 'hidden' }}>
      {/* Back button — floats above the 3D app's own UI */}
      <button
        onClick={() => { window.location.hash = isTeacher ? '/teacher' : '/student'; }}
        title="Back to Collection"
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 100000,
          background: 'linear-gradient(135deg,#f06292,#ab47bc,#64b5f6)',
          border: 'none',
          borderRadius: 10,
          color: '#fff',
          fontFamily: "'Nunito', sans-serif",
          fontWeight: 900,
          fontSize: '0.72rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '10px 16px',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      >
        ✕ Exit 3D Aura
      </button>

      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, color: '#a8d8ff',
          fontFamily: "'Nunito', sans-serif",
        }}>
          <div className="spinner" />
          <div style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
            Loading 3D Aura…
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        title="3D Aura"
        src="/3daura/index.html"
        onLoad={() => setLoaded(true)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
        allow="fullscreen"
      />
    </div>
  );
}


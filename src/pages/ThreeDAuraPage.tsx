import { useState } from 'react';

/* ─────────────────────────────────────────────
   3D Aura — embeds the standalone 3dAura Three.js
   app (served as static files from /public/3daura)
   inside the main ClassCard app via an iframe.
───────────────────────────────────────────── */

export default function ThreeDAuraPage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05070f', overflow: 'hidden' }}>
      {/* Back button — floats above the 3D app's own UI */}
      <button
        onClick={() => { window.location.hash = '/student'; }}
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

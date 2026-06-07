import { useState, useEffect, useRef, useCallback } from 'react';
import { Auth } from '../lib/auth';

type Role = 'Admin' | 'Teacher' | 'Student';

function LoginPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const [overlayActive, setOverlayActive] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role>('Admin');
  const [studentPin, setStudentPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const stateRef = useRef({
    time: 0,
    mouseX: 0, mouseY: 0,
    targetMouseX: 0, targetMouseY: 0,
    isZoomed: false,
    zoom: 1.6, targetZoom: 1.6,
    zoomOffsetY: 0, targetZoomOffsetY: 0,
    blinkScaleY: 1,
    rippleRadius: 0, rippleAlpha: 0, rippleX: 0, rippleY: 0,
    currentRole: 'Admin' as Role,
    studentPin: '',
    // Stars
    stars: [] as { x: number; y: number; r: number; twinkleOffset: number; twinkleSpeed: number; brightness: number }[],
    // Asteroids
    asteroids: [] as { x: number; y: number; vx: number; vy: number; r: number; angle: number; spin: number; trail: number; active: boolean; timer: number }[],
    nextAsteroid: 3000,
  });

  useEffect(() => { stateRef.current.currentRole = currentRole; }, [currentRole]);
  useEffect(() => { stateRef.current.studentPin = studentPin; }, [studentPin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current;

    const theme = {
      base: '#c8d8f0',
      dark: '#8090b8',
      screenDark: '#0d1117',
      accent: '#a8e6ff',
    };

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!s.isZoomed) s.targetZoom = window.innerWidth < 600 ? 1.2 : 1.6;
    }
    resize();
    window.addEventListener('resize', resize);

    // Initialise stars
    const initStars = () => {
      s.stars = Array.from({ length: 180 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.6 + 0.3,
        twinkleOffset: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.0008 + Math.random() * 0.002,
        brightness: 0.4 + Math.random() * 0.6,
      }));
    };
    initStars();
    window.addEventListener('resize', initStars);

    function drawRoundRect(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    }

    function scheduleBlink() {
      setTimeout(() => {
        s.blinkScaleY = 0.1;
        setTimeout(() => { s.blinkScaleY = 1; }, 150);
        scheduleBlink();
      }, Math.random() * 4000 + 2000);
    }
    scheduleBlink();

    function render(timestamp: number) {
      const W = window.innerWidth;
      const H = window.innerHeight;
      s.time = timestamp;
      ctx.clearRect(0, 0, W, H);

      // ── Space background ──────────────────────────────────────────
      // Deep space gradient
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.85);
      bg.addColorStop(0,   '#0d1b3e');
      bg.addColorStop(0.4, '#08112a');
      bg.addColorStop(0.8, '#050c1a');
      bg.addColorStop(1,   '#020608');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nebula glow — subtle purple/teal clouds
      const neb1 = ctx.createRadialGradient(W * 0.75, H * 0.25, 0, W * 0.75, H * 0.25, W * 0.35);
      neb1.addColorStop(0,   'rgba(80,40,140,0.18)');
      neb1.addColorStop(1,   'rgba(80,40,140,0)');
      ctx.fillStyle = neb1; ctx.fillRect(0, 0, W, H);

      const neb2 = ctx.createRadialGradient(W * 0.2, H * 0.7, 0, W * 0.2, H * 0.7, W * 0.3);
      neb2.addColorStop(0,   'rgba(20,80,120,0.15)');
      neb2.addColorStop(1,   'rgba(20,80,120,0)');
      ctx.fillStyle = neb2; ctx.fillRect(0, 0, W, H);

      // Stars
      for (const star of s.stars) {
        const twinkle = star.brightness * (0.55 + 0.45 * Math.sin(timestamp * star.twinkleSpeed + star.twinkleOffset));
        // Occasional sparkle cross on larger stars
        if (star.r > 1.2 && twinkle > 0.85) {
          ctx.strokeStyle = `rgba(180,220,255,${twinkle * 0.5})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(star.x - star.r * 3, star.y); ctx.lineTo(star.x + star.r * 3, star.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(star.x, star.y - star.r * 3); ctx.lineTo(star.x, star.y + star.r * 3); ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,225,255,${twinkle})`;
        ctx.fill();
      }

      // Asteroids
      // Spawn new asteroid occasionally
      if (timestamp > s.nextAsteroid) {
        const fromTop = Math.random() > 0.5;
        const ast = {
          x: fromTop ? Math.random() * W * 1.2 - W * 0.1 : -60,
          y: fromTop ? -60 : Math.random() * H * 0.6,
          vx: fromTop ? (Math.random() * 3 + 2) * (Math.random() > 0.5 ? 1 : -1) : Math.random() * 4 + 3,
          vy: fromTop ? Math.random() * 3 + 2 : Math.random() * 2 - 1,
          r: Math.random() * 8 + 4,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.06,
          trail: Math.random() * 30 + 20,
          active: true,
          timer: 0,
        };
        s.asteroids.push(ast);
        s.nextAsteroid = timestamp + 4000 + Math.random() * 6000;
      }

      // Draw & move asteroids
      s.asteroids = s.asteroids.filter(a => a.active);
      for (const a of s.asteroids) {
        a.x += a.vx; a.y += a.vy; a.angle += a.spin; a.timer++;
        if (a.x > W + 100 || a.y > H + 100 || a.x < -100) { a.active = false; continue; }

        // Trail
        const grad = ctx.createLinearGradient(a.x, a.y, a.x - a.vx * a.trail, a.y - a.vy * a.trail);
        grad.addColorStop(0,   'rgba(200,210,255,0.7)');
        grad.addColorStop(0.4, 'rgba(160,180,255,0.3)');
        grad.addColorStop(1,   'rgba(100,120,220,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = a.r * 0.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x - a.vx * a.trail, a.y - a.vy * a.trail);
        ctx.stroke();

        // Rock body
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.angle);
        ctx.fillStyle = 'rgba(160,170,190,0.9)';
        ctx.beginPath();
        ctx.ellipse(0, 0, a.r, a.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(100,110,130,0.5)';
        ctx.beginPath();
        ctx.ellipse(a.r * 0.15, -a.r * 0.1, a.r * 0.3, a.r * 0.2, 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(220,230,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(-a.r * 0.2, -a.r * 0.2, a.r * 0.25, a.r * 0.15, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // ── End space background ──────────────────────────────────────

      s.mouseX += (s.targetMouseX - s.mouseX) * 0.1;
      s.mouseY += (s.targetMouseY - s.mouseY) * 0.1;
      s.zoom += (s.targetZoom - s.zoom) * 0.08;
      s.zoomOffsetY += (s.targetZoomOffsetY - s.zoomOffsetY) * 0.08;

      ctx.save();
      ctx.translate(W / 2, H / 2 + s.zoomOffsetY);
      ctx.scale(s.zoom, s.zoom);

      const breatheY = Math.sin(timestamp * 0.002) * -3;
      const armSway = Math.sin(timestamp * 0.0015) * 0.03;

      // Legs & Arms
      [-1, 1].forEach(side => {
        ctx.save();
        ctx.translate(side * 45, 140);
        ctx.fillStyle = theme.base;
        drawRoundRect(-30, -50, 60, 100, 25);
        ctx.restore();

        ctx.save();
        ctx.translate(side * 105, breatheY + 15);
        ctx.rotate(side * 0.05 + armSway * side);
        ctx.fillStyle = theme.dark;
        ctx.beginPath(); ctx.arc(-side * 5, 0, 25, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = theme.base;
        drawRoundRect(-20, 0, 40, 100, 20);
        ctx.restore();
      });

      // Torso
      ctx.save();
      ctx.translate(0, breatheY);
      ctx.fillStyle = theme.dark;
      drawRoundRect(-25, -50, 50, 30, 10);
      ctx.fillStyle = theme.base;
      drawRoundRect(-80, -35, 160, 145, 35);

      // Chest screen
      ctx.save();
      ctx.translate(0, 35);
      ctx.fillStyle = theme.screenDark;
      drawRoundRect(-50, -45, 100, 80, 14);

      ctx.save();
      ctx.beginPath(); ctx.roundRect(-50, -45, 100, 80, 14); ctx.clip();
      ctx.textAlign = 'center';

      if (s.isZoomed) {
        ctx.fillStyle = theme.accent;
        ctx.font = 'bold 8px monospace';
        ctx.fillText(s.currentRole.toUpperCase() + ' ACCESS', 0, -32);
        if (s.currentRole === 'Student') {
          ctx.fillStyle = 'rgba(168,230,255,0.2)';
          ctx.fillRect(-35, -24, 70, 8);
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ctx.fillRect(-22 + i * 16, -10 + j * 12, 12, 8);
          ctx.fillStyle = theme.accent;
          ctx.font = 'bold 10px monospace';
          ctx.fillText(s.studentPin.replace(/./g, '*'), 0, 32);
        } else {
          ctx.strokeStyle = theme.accent; ctx.lineWidth = 1;
          ctx.strokeRect(-35, -15, 70, 12); ctx.strokeRect(-35, 5, 70, 12);
          ctx.fillStyle = theme.accent; ctx.font = '6px monospace';
          ctx.fillText('PASSWORD REQ', 0, 28);
        }
      } else {
        if (Math.random() > 0.05) {
          ctx.fillStyle = theme.accent;
          ctx.font = 'bold 12px monospace';
          ctx.fillText('Aurabot', 0, -16);
          ctx.font = 'bold 7px monospace';
          ctx.fillText('Project', 0, -4);
        }
        ctx.fillStyle = theme.accent; ctx.font = '8px monospace';
        const off = (timestamp * 0.03) % 150;
        ctx.fillText('SECURE LOGIN PENDING', 75 - off, 15);
      }
      ctx.restore(); ctx.restore(); ctx.restore();

      // Head
      ctx.save();
      ctx.translate(s.mouseX * 20, -132 + breatheY * 0.5 + s.mouseY * 10);
      ctx.fillStyle = theme.base;
      drawRoundRect(-95, -80, 190, 160, 40);
      ctx.fillStyle = theme.screenDark;
      drawRoundRect(-75, -50, 150, 100, 20);
      [-1, 1].forEach(side => {
        ctx.save();
        ctx.translate(side * 30 + s.mouseX * 10, s.mouseY * 5);
        ctx.scale(1, s.blinkScaleY);
        ctx.fillStyle = theme.accent;
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      ctx.restore();

      ctx.restore(); // main

      // Ripple
      if (s.rippleAlpha > 0) {
        ctx.beginPath();
        ctx.arc(s.rippleX + W / 2, s.rippleY + H / 2, s.rippleRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168,230,255,${s.rippleAlpha})`;
        ctx.fill();
        s.rippleRadius += 10; s.rippleAlpha -= 0.04;
      }

      animRef.current = requestAnimationFrame(render);
    }
    animRef.current = requestAnimationFrame(render);

    const handleMouseMove = (e: MouseEvent) => {
      if (s.isZoomed) return;
      s.targetMouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      s.targetMouseY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    };
    document.addEventListener('mousemove', handleMouseMove);

    const handleClick = (e: MouseEvent) => {
      if (s.isZoomed) return;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const dx = e.clientX - W / 2;
      const dy = e.clientY - H / 2;
      const chestCenterY = 40 * s.zoom;
      if (Math.abs(dx) < 60 * s.zoom && Math.abs(dy - chestCenterY) < 60 * s.zoom) {
        s.isZoomed = true;
        s.targetZoom = W < 600 ? 2.6 : 3.8;
        s.targetZoomOffsetY = -30;
        s.rippleRadius = 1; s.rippleAlpha = 1; s.rippleX = dx; s.rippleY = dy;
        setTimeout(() => setOverlayActive(true), 500);
      }
    };
    canvas.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', initStars);
      document.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, []);

  const handleClose = () => {
    setOverlayActive(false);
    setError('');
    const s = stateRef.current;
    setTimeout(() => {
      s.isZoomed = false;
      s.targetZoom = window.innerWidth < 600 ? 1.2 : 1.6;
      s.targetZoomOffsetY = 0;
    }, 400);
  };

  const pinInputRef = useRef<HTMLInputElement>(null);

  const addPin = (digit: string) => setStudentPin(prev => prev.length < 8 ? prev + digit : prev);
  const clearPin = () => setStudentPin('');

  // Keyboard support: feed keys into the PIN only when the pin input is NOT focused
  // (when it IS focused, onChange handles typing directly — no double-entry)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!overlayActive || currentRole !== 'Student') return;
      if (document.activeElement === pinInputRef.current) return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (/^[0-9]$/.test(e.key)) setStudentPin(prev => prev.length < 8 ? prev + e.key : prev);
      else if (e.key === 'Backspace') setStudentPin(p => p.slice(0, -1));
      else if (e.key === 'Escape') setStudentPin('');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [overlayActive, currentRole]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const loginEmail = email.trim();
    const loginPassword = currentRole === 'Student' ? studentPin : password;
    if (!loginEmail) { setError('Please enter your email.'); return; }
    if (!loginPassword) { setError(currentRole === 'Student' ? 'Please enter your PIN on the keypad.' : 'Please enter your password.'); return; }
    if (currentRole === 'Student' && loginPassword.length !== 8) { setError('PIN must be 8 digits.'); return; }
    setLoading(true);
    try {
      await Auth.signIn(loginEmail, loginPassword);
      const s = await Auth.getSession();
      if (s) {
        const dbRole = s.profile.role;
        const selectedRole = currentRole.toLowerCase();
        if (dbRole === 'admin') {
          const target = selectedRole === 'admin' ? '/admin' : selectedRole === 'teacher' ? '/teacher' : '/student';
          window.location.hash = target;
        } else if (dbRole === selectedRole) {
          Auth.redirectByRole(dbRole);
        } else {
          setError(`This account is a ${dbRole} account. Please select ${dbRole.charAt(0).toUpperCase() + dbRole.slice(1)} above.`);
          await Auth.signOut();
          setLoading(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.');
      setLoading(false);
    }
  }, [email, password, studentPin, currentRole]);

  const switchRole = (role: Role) => { setCurrentRole(role); setError(''); setStudentPin(''); setPassword(''); };

  return (
    <>
      <style>{`
        .cc-key-btn:hover  { background: rgba(168,230,255,0.12) !important; }
        .cc-key-btn:active { background: #a8e6ff !important; color: #0d1117 !important; }
        .cc-input:focus { border-color: #a8e6ff !important; }
        .cc-login-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
      `}</style>

      {/* Background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: `
          radial-gradient(ellipse at 20% 30%, rgba(255,220,230,0.6) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, rgba(200,230,255,0.5) 0%, transparent 50%),
          linear-gradient(170deg, #f0e4e8 0%, #e8dce4 30%, #dce8f0 70%, #f0ebe4 100%)
        `,
      }} />

      {/* Noise texture */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, opacity: 0.15, pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }} />

      {/* Vignette */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'radial-gradient(ellipse at center, transparent 60%, rgba(120,90,100,0.06) 100%)',
      }} />

      {/* Canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 10 }} />

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 35, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(120,100,110,0.55)', fontSize: '0.88rem', zIndex: 50,
        pointerEvents: 'none', fontWeight: 500,
        opacity: overlayActive ? 0 : 1, transition: 'opacity 0.3s',
      }}>
        Touch the chest screen to login
      </div>

      {/* Login overlay */}
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: overlayActive ? 'rgba(13,17,23,0.4)' : 'rgba(0,0,0,0)',
        backdropFilter: overlayActive ? 'blur(12px)' : 'blur(0px)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 100, pointerEvents: overlayActive ? 'all' : 'none',
        transition: 'all 0.8s ease',
      }}>
        <button onClick={handleClose} style={{
          position: 'absolute', top: 20, right: 20, width: 42, height: 42,
          background: '#0d1117', border: '1px solid rgba(168,230,255,0.2)',
          borderRadius: '50%', fontSize: '1.3rem', color: '#a8e6ff',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          opacity: overlayActive ? 1 : 0, transition: 'opacity 0.3s',
        }}>&times;</button>

        <div style={{
          background: '#0d1117', padding: 30, borderRadius: 28,
          boxShadow: '0 25px 70px rgba(0,0,0,0.4), 0 0 0 1px rgba(168,230,255,0.2)',
          width: 380, textAlign: 'center',
          transform: overlayActive ? 'scale(1) translateY(0)' : 'scale(0.75) translateY(40px)',
          opacity: overlayActive ? 1 : 0,
          transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          color: '#a8e6ff',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        }}>
          {/* Role selector */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 25, justifyContent: 'center' }}>
            {(['Admin', 'Teacher', 'Student'] as Role[]).map(role => (
              <button key={role} onClick={() => switchRole(role)} style={{
                flex: 1, padding: 10,
                border: `1px solid ${currentRole === role ? '#a8e6ff' : 'rgba(168,230,255,0.2)'}`,
                borderRadius: 12,
                background: currentRole === role ? 'rgba(168,230,255,0.15)' : 'rgba(168,230,255,0.05)',
                color: currentRole === role ? '#a8e6ff' : 'rgba(168,230,255,0.6)',
                fontSize: '0.7rem', fontWeight: 700,
                boxShadow: currentRole === role ? '0 0 15px rgba(168,230,255,0.2)' : 'none',
                transition: 'all 0.2s',
              }}>{role.toUpperCase()}</button>
            ))}
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)',
              color: '#ff8080', borderRadius: 10, padding: '10px 14px',
              fontSize: '0.82rem', marginBottom: 15, textAlign: 'left',
            }}>{error}</div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 15, textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: 5, color: 'rgba(168,230,255,0.5)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05rem' }}>
                {currentRole === 'Student' ? 'Student Email' : 'Email'}
              </label>
              <input className="cc-input" type="email" placeholder="you@school.edu"
                value={email} onChange={e => setEmail(e.target.value)} disabled={loading}
                style={{ width: '100%', padding: 12, border: '1px solid rgba(168,230,255,0.2)', borderRadius: 12, fontSize: '0.95rem', background: 'rgba(22,27,34,0.8)', color: '#fff', boxSizing: 'border-box', transition: 'border-color 0.3s', fontFamily: 'inherit', outline: 'none' }}
              />
            </div>

            {currentRole !== 'Student' && (
              <div style={{ marginBottom: 15, textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: 5, color: 'rgba(168,230,255,0.5)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05rem' }}>Password</label>
                <input className="cc-input" type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} disabled={loading}
                  style={{ width: '100%', padding: 12, border: '1px solid rgba(168,230,255,0.2)', borderRadius: 12, fontSize: '0.95rem', background: 'rgba(22,27,34,0.8)', color: '#fff', boxSizing: 'border-box', transition: 'border-color 0.3s', fontFamily: 'inherit', outline: 'none' }}
                />
              </div>
            )}

            {currentRole === 'Student' && (
              <>
                <div style={{ marginBottom: 10, textAlign: 'left' }}>
                  <label style={{ display: 'block', marginBottom: 5, color: 'rgba(168,230,255,0.5)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05rem' }}>Student PIN</label>
                  <input ref={pinInputRef} type="password" value={studentPin} onChange={e => setStudentPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Type or tap keypad"
                    style={{ width: '100%', padding: 12, border: '1px solid rgba(168,230,255,0.2)', borderRadius: 12, fontSize: '0.95rem', background: 'rgba(22,27,34,0.8)', color: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                  {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(k => (
                    <button key={k} type="button" className="cc-key-btn"
                      onClick={() => k === 'C' ? clearPin() : k === '⌫' ? setStudentPin(p => p.slice(0, -1)) : addPin(k)}
                      style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(168,230,255,0.1)', borderRadius: 10, fontWeight: 'bold', color: '#a8e6ff', fontSize: '1.1rem', transition: '0.2s', fontFamily: 'inherit' }}
                    >{k}</button>
                  ))}
                </div>
              </>
            )}

            <button type="submit" disabled={loading} className="cc-login-btn"
              style={{ width: '100%', padding: 15, marginTop: 20, background: '#a8e6ff', color: '#0d1117', border: 'none', borderRadius: 14, fontSize: '1rem', fontWeight: 800, boxShadow: '0 4px 20px rgba(168,230,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1rem', opacity: loading ? 0.6 : 1, transition: 'all 0.2s', fontFamily: 'inherit' }}
            >{loading ? 'Connecting…' : 'Secure Login'}</button>
          </form>
        </div>
      </div>
    </>
  );
}

export default LoginPage;

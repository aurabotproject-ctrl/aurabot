import React, { useState, useEffect, useCallback } from 'react';
import PokeCard from '../components/PokeCard';
import { Auth } from '../lib/auth';
import { Dashboard } from '../lib/dashboard';
import { AI } from '../lib/ai';
import { sb } from '../lib/supabase';
import type { Session } from '../lib/auth';
import type { Student, Card } from '../lib/supabase';

type TabKey = 'generate' | 'weekly' | 'cards' | 'cardcreation' | 'students' | 'stars' | 'homecomms' | 'settings';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'generate',     label: '✦ Card Creation' },
  { key: 'weekly',       label: '📋 Weekly Project' },
  { key: 'cards',        label: '🃏 Card Database' },
  { key: 'cardcreation', label: '➕ Add Card' },
  { key: 'students',     label: 'Students' },
  { key: 'stars',        label: '⭐ Stars' },
  { key: 'homecomms',    label: '🏠 Home Communication' },
  { key: 'settings',     label: 'Settings' },
];

const TP_STYLES = `
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        .tp-page * { font-family: 'Nunito','Segoe UI',sans-serif !important; }
        .tp-dark  { --tp-panel:rgba(8,18,50,0.82); --tp-border:rgba(60,100,200,0.22); --tp-shadow:0 4px 24px rgba(0,0,0,0.45); --tp-outer:rgba(8,18,48,0.72); --tp-outer-border:rgba(80,120,255,0.18); --tp-outer-shadow:0 20px 80px rgba(0,0,0,0.6); --tp-text:#a8d8ff; --tp-text2:rgba(140,180,255,0.75); --tp-muted:rgba(120,160,255,0.45); --tp-input-bg:rgba(255,255,255,0.06); --tp-input-border:rgba(80,120,255,0.25); --tp-header-bg:rgba(8,18,50,0.88); --tp-header-border:rgba(60,100,200,0.2); }
        .tp-light { --tp-panel:rgba(235,242,255,0.88); --tp-border:rgba(160,190,240,0.35); --tp-shadow:0 4px 24px rgba(60,90,180,0.08); --tp-outer:rgba(220,232,255,0.6); --tp-outer-border:rgba(140,180,240,0.3); --tp-outer-shadow:0 20px 60px rgba(40,70,160,0.1); --tp-text:#1a2b6b; --tp-text2:#3a4e8a; --tp-muted:#7080a8; --tp-input-bg:rgba(180,210,255,0.18); --tp-input-border:rgba(120,170,240,0.3); --tp-header-bg:rgba(220,232,255,0.85); --tp-header-border:rgba(140,180,240,0.3); }
        .tp-tab { padding:9px 18px; border-radius:14px; border:1.5px solid transparent; font-size:0.78rem; font-weight:800; cursor:pointer; background:transparent; color:var(--tp-muted); letter-spacing:0.04em; transition:all 0.2s; }
        .tp-tab:hover { background:rgba(80,120,255,0.08); color:var(--tp-text2); }
        .tp-tab.active { background:var(--tp-panel); border-color:var(--tp-border); color:var(--tp-text); box-shadow:var(--tp-shadow); }
        .tp-panel { background:var(--tp-panel); border-radius:20px; padding:20px; border:1.5px solid var(--tp-border); box-shadow:var(--tp-shadow); backdrop-filter:blur(20px); }
        .tp-label { display:block; font-size:0.68rem; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:var(--tp-muted); margin-bottom:6px; }
        .tp-input { width:100%; padding:10px 14px; border:1.5px solid var(--tp-input-border); border-radius:12px; font-size:0.88rem; background:var(--tp-input-bg); color:var(--tp-text); font-family:inherit; outline:none; transition:border-color 0.2s; box-sizing:border-box; }
        .tp-input:focus { border-color:rgba(100,150,255,0.6); box-shadow:0 0 0 3px rgba(80,120,255,0.12); }
        .tp-textarea { width:100%; padding:10px 14px; border:1.5px solid var(--tp-input-border); border-radius:12px; font-size:0.82rem; background:var(--tp-input-bg); color:var(--tp-text); font-family:inherit; outline:none; resize:vertical; box-sizing:border-box; }
        .tp-select { padding:9px 14px; border-radius:12px; border:1.5px solid var(--tp-input-border); background:var(--tp-input-bg); color:var(--tp-text); font-size:0.82rem; font-family:inherit; outline:none; }
        .tp-btn-primary { padding:10px 20px; border-radius:14px; border:none; background:linear-gradient(135deg,#4a6fd4,#2e4fa3); color:#fff; font-weight:800; font-size:0.85rem; cursor:pointer; letter-spacing:0.06em; transition:all 0.2s; box-shadow:0 4px 16px rgba(60,100,200,0.3); font-family:inherit; }
        .tp-btn-primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 20px rgba(60,100,200,0.4); }
        .tp-btn-primary:disabled { opacity:0.6; cursor:not-allowed; }
        .tp-btn-gold { padding:9px 18px; border-radius:12px; border:none; background:linear-gradient(135deg,#ffd54f,#ffb300); color:#5a3a00; font-weight:800; font-size:0.82rem; cursor:pointer; transition:all 0.2s; box-shadow:0 3px 12px rgba(200,150,0,0.25); font-family:inherit; }
        .tp-btn-gold:hover:not(:disabled) { transform:translateY(-1px); }
        .tp-btn-gold:disabled { opacity:0.6; cursor:not-allowed; }
        .tp-btn-outline { padding:7px 14px; border-radius:10px; border:1.5px solid var(--tp-border); background:var(--tp-input-bg); color:var(--tp-text2); font-weight:700; font-size:0.78rem; cursor:pointer; transition:all 0.2s; font-family:inherit; }
        .tp-btn-outline:hover { background:rgba(80,120,255,0.12); }
        .tp-btn-danger { padding:7px 14px; border-radius:10px; border:1.5px solid rgba(239,68,68,0.3); background:rgba(239,68,68,0.1); color:#ff8080; font-weight:700; font-size:0.78rem; cursor:pointer; transition:all 0.2s; font-family:inherit; }
        .tp-btn-danger:hover { background:rgba(239,68,68,0.2); }
        .tp-chip { padding:6px 14px; border-radius:20px; border:1.5px solid var(--tp-border); background:var(--tp-input-bg); color:var(--tp-text2); font-size:0.78rem; font-weight:700; cursor:pointer; transition:all 0.2s; font-family:inherit; }
        .tp-chip-active { background:rgba(80,120,255,0.15); border-color:rgba(80,140,255,0.5); color:var(--tp-text); }
        .tp-rarity { border-radius:12px; padding:8px 4px; border:1.5px solid var(--tp-border); background:var(--tp-input-bg); color:var(--tp-muted); font-size:0.72rem; font-weight:800; cursor:pointer; text-align:center; transition:all 0.2s; font-family:inherit; }
        .tp-rarity-active { border-color:rgba(80,140,255,0.5); background:rgba(80,120,255,0.15); color:var(--tp-text); }
        .tp-table { width:100%; border-collapse:collapse; }
        .tp-table th { font-size:0.62rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:var(--tp-muted); padding:10px 14px; border-bottom:1.5px solid var(--tp-border); text-align:left; }
        .tp-table td { padding:12px 14px; border-bottom:1px solid var(--tp-border); font-size:0.84rem; color:var(--tp-text2); vertical-align:middle; }
        .tp-table tr:hover td { background:rgba(80,120,255,0.05); }
        .tp-section { font-size:0.65rem; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:var(--tp-muted); margin-bottom:14px; }
        .tp-status-working { padding:10px 16px; border-radius:12px; font-size:0.8rem; font-weight:700; margin-top:10px; background:rgba(100,160,255,0.12); border:1px solid rgba(100,160,255,0.3); color:#6aadff; }
        .tp-status-done { padding:10px 16px; border-radius:12px; font-size:0.8rem; font-weight:700; margin-top:10px; background:rgba(80,200,120,0.1); border:1px solid rgba(80,200,120,0.3); color:#4caf80; }
        .tp-status-error { padding:10px 16px; border-radius:12px; font-size:0.8rem; font-weight:700; margin-top:10px; background:rgba(255,80,80,0.1); border:1px solid rgba(255,80,80,0.25); color:#ff8080; }
        .tp-modal-bg { position:fixed; inset:0; background:rgba(0,10,30,0.55); backdrop-filter:blur(16px); display:flex; align-items:center; justify-content:center; z-index:200; padding:20px; }
        .tp-modal { background:var(--tp-panel); border-radius:28px; padding:32px; width:100%; max-width:480px; position:relative; box-shadow:0 24px 64px rgba(0,0,30,0.5); border:1.5px solid var(--tp-border); backdrop-filter:blur(24px); }
        .tp-modal-wide { max-width:780px; max-height:90vh; overflow-y:auto; }
        .tp-modal h3 { font-weight:800; font-size:1.1rem; margin-bottom:20px; color:var(--tp-text); }
        .tp-err { background:rgba(255,80,80,0.1); border:1px solid rgba(255,80,80,0.3); color:#ff8080; border-radius:10px; padding:8px 14px; font-size:0.78rem; margin-bottom:14px; }
        .tp-alert-success { background:rgba(80,200,120,0.1); border:1px solid rgba(80,200,120,0.3); color:#4caf80; border-radius:12px; padding:10px 16px; font-size:0.82rem; font-weight:700; }
        .tp-page ::-webkit-scrollbar { height:4px; width:4px; }
        .tp-page ::-webkit-scrollbar-track { background:rgba(255,255,255,0.04); border-radius:10px; }
        .tp-page ::-webkit-scrollbar-thumb { background:rgba(100,140,255,0.25); border-radius:10px; }
`;

function TeacherPage({ session, onSignOut }: { session: NonNullable<Session>; onSignOut: () => void }) {
  const spaceCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDark, setIsDark] = React.useState<boolean>(() => {
    try { return localStorage.getItem('tp_theme') !== 'light'; } catch { return true; }
  });
  const toggleTheme = () => setIsDark(d => {
    const next = !d;
    try { localStorage.setItem('tp_theme', next ? 'dark' : 'light'); } catch {}
    return next;
  });

  React.useEffect(() => {
    const canvas = spaceCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId = 0;
    type Star = { x: number; y: number; r: number; offset: number; speed: number; brightness: number };
    let stars: Star[] = [];
    const init = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: 160 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.5 + 0.3,
        offset: Math.random() * Math.PI * 2,
        speed: 0.0008 + Math.random() * 0.002,
        brightness: 0.4 + Math.random() * 0.6,
      }));
    };
    init();
    window.addEventListener('resize', init);
    const draw = (ts: number) => {
      const W = window.innerWidth, H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(W*.5, H*.35, 0, W*.5, H*.5, Math.max(W,H)*.9);
      bg.addColorStop(0, '#0d1b3e'); bg.addColorStop(0.4, '#08112a');
      bg.addColorStop(0.8, '#050c1a'); bg.addColorStop(1, '#020608');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const n1 = ctx.createRadialGradient(W*.8, H*.2, 0, W*.8, H*.2, W*.35);
      n1.addColorStop(0,'rgba(80,40,140,0.16)'); n1.addColorStop(1,'rgba(80,40,140,0)');
      ctx.fillStyle = n1; ctx.fillRect(0, 0, W, H);
      const n2 = ctx.createRadialGradient(W*.15, H*.75, 0, W*.15, H*.75, W*.28);
      n2.addColorStop(0,'rgba(20,80,120,0.13)'); n2.addColorStop(1,'rgba(20,80,120,0)');
      ctx.fillStyle = n2; ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        const t = s.brightness * (0.5 + 0.5 * Math.sin(ts * s.speed + s.offset));
        if (s.r > 1.2 && t > 0.82) {
          ctx.strokeStyle = `rgba(180,220,255,${t*.45})`; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(s.x-s.r*3,s.y); ctx.lineTo(s.x+s.r*3,s.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(s.x,s.y-s.r*3); ctx.lineTo(s.x,s.y+s.r*3); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(200,225,255,${t})`; ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', init); };
  }, []);

  const [tab, setTab] = useState<TabKey>('generate');
  const [students, setStudents] = useState<Student[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [geminiKey, setGeminiKey] = useState('');
  const [modal, setModal] = useState<{ type: string; data?: any } | null>(null);
  const [modalError, setModalError] = useState('');
  const [detailCard, setDetailCard] = useState<Card | null>(null);

  // Home Communications state
  type HomeComm = { id: string; teacher_id: string; event_date: string; comment: string; created_at: string };
  const [homeComms, setHomeComms] = useState<HomeComm[]>([]);
  const [hcDate, setHcDate] = useState('');
  const [hcComment, setHcComment] = useState('');
  const [hcStatus, setHcStatus] = useState('');
  const [hcEditId, setHcEditId] = useState<string | null>(null);
  const [hcEditDate, setHcEditDate] = useState('');
  const [hcEditComment, setHcEditComment] = useState('');
  // Pinboard (single message + photo at top of Home Communication)
  type Pinboard = { id: string; teacher_id: string; message: string; photo_url: string | null; created_at: string };
  const [pinboard, setPinboard] = useState<Pinboard | null>(null);
  const [pbMessage, setPbMessage] = useState('');
  const [pbPhotoUrl, setPbPhotoUrl] = useState<string | null>(null);
  const [pbStatus, setPbStatus] = useState('');
  const [pbSaving, setPbSaving] = useState(false);
  const [pbUploading, setPbUploading] = useState(false);

    // Weekly Project state
  const [weeklyProject, setWeeklyProject] = useState<any>(null);
  const [weeklyTask, setWeeklyTask] = useState('');
  const [weeklyTitle, setWeeklyTitle] = useState('');
  const [weeklyCharHint, setWeeklyCharHint] = useState('');
  const [weeklyGenerating, setWeeklyGenerating] = useState(false);
  const [weeklyCard, setWeeklyCard] = useState<Partial<Card> & { image_url: string } | null>(null);
  const [weeklyStatus, setWeeklyStatus] = useState('');
  const [weeklyStatusType, setWeeklyStatusType] = useState<'default'|'working'|'error'|'done'>('default');
  const [awardModal, setAwardModal] = useState(false);
  const [awardSelections, setAwardSelections] = useState<Record<string, 'common'|'silver'|'gold-rare'>>({});
  const [awardError, setAwardError] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [weeklyEndDate, setWeeklyEndDate] = useState('');
  const [weeklyView, setWeeklyView] = useState<'project'|'submissions'>('project');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // Build a Card state
  // Mass account creation state

  const loadData = useCallback(async () => {
    try {
      const [sList, cListRaw] = await Promise.all([
        Dashboard.getMyStudents(session.user.id),
        Dashboard.getMyCards(session.user.id),
      ]);
      // Hide the auto-granted Aura-Bot welcome card from the teacher's My Cards view
      const cList = cListRaw.filter((c: any) => c.card_name !== Dashboard.WELCOME_CARD_NAME);
      // Load current week's project if one exists
      try {
        const { data: wp } = await sb.from('weekly_projects')
          .select('*')
          .eq('teacher_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (wp) {
          setWeeklyProject(wp);
          setWeeklyTitle(wp.title || '');
          setWeeklyTask(wp.task || '');
          setWeeklyCharHint(wp.char_hint || '');
          if (wp.card_data) setWeeklyCard(wp.card_data);
        }
      } catch { /* no weekly_projects table yet — ignore */ }
      // Load home communications
      try {
        const { data: hcData } = await sb
          .from('home_communications')
          .select('*')
          .eq('teacher_id', session.user.id)
          .order('event_date', { ascending: false });
        setHomeComms((hcData || []) as HomeComm[]);
      } catch { /* table may not exist yet */ }
      // Load pinboard
      try {
        const { data: pb } = await sb
          .from('home_pinboard')
          .select('*')
          .eq('teacher_id', session.user.id)
          .maybeSingle();
        if (pb) {
          setPinboard(pb as Pinboard);
          setPbMessage(pb.message || '');
          setPbPhotoUrl(pb.photo_url || null);
        }
      } catch { /* table may not exist yet */ }
      setStudents(sList);
      setCards(cList);
      setGeminiKey(AI.getGeminiKey());
    } catch (err: any) {
      console.error(err.message);
    }
  }, [session.user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddHomeComm = async () => {
    if (!hcDate.trim() || !hcComment.trim()) { setHcStatus('Please fill in both a date and a message.'); return; }
    setHcStatus('Saving…');
    try {
      const { data, error } = await sb.from('home_communications').insert({
        teacher_id: session.user.id,
        event_date: hcDate,
        comment: hcComment.trim(),
      }).select().single();
      if (error) throw error;
      setHomeComms(prev => [data as HomeComm, ...prev].sort((a, b) => b.event_date.localeCompare(a.event_date)));
      setHcDate(''); setHcComment(''); setHcStatus('✓ Post added!');
      setTimeout(() => setHcStatus(''), 2500);
    } catch (err: any) { setHcStatus('Error: ' + (err.message || 'Failed to save')); }
  };

  const handleDeleteHomeComm = async (id: string) => {
    try {
      await sb.from('home_communications').delete().eq('id', id);
      setHomeComms(prev => prev.filter(h => h.id !== id));
    } catch (err: any) { setHcStatus('Error deleting: ' + err.message); }
  };

  const handleStartEditHomeComm = (hc: HomeComm) => {
    setHcEditId(hc.id); setHcEditDate(hc.event_date); setHcEditComment(hc.comment);
  };

  const handleSaveEditHomeComm = async () => {
    if (!hcEditId || !hcEditDate.trim() || !hcEditComment.trim()) return;
    setHcStatus('Saving…');
    try {
      const { data, error } = await sb.from('home_communications')
        .update({ event_date: hcEditDate, comment: hcEditComment.trim() })
        .eq('id', hcEditId).select().single();
      if (error) throw error;
      setHomeComms(prev => prev.map(h => h.id === hcEditId ? data as HomeComm : h).sort((a, b) => b.event_date.localeCompare(a.event_date)));
      setHcEditId(null); setHcEditDate(''); setHcEditComment('');
      setHcStatus('✓ Post updated!'); setTimeout(() => setHcStatus(''), 2500);
    } catch (err: any) { setHcStatus('Error: ' + err.message); }
  };

  // ── Pinboard handlers ───────────────────────────────────────────────────
  const handlePbPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPbUploading(true); setPbStatus('Uploading photo…');
    try {
      // Convert to base64 data URL for storage (no separate storage bucket needed)
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setPbPhotoUrl(dataUrl);
        setPbUploading(false); setPbStatus('');
      };
      reader.onerror = () => { setPbUploading(false); setPbStatus('Error reading file.'); };
      reader.readAsDataURL(file);
    } catch (err: any) { setPbUploading(false); setPbStatus('Upload error: ' + err.message); }
  };

  const handleSavePinboard = async () => {
    if (!pbMessage.trim()) { setPbStatus('Please enter a message.'); return; }
    setPbSaving(true); setPbStatus('Saving…');
    try {
      const payload = {
        teacher_id: session.user.id,
        message: pbMessage.trim(),
        photo_url: pbPhotoUrl || null,
      };
      let saved;
      if (pinboard?.id) {
        const { data, error } = await sb.from('home_pinboard').update(payload).eq('id', pinboard.id).select().single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await sb.from('home_pinboard').insert(payload).select().single();
        if (error) throw error;
        saved = data;
      }
      setPinboard(saved as Pinboard);
      setPbStatus('✓ Saved!'); setTimeout(() => setPbStatus(''), 2500);
    } catch (err: any) { setPbStatus('Error: ' + err.message); }
    setPbSaving(false);
  };

  const handleDeletePbPhoto = async () => {
    setPbPhotoUrl(null);
    if (pinboard?.id) {
      await sb.from('home_pinboard').update({ photo_url: null }).eq('id', pinboard.id);
      setPinboard(prev => prev ? { ...prev, photo_url: null } : prev);
    }
  };

  const handleDeletePinboard = async () => {
    if (!pinboard?.id) { setPbMessage(''); setPbPhotoUrl(null); return; }
    try {
      await sb.from('home_pinboard').delete().eq('id', pinboard.id);
      setPinboard(null); setPbMessage(''); setPbPhotoUrl(null);
      setPbStatus('✓ Message cleared.');  setTimeout(() => setPbStatus(''), 2500);
    } catch (err: any) { setPbStatus('Error: ' + err.message); }
  };

  const handleSaveKey = () => {
    AI.setGeminiKey(geminiKey);
  };


  return (
    <div style={{ position:'relative', minHeight:'100vh', fontFamily:"'Nunito','Segoe UI',sans-serif" }}>
      <canvas ref={spaceCanvasRef} style={{ position:'fixed', inset:0, width:'100%', height:'100%', zIndex:0, pointerEvents:'none', opacity: isDark ? 1 : 0, transition:'opacity 0.6s' }} />
      {!isDark && <div style={{ position:'fixed', inset:0, zIndex:0, background:'linear-gradient(160deg,#dce8ff 0%,#eaf0ff 40%,#f0f5ff 70%,#e8eeff 100%)' }} />}
      <div className={`tp-page ${isDark ? 'tp-dark' : 'tp-light'}`} style={{ position:'relative', zIndex:1, minHeight:'100vh' }}>
      <style dangerouslySetInnerHTML={{__html: TP_STYLES}} />

      {/* Header */}
      <header style={{ background:'var(--tp-header-bg)', borderBottom:'1.5px solid var(--tp-header-border)', backdropFilter:'blur(20px)', position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 16px rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth:1240, margin:'0 auto', padding:'0 28px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60 }}>
          <span style={{ fontSize:'1.1rem', fontWeight:900, background:'linear-gradient(135deg,#f4a8c8,#a8d8ff,#c8b0ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:'0.04em' }}>✦ ClassCard ✦</span>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:'0.72rem', padding:'4px 12px', borderRadius:20, background:'var(--tp-input-bg)', border:'1px solid var(--tp-border)', color:'var(--tp-text2)', fontWeight:600 }}>{session.user.email}</span>
            <span style={{ fontSize:'0.65rem', padding:'4px 10px', borderRadius:20, background:'rgba(80,120,255,0.15)', border:'1px solid rgba(80,120,255,0.25)', color:'var(--tp-text)', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase' }}>Teacher</span>
            <button onClick={toggleTheme} style={{ width:34, height:34, borderRadius:'50%', border:'1.5px solid var(--tp-border)', background:'var(--tp-input-bg)', cursor:'pointer', fontSize:'0.9rem', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s', color:'var(--tp-text)' }} title={isDark ? 'Light mode' : 'Dark mode'}>{isDark ? '☀️' : '🌙'}</button>
            <button onClick={onSignOut} className="tp-btn-outline" style={{ fontSize:'0.72rem', padding:'6px 14px' }}>Sign Out</button>
          </div>
        </div>
      </header>

      {/* Main */}
      <div style={{ maxWidth:1240, margin:'0 auto', padding:'24px 28px' }}>
        <div style={{ background:'var(--tp-outer)', borderRadius:40, padding:'24px 28px', boxShadow:'var(--tp-outer-shadow)', border:'1.5px solid var(--tp-outer-border)', backdropFilter:'blur(20px)' }}>

        {/* Tab bar */}
        <div style={{ display:'flex', gap:6, marginBottom:24, flexWrap:'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} className={`tp-tab${tab === t.key ? ' active' : ''}`} onClick={() => { setTab(t.key); }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Generate Card Tab */}
        {tab === 'generate' && (
          <CardDatabaseTab session={session} />
        )}



        {/* ── Weekly Project Tab ─────────────────────────────── */}
        {tab === 'weekly' && (
          <WeeklyProjectTab
            students={students}
            session={session}
            weeklyTask={weeklyTask}
            setWeeklyTask={setWeeklyTask}
            weeklyTitle={weeklyTitle}
            setWeeklyTitle={setWeeklyTitle}
            weeklyCharHint={weeklyCharHint}
            setWeeklyCharHint={setWeeklyCharHint}
            weeklyGenerating={weeklyGenerating}
            setWeeklyGenerating={setWeeklyGenerating}
            weeklyCard={weeklyCard}
            setWeeklyCard={setWeeklyCard}
            weeklyProject={weeklyProject}
            setWeeklyProject={setWeeklyProject}
            weeklyStatus={weeklyStatus}
            setWeeklyStatus={setWeeklyStatus}
            weeklyStatusType={weeklyStatusType}
            setWeeklyStatusType={setWeeklyStatusType}
            awardModal={awardModal}
            setAwardModal={setAwardModal}
            awardSelections={awardSelections}
            setAwardSelections={setAwardSelections}
            awardError={awardError}
            setAwardError={setAwardError}
            awarding={awarding}
            setAwarding={setAwarding}
            onRefresh={loadData}
            weeklyEndDate={weeklyEndDate}
            setWeeklyEndDate={setWeeklyEndDate}
            weeklyView={weeklyView}
            setWeeklyView={setWeeklyView}
            submissions={submissions}
            setSubmissions={setSubmissions}
            submissionsLoading={submissionsLoading}
            setSubmissionsLoading={setSubmissionsLoading}
          />
        )}

        {/* My Cards Tab */}
        {tab === 'cardcreation' && (
          <CardDatabaseTab session={session} />
        )}
        {tab === 'cards' && <TeacherCardDatabaseView session={session} />}

        {/* Students Tab */}
        {tab === 'students' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div className="tp-section" style={{ marginBottom:0 }}>Your Students</div>
              <div style={{ display:'flex', gap:8 }}>

                <button onClick={() => setModal({ type: 'addStudent' })} className="tp-btn-primary" style={{ fontSize:'0.8rem' }}>+ Add Student</button>
              </div>
            </div>
            {students.length === 0 ? (
              <div style={{ textAlign:'center', padding:'48px 20px', color:'#a0a8c8', fontStyle:'italic', fontSize:'0.85rem' }}>No students yet.</div>
            ) : (
              <div className="tp-panel" style={{ padding:0, overflow:'hidden' }}>
              <table className="tp-table">
                <thead><tr><th>Name</th><th>Login Email</th><th>Cards</th><th>Actions</th></tr></thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight:700 }}>{s.name}</td>
                      <td style={{ fontSize:'0.78rem', color:'#8090b0' }}>{s.login_email || '—'}</td>
                      <td>{cards.filter(c => c.student_id === s.id).length}</td>
                      <td>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          <button onClick={() => setModal({ type: 'downloadCards', data: s })} className="tp-btn-outline">⬇ Cards</button>
                          <button onClick={() => setModal({ type: 'editStudent', data: s })} className="tp-btn-outline">✏ Edit</button>
                          <button onClick={() => { setModalError(''); setModal({ type: 'resetPassword', data: s }); }} className="tp-btn-outline" style={{ borderColor:'rgba(80,200,120,0.35)', color:'#2a7a50' }}>🔑 Reset PIN</button>
                          <button onClick={() => setModal({ type: 'deleteStudent', data: s })} className="tp-btn-danger">🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* Home Communication Tab */}
        {tab === 'stars' && (
          <StarsTab students={students} session={session} />
        )}

        {tab === 'homecomms' && (
          <div style={{ maxWidth: 760 }}>
            <div className="tp-section" style={{ marginBottom: 16 }}>📣 Home Communication</div>
            <p style={{ fontSize: '0.78rem', color: '#8090b0', marginBottom: 22, lineHeight: 1.6 }}>
              Manage what parents and students see on the Home Communication board. The pinboard message and photo appear at the top; dated events appear below.
            </p>

            {/* ── PINBOARD SECTION ── */}
            <div style={{ marginBottom: 8, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8090b0' }}>📌 Pinboard Message &amp; Photo</div>
            <div className="tp-panel" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

                {/* Message textarea */}
                <div style={{ flex: 1 }}>
                  <label className="tp-label">Message</label>
                  <textarea
                    className="tp-input"
                    placeholder="e.g. Welcome to Term 2! It's going to be a great term full of exciting learning…"
                    value={pbMessage}
                    onChange={e => setPbMessage(e.target.value)}
                    rows={5}
                    style={{ resize: 'vertical', minHeight: 110, lineHeight: 1.6 }}
                  />
                </div>

                {/* Photo slot */}
                <div style={{ flexShrink: 0, width: 160 }}>
                  <label className="tp-label">Photo (optional)</label>
                  {pbPhotoUrl ? (
                    <div style={{ position: 'relative' }}>
                      <img
                        src={pbPhotoUrl}
                        alt="Pinboard"
                        style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 12, border: '2px solid rgba(160,140,220,0.3)', display: 'block' }}
                      />
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        <label style={{ flex: 1, padding: '5px 0', background: 'rgba(160,140,220,0.1)', border: '1.5px solid rgba(160,140,220,0.3)', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#6070b0' }}>
                          🔄 Change
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePbPhotoUpload} disabled={pbUploading} />
                        </label>
                        <button onClick={handleDeletePbPhoto} className="tp-btn-danger" style={{ flex: 1, fontSize: '0.65rem', padding: '5px 0' }}>🗑 Remove</button>
                      </div>
                    </div>
                  ) : (
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: 130, background: 'rgba(240,236,255,0.5)', border: '2px dashed rgba(160,140,220,0.4)', borderRadius: 12, cursor: pbUploading ? 'wait' : 'pointer', gap: 6 }}>
                      <span style={{ fontSize: '1.6rem' }}>{pbUploading ? '⏳' : '📷'}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8090b0' }}>{pbUploading ? 'Uploading…' : 'Click to add photo'}</span>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePbPhotoUpload} disabled={pbUploading} />
                    </label>
                  )}
                </div>
              </div>

              {/* Save / Delete pinboard */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                <button className="tp-btn-primary" onClick={handleSavePinboard} disabled={pbSaving || pbUploading}>
                  {pbSaving ? 'Saving…' : pinboard ? '💾 Save Changes' : '📌 Save Pinboard'}
                </button>
                {pinboard && (
                  <button className="tp-btn-danger" onClick={handleDeletePinboard} style={{ fontSize: '0.78rem' }}>🗑 Clear Pinboard</button>
                )}
                {pbStatus && (
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: pbStatus.startsWith('Error') ? '#e05050' : pbStatus.startsWith('✓') ? '#22a060' : '#8090b0' }}>
                    {pbStatus}
                  </span>
                )}
              </div>
            </div>

            {/* ── DATED EVENTS SECTION ── */}
            <div style={{ marginBottom: 8, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8090b0' }}>📅 Dates &amp; Events</div>

            {/* Add new post */}
            <div className="tp-panel" style={{ marginBottom: 16 }}>
              <div className="tp-label" style={{ marginBottom: 10, fontSize: '0.72rem', color: '#6070b0' }}>📝 New Event</div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: '0 0 170px' }}>
                  <label className="tp-label">Date</label>
                  <input
                    type="date"
                    className="tp-input"
                    value={hcDate}
                    onChange={e => setHcDate(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="tp-label">Event / Message</label>
                  <textarea
                    className="tp-input"
                    placeholder="e.g. School disco — Friday 16 May. Please return permission slips by Wednesday."
                    value={hcComment}
                    onChange={e => setHcComment(e.target.value)}
                    rows={3}
                    style={{ resize: 'vertical', minHeight: 70, lineHeight: 1.5 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="tp-btn-primary" onClick={handleAddHomeComm}>+ Add Event</button>
                {hcStatus && (
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: hcStatus.startsWith('Error') ? '#e05050' : hcStatus.startsWith('✓') ? '#22a060' : '#8090b0' }}>
                    {hcStatus}
                  </span>
                )}
              </div>
            </div>

            {/* Events list */}
            {homeComms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 20px', color: '#a0a8c0', fontSize: '0.85rem', background: 'rgba(240,236,255,0.3)', borderRadius: 16, border: '1.5px dashed rgba(180,160,220,0.3)' }}>
                No events yet. Add your first dated event above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {homeComms.map(hc => (
                  <div key={hc.id} className="tp-panel" style={{ padding: '14px 16px' }}>
                    {hcEditId === hc.id ? (
                      <div>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                          <div style={{ flex: '0 0 170px' }}>
                            <label className="tp-label">Date</label>
                            <input type="date" className="tp-input" value={hcEditDate} onChange={e => setHcEditDate(e.target.value)} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="tp-label">Message</label>
                            <textarea
                              className="tp-input"
                              value={hcEditComment}
                              onChange={e => setHcEditComment(e.target.value)}
                              rows={3}
                              style={{ resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="tp-btn-primary" onClick={handleSaveEditHomeComm} style={{ fontSize: '0.78rem', padding: '7px 16px' }}>Save Changes</button>
                          <button className="tp-btn-outline" onClick={() => setHcEditId(null)} style={{ fontSize: '0.78rem' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                        <div style={{ flexShrink: 0, background: 'linear-gradient(135deg,#e8e0ff,#d0c8f8)', borderRadius: 12, padding: '8px 14px', textAlign: 'center', minWidth: 72 }}>
                          <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7060b0', marginBottom: 2 }}>
                            {new Date(hc.event_date + 'T12:00:00').toLocaleDateString('en-NZ', { month: 'short' }).toUpperCase()}
                          </div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#4030a0', lineHeight: 1 }}>
                            {new Date(hc.event_date + 'T12:00:00').getDate()}
                          </div>
                          <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#9080c0', marginTop: 1 }}>
                            {new Date(hc.event_date + 'T12:00:00').toLocaleDateString('en-NZ', { weekday: 'short' }).toUpperCase()}
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '0.88rem', color: '#3040a0', lineHeight: 1.6, fontWeight: 600 }}>{hc.comment}</p>
                          <div style={{ fontSize: '0.65rem', color: '#b0b8d0', marginTop: 6 }}>
                            Posted {new Date(hc.created_at).toLocaleDateString('en-NZ')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button className="tp-btn-outline" onClick={() => handleStartEditHomeComm(hc)} style={{ fontSize: '0.72rem', padding: '5px 11px' }}>✏️ Edit</button>
                          <button className="tp-btn-danger" onClick={() => handleDeleteHomeComm(hc.id)} style={{ fontSize: '0.72rem', padding: '5px 11px' }}>🗑 Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <div style={{ maxWidth:500 }}>
            <div className="tp-section">AI Settings</div>
            <div className="tp-panel" style={{ marginBottom:16 }}>
              <div style={{ marginBottom:14 }}>
                <label className="tp-label">Gemini API Key</label>
                <input type="password" className="tp-input" placeholder="AIza…" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} />
                <p style={{ fontSize:'0.72rem', color:'#a0a8c8', marginTop:6 }}>Free at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color:'#9090d0', textDecoration:'underline' }}>aistudio.google.com ↗</a></p>
              </div>
              <button onClick={handleSaveKey} className="tp-btn-primary">Save Key</button>
            </div>
          </div>
        )}
        </div>{/* inner container */}
        </div>{/* main padding */}

      {/* Modals */}
      {renderModal()}

      {/* Card Detail Modal */}
      {detailCard && (
        <div className="tp-modal-bg" onClick={() => setDetailCard(null)}>
          <div className="tp-modal tp-modal-wide" onClick={e => e.stopPropagation()}>
            <button onClick={() => setDetailCard(null)} style={{ position:'absolute', top:16, right:16, width:32, height:32, borderRadius:'50%', background:'rgba(160,140,220,0.12)', border:'none', fontSize:'1rem', cursor:'pointer', color:'#8080c0' }}>✕</button>
            <div style={{ display:'flex', gap:28, alignItems:'flex-start', flexWrap:'wrap' }}>
              <div style={{ flexShrink:0 }}>
                <PokeCard card={detailCard} />
              </div>
              <div style={{ flex:1, minWidth:200 }}>
                <h2 style={{ fontSize:'1.4rem', fontWeight:900, color:'#3040a0', marginBottom:4 }}>{detailCard.card_name}</h2>
                <div style={{ display:'inline-block', padding:'3px 12px', borderRadius:20, background:'rgba(100,120,220,0.08)', border:'1px solid rgba(100,120,220,0.2)', fontSize:'0.65rem', fontWeight:700, color:'#6070c0', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.1em' }}>{detailCard.rarity}</div>
                <p style={{ fontSize:'0.88rem', color:'#7080b0', fontStyle:'italic', marginBottom:20, lineHeight:1.5 }}>"{detailCard.description}"</p>

                <div className="space-y-0">
                  {[
                    { label: 'HP', value: detailCard.hp.toString() },
                    { label: 'Type', value: detailCard.type },
                    { label: detailCard.stat1_name, value: detailCard.stat1_val.toString() },
                    { label: detailCard.stat2_name, value: detailCard.stat2_val.toString() },
                    { label: detailCard.stat3_name, value: detailCard.stat3_val.toString() },
                    { label: detailCard.move1_name, value: `${detailCard.move1_dmg} dmg` },
                    { label: detailCard.move2_name, value: `${detailCard.move2_dmg} dmg` },
                    { label: 'Awarded', value: new Date(detailCard.created_at).toLocaleDateString() },
                  ].map((row, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(100,120,220,0.08)' }}>
                      <span style={{ fontSize:'0.72rem', color:'#9090c0', textTransform:'uppercase', letterSpacing:'0.08em' }}>{row.label}</span>
                      <span style={{ fontSize:'0.82rem', fontWeight:700, color:'#3040a0' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize:'0.8rem', marginTop:14, color:'#8090b0', fontStyle:'italic' }}>Awarded to: {detailCard.students?.name || 'Unknown'}</p>
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
      case 'addStudent':
        return (
          <ModalWrapper title="Add New Student" onClose={() => setModal(null)}>
            <ModalForm
              fields={[
                { label: 'Student Name', name: 'name', type: 'text', placeholder: 'e.g. Jamie Chen' },
                { label: 'Student Login Email', name: 'email', type: 'email', placeholder: 'student@school.edu' },
                { label: '8-Digit PIN (keypad login)', name: 'password', type: 'password', placeholder: 'e.g. 12345678' },
              ]}
              onSubmit={async (vals) => {
                setModalError('');
                const pin = vals.password;
                if (!/^\d{8}$/.test(pin)) { setModalError('PIN must be exactly 8 digits (numbers only).'); return; }
                if (/^(\d)\1{7}$/.test(pin)) { setModalError('PIN cannot be 8 of the same digit (e.g. 11111111).'); return; }
                try {
                  let newUser;
                  try {
                    newUser = await Auth.signUp(vals.email, vals.password, 'student', vals.name);
                  } catch (e: any) {
                    throw new Error('Auth error: ' + e.message);
                  }
                  let newStudent;
                  try {
                    newStudent = await Dashboard.createStudent(vals.name, session.user.id, newUser.id, vals.email);
                  } catch (e: any) {
                    throw new Error('Database error saving new student: ' + e.message);
                  }
                  try {
                    await Dashboard.giveWelcomeCard(newStudent.id, session.user.id);
                  } catch (e: any) {
                    console.warn('Welcome card failed (non-fatal):', e.message);
                  }
                  loadData();
                  setModal(null);
                } catch (err: any) {
                  setModalError(err.message);
                }
              }}
              submitLabel="Create Student"
              error={modalError}
              onCancel={() => setModal(null)}
            />
          </ModalWrapper>
        );
      case 'editStudent':
        return (
          <ModalWrapper title="✏ Edit Student" onClose={() => setModal(null)}>
            <ModalForm
              fields={[
                { label: 'Student Name', name: 'name', type: 'text', default: modal.data.name },
                { label: 'Login Email', name: 'email', type: 'email', default: modal.data.login_email || '' },
              ]}
              onSubmit={async (vals) => {
                try {
                  await sb.from('students').update({ name: vals.name, login_email: vals.email }).eq('id', modal.data.id);
                  loadData();
                  setModal(null);
                } catch (err: any) { setModalError(err.message); }
              }}
              submitLabel="Save Changes"
              error={modalError}
              onCancel={() => setModal(null)}
            />
          </ModalWrapper>
        );
      case 'deleteStudent':
        return (
          <ModalWrapper title="🗑 Delete Student" onClose={() => setModal(null)} danger>
            <p className="text-sm mb-2" style={{ color: '#3d2b1f' }}>Delete <strong>{modal.data.name}</strong>?</p>
            <p className="text-sm mb-4" style={{ color: '#c82020' }}>This will also delete all their cards and cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={async () => { await Dashboard.deleteStudent(modal.data.id); loadData(); setModal(null); }} className="tp-btn-danger">Yes, Delete Everything</button>
              <button onClick={() => setModal(null)} className="tp-btn-outline">Cancel</button>
            </div>
          </ModalWrapper>
        );
      case 'downloadCards': {
        const studentCards = cards.filter(c => c.student_id === modal.data.id);
        const handleDownload = () => {
          // ── helpers ──────────────────────────────────────────────────────
          const RARITY_BG: Record<string, string> = {
            common:     'linear-gradient(160deg,#f5e97a 0%,#e8c830 40%,#f5e097 70%,#ffe680 100%)',
            silver:     'linear-gradient(160deg,#d8e4ee 0%,#a8bfcf 40%,#e0eaf2 70%,#c0d4e4 100%)',
            'gold-rare':'linear-gradient(160deg,#ffe090 0%,#f0b020 30%,#ffd060 60%,#e89010 80%,#ffdc80 100%)',
            prismatic:  'linear-gradient(135deg,#ffb3b3 0%,#ffd9a0 14%,#ffffa0 28%,#b3ffb3 42%,#a0e8ff 57%,#b3b3ff 71%,#e8b3ff 85%,#ffb3e8 100%)',
          };
          const RARITY_BORDER: Record<string, string> = {
            common: '#c8a000', silver: '#7a9ab0', 'gold-rare': '#c07800', prismatic: '#c080ff',
          };
          const RARITY_LABELS: Record<string, string> = {
            common: 'COMMON', silver: 'SILVER', 'gold-rare': 'GOLD', prismatic: 'PRISMATIC',
          };

          const renderPokeCard = (card: any) => {
            const bg = RARITY_BG[card.rarity] || RARITY_BG.common;
            const border = RARITY_BORDER[card.rarity] || '#c8a000';
            const imgHtml = card.image_url
              ? `<img src="${card.image_url}" alt="${card.card_name}" style="width:100%;height:100%;object-fit:contain;" />`
              : `<span style="font-size:40px;">🎭</span>`;
            return `<div class="poke-card" data-rarity="${card.rarity}" style="background:${bg};border-color:${border};">
  <div class="card-content">
    <div class="card-header">
      <span class="card-name">${card.card_name}</span>
      <span class="card-hp">${card.hp} HP</span>
    </div>
    <div class="card-img-box">
      ${imgHtml}
      <span class="card-type-badge">${card.type || 'SCHOLAR'}</span>
    </div>
    <div class="card-desc">${card.description || ''}</div>
    <div class="card-stats">
      <div class="stat-box"><span class="stat-label">${card.stat1_name || ''}</span><span class="stat-val">${card.stat1_val || ''}</span></div>
      <div class="stat-box"><span class="stat-label">${card.stat2_name || ''}</span><span class="stat-val">${card.stat2_val || ''}</span></div>
      <div class="stat-box"><span class="stat-label">${card.stat3_name || ''}</span><span class="stat-val">${card.stat3_val || ''}</span></div>
    </div>
    <div class="card-move"><span class="move-name">${card.move1_name || ''}</span><span class="move-dmg">${card.move1_dmg || ''}</span></div>
    <div class="card-move"><span class="move-name">${card.move2_name || ''}</span><span class="move-dmg">${card.move2_dmg || ''}</span></div>
    <div class="card-footer">
      <span class="card-rarity-tag">${RARITY_LABELS[card.rarity] || 'COMMON'}</span>
      <span class="card-student-name">${card.students?.name || ''}</span>
    </div>
  </div>
</div>`;
          };

          const cardHtml = studentCards.map(card => renderPokeCard(card)).join('\n');

          const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${modal.data.name}'s Cards</title>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Nunito:wght@700;800;900&display=swap" rel="stylesheet" />
  <style>
    body { margin: 0; padding: 32px; background: linear-gradient(135deg,#fce4ec,#f3e5f5,#e8eaf6,#e1f5fe); font-family: 'Nunito','Segoe UI',sans-serif; min-height: 100vh; }
    h1 { text-align: center; color: #5060a0; font-size: 1.6rem; margin-bottom: 8px; }
    p.subtitle { text-align: center; color: #8090b0; font-size: 0.85rem; margin-bottom: 32px; }
    .cards-grid { display: flex; flex-wrap: wrap; gap: 32px; justify-content: center; align-items: flex-start; }

    /* ── PokeCard (Generate Card) styles ── */
    .poke-card {
      width: 260px; height: 375px; border-radius: 18px; position: relative;
      overflow: hidden; border: 3px solid #c8a000; user-select: none; flex-shrink: 0;
      box-shadow: 0 8px 25px rgba(200,160,0,0.2);
    }
    .poke-card[data-rarity="silver"] { box-shadow: 0 0 0 2px #7a9ab0, 0 8px 30px rgba(120,160,200,0.2); }
    .poke-card[data-rarity="gold-rare"] { box-shadow: 0 0 0 3px #d4a017, 0 8px 40px rgba(212,160,23,0.35); }
    .poke-card[data-rarity="prismatic"] { box-shadow: 0 0 0 3px #c080ff, 0 8px 50px rgba(180,100,255,0.5); animation: prismShift 4s ease-in-out infinite; }
    @keyframes prismShift { 0%,100% { filter: hue-rotate(0deg) brightness(1.05); } 50% { filter: hue-rotate(30deg) brightness(1.12); } }
    .card-content { position: relative; z-index: 10; height: 100%; display: flex; flex-direction: column; padding: 10px 12px 7px; box-sizing: border-box; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .card-name { font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700; color: #1a1000; text-shadow: 0 1px 0 rgba(255,255,255,0.6); max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-hp { font-size: 10px; font-weight: 800; color: #8b0000; background: rgba(255,255,255,0.6); padding: 2px 7px; border-radius: 10px; white-space: nowrap; }
    .card-img-box { margin: 0 4px; height: 120px; background: rgba(255,255,255,0.35); border-radius: 10px; border: 2px solid rgba(255,255,255,0.65); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; flex-shrink: 0; }
    .card-img-box img { width: 100%; height: 100%; object-fit: contain; }
    .card-type-badge { position: absolute; bottom: 5px; right: 7px; font-size: 7px; font-weight: 800; background: rgba(0,0,0,0.35); color: white; padding: 2px 5px; border-radius: 6px; letter-spacing: 0.08em; }
    .card-desc { margin: 5px 4px 3px; font-size: 8px; color: #2a1800; background: rgba(255,255,255,0.42); padding: 4px 7px; border-radius: 6px; font-style: italic; line-height: 1.4; border: 1px solid rgba(255,255,255,0.5); flex-shrink: 0; }
    .card-stats { margin: 3px 4px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3px; flex-shrink: 0; }
    .stat-box { background: rgba(255,255,255,0.45); border-radius: 5px; padding: 3px 2px; text-align: center; border: 1px solid rgba(255,255,255,0.5); }
    .stat-label { font-size: 6.5px; font-weight: 800; color: #5a3a00; display: block; }
    .stat-val { font-size: 13px; font-weight: 900; color: #1a0800; display: block; font-family: 'Cinzel', serif; }
    .card-move { margin: 2px 4px; background: rgba(255,255,255,0.42); border-radius: 7px; padding: 3px 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.5); flex-shrink: 0; }
    .move-name { font-size: 8.5px; font-weight: 700; color: #1a0800; }
    .move-dmg { font-size: 13px; font-weight: 900; color: #8b0000; font-family: 'Cinzel', serif; }
    .card-footer { margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: 3px; flex-shrink: 0; }
    .card-rarity-tag { font-size: 7px; font-weight: 700; color: #3a2200; }
    .card-student-name { font-size: 7px; color: #5a3a00; font-style: italic; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  </style>
</head>
<body>
  <h1>🎴 ${modal.data.name}'s Cards</h1>
  <p class="subtitle">${studentCards.length} card${studentCards.length !== 1 ? 's' : ''} collected</p>
  <div class="cards-grid">
    ${cardHtml}
  </div>
</body>
</html>`;

          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${modal.data.name.replace(/\s+/g, '_')}_cards.html`;
          a.click();
          URL.revokeObjectURL(url);
          setModal(null);
        };
        return (
          <ModalWrapper title="⬇ Download Cards" onClose={() => setModal(null)}>
            <div style={{ padding: '8px 0' }}>
              <p style={{ color: '#5060a0', fontSize: '0.9rem', marginBottom: 16 }}>
                Download <strong>{modal.data.name}</strong>'s cards as an HTML file.
              </p>
              <p style={{ color: '#8090b0', fontSize: '0.8rem', marginBottom: 24 }}>
                {studentCards.length === 0
                  ? 'This student has no cards yet.'
                  : `${studentCards.length} card${studentCards.length !== 1 ? 's' : ''} will be included.`}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setModal(null)} className="tp-btn-outline">Cancel</button>
                <button onClick={handleDownload} className="tp-btn-primary" disabled={studentCards.length === 0}>
                  ⬇ Download HTML
                </button>
              </div>
            </div>
          </ModalWrapper>
        );
      }
      case 'editCard':
        return (
          <ModalWrapper title="✏ Edit Card" onClose={() => setModal(null)}>
            <ModalForm
              fields={[
                { label: 'Card Name', name: 'cardName', type: 'text', default: modal.data.card_name },
                { label: 'HP', name: 'hp', type: 'number', default: String(modal.data.hp) },
                { label: 'Description', name: 'description', type: 'textarea', default: modal.data.description },
                { label: 'Move 1 Name', name: 'move1Name', type: 'text', default: modal.data.move1_name },
                { label: 'Move 1 Damage', name: 'move1Dmg', type: 'number', default: String(modal.data.move1_dmg) },
                { label: 'Move 2 Name', name: 'move2Name', type: 'text', default: modal.data.move2_name },
                { label: 'Move 2 Damage', name: 'move2Dmg', type: 'number', default: String(modal.data.move2_dmg) },
              ]}
              onSubmit={async (vals) => {
                try {
                  await Dashboard.updateCard(modal.data.id, {
                    card_name: vals.cardName,
                    hp: Number(vals.hp),
                    description: vals.description,
                    move1_name: vals.move1Name,
                    move1_dmg: Number(vals.move1Dmg),
                    move2_name: vals.move2Name,
                    move2_dmg: Number(vals.move2Dmg),
                  });
                  loadData();
                  setModal(null);
                } catch (err: any) { setModalError(err.message); }
              }}
              submitLabel="Save Changes"
              error={modalError}
              onCancel={() => setModal(null)}
            />
          </ModalWrapper>
        );
      case 'deleteCard':
        return (
          <ModalWrapper title="🗑 Delete Card" onClose={() => setModal(null)} danger>
            <p className="text-sm mb-2" style={{ color: '#3d2b1f' }}>Delete <strong>{modal.data.card_name}</strong>?</p>
            <p className="text-sm mb-4" style={{ color: '#c82020' }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={async () => { await Dashboard.deleteCard(modal.data.id); loadData(); setModal(null); }} className="tp-btn-danger">Yes, Delete Card</button>
              <button onClick={() => setModal(null)} className="tp-btn-outline">Cancel</button>
            </div>
          </ModalWrapper>
        );
      case 'resetPassword': {
        const pw = modal.data._pw || '';
        const pw2 = modal.data._pw2 || '';
        const setPw = (v: string) => setModal((m: any) => ({ ...m, data: { ...m.data, _pw: v } }));
        const setPw2 = (v: string) => setModal((m: any) => ({ ...m, data: { ...m.data, _pw2: v } }));
        return (
          <ModalWrapper title="🔑 Reset PIN" onClose={() => setModal(null)}>
            <p className="text-sm mb-1" style={{ color: '#7a5a40' }}>
              Setting new keypad PIN for <strong>{modal.data.name}</strong>
            </p>
            <p className="text-xs mb-4" style={{ color: '#9a7a60' }}>
              Must be exactly 8 digits. Cannot be 8 of the same number (e.g. 11111111).
            </p>
            <div className="mb-3">
              <label className="tp-label">New 6-Digit PIN</label>
              <input type="password" inputMode="numeric" maxLength={8} className="tp-input" placeholder="e.g. 48295123" value={pw} onChange={e => setPw(e.target.value.replace(/\D/g, '').slice(0, 8))} />
            </div>
            <div className="mb-3">
              <label className="tp-label">Confirm PIN</label>
              <input type="password" inputMode="numeric" maxLength={8} className="tp-input" placeholder="Repeat PIN" value={pw2} onChange={e => setPw2(e.target.value.replace(/\D/g, '').slice(0, 8))} />
            </div>
            {modalError && <p className="text-sm mt-2" style={{ color: '#c82020' }}>{modalError}</p>}
            <div className="flex gap-3 mt-4">
              <button className="tp-btn-gold" onClick={async () => {
                if (!/^\d{8}$/.test(pw)) { setModalError('PIN must be exactly 8 digits.'); return; }
                if (/^(\d)\1{7}$/.test(pw)) { setModalError('PIN cannot be 8 of the same digit (e.g. 11111111).'); return; }
                if (pw !== pw2) { setModalError('PINs do not match.'); return; }
                if (!modal.data.auth_user_id) { setModalError('Student has no linked account.'); return; }
                try {
                  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                  const { data: { session: s } } = await sb.auth.getSession();
                  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${modal.data.auth_user_id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${s?.access_token}`,
                      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ password: pw }),
                  });
                  if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed'); }
                  setModal(null);
                  setModalError('');
                } catch (err: any) { setModalError(err.message || 'Reset failed'); }
              }}>Set PIN</button>
              <button onClick={() => setModal(null)} className="tp-btn-outline">Cancel</button>
            </div>
          </ModalWrapper>
        );
      }
      default: return null;
    }
  }

}

// ── Modal Components ──

function ModalWrapper({ title, children, onClose, danger }: { title: string; children: React.ReactNode; onClose: () => void; danger?: boolean }) {
  return (
    <div className="tp-modal-bg" onClick={onClose}>
      <div className="tp-modal" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, width:32, height:32, borderRadius:'50%', background:'rgba(160,140,220,0.1)', border:'none', fontSize:'1rem', cursor:'pointer', color:'#8080c0' }}>✕</button>
        <h3 style={{ fontWeight:800, fontSize:'1.1rem', marginBottom:20, color: danger ? '#c03030' : '#3040a0' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ModalForm({ fields, onSubmit, submitLabel, error, onCancel }: {
  fields: { label: string; name: string; type: string; placeholder?: string; default?: string; readonly?: boolean; optional?: boolean }[];
  onSubmit: (vals: Record<string, string>) => void;
  submitLabel: string;
  error: string;
  onCancel: () => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    fields.forEach(f => init[f.name] = f.default || '');
    return init;
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(vals);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      {fields.map(f => (
        <div key={f.name} className="mb-3">
          <label className="tp-label">{f.label} {f.optional && <span className="text-xs" style={{ color: '#9a7040' }}>(optional)</span>}</label>
          {f.type === 'textarea' ? (
            <textarea className="tp-input" style={{ resize:'none' }} rows={2} placeholder={f.placeholder} value={vals[f.name] || ''} onChange={e => setVals(p => ({ ...p, [f.name]: e.target.value }))} />
          ) : (
            <input type={f.type} className="tp-input" placeholder={f.placeholder} value={vals[f.name] || ''} readOnly={f.readonly} onChange={e => setVals(p => ({ ...p, [f.name]: e.target.value }))} />
          )}
        </div>
      ))}
      {error && <div className="tp-err">{error}</div>}
      <div style={{ display:'flex', gap:10 }}>
        <button type="submit" disabled={submitting} className="tp-btn-primary">{submitting ? 'Saving…' : submitLabel}</button>
        <button type="button" onClick={onCancel} className="tp-btn-outline">Cancel</button>
      </div>
    </form>
  );
}





// ══════════════════════════════════════════════════════════════════════
// STARS TAB — Teacher awards stars to students (like ClassDojo)
// ══════════════════════════════════════════════════════════════════════

// Bot thumbnails use the shared BotAvatar component
import { TeacherBotThumbnail } from '../components/BotAvatar';

// Alias for backwards compatibility within this file
const MiniBotAvatar = ({ colorIndex, size = 90, facePixels, botElements, starPoints }: { colorIndex: number; size?: number; facePixels?: string[] | null; botElements?: any[] | null; starPoints?: number }) =>
  <TeacherBotThumbnail colorIndex={colorIndex} botElements={botElements ?? null} facePixels={facePixels ?? null} starPoints={starPoints} size={size} />;


function StarsTab({ students, session }: { students: Student[]; session: NonNullable<import('../lib/auth').Session> }) {
  const [starPoints, setStarPoints] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [giving, setGiving] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<Record<string, string>>({});
  const [colorMap, setColorMap] = React.useState<Record<string, number>>({});
  const [facePixelMap, setFacePixelMap] = React.useState<Record<string, string[] | null>>({});
  const [botElementMap, setBotElementMap] = React.useState<Record<string, any[] | null>>({});

  React.useEffect(() => {
    loadStars();
    loadColors();
  }, [students]);

  const loadStars = async () => {
    setLoading(true);
    try {
      const ids = students.map(s => s.id);
      if (ids.length === 0) { setLoading(false); return; }
      const { data } = await sb.from('student_star_points')
        .select('student_id, points')
        .in('student_id', ids);
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => { map[r.student_id] = r.points; });
      setStarPoints(map);
    } catch { /* table may not exist yet */ }
    setLoading(false);
  };

  const loadColors = async () => {
    try {
      const ids = students.map(s => s.id);
      if (ids.length === 0) return;
      const { data } = await sb.from('students').select('id, robot_color_index, face_pixels, bot_elements').in('id', ids);
      const colorM: Record<string, number> = {};
      const faceM: Record<string, string[] | null> = {};
      const botM: Record<string, any[] | null> = {};
      (data || []).forEach((r: any) => {
        colorM[r.id] = r.robot_color_index || 0;
        faceM[r.id] = r.face_pixels ? JSON.parse(r.face_pixels) : null;
        botM[r.id]  = r.bot_elements ? JSON.parse(r.bot_elements) : null;
      });
      setColorMap(colorM);
      setFacePixelMap(faceM);
      setBotElementMap(botM);
    } catch {}
  };

  const giveStars = async (studentId: string, amount: number, type: 'bronze' | 'silver' | 'gold') => {
    setGiving(studentId);
    try {
      const current = starPoints[studentId] || 0;
      const newTotal = current + amount;
      await sb.from('student_star_points').upsert({
        student_id: studentId,
        teacher_id: session.user.id,
        points: newTotal,
      }, { onConflict: 'student_id' });
      setStarPoints(prev => ({ ...prev, [studentId]: newTotal }));
      setFlash(prev => ({ ...prev, [studentId]: type }));
      setTimeout(() => setFlash(prev => { const n = { ...prev }; delete n[studentId]; return n; }), 1200);
    } catch (err: any) { alert('Error: ' + err.message); }
    setGiving(null);
  };

  const starColors = {
    bronze: { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', label: '⭐', pts: 1, glow: 'rgba(245,158,11,0.5)', name: 'Bronze' },
    silver: { bg: 'linear-gradient(135deg,#94a3b8,#64748b)', label: '🌟', pts: 2, glow: 'rgba(148,163,184,0.5)', name: 'Silver' },
    gold:   { bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)', label: '✨', pts: 3, glow: 'rgba(251,191,36,0.6)', name: 'Gold'   },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        @keyframes cardGlow { 0%,100%{box-shadow:0 2px 12px rgba(0,0,0,0.07)} 50%{box-shadow:0 0 32px 8px rgba(255,200,0,0.45)} }
        @keyframes ptsPop   { 0%{transform:scale(1)} 50%{transform:scale(1.45)} 100%{transform:scale(1)} }
        .star-btn { transition: transform 0.12s, box-shadow 0.12s !important; }
        .star-btn:hover:not(:disabled) { transform: scale(1.18) !important; }
        .star-btn:active:not(:disabled) { transform: scale(0.9) !important; }
        .star-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .card-flash { animation: cardGlow 1s ease-out forwards; }
        .pts-pop    { animation: ptsPop 0.35s ease-out; }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,rgba(255,215,0,0.12),rgba(255,165,0,0.08))', borderRadius: 20, padding: '18px 24px', border: '1.5px solid rgba(255,200,50,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#92400e', marginBottom: 4 }}>⭐ Star Points</div>
          <div style={{ fontSize: '0.8rem', color: '#b45309', lineHeight: 1.5 }}>
            Tap a star to award points — students spend them on card packs.&nbsp;
            <span style={{ background: '#f59e0b22', padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, color: '#92400e' }}>⭐ = 1pt</span>&nbsp;
            <span style={{ background: '#94a3b822', padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>🌟 = 2pts</span>&nbsp;
            <span style={{ background: '#fbbf2422', padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, color: '#a07000' }}>✨ = 3pts</span>
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 700 }}>{students.length} students</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9090c0', fontSize: '0.85rem' }}>Loading…</div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9090c0', fontSize: '0.85rem', fontStyle: 'italic' }}>No students yet — add some in the Students tab first.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 18 }}>
          {students.map(student => {
            const pts = starPoints[student.id] || 0;
            const colorIdx = colorMap[student.id] || 0;
            const isFlashing = !!flash[student.id];
            const isBusy = giving === student.id;
            return (
              <div key={student.id}
                className={isFlashing ? 'card-flash' : ''}
                style={{ background: 'white', borderRadius: 22, padding: '14px 10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1.5px solid rgba(180,160,220,0.15)', position: 'relative' }}>

                {/* Points badge — re-keys on pts to retrigger ptsPop animation */}
                <div key={`pts-${student.id}-${pts}`} className="pts-pop"
                  style={{ position: 'absolute', top: -11, right: -11, background: pts > 0 ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : '#e5e7eb', color: pts > 0 ? 'white' : '#9ca3af', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.85rem', boxShadow: pts > 0 ? '0 2px 8px rgba(251,191,36,0.6)' : 'none', border: '2.5px solid white', zIndex: 1 }}>
                  {pts}
                </div>

                {/* Bot */}
                <MiniBotAvatar colorIndex={colorIdx} size={90} facePixels={facePixelMap[student.id]} botElements={botElementMap[student.id]} starPoints={pts} />

                {/* Name */}
                <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#3040a0', textAlign: 'center', lineHeight: 1.2 }}>{student.name}</div>

                {/* Star buttons */}
                <div style={{ display: 'flex', gap: 5, width: '100%', marginTop: 2 }}>
                  {(Object.entries(starColors) as [string, typeof starColors.bronze][]).map(([type, cfg]) => (
                    <button key={type} className="star-btn" disabled={isBusy}
                      onClick={() => giveStars(student.id, cfg.pts, type as any)}
                      title={`${cfg.name}: +${cfg.pts} star point${cfg.pts > 1 ? 's' : ''}`}
                      style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: cfg.bg, cursor: 'pointer', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 3px 10px ${cfg.glow}` }}>
                      {isBusy ? '…' : cfg.label}
                    </button>
                  ))}
                </div>

                {/* pt labels under buttons */}
                <div style={{ display: 'flex', gap: 5, width: '100%' }}>
                  {(Object.entries(starColors) as [string, typeof starColors.bronze][]).map(([type, cfg]) => (
                    <div key={type} style={{ flex: 1, textAlign: 'center', fontSize: '0.58rem', fontWeight: 700, color: '#a0a0b8', letterSpacing: '0.04em' }}>+{cfg.pts}pt</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════
// CARD DATABASE VIEW — filtered, paginated view of all created cards
// ══════════════════════════════════════════════════════════════════════

const DB_PAGE_SIZE = 12;
const DB_TYPE_FILTERS = [
  { id: 'all',       label: 'All',       emoji: '🃏', color: '#6060a0' },
  { id: 'animals',   label: 'Animals',   emoji: '🐾', color: '#16a34a' },
  { id: 'xanimals',  label: 'Xanimals',  emoji: '🧬', color: '#7c3aed' },
  { id: 'creatures', label: 'Creatures', emoji: '👾', color: '#0369a1' },
  { id: 'humanoids', label: 'Humanoids', emoji: '🧑', color: '#b45309' },
  { id: 'robots',    label: 'Robots',    emoji: '🤖', color: '#374151' },
];
const DB_RARITY_FILTERS = [
  { id: 'all',        label: 'All',      color: '#6060a0' },
  { id: 'common',     label: 'Common',   color: '#9ca3af' },
  { id: 'silver',     label: 'Silver',   color: '#94a3b8' },
  { id: 'gold-rare',  label: 'Gold',     color: '#f59e0b' },
  { id: 'prismatic',  label: '🌈 Prismatic', color: '#a855f7' },
];

function TeacherCardDatabaseView({ session }: { session: NonNullable<import('../lib/auth').Session> }) {
  const [allCards, setAllCards] = React.useState<any[]>([]);
  const [loading, setLoading]   = React.useState(true);
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [page, setPage] = React.useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await sb.from('card_database')
        .select('*')
        .eq('teacher_id', session.user.id)
        .order('created_at', { ascending: false });
      setAllCards(data || []);
    } catch { }
    setLoading(false);
  };

  React.useEffect(() => { load(); }, []);
  React.useEffect(() => { setPage(0); }, [typeFilter]);

  const filtered = allCards.filter(c => typeFilter === 'all' || c.type === typeFilter);

  const totalPages = Math.max(1, Math.ceil(filtered.length / DB_PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageCards  = filtered.slice(safePage * DB_PAGE_SIZE, (safePage + 1) * DB_PAGE_SIZE);
  const startNum   = filtered.length === 0 ? 0 : safePage * DB_PAGE_SIZE + 1;
  const endNum     = Math.min((safePage + 1) * DB_PAGE_SIZE, filtered.length);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this card from the database?')) return;
    await sb.from('card_database').delete().eq('id', id);
    setAllCards(prev => prev.filter(c => c.id !== id));
  };

  const FBtn = ({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{ padding: '5px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', border: active ? `2px solid ${color}` : '1.5px solid rgba(160,140,220,0.2)', background: active ? `${color}18` : 'rgba(255,255,255,0.6)', color: active ? color : '#8090b0', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>{children}</button>
  );

  return (
    <div>
      {/* Filter row — Type */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: '#a0a0c0', textTransform: 'uppercase', marginBottom: 6 }}>Category</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {DB_TYPE_FILTERS.map(t => {
            const count = t.id === 'all' ? allCards.length : allCards.filter(c => c.type === t.id).length;
            return <FBtn key={t.id} active={typeFilter === t.id} color={t.color} onClick={() => setTypeFilter(t.id)}>{t.emoji} {t.label} <span style={{ opacity: 0.6 }}>({count})</span></FBtn>;
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9090c0' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🃏</div>
          <div style={{ color: '#9090c0', fontStyle: 'italic' }}>{allCards.length === 0 ? 'No cards yet — use ➕ Add Card to create some!' : 'No cards match these filters'}</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
            {pageCards.map(c => {
              const dc = DB_TYPE_FILTERS.find(t => t.id === c.type)?.color || '#3b82f6';
              const rc = DB_RARITY_FILTERS.find(r => r.id === c.rarity)?.color || '#9ca3af';
              return (
                <div key={c.id} style={{ background: 'rgba(255,255,255,0.7)', border: `1.5px solid ${rc}44`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 6, background: `linear-gradient(90deg,${dc},${rc})` }} />
                  {c.image_url && <img src={c.image_url} alt={c.card_name} style={{ width: '100%', height: 110, objectFit: 'cover' }} />}
                  <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#3040a0' }}>{c.card_name}</div>
                    <div style={{ fontSize: '0.68rem', color: '#6070b0', fontStyle: 'italic', lineHeight: 1.35, flex: 1 }}>{c.description}</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                      <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 10, background: `${dc}22`, color: dc, fontWeight: 700 }}>{c.type}</span>
                      <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 10, background: `${rc}22`, color: rc, fontWeight: 700 }}>{c.rarity}</span>
                      {c.is_rare_exclusive && <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: '#92400e', fontWeight: 700 }}>🌟 ×{c.max_copies}</span>}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#8090b0', display: 'flex', gap: 8 }}>
                      <span>❤️ {c.hp}</span><span>⚡ {c.move1_dmg}</span><span>💥 {c.move2_dmg}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 800 }}>⭐ {c.skill_points} pts</span>
                      <button onClick={() => handleDelete(c.id)} className="tp-btn-danger" style={{ fontSize: '0.65rem', padding: '3px 9px' }}>🗑 Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {filtered.length > DB_PAGE_SIZE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                style={{ width: 38, height: 38, borderRadius: '50%', border: '1.5px solid rgba(160,140,220,0.3)', background: safePage === 0 ? 'rgba(160,140,220,0.05)' : 'rgba(160,140,220,0.12)', color: safePage === 0 ? '#c0c0d8' : '#5040a0', cursor: safePage === 0 ? 'default' : 'pointer', fontSize: '1rem', fontWeight: 700 }}>←</button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#3040a0' }}>{startNum}–{endNum} <span style={{ color: '#a0a0c0', fontWeight: 500 }}>of</span> {filtered.length}</div>
                <div style={{ fontSize: '0.62rem', color: '#b0b0d0' }}>Page {safePage + 1} of {totalPages}</div>
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}
                style={{ width: 38, height: 38, borderRadius: '50%', border: '1.5px solid rgba(160,140,220,0.3)', background: safePage >= totalPages - 1 ? 'rgba(160,140,220,0.05)' : 'rgba(160,140,220,0.12)', color: safePage >= totalPages - 1 ? '#c0c0d8' : '#5040a0', cursor: safePage >= totalPages - 1 ? 'default' : 'pointer', fontSize: '1rem', fontWeight: 700 }}>→</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// CARD DATABASE TAB — Teacher creates cards for the pack pool
// ══════════════════════════════════════════════════════════════════════

const DB_DECK_OPTIONS = [
  { id: 'xanimals',  label: '🧬 Xanimals',  color: '#06b6d4' },
  { id: 'animals',   label: '🐾 Animals',   color: '#22c55e' },
  { id: 'creatures', label: '👾 Creatures',  color: '#a855f7' },
  { id: 'humanoids', label: '🧑 Humanoids', color: '#f59e0b' },
  { id: 'robots',    label: '🤖 Robots',    color: '#3b82f6' },
];

const DB_RARITY_OPTIONS = [
  { id: 'common',    label: '⭐ Common',     color: '#9ca3af', hint: 'Available in all packs' },
  { id: 'silver',    label: '✦ Silver',      color: '#94a3b8', hint: 'Less common in packs' },
  { id: 'gold-rare', label: '★ Gold',        color: '#f59e0b', hint: 'Rare — few per pack cycle' },
  { id: 'prismatic', label: '🌈 Rainbow',    color: '#a855f7', hint: 'Extremely rare, holographic' },
];

function CardDatabaseTab({ session }: { session: NonNullable<import('../lib/auth').Session> }) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Card fields
  const [cardName, setCardName] = React.useState('');
  const [cardDeck, setCardDeck] = React.useState('animals');
  const [cardRarity, setCardRarity] = React.useState('common');
  const [cardDescription, setCardDescription] = React.useState('');
  const [isRareExclusive, setIsRareExclusive] = React.useState(false);
  const [maxCopies, setMaxCopies] = React.useState(5);
  const [weakActionName, setWeakActionName] = React.useState('');
  const [strongActionName, setStrongActionName] = React.useState('');

  // Image
  const [dbImage, setDbImage] = React.useState<string | null>(null);
  const [dbCroppedImage, setDbCroppedImage] = React.useState<string | null>(null);
  const [dbScale, setDbScale] = React.useState(1);
  const [dbRotation, setDbRotation] = React.useState(0);
  const [dbPosition, setDbPosition] = React.useState({ x: 0, y: 0 });
  const [dbIsDragging, setDbIsDragging] = React.useState(false);
  const [dbDragStart, setDbDragStart] = React.useState({ clientX: 0, clientY: 0, startX: 0, startY: 0 });

  // Save
  const [saving, setSaving] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState('');

  // Stat ranges stored for reference — stats are rolled at pack-open time, not here
  const RARITY_RANGES: Record<string, { hpMin:number; hpMax:number; weakMin:number; weakMax:number; strongMin:number; strongMax:number; skillPts:number }> = {
    'common':    { hpMin:80,  hpMax:100, weakMin:40, weakMax:50,  strongMin:50,  strongMax:70,  skillPts:1 },
    'silver':    { hpMin:100, hpMax:120, weakMin:50, weakMax:60,  strongMin:60,  strongMax:80,  skillPts:2 },
    'gold-rare': { hpMin:120, hpMax:140, weakMin:60, weakMax:75,  strongMin:80,  strongMax:100, skillPts:3 },
    'prismatic': { hpMin:150, hpMax:180, weakMin:75, weakMax:95,  strongMin:100, strongMax:130, skillPts:5 },
  };


  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setDbImage(ev.target?.result as string);
      setDbCroppedImage(null);
      setDbScale(1); setDbRotation(0); setDbPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const cropImage = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!dbImage) { reject(new Error('No image')); return; }
      const OUTPUT_W = 480; const OUTPUT_H = 360;
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_W; canvas.height = OUTPUT_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas error')); return; }
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.translate(OUTPUT_W / 2, OUTPUT_H / 2);
        ctx.rotate((dbRotation * Math.PI) / 180);
        ctx.scale(dbScale, dbScale);
        ctx.translate((dbPosition.x / 100) * OUTPUT_W, (dbPosition.y / 100) * OUTPUT_H);
        const coverScale = Math.max(OUTPUT_W / img.naturalWidth, OUTPUT_H / img.naturalHeight);
        const drawW = img.naturalWidth * coverScale;
        const drawH = img.naturalHeight * coverScale;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.crossOrigin = 'anonymous';
      img.src = dbImage;
    });
  };

  const handleCrop = async () => {
    try { setDbCroppedImage(await cropImage()); }
    catch (err: any) { alert(err.message || 'Crop failed'); }
  };

  const handleSaveToDatabase = async () => {
    if (!cardName.trim()) { setSavedMsg('Enter a card name.'); return; }
    if (!cardDescription.trim()) { setSavedMsg('Enter a card description.'); return; }
    if (!weakActionName.trim()) { setSavedMsg('Enter a weak action name.'); return; }
    if (!strongActionName.trim()) { setSavedMsg('Enter a strong action name.'); return; }
    setSaving(true); setSavedMsg('');
    try {
      const imageUrl = dbCroppedImage || dbImage || '';
      // Stats and rarity are NOT stored — assigned at pack-open time
      const payload = {
        teacher_id: session.user.id,
        card_name: cardName.trim(),
        type: cardDeck,
        rarity: null,
        description: cardDescription,
        image_url: imageUrl,
        hp: null,
        stat1_name: 'HP',                    stat1_val: null,
        stat2_name: weakActionName.trim(),    stat2_val: null,
        stat3_name: strongActionName.trim(),  stat3_val: null,
        move1_name: weakActionName.trim(),    move1_dmg: null,
        move2_name: strongActionName.trim(),  move2_dmg: null,
        skill_points: null,
        is_rare_exclusive: isRareExclusive,
        max_copies: isRareExclusive ? maxCopies : null,
        card_source: 'database',
        stats_sealed: true,
      };
      const { error } = await sb.from('card_database').insert(payload);
      if (error) throw error;
      setSavedMsg('✓ Card sealed and added to database!');
      setCardName(''); setCardDescription(''); setDbImage(null); setDbCroppedImage(null);
      setWeakActionName(''); setStrongActionName('');
      setIsRareExclusive(false); setMaxCopies(5);
      setDbScale(1); setDbRotation(0); setDbPosition({ x: 0, y: 0 });
    } catch (err: any) {
      setSavedMsg('Error: ' + (err.message || 'Save failed'));
    }
    setSaving(false);
  };


  const currentImage = dbCroppedImage || dbImage;
  const currentRange = RARITY_RANGES[cardRarity] || RARITY_RANGES['common'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,rgba(160,120,255,0.12),rgba(100,180,255,0.1))', borderRadius: 20, padding: '18px 24px', border: '1.5px solid rgba(160,140,220,0.2)' }}>
        <div style={{ fontSize: '1rem', fontWeight: 900, color: '#3040a0', marginBottom: 4 }}>🃏 Card Database</div>
        <div style={{ fontSize: '0.8rem', color: '#6070b0', lineHeight: 1.5 }}>
          Create cards for the pack pool. Students spend ⭐ star points on packs — each pack pulls random cards from this database. Higher rarity cards appear less often.
        </div>
      </div>

      {/* Card Builder */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 260px', gap: '1.5rem', alignItems: 'start' }}>

        {/* Column 1: Image */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="tp-panel">
            <div className="tp-section">1 · Upload Image</div>
            <div style={{ background: '#1a1a2e', borderRadius: 8, border: '2px dashed rgba(120,100,200,0.3)', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8, position: 'relative' }}>
              {dbImage ? (
                <img src={dbImage} alt="preview" draggable={false}
                  onMouseDown={e => { if (dbCroppedImage) return; e.preventDefault(); setDbIsDragging(true); setDbDragStart({ clientX: e.clientX, clientY: e.clientY, startX: dbPosition.x, startY: dbPosition.y }); }}
                  onMouseMove={e => { if (!dbIsDragging || dbCroppedImage) return; const dx = ((e.clientX - dbDragStart.clientX) / (e.currentTarget.parentElement?.offsetWidth || 200)) * 100; const dy = ((e.clientY - dbDragStart.clientY) / (e.currentTarget.parentElement?.offsetHeight || 150)) * 100; setDbPosition({ x: dbDragStart.startX + dx, y: dbDragStart.startY + dy }); }}
                  onMouseUp={() => setDbIsDragging(false)} onMouseLeave={() => setDbIsDragging(false)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${dbPosition.x}%, ${dbPosition.y}%) scale(${dbScale}) rotate(${dbRotation}deg)`, cursor: dbCroppedImage ? 'default' : (dbIsDragging ? 'grabbing' : 'grab'), userSelect: 'none', minHeight: 130 }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#6070b0', fontSize: '0.75rem', padding: 16 }}><div style={{ fontSize: '2rem', marginBottom: 4 }}>🖼</div>No image</div>
              )}
            </div>
            {dbImage && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[['↺', () => setDbRotation(r => r - 90)], ['↻', () => setDbRotation(r => r + 90)], ['⟳', () => { setDbScale(1); setDbRotation(0); setDbPosition({ x:0,y:0 }); setDbCroppedImage(null); }]].map(([l, fn]: any) => (
                  <button key={l} onClick={fn} style={{ fontSize:'0.68rem', padding:'3px 9px', border:'1px solid rgba(160,140,220,0.25)', borderRadius:4, background:'rgba(255,255,255,0.6)', cursor:'pointer', color:'#6070b0' }}>{l}</button>
                ))}
              </div>
            )}
            {dbImage && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <span style={{ fontSize:'0.65rem', color:'#8090b0', flexShrink:0 }}>🔍</span>
                <input type="range" min="0.3" max="5" step="0.05" value={dbScale}
                  onChange={e => setDbScale(parseFloat(e.target.value))} style={{ flex:1, accentColor:'#9575cd' }} />
                <span style={{ fontSize:'0.68rem', color:'#8090b0', width:28, textAlign:'right' }}>{dbScale.toFixed(1)}×</span>
              </div>
            )}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display:'none' }} />
            <button onClick={() => fileInputRef.current?.click()} style={{ width:'100%', padding:'0.5rem', border:'1.5px dashed rgba(160,140,220,0.35)', borderRadius:8, background:'rgba(160,140,220,0.06)', color:'#6070b0', fontSize:'0.8rem', cursor:'pointer', fontWeight:700 }}>
              📁 Upload Image
            </button>
            {dbImage && (
              <>
                <button onClick={handleCrop} style={{ width:'100%', marginTop:6, padding:'0.45rem', border:`2px solid ${dbCroppedImage ? 'rgba(80,160,80,0.5)' : 'rgba(80,160,80,0.3)'}`, borderRadius:8, background: dbCroppedImage ? 'rgba(80,160,80,0.12)' : 'rgba(80,160,80,0.06)', color:'#1a6a2a', fontSize:'0.8rem', cursor:'pointer', fontWeight:800 }}>
                  {dbCroppedImage ? '✓ Re-crop' : '✂ Crop & Apply'}
                </button>
                <button onClick={() => { setDbImage(null); setDbCroppedImage(null); setDbScale(1); setDbRotation(0); setDbPosition({x:0,y:0}); }} style={{ width:'100%', marginTop:4, padding:'0.3rem', border:'1px solid rgba(200,50,50,0.2)', borderRadius:6, background:'transparent', color:'#b04040', fontSize:'0.72rem', cursor:'pointer' }}>
                  ✕ Remove
                </button>
              </>
            )}
          </div>
        </div>

        {/* Column 2: Card Details */}
        <div className="tp-panel" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="tp-section">2 · Card Details</div>

          {/* Name */}
          <div>
            <label className="tp-label">Card Name</label>
            <input type="text" className="tp-input" placeholder="e.g. Zephyr the Storm Fox"
              value={cardName} onChange={e => setCardName(e.target.value)} />
          </div>

          {/* Rarity — preview only, does not affect card creation */}
          <div>
            <label className="tp-label">Preview Rarity <span style={{ fontWeight:400, fontSize:'0.7rem', color:'#b0b8cc', textTransform:'none', letterSpacing:0 }}>(for preview only — rarity is assigned when a pack is opened)</span></label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
              {DB_RARITY_OPTIONS.map(r => (
                <button key={r.id} onClick={() => setCardRarity(r.id)} style={{ padding:'8px 10px', borderRadius:10, fontSize:'0.78rem', fontWeight:700, cursor:'pointer', textAlign:'left', border: cardRarity === r.id ? `2px solid ${r.color}` : '1.5px solid rgba(180,160,220,0.2)', background: cardRarity === r.id ? `${r.color}18` : 'rgba(255,255,255,0.5)', color: cardRarity === r.id ? r.color : '#8090b0' }}>
                  <div>{r.label}</div>
                  <div style={{ fontSize:'0.65rem', opacity:0.7, marginTop:1 }}>{r.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Deck Type */}
          <div>
            <label className="tp-label">Deck Type</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {DB_DECK_OPTIONS.map(d => (
                <button key={d.id} onClick={() => setCardDeck(d.id)} style={{ padding:'5px 12px', borderRadius:20, fontSize:'0.76rem', fontWeight:700, cursor:'pointer', border: cardDeck === d.id ? `2px solid ${d.color}` : '1.5px solid rgba(180,160,220,0.2)', background: cardDeck === d.id ? `${d.color}18` : 'rgba(255,255,255,0.5)', color: cardDeck === d.id ? d.color : '#8090b0' }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="tp-label">Description</label>
            <textarea className="tp-input" rows={2} style={{ resize:'none' }}
              placeholder="A mysterious creature that prowls the neon jungles…"
              value={cardDescription} onChange={e => setCardDescription(e.target.value)} />
          </div>

          {/* Actions */}
          <div>
            <label className="tp-label">Action Names</label>
            <div style={{ background:'rgba(255,255,255,0.5)', border:'1.5px solid rgba(180,160,220,0.2)', borderRadius:12, padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>

              <div style={{ background:'rgba(160,140,220,0.06)', border:'1px solid rgba(160,140,220,0.15)', borderRadius:8, padding:'8px 10px', fontSize:'0.72rem', color:'#6070b0', lineHeight:1.5 }}>
                🔒 <strong>Stats are sealed</strong> — HP and damage values are rolled randomly when a student opens their pack. Only name the actions here.
              </div>

              {/* Weak action */}
              <div>
                <div style={{ fontSize:'0.72rem', color:'#8090b0', fontWeight:700, marginBottom:4 }}>⚡ Weak Action <span style={{ fontWeight:400, color:'#b0b8cc' }}>({currentRange.weakMin}–{currentRange.weakMax} dmg when opened)</span></div>
                <input type="text" className="tp-input"
                  placeholder="e.g. Quick Scratch" value={weakActionName}
                  onChange={e => setWeakActionName(e.target.value)} />
              </div>

              {/* Strong action */}
              <div>
                <div style={{ fontSize:'0.72rem', color:'#8090b0', fontWeight:700, marginBottom:4 }}>💥 Strong Action <span style={{ fontWeight:400, color:'#b0b8cc' }}>({currentRange.strongMin}–{currentRange.strongMax} dmg when opened)</span></div>
                <input type="text" className="tp-input"
                  placeholder="e.g. Thunder Strike" value={strongActionName}
                  onChange={e => setStrongActionName(e.target.value)} />
              </div>

              {/* HP range info */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:6, borderTop:'1px solid rgba(180,160,220,0.15)', fontSize:'0.72rem', color:'#8090b0' }}>
                <span>❤️ Hit Points</span>
                <span style={{ fontWeight:700, color:'#b0b8cc' }}>{currentRange.hpMin}–{currentRange.hpMax} (rolled on open)</span>
              </div>
            </div>
          </div>

          {/* Rare Exclusive */}
          <div style={{ background: isRareExclusive ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.4)', border:`1.5px solid ${isRareExclusive ? 'rgba(245,158,11,0.3)' : 'rgba(180,160,220,0.2)'}`, borderRadius:12, padding:'10px 14px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: isRareExclusive ? 8 : 0 }}>
              <div>
                <div style={{ fontSize:'0.8rem', fontWeight:800, color: isRareExclusive ? '#92400e' : '#6070b0' }}>🌟 Rare Exclusive</div>
                <div style={{ fontSize:'0.65rem', color:'#8090b0', marginTop:2 }}>Limit how many students can own this card</div>
              </div>
              <button onClick={() => setIsRareExclusive(v => !v)} style={{ padding:'4px 14px', borderRadius:20, fontSize:'0.75rem', fontWeight:800, border:'none', cursor:'pointer', background: isRareExclusive ? 'rgba(245,158,11,0.2)' : 'rgba(180,160,220,0.15)', color: isRareExclusive ? '#92400e' : '#8090b0' }}>
                {isRareExclusive ? 'ON' : 'OFF'}
              </button>
            </div>
            {isRareExclusive && (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <label className="tp-label" style={{ margin:0, flexShrink:0 }}>Max copies:</label>
                <input type="number" min={1} max={50} value={maxCopies} onChange={e => setMaxCopies(parseInt(e.target.value)||1)}
                  className="tp-input" style={{ width:70, textAlign:'center' }} />
                <span style={{ fontSize:'0.7rem', color:'#9a7040' }}>students can own this</span>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Preview + Save */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="tp-section">3 · Preview & Save</div>

          {/* PokeCard preview */}
          <div style={{ transform:'scale(0.72)', transformOrigin:'top center', marginBottom: '-80px' }}>
            <PokeCard card={{
              id: 'preview',
              student_id: '',
              teacher_id: '',
              card_name: cardName || 'Card Name',
              hp: 0,
              type: cardDeck,
              rarity: cardRarity as any,
              description: cardDescription || 'A mysterious creature awaits…',
              stat1_name: 'HP',                              stat1_val: 0,
              stat2_name: weakActionName   || 'Weak Action', stat2_val: 0,
              stat3_name: strongActionName || 'Strong Action', stat3_val: 0,
              move1_name: weakActionName   || 'Weak Action', move1_dmg: 0,
              move2_name: strongActionName || 'Strong Action', move2_dmg: 0,
              image_url: currentImage || '',
              created_at: '',
            }} showShimmerBtn />
          </div>

          {/* Sealed badge */}
          <div style={{ background:'rgba(100,80,180,0.08)', border:'1.5px solid rgba(100,80,180,0.2)', borderRadius:12, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontSize:'0.8rem', fontWeight:800, color:'#4040a0' }}>🔒 Stats Sealed</div>
            <div style={{ fontSize:'0.68rem', color:'#6070b0', marginTop:3, lineHeight:1.4 }}>
              HP, damage & skill points are rolled<br/>randomly when a student opens their pack
            </div>
            <div style={{ display:'flex', justifyContent:'center', gap:12, marginTop:8, fontSize:'0.7rem', color:'#8090b0' }}>
              <span>❤️ {currentRange.hpMin}–{currentRange.hpMax}</span>
              <span>⚡ {currentRange.weakMin}–{currentRange.weakMax}</span>
              <span>💥 {currentRange.strongMin}–{currentRange.strongMax}</span>
            </div>
          </div>

          {savedMsg && (
            <div style={{ padding:'8px 14px', borderRadius:10, fontSize:'0.8rem', fontWeight:700, background: savedMsg.startsWith('✓') ? 'rgba(80,200,120,0.1)' : 'rgba(255,80,80,0.08)', border:`1px solid ${savedMsg.startsWith('✓') ? 'rgba(80,200,120,0.3)' : 'rgba(255,80,80,0.25)'}`, color: savedMsg.startsWith('✓') ? '#1a6a3a' : '#c03030', textAlign:'center' }}>
              {savedMsg}
            </div>
          )}

          <button onClick={handleSaveToDatabase} disabled={saving} className="tp-btn-primary" style={{ width:'100%', fontSize:'0.88rem' }}>
            {saving ? 'Saving…' : '💾 Add to Card Database'}
          </button>

          <p style={{ fontSize:'0.65rem', color:'#9090c0', textAlign:'center', margin:0, fontStyle:'italic' }}>
            This card will appear in packs students buy with star points
          </p>
        </div>
      </div>

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// WEEKLY PROJECT TAB
// ══════════════════════════════════════════════════════════════════════

function WeeklyProjectTab({
  students, session,
  weeklyTask, setWeeklyTask,
  weeklyTitle, setWeeklyTitle,
  weeklyCharHint, setWeeklyCharHint,
  weeklyGenerating, setWeeklyGenerating,
  weeklyCard, setWeeklyCard,
  weeklyProject, setWeeklyProject,
  weeklyStatus, setWeeklyStatus,
  weeklyStatusType, setWeeklyStatusType,
  awardModal, setAwardModal,
  awardSelections, setAwardSelections,
  awardError, setAwardError,
  awarding, setAwarding,
  weeklyEndDate, setWeeklyEndDate,
  weeklyView, setWeeklyView,
  submissions, setSubmissions,
  submissionsLoading, setSubmissionsLoading,
  onRefresh,
}: any) {

  const setWWorking = (m: string) => { setWeeklyStatus(m); setWeeklyStatusType('working'); };
  const setWDone    = (m: string) => { setWeeklyStatus(m); setWeeklyStatusType('done'); setTimeout(() => setWeeklyStatus(''), 2800); };
  const setWErr     = (m: string) => { setWeeklyStatus(m); setWeeklyStatusType('error'); };

  // ── Load submissions for this project ───────────────────────────
  const loadSubmissions = async (projectId: string) => {
    setSubmissionsLoading(true);
    try {
      const { data } = await sb
        .from('weekly_submissions')
        .select('*, students(name)')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false });
      setSubmissions(data || []);
    } catch { setSubmissions([]); }
    setSubmissionsLoading(false);
  };

  // ── Generate the weekly card ─────────────────────────────────────
  const handleGenerate = async () => {
    if (!weeklyTask.trim()) { setWErr('Describe the weekly task first.'); return; }
    if (!weeklyTitle.trim()) { setWErr('Give the project a title.'); return; }
    setWeeklyGenerating(true);
    setWeeklyCard(null);
    setWWorking('Generating Weekly Project card…');
    try {
      const data = await AI.generateCardData('Weekly Project', weeklyTask, weeklyCharHint, 'gold-rare');
      data.cardName = weeklyTitle;
      setWWorking('Generating card image…');
      const imgUrl = AI.generateImageUrl(data.imagePrompt || weeklyTitle);
      await new Promise<void>(r => {
        const img = new Image();
        img.onload = () => r(); img.onerror = () => r();
        img.src = imgUrl; setTimeout(r, 2500);
      });
      const card = {
        card_name: data.cardName, hp: data.hp, type: data.type,
        description: data.description,
        stat1_name: data.stat1Name, stat1_val: data.stat1Val,
        stat2_name: data.stat2Name, stat2_val: data.stat2Val,
        stat3_name: data.stat3Name, stat3_val: data.stat3Val,
        move1_name: data.move1Name, move1_dmg: data.move1Dmg,
        move2_name: data.move2Name, move2_dmg: data.move2Dmg,
        rarity: 'gold-rare' as any,
        image_url: imgUrl,
        card_source: 'generated' as any,
      };
      setWeeklyCard(card);
      setWDone('Card generated! Save the project to publish it.');
    } catch (err: any) { setWErr(err.message || 'Generation failed'); }
    setWeeklyGenerating(false);
  };

  // ── Save / publish the weekly project ───────────────────────────
  const handleSaveProject = async () => {
    if (!weeklyCard) { setWErr('Generate a card first.'); return; }
    setWWorking('Saving project…');
    try {
      const payload: any = {
        teacher_id: session.user.id,
        title: weeklyTitle,
        task: weeklyTask,
        char_hint: weeklyCharHint,
        card_data: weeklyCard,
        week_label: getCurrentWeekLabel(),
        end_date: weeklyEndDate || null,
      };
      let saved;
      if (weeklyProject?.id) {
        const { data } = await sb.from('weekly_projects').update(payload).eq('id', weeklyProject.id).select().single();
        saved = data;
      } else {
        const { data } = await sb.from('weekly_projects').insert(payload).select().single();
        saved = data;
      }
      setWeeklyProject(saved);
      setWDone('Weekly project published! Students can now see it.');
    } catch (err: any) { setWErr(err.message); }
  };

  // ── New project ──────────────────────────────────────────────────
  const handleNewProject = () => {
    setWeeklyProject(null);
    setWeeklyTask(''); setWeeklyTitle(''); setWeeklyCharHint('');
    setWeeklyCard(null); setWeeklyStatus(''); setWeeklyEndDate('');
    setAwardSelections({}); setSubmissions([]);
  };

  // ── Award a single student from submissions view ─────────────────
  const handleAwardSubmission = async (submission: any, rarity: 'common' | 'silver' | 'gold-rare') => {
    if (!weeklyProject || !weeklyCard) return;
    try {
      const mult = rarity === 'common' ? 0.7 : rarity === 'silver' ? 0.85 : 1;
      const cardToSave = {
        ...weeklyCard,
        rarity,
        student_id: submission.student_id,
        teacher_id: session.user.id,
        card_source: 'generated' as any,
        stat1_val: Math.round(weeklyCard.stat1_val * mult),
        stat2_val: Math.round(weeklyCard.stat2_val * mult),
        stat3_val: Math.round(weeklyCard.stat3_val * mult),
        hp: Math.round((weeklyCard.hp || 100) * mult),
      };
      await Dashboard.saveCard(cardToSave as any);
      // Mark submission as awarded and delete photos
      await sb.from('weekly_submissions')
        .update({ status: 'awarded', photo1_url: null, photo2_url: null })
        .eq('id', submission.id);
      // Reload submissions
      await loadSubmissions(weeklyProject.id);
      setWDone(`✓ Awarded ${rarity} card to ${submission.students?.name || 'student'}!`);
      onRefresh();
    } catch (err: any) { setWErr(err.message); }
  };

  // ── Bulk award modal helpers (same as before) ────────────────────
  const handleOpenAward = () => { setAwardSelections({}); setAwardError(''); setAwardModal(true); };
  const handleToggleStudent = (studentId: string, rar: 'common' | 'silver' | 'gold-rare') => {
    setAwardSelections((prev: any) => {
      const next = { ...prev };
      if (next[studentId] === rar) delete next[studentId]; else next[studentId] = rar;
      return next;
    });
    setAwardError('');
  };
  const handleAward = async () => {
    if (!weeklyProject || !weeklyCard) return;
    const entries = Object.entries(awardSelections);
    if (entries.length === 0) { setAwardError('Select at least one student.'); return; }
    setAwarding(true); setAwardError('');
    try {
      let awarded = 0;
      for (const [studentId, rar] of entries) {
        const mult = rar === 'common' ? 0.7 : rar === 'silver' ? 0.85 : 1;
        await Dashboard.saveCard({
          ...weeklyCard, rarity: rar, student_id: studentId, teacher_id: session.user.id,
          card_source: 'generated' as any,
          stat1_val: Math.round(weeklyCard.stat1_val * mult),
          stat2_val: Math.round(weeklyCard.stat2_val * mult),
          stat3_val: Math.round(weeklyCard.stat3_val * mult),
          hp: Math.round((weeklyCard.hp || 100) * mult),
        } as any);
        awarded++;
      }
      setAwardModal(false); setAwardSelections({});
      setWDone(`✓ Awarded "${weeklyTitle}" card to ${awarded} student${awarded !== 1 ? 's' : ''}!`);
      onRefresh();
    } catch (err: any) { setAwardError(err.message); }
    setAwarding(false);
  };

  const awardCount = Object.keys(awardSelections).length;
  const hasProject = !!weeklyProject?.id;

  // Switch to submissions view and load
  const handleViewSubmissions = async () => {
    setWeeklyView('submissions');
    if (weeklyProject?.id) await loadSubmissions(weeklyProject.id);
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xs uppercase tracking-[0.15em] mb-1" style={{ color: '#c8a000' }}>
            📋 Weekly Project Card
          </h2>
          <p className="text-xs italic" style={{ color: '#9a7040' }}>
            {weeklyProject?.week_label || getCurrentWeekLabel()}
            {weeklyProject?.end_date && ` · Due ${new Date(weeklyProject.end_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}`}
            {!weeklyProject?.end_date && ' · Students see this task and earn the card for completing it'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasProject && (
            <>
              {/* View toggle */}
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(90,50,10,0.2)' }}>
                <button
                  onClick={() => setWeeklyView('project')}
                  style={{ padding: '5px 14px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', border: 'none', background: weeklyView === 'project' ? 'rgba(200,160,0,0.15)' : 'transparent', color: weeklyView === 'project' ? '#8b6a00' : '#9a7040' }}
                >📋 Project</button>
                <button
                  onClick={handleViewSubmissions}
                  style={{ padding: '5px 14px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', border: 'none', borderLeft: '1px solid rgba(90,50,10,0.2)', background: weeklyView === 'submissions' ? 'rgba(200,160,0,0.15)' : 'transparent', color: weeklyView === 'submissions' ? '#8b6a00' : '#9a7040' }}
                >📥 Submissions {submissions.length > 0 && <span style={{ background: '#c8a000', color: 'white', borderRadius: '50%', padding: '1px 5px', fontSize: '0.62rem', marginLeft: 4 }}>{submissions.length}</span>}</button>
              </div>
              <button onClick={handleOpenAward} className="tp-btn-gold" style={{ fontFamily: "'Cinzel',serif" }}>
                🏅 Award Students
              </button>
              <button onClick={handleNewProject} className="tp-btn-outline" style={{ borderColor: 'rgba(90,40,10,0.3)', color: '#7a5a40' }}>
                + New Project
              </button>
            </>
          )}
        </div>
      </div>

      {/* ══ SUBMISSIONS VIEW ═════════════════════════════════════════ */}
      {weeklyView === 'submissions' && hasProject && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: '#5a3a20' }}>
              Student Submissions — {weeklyTitle}
            </h3>
            <button onClick={() => loadSubmissions(weeklyProject.id)} className="tp-btn-outline" style={{ borderColor: 'rgba(90,40,10,0.2)', color: '#9a7040' }}>
              ↻ Refresh
            </button>
          </div>

          {submissionsLoading ? (
            <div className="text-sm italic text-center py-8" style={{ color: '#9a7040' }}>Loading submissions…</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12" style={{ background: 'rgba(255,248,222,0.4)', borderRadius: 16, border: '2px dashed rgba(200,160,0,0.2)' }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.2, marginBottom: 8 }}>📭</div>
              <p className="text-sm italic" style={{ color: '#9a7040' }}>No pending submissions yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {submissions.map((sub: any) => (
                <div key={sub.id} style={{ background: 'rgba(255,248,222,0.7)', border: '1px solid rgba(90,50,10,0.15)', borderRadius: 16, padding: '1.2rem 1.5rem' }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Student info */}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div className="font-bold text-sm mb-1" style={{ color: '#3d2b1f' }}>
                        {sub.students?.name || 'Unknown student'}
                      </div>
                      <div className="text-xs italic mb-3" style={{ color: '#9a7040' }}>
                        Submitted {new Date(sub.submitted_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {/* Photos */}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {sub.photo1_url && (
                          <a href={sub.photo1_url} target="_blank" rel="noopener noreferrer">
                            <img src={sub.photo1_url} alt="Evidence 1"
                              style={{ width: 110, height: 80, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(90,50,10,0.15)', cursor: 'pointer', transition: 'transform 0.15s' }}
                              onMouseEnter={e => { (e.target as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                              onMouseLeave={e => { (e.target as HTMLImageElement).style.transform = 'scale(1)'; }}
                            />
                          </a>
                        )}
                        {sub.photo2_url && (
                          <a href={sub.photo2_url} target="_blank" rel="noopener noreferrer">
                            <img src={sub.photo2_url} alt="Evidence 2"
                              style={{ width: 110, height: 80, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(90,50,10,0.15)', cursor: 'pointer', transition: 'transform 0.15s' }}
                              onMouseEnter={e => { (e.target as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                              onMouseLeave={e => { (e.target as HTMLImageElement).style.transform = 'scale(1)'; }}
                            />
                          </a>
                        )}
                        {!sub.photo1_url && !sub.photo2_url && (
                          <span className="text-xs italic" style={{ color: '#b0906a' }}>No photos attached</span>
                        )}
                      </div>
                    </div>

                    {/* Award buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <div className="text-xs font-bold mb-1 text-center" style={{ color: '#9a7040' }}>Award as:</div>
                      {([
                        { rar: 'common'    as const, label: '⭐ Common',  color: '#8b6a00', bg: 'rgba(200,160,0,0.1)',   border: 'rgba(200,160,0,0.35)' },
                        { rar: 'silver'    as const, label: '✦ Silver',   color: '#5a7a90', bg: 'rgba(120,160,190,0.1)', border: 'rgba(120,160,190,0.4)' },
                        { rar: 'gold-rare' as const, label: '★ Gold',     color: '#c07800', bg: 'rgba(212,160,23,0.1)',  border: 'rgba(212,160,23,0.4)' },
                      ]).map(({ rar, label, color, bg, border }) => (
                        <button
                          key={rar}
                          onClick={() => handleAwardSubmission(sub, rar)}
                          style={{ padding: '6px 18px', borderRadius: 8, border: `1px solid ${border}`, background: bg, color, fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', minWidth: 110, textAlign: 'center' }}
                          onMouseEnter={e => { (e.currentTarget).style.opacity = '0.75'; }}
                          onMouseLeave={e => { (e.currentTarget).style.opacity = '1'; }}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {weeklyStatus && <div className={`tp-status-${weeklyStatusType} mt-4`}>{weeklyStatus}</div>}
        </div>
      )}

      {/* ══ PROJECT VIEW ═════════════════════════════════════════════ */}
      {weeklyView === 'project' && (
        <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(320px,420px) 1fr' }}>

          {/* Left: form */}
          <div className="p-6 rounded-xs" style={{ background: 'rgba(255,248,222,0.65)', border: '1px solid rgba(90,50,10,0.18)', boxShadow: '2px 3px 12px rgba(0,0,0,0.09)' }}>

            <div className="mb-4">
              <label className="tp-label">Project Title</label>
              <input type="text" className="tp-input"
                placeholder="e.g. The Solar System Explorer"
                value={weeklyTitle} onChange={e => setWeeklyTitle(e.target.value)} />
            </div>

            <div className="mb-4">
              <label className="tp-label">What must students do to earn this card?</label>
              <textarea className="tp-input" style={{ minHeight: 90 }}
                placeholder="e.g. Create a poster showing the 8 planets in our solar system..."
                value={weeklyTask} onChange={e => setWeeklyTask(e.target.value)} />
              <p className="text-xs mt-1 italic" style={{ color: '#9a7040' }}>This text appears as the task on the student's page.</p>
            </div>

            <div className="mb-4">
              <label className="tp-label">
                Card Character Style <span className="text-xs" style={{ color: '#9a7040' }}>(optional)</span>
              </label>
              <input type="text" className="tp-input"
                placeholder="e.g. space explorer robot, planet dragon, cosmic owl…"
                value={weeklyCharHint} onChange={e => setWeeklyCharHint(e.target.value)} />
            </div>

            {/* End date */}
            <div className="mb-5">
              <label className="tp-label">
                Due Date <span className="text-xs" style={{ color: '#9a7040' }}>(optional — shown to students)</span>
              </label>
              <input type="date" className="tp-input"
                value={weeklyEndDate} onChange={e => setWeeklyEndDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
              {weeklyEndDate && (
                <button onClick={() => setWeeklyEndDate('')} className="text-xs mt-1" style={{ color: '#9a7040', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Clear date
                </button>
              )}
            </div>

            <button onClick={handleGenerate} disabled={weeklyGenerating} className="tp-btn-primary" style={{ width:'100%', marginBottom:10 }}>
              {weeklyGenerating ? 'Generating…' : '✦ Generate Card ✦'}
            </button>

            {weeklyCard && !weeklyGenerating && (
              <button onClick={handleSaveProject} className="w-full py-2 rounded-lg text-sm font-bold"
                style={{ background: 'rgba(80,200,120,0.12)', border: '1px solid rgba(80,200,120,0.4)', color: '#1a6a3a', cursor: 'pointer' }}>
                {hasProject ? '💾 Update Project' : '🚀 Publish Project'}
              </button>
            )}

            {weeklyStatus && <div className={`tp-status-${weeklyStatusType} mt-3`}>{weeklyStatus}</div>}
          </div>

          {/* Right: preview */}
          <div className="flex flex-col gap-4">
            {weeklyCard ? (
              <>
                <div className="flex justify-center">
                  <PokeCard card={weeklyCard as Card} showShimmerBtn />
                </div>
                <div className="p-5 rounded-xs" style={{ background:'rgba(255,255,255,0.72)', border:'1.5px solid rgba(255,255,255,0.9)', borderRadius:20 }}>
                  <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#c8a000', fontFamily: "'Cinzel',serif" }}>📋 Student View Preview</div>
                  <h3 className="font-display font-black text-base mb-2" style={{ color: '#3d2b1f' }}>{weeklyTitle || 'Project Title'}</h3>
                  {weeklyEndDate && <p className="text-xs font-bold mb-2" style={{ color: '#c07800' }}>📅 Due: {new Date(weeklyEndDate).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
                  <p className="text-sm" style={{ color: '#5a3a20', lineHeight: 1.7 }}>{weeklyTask || 'Task description will appear here.'}</p>
                  {hasProject && <div className="mt-3 text-xs" style={{ color: '#4a8a4a', fontWeight: 700 }}>✓ Published · Students can see this</div>}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xs" style={{ minHeight: 380, border: '2px dashed rgba(200,160,0,0.2)', background: 'rgba(255,248,222,0.3)' }}>
                <span className="text-5xl mb-3" style={{ opacity: 0.2 }}>📋</span>
                <span className="text-sm italic" style={{ color: '#9a7040' }}>Fill in the task and click Generate</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Bulk Award Modal ═══════════════════════════════════════════ */}
      {awardModal && (
        <div className="tp-modal-bg" onClick={() => { if (!awarding) setAwardModal(false); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fffbf0', border: '2px solid rgba(90,50,10,0.25)', borderRadius: 20, padding: '2rem', width: '95%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <button onClick={() => setAwardModal(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#8a5520' }}>✕</button>
            <h3 className="font-display font-black text-xl mb-1" style={{ color: '#3d2b1f' }}>🏅 Award "{weeklyTitle}"</h3>
            <p className="text-xs mb-5 italic" style={{ color: '#9a7040' }}>Tick each student in the column matching their achievement level. Each student can only receive one rarity.</p>
            {awardError && <div className="tp-err mb-4 text-sm">{awardError}</div>}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {([
                { key: 'common', label: 'Common', icon: '⭐', desc: 'Completed the task', color: '#8b6a00', bg: 'rgba(200,160,0,0.07)', border: 'rgba(200,160,0,0.3)' },
                { key: 'silver', label: 'Silver', icon: '✦', desc: 'Good effort & quality', color: '#5a7a90', bg: 'rgba(120,160,190,0.07)', border: 'rgba(120,160,190,0.35)' },
                { key: 'gold-rare', label: 'Gold', icon: '★', desc: 'Outstanding work', color: '#c07800', bg: 'rgba(212,160,23,0.07)', border: 'rgba(212,160,23,0.35)' },
              ] as const).map(col => (
                <div key={col.key} style={{ border: `1px solid ${col.border}`, borderRadius: 14, padding: '1rem', background: col.bg }}>
                  <div className="text-center mb-3">
                    <div className="text-2xl mb-1">{col.icon}</div>
                    <div className="font-display font-black text-sm" style={{ color: col.color }}>{col.label}</div>
                    <div className="text-xs italic" style={{ color: '#9a7040' }}>{col.desc}</div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {students.length === 0 && <span className="text-xs italic" style={{ color: '#9a7040' }}>No students</span>}
                    {students.map((s: any) => {
                      const selected = awardSelections[s.id] === col.key;
                      const selectedOther = awardSelections[s.id] && awardSelections[s.id] !== col.key;
                      return (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: selected ? col.bg : 'transparent', border: selected ? `1.5px solid ${col.border}` : '1.5px solid transparent', opacity: selectedOther ? 0.4 : 1, transition: 'all 0.15s' }}>
                          <input type="checkbox" checked={selected} onChange={() => handleToggleStudent(s.id, col.key)} style={{ accentColor: col.color, width: 16, height: 16, flexShrink: 0 }} />
                          <span className="text-sm font-semibold" style={{ color: '#3d2b1f' }}>{s.name}</span>
                          {selected && <span className="text-xs ml-auto" style={{ color: col.color }}>✓</span>}
                          {selectedOther && <span className="text-xs ml-auto italic" style={{ color: '#9a7040' }}>→ {awardSelections[s.id]}</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(90,50,10,0.12)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm" style={{ color: '#5a3a20' }}>
                  {awardCount > 0
                    ? <>Awarding to <strong>{awardCount}</strong> student{awardCount !== 1 ? 's' : ''}: {Object.entries(awardSelections).map(([sid, rar]: any) => `${students.find((s: any) => s.id === sid)?.name || sid} (${rar})`).join(', ')}</>
                    : <span className="italic" style={{ color: '#9a7040' }}>No students selected yet</span>}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setAwardModal(false)} className="tp-btn-outline" style={{ borderColor: 'rgba(90,40,10,0.3)', color: '#7a5a40' }}>Cancel</button>
                  <button onClick={handleAward} disabled={awarding || awardCount === 0} className="tp-btn-gold" style={{ opacity: awardCount === 0 ? 0.4 : 1, fontFamily: "'Cinzel',serif" }}>
                    {awarding ? 'Awarding…' : `🏅 Award ${awardCount > 0 ? awardCount + ' Student' + (awardCount !== 1 ? 's' : '') : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>{/* tp-page */}
    </div>{/* outer */}
  );
}

function getCurrentWeekLabel(): string {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  return `Week of ${fmt(start)} – ${fmt(end)}`;
}


export default TeacherPage;

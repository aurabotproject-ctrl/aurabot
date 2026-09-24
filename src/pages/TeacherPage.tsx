import React, { useState, useEffect, useCallback } from 'react';
import './TeacherPage.css';
import PokeCard from '../components/PokeCard';
import { TeacherBotThumbnail } from '../components/BotAvatar';
import { Auth } from '../lib/auth';
import { fileToWebP } from '../lib/imageUtils';
import { uploadImageToR2 } from '../lib/r2Upload';
import { Dashboard } from '../lib/dashboard';
import Aura3dQuestionBanks from '../components/Aura3dQuestionBanks';
import { sb } from '../lib/supabase';
import type { Session } from '../lib/auth';
import type { Student, Card } from '../lib/supabase';
import {
  resetStudentAura3dBuild,
  loadAura3dTeacherSettings,
  saveAura3dTeacherSettings,
  AURA3D_SETTINGS_DEFAULTS,
} from '../lib/supabase';
import type { Aura3dTeacherSettings } from '../lib/supabase';

type TabKey = 'generate' | 'weekly' | 'cards' | 'students' | 'stars' | 'homecomms' | 'settings';

// ── Navigation ─────────────────────────────────────────────────────────────
// Grouped the way a teacher actually thinks about the week: things you MAKE,
// the CLASS you look after, and the settings you rarely touch. Order here is
// also the 1–7 keyboard-shortcut order.
type NavItem = { key: TabKey; label: string; icon: IconName; group: string; eyebrow: string; title: React.ReactNode; lead: string };
const NAV: NavItem[] = [
  { key: 'generate',  group: 'Create', icon: 'spark',    label: 'Card Creation',
    eyebrow: '01 — Create', title: <>Card <em>Creation</em></>,
    lead: 'Design a new card for the pack pool. Its stats stay sealed until a student opens it in a pack.' },
  { key: 'cards',     group: 'Create', icon: 'layers',   label: 'Card Database',
    eyebrow: '02 — Create', title: <>Card <em>Database</em></>,
    lead: 'Every card your class can collect. Edit it, retire it, or make it a rare exclusive.' },
  { key: 'weekly',    group: 'Create', icon: 'flag',     label: 'Weekly Project',
    eyebrow: '03 — Create', title: <>Weekly <em>Project</em></>,
    lead: 'Set the task, choose the card it earns, then review what comes back and award it.' },
  { key: 'students',  group: 'Class',  icon: 'users',    label: 'Students',
    eyebrow: '04 — Class', title: <>Your <em>Students</em></>,
    lead: 'Logins, collections and resets for everyone in your class.' },
  { key: 'stars',     group: 'Class',  icon: 'star',     label: 'Stars',
    eyebrow: '05 — Class', title: <>Star <em>Points</em></>,
    lead: 'Reward effort as it happens. Students spend stars on card packs in the shop.' },
  { key: 'homecomms', group: 'Class',  icon: 'megaphone', label: 'Home Communication',
    eyebrow: '06 — Class', title: <>Home <em>Board</em></>,
    lead: 'What families see: a pinned message and photo at the top, dated events underneath.' },
  { key: 'settings',  group: 'System', icon: 'cog',      label: 'Settings',
    eyebrow: '07 — System', title: <>Studio <em>Settings</em></>,
    lead: 'Pack settings, the 3D Aura world, and the questions students answer at the kiosk.' },
];

// ── Icons ─────────────────────────────────────────────────────────────────
// One consistent line set instead of emoji, which render differently on
// every device and read as placeholder. 24px grid, 1.8 stroke.
type IconName = 'spark' | 'layers' | 'flag' | 'users' | 'star' | 'megaphone' | 'cog' | 'orbit' | 'sun' | 'moon'
  | 'logout' | 'menu' | 'close' | 'search' | 'download' | 'pencil' | 'key' | 'rotate' | 'trash' | 'plus' | 'list';
const ICON_PATHS: Record<IconName, React.ReactNode> = {
  spark:     <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></>,
  layers:    <><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.5l9 5 9-5"/></>,
  flag:      <><path d="M5 21V4"/><path d="M5 4h11l-1.5 4L16 12H5"/></>,
  users:     <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8"/><path d="M18.5 14.8c1.6.8 2.7 2.5 3 5.2"/></>,
  star:      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>,
  megaphone: <><path d="M3 10v4a1 1 0 001 1h2l5 4V5L6 9H4a1 1 0 00-1 1z"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.5 5.5a9 9 0 010 13"/></>,
  cog:       <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></>,
  orbit:     <><circle cx="12" cy="12" r="3.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-25 12 12)"/><circle cx="20.2" cy="8.3" r="1.1" fill="currentColor" stroke="none"/></>,
  sun:       <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon:      <path d="M20.5 14.5A8.5 8.5 0 019.5 3.5a8.5 8.5 0 1011 11z"/>,
  logout:    <><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/></>,
  menu:      <path d="M4 7h16M4 12h16M4 17h10"/>,
  close:     <path d="M6 6l12 12M18 6L6 18"/>,
  search:    <><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></>,
  download:  <><path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 20h14"/></>,
  pencil:    <><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z"/><path d="M14.5 6.5l3 3"/></>,
  key:       <><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3"/><path d="M16.5 6.5L19 9"/><path d="M14 9l2 2"/></>,
  rotate:    <><path d="M4 12a8 8 0 0113.7-5.6L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 01-13.7 5.6L4 15.5"/><path d="M4 20v-4.5h4.5"/></>,
  trash:     <><path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/></>,
  plus:      <path d="M12 5v14M5 12h14"/>,
  list:      <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/></>,
};
function Ico({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON_PATHS[name]}</svg>
  );
}

// An optional illustration. Renders nothing until the file actually loads,
// so the page looks finished with or without the artwork in /public/teacher.
function Art({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [missing, setMissing] = React.useState(false);
  if (missing) return null;
  return <img className={'tp-art ' + (className || '')} src={src} alt={alt} onError={() => setMissing(true)} />;
}

// Stable, distinct avatar colours for the roster.
const AVATAR_TONES = ['#cc3355', '#3b5bab', '#2f8f6b', '#b7791f', '#7a4fb3', '#1f7a8c', '#c2410c', '#4d5a8a', '#a23b72', '#3d7a3a', '#8a5a2b', '#5b4fc9'];
const initialsOf = (name: string) =>
  (name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';

function TeacherPage({ session, onSignOut }: { session: NonNullable<Session>; onSignOut: () => void }) {
  const spaceCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDark, setIsDark] = React.useState<boolean>(() => {
    try { return localStorage.getItem('tp_theme') !== 'light'; } catch { return true; }
  });
  const toggleTheme = () => setIsDark((d: boolean) => {
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
      const bg = ctx.createRadialGradient(W*.5,H*.35,0,W*.5,H*.5,Math.max(W,H)*.9);
      bg.addColorStop(0,'#0d1b3e'); bg.addColorStop(0.4,'#08112a');
      bg.addColorStop(0.8,'#050c1a'); bg.addColorStop(1,'#020608');
      ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
      const n1 = ctx.createRadialGradient(W*.8,H*.2,0,W*.8,H*.2,W*.35);
      n1.addColorStop(0,'rgba(80,40,140,0.16)'); n1.addColorStop(1,'rgba(80,40,140,0)');
      ctx.fillStyle = n1; ctx.fillRect(0,0,W,H);
      for (const s of stars) {
        const t = s.brightness*(0.5+0.5*Math.sin(ts*s.speed+s.offset));
        if (s.r>1.2&&t>0.82) {
          ctx.strokeStyle=`rgba(180,220,255,${t*.45})`; ctx.lineWidth=0.5;
          ctx.beginPath(); ctx.moveTo(s.x-s.r*3,s.y); ctx.lineTo(s.x+s.r*3,s.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(s.x,s.y-s.r*3); ctx.lineTo(s.x,s.y+s.r*3); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(200,225,255,${t})`; ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', init); };
  }, []);

  const [tab, setTab] = useState<TabKey>('generate');
  const [navOpen, setNavOpen] = useState(false);
  const [rosterQuery, setRosterQuery] = useState('');
  const goTab = (k: TabKey) => { setTab(k); setNavOpen(false); window.scrollTo({ top: 0 }); };

  // 1–7 jump between sections — but never while typing, or a teacher
  // entering "3" in a form would be thrown onto another page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (document.querySelector('.tp-modal-bg')) return;
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < NAV.length) { setTab(NAV[i].key); window.scrollTo({ top: 0 }); }
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [students, setStudents] = useState<Student[]>([]);
  const [cardCounts, setCardCounts] = useState<Record<string, number>>({});
  const [downloadLoading, setDownloadLoading] = useState<string | null>(null);
  const [modal, setModal] = useState<{ type: string; data?: any } | null>(null);
  const [modalError, setModalError] = useState('');
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [specialPackLabel, setSpecialPackLabel] = useState<string | null>(null); // custom name for the "special" deck, if not in Lucky Dip mode
  const [aura3dSettings, setAura3dSettings] = useState<Aura3dTeacherSettings>(AURA3D_SETTINGS_DEFAULTS);
  const [aura3dLoaded, setAura3dLoaded] = useState(false);
  const [aura3dSaving, setAura3dSaving] = useState(false);
  const [aura3dSavedMsg, setAura3dSavedMsg] = useState(false);

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
  const [weeklyProject, setWeeklyProject] = useState<any>(null); // the draft currently loaded in the editor (null = new/unsaved)
  const [activeChallenge, setActiveChallenge] = useState<any>(null); // the live/published challenge students currently see
  const [weeklyTask, setWeeklyTask] = useState('');
  const [weeklyTitle, setWeeklyTitle] = useState('');
  const [weeklyGenerating, setWeeklyGenerating] = useState(false);
  const [weeklyCard, setWeeklyCard] = useState<Partial<Card> & { image_url: string } | null>(null);
  const [weeklyStatus, setWeeklyStatus] = useState('');
  const [weeklyStatusType, setWeeklyStatusType] = useState<'default'|'working'|'error'|'done'>('default');
  const [awardModal, setAwardModal] = useState(false);
  const [awardSelections, setAwardSelections] = useState<Record<string, 'common'|'silver'|'gold-rare'>>({});
  const [awardError, setAwardError] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [weeklyEndDate, setWeeklyEndDate] = useState('');
  const [weeklyView, setWeeklyView] = useState<'project'|'submissions'|'bank'>('project');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // Build a Card state
  // Mass account creation state

  const loadData = useCallback(async () => {
    try {
      const [sList, countsMap] = await Promise.all([
        Dashboard.getMyStudents(session.user.id),
        Dashboard.getCardCountsByStudent(session.user.id),
      ]);

      // Load the Special pack's Lucky Dip / named-set setting (drives the deck label in Card Creation)
      try {
        const { data: ps } = await sb.from('pack_settings').select('is_lucky_dip, set_name').eq('pack_id', 'special').maybeSingle();
        setSpecialPackLabel(ps && !ps.is_lucky_dip && ps.set_name?.trim() ? ps.set_name.trim() : null);
      } catch { /* table may not exist yet */ }

      // Load the currently active/published challenge (for display only — does not touch the editor draft)
      try {
        const { data: wp } = await sb.from('weekly_projects')
          .select('*')
          .eq('teacher_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setActiveChallenge(wp || null);
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
      setCardCounts(countsMap);
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
    setPbUploading(true); setPbStatus('Converting photo…');
    try {
      // Convert to WebP before storing — significantly smaller than PNG/JPEG
      const webpUrl = await fileToWebP(file, 1200, 1200, 0.88);
      setPbPhotoUrl(webpUrl);
      setPbUploading(false); setPbStatus('');
    } catch (err: any) { setPbUploading(false); setPbStatus('Upload error: ' + err.message); }
  };

  const handleSavePinboard = async () => {
    if (!pbMessage.trim()) { setPbStatus('Please enter a message.'); return; }
    setPbSaving(true); setPbStatus('Saving…');
    try {
      const photoUrl = await uploadImageToR2(pbPhotoUrl || '', 'pinboard');
      const payload = {
        teacher_id: session.user.id,
        message: pbMessage.trim(),
        photo_url: photoUrl || null,
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

  // ── 3D Aura universal settings (loaded lazily the first time the Settings
  // tab is opened, since they're not needed anywhere else on this page) ──
  useEffect(() => {
    if (tab !== 'settings' || aura3dLoaded) return;
    (async () => {
      try {
        const loaded = await loadAura3dTeacherSettings(session.user.id);
        setAura3dSettings(loaded);
      } catch (err) {
        console.error('Failed to load 3D Aura settings:', err);
      } finally {
        setAura3dLoaded(true);
      }
    })();
  }, [tab, aura3dLoaded, session.user.id]);

  const handleSaveAura3dSettings = async () => {
    setAura3dSaving(true);
    setAura3dSavedMsg(false);
    try {
      await saveAura3dTeacherSettings(session.user.id, aura3dSettings);
      setAura3dSavedMsg(true);
      setTimeout(() => setAura3dSavedMsg(false), 2500);
    } catch (err: any) {
      alert('Could not save 3D Aura settings: ' + (err?.message || err) + '\n\nHas the 3D Aura database migration been run yet?');
    } finally {
      setAura3dSaving(false);
    }
  };

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
                { label: 'Temporary 8-Digit PIN (they must set their own on first login)', name: 'password', type: 'password', placeholder: 'e.g. 12345678' },
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
      case 'bulkAddStudents':
        return (
          <ModalWrapper title="📋 Bulk Add Students" onClose={() => setModal(null)}>
            <BulkAddStudentsModal
              teacherId={session.user.id}
              onDone={() => { loadData(); setModal(null); }}
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
            <p className="text-sm mb-2" style={{ color: 'var(--tp-text)' }}>Delete <strong>{modal.data.name}</strong>?</p>
            <p className="text-sm mb-4" style={{ color: 'var(--tp-danger-text)' }}>This will also delete all their cards and their login, and cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  try {
                    await Dashboard.deleteStudent(modal.data.id);
                    loadData();
                    setModal(null);
                    setModalError('');
                  } catch (err: any) {
                    setModalError(err?.message || 'Delete failed');
                  }
                }}
                className="tp-btn-danger"
              >Yes, Delete Everything</button>
              <button onClick={() => setModal(null)} className="tp-btn-outline">Cancel</button>
            </div>
            {modalError && <p className="text-sm mt-3" style={{ color: 'var(--tp-danger-text)' }}>{modalError}</p>}
          </ModalWrapper>
        );
      case 'resetAura3d':
        return (
          <ModalWrapper title="🤖 Reset Build" onClose={() => setModal(null)}>
            <p className="text-sm mb-2" style={{ color: 'var(--tp-text)' }}>
              Clear everything <strong>{modal.data.name}</strong> has built in 3D Aura?
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--tp-muted)' }}>
              Their money, inventory, and pets are kept — only the world (trees, flowers, water, and any stacked blocks) is cleared. This takes effect next time they open 3D Aura.
            </p>
            <p className="text-sm mb-4" style={{ color: '#d97706' }}>
              ⚠️ If this student is in a <strong>team world</strong>, this clears what the whole team built — everyone in that world is affected, not just this student.
            </p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  try {
                    await resetStudentAura3dBuild(modal.data.id);
                    setModal(null);
                  } catch (err: any) {
                    setModalError(err?.message || 'Reset failed');
                  }
                }}
                className="tp-btn-primary"
              >Yes, Reset Their Build</button>
              <button onClick={() => setModal(null)} className="tp-btn-outline">Cancel</button>
            </div>
            {modalError && <p className="text-sm mt-3" style={{ color: 'var(--tp-danger-text)' }}>{modalError}</p>}
          </ModalWrapper>
        );
      case 'downloadCards': {
        const studentCards = modal.data.cards as Card[];
        const handleDownload = () => {
          // ── helpers ──────────────────────────────────────────────────────
          const RARITY_BG: Record<string, string> = {
            common:     'linear-gradient(160deg,#d2a679 0%,#a9744a 40%,#c9986a 70%,#8b5a2b 100%)',
            silver:     'linear-gradient(160deg,#d8e4ee 0%,#a8bfcf 40%,#e0eaf2 70%,#c0d4e4 100%)',
            'gold-rare':'linear-gradient(160deg,#ffe090 0%,#f0b020 30%,#ffd060 60%,#e89010 80%,#ffdc80 100%)',
            prismatic:  'linear-gradient(135deg,#ffb3b3 0%,#ffd9a0 14%,#ffffa0 28%,#b3ffb3 42%,#a0e8ff 57%,#b3b3ff 71%,#e8b3ff 85%,#ffb3e8 100%)',
          };
          const RARITY_BORDER: Record<string, string> = {
            common: '#8b5a2b', silver: '#7a9ab0', 'gold-rare': '#c07800', prismatic: '#c080ff',
          };
          const RARITY_LABELS: Record<string, string> = {
            common: 'COMMON', silver: 'SILVER', 'gold-rare': 'GOLD', prismatic: 'PRISMATIC',
          };

          const renderPokeCard = (card: any) => {
            const bg = RARITY_BG[card.rarity] || RARITY_BG.common;
            const border = RARITY_BORDER[card.rarity] || '#8b5a2b';
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
  ${"<"}style>
    body { margin: 0; padding: 32px; background: linear-gradient(135deg,#fce4ec,#f3e5f5,#e8eaf6,#e1f5fe); font-family: 'Nunito','Segoe UI',sans-serif; min-height: 100vh; }
    h1 { text-align: center; color: #5060a0; font-size: 1.6rem; margin-bottom: 8px; }
    p.subtitle { text-align: center; color: #8090b0; font-size: 0.85rem; margin-bottom: 32px; }
    .cards-grid { display: flex; flex-wrap: wrap; gap: 32px; justify-content: center; align-items: flex-start; }

    /* ── PokeCard (Generate Card) styles ── */
    .poke-card {
      width: 260px; height: 375px; border-radius: 18px; position: relative;
      overflow: hidden; border: 3px solid #8b5a2b; user-select: none; flex-shrink: 0;
      box-shadow: 0 0 0 2px #8b5a2b, 0 8px 25px rgba(139,90,43,0.3);
    }
    .poke-card[data-rarity="silver"] { box-shadow: 0 0 0 2px #7a9ab0, 0 8px 30px rgba(120,160,200,0.2); }
    .poke-card[data-rarity="gold-rare"] { box-shadow: 0 0 0 3px #d4a017, 0 8px 40px rgba(212,160,23,0.35); }
    .poke-card[data-rarity="prismatic"] { box-shadow: 0 0 0 3px #c080ff, 0 8px 50px rgba(180,100,255,0.5); animation: prismShift 4s ease-in-out infinite; }
    @keyframes prismShift { 0%,100% { filter: hue-rotate(0deg) brightness(1.05); } 50% { filter: hue-rotate(30deg) brightness(1.12); } }
    .card-content { position: relative; z-index: 10; height: 100%; display: flex; flex-direction: column; padding: 10px 12px 7px; box-sizing: border-box; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .card-name { font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700; color: #1a1000; text-shadow: 0 1px 0 rgba(255,255,255,0.07); max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-hp { font-size: 10px; font-weight: 800; color: #8b0000; background: rgba(255,255,255,0.07); padding: 2px 7px; border-radius: 10px; white-space: nowrap; }
    .card-img-box { margin: 0 4px; height: 120px; background: rgba(255,255,255,0.35); border-radius: 10px; border: 2px solid rgba(255,255,255,0.65); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; flex-shrink: 0; }
    .card-img-box img { width: 100%; height: 100%; object-fit: contain; }
    .card-type-badge { position: absolute; bottom: 5px; right: 7px; font-size: 7px; font-weight: 800; background: rgba(0,0,0,0.35); color: white; padding: 2px 5px; border-radius: 6px; letter-spacing: 0.08em; }
    .card-desc { margin: 5px 4px 3px; font-size: 8px; color: #2a1800; background: rgba(255,255,255,0.42); padding: 4px 7px; border-radius: 6px; font-style: italic; line-height: 1.4; border: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
    .card-stats { margin: 3px 4px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3px; flex-shrink: 0; }
    .stat-box { background: rgba(255,255,255,0.45); border-radius: 5px; padding: 3px 2px; text-align: center; border: 1px solid rgba(255,255,255,0.07); }
    .stat-label { font-size: 6.5px; font-weight: 800; color: #5a3a00; display: block; }
    .stat-val { font-size: 13px; font-weight: 900; color: #1a0800; display: block; font-family: 'Cinzel', serif; }
    .card-move { margin: 2px 4px; background: rgba(255,255,255,0.42); border-radius: 7px; padding: 3px 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
    .move-name { font-size: 8.5px; font-weight: 700; color: #1a0800; }
    .move-dmg { font-size: 13px; font-weight: 900; color: #8b0000; font-family: 'Cinzel', serif; }
    .card-footer { margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: 3px; flex-shrink: 0; }
    .card-rarity-tag { font-size: 7px; font-weight: 700; color: #3a2200; }
    .card-student-name { font-size: 7px; color: #5a3a00; font-style: italic; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  ${"</"}style>
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
              <p style={{ color: 'var(--tp-text2)', fontSize: '0.9rem', marginBottom: 16 }}>
                Download <strong>{modal.data.name}</strong>'s cards as an HTML file.
              </p>
              <p style={{ color: 'var(--tp-muted)', fontSize: '0.8rem', marginBottom: 24 }}>
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
            <p className="text-sm mb-2" style={{ color: 'var(--tp-text)' }}>Delete <strong>{modal.data.card_name}</strong>?</p>
            <p className="text-sm mb-4" style={{ color: 'var(--tp-danger-text)' }}>This cannot be undone.</p>
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
            <p className="text-sm mb-1" style={{ color: 'var(--tp-text2)' }}>
              Setting new keypad PIN for <strong>{modal.data.name}</strong>
            </p>
            <p className="text-xs mb-4" style={{ color: '#9a7a60' }}>
              Must be exactly 8 digits. Cannot be 8 of the same number (e.g. 11111111).
            </p>
            <div className="mb-3">
              <label className="tp-label">New 8-Digit PIN</label>
              <input type="password" inputMode="numeric" maxLength={8} className="tp-input" placeholder="e.g. 48295123" value={pw} onChange={e => setPw(e.target.value.replace(/\D/g, '').slice(0, 8))} />
            </div>
            <div className="mb-3">
              <label className="tp-label">Confirm PIN</label>
              <input type="password" inputMode="numeric" maxLength={8} className="tp-input" placeholder="Repeat PIN" value={pw2} onChange={e => setPw2(e.target.value.replace(/\D/g, '').slice(0, 8))} />
            </div>
            {modalError && <p className="text-sm mt-2" style={{ color: 'var(--tp-danger-text)' }}>{modalError}</p>}
            <div className="flex gap-3 mt-4">
              <button className="tp-btn-gold" onClick={async () => {
                if (!/^\d{8}$/.test(pw)) { setModalError('PIN must be exactly 8 digits.'); return; }
                if (/^(\d)\1{7}$/.test(pw)) { setModalError('PIN cannot be 8 of the same digit (e.g. 11111111).'); return; }
                if (pw !== pw2) { setModalError('PINs do not match.'); return; }
                if (!modal.data.auth_user_id) { setModalError('Student has no linked account.'); return; }
                try {
                  const { data: { session: s } } = await sb.auth.getSession();
                  const res = await fetch('/.netlify/functions/reset-pin', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${s?.access_token}`,
                    },
                    body: JSON.stringify({ auth_user_id: modal.data.auth_user_id, new_password: pw }),
                  });
                  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
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


  const current = NAV.find(n => n.key === tab) || NAV[0];
  const teacherName = session.profile?.name || session.user.email.split('@')[0];

  const sidebar = (
    <aside className={'tp-side' + (navOpen ? ' is-open' : '')} aria-label="Teacher navigation">
      <div className="tp-brand">
        <i />
        <div>ClassCard<small>Teacher studio</small></div>
      </div>

      <nav className="tp-nav">
        {NAV.map((n, i) => (
          <React.Fragment key={n.key}>
            {(i === 0 || NAV[i - 1].group !== n.group) && <div className="tp-nav-group">{n.group}</div>}
            <button
              type="button"
              className={'tp-navitem' + (tab === n.key ? ' is-active' : '')}
              aria-current={tab === n.key ? 'page' : undefined}
              onClick={() => goTab(n.key)}
            >
              <Ico name={n.icon} />
              {n.label}
              <kbd>{i + 1}</kbd>
            </button>
          </React.Fragment>
        ))}
      </nav>

      <div className="tp-side-foot">
        {/* Optional mascot art — appears once /public/teacher/sidebar-bot.png exists */}
        <Art src="/teacher/sidebar-bot.png" alt="" className="tp-side-art" />
        {/* Read-only tour of the worlds this class has built. The 3D app
            gives a teacher no way to build, buy or save anything. */}
        <button type="button" className="tp-worlds-btn" onClick={() => { window.location.hash = '/3daura'; }}
          title="Look inside the 3D worlds your class has built">
          <span className="ic"><Ico name="orbit" /></span>
          <span><b>Visit 3D Worlds</b><span>Look around, read-only</span></span>
        </button>

        <div className="tp-me">
          <div className="tp-me-avatar" aria-hidden="true">{initialsOf(teacherName)}</div>
          <div className="tp-me-text">
            <b>{teacherName}</b>
            <span title={session.user.email}>{session.user.email}</span>
          </div>
          <button type="button" className="tp-icon-btn" onClick={toggleTheme}
            title={isDark ? 'Switch to light' : 'Switch to dark'} aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
            <Ico name={isDark ? 'sun' : 'moon'} />
          </button>
          <button type="button" className="tp-icon-btn" onClick={onSignOut} title="Sign out" aria-label="Sign out">
            <Ico name="logout" />
          </button>
        </div>
      </div>
    </aside>
  );

  // Per-section header actions. Only Students has any today; the other
  // sections keep their controls inside their own panels.
  const headActions = tab === 'students' ? (
    <>
      <button onClick={() => setModal({ type: 'bulkAddStudents' })} className="tp-btn-outline"><Ico name="list" /> Bulk add</button>
      <button onClick={() => setModal({ type: 'addStudent' })} className="tp-btn-primary"><Ico name="plus" /> Add student</button>
    </>
  ) : null;

  return (
    <div className={'tp-page ' + (isDark ? 'tp-dark' : 'tp-light')}>
      <div className="tp-shell">

        {/* Mobile top bar */}
        <header className="tp-topbar">
          <div className="tp-brand"><i />ClassCard</div>
          <button type="button" className="tp-icon-btn" data-nav-toggle onClick={() => setNavOpen(o => !o)}
            aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen} style={{ color: 'var(--tp-cream)' }}>
            <Ico name={navOpen ? 'close' : 'menu'} />
          </button>
        </header>
        {navOpen && <div className="tp-scrim" onClick={() => setNavOpen(false)} />}

        {sidebar}

        <main className="tp-main">
          <div className="tp-main-inner">

            <header className="tp-pagehead" key={'head-' + tab}>
              <div>
                <p className="tp-eyebrow">{current.eyebrow}</p>
                <h1 className="tp-title">{current.title}</h1>
                <p className="tp-lead">{current.lead}</p>
              </div>
              {headActions && <div className="tp-pagehead-actions">{headActions}</div>}
            </header>

            <div className="tp-view" key={'view-' + tab}>

        {/* Generate Card Tab */}
        {tab === 'generate' && (
          <CardDatabaseTab session={session} specialPackLabel={specialPackLabel} />
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
            weeklyGenerating={weeklyGenerating}
            setWeeklyGenerating={setWeeklyGenerating}
            weeklyCard={weeklyCard}
            setWeeklyCard={setWeeklyCard}
            weeklyProject={weeklyProject}
            setWeeklyProject={setWeeklyProject}
            activeChallenge={activeChallenge}
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
        {tab === 'cards' && (
          <CharacterPoolTab session={session} specialPackLabel={specialPackLabel} />
        )}

        {/* Students Tab */}
        {tab === 'students' && (() => {
          const total = students.reduce((n, st) => n + (cardCounts[st.id] || 0), 0);
          const max = Math.max(1, ...students.map(st => cardCounts[st.id] || 0));
          const top = students.reduce<Student | null>((best, st) =>
            !best || (cardCounts[st.id] || 0) > (cardCounts[best.id] || 0) ? st : best, null);
          const q = rosterQuery.trim().toLowerCase();
          const shown = q
            ? students.filter(st => st.name.toLowerCase().includes(q) || (st.login_email || '').toLowerCase().includes(q))
            : students;

          const openCards = async (st: Student) => {
            setDownloadLoading(st.id);
            try {
              const studentCards = await Dashboard.getStudentCards(st.id);
              const filtered = studentCards.filter(c => c.card_name !== Dashboard.WELCOME_CARD_NAME);
              setModal({ type: 'downloadCards', data: { ...st, cards: filtered } });
            } catch (err: any) {
              alert('Could not load this student\'s cards: ' + (err.message || 'unknown error'));
            }
            setDownloadLoading(null);
          };

          if (students.length === 0) {
            return (
              <div className="tp-panel tp-empty">
                <Art src="/teacher/empty-students.png" alt="" />
                <div className="glyph"><Ico name="users" /></div>
                <h3>No students yet</h3>
                <p>Add your class one at a time, or paste a whole list with Bulk add. Each student gets a PIN login and a welcome card.</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button onClick={() => setModal({ type: 'bulkAddStudents' })} className="tp-btn-outline"><Ico name="list" /> Bulk add</button>
                  <button onClick={() => setModal({ type: 'addStudent' })} className="tp-btn-primary"><Ico name="plus" /> Add student</button>
                </div>
              </div>
            );
          }

          return (
            <>
              <dl className="tp-stats">
                <div className="tp-stat"><dt>Students</dt><dd>{students.length}</dd></div>
                <div className="tp-stat is-accent"><dt>Cards collected</dt><dd>{total}</dd></div>
                <div className="tp-stat"><dt>Average each</dt><dd>{(total / students.length).toFixed(1)}</dd></div>
                <div className="tp-stat"><dt>Top collector</dt>
                  <dd style={{ fontSize: 24, paddingTop: 8 }}>{top ? top.name.split(' ')[0] : '—'}<small>{top ? cardCounts[top.id] || 0 : ''}</small></dd>
                </div>
              </dl>

              <div className="tp-panel tp-roster">
                <div className="tp-roster-tools">
                  <label className="tp-search">
                    <Ico name="search" />
                    <input value={rosterQuery} onChange={e => setRosterQuery(e.target.value)}
                      placeholder="Search by name or email" aria-label="Search students" />
                  </label>
                  <span className="tp-count">{shown.length} of {students.length}</span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="tp-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Collection</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((st, i) => {
                        const n = cardCounts[st.id] || 0;
                        const tone = AVATAR_TONES[(st.robot_color_index ?? i) % AVATAR_TONES.length];
                        return (
                          <tr key={st.id}>
                            <td>
                              <div className="tp-person">
                                <div className="tp-avatar" style={{ background: tone }} aria-hidden="true">{initialsOf(st.name)}</div>
                                <div style={{ minWidth: 0 }}>
                                  <b>{st.name}</b>
                                  <span>{st.login_email || 'No login email'}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="tp-meter" title={`${n} card${n === 1 ? '' : 's'}`}>
                                <b>{n}</b>
                                <i style={{ ['--pct' as any]: `${Math.round((n / max) * 100)}%` }} />
                              </div>
                            </td>
                            <td>
                              <div className="tp-actions">
                                <button className="tp-act" data-tip="Download cards" aria-label={`Download ${st.name}'s cards`}
                                  onClick={() => openCards(st)} disabled={downloadLoading === st.id}>
                                  <Ico name="download" />
                                </button>
                                <button className="tp-act" data-tip="Edit" aria-label={`Edit ${st.name}`}
                                  onClick={() => setModal({ type: 'editStudent', data: st })}>
                                  <Ico name="pencil" />
                                </button>
                                <button className="tp-act" data-tip="Reset PIN" aria-label={`Reset ${st.name}'s PIN`}
                                  onClick={() => { setModalError(''); setModal({ type: 'resetPassword', data: st }); }}>
                                  <Ico name="key" />
                                </button>
                                <button className="tp-act" data-tip="Reset 3D build" aria-label={`Reset ${st.name}'s 3D Aura build`}
                                  title="Clears everything this student has built in 3D Aura, but keeps their money, inventory and pets"
                                  onClick={() => { setModalError(''); setModal({ type: 'resetAura3d', data: st }); }}>
                                  <Ico name="rotate" />
                                </button>
                                <button className="tp-act is-danger" data-tip="Delete" aria-label={`Delete ${st.name}`}
                                  onClick={() => { setModalError(''); setModal({ type: 'deleteStudent', data: st }); }}>
                                  <Ico name="trash" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {shown.length === 0 && (
                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: '36px 18px', color: 'var(--tp-muted)' }}>
                          No students match “{rosterQuery}”.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          );
        })()}

        {/* Home Communication Tab */}
        {tab === 'stars' && (
          <StarsTab students={students} session={session} />
        )}

        {tab === 'homecomms' && (
          <div style={{ maxWidth: 880 }}>

            {/* ── PINBOARD SECTION ── */}
            <div className="tp-section">Pinned message &amp; photo</div>
            <div className="tp-panel" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

                {/* Message textarea */}
                <div style={{ flex: 1 }}>
                  <label className="tp-label">Message</label>
                  <textarea
                    className="tp-input"
                    placeholder={"e.g. Welcome to Term 2! It's going to be a great term full of exciting learning…"}
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
                        style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 12, border: '2px solid var(--tp-border-bright)', display: 'block' }}
                      />
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        <label style={{ flex: 1, padding: '5px 0', background: 'var(--tp-lift-2)', border: '1.5px solid var(--tp-border-bright)', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--tp-text2)' }}>
                          🔄 Change
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePbPhotoUpload} disabled={pbUploading} />
                        </label>
                        <button onClick={handleDeletePbPhoto} className="tp-btn-danger" style={{ flex: 1, fontSize: '0.65rem', padding: '5px 0' }}>🗑 Remove</button>
                      </div>
                    </div>
                  ) : (
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: 130, background: 'var(--tp-sunken)', border: '1.5px dashed var(--tp-border-bright)', borderRadius: 12, cursor: pbUploading ? 'wait' : 'pointer', gap: 6 }}>
                      <span style={{ fontSize: '1.6rem' }}>{pbUploading ? '⏳' : '📷'}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--tp-muted)' }}>{pbUploading ? 'Uploading…' : 'Click to add photo'}</span>
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
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: pbStatus.startsWith('Error') ? '#e05050' : pbStatus.startsWith('✓') ? '#22a060' : 'var(--tp-muted)' }}>
                    {pbStatus}
                  </span>
                )}
              </div>
            </div>

            {/* ── DATED EVENTS SECTION ── */}
            <div className="tp-section">Dates &amp; events</div>

            {/* Add new post */}
            <div className="tp-panel" style={{ marginBottom: 16 }}>
              <div className="tp-label" style={{ marginBottom: 10, fontSize: '0.72rem', color: 'var(--tp-text2)' }}>📝 New Event</div>
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
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: hcStatus.startsWith('Error') ? '#e05050' : hcStatus.startsWith('✓') ? '#22a060' : 'var(--tp-muted)' }}>
                    {hcStatus}
                  </span>
                )}
              </div>
            </div>

            {/* Events list */}
            {homeComms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--tp-muted)', fontSize: '0.85rem', background: 'rgba(240,236,255,0.3)', borderRadius: 16, border: '1.5px dashed var(--tp-border-bright)' }}>
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
                        <div className="tp-datetile" aria-label={new Date(hc.event_date + 'T12:00:00').toDateString()}>
                          <span className="m">{new Date(hc.event_date + 'T12:00:00').toLocaleDateString('en-NZ', { month: 'short' }).toUpperCase()}</span>
                          <span className="d">{new Date(hc.event_date + 'T12:00:00').getDate()}</span>
                          <span className="w">{new Date(hc.event_date + 'T12:00:00').toLocaleDateString('en-NZ', { weekday: 'short' }).toUpperCase()}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--tp-text)', lineHeight: 1.6, fontWeight: 600 }}>{hc.comment}</p>
                          <div style={{ fontSize: '0.72rem', color: 'var(--tp-muted)', marginTop: 6, fontFamily: 'var(--tp-mono)', letterSpacing: '.04em' }}>
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
          <div className="tp-settings">

            <section className="tp-setting">
              <div className="tp-setting-about">
                <h3>3D Aura world</h3>
                <p>Applies to every student's world. There's no per-student settings menu — this is the one place that controls it.</p>
              </div>
              <div className="tp-panel">
                <label className="tp-switch-row">
                  <span>
                    <b>Day / night cycle</b>
                    <span>The sky turns over as students play</span>
                  </span>
                  <input
                    type="checkbox"
                    className="tp-switch"
                    checked={aura3dSettings.dayNightEnabled ?? true}
                    onChange={e => setAura3dSettings(s => ({ ...s, dayNightEnabled: e.target.checked }))}
                  />
                </label>

                <div className="tp-slider-grid">
                  <Aura3dSliderRow
                    label="Day / night speed"
                    value={aura3dSettings.dayNightSpeed ?? AURA3D_SETTINGS_DEFAULTS.dayNightSpeed}
                    min={0.05} max={3} step={0.05}
                    onChange={v => setAura3dSettings(s => ({ ...s, dayNightSpeed: v }))}
                  />
                  <Aura3dSliderRow
                    label="Fog distance"
                    value={aura3dSettings.fogFar ?? AURA3D_SETTINGS_DEFAULTS.fogFar}
                    min={60} max={500} step={5}
                    onChange={v => setAura3dSettings(s => ({ ...s, fogFar: v }))}
                  />
                </div>

                <div className="tp-label" style={{ margin: '24px 0 14px' }}>Pet follow distance</div>
                <div className="tp-slider-grid">
                  {([
                    ['petGapDog', '🐶 Dog'], ['petGapCat', '🐱 Cat'], ['petGapBird', '🐦 Bird'],
                    ['petGapAlpaca', '🦙 Alpaca'], ['petGapBunny', '🐰 Bunny'], ['petGapFrog', '🐸 Frog'],
                    ['petGapMonkey', '🐵 Monkey'], ['petGapPanda', '🐼 Panda'], ['petGapOwl', '🦉 Owl'],
                    ['petGapDragon', '🐉 Dragon'], ['petGapLamb', '🐑 Lamb'],
                  ] as [Exclude<keyof Aura3dTeacherSettings, 'dayNightEnabled'>, string][]).map(([key, label]) => (
                    <Aura3dSliderRow
                      key={key}
                      label={label}
                      value={aura3dSettings[key] ?? AURA3D_SETTINGS_DEFAULTS[key]}
                      min={0.5} max={15} step={0.1}
                      onChange={v => setAura3dSettings(s => ({ ...s, [key]: v }))}
                    />
                  ))}
                </div>

                <div className="tp-savebar">
                  {aura3dSavedMsg && <span className="tp-saved">Saved</span>}
                  <button onClick={handleSaveAura3dSettings} className="tp-btn-primary" disabled={aura3dSaving}>
                    {aura3dSaving ? 'Saving…' : 'Save world settings'}
                  </button>
                </div>
              </div>
            </section>

            <section className="tp-setting">
              <div className="tp-setting-about">
                <h3>Kiosk quiz</h3>
                <p>Swap the four quiz topics at the 3D Aura kiosk for your own.</p>
              </div>
              <div className="tp-panel">
                <Aura3dQuestionBanks teacherId={session.user.id} />
              </div>
            </section>

          </div>
        )}
            </div>{/* tp-view */}
          </div>{/* tp-main-inner */}
        </main>
      </div>{/* tp-shell */}

      {/* Modals */}
      {renderModal()}

      {/* Card Detail Modal */}
      {detailCard && (
        <div className="tp-modal-bg" onClick={() => setDetailCard(null)}>
          <div className="tp-modal tp-modal-wide" onClick={e => e.stopPropagation()}>
            <button onClick={() => setDetailCard(null)} style={{ position:'absolute', top:16, right:16, width:32, height:32, borderRadius:'50%', background:'var(--tp-lift-2)', border:'none', fontSize:'1rem', cursor:'pointer', color:'var(--tp-muted)' }}>✕</button>
            <div style={{ display:'flex', gap:28, alignItems:'flex-start', flexWrap:'wrap' }}>
              <div style={{ flexShrink:0 }}>
                <PokeCard card={detailCard} />
              </div>
              <div style={{ flex:1, minWidth:200 }}>
                <h2 style={{ fontSize:'1.4rem', fontWeight:900, color:'var(--tp-text)', marginBottom:4 }}>{detailCard.card_name}</h2>
                <div style={{ display:'inline-block', padding:'3px 12px', borderRadius:20, background:'var(--tp-lift-2)', border:'1px solid var(--tp-border)', fontSize:'0.65rem', fontWeight:700, color:'var(--tp-muted)', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.1em' }}>{detailCard.rarity}</div>
                <p style={{ fontSize:'0.88rem', color:'var(--tp-muted)', fontStyle:'italic', marginBottom:20, lineHeight:1.5 }}>"{detailCard.description}"</p>

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
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--tp-border)' }}>
                      <span style={{ fontSize:'0.72rem', color:'var(--tp-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{row.label}</span>
                      <span style={{ fontSize:'0.82rem', fontWeight:700, color:'var(--tp-text)' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize:'0.8rem', marginTop:14, color:'var(--tp-muted)', fontStyle:'italic' }}>Awarded to: {detailCard.students?.name || 'Unknown'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal Components ──

// Small labelled range slider used throughout the 3D Aura settings panel.
function Aura3dSliderRow({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="tp-slider">
      <span className="tp-slider-head">
        <span>{label}</span>
        <output>{value.toFixed(2).replace(/\.?0+$/, '') || '0'}</output>
      </span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ ['--fill' as any]: `${pct}%` }}
      />
    </label>
  );
}

function ModalWrapper({ title, children, onClose, danger }: { title: string; children: React.ReactNode; onClose: () => void; danger?: boolean }) {
  return (
    <div className="tp-modal-bg" onClick={onClose}>
      <div className={'tp-modal' + (danger ? ' is-danger' : '')} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <button type="button" className="tp-modal-x" onClick={onClose} aria-label="Close"><Ico name="close" /></button>
        {/* Titles arrive with a leading emoji ("🗑 Delete Student"); the
            headline type does the work now, so drop it for display. */}
        <h3>{title.replace(/^[^\p{L}\p{N}]+/u, '')}</h3>
        {children}
      </div>
    </div>
  );
}

const BULK_DEFAULT_PIN = '87654321';

function BulkAddStudentsModal({ teacherId, onDone, onCancel }: {
  teacherId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [results, setResults] = React.useState<{ line: string; ok: boolean; message: string }[] | null>(null);

  const parseLines = () => {
    return text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(line => {
        const idx = line.indexOf(',');
        if (idx === -1) return { name: '', email: '', raw: line };
        return { name: line.slice(0, idx).trim(), email: line.slice(idx + 1).trim(), raw: line };
      });
  };

  const preview = parseLines();
  const validCount = preview.filter(p => p.name && p.email).length;

  const handleCreate = async () => {
    const rows = parseLines();
    if (rows.length === 0) return;
    setRunning(true);
    const out: { line: string; ok: boolean; message: string }[] = [];

    for (const row of rows) {
      if (!row.name || !row.email) {
        out.push({ line: row.raw, ok: false, message: 'Could not read "Name, email" from this line.' });
        continue;
      }
      try {
        const newUser = await Auth.signUp(row.email, BULK_DEFAULT_PIN, 'student', row.name);
        const newStudent = await Dashboard.createStudent(row.name, teacherId, newUser.id, row.email);
        try { await Dashboard.giveWelcomeCard(newStudent.id, teacherId); }
        catch (e: any) { console.warn('Welcome card failed (non-fatal):', e.message); }
        out.push({ line: row.raw, ok: true, message: 'Created' });
      } catch (err: any) {
        out.push({ line: row.raw, ok: false, message: err.message || 'Failed to create' });
      }
      setResults([...out]); // live progress as each row completes
    }

    setRunning(false);
  };

  const successCount = results?.filter(r => r.ok).length ?? 0;
  const failCount = results?.filter(r => !r.ok).length ?? 0;

  return (
    <div>
      {!results && (
        <>
          <p style={{ fontSize: '0.82rem', color: 'var(--tp-text2)', marginBottom: 10, lineHeight: 1.5 }}>
            Paste one student per line, in the format <strong>Name, email</strong>. Every student will be given the
            same temporary PIN (<strong>{BULK_DEFAULT_PIN}</strong>) and will be required to set their own PIN the first time they log in.
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={'Jamie Chen, jamie@school.edu\nAlex Smith, alex@school.edu\nPriya Patel, priya@school.edu'}
            className="tp-input"
            style={{ minHeight: 180, fontFamily: 'monospace', fontSize: '0.82rem', whiteSpace: 'pre' }}
          />
          {text.trim() && (
            <p style={{ fontSize: '0.74rem', color: 'var(--tp-muted)', marginTop: 8 }}>
              {validCount} of {preview.length} line{preview.length !== 1 ? 's' : ''} look ready to import.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <button onClick={onCancel} className="tp-btn-outline">Cancel</button>
            <button onClick={handleCreate} disabled={validCount === 0 || running} className="tp-btn-primary">
              {running ? 'Creating…' : `Create ${validCount} Student${validCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}

      {results && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4cba80' }}>✓ {successCount} created</span>
            {failCount > 0 && <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--tp-danger-text)' }}>✕ {failCount} failed</span>}
            {running && <span style={{ fontSize: '0.85rem', color: 'var(--tp-muted)' }}>Working…</span>}
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 10px', borderRadius: 8, background: r.ok ? 'rgba(76,186,128,0.08)' : 'rgba(224,80,80,0.08)', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--tp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.line}</span>
                <span style={{ color: r.ok ? '#4cba80' : '#e05050', fontWeight: 700, flexShrink: 0 }}>{r.ok ? '✓' : r.message}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button onClick={onDone} disabled={running} className="tp-btn-primary">Done</button>
          </div>
        </>
      )}
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
          <label className="tp-label">{f.label} {f.optional && <span className="text-xs" style={{ color: 'var(--tp-muted)' }}>(optional)</span>}</label>
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

  const [loadError, setLoadError] = React.useState('');

  const loadStars = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const ids = students.map(s => s.id);
      if (ids.length === 0) { setLoading(false); return; }
      const { data, error } = await sb.from('student_star_points')
        .select('student_id, points')
        .in('student_id', ids);
      if (error) {
        console.error('[Stars] load failed:', error);
        setLoadError(error.message || 'Could not load star points.');
      }
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => { map[r.student_id] = r.points; });
      setStarPoints(map);
    } catch (err: any) {
      console.error('[Stars] load failed (exception):', err);
      setLoadError(err.message || 'Could not load star points.');
    }
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

  const giveStars = async (studentId: string, amount: number, type: 'bronze' | 'silver' | 'gold' | 'minus') => {
    setGiving(studentId);
    try {
      const current = starPoints[studentId] || 0;
      const newTotal = Math.max(0, current + amount);
      const { error } = await sb.from('student_star_points').upsert({
        student_id: studentId,
        teacher_id: session.user.id,
        points: newTotal,
      }, { onConflict: 'student_id' });
      if (error) throw error;
      setStarPoints(prev => ({ ...prev, [studentId]: newTotal }));
      setFlash(prev => ({ ...prev, [studentId]: type }));
      setTimeout(() => setFlash(prev => { const n = { ...prev }; delete n[studentId]; return n; }), 1200);
    } catch (err: any) {
      console.error('[Stars] give failed:', err);
      alert('Error saving star points: ' + (err.message || 'unknown error') + '\n\nThe points were NOT saved — please try again.');
    }
    setGiving(null);
  };

  // Real metal swatches — the same ones as the landing page's rarity buttons.
  // (These used to be a purple "bronze" and a pink "gold", and the legend's
  // emoji didn't match the buttons' emoji, so the points were a guessing game.
  // The buttons now just say how many points they give.)
  const starColors = {
    bronze: { bg: 'linear-gradient(160deg,#e3b58a 0%,#b87a48 45%,#8b5a2b 100%)', ink: '#2b1606', label: '+1', pts: 1, glow: 'rgba(184,122,72,0.40)', name: 'Bronze' },
    silver: { bg: 'linear-gradient(160deg,#f2f6fa 0%,#bccbd8 45%,#8fa3b5 100%)', ink: '#18222d', label: '+2', pts: 2, glow: 'rgba(143,163,181,0.40)', name: 'Silver' },
    gold:   { bg: 'linear-gradient(160deg,#ffe9a6 0%,#f0b020 45%,#c98a0b 100%)', ink: '#2a1a00', label: '+3', pts: 3, glow: 'rgba(240,176,32,0.45)', name: 'Gold'   },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {loadError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--tp-danger-text)', borderRadius: 12, padding: '10px 16px', fontSize: '0.8rem', fontWeight: 700 }}>
          ⚠️ Couldn't load star points: {loadError} — the numbers below may be out of date.
        </div>
      )}

      {/* Legend — what each metal is worth */}
      <div className="tp-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span className="tp-label" style={{ margin: 0 }}>Tap to award</span>
          {(Object.values(starColors)).map(cfg => (
            <span key={cfg.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: 'var(--tp-text2)' }}>
              <i style={{ width: 16, height: 16, borderRadius: 5, background: cfg.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.25)', display: 'block' }} />
              {cfg.name} <b style={{ color: 'var(--tp-text)', fontWeight: 900 }}>+{cfg.pts}</b>
            </span>
          ))}
        </div>
        <span className="tp-count">{students.length} students</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--tp-muted)', fontSize: '0.85rem' }}>Loading…</div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--tp-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No students yet — add some in the Students tab first.</div>
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
                style={{ background: 'var(--tp-panel)', borderRadius: 16, padding: '16px 12px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxShadow: 'var(--tp-shadow)', border: '1px solid var(--tp-border)', position: 'relative' }}>

                {/* Points badge — re-keys on pts to retrigger ptsPop animation */}
                <div key={`pts-${student.id}-${pts}`} className="pts-pop"
                  style={{ position: 'absolute', top: -11, right: -11, background: pts > 0 ? 'linear-gradient(135deg,var(--tp-rose),var(--tp-rose))' : 'var(--tp-lift-2)', color: pts > 0 ? 'white' : 'var(--tp-muted)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.85rem', boxShadow: pts > 0 ? '0 2px 12px rgba(204,51,85,0.6)' : 'none', border: '1.5px solid var(--tp-border)', zIndex: 1 }}>
                  {pts}
                </div>

                {/* Bot */}
                <MiniBotAvatar colorIndex={colorIdx} size={90} facePixels={facePixelMap[student.id]} botElements={botElementMap[student.id]} starPoints={pts} />

                {/* Name */}
                <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--tp-text)', textAlign: 'center', lineHeight: 1.2 }}>{student.name}</div>

                {/* Star buttons */}
                <div style={{ display: 'flex', gap: 5, width: '100%', marginTop: 2 }}>
                  {(Object.entries(starColors) as [string, typeof starColors.bronze][]).map(([type, cfg]) => (
                    <button key={type} className="star-btn" disabled={isBusy}
                      onClick={() => giveStars(student.id, cfg.pts, type as any)}
                      title={`${cfg.name}: +${cfg.pts} star point${cfg.pts > 1 ? 's' : ''}`}
                      style={{ flex: 1, height: 42, borderRadius: 10, border: 'none', background: cfg.bg, color: cfg.ink, cursor: 'pointer', font: "900 17px/1 var(--tp-display)", fontStretch: '112%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${cfg.glow}, inset 0 1px 0 rgba(255,255,255,.45), inset 0 -1px 0 rgba(0,0,0,.15)` }}>
                      {isBusy ? '…' : cfg.label}
                    </button>
                  ))}
                </div>

                {/* Minus button — for mistakes / wrong student */}
                <button disabled={isBusy || pts <= 0} onClick={() => giveStars(student.id, -1, 'minus')}
                  title="Remove 1 star point"
                  style={{
                    width: '100%', marginTop: 2, height: 26, borderRadius: 9, fontSize: '0.68rem', fontWeight: 800,
                    border: '1px solid var(--tp-border)', background: 'transparent', color: 'var(--tp-muted)',
                    cursor: pts > 0 ? 'pointer' : 'not-allowed', opacity: pts > 0 ? 1 : 0.4,
                  }}>
                  − 1 point
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════
// CARD DATABASE TAB — Teacher creates cards for the pack pool
// ══════════════════════════════════════════════════════════════════════

const DB_DECK_OPTIONS = [
  { id: 'xanimals',  label: '🧬 Xanimals',      color: '#06b6d4' },
  { id: 'animals',   label: '🐾 Animals',        color: '#22c55e' },
  { id: 'creatures', label: '👾 Creatures',       color: '#a855f7' },
  { id: 'humanoids', label: '🧑 Humanoids',      color: '#f59e0b' },
  { id: 'robots',    label: '🤖 Robots',         color: '#3b82f6' },
  { id: 'special',   label: '✨ Special',        color: '#be123c' },
  { id: 'project',   label: '📋 Project Cards',  color: '#f97316' },
];

const DB_RARITY_OPTIONS = [
  { id: 'common',    label: '⭐ Common',     color: '#c08552', hint: 'Available in all packs' },
  { id: 'silver',    label: '✦ Silver',      color: '#94a3b8', hint: 'Less common in packs' },
  { id: 'gold-rare', label: '★ Gold',        color: '#f59e0b', hint: 'Rare — few per pack cycle' },
  { id: 'prismatic', label: '🌈 Rainbow',    color: '#a855f7', hint: 'Extremely rare, holographic' },
];

function CardDatabaseTab({ session, specialPackLabel }: { session: NonNullable<import('../lib/auth').Session>; specialPackLabel: string | null }) {
  const deckOptions = React.useMemo(
    () => DB_DECK_OPTIONS.map(d => d.id === 'special' && specialPackLabel ? { ...d, label: `✨ ${specialPackLabel}` } : d),
    [specialPackLabel]
  );
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
  const [dbScale, setDbScale] = React.useState(1);
  const [dbRotation, setDbRotation] = React.useState(0);
  const [dbPosition, setDbPosition] = React.useState({ x: 0, y: 0 });
  const [dbIsDragging, setDbIsDragging] = React.useState(false);
  const [dbDragStart, setDbDragStart] = React.useState({ clientX: 0, clientY: 0, startX: 0, startY: 0 });
  const loadedImgRef = React.useRef<HTMLImageElement | null>(null);
  const [loadedImgKey, setLoadedImgKey] = React.useState<string | null>(null);
  const [livePreview, setLivePreview] = React.useState<string | null>(null);

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
      setDbScale(1); setDbRotation(0); setDbPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Load the raw image once per upload (cached so live edits don't re-decode it every frame)
  React.useEffect(() => {
    if (!dbImage) { loadedImgRef.current = null; setLoadedImgKey(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { loadedImgRef.current = img; setLoadedImgKey(dbImage); };
    img.onerror = () => { loadedImgRef.current = null; setLoadedImgKey(null); };
    img.src = dbImage;
  }, [dbImage]);

  // Renders the exact same framing shown in the editor box — used for BOTH the editor
  // and the card preview, so they can never drift out of sync.
  const renderCrop = React.useCallback((): string | null => {
    const img = loadedImgRef.current;
    if (!img) return null;
    const OUTPUT_W = 480; const OUTPUT_H = 360;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_W; canvas.height = OUTPUT_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.save();
    ctx.translate(OUTPUT_W / 2, OUTPUT_H / 2);
    ctx.rotate((dbRotation * Math.PI) / 180);
    ctx.scale(dbScale, dbScale);
    ctx.translate((dbPosition.x / 100) * OUTPUT_W, (dbPosition.y / 100) * OUTPUT_H);
    const baseScale = Math.min(OUTPUT_W / img.naturalWidth, OUTPUT_H / img.naturalHeight);
    const drawW = img.naturalWidth * baseScale;
    const drawH = img.naturalHeight * baseScale;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
    const webpUrl = canvas.toDataURL('image/webp', 0.88);
    return webpUrl.startsWith('data:image/webp') ? webpUrl : canvas.toDataURL('image/jpeg', 0.92);
  }, [dbScale, dbRotation, dbPosition]);

  // Keep the live preview perfectly in sync with every drag/zoom/rotate change
  React.useEffect(() => {
    setLivePreview(renderCrop());
  }, [renderCrop, loadedImgKey]);

  const handleSaveToDatabase = async () => {
    if (!cardName.trim()) { setSavedMsg('Enter a card name.'); return; }
    if (!cardDescription.trim()) { setSavedMsg('Enter a card description.'); return; }
    if (!weakActionName.trim()) { setSavedMsg('Enter a weak action name.'); return; }
    if (!strongActionName.trim()) { setSavedMsg('Enter a strong action name.'); return; }
    setSaving(true); setSavedMsg('');
    try {
      setSavedMsg('Uploading image…');
      const rawImage = livePreview || dbImage || '';
      const imageUrl = await uploadImageToR2(rawImage, 'cards');
      setSavedMsg('Saving card…');
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
      setCardName(''); setCardDescription(''); setDbImage(null);
      setWeakActionName(''); setStrongActionName('');
      setIsRareExclusive(false); setMaxCopies(5);
      setDbScale(1); setDbRotation(0); setDbPosition({ x: 0, y: 0 });
    } catch (err: any) {
      setSavedMsg('Error: ' + (err.message || 'Save failed'));
    }
    setSaving(false);
  };

  const currentImage = livePreview || dbImage;
  const currentRange = RARITY_RANGES[cardRarity] || RARITY_RANGES['common'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Card Builder */}
      <div className="tp-builder">

        {/* Column 1: Image */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="tp-panel">
            <div className="tp-section">1 · Upload Image</div>
            <div style={{ background: 'var(--tp-sunken)', borderRadius: 10, border: '1.5px dashed var(--tp-border-bright)', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8, position: 'relative' }}>
              {dbImage ? (
                <img src={dbImage} alt="preview" draggable={false}
                  onMouseDown={e => { e.preventDefault(); setDbIsDragging(true); setDbDragStart({ clientX: e.clientX, clientY: e.clientY, startX: dbPosition.x, startY: dbPosition.y }); }}
                  onMouseMove={e => { if (!dbIsDragging) return; const dx = ((e.clientX - dbDragStart.clientX) / (e.currentTarget.parentElement?.offsetWidth || 200)) * 100; const dy = ((e.clientY - dbDragStart.clientY) / (e.currentTarget.parentElement?.offsetHeight || 150)) * 100; setDbPosition({ x: dbDragStart.startX + dx, y: dbDragStart.startY + dy }); }}
                  onMouseUp={() => setDbIsDragging(false)} onMouseLeave={() => setDbIsDragging(false)}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `translate(${dbPosition.x}%, ${dbPosition.y}%) scale(${dbScale}) rotate(${dbRotation}deg)`, cursor: dbIsDragging ? 'grabbing' : 'grab', userSelect: 'none', minHeight: 130 }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--tp-text2)', fontSize: '0.75rem', padding: 16 }}><div style={{ fontSize: '2rem', marginBottom: 4 }}>🖼</div>No image</div>
              )}
            </div>
            {dbImage && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[['↺', () => setDbRotation(r => r - 90)], ['↻', () => setDbRotation(r => r + 90)], ['⟳', () => { setDbScale(1); setDbRotation(0); setDbPosition({ x:0,y:0 }); }]].map(([l, fn]: any) => (
                  <button key={l} onClick={fn} style={{ fontSize:'0.68rem', padding:'3px 9px', border:'1px solid var(--tp-border-bright)', borderRadius:4, background:'var(--tp-lift-2)', cursor:'pointer', color:'var(--tp-text2)' }}>{l}</button>
                ))}
              </div>
            )}
            {dbImage && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <span style={{ fontSize:'0.65rem', color:'var(--tp-muted)', flexShrink:0 }}>🔍</span>
                <input type="range" min="0.3" max="5" step="0.05" value={dbScale}
                  onChange={e => setDbScale(parseFloat(e.target.value))} style={{ flex:1, accentColor:'var(--tp-rose)' }} />
                <span style={{ fontSize:'0.68rem', color:'var(--tp-muted)', width:28, textAlign:'right' }}>{dbScale.toFixed(1)}×</span>
              </div>
            )}
            {dbImage && (
              <div style={{ fontSize:'0.65rem', color:'#4cba80', textAlign:'center', marginBottom:6, fontWeight:600 }}>
                ✓ Live preview — card on the right always matches this exactly
              </div>
            )}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display:'none' }} />
            <button onClick={() => fileInputRef.current?.click()} style={{ width:'100%', padding:'0.5rem', border:'1.5px dashed var(--tp-border-bright)', borderRadius:8, background:'rgba(204,51,85,0.1)', color:'var(--tp-text2)', fontSize:'0.8rem', cursor:'pointer', fontWeight:700 }}>
              📁 Upload Image
            </button>
            {dbImage && (
              <button onClick={() => { setDbImage(null); setDbScale(1); setDbRotation(0); setDbPosition({x:0,y:0}); }} style={{ width:'100%', marginTop:6, padding:'0.3rem', border:'1px solid rgba(200,50,50,0.2)', borderRadius:6, background:'transparent', color:'#b04040', fontSize:'0.72rem', cursor:'pointer' }}>
                ✕ Remove
              </button>
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
                <button key={r.id} onClick={() => setCardRarity(r.id)} style={{ padding:'8px 10px', borderRadius:10, fontSize:'0.78rem', fontWeight:700, cursor:'pointer', textAlign:'left', border: cardRarity === r.id ? `2px solid ${r.color}` : '1.5px solid var(--tp-border)', background: cardRarity === r.id ? `${r.color}18` : 'var(--tp-lift-2)', color: cardRarity === r.id ? r.color : 'var(--tp-muted)' }}>
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
              {deckOptions.map(d => (
                <button key={d.id} onClick={() => setCardDeck(d.id)} style={{ padding:'5px 12px', borderRadius:20, fontSize:'0.76rem', fontWeight:700, cursor:'pointer', border: cardDeck === d.id ? `2px solid ${d.color}` : '1.5px solid var(--tp-border)', background: cardDeck === d.id ? `${d.color}18` : 'var(--tp-lift-2)', color: cardDeck === d.id ? d.color : 'var(--tp-muted)' }}>
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
            <div style={{ background:'var(--tp-lift-2)', border:'1px solid var(--tp-border)', borderRadius:12, padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>

              <div style={{ background:'rgba(204,51,85,0.1)', border:'1px solid var(--tp-border)', borderRadius:8, padding:'8px 10px', fontSize:'0.72rem', color:'var(--tp-text2)', lineHeight:1.5 }}>
                🔒 <strong>Stats are sealed</strong> — HP and damage values are rolled randomly when a student opens their pack. Only name the actions here.
              </div>

              {/* Weak action */}
              <div>
                <div style={{ fontSize:'0.72rem', color:'var(--tp-muted)', fontWeight:700, marginBottom:4 }}>⚡ Weak Action <span style={{ fontWeight:400, color:'var(--tp-muted)' }}>({currentRange.weakMin}–{currentRange.weakMax} dmg when opened)</span></div>
                <input type="text" className="tp-input"
                  placeholder="e.g. Quick Scratch" value={weakActionName}
                  onChange={e => setWeakActionName(e.target.value)} />
              </div>

              {/* Strong action */}
              <div>
                <div style={{ fontSize:'0.72rem', color:'var(--tp-muted)', fontWeight:700, marginBottom:4 }}>💥 Strong Action <span style={{ fontWeight:400, color:'var(--tp-muted)' }}>({currentRange.strongMin}–{currentRange.strongMax} dmg when opened)</span></div>
                <input type="text" className="tp-input"
                  placeholder="e.g. Thunder Strike" value={strongActionName}
                  onChange={e => setStrongActionName(e.target.value)} />
              </div>

              {/* HP range info */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:6, borderTop:'1px solid var(--tp-border)', fontSize:'0.72rem', color:'var(--tp-muted)' }}>
                <span>❤️ Hit Points</span>
                <span style={{ fontWeight:700, color:'var(--tp-text2)' }}>{currentRange.hpMin}–{currentRange.hpMax} (rolled on open)</span>
              </div>
            </div>
          </div>

          {/* Rare Exclusive */}
          <div style={{ background: isRareExclusive ? 'rgba(204,51,85,0.1)' : 'var(--tp-lift-3)', border:`1.5px solid ${isRareExclusive ? 'rgba(245,158,11,0.3)' : 'var(--tp-border)'}`, borderRadius:12, padding:'10px 14px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: isRareExclusive ? 8 : 0 }}>
              <div>
                <div style={{ fontSize:'0.8rem', fontWeight:800, color: isRareExclusive ? 'var(--tp-accent-pink)' : 'var(--tp-text2)' }}>🌟 Rare Exclusive</div>
                <div style={{ fontSize:'0.65rem', color:'var(--tp-muted)', marginTop:2 }}>Limit how many students can own this card</div>
              </div>
              <button onClick={() => setIsRareExclusive(v => !v)} style={{ padding:'4px 14px', borderRadius:20, fontSize:'0.75rem', fontWeight:800, border:'none', cursor:'pointer', background: isRareExclusive ? 'rgba(204,51,85,0.2)' : 'var(--tp-lift-2)', color: isRareExclusive ? '#92400e' : 'var(--tp-muted)' }}>
                {isRareExclusive ? 'ON' : 'OFF'}
              </button>
            </div>
            {isRareExclusive && (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <label className="tp-label" style={{ margin:0, flexShrink:0 }}>Max copies:</label>
                <input type="number" min={1} max={50} value={maxCopies} onChange={e => setMaxCopies(parseInt(e.target.value)||1)}
                  className="tp-input" style={{ width:70, textAlign:'center' }} />
                <span style={{ fontSize:'0.7rem', color:'var(--tp-muted)' }}>students can own this</span>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Preview + Save — sticky, so the card stays in view while you fill the form */}
        <div className="tp-builder-preview">
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
          <div style={{ background:'rgba(204,51,85,0.08)', border:'1px solid rgba(204,51,85,0.2)', borderRadius:12, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontSize:'0.8rem', fontWeight:800, color:'var(--tp-accent-pink)' }}>🔒 Stats Sealed</div>
            <div style={{ fontSize:'0.68rem', color:'var(--tp-text2)', marginTop:3, lineHeight:1.4 }}>
              HP, damage & skill points are rolled<br/>randomly when a student opens their pack
            </div>
            <div style={{ display:'flex', justifyContent:'center', gap:12, marginTop:8, fontSize:'0.7rem', color:'var(--tp-muted)' }}>
              <span>❤️ {currentRange.hpMin}–{currentRange.hpMax}</span>
              <span>⚡ {currentRange.weakMin}–{currentRange.weakMax}</span>
              <span>💥 {currentRange.strongMin}–{currentRange.strongMax}</span>
            </div>
          </div>

          {savedMsg && (
            <div style={{ padding:'8px 14px', borderRadius:10, fontSize:'0.8rem', fontWeight:700, background: savedMsg.startsWith('✓') ? 'rgba(80,200,120,0.1)' : 'rgba(255,80,80,0.08)', border:`1px solid ${savedMsg.startsWith('✓') ? 'rgba(80,200,120,0.3)' : 'rgba(255,80,80,0.25)'}`, color: savedMsg.startsWith('✓') ? '#4cba80' : '#ff7070', textAlign:'center' }}>
              {savedMsg}
            </div>
          )}

          <button onClick={handleSaveToDatabase} disabled={saving} className="tp-btn-primary" style={{ width:'100%', fontSize:'0.88rem' }}>
            {saving ? 'Saving…' : '💾 Add to Card Database'}
          </button>

          <p style={{ fontSize:'0.65rem', color:'var(--tp-muted)', textAlign:'center', margin:0, fontStyle:'italic' }}>
            This card will appear in packs students buy with star points
          </p>
        </div>
      </div>

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// CHARACTER POOL TAB — Card Database page
// ══════════════════════════════════════════════════════════════════════

const CARDS_PER_PAGE = 10;

function CharacterPoolTab({ session, specialPackLabel }: { session: NonNullable<import('../lib/auth').Session>; specialPackLabel: string | null }) {
  const deckOptions = React.useMemo(
    () => DB_DECK_OPTIONS.map(d => d.id === 'special' && specialPackLabel ? { ...d, label: `✨ ${specialPackLabel}` } : d),
    [specialPackLabel]
  );
  const [cards, setCards]       = React.useState<any[]>([]);
  const [loading, setLoading]   = React.useState(true);
  const [filter, setFilter]     = React.useState<string>('all');
  const [page, setPage]         = React.useState(0);
  const [totalCount, setTotalCount] = React.useState(0);
  const [deckCounts, setDeckCounts] = React.useState<Record<string, number>>({});

  // Edit modal state
  const [editCard, setEditCard] = React.useState<any | null>(null);
  const [editForm, setEditForm] = React.useState<any>({});
  const [editSaving, setEditSaving] = React.useState(false);
  const [editError, setEditError] = React.useState('');

  const totalPages = Math.max(1, Math.ceil(totalCount / CARDS_PER_PAGE));

  const loadCards = React.useCallback(async (pageIdx: number, currentFilter: string) => {
    setLoading(true);
    try {
      const from = pageIdx * CARDS_PER_PAGE;
      const to   = from + CARDS_PER_PAGE - 1;
      let query = sb.from('card_database')
        .select('*', { count: 'exact' })
        .eq('teacher_id', session.user.id)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (currentFilter !== 'all') query = query.eq('type', currentFilter);
      const { data, count } = await query;
      setCards(data || []);
      setTotalCount(count ?? 0);
    } catch { setCards([]); setTotalCount(0); }
    setLoading(false);
  }, [session.user.id]);

  const loadDeckCounts = React.useCallback(async () => {
    try {
      const { data } = await sb.from('card_database')
        .select('type')
        .eq('teacher_id', session.user.id);
      const counts: Record<string, number> = {};
      let total = 0;
      for (const row of data || []) {
        counts[row.type] = (counts[row.type] || 0) + 1;
        total++;
      }
      counts['all'] = total;
      setDeckCounts(counts);
    } catch {}
  }, [session.user.id]);

  React.useEffect(() => { loadDeckCounts(); }, [loadDeckCounts]);
  React.useEffect(() => { loadCards(page, filter); }, [page, filter, loadCards]);

  const handleFilterChange = (newFilter: string) => { setFilter(newFilter); setPage(0); };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this character from the database?')) return;
    await sb.from('card_database').delete().eq('id', id);
    const newTotal = totalCount - 1;
    const newTotalPages = Math.max(1, Math.ceil(newTotal / CARDS_PER_PAGE));
    const newPage = page >= newTotalPages ? Math.max(0, page - 1) : page;
    setPage(newPage);
    loadDeckCounts();
    loadCards(newPage, filter);
  };

  const openEdit = (c: any) => {
    setEditCard(c);
    setEditForm({
      card_name: c.card_name || '',
      description: c.description || '',
      type: c.type || DB_DECK_OPTIONS[0].id,
      hp: c.hp ?? '',
      stat1_name: c.stat1_name || '',
      stat1_val: c.stat1_val ?? '',
      stat2_name: c.stat2_name || '',
      stat2_val: c.stat2_val ?? '',
      move1_name: c.move1_name || '',
      move1_dmg: c.move1_dmg ?? '',
      move2_name: c.move2_name || '',
      move2_dmg: c.move2_dmg ?? '',
      image_url: c.image_url || '',
    });
    setEditError('');
  };

  const handleEditSave = async () => {
    if (!editCard) return;
    setEditSaving(true);
    setEditError('');
    try {
      const imageUrl = await uploadImageToR2(editForm.image_url || '', 'cards');
      const { error } = await sb.from('card_database').update({
        card_name:   editForm.card_name,
        description: editForm.description,
        type:        editForm.type,
        hp:          Number(editForm.hp),
        stat1_name:  editForm.stat1_name,
        stat1_val:   Number(editForm.stat1_val),
        stat2_name:  editForm.stat2_name,
        stat2_val:   Number(editForm.stat2_val),
        move1_name:  editForm.move1_name,
        move1_dmg:   Number(editForm.move1_dmg),
        move2_name:  editForm.move2_name,
        move2_dmg:   Number(editForm.move2_dmg),
        image_url:   imageUrl || null,
      }).eq('id', editCard.id);
      if (error) throw error;
      setEditCard(null);
      loadDeckCounts();
      loadCards(page, filter);
    } catch (e: any) {
      setEditError(e.message || 'Save failed.');
    }
    setEditSaving(false);
  };

  const ef = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEditForm((prev: any) => ({ ...prev, [field]: e.target.value }));

  const pageLabel = (idx: number) => {
    const start = idx * CARDS_PER_PAGE + 1;
    const end   = Math.min((idx + 1) * CARDS_PER_PAGE, totalCount);
    return `${start}–${end}`;
  };

  // Match the studio's .tp-input / .tp-label so this modal isn't its own island.
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
    border: '1px solid var(--tp-input-border)', background: 'var(--tp-input-bg)',
    color: 'var(--tp-text)', fontSize: 14, fontFamily: 'var(--tp-body)', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    font: '600 10.5px/1.3 var(--tp-mono)', color: 'var(--tp-label-color)', letterSpacing: '0.14em',
    textTransform: 'uppercase', marginBottom: 8, display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Edit Modal ── */}
      {editCard && (
        <div className="tp-modal-bg" style={{ zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && setEditCard(null)}>
          <div className="tp-modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: '1.8rem' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.4rem' }}>
              <h3 style={{ margin: 0 }}>Edit card</h3>
              <button onClick={() => setEditCard(null)} style={{ background: 'none', border: 'none', color: 'var(--tp-muted)', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>

              {/* Name + Type row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Card Name</label>
                  <input style={inputStyle} value={editForm.card_name} onChange={ef('card_name')} />
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={editForm.type} onChange={ef('type')}>
                    {deckOptions.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontFamily: 'inherit' }} value={editForm.description} onChange={ef('description')} />
              </div>

              {/* Image */}
              <div>
                <label style={labelStyle}>Card Image</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Preview */}
                  <div style={{ width: 90, height: 90, borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--tp-border)', background: 'var(--tp-lift)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {editForm.image_url
                      ? <img src={editForm.image_url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '1.8rem', opacity: 0.2 }}>🖼</span>
                    }
                  </div>
                  {/* Upload + clear controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    <label style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(204,51,85,0.4)', background: 'rgba(204,51,85,0.08)', color: 'var(--tp-accent-pink)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                      📁 Choose Image
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const webpUrl = await fileToWebP(file, 512, 512, 0.88);
                            setEditForm((prev: any) => ({ ...prev, image_url: webpUrl }));
                          } catch { setEditError('Image conversion failed.'); }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {editForm.image_url && (
                      <button onClick={() => setEditForm((prev: any) => ({ ...prev, image_url: '' }))}
                        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: 'var(--tp-danger-text)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}>
                        ✕ Remove Image
                      </button>
                    )}
                    <div style={{ fontSize: '0.62rem', color: 'var(--tp-muted)', lineHeight: 1.4 }}>
                      PNG, JPG or WebP · auto-converted to WebP · max 5MB
                    </div>
                  </div>
                </div>
              </div>

              {/* HP */}
              <div style={{ maxWidth: 140 }}>
                <label style={labelStyle}>HP</label>
                <input style={inputStyle} type="number" value={editForm.hp} onChange={ef('hp')} />
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <label style={labelStyle}>Stat 1 Name</label>
                  <input style={inputStyle} value={editForm.stat1_name} onChange={ef('stat1_name')} />
                </div>
                <div style={{ minWidth: 64 }}>
                  <label style={labelStyle}>Value</label>
                  <input style={inputStyle} type="number" value={editForm.stat1_val} onChange={ef('stat1_val')} />
                </div>
                <div>
                  <label style={labelStyle}>Stat 2 Name</label>
                  <input style={inputStyle} value={editForm.stat2_name} onChange={ef('stat2_name')} />
                </div>
                <div style={{ minWidth: 64 }}>
                  <label style={labelStyle}>Value</label>
                  <input style={inputStyle} type="number" value={editForm.stat2_val} onChange={ef('stat2_val')} />
                </div>
              </div>

              {/* Moves */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle}>Move 1 Name</label>
                  <input style={inputStyle} value={editForm.move1_name} onChange={ef('move1_name')} />
                  <label style={labelStyle}>Move 1 Damage</label>
                  <input style={inputStyle} type="number" value={editForm.move1_dmg} onChange={ef('move1_dmg')} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle}>Move 2 Name</label>
                  <input style={inputStyle} value={editForm.move2_name} onChange={ef('move2_name')} />
                  <label style={labelStyle}>Move 2 Damage</label>
                  <input style={inputStyle} type="number" value={editForm.move2_dmg} onChange={ef('move2_dmg')} />
                </div>
              </div>

              {editError && <div style={{ fontSize: '0.75rem', color: 'var(--tp-danger-text)', background: 'rgba(248,113,113,0.08)', borderRadius: 8, padding: '8px 12px' }}>{editError}</div>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setEditCard(null)} className="tp-btn-outline" style={{ fontSize: '0.78rem' }}>Cancel</button>
                <button onClick={handleEditSave} disabled={editSaving} className="tp-btn-primary" style={{ fontSize: '0.78rem', minWidth: 100 }}>
                  {editSaving ? 'Saving…' : '✓ Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Filter pills + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => handleFilterChange('all')} style={{ padding: '6px 16px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: filter === 'all' ? '2px solid rgba(204,51,85,0.7)' : '1px solid var(--tp-border)', background: filter === 'all' ? 'rgba(204,51,85,0.18)' : 'var(--tp-lift)', color: filter === 'all' ? 'var(--tp-accent-pink)' : 'var(--tp-muted)' }}>
            ✦ All <span style={{ opacity: 0.6 }}>({deckCounts['all'] ?? 0})</span>
          </button>
          {deckOptions.map(d => (
            <button key={d.id} onClick={() => handleFilterChange(d.id)} style={{ padding: '6px 16px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: filter === d.id ? `2px solid ${d.color}` : '1px solid var(--tp-border)', background: filter === d.id ? `${d.color}22` : 'var(--tp-lift)', color: filter === d.id ? d.color : 'var(--tp-muted)' }}>
              {d.label} <span style={{ opacity: 0.6 }}>({deckCounts[d.id] ?? 0})</span>
            </button>
          ))}
        </div>
        <button onClick={() => { loadDeckCounts(); loadCards(page, filter); }} className="tp-btn-outline" style={{ fontSize: '0.72rem', padding: '5px 12px' }}>↺ Refresh</button>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--tp-muted)', fontSize: '0.85rem', padding: 48 }}>Loading…</div>
      ) : cards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed rgba(204,51,85,0.15)', borderRadius: 20 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12, opacity: 0.2 }}>🃏</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--tp-muted)', fontStyle: 'italic', margin: 0 }}>
            {totalCount === 0 ? 'No characters yet — go to Card Creation to add some!' : `No ${filter} characters on this page.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16 }}>
          {cards.map(c => {
            const dc = deckOptions.find(d => d.id === c.type)?.color || '#818cf8';
            return (
              <div key={c.id} style={{ background: 'var(--tp-lift)', border: '1px solid var(--tp-border)', borderRadius: 16, overflow: 'hidden', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
                <div style={{ height: 3, background: `linear-gradient(90deg,${dc},${dc}66)` }} />
                {c.image_url ? (
                  <img src={c.image_url} alt={c.card_name} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} loading="lazy" />
                ) : (
                  <div style={{ width: '100%', height: 130, background: 'var(--tp-lift)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', opacity: 0.2 }}>🃏</div>
                )}
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--tp-text)', marginBottom: 3 }}>{c.card_name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--tp-muted)', marginBottom: 8, fontStyle: 'italic', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</div>
                  <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: 20, background: `${dc}22`, color: dc, fontWeight: 700, border: `1px solid ${dc}44` }}>{deckOptions.find(d => d.id === c.type)?.label || c.type}</span>
                    {c.is_rare_exclusive && <span style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: 20, background: 'rgba(204,51,85,0.15)', color: 'var(--tp-accent-pink)', fontWeight: 700, border: '1px solid rgba(204,51,85,0.3)' }}>🌟 ×{c.max_copies}</span>}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--tp-muted)', marginBottom: 8, display: 'flex', gap: 6 }}>
                    <span>⚡ {c.move1_name || '—'}</span><span style={{ opacity: 0.4 }}>·</span><span>💥 {c.move2_name || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(c)} className="tp-btn-outline" style={{ fontSize: '0.65rem', padding: '3px 10px', flex: 1 }}>✏️ Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="tp-btn-danger" style={{ fontSize: '0.65rem', padding: '3px 10px', flex: 1 }}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 8 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            style={{ padding: '5px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: page === 0 ? 'not-allowed' : 'pointer', border: '1px solid var(--tp-border)', background: 'var(--tp-lift)', color: page === 0 ? 'var(--tp-muted)' : 'var(--tp-text2)', opacity: page === 0 ? 0.4 : 1 }}
          >← Prev</button>

          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              disabled={loading}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: '0.72rem', fontWeight: i === page ? 800 : 500,
                cursor: 'pointer', transition: 'all 0.15s',
                border: i === page ? '2px solid rgba(204,51,85,0.7)' : '1px solid var(--tp-border)',
                background: i === page ? 'rgba(204,51,85,0.18)' : 'var(--tp-lift)',
                color: i === page ? 'var(--tp-accent-pink)' : 'var(--tp-muted)',
              }}
            >
              {pageLabel(i)}
            </button>
          ))}

          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1 || loading}
            style={{ padding: '5px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', border: '1px solid var(--tp-border)', background: 'var(--tp-lift)', color: page === totalPages - 1 ? 'var(--tp-muted)' : 'var(--tp-text2)', opacity: page === totalPages - 1 ? 0.4 : 1 }}
          >Next →</button>
        </div>
      )}

      {/* Record count */}
      {totalCount > 0 && (
        <div style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--tp-muted)', marginTop: -12 }}>
          Showing {page * CARDS_PER_PAGE + 1}–{Math.min((page + 1) * CARDS_PER_PAGE, totalCount)} of {totalCount} cards
        </div>
      )}
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
  weeklyCard, setWeeklyCard,
  weeklyProject, setWeeklyProject,
  activeChallenge,
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

  // ── Project card picker ──────────────────────────────────────────
  const [projectCards, setProjectCards] = React.useState<any[]>([]);
  const [pickLoading, setPickLoading] = React.useState(false);
  const [pickedCardId, setPickedCardId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const load = async () => {
      setPickLoading(true);
      try {
        const { data } = await sb
          .from('card_database')
          .select('id, card_name, description, image_url, move1_name, move2_name, type, rarity')
          .eq('teacher_id', session.user.id)
          .eq('type', 'project')
          .order('created_at', { ascending: false });
        setProjectCards(data || []);
      } catch { setProjectCards([]); }
      setPickLoading(false);
    };
    load();
  }, [session.user.id]);

  // ── Challenge Bank ────────────────────────────────────────────────
  const [challengeBank, setChallengeBank] = React.useState<any[]>([]);
  const [bankLoading, setBankLoading] = React.useState(false);
  const [bankDeleting, setBankDeleting] = React.useState<string | null>(null);

  const [bankError, setBankError] = React.useState('');

  const loadChallengeBank = React.useCallback(async () => {
    setBankLoading(true);
    setBankError('');
    try {
      const { data, error } = await sb
        .from('weekly_projects')
        .select('*')
        .eq('teacher_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      console.log('[ChallengeBank] loaded', data?.length || 0, 'rows for teacher_id', session.user.id, data);
      setChallengeBank(data || []);
    } catch (err: any) {
      console.error('[ChallengeBank] load failed', err);
      setChallengeBank([]);
      setBankError(err.message || 'Could not load the Challenge Bank.');
    }
    setBankLoading(false);
  }, [session.user.id]);

  React.useEffect(() => { loadChallengeBank(); }, [loadChallengeBank]);

  const handleLoadChallenge = (c: any) => {
    setWeeklyProject(c);
    setWeeklyTitle(c.title || '');
    setWeeklyTask(c.task || '');
    setWeeklyCard(c.card_data || null);
    setWeeklyEndDate(c.end_date || '');
    setWeeklyStatus('');
    setAwardSelections({});
    setSubmissions([]);
    // try to match the stored card back to a project card in the picker
    if (c.card_data?.card_name) {
      const match = projectCards.find((p: any) => p.card_name === c.card_data.card_name);
      setPickedCardId(match ? match.id : null);
    } else {
      setPickedCardId(null);
    }
    setWeeklyView('project');
  };

  const handleDeleteChallenge = async (id: string) => {
    if (!window.confirm('Delete this challenge from the bank? This cannot be undone.')) return;
    setBankDeleting(id);
    try {
      await sb.from('weekly_projects').delete().eq('id', id);
      if (weeklyProject?.id === id) {
        setWeeklyProject(null);
        setWeeklyTitle(''); setWeeklyTask('');
        setWeeklyCard(null); setWeeklyEndDate('');
        setPickedCardId(null);
      }
      await loadChallengeBank();
      onRefresh(); // refresh activeChallenge in case the deleted one was live
    } catch { /* ignore */ }
    setBankDeleting(null);
  };

  const handlePickCard = (card: any) => {
    setPickedCardId(card.id);
    const rarity = (card.rarity as any) || 'gold-rare';
    const hpMap: Record<string,number> = { common: 90, silver: 110, 'gold-rare': 130, prismatic: 160 };
    const dmgMap: Record<string,{w:number,s:number}> = { common:{w:45,s:60}, silver:{w:55,s:70}, 'gold-rare':{w:65,s:85}, prismatic:{w:80,s:110} };
    const hp = hpMap[rarity] ?? 120;
    const dmg = dmgMap[rarity] ?? {w:65, s:85};
    setWeeklyCard({
      card_name: card.card_name,
      type: card.type,
      rarity,
      description: card.description || '',
      image_url: card.image_url || '',
      hp,
      stat1_name: 'HP',                           stat1_val: hp,
      stat2_name: card.move1_name || 'Attack',     stat2_val: dmg.w,
      stat3_name: card.move2_name || 'Power',      stat3_val: dmg.s,
      move1_name: card.move1_name || 'Attack',     move1_dmg: dmg.w,
      move2_name: card.move2_name || 'Power',      move2_dmg: dmg.s,
      card_source: 'database' as any,
    });
    setWDone('Card selected! Publish the project when ready.');
  };

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

  // ── Save to Bank (draft — students don't see it yet) ─────────────
  const handleSaveToBank = async () => {
    if (!weeklyTitle.trim()) { setWErr('Give the challenge a title first.'); return; }
    if (weeklyProject?.id && weeklyProject.title !== weeklyTitle) {
      const proceed = window.confirm(
        `You're currently editing "${weeklyProject.title}" in the Bank.\n\n` +
        `It looks like you've changed it to "${weeklyTitle}" — if this is meant to be a NEW challenge, click Cancel and press "+ New Challenge" first, then try again.\n\n` +
        `Click OK to overwrite "${weeklyProject.title}" with these changes instead.`
      );
      if (!proceed) return;
    }
    setWWorking('Saving to Challenge Bank…');
    try {
      const payload: any = {
        teacher_id: session.user.id,
        title: weeklyTitle,
        task: weeklyTask,
        char_hint: '',
        card_data: weeklyCard || null,
        week_label: getCurrentWeekLabel(),
        end_date: weeklyEndDate || null,
      };
      let saved;
      if (weeklyProject?.id) {
        const { data, error } = await sb.from('weekly_projects').update(payload).eq('id', weeklyProject.id).select().single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await sb.from('weekly_projects').insert(payload).select().single();
        if (error) throw error;
        saved = data;
      }
      console.log('[ChallengeBank] saved to bank', saved);
      setWeeklyProject(saved);
      await loadChallengeBank();
      setWDone('✓ Saved to Challenge Bank!');
    } catch (err: any) { console.error('[ChallengeBank] save to bank failed', err); setWErr(err.message || JSON.stringify(err)); }
  };

  // ── Publish Challenge (makes it live for students) ───────────────
  const handleSaveProject = async () => {
    if (!weeklyCard) { setWErr('Select a Project Card first.'); return; }
    if (!weeklyTitle.trim()) { setWErr('Give the challenge a title first.'); return; }
    if (weeklyProject?.id && weeklyProject.title !== weeklyTitle) {
      const proceed = window.confirm(
        `You're currently editing "${weeklyProject.title}" in the Bank.\n\n` +
        `It looks like you've changed it to "${weeklyTitle}" — if this is meant to be a NEW challenge, click Cancel and press "+ New Challenge" first, then try again.\n\n` +
        `Click OK to overwrite "${weeklyProject.title}" with these changes instead.`
      );
      if (!proceed) return;
    }
    setWWorking('Publishing challenge…');
    try {
      const payload: any = {
        teacher_id: session.user.id,
        title: weeklyTitle,
        task: weeklyTask,
        char_hint: '',
        card_data: weeklyCard,
        week_label: getCurrentWeekLabel(),
        end_date: weeklyEndDate || null,
        created_at: new Date().toISOString(), // bump so this becomes the active challenge students see
      };
      let saved;
      if (weeklyProject?.id) {
        const { data, error } = await sb.from('weekly_projects').update(payload).eq('id', weeklyProject.id).select().single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await sb.from('weekly_projects').insert(payload).select().single();
        if (error) throw error;
        saved = data;
      }
      console.log('[ChallengeBank] published challenge', saved);
      setWeeklyProject(saved);
      await loadChallengeBank();
      onRefresh(); // refresh activeChallenge so the header/Award/Submissions reflect this immediately
      setWDone('🚀 Challenge published! Students can now see it.');
    } catch (err: any) { console.error('[ChallengeBank] publish failed', err); setWErr(err.message || JSON.stringify(err)); }
  };

  // ── New project ──────────────────────────────────────────────────
  const handleNewProject = () => {
    setWeeklyProject(null);
    setWeeklyTask(''); setWeeklyTitle('');
    setWeeklyCard(null); setWeeklyStatus(''); setWeeklyEndDate('');
    setAwardSelections({}); setSubmissions([]);
    setPickedCardId(null);
    setWeeklyView('project');
  };

  // ── Award a single student from submissions view ─────────────────
  const handleAwardSubmission = async (submission: any, rarity: 'common' | 'silver' | 'gold-rare') => {
    const liveCard = activeChallenge?.card_data;
    if (!activeChallenge || !liveCard) return;
    try {
      const mult = rarity === 'common' ? 0.7 : rarity === 'silver' ? 0.85 : 1;
      const cardToSave = {
        ...liveCard,
        rarity,
        student_id: submission.student_id,
        teacher_id: session.user.id,
        card_source: 'generated' as any,
        stat1_val: Math.round(liveCard.stat1_val * mult),
        stat2_val: Math.round(liveCard.stat2_val * mult),
        stat3_val: Math.round(liveCard.stat3_val * mult),
        hp: Math.round((liveCard.hp || 100) * mult),
      };
      await Dashboard.saveCard(cardToSave as any);
      // Mark submission as awarded and delete photos
      await sb.from('weekly_submissions')
        .update({ status: 'awarded', photo1_url: null, photo2_url: null })
        .eq('id', submission.id);
      // Reload submissions
      await loadSubmissions(activeChallenge.id);
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
    const liveCard = activeChallenge?.card_data;
    if (!activeChallenge || !liveCard) return;
    const entries = Object.entries(awardSelections);
    if (entries.length === 0) { setAwardError('Select at least one student.'); return; }
    setAwarding(true); setAwardError('');
    try {
      let awarded = 0;
      for (const [studentId, rar] of entries) {
        const mult = rar === 'common' ? 0.7 : rar === 'silver' ? 0.85 : 1;
        await Dashboard.saveCard({
          ...liveCard, rarity: rar, student_id: studentId, teacher_id: session.user.id,
          card_source: 'generated' as any,
          stat1_val: Math.round(liveCard.stat1_val * mult),
          stat2_val: Math.round(liveCard.stat2_val * mult),
          stat3_val: Math.round(liveCard.stat3_val * mult),
          hp: Math.round((liveCard.hp || 100) * mult),
        } as any);
        awarded++;
      }
      setAwardModal(false); setAwardSelections({});
      setWDone(`✓ Awarded "${activeChallenge.title}" card to ${awarded} student${awarded !== 1 ? 's' : ''}!`);
      onRefresh();
    } catch (err: any) { setAwardError(err.message); }
    setAwarding(false);
  };

  const awardCount = Object.keys(awardSelections).length;
  const hasActiveChallenge = !!activeChallenge?.id;

  // Switch to submissions view and load
  const handleViewSubmissions = async () => {
    setWeeklyView('submissions');
    if (activeChallenge?.id) await loadSubmissions(activeChallenge.id);
  };

  return (
    <div>
      {/* ── Toolbar: this week · view switcher · actions ── */}
      <div className="tp-toolbar">
        <div className="tp-weekchip">
          <span className="dot" data-live={activeChallenge ? '' : undefined} />
          <div>
            <b>{activeChallenge?.week_label || getCurrentWeekLabel()}
              {activeChallenge?.end_date && ` · Due ${new Date(activeChallenge.end_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}`}</b>
            <span>{activeChallenge ? 'Live — students can see this challenge' : 'Nothing published yet — publish one, or load one from the Bank'}</span>
          </div>
        </div>

        <div className="tp-toolbar-right">
          <div className="tp-seg" role="group" aria-label="Weekly project view">
            <button aria-pressed={weeklyView === 'project'} onClick={() => setWeeklyView('project')}>Challenge</button>
            <button aria-pressed={weeklyView === 'bank'} onClick={() => { setWeeklyView('bank'); loadChallengeBank(); }}>
              Bank {challengeBank.length > 0 && <i>{challengeBank.length}</i>}
            </button>
            {hasActiveChallenge && (
              <button aria-pressed={weeklyView === 'submissions'} onClick={handleViewSubmissions}>
                Submissions {submissions.length > 0 && <i className="hot">{submissions.length}</i>}
              </button>
            )}
          </div>
          {hasActiveChallenge && (
            <button onClick={handleOpenAward} className="tp-btn-gold">Award students</button>
          )}
          <button onClick={handleNewProject} className="tp-btn-outline"><Ico name="plus" /> New challenge</button>
        </div>
      </div>

      {/* ══ CHALLENGE BANK VIEW ══════════════════════════════════════ */}
      {weeklyView === 'bank' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--tp-text)' }}>🗄️ Challenge Bank</h3>
              <p className="text-xs italic" style={{ color: 'var(--tp-muted)' }}>All your saved challenges. Load any one to edit or publish it.</p>
            </div>
            <button onClick={() => { handleNewProject(); }} className="tp-btn-primary" style={{ fontSize: '0.75rem' }}>
              + Create New
            </button>
          </div>

          {bankLoading ? (
            <div className="text-sm italic text-center py-12" style={{ color: 'var(--tp-muted)' }}>Loading challenges…</div>
          ) : bankError ? (
            <div className="text-center py-12" style={{ background: 'rgba(255,80,80,0.06)', borderRadius: 16, border: '1.5px solid rgba(255,80,80,0.25)' }}>
              <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>⚠️</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--tp-danger-text)', fontWeight: 700, margin: '0 0 4px' }}>Couldn't load the Challenge Bank</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--tp-muted)', margin: 0, padding: '0 20px' }}>{bankError}</p>
            </div>
          ) : challengeBank.length === 0 ? (
            <div className="text-center py-16" style={{ background: 'var(--tp-lift)', borderRadius: 16, border: '2px dashed rgba(204,51,85,0.2)' }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.2, marginBottom: 8 }}>🏆</div>
              <p className="text-sm italic" style={{ color: 'var(--tp-muted)' }}>No challenges saved yet. Create your first one!</p>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {challengeBank.map((c: any) => {
                const isActive = activeChallenge?.id === c.id;
                const cardImg = c.card_data?.image_url;
                const cardName = c.card_data?.card_name;
                const publishedDate = c.created_at ? new Date(c.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
                return (
                  <div key={c.id} style={{
                    borderRadius: 16, overflow: 'hidden',
                    border: isActive ? '2px solid var(--tp-rose)' : '1.5px solid var(--tp-border)',
                    background: isActive ? 'rgba(204,51,85,0.07)' : 'var(--tp-lift)',
                    transition: 'all 0.15s',
                  }}>
                    {/* Card image strip */}
                    <div style={{ height: 100, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                      {cardImg ? (
                        <img src={cardImg} alt={cardName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: '2rem', opacity: 0.15 }}>📋</span>
                      )}
                      {isActive && (
                        <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--tp-rose)', color: 'white', fontSize: '0.6rem', fontWeight: 900, padding: '2px 8px', borderRadius: 99, letterSpacing: '0.05em' }}>
                          ACTIVE
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--tp-text)', marginBottom: 4 }}>{c.title || 'Untitled Challenge'}</div>
                      {cardName && <div style={{ fontSize: '0.7rem', color: '#f97316', marginBottom: 4, fontWeight: 600 }}>📋 {cardName}</div>}
                      <div style={{ fontSize: '0.68rem', color: 'var(--tp-muted)', marginBottom: 2 }}>
                        {c.task ? `${c.task.slice(0, 80)}${c.task.length > 80 ? '…' : ''}` : <em>No task description</em>}
                      </div>
                      {publishedDate && <div style={{ fontSize: '0.63rem', color: 'var(--tp-muted)', marginTop: 6, opacity: 0.6 }}>Last published {publishedDate}</div>}
                      {!isActive && <div style={{ fontSize: '0.62rem', color: 'var(--tp-muted)', marginTop: 4, fontStyle: 'italic' }}>Load it, set a due date, then Publish to make it current</div>}
                    </div>

                    <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
                      <button
                        onClick={() => handleLoadChallenge(c)}
                        style={{ flex: 1, padding: '7px 0', borderRadius: 9, fontSize: '0.73rem', fontWeight: 800, cursor: 'pointer', border: '1.5px solid rgba(204,51,85,0.4)', background: 'rgba(204,51,85,0.1)', color: 'var(--tp-accent-pink)', transition: 'all 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(192,132,252,0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(192,132,252,0.1)')}
                      >✏️ Load & Edit</button>
                      <button
                        onClick={() => handleDeleteChallenge(c.id)}
                        disabled={bankDeleting === c.id}
                        style={{ padding: '7px 12px', borderRadius: 9, fontSize: '0.73rem', fontWeight: 800, cursor: 'pointer', border: '1.5px solid rgba(239,68,68,0.25)', background: 'transparent', color: 'rgba(239,68,68,0.6)', transition: 'all 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >{bankDeleting === c.id ? '…' : '🗑️'}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ SUBMISSIONS VIEW ═════════════════════════════════════════ */}
      {weeklyView === 'submissions' && hasActiveChallenge && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: 'var(--tp-text)' }}>
              Student Submissions — {activeChallenge.title}
            </h3>
            <button onClick={() => loadSubmissions(activeChallenge.id)} className="tp-btn-outline" style={{ borderColor: 'var(--tp-border)', color: 'var(--tp-muted)' }}>
              ↻ Refresh
            </button>
          </div>

          {submissionsLoading ? (
            <div className="text-sm italic text-center py-8" style={{ color: 'var(--tp-muted)' }}>Loading submissions…</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12" style={{ background: 'var(--tp-lift)', borderRadius: 16, border: '2px dashed rgba(200,160,0,0.2)' }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.2, marginBottom: 8 }}>📭</div>
              <p className="text-sm italic" style={{ color: 'var(--tp-muted)' }}>No pending submissions yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {submissions.map((sub: any) => (
                <div key={sub.id} style={{ background: 'var(--tp-lift)', border: '1px solid var(--tp-border)', borderRadius: 16, padding: '1.2rem 1.5rem' }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Student info */}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div className="font-bold text-sm mb-1" style={{ color: 'var(--tp-text)' }}>
                        {sub.students?.name || 'Unknown student'}
                      </div>
                      <div className="text-xs italic mb-3" style={{ color: 'var(--tp-muted)' }}>
                        Submitted {new Date(sub.submitted_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {/* Photos */}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {sub.photo1_url && (
                          <a href={sub.photo1_url} target="_blank" rel="noopener noreferrer">
                            <img src={sub.photo1_url} alt="Evidence 1"
                              style={{ width: 110, height: 80, objectFit: 'cover', borderRadius: 10, border: '1.5px solid rgba(204,51,85,0.3)', cursor: 'pointer', transition: 'transform 0.15s' }}
                              onMouseEnter={e => { (e.target as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                              onMouseLeave={e => { (e.target as HTMLImageElement).style.transform = 'scale(1)'; }}
                            />
                          </a>
                        )}
                        {sub.photo2_url && (
                          <a href={sub.photo2_url} target="_blank" rel="noopener noreferrer">
                            <img src={sub.photo2_url} alt="Evidence 2"
                              style={{ width: 110, height: 80, objectFit: 'cover', borderRadius: 10, border: '1.5px solid rgba(204,51,85,0.3)', cursor: 'pointer', transition: 'transform 0.15s' }}
                              onMouseEnter={e => { (e.target as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                              onMouseLeave={e => { (e.target as HTMLImageElement).style.transform = 'scale(1)'; }}
                            />
                          </a>
                        )}
                        {!sub.photo1_url && !sub.photo2_url && (
                          <span style={{ fontSize:'0.75rem', fontStyle:'italic', color:'var(--tp-muted)' }}>No photos attached</span>
                        )}
                      </div>
                    </div>

                    {/* Award buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <div className="text-xs font-bold mb-1 text-center" style={{ color: 'var(--tp-muted)' }}>Award as:</div>
                      {([
                        { rar: 'common'    as const, label: '⭐ Common',  color: 'var(--tp-accent-pink)', bg: 'rgba(167,139,250,0.12)',   border: 'rgba(200,160,0,0.35)' },
                        { rar: 'silver'    as const, label: '✦ Silver',   color: '#5a7a90', bg: 'rgba(56,189,248,0.1)', border: 'rgba(120,160,190,0.4)' },
                        { rar: 'gold-rare' as const, label: '★ Gold',     color: 'var(--tp-accent-pink)', bg: 'rgba(244,114,182,0.1)',  border: 'rgba(212,160,23,0.4)' },
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
          <div className="p-6 rounded-xs" style={{ background: 'var(--tp-lift)', border: '1px solid rgba(90,50,10,0.18)', boxShadow: '2px 3px 12px rgba(0,0,0,0.09)' }}>

            {weeklyProject?.id ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16, padding: '8px 12px', borderRadius: 10, background: 'rgba(204,51,85,0.1)', border: '1px solid rgba(204,51,85,0.3)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--tp-accent-pink)', fontWeight: 700 }}>
                  ✏️ Editing "{weeklyProject.title}" — Save will update this Bank entry
                </span>
                <button onClick={handleNewProject} style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--tp-text2)', background: 'var(--tp-lift-2)', border: '1px solid var(--tp-border)', borderRadius: 7, padding: '3px 9px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  + New instead
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 10, background: 'rgba(80,200,120,0.08)', border: '1px solid rgba(80,200,120,0.25)' }}>
                <span style={{ fontSize: '0.72rem', color: '#4cba80', fontWeight: 700 }}>🆕 New challenge — Save will add this as a fresh Bank entry</span>
              </div>
            )}

            <div className="mb-4">
              <label className="tp-label">Challenge Title</label>
              <input type="text" className="tp-input"
                placeholder="e.g. The Solar System Explorer"
                value={weeklyTitle} onChange={e => setWeeklyTitle(e.target.value)} />
            </div>

            <div className="mb-4">
              <label className="tp-label">What must students do to earn this card?</label>
              <textarea className="tp-input" style={{ minHeight: 90 }}
                placeholder="e.g. Create a poster showing the 8 planets in our solar system..."
                value={weeklyTask} onChange={e => setWeeklyTask(e.target.value)} />
              <p className="text-xs mt-1 italic" style={{ color: 'var(--tp-muted)' }}>This text appears as the task on the student's page.</p>
            </div>

            {/* End date */}
            <div className="mb-5">
              <label className="tp-label">
                Due Date <span className="text-xs" style={{ color: 'var(--tp-muted)' }}>(optional — shown to students)</span>
              </label>
              <input type="date" className="tp-input"
                value={weeklyEndDate} onChange={e => setWeeklyEndDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
              {weeklyEndDate && (
                <button onClick={() => setWeeklyEndDate('')} className="text-xs mt-1" style={{ color: 'var(--tp-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Clear date
                </button>
              )}
            </div>

            {/* ── Project Card Picker ── */}
            <div>
              <label className="tp-label">Select a Project Card</label>
              {pickLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '0.8rem', color: 'var(--tp-muted)' }}>Loading project cards…</div>
              ) : projectCards.length === 0 ? (
                <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(249,115,22,0.06)', border: '1.5px dashed rgba(249,115,22,0.3)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 6, opacity: 0.4 }}>📋</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--tp-muted)', margin: 0, fontStyle: 'italic' }}>
                    No Project Cards yet. Go to <strong style={{ color: '#f97316' }}>Card Creation</strong> and create a card with deck type <strong style={{ color: '#f97316' }}>📋 Project Cards</strong>.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                  {projectCards.map((c: any) => {
                    const isPicked = pickedCardId === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handlePickCard(c)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                          borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
                          border: isPicked ? '2px solid #f97316' : '1.5px solid rgba(249,115,22,0.2)',
                          background: isPicked ? 'rgba(249,115,22,0.12)' : 'var(--tp-lift)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.card_name}
                            style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 48, height: 36, borderRadius: 6, background: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>📋</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: isPicked ? '#f97316' : 'var(--tp-text)', marginBottom: 2 }}>{c.card_name}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--tp-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            ⚡ {c.move1_name || '—'} · 💥 {c.move2_name || '—'}
                          </div>
                        </div>
                        {isPicked && <span style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 800, flexShrink: 0 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={handleSaveToBank} className="w-full py-2 rounded-lg text-sm font-bold" style={{ flex: 1, background: 'var(--tp-lift)', border: '1px solid var(--tp-border)', color: 'var(--tp-text2)', cursor: 'pointer' }}>
                🗄️ Save to Bank
              </button>
              {weeklyCard && (
                <button onClick={handleSaveProject} className="w-full py-2 rounded-lg text-sm font-bold" style={{ flex: 1, background: 'rgba(80,200,120,0.12)', border: '1px solid rgba(80,200,120,0.4)', color: '#4cba80', cursor: 'pointer' }}>
                  🚀 Publish Challenge
                </button>
              )}
            </div>

            {weeklyStatus && <div className={`tp-status-${weeklyStatusType} mt-3`}>{weeklyStatus}</div>}
          </div>

          {/* Right: preview */}
          <div className="flex flex-col gap-4">
            {weeklyCard ? (
              <>
                <div className="flex justify-center">
                  <PokeCard card={weeklyCard as Card} showShimmerBtn />
                </div>
                <div className="p-5 rounded-xs" style={{ background:'var(--tp-lift-2)', border:'1.5px solid var(--tp-border-bright)', borderRadius:20 }}>
                  <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--tp-accent-pink)' }}>🏆 Student View Preview</div>
                  <h3 className="font-display font-black text-base mb-2" style={{ color: 'var(--tp-text)' }}>{weeklyTitle || 'Challenge Title'}</h3>
                  {weeklyEndDate && <p className="text-xs font-bold mb-2" style={{ color: 'var(--tp-accent-pink)' }}>📅 Due: {new Date(weeklyEndDate).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
                  <p className="text-sm" style={{ color: 'var(--tp-text)', lineHeight: 1.7 }}>{weeklyTask || 'Task description will appear here.'}</p>
                  {!!weeklyProject?.id && activeChallenge?.id === weeklyProject?.id && <div className="mt-3 text-xs" style={{ color: '#4cba80', fontWeight: 700 }}>✓ Published · Students can see this challenge</div>}
                  {!!weeklyProject?.id && activeChallenge?.id !== weeklyProject?.id && <div className="mt-3 text-xs" style={{ color: 'var(--tp-accent-pink)', fontWeight: 700 }}>🗄️ Saved to Bank · Not currently live</div>}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xs" style={{ minHeight: 380, border: '2px dashed rgba(200,160,0,0.2)', background: 'var(--tp-lift)' }}>
                <span className="text-5xl mb-3" style={{ opacity: 0.2 }}>📋</span>
                <span className="text-sm italic" style={{ color: 'var(--tp-muted)' }}>Fill in the challenge details and select a card</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Bulk Award Modal ═══════════════════════════════════════════ */}
      {awardModal && (
        <div className="tp-modal-bg" onClick={() => { if (!awarding) setAwardModal(false); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--tp-raised)', border: '1px solid var(--tp-border-bright)', borderRadius: 18, padding: '2rem', width: '95%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <button onClick={() => setAwardModal(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--tp-text2)' }}>✕</button>
            <h3 className="font-display font-black text-xl mb-1" style={{ color: 'var(--tp-text)' }}>🏅 Award "{activeChallenge?.title}"</h3>
            <p className="text-xs mb-5 italic" style={{ color: 'var(--tp-muted)' }}>Tick each student in the column matching their achievement level. Each student can only receive one rarity.</p>
            {awardError && <div className="tp-err mb-4 text-sm">{awardError}</div>}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {([
                { key: 'common', label: 'Common', icon: '⭐', desc: 'Completed the task', color: 'var(--tp-accent-pink)', bg: 'rgba(167,139,250,0.08)', border: 'rgba(200,160,0,0.3)' },
                { key: 'silver', label: 'Silver', icon: '✦', desc: 'Good effort & quality', color: '#5a7a90', bg: 'rgba(56,189,248,0.08)', border: 'rgba(120,160,190,0.35)' },
                { key: 'gold-rare', label: 'Gold', icon: '★', desc: 'Outstanding work', color: 'var(--tp-accent-pink)', bg: 'rgba(244,114,182,0.08)', border: 'rgba(212,160,23,0.35)' },
              ] as const).map(col => (
                <div key={col.key} style={{ border: `1px solid ${col.border}`, borderRadius: 14, padding: '1rem', background: col.bg }}>
                  <div className="text-center mb-3">
                    <div className="text-2xl mb-1">{col.icon}</div>
                    <div style={{ fontWeight:800, fontSize:'0.85rem', color:col.color }}>{col.label}</div>
                    <div className="text-xs italic" style={{ color: 'var(--tp-muted)' }}>{col.desc}</div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {students.length === 0 && <span className="text-xs italic" style={{ color: 'var(--tp-muted)' }}>No students</span>}
                    {students.map((s: any) => {
                      const selected = awardSelections[s.id] === col.key;
                      const selectedOther = awardSelections[s.id] && awardSelections[s.id] !== col.key;
                      return (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: selected ? col.bg : 'transparent', border: selected ? `1.5px solid ${col.border}` : '1.5px solid transparent', opacity: selectedOther ? 0.4 : 1, transition: 'all 0.15s' }}>
                          <input type="checkbox" checked={selected} onChange={() => handleToggleStudent(s.id, col.key)} style={{ accentColor: col.color, width: 16, height: 16, flexShrink: 0 }} />
                          <span className="text-sm font-semibold" style={{ color: 'var(--tp-text)' }}>{s.name}</span>
                          {selected && <span style={{ fontSize:'0.72rem', marginLeft:'auto', color:col.color }}>✓</span>}
                          {selectedOther && <span className="text-xs ml-auto italic" style={{ color: 'var(--tp-muted)' }}>→ {awardSelections[s.id]}</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--tp-border)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm" style={{ color: 'var(--tp-text)' }}>
                  {awardCount > 0
                    ? <>Awarding to <strong>{awardCount}</strong> student{awardCount !== 1 ? 's' : ''}: {Object.entries(awardSelections).map(([sid, rar]: any) => `${students.find((s: any) => s.id === sid)?.name || sid} (${rar})`).join(', ')}</>
                    : <span className="italic" style={{ color: 'var(--tp-muted)' }}>No students selected yet</span>}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setAwardModal(false)} className="tp-btn-outline" style={{ borderColor: 'var(--tp-border)', color: 'var(--tp-text2)' }}>Cancel</button>
                  <button onClick={handleAward} disabled={awarding || awardCount === 0} className="tp-btn-gold" style={{ opacity: awardCount === 0 ? 0.4 : 1,  }}>
                    {awarding ? 'Awarding…' : `🏅 Award ${awardCount > 0 ? awardCount + ' Student' + (awardCount !== 1 ? 's' : '') : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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

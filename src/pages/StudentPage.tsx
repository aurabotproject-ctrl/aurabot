import React, { useState, useEffect, useCallback, useRef } from 'react';
import PokeCard from '../components/PokeCard';
import BuiltCard from '../components/BuiltCard';
import { Dashboard } from '../lib/dashboard';
import { sb, getWeeklyScoreboard, getMedalCounts, getWeekEnd, saveStudentRobotSettings, loadStudentRobotSettings } from '../lib/supabase';
import type { Session } from '../lib/auth';
import type { Card } from '../lib/supabase';

type WeeklyProject = {
  id: string;
  teacher_id: string;
  title: string;
  task: string;
  char_hint: string | null;
  card_data: Partial<Card> | null;
  week_label: string | null;
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const RARITY_ICONS: Record<string, string> = {
  common: '☆', silver: '✦', 'gold-rare': '★', prismatic: '✦✦',
};



/* Base 4 colour themes */
const BASE_COLOR_THEMES = [
  { light: '#e3f2fd', mid: '#90caf9', dark: '#42a5f5', glow: 'rgba(66,165,245,0.35)',   label: 'Sky',       wave: '#42a5f5', waveShadow: 'rgba(66,165,245,0.8)',   special: false },
  { light: '#fce4ec', mid: '#f8bbd0', dark: '#f48fb1', glow: 'rgba(244,143,177,0.35)', label: 'Bubblegum', wave: '#f06292', waveShadow: 'rgba(240,98,146,0.8)',   special: false },
  { light: '#f1f8e9', mid: '#c5e1a5', dark: '#8bc34a', glow: 'rgba(139,195,74,0.35)',  label: 'Minty',     wave: '#66bb6a', waveShadow: 'rgba(102,187,106,0.8)',  special: false },
  { light: '#fffde7', mid: '#fff176', dark: '#fdd835', glow: 'rgba(253,216,53,0.35)',   label: 'Lemon',     wave: '#fdd835', waveShadow: 'rgba(253,216,53,0.8)',   special: false },
];

/* Unlock-able extra colours (2 per unlock tier, then specials) */
const EXTRA_COLOR_THEMES = [
  // Tier 1 (+2 colors, total 6)
  { light: '#f3e5f5', mid: '#ce93d8', dark: '#ab47bc', glow: 'rgba(171,71,188,0.35)',  label: 'Grape',     wave: '#ab47bc', waveShadow: 'rgba(171,71,188,0.8)',   special: false },
  { light: '#e0f7fa', mid: '#80deea', dark: '#00bcd4', glow: 'rgba(0,188,212,0.35)',   label: 'Ocean',     wave: '#00bcd4', waveShadow: 'rgba(0,188,212,0.8)',    special: false },
  // Tier 2 (+2 more, total 8)
  { light: '#fff3e0', mid: '#ffcc80', dark: '#ff9800', glow: 'rgba(255,152,0,0.35)',   label: 'Tangerine', wave: '#ff9800', waveShadow: 'rgba(255,152,0,0.8)',    special: false },
  { light: '#fce4ec', mid: '#ef9a9a', dark: '#e53935', glow: 'rgba(229,57,53,0.35)',   label: 'Crimson',   wave: '#e53935', waveShadow: 'rgba(229,57,53,0.8)',    special: false },
  // Tier 3 — Shiny Gold & Silver (special)
  { light: '#fffde7', mid: '#ffe082', dark: '#ffc107', glow: 'rgba(255,193,7,0.6)',    label: '✨ Gold',    wave: '#ffd700', waveShadow: 'rgba(255,215,0,0.95)',   special: true,  gradient: 'linear-gradient(135deg,#fffbe6,#ffe066,#ffd700,#bfa000,#ffd700,#ffe066)' },
  { light: '#f5f5f5', mid: '#e0e0e0', dark: '#9e9e9e', glow: 'rgba(200,200,200,0.6)', label: '✨ Silver',  wave: '#c0c0c0', waveShadow: 'rgba(192,192,192,0.95)', special: true,  gradient: 'linear-gradient(135deg,#ffffff,#d0d0d0,#a0a0a0,#e8e8e8,#a0a0a0,#d0d0d0)' },
  // Tier 4 — Black Chrome & Rainbow Chrome (special)
  { light: '#ff9de2', mid: '#a78bfa', dark: '#38bdf8', glow: 'rgba(167,139,250,0.6)', label: '🌈 Chrome', wave: '#a855f7', waveShadow: 'rgba(168,85,247,0.95)', special: true, gradient: 'linear-gradient(135deg,#ff0080,#ff8c00,#ffe000,#00ff88,#00c8ff,#a855f7,#ff0080,#ff8c00,#ffe000)', rainbow: true },
  { light: '#0a0a0f', mid: '#111118', dark: '#1a1a2e', glow: 'rgba(140,80,255,0.55)', label: '🖤 Black Chrome', wave: '#7c3aed', waveShadow: 'rgba(124,58,237,0.95)',   special: true,  gradient: 'linear-gradient(135deg,#0a0a0f,#1a1028,#0d0d1a,#1a1028,#0a0a0f)', blackChrome: true },
];

/* Face pixel colour palettes — unlockable */
const FACE_COLOR_PALETTES = [
  { label: 'Blue',   on: '#42a5f5', glow: 'rgba(66,165,245,0.8)',   gradient: 'radial-gradient(circle at 40% 35%, #c8f0ff, #6dd5fa)' },
  { label: 'Yellow', on: '#fdd835', glow: 'rgba(253,216,53,0.8)',   gradient: 'radial-gradient(circle at 40% 35%, #fffde7, #ffd600)' },
  { label: 'Green',  on: '#66bb6a', glow: 'rgba(102,187,106,0.8)',  gradient: 'radial-gradient(circle at 40% 35%, #e8f5e9, #43a047)' },
  { label: 'Pink',   on: '#f06292', glow: 'rgba(240,98,146,0.8)',   gradient: 'radial-gradient(circle at 40% 35%, #fce4ec, #e91e63)' },
];

type ColorTheme = {
  light: string; mid: string; dark: string; glow: string;
  label: string; wave: string; waveShadow: string; special: boolean;
  gradient?: string; chromatic?: boolean; blackChrome?: boolean; rainbow?: boolean;
};

function buildColorThemes(unlockedColorCount: number): ColorTheme[] {
  const extras = EXTRA_COLOR_THEMES.slice(0, Math.max(0, unlockedColorCount - 4));
  return [...BASE_COLOR_THEMES, ...extras] as ColorTheme[];
}

function knobToRobotColor(k: number, themes: ColorTheme[]): ColorTheme {
  return themes[k % themes.length];
}

/* How many extra colors unlocked from an array of unlock choices */
function countUnlockedColors(choices: string[]): number {
  return choices.filter(c => c === 'color').length * 2;
}
function countUnlockedFaceColors(choices: string[]): number {
  return choices.filter(c => c === 'face').length;
}

/* ─────────────────────────────────────────────
   Waveform canvas component
───────────────────────────────────────────── */
function Waveform({ colorIndex, colorThemes }: { colorIndex: number; colorThemes: ColorTheme[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const colorRef = useRef(colorIndex);
  colorRef.current = colorIndex;
  const themesRef = useRef(colorThemes);
  themesRef.current = colorThemes;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function draw(ts: number) {
      const W = canvas!.width;
      const H = canvas!.height;
      ctx.clearRect(0, 0, W, H);
      const theme = themesRef.current[colorRef.current % themesRef.current.length];

      // Grid lines tinted to current color
      ctx.strokeStyle = theme.wave + '18';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 15) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Glow waveform — color matches theme
      const idx = colorRef.current;
      const speed = 0.0015 + (idx / 4) * 0.003;
      const amp = 18 + (idx / 4) * 20;
      const freq = 1 + (idx / 4) * 3;

      ctx.shadowColor = theme.wave;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = theme.waveShadow;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let px = 0; px < W; px++) {
        const t = (px / W) * Math.PI * 2 * freq + ts * speed;
        const spike = Math.exp(-((px / W - 0.4) ** 2) * 20) * amp * 1.8;
        const y = H / 2 + Math.sin(t) * amp * 0.4 + spike * Math.sin(t * 3);
        px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={120}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

/* ─────────────────────────────────────────────
   Saved Bot Avatar (from Build-a-Bot)
───────────────────────────────────────────── */

type BotElType = 'rect' | 'circle' | 'face' | 'chest' | 'group' | 'apple' | 'smiley' | 'heart' | 'thumbsup' | 'lips';
interface BotEl {
  id: string; type: BotElType; cx: number; cy: number; w: number; h: number;
  rotation: number; rx?: number | string; color: string; scale?: number;
  baseW?: number; baseH?: number; children?: BotEl[]; flipX?: boolean; flipY?: boolean;
}

// Compute the bounding box of all bot elements so we can fit them perfectly
// into the container without clipping. Called once per render with the saved elements.
function getBotBounds(elements: BotEl[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const visit = (el: BotEl) => {
    if (el.type === 'group' && el.children) {
      el.children.forEach(c => {
        // children are relative to group center; convert to absolute
        const absCx = el.cx + c.cx;
        const absCy = el.cy + c.cy;
        const hw = (c.w * (el.scale ?? 1)) / 2;
        const hh = (c.h * (el.scale ?? 1)) / 2;
        minX = Math.min(minX, absCx - hw); maxX = Math.max(maxX, absCx + hw);
        minY = Math.min(minY, absCy - hh); maxY = Math.max(maxY, absCy + hh);
      });
    } else {
      minX = Math.min(minX, el.cx - el.w / 2); maxX = Math.max(maxX, el.cx + el.w / 2);
      minY = Math.min(minY, el.cy - el.h / 2); maxY = Math.max(maxY, el.cy + el.h / 2);
    }
  };
  elements.forEach(visit);
  // Add a small padding so shadows/glows aren't clipped
  const PAD = 12;
  return { minX: minX - PAD, minY: minY - PAD, maxX: maxX + PAD, maxY: maxY + PAD,
           w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 };
}

// Container dimensions — match the default RobotAvatar's display area
const CONTAINER_W = 184;
const CONTAINER_H = 293;


const STICKER_MAP: Record<string, string> = { apple:'🍎', smiley:'🙂', heart:'❤️', thumbsup:'👍', lips:'👄' };

interface BotElSpecial { isRainbow?: boolean; isBlackChrome?: boolean; isGold?: boolean; isSilver?: boolean; sheenClass?: string; sheenColor?: string; }

function renderBotEl(el: BotEl & { _bodyBg?: string }, special?: BotElSpecial): React.ReactNode {
  const isGroup   = el.type === 'group';
  const isFace    = el.type === 'face';
  const isChest   = el.type === 'chest';
  const isScreen  = isFace || isChest;
  const isCircle  = el.type === 'circle';
  const isSticker = ['apple','smiley','heart','thumbsup','lips'].includes(el.type);
  const isSpecial = !!(special && (special.isRainbow || special.isBlackChrome || special.isGold || special.isSilver));


  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: el.cx,
    top: el.cy,
    width:  isGroup ? (el.baseW ?? el.w) : el.w,
    height: isGroup ? (el.baseH ?? el.h) : el.h,
    transform: `translate(-50%,-50%) rotate(${el.rotation}deg) scale(${isGroup ? (el.scale ?? 1) : 1}) scaleX(${el.flipX ? -1 : 1}) scaleY(${el.flipY ? -1 : 1})`,
    borderRadius: isCircle ? '50%' : (typeof el.rx === 'number' ? el.rx : 0),
    backgroundColor: (isGroup || isSticker) ? 'transparent' : el.color,
    boxShadow: isScreen
      ? 'inset 0 0 14px rgba(0,0,0,0.85)'
      : (!isGroup && !isSticker)
        ? 'inset 6px 6px 12px rgba(255,255,255,0.65), inset -6px -6px 12px rgba(0,0,0,0.06), 8px 8px 16px rgba(0,0,0,0.08)'
        : undefined,
    overflow: isScreen ? 'hidden' : 'visible',
    zIndex: isScreen ? 2 : 1,
  };

  const elClass = '';

  // Per-element sheen strip (only for non-screen, non-sticker parts)
  const SheenStrip = () => {
    if (!isSpecial || isScreen || isSticker || isGroup || !special?.sheenColor) return null;
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none', zIndex: 3 }}>
        <div className={special.sheenClass} style={{ position: 'absolute', top: '-50%', left: '-75%', width: '60%', height: '200%', background: special.sheenColor, transform: 'skewX(-15deg)' }} />
      </div>
    );
  };

  const renderScreenContent = (type: string, w: number, h: number) => {
    if (type === 'face') {
      return (
        <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'15%' }}>
          <div style={{ width:'22%', aspectRatio:'1', borderRadius:'50%', background:'#8be9fd', boxShadow:'0 0 14px #8be9fd, inset 0 0 8px white' }} />
          <div style={{ width:'22%', aspectRatio:'1', borderRadius:'50%', background:'#8be9fd', boxShadow:'0 0 14px #8be9fd, inset 0 0 8px white' }} />
        </div>
      );
    }
    if (type === 'chest') {
      const fs = Math.round(w * 0.14);
      return (
        <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: Math.round(h * 0.06) }}>
          <span style={{ fontSize: fs, fontWeight:700, color:'#8be9fd', letterSpacing:'0.05em' }}>LVL 5</span>
          <div style={{ width:'75%', height: Math.max(3, Math.round(h * 0.04)), background:'#1f2937', borderRadius:9999, overflow:'hidden' }}>
            <div style={{ width:'66%', height:'100%', background:'linear-gradient(90deg,#60a5fa,#a855f7)', borderRadius:9999 }} />
          </div>
        </div>
      );
    }
    return null;
  };

  const renderChildEl = (c: BotEl, ci: number) => {
    const cIsScreen  = c.type === 'face' || c.type === 'chest';
    const cIsCircle  = c.type === 'circle';
    const cIsSticker = ['apple','smiley','heart','thumbsup','lips'].includes(c.type);
    return (
      <div key={ci} style={{
        position: 'absolute',
        left: '50%', top: '50%',
        width: c.w, height: c.h,
        marginLeft: c.cx, marginTop: c.cy,
        transform: `translate(-50%,-50%) rotate(${c.rotation}deg) scaleX(${c.flipX?-1:1}) scaleY(${c.flipY?-1:1})`,
        backgroundColor: cIsSticker ? 'transparent' : (c.color || el.color),
        borderRadius: cIsCircle ? '50%' : (typeof c.rx === 'number' ? c.rx : 0),
        overflow: cIsScreen ? 'hidden' : 'visible',
        zIndex: cIsScreen ? 2 : 1,
        boxShadow: cIsScreen ? 'inset 0 0 14px rgba(0,0,0,0.85)' : undefined,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {cIsSticker && <span style={{ fontSize: c.w * 0.7, lineHeight:1 }}>{STICKER_MAP[c.type]}</span>}
        {cIsScreen  && renderScreenContent(c.type, c.w, c.h)}
      </div>
    );
  };

  return (
    <div key={el.id} className={elClass} style={containerStyle}>
      <SheenStrip />
      {isGroup   && (el.children ?? []).map((c, ci) => renderChildEl(c, ci))}
      {isSticker && <span style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize: el.w * 0.7, lineHeight:1 }}>{STICKER_MAP[el.type]}</span>}
      {isScreen  && renderScreenContent(el.type, el.w, el.h)}
    </div>
  );
}

function SavedBotAvatar({ facePixels, faceColorPalettes, robotColor }: { facePixels: string[] | null; faceColorPalettes: typeof FACE_COLOR_PALETTES; robotColor: ColorTheme }) {
  const [botElements, setBotElements] = useState<BotEl[] | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('savedBot');
    if (raw) { try { setBotElements(JSON.parse(raw)); } catch { setBotElements(null); } }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'savedBot') {
        if (e.newValue) { try { setBotElements(JSON.parse(e.newValue)); } catch { setBotElements(null); } }
        else setBotElements(null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!botElements) return null;

  // The default bot colour used in BuildABotPage
  const BOT_DEFAULT_COLOR = '#d6edb9';
  const bodyBg = (robotColor as any).gradient
    ? (robotColor as any).gradient
    : `linear-gradient(145deg,${robotColor.light},${robotColor.mid})`;

  const isGold        = robotColor.label === '✨ Gold';
  const isSilver      = robotColor.label === '✨ Silver';
  const isRainbow     = !!(robotColor as any).rainbow;
  const isBlackChrome = !!(robotColor as any).blackChrome;

  // Remap any element still using the default build colour to the current theme colour.
  const remapColor = (c: string): string => c === BOT_DEFAULT_COLOR ? robotColor.mid : c;

  const themedElements = botElements.map(el => ({
    ...el,
    color: remapColor(el.color),
    children: el.children?.map(c => ({ ...c, color: remapColor(c.color) })),
  }));

  // For special themes with gradient, rects that use the theme colour should show the gradient
  const themedElementsWithGradient = isRainbow || isBlackChrome
    ? themedElements.map(el => ({
        ...el,
        _bodyBg: el.color === robotColor.mid ? bodyBg : undefined,
        children: el.children?.map(c => ({
          ...c,
          _bodyBg: c.color === robotColor.mid ? bodyBg : undefined,
        })),
      }))
    : themedElements;

  // Compute the actual bounding box of this specific bot
  const bounds = getBotBounds(themedElementsWithGradient);
  // Scale so the bot fills the container while preserving aspect ratio (fit, not fill)
  const scale = Math.min(CONTAINER_W / bounds.w, CONTAINER_H / bounds.h);
  const displayW = bounds.w * scale;
  const displayH = bounds.h * scale;

  // Inject pixel face data into face-screen element
  const elementsWithPixels = facePixels
    ? themedElementsWithGradient.map(el => el.type === 'face' ? { ...el, _facePixels: facePixels, _palettes: faceColorPalettes } : el)
    : themedElementsWithGradient;

  // Render face screen content with pixel support (mirrors StudentPage RobotAvatar logic)
  const renderFaceContent = (el: any) => {
    const pixels: string[] | null = el._facePixels ?? null;
    const palettes: typeof FACE_COLOR_PALETTES = el._palettes ?? FACE_COLOR_PALETTES.slice(0,1);
    if (pixels) {
      return (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(20, 1fr)', gap:0, width:'85%', height:'85%' }}>
          {pixels.map((c: string, i: number) => {
            const paletteIdx = c.startsWith('on') ? (parseInt(c.replace('on','') || '0') || 0) : -1;
            const pal = paletteIdx >= 0 ? (palettes[paletteIdx] || palettes[0]) : null;
            return <div key={i} style={{ background: pal ? pal.on : 'transparent', boxShadow: pal ? `0 0 2px ${pal.glow}` : 'none' }} />;
          })}
        </div>
      );
    }
    return (
      <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'15%' }}>
        <div style={{ width:'22%', aspectRatio:'1', borderRadius:'50%', background:'#8be9fd', boxShadow:'0 0 14px #8be9fd, inset 0 0 8px white' }} />
        <div style={{ width:'22%', aspectRatio:'1', borderRadius:'50%', background:'#8be9fd', boxShadow:'0 0 14px #8be9fd, inset 0 0 8px white' }} />
      </div>
    );
  };

  const isSpecialBot  = isGold || isSilver || isRainbow || isBlackChrome;
  const sheenClass    = isRainbow ? 'sheen-chrome' : isBlackChrome ? 'sheen-black-chrome' : isGold ? 'sheen-gold' : 'sheen-silver';
  const sheenColor    = isRainbow
    ? 'linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.6) 50%,transparent 70%)'
    : isBlackChrome
      ? 'linear-gradient(105deg,transparent 25%,rgba(180,140,255,0.5) 45%,rgba(255,255,255,0.35) 50%,rgba(140,100,255,0.4) 55%,transparent 75%)'
      : isGold
        ? 'linear-gradient(105deg,transparent 30%,rgba(255,250,200,0.65) 50%,transparent 70%)'
        : 'linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.6) 50%,transparent 70%)';
  const botAnimClass  = isRainbow ? ' bot-rainbow' : isBlackChrome ? ' bot-black-chrome' : isGold ? ' bot-gold' : isSilver ? ' bot-silver' : '';

  const special: BotElSpecial | undefined = isSpecialBot
    ? { isRainbow, isBlackChrome, isGold, isSilver, sheenClass, sheenColor }
    : undefined;

  return (
    <div style={{ position: 'relative', width: CONTAINER_W, flexShrink: 0 }}>
      <style>{`
        @keyframes savedBotBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes sheenSweep     { 0% { left:-75%; } 100% { left:130%; } }
        @keyframes sheenSweepSlow { 0% { left:-75%; } 100% { left:130%; } }
        @keyframes sheenBCSweep   { 0% { left:-75%; } 100% { left:130%; } }
        @keyframes goldPulse      { 0%,100% { filter:brightness(1) saturate(1); } 50% { filter:brightness(1.15) saturate(1.3); } }
        @keyframes silverPulse    { 0%,100% { filter:brightness(1) saturate(0.9); } 50% { filter:brightness(1.2) saturate(1.1); } }
        @keyframes bcPulse        { 0%,100% { filter:brightness(1) saturate(1.6); } 50% { filter:brightness(1.1) saturate(2.2); } }
        @keyframes rainbowPulse   { 0%,100% { filter:brightness(1.05) saturate(1.2); } 50% { filter:brightness(1.2) saturate(1.5); } }
        .saved-bot-body     { animation: savedBotBounce 3s ease-in-out infinite; }
        .sheen-gold         { animation: sheenSweep 2.4s ease-in-out infinite; }
        .sheen-silver       { animation: sheenSweepSlow 3s ease-in-out infinite; }
        .sheen-chrome       { animation: sheenSweep 1.6s ease-in-out infinite; }
        .sheen-black-chrome { animation: sheenBCSweep 2s ease-in-out infinite; }
        .bot-gold           { animation: savedBotBounce 3s ease-in-out infinite, goldPulse 2.4s ease-in-out infinite; }
        .bot-silver         { animation: savedBotBounce 3s ease-in-out infinite, silverPulse 3s ease-in-out infinite; }
        .bot-rainbow        { animation: savedBotBounce 3s ease-in-out infinite, rainbowPulse 3s ease-in-out infinite; }
        .bot-black-chrome   { animation: savedBotBounce 3s ease-in-out infinite, bcPulse 5s ease-in-out infinite; }
      `}</style>
      {/* Outer container — no overflow:hidden so nothing gets clipped */}
      <div style={{ width: CONTAINER_W, height: CONTAINER_H, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className={`saved-bot-body${botAnimClass}`} style={{ position: 'relative', width: displayW, height: displayH }}>
          {/* The full 800×850 canvas, scaled and offset so the bot's bounding box
              aligns with the top-left of our display area */}
          <div style={{
            position: 'absolute',
            width: 800,
            height: 850,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            // Shift so bounds.minX/minY lands at 0,0 in display space
            left: -bounds.minX * scale,
            top:  -bounds.minY * scale,
          }}>
            {elementsWithPixels.map((el: any) => {
              if (el.type === 'face') {
                const containerStyle: React.CSSProperties = {
                  position: 'absolute',
                  left: el.cx, top: el.cy,
                  width: el.w, height: el.h,
                  transform: `translate(-50%,-50%) rotate(${el.rotation}deg)`,
                  borderRadius: typeof el.rx === 'number' ? el.rx : 0,
                  backgroundColor: el.color,
                  boxShadow: 'inset 0 0 14px rgba(0,0,0,0.85)',
                  overflow: 'hidden',
                  zIndex: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                };
                return <div key={el.id} style={containerStyle}>{renderFaceContent(el)}</div>;
              }
              return renderBotEl(el, special);
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Robot avatar
───────────────────────────────────────────── */

function RobotAvatar({ level, xp, xpMax, color, facePixels, faceColorPalettes }: { level: number; xp: number; xpMax: number; color: ColorTheme; facePixels: string[] | null; faceColorPalettes?: typeof FACE_COLOR_PALETTES }) {
  const { light, mid, dark, glow, label } = color;
  const isRainbow     = !!(color as any).rainbow;
  const isBlackChrome = !!(color as any).blackChrome;
  const isGold        = color.label === '✨ Gold';
  const isSilver      = color.label === '✨ Silver';
  const isSpecial     = isGold || isSilver || isRainbow || isBlackChrome;
  const bodyBg = (color as any).gradient
    ? (color as any).gradient
    : `linear-gradient(145deg,${light},${mid})`;
  const palettes = faceColorPalettes || FACE_COLOR_PALETTES.slice(0, 1);

  // All specials use whole-wrapper animation — same approach as gold, no per-element bg overrides
  const bodyAnimClass = isRainbow ? ' bot-rainbow' : isBlackChrome ? ' bot-black-chrome' : isGold ? ' bot-gold' : isSilver ? ' bot-silver' : '';

  // Sheen overlay: sweeping highlight band
  const Sheen = ({ rounded = 8 }: { rounded?: number }) => {
    if (!isSpecial) return null;
    const sheenClass = isRainbow ? 'sheen-chrome' : isBlackChrome ? 'sheen-black-chrome' : isGold ? 'sheen-gold' : 'sheen-silver';
    const sheenColor = isRainbow
      ? 'linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.6) 50%,transparent 70%)'
      : isBlackChrome
        ? 'linear-gradient(105deg,transparent 25%,rgba(180,140,255,0.5) 45%,rgba(255,255,255,0.35) 50%,rgba(140,100,255,0.4) 55%,transparent 75%)'
        : isGold
          ? 'linear-gradient(105deg,transparent 30%,rgba(255,250,200,0.7) 50%,transparent 70%)'
          : 'linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.65) 50%,transparent 70%)';
    return (
      <div style={{ position: 'absolute', inset: 0, borderRadius: rounded, overflow: 'hidden', pointerEvents: 'none', zIndex: 3 }}>
        <div className={sheenClass} style={{ position: 'absolute', top: '-50%', left: '-75%', width: '60%', height: '200%', background: sheenColor, transform: 'skewX(-15deg)' }} />
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', width: 180, flexShrink: 0 }}>
      <style>{`
        @keyframes robotBounce {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes eyeBlink {
          0%,90%,100% { transform: scaleY(1); }
          95%          { transform: scaleY(0.08); }
        }
        @keyframes sheenSweep     { 0% { left:-75%; } 100% { left:130%; } }
        @keyframes sheenSweepSlow { 0% { left:-75%; } 100% { left:130%; } }
        @keyframes sheenBCSweep   { 0% { left:-75%; } 100% { left:130%; } }
        @keyframes goldPulse      { 0%,100% { filter:brightness(1) saturate(1); } 50% { filter:brightness(1.15) saturate(1.3); } }
        @keyframes silverPulse    { 0%,100% { filter:brightness(1) saturate(0.9); } 50% { filter:brightness(1.2) saturate(1.1); } }
        @keyframes bcPulse        { 0%,100% { filter:brightness(1) saturate(1.6); } 50% { filter:brightness(1.1) saturate(2.2); } }
        @keyframes rainbowPulse   { 0%,100% { filter:brightness(1.05) saturate(1.2); } 50% { filter:brightness(1.2) saturate(1.5); } }
        .robot-body         { animation: robotBounce 3s ease-in-out infinite; }
        .robot-eye          { animation: eyeBlink 4s ease-in-out infinite; }
        .sheen-gold         { animation: sheenSweep 2.4s ease-in-out infinite; }
        .sheen-silver       { animation: sheenSweepSlow 3s ease-in-out infinite; }
        .sheen-chrome       { animation: sheenSweep 1.6s ease-in-out infinite; }
        .sheen-black-chrome { animation: sheenBCSweep 2s ease-in-out infinite; }
        .bot-gold           { animation: robotBounce 3s ease-in-out infinite, goldPulse 2.4s ease-in-out infinite; }
        .bot-silver         { animation: robotBounce 3s ease-in-out infinite, silverPulse 3s ease-in-out infinite; }
        .bot-rainbow        { animation: robotBounce 3s ease-in-out infinite, rainbowPulse 3s ease-in-out infinite; }
        .bot-black-chrome   { animation: robotBounce 3s ease-in-out infinite, bcPulse 5s ease-in-out infinite; }
      `}</style>

      <div className={`robot-body${bodyAnimClass}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        {/* Antenna */}
        <div style={{ width: 3, height: 22, background: `linear-gradient(180deg,${mid},${dark})`, borderRadius: 4, marginBottom: -4, position: 'relative', overflow: 'hidden' }}>
          <Sheen rounded={4} />
        </div>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: dark, boxShadow: `0 0 10px ${dark}` }} />

        {/* Head */}
        <div style={{ width: 120, height: 90, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: bodyBg, borderRadius: 24, boxShadow: `0 8px 24px ${glow}, inset 0 2px 4px rgba(255,255,255,0.6)`, overflow: 'hidden' }}>
            <Sheen rounded={24} />
          </div>
          <div style={{ width: 80, height: 52, background: '#0d1117', borderRadius: 12, overflow: 'hidden', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 4, isolation: 'isolate' }}>
            {facePixels ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 0, width: 70, height: 44 }}>
                {facePixels.map((c, i) => {
                  const paletteIdx = c.startsWith('on') ? (parseInt(c.replace('on','') || '0') || 0) : -1;
                  const pal = paletteIdx >= 0 ? (palettes[paletteIdx] || palettes[0]) : null;
                  return <div key={i} style={{ background: pal ? pal.on : '#0d1117', boxShadow: pal ? `0 0 2px ${pal.glow}` : 'none' }} />;
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, width: '100%', height: '100%' }}>
                {[0, 1].map(i => (
                  <div key={i} className="robot-eye" style={{ width: 18, height: 22, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #c8f0ff, #6dd5fa)', boxShadow: '0 0 12px rgba(100,210,255,0.7)', transformOrigin: 'center' }} />
                ))}
              </div>
            )}
          </div>
          {[-1, 1].map(s => (
            <div key={s} style={{ position: 'absolute', top: '50%', [s === -1 ? 'left' : 'right']: -8, transform: 'translateY(-50%)', width: 10, height: 28, background: `linear-gradient(145deg,${mid},${dark})`, borderRadius: 6, overflow: 'hidden' }}>
              <Sheen rounded={6} />
            </div>
          ))}
        </div>

        {/* Neck */}
        <div style={{ width: 28, height: 12, background: `linear-gradient(180deg,${mid},${dark})`, borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
          <Sheen rounded={6} />
        </div>

        {/* Body */}
        <div style={{ width: 130, height: 110, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ position: 'absolute', inset: 0, background: bodyBg, borderRadius: 28, boxShadow: `0 10px 30px ${glow}, inset 0 2px 4px rgba(255,255,255,0.6)`, overflow: 'hidden' }}>
            <Sheen rounded={28} />
          </div>
          {[-1, 1].map(s => (
            <div key={s} style={{ position: 'absolute', top: 20, [s === -1 ? 'left' : 'right']: -14, width: 18, height: 60, background: `linear-gradient(180deg,${mid},${dark})`, borderRadius: 12, overflow: 'hidden' }}>
              <Sheen rounded={12} />
            </div>
          ))}
          <div style={{ width: 88, height: 58, background: '#0d1117', borderRadius: 14, boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative', zIndex: 4, isolation: 'isolate' }}>
            <span style={{ color: '#a8e6ff', fontSize: '0.75rem', fontWeight: 800, letterSpacing: 1 }}>LVL {level}</span>
            <span style={{ color: 'rgba(168,230,255,0.6)', fontSize: '0.6rem' }}>{xp} XP</span>
            <div style={{ width: 60, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (xp / xpMax) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#64b5f6,#ab47bc)', borderRadius: 10 }} />
            </div>
          </div>
        </div>

        {/* Legs */}
        <div style={{ display: 'flex', gap: 16 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ width: 32, height: 38, background: `linear-gradient(180deg,${mid},${dark})`, borderRadius: '12px 12px 16px 16px', boxShadow: `0 4px 12px ${glow}`, position: 'relative', overflow: 'hidden' }}>
              <Sheen rounded={12} />
            </div>
          ))}
        </div>
      </div>

      {/* Color label badge */}
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <span style={{ fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.1em', color: dark, textTransform: 'uppercase', opacity: 0.8, transition: 'color 0.6s ease' }}>{label}</span>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────
   Pixel face editor (20×14 grid)
───────────────────────────────────────────── */
const GRID_COLS = 20;
const GRID_ROWS = 14;
const EMPTY_GRID = () => Array(GRID_COLS * GRID_ROWS).fill('off');

function PixelEditor({ faceColorPalettes, onSend, onReset }: {
  faceColorPalettes: typeof FACE_COLOR_PALETTES;
  onSend: (pixels: string[]) => void;
  onReset: () => void;
}) {
  const [grid, setGrid] = useState<string[]>(EMPTY_GRID);
  const [selectedPaletteIdx, setSelectedPaletteIdx] = useState(0);
  const lastTap = useRef<{ idx: number; time: number } | null>(null);
  const activePal = faceColorPalettes[selectedPaletteIdx] || faceColorPalettes[0];
  const waveColor = activePal.on;

  const colorPixel = (i: number) => {
    setGrid(g => { const n = [...g]; n[i] = `on${selectedPaletteIdx}`; return n; });
  };
  const erasePixel = (i: number) => {
    setGrid(g => { const n = [...g]; n[i] = 'off'; return n; });
  };
  const handleClick = (i: number) => { colorPixel(i); };
  const handleDoubleClick = (i: number) => { erasePixel(i); };
  const handleTouchEnd = (e: React.TouchEvent, i: number) => {
    e.preventDefault();
    const now = Date.now();
    if (lastTap.current && lastTap.current.idx === i && now - lastTap.current.time < 350) {
      erasePixel(i); lastTap.current = null;
    } else {
      colorPixel(i); lastTap.current = { idx: i, time: now };
    }
  };
  const clearGrid = () => setGrid(EMPTY_GRID());

  const getCellColor = (cell: string) => {
    if (cell === 'off') return 'rgba(255,255,255,0.04)';
    const idx = parseInt(cell.replace('on','') || '0') || 0;
    return (faceColorPalettes[idx] || faceColorPalettes[0]).on;
  };
  const getCellGlow = (cell: string) => {
    if (cell === 'off') return 'none';
    const idx = parseInt(cell.replace('on','') || '0') || 0;
    return `0 0 3px ${(faceColorPalettes[idx] || faceColorPalettes[0]).on}88`;
  };

  return (
    <div style={{ marginTop: 12, background: 'linear-gradient(145deg,rgba(255,255,255,0.85),rgba(252,240,255,0.9))', borderRadius: 20, padding: '14px 16px', border: '1.5px solid rgba(255,255,255,0.8)', boxShadow: '0 4px 16px rgba(180,120,220,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', color: '#9090c0', textTransform: 'uppercase' }}>
          Draw your face
        </span>
        <span style={{ fontSize: '0.55rem', color: '#b0b8cc', fontStyle: 'italic' }}>
          tap = draw · double-tap = erase
        </span>
      </div>

      {/* Color palette selector */}
      {faceColorPalettes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.55rem', color: '#b0b8cc', fontWeight: 600 }}>Color:</span>
          {faceColorPalettes.map((pal, idx) => (
            <button key={idx} onClick={() => setSelectedPaletteIdx(idx)} style={{ width: 20, height: 20, borderRadius: '50%', background: pal.on, border: selectedPaletteIdx === idx ? '2px solid #3040a0' : '2px solid transparent', cursor: 'pointer', padding: 0, boxShadow: selectedPaletteIdx === idx ? `0 0 6px ${pal.glow}` : 'none', transition: 'all 0.2s' }} title={pal.label} />
          ))}
        </div>
      )}

      {/* Pixel grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gap: 1.5, background: '#0d1117', borderRadius: 10, padding: 7, userSelect: 'none', touchAction: 'none', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)' }}>
        {grid.map((cell, i) => (
          <div key={i} onClick={() => handleClick(i)} onDoubleClick={() => handleDoubleClick(i)} onTouchEnd={(e) => handleTouchEnd(e, i)}
            style={{ width: '100%', aspectRatio: '1', borderRadius: 1, background: getCellColor(cell), border: cell === 'off' ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'crosshair', transition: 'background 0.06s', boxShadow: getCellGlow(cell) }}
          />
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={clearGrid} style={{ flex: 1, padding: '6px 0', fontSize: '0.65rem', fontWeight: 700, background: 'rgba(180,160,220,0.1)', border: '1px solid rgba(180,160,220,0.25)', borderRadius: 10, color: '#9090c0', cursor: 'pointer', letterSpacing: '0.06em' }}>Clear</button>
        <button onClick={onReset} style={{ flex: 1, padding: '6px 0', fontSize: '0.65rem', fontWeight: 700, background: 'rgba(100,180,255,0.1)', border: '1px solid rgba(100,180,255,0.25)', borderRadius: 10, color: '#6090c0', cursor: 'pointer', letterSpacing: '0.06em' }}>Reset eyes</button>
        <button onClick={() => onSend([...grid])} style={{ flex: 1, padding: '6px 0', fontSize: '0.65rem', fontWeight: 800, background: `${waveColor}22`, border: `1px solid ${waveColor}66`, borderRadius: 10, color: waveColor, cursor: 'pointer', letterSpacing: '0.06em', transition: 'background 0.2s' }}>Send ✦</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Signal Panel (center hero)
───────────────────────────────────────────── */
function SignalPanel({ knob, onKnobChange, colorThemes }: { knob: number; onKnobChange: (v: number) => void; colorThemes: ColorTheme[] }) {
  const theme = colorThemes[knob % colorThemes.length];
  // 4 positions evenly spaced around the dial: -135°, -45°, 45°, 135°
  const knobAngle = -135 + (knob % colorThemes.length) * (270 / Math.max(1, colorThemes.length - 1));

  const handleClick = () => {
    onKnobChange((knob + 1) % colorThemes.length);
  };

  return (
    <div style={{ flex: 1, background: 'linear-gradient(145deg,rgba(255,255,255,0.85),rgba(252,240,245,0.9))', borderRadius: 28, padding: '20px 24px', boxShadow: '0 8px 32px rgba(220,140,180,0.12), inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -2px 8px rgba(200,150,180,0.08)', backdropFilter: 'blur(8px)', border: '1.5px solid rgba(255,255,255,0.8)' }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: theme.wave, boxShadow: `0 0 8px ${theme.wave}`, transition: 'background 0.3s, box-shadow 0.3s' }} />
        <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.18em', color: '#8090b0', textTransform: 'uppercase' }}>ClassCard Signal</span>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: theme.wave, boxShadow: `0 0 8px ${theme.wave}`, transition: 'background 0.3s, box-shadow 0.3s' }} />
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        {/* Waveform screen */}
        <div style={{ flex: 1, height: 120, background: '#0a0e1a', borderRadius: 16, overflow: 'hidden', boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.6), 0 2px 8px rgba(100,80,140,0.15)', border: '1px solid rgba(80,60,100,0.3)' }}>
          <Waveform colorIndex={knob % colorThemes.length} colorThemes={colorThemes} />
        </div>

        {/* Knob — click to cycle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div
            onClick={handleClick}
            style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(145deg,#fff,#e8eef8)', boxShadow: '4px 4px 12px rgba(180,190,220,0.5), -3px -3px 8px rgba(255,255,255,0.9), inset 0 1px 3px rgba(255,255,255,0.8)', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', border: `2px solid ${theme.wave}44`, transition: 'border-color 0.3s, box-shadow 0.3s' }}
          >
            {/* Knob ring */}
            <div style={{ width: 68, height: 68, borderRadius: '50%', border: `2px solid ${theme.wave}55`, position: 'absolute', transition: 'border-color 0.3s' }} />
            {/* Indicator dot — snaps to one of 4 positions */}
            <div style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: theme.wave, top: 8, left: '50%', marginLeft: -4, transform: `rotate(${knobAngle}deg)`, transformOrigin: '4px 32px', boxShadow: `0 0 6px ${theme.wave}`, transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), background 0.3s, box-shadow 0.3s' }} />
            {/* Color count indicator */}
            <div style={{ position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)', fontSize: '0.5rem', color: '#b0b8d0', whiteSpace: 'nowrap' }}>{colorThemes.length} colors</div>
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', color: theme.dark, textTransform: 'uppercase', transition: 'color 0.3s' }}>{theme.label}</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Stats panel
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   Level Up Unlock Modal
───────────────────────────────────────────── */
type UnlockChoice = 'color' | 'face' | 'buildabot';

interface LevelUpModalProps {
  level: number;
  unlockedChoices: string[];
  onChoose: (choice: UnlockChoice) => void;
}

function LevelUpModal({ level, unlockedChoices, onChoose }: LevelUpModalProps) {
  const unlockedColorCount = 4 + countUnlockedColors(unlockedChoices);
  const unlockedFaceColorCount = 1 + countUnlockedFaceColors(unlockedChoices);
  const canUnlockMoreColors = unlockedColorCount < EXTRA_COLOR_THEMES.length + 4;
  const canUnlockMoreFace = unlockedFaceColorCount < FACE_COLOR_PALETTES.length;

  const nextColorLabel = () => {
    const next = unlockedColorCount;
    if (next >= 10) return '🖤 Black Chrome';
    if (next >= 8) return '✨ Shiny Gold & Silver';
    if (next >= 6) return 'Tangerine & Crimson';
    return 'Grape & Ocean';
  };
  const nextFaceLabel = () => {
    const labels = ['Yellow', 'Green', 'Pink'];
    return labels[unlockedFaceColorCount - 1] || 'another color';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'linear-gradient(145deg,#1a1040,#2d1b69)', borderRadius: 28, padding: '32px 28px', maxWidth: 380, width: '90%', boxShadow: '0 24px 80px rgba(100,60,220,0.5)', border: '1.5px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎉</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginBottom: 4 }}>Level {level}!</div>
        <div style={{ fontSize: '0.8rem', color: 'rgba(200,180,255,0.8)', marginBottom: 24, fontWeight: 600 }}>Choose your unlock reward</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Color unlock */}
          <button
            onClick={() => canUnlockMoreColors && onChoose('color')}
            disabled={!canUnlockMoreColors}
            style={{ padding: '16px 20px', borderRadius: 16, border: '1.5px solid rgba(255,255,255,0.15)', background: canUnlockMoreColors ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', cursor: canUnlockMoreColors ? 'pointer' : 'not-allowed', textAlign: 'left', transition: 'all 0.2s', opacity: canUnlockMoreColors ? 1 : 0.4 }}
            onMouseEnter={e => { if (canUnlockMoreColors) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = canUnlockMoreColors ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: '1.8rem' }}>🎨</div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', marginBottom: 2 }}>+2 Robot Colors</div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(200,180,255,0.7)' }}>{canUnlockMoreColors ? `Unlocks: ${nextColorLabel()}` : 'All colors unlocked!'}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {Array.from({ length: Math.min(unlockedColorCount + 2, EXTRA_COLOR_THEMES.length + 4) }).map((_, i) => {
                    const all = [...BASE_COLOR_THEMES, ...EXTRA_COLOR_THEMES];
                    return <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: all[i % all.length].wave, border: i >= unlockedColorCount ? '1.5px dashed rgba(255,255,255,0.4)' : 'none', opacity: i >= unlockedColorCount ? 0.4 : 1 }} />;
                  })}
                </div>
              </div>
            </div>
          </button>

          {/* Face color unlock */}
          <button
            onClick={() => canUnlockMoreFace && onChoose('face')}
            disabled={!canUnlockMoreFace}
            style={{ padding: '16px 20px', borderRadius: 16, border: '1.5px solid rgba(255,255,255,0.15)', background: canUnlockMoreFace ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', cursor: canUnlockMoreFace ? 'pointer' : 'not-allowed', textAlign: 'left', transition: 'all 0.2s', opacity: canUnlockMoreFace ? 1 : 0.4 }}
            onMouseEnter={e => { if (canUnlockMoreFace) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = canUnlockMoreFace ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: '1.8rem' }}>👁️</div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', marginBottom: 2 }}>+1 Face Pixel Color</div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(200,180,255,0.7)' }}>{canUnlockMoreFace ? `Unlocks: ${nextFaceLabel()} pixels` : 'All face colors unlocked!'}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {FACE_COLOR_PALETTES.map((pal, i) => (
                    <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: pal.on, border: i >= unlockedFaceColorCount ? '1.5px dashed rgba(255,255,255,0.4)' : 'none', opacity: i >= unlockedFaceColorCount ? 0.4 : 1 }} />
                  ))}
                </div>
              </div>
            </div>
          </button>

          {/* Build-a-Bot unlock */}
          {(() => {
            const alreadyUnlocked = unlockedChoices.includes('buildabot');
            return (
              <button
                onClick={() => !alreadyUnlocked && onChoose('buildabot')}
                disabled={alreadyUnlocked}
                style={{ padding: '16px 20px', borderRadius: 16, border: '1.5px solid rgba(255,255,255,0.15)', background: alreadyUnlocked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)', cursor: alreadyUnlocked ? 'not-allowed' : 'pointer', textAlign: 'left', transition: 'all 0.2s', opacity: alreadyUnlocked ? 0.4 : 1, width: '100%' }}
                onMouseEnter={e => { if (!alreadyUnlocked) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = alreadyUnlocked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', marginBottom: 2 }}>🤖 Build-a-Bot</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(200,180,255,0.7)' }}>{alreadyUnlocked ? 'Already unlocked!' : 'Unlocks: Build & save your own bot'}</div>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(180,160,255,0.55)', marginTop: 4 }}>Design a custom robot and save it to your profile</div>
                  </div>
                  <span style={{ fontSize: '1.4rem', marginLeft: 8 }}>🤖</span>
                </div>
              </button>
            );
          })()}
        </div>

        {(!canUnlockMoreColors && !canUnlockMoreFace && unlockedChoices.includes('buildabot')) && (
          <button onClick={() => onChoose('color')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.75rem' }}>
            Close (all unlocked!)
          </button>
        )}
      </div>
    </div>
  );
}

function StatsPanel({ total, medals, scoreboard, weekEnd, onSignOut, studentName, studentId }: {
  total: number;
  medals: { gold: number; silver: number; bronze: number };
  scoreboard: { student_id: string; name: string; wins: number }[];
  weekEnd: string;
  onSignOut: () => void;
  studentName: string;
  studentId: string;
}) {
  const MEDAL_STYLES = [
    { bg: 'linear-gradient(135deg,#ffd700,#ffb700)', shadow: 'rgba(255,200,0,0.4)', label: '🥇', text: '#7a5c00' },
    { bg: 'linear-gradient(135deg,#c0c0c0,#a0a0a0)', shadow: 'rgba(160,160,160,0.4)', label: '🥈', text: '#505050' },
    { bg: 'linear-gradient(135deg,#cd7f32,#a05a20)', shadow: 'rgba(160,90,30,0.4)', label: '🥉', text: '#5a2800' },
  ];

  return (
    <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* User badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.7)', borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 4px 12px rgba(200,160,200,0.1)', backdropFilter: 'blur(8px)', overflow: 'hidden' }}>
        {/* Name area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', flex: 1, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#fce4ec,#e8eaf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', boxShadow: '0 2px 8px rgba(200,140,180,0.2)', flexShrink: 0 }}>🤖</div>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', color: '#5060a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{studentName.toUpperCase()}</span>
        </div>
        {/* Sign out — square, same height as badge */}
        <button
          onClick={onSignOut}
          title="Sign out"
          style={{ width: 52, alignSelf: 'stretch', flexShrink: 0, background: 'rgba(220,180,220,0.15)', border: 'none', borderLeft: '1.5px solid rgba(200,160,220,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#9090c0', transition: 'background 0.2s, color 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(240,100,120,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#e05070'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,180,220,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = '#9090c0'; }}
        >
          ⏻
        </button>
      </div>

      {/* Stats card */}
      <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 24, padding: '18px 16px', border: '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 8px 24px rgba(200,160,220,0.1)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Total cards */}
        <div>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', color: '#a0a8c8', textTransform: 'uppercase', marginBottom: 3 }}>TOTAL CARDS</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#3040a0', lineHeight: 1 }}>{total}</div>
        </div>

        {/* Arena medals */}
        <div>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', color: '#a0a8c8', textTransform: 'uppercase', marginBottom: 8 }}>ARENA MEDALS</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[medals.gold, medals.silver, medals.bronze].map((count, i) => (
              <div key={i} style={{ flex: 1, borderRadius: 14, padding: '8px 4px', background: count > 0 ? MEDAL_STYLES[i].bg : 'rgba(200,200,220,0.15)', boxShadow: count > 0 ? `0 4px 12px ${MEDAL_STYLES[i].shadow}` : 'none', textAlign: 'center', transition: 'all 0.3s', opacity: count > 0 ? 1 : 0.4 }}>
                <div style={{ fontSize: '1rem' }}>{MEDAL_STYLES[i].label}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: count > 0 ? MEDAL_STYLES[i].text : '#a0a8c8', lineHeight: 1.1 }}>{count}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.52rem', color: '#b0b8d0', marginTop: 6, textAlign: 'center', letterSpacing: '0.05em' }}>all-time finishes</div>
        </div>
      </div>

      {/* Battle button */}
      <div
        onClick={() => { window.location.hash = '/arena'; }}
        style={{ cursor: 'pointer' }}
      >
        <div
          style={{ background: 'linear-gradient(135deg,#f06292,#ab47bc,#64b5f6)', borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 6px 20px rgba(180,80,180,0.3)', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 28px rgba(180,80,180,0.5)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(180,80,180,0.3)'; }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.1em', color: '#fff', textTransform: 'uppercase' }}>Battle Arena</span>
          <span style={{ fontSize: '1rem' }}>⚔️</span>
        </div>
      </div>

      {/* Weekly scoreboard */}
      <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 20, padding: '14px 14px', border: '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 4px 16px rgba(200,160,220,0.08)', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.13em', color: '#7060b0', textTransform: 'uppercase' }}>🏆 This Week</span>
          <span style={{ fontSize: '0.52rem', color: '#b0b8d0', letterSpacing: '0.04em' }}>ends {weekEnd}</span>
        </div>
        {scoreboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#c0c8e0', fontSize: '0.68rem' }}>No battles yet!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {scoreboard.map((entry, i) => {
              const isMe = entry.student_id === studentId;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
              return (
                <div key={entry.student_id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 10, background: isMe ? 'rgba(100,120,220,0.12)' : 'rgba(255,255,255,0.5)', border: isMe ? '1px solid rgba(100,120,220,0.3)' : '1px solid transparent', transition: 'all 0.2s' }}>
                  <span style={{ fontSize: '0.8rem', flexShrink: 0, minWidth: 20 }}>{medal}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: isMe ? 800 : 600, color: isMe ? '#3040a0' : '#6070a0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#6070a0', flexShrink: 0 }}>{entry.wins}W</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(200,200,220,0.3)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.52rem', color: '#c0c8e0', letterSpacing: '0.08em' }}>RESETS MONDAY · 1 BATTLE / OPPONENT</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Card item in carousel
───────────────────────────────────────────── */
function CardItem({ card, onClick, index, fanAngle, radius, containerCx, containerBottom }: { 
  card: Card; 
  onClick: () => void;
  index: number;
  fanAngle: number;   // this card's angle in degrees from vertical (negative = left, positive = right)
  radius: number;     // distance from pivot to card centre (px)
  containerCx: number; // x of pivot in container coords
  containerBottom: number; // y of pivot in container coords (below the container base)
}) {
  const [hovered, setHovered] = useState(false);

  // ── True pivot-based fan geometry ────────────────────────────────────────
  // The pivot sits below the visible container. Each card's centre lies on a
  // circle of `radius` centred on the pivot. We compute the card's (x, y)
  // position in container coords, then rotate it by fanAngle so its face
  // always points away from the pivot — exactly like holding cards in a fan.
  //
  // angle=0 → card sits straight up at the top of the circle (centre of fan)
  // angle<0 → card is left of centre,  angle>0 → right of centre
  //
  // In SVG/CSS coords, "up" is negative Y, so:
  //   cardCx = pivotX + radius * sin(angle)
  //   cardCy = pivotY - radius * cos(angle)   (pivotY is BELOW container base)

  const angleRad = (fanAngle * Math.PI) / 180;
  const CARD_WIDTH  = 140;
  const CARD_HEIGHT = 195;

  // Card centre position in container space
  const cardCx = containerCx + radius * Math.sin(angleRad);
  // pivot is `containerBottom` px below the bottom of the container,
  // so pivotY in container coords = containerBottom (measured from top of container downward)
  const pivotY = containerBottom;
  const cardCy = pivotY - radius * Math.cos(angleRad);

  // On hover: slide the card outward along its own spoke (away from pivot) by liftPx
  const liftPx = 60;
  const liftedCx = hovered ? containerCx + (radius + liftPx) * Math.sin(angleRad) : cardCx;
  const liftedCy = hovered ? pivotY - (radius + liftPx) * Math.cos(angleRad)      : cardCy;

  // top-left corner so the card is centred on (liftedCx, liftedCy)
  const left = liftedCx - CARD_WIDTH  / 2;
  const top  = liftedCy - CARD_HEIGHT / 2;

  // ── Z-index: FIXED by index, NEVER changes ───────────────────────────────
  // Right card (higher index) always paints above left card. We do not touch
  // z-index on hover — the overlap order is permanent and transitions cannot
  // interpolate it. The hovered card may briefly appear behind its right
  // neighbours as it lifts, which is the correct real-world behaviour (you
  // slide a card out from the fan without reordering the stack).
  const zIndex = index + 1;

  // Scale the full card (260×375) down to fit the fan slot
  const FULL_CARD_W = 260;
  const FULL_CARD_H = 375;
  const scale = CARD_WIDTH / FULL_CARD_W; // ≈ 0.538

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left,
        top,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        cursor: 'pointer',
        transform: `rotate(${fanAngle}deg) scale(${hovered ? 1.12 : 1})`,
        transformOrigin: 'center center',
        transition: 'left 0.42s cubic-bezier(0.25, 0.0, 0.15, 1), top 0.42s cubic-bezier(0.25, 0.0, 0.15, 1), transform 0.42s cubic-bezier(0.25, 0.0, 0.15, 1), box-shadow 0.3s ease',
        boxShadow: hovered
          ? '0 20px 50px rgba(0,0,0,0.32), 0 0 0 3px rgba(255,255,255,0.55)'
          : '0 6px 18px rgba(0,0,0,0.18)',
        zIndex,
        overflow: 'hidden',
        borderRadius: 18 * scale,
      }}
    >
      {/* Render the real card scaled down to fit */}
      <div style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: FULL_CARD_W,
        height: FULL_CARD_H,
        pointerEvents: 'none', // clicks handled by outer div
      }}>
        {card.card_source === 'built'
          ? <BuiltCard card={card} />
          : <PokeCard card={card} />
        }
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Card Carousel
───────────────────────────────────────────── */
// @ts-ignore -- kept for future use
function CardCarousel({ cards, onCardClick }: { cards: Card[]; onCardClick: (c: Card) => void }) {
  const [page, setPage] = useState(0);
  const cardsPerPage = 12;
  const totalPages = Math.ceil(cards.length / cardsPerPage);
  const visible = cards.slice(page * cardsPerPage, page * cardsPerPage + cardsPerPage);

  // ── Fan geometry ─────────────────────────────────────────────────────────
  // The pivot is an absolutely-positioned point anchored to 50% of the
  // container width via CSS (left:'50%'). Cards are positioned relative to
  // that pivot using pure offsets, so the fan always stays centred regardless
  // of container/screen width — no JS width measurement needed.

  const CARD_HEIGHT      = 195;
  const CONTAINER_HEIGHT = 260;

  // How much of each card is visible above the container bottom (62% = nicely fanned)
  const visibleFraction  = 0.62;
  const centreCardY      = CONTAINER_HEIGHT - CARD_HEIGHT * visibleFraction;

  // Radius controls arc tightness — larger = flatter arc
  const radius           = 520;

  // pivotY below the top of the container
  const pivotY           = centreCardY + radius;

  // Total angular spread of the whole fan
  const totalSpreadDeg   = visible.length <= 1 ? 0 : Math.min(54, visible.length * 4.8);
  const angleStep        = visible.length > 1 ? totalSpreadDeg / (visible.length - 1) : 0;
  const fanAngles        = visible.map((_, i) => -totalSpreadDeg / 2 + i * angleStep);

  // pivotX is always 0 — we anchor to CSS 50% on the container (see below)
  const pivotX           = 0;
  const containerBottom  = pivotY;

  return (
    <div style={{ 
      background: 'rgba(255,255,255,0.55)', 
      borderRadius: 28, 
      padding: '20px 24px 24px', 
      border: '1.5px solid rgba(255,255,255,0.85)', 
      boxShadow: '0 4px 20px rgba(200,160,220,0.08)', 
      backdropFilter: 'blur(8px)' 
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#64b5f6', fontSize: '0.7rem' }}>✦</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', color: '#5060a0', textTransform: 'uppercase' }}>
            Your Cards {cards.length > 0 && `(${cards.length})`}
          </span>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ 
                width: 28, 
                height: 28, 
                borderRadius: '50%', 
                background: page === 0 ? 'rgba(100,120,220,0.05)' : 'rgba(100,120,220,0.1)', 
                border: '1px solid rgba(100,120,220,0.2)', 
                color: page === 0 ? '#c0c8e0' : '#6070c0', 
                fontSize: '0.7rem', 
                cursor: page === 0 ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >◀</button>
            <span style={{ fontSize: '0.65rem', color: '#8090c0', fontWeight: 700, minWidth: 40, textAlign: 'center' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{ 
                width: 28, 
                height: 28, 
                borderRadius: '50%', 
                background: page === totalPages - 1 ? 'rgba(100,120,220,0.05)' : 'rgba(100,120,220,0.1)', 
                border: '1px solid rgba(100,120,220,0.2)', 
                color: page === totalPages - 1 ? '#c0c8e0' : '#6070c0', 
                fontSize: '0.7rem', 
                cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >▶</button>
          </div>
        )}
      </div>

      {/* Card holder - true pivot fan display */}
      {cards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#a0a8c8', fontSize: '0.85rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12, opacity: 0.3 }}>🃏</div>
          No cards yet — keep up the great work!
        </div>
      ) : (
        <div style={{ 
          position: 'relative', 
          height: CONTAINER_HEIGHT,
          overflow: 'visible',
          width: '100%',
        }}>
          {/* Invisible pivot point anchored to horizontal centre via CSS */}
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 0, height: 0 }}>
            {visible.map((card, index) => (
              <CardItem 
                key={card.id} 
                card={card} 
                onClick={() => onCardClick(card)}
                index={index}
                fanAngle={fanAngles[index]}
                radius={radius}
                containerCx={pivotX}
                containerBottom={containerBottom}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pagination dots */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              style={{ 
                width: i === page ? 20 : 8, 
                height: 8, 
                borderRadius: 10, 
                background: i === page ? 'linear-gradient(90deg,#f06292,#64b5f6)' : 'rgba(160,170,210,0.35)', 
                border: 'none', 
                cursor: 'pointer', 
                transition: 'all 0.3s', 
                padding: 0 
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}


/* ─────────────────────────────────────────────
   Weekly Project banner + modal
───────────────────────────────────────────── */
type WeeklyProjectProps = { project: WeeklyProject; onClose: () => void };

function WeeklyProjectModal({ project, onClose }: WeeklyProjectProps) {
  const card = project.card_data as Card | null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(100,80,140,0.3)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'linear-gradient(145deg,rgba(255,255,255,0.97),rgba(248,240,252,0.98))', borderRadius: 32, padding: '32px', maxWidth: 740, width: '90vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(160,80,200,0.18)', border: '2px solid rgba(255,255,255,0.9)', position: 'relative' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', background: 'rgba(180,160,220,0.12)', border: 'none', fontSize: '1rem', cursor: 'pointer', color: '#9090c0' }}>✕</button>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: '1rem' }}>📋</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em', color: '#9090c0', textTransform: 'uppercase' }}>Weekly Project</span>
            {project.week_label && (
              <span style={{ fontSize: '0.6rem', color: '#b0b8d0', marginLeft: 4 }}>· {project.week_label}</span>
            )}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#3040a0', margin: 0 }}>{project.title}</h2>
        </div>

        {/* Two-column layout: task left, card right */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '55%' }} />
            <col style={{ width: '45%' }} />
          </colgroup>
          <tbody>
            <tr>
              {/* Left: task description */}
              <td style={{ verticalAlign: 'top', paddingRight: 28 }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', color: '#a0a8c8', textTransform: 'uppercase', marginBottom: 10 }}>What you need to do</div>
                <p style={{ fontSize: '0.95rem', color: '#4050a0', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{project.task}</p>

                {/* Earn card hint */}
                <div style={{ marginTop: 24, padding: '14px 18px', background: 'rgba(100,180,100,0.08)', border: '1.5px solid rgba(100,180,100,0.2)', borderRadius: 16 }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: '#4a9a60', textTransform: 'uppercase', marginBottom: 4 }}>✦ Earn a card</div>
                  <p style={{ fontSize: '0.82rem', color: '#5a7060', margin: 0, lineHeight: 1.5 }}>
                    Complete this project and your teacher will award you a card — the better the effort, the rarer the card!
                  </p>
                </div>
              </td>

              {/* Right: card preview */}
              <td style={{ verticalAlign: 'top', textAlign: 'center' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', color: '#a0a8c8', textTransform: 'uppercase', marginBottom: 10 }}>Card you could earn</div>
                {card && card.card_name ? (
                  <div style={{ display: 'inline-block', transform: 'scale(0.8)', transformOrigin: 'top center' }}>
                    {card.card_source === 'built'
                      ? <BuiltCard card={card as Card} size="full" />
                      : <PokeCard card={card as Card} size="full" />
                    }
                  </div>
                ) : (
                  <div style={{ padding: '40px 20px', background: 'rgba(100,120,220,0.05)', border: '2px dashed rgba(100,120,220,0.2)', borderRadius: 20, color: '#a0a8c8' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 10, opacity: 0.4 }}>🃏</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>Card coming soon</div>
                    <div style={{ fontSize: '0.65rem', marginTop: 4, opacity: 0.7 }}>Your teacher is preparing it</div>
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeeklyProjectBanner({ project, onClick }: { project: WeeklyProject; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? 'linear-gradient(135deg,rgba(255,248,220,0.95),rgba(255,230,160,0.95))'
          : 'linear-gradient(135deg,rgba(255,252,235,0.9),rgba(255,240,180,0.88))',
        borderRadius: 22,
        padding: '18px 24px',
        border: '1.5px solid rgba(220,180,60,0.45)',
        boxShadow: hovered
          ? '0 8px 28px rgba(200,160,40,0.2)'
          : '0 4px 16px rgba(200,160,40,0.1)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#ffd54f,#ffb300)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', boxShadow: '0 4px 12px rgba(200,150,0,0.3)', flexShrink: 0 }}>
          📋
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', color: '#b08000', textTransform: 'uppercase', marginBottom: 2 }}>
            Weekly Project{project.week_label ? ` · ${project.week_label}` : ''}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#5a3a00' }}>{project.title}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9a7000' }}>View task</span>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(200,150,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#b08000' }}>▶</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Card detail modal
───────────────────────────────────────────── */
function CardDetail({ card, onClose }: { card: Card; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(100,80,140,0.3)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'linear-gradient(145deg,rgba(255,255,255,0.97),rgba(248,240,252,0.98))', borderRadius: 32, padding: '32px', maxWidth: 720, width: '90vw', boxShadow: '0 24px 64px rgba(160,80,200,0.18)', border: '2px solid rgba(255,255,255,0.9)', position: 'relative' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', background: 'rgba(180,160,220,0.12)', border: 'none', fontSize: '1rem', cursor: 'pointer', color: '#9090c0' }}>✕</button>

        {/* Two-column table layout — card left, info right */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 200 }} />
            <col />
          </colgroup>
          <tbody>
            <tr>
              {/* Left column: card (scaled down) */}
              <td style={{ verticalAlign: 'top', paddingRight: 28 }}>
                <div style={{ transform: 'scale(0.78)', transformOrigin: 'top left', width: 'fit-content' }}>
                  {card.card_source === 'built' ? <BuiltCard card={card} /> : <PokeCard card={card} />}
                </div>
              </td>

              {/* Right column: text info */}
              <td style={{ verticalAlign: 'top' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3040a0', marginBottom: 4, marginTop: 0 }}>{card.card_name}</h2>
                <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: 'rgba(100,120,220,0.08)', border: '1px solid rgba(100,120,220,0.15)', fontSize: '0.65rem', fontWeight: 700, color: '#6070c0', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {RARITY_ICONS[card.rarity]} {card.rarity}
                </div>
                <p style={{ fontSize: '0.88rem', color: '#7080b0', fontStyle: 'italic', marginBottom: 20, lineHeight: 1.5 }}>"{card.description}"</p>
                {[
                  ['HP', card.hp], ['Type', card.type],
                  [card.stat1_name, card.stat1_val], [card.stat2_name, card.stat2_val], [card.stat3_name, card.stat3_val],
                  [card.move1_name, `${card.move1_dmg} dmg`], [card.move2_name, `${card.move2_dmg} dmg`],
                  ['Awarded', new Date(card.created_at).toLocaleDateString()],
                ].map(([k, v]) => (
                  <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(100,120,220,0.08)' }}>
                    <span style={{ fontSize: '0.72rem', color: '#9090c0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3040a0' }}>{v}</span>
                  </div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main dashboard
───────────────────────────────────────────── */
function StudentPage({ session, onSignOut }: { session: NonNullable<Session>; onSignOut: () => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [studentName, setStudentName] = useState('Student');
  const [studentId, setStudentId] = useState('');
  const [weeklyProject, setWeeklyProject] = useState<WeeklyProject | null>(null);
  type HomeComm = { id: string; teacher_id: string; event_date: string; comment: string; created_at: string };
  const [homeComms, setHomeComms] = useState<HomeComm[]>([]);
  type Pinboard = { id: string; teacher_id: string; message: string; photo_url: string | null; created_at: string };
  const [pinboard, setPinboard] = useState<Pinboard | null>(null);
  const [showProject, setShowProject] = useState(false);
  const [medals, setMedals] = useState({ gold: 0, silver: 0, bronze: 0 });
  const [scoreboard, setScoreboard] = useState<{ student_id: string; name: string; wins: number }[]>([]);
  const [savedBotKey, setSavedBotKey] = useState(0);
  const faceKey = `classcard_face_${session.user.id}`;
  const [facePixels, setFacePixelsRaw] = useState<string[] | null>(() => {
    try { const v = localStorage.getItem(faceKey); return v ? JSON.parse(v) : null; }
    catch { return null; }
  });
  const setFacePixels = (px: string[] | null) => {
    setFacePixelsRaw(px);
    try {
      if (px) localStorage.setItem(faceKey, JSON.stringify(px));
      else localStorage.removeItem(faceKey);
    } catch { /* ignore */ }
  };

  // Unlock system state
  const [unlockedChoices, setUnlockedChoices] = useState<string[]>([]);
  const [pendingUnlocks, setPendingUnlocks] = useState(0);
  const [prevLevel, setPrevLevel] = useState<number | null>(null);
  const [unlocksLoaded, setUnlocksLoaded] = useState(false);

  // Color index — stored in Supabase via student metadata
  const storageKey = `classcard_robot_knob_${session.user.id}`;
  const [knob, setKnobRaw] = useState<number>(() => {
    try { const v = localStorage.getItem(storageKey); return v !== null ? Math.min(3, Math.max(0, parseInt(v, 10) || 0)) : 0; }
    catch { return 0; }
  });

  const setKnob = (v: number) => {
    setKnobRaw(v);
    try { localStorage.setItem(storageKey, String(v)); } catch { /* ignore */ }
  };

  // Derived unlock counts
  const unlockedColorCount = 4 + countUnlockedColors(unlockedChoices);
  const unlockedFaceColorCount = 1 + countUnlockedFaceColors(unlockedChoices);
  const colorThemes = buildColorThemes(unlockedColorCount);
  const faceColorPalettes = FACE_COLOR_PALETTES.slice(0, unlockedFaceColorCount);
  const robotColor = knobToRobotColor(knob, colorThemes);

  // Load unlocks from Supabase
  useEffect(() => {
    const loadUnlocks = async () => {
      if (!studentId) return;
      const { data } = await sb.from('student_unlocks').select('choices').eq('student_id', studentId).maybeSingle();
      const choices: string[] = data?.choices || [];
      setUnlockedChoices(choices);
      setUnlocksLoaded(true);
    };
    if (studentId) loadUnlocks();
  }, [studentId]);

  // Save a new unlock choice to Supabase
  const saveUnlockChoice = async (choice: string) => {
    if (!studentId) return;
    const newChoices = [...unlockedChoices, choice];
    setUnlockedChoices(newChoices);
    await sb.from('student_unlocks').upsert({ student_id: studentId, choices: newChoices }, { onConflict: 'student_id' });
  };

  // Detect level-ups and queue pending unlocks.
  // On first load, compare current level vs choices already made — this
  // catches students who were already at level 2+ before the unlock system existed.
  useEffect(() => {
    if (!unlocksLoaded || cards.length === 0) return;
    const currentLevel = Math.max(1, Math.floor(cards.length / 5) + 1);

    if (prevLevel === null) {
      // First time running after unlocks loaded — check if they have unclaimed unlocks
      // Each level above 1 earns one unlock, so they should have (currentLevel - 1) choices.
      // Any deficit means unclaimed unlocks.
      const earnedUnlocks = currentLevel - 1;
      const claimedUnlocks = unlockedChoices.length;
      const owed = Math.max(0, earnedUnlocks - claimedUnlocks);
      if (owed > 0) setPendingUnlocks(owed);
      setPrevLevel(currentLevel);
      return;
    }

    if (currentLevel > prevLevel) {
      setPendingUnlocks(p => p + (currentLevel - prevLevel));
      setPrevLevel(currentLevel);
    }
  }, [cards.length, unlocksLoaded]);

  const loadCards = useCallback(async () => {
    try {
      const profile = session.profile;
      setStudentName(profile.name || 'Student');
      let sid = profile.student_id;
      if (!sid) {
        const { data } = await (await import('../lib/supabase')).sb
          .from('students').select('id').eq('auth_user_id', session.user.id).maybeSingle();
        if (data) sid = data.id;
      }
      if (sid) {
        setStudentId(sid);
        setCards(await Dashboard.getStudentCards(sid));
        // Fetch teacher's weekly project
        const { data: studentRow } = await sb.from('students').select('teacher_id').eq('id', sid).maybeSingle();
        const teacherId = studentRow?.teacher_id;
                if (teacherId) {
          const { data: proj } = await sb
            .from('weekly_projects')
            .select('*')
            .eq('teacher_id', teacherId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (proj) setWeeklyProject(proj as WeeklyProject);
          // Home communications
          try {
            const { data: hcData } = await sb
              .from('home_communications')
              .select('*')
              .eq('teacher_id', teacherId)
              .order('event_date', { ascending: false });
            setHomeComms((hcData || []) as HomeComm[]);
          } catch { /* table may not exist yet */ }
          // Load pinboard
          try {
            const { data: pb } = await sb
              .from('home_pinboard')
              .select('*')
              .eq('teacher_id', teacherId)
              .maybeSingle();
            if (pb) setPinboard(pb as Pinboard);
          } catch { /* table may not exist yet */ }
          // Medals + scoreboard (same teacher cohort)
          const [m, sb2] = await Promise.all([
            getMedalCounts(sid, teacherId),
            getWeeklyScoreboard(teacherId),
          ]);
          setMedals(m);
          setScoreboard(sb2);
        }
      }
    } catch { /* silent */ }
  }, [session]);

  useEffect(() => { loadCards(); }, [loadCards]);

  // Load robot settings from database on mount
  useEffect(() => {
    async function loadRobotSettings() {
      if (!studentId) return;
      try {
        const settings = await loadStudentRobotSettings(studentId);
        if (settings) {
          // Only update if we have saved settings in database
          setKnobRaw(settings.colorIndex);
          if (settings.facePixels) {
            setFacePixelsRaw(settings.facePixels);
          }
        }
      } catch (error) {
        console.error('Failed to load robot settings:', error);
      }
    }
    loadRobotSettings();
  }, [studentId]);

  // Save robot settings to database whenever they change
  useEffect(() => {
    async function saveRobotSettings() {
      if (!studentId) return;
      try {
        await saveStudentRobotSettings(studentId, knob, facePixels);
      } catch (error) {
        console.error('Failed to save robot settings:', error);
      }
    }
    // Debounce saves - only save after user stops changing for 1 second
    const timeoutId = setTimeout(saveRobotSettings, 1000);
    return () => clearTimeout(timeoutId);
  }, [studentId, knob, facePixels]);

  // Handle sign out - save robot settings before logging out
  const handleSignOut = useCallback(async () => {
    if (studentId) {
      try {
        // Save robot settings one final time before logout
        await saveStudentRobotSettings(studentId, knob, facePixels);
      } catch (error) {
        console.error('Failed to save robot settings on logout:', error);
      }
    }
    // Call the original onSignOut
    onSignOut();
  }, [studentId, knob, facePixels, onSignOut]);

  // Robot level is now based on card count
  const level = Math.max(1, Math.floor(cards.length / 5) + 1);
  const xp = (cards.length % 5) * 100;

  const firstName = studentName.split(' ')[0];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
        .sd-page * { font-family: 'Nunito', 'Segoe UI', sans-serif !important; }
        .sd-page ::-webkit-scrollbar { height: 4px; }
        .sd-page ::-webkit-scrollbar-track { background: rgba(200,180,220,0.1); border-radius: 10px; }
        .sd-page ::-webkit-scrollbar-thumb { background: rgba(160,140,200,0.3); border-radius: 10px; }
      `}</style>

      <div
        className="sd-page"
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #fce4ec 0%, #f3e5f5 30%, #e8eaf6 60%, #e1f5fe 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        {/* Level up unlock modal */}
      {pendingUnlocks > 0 && (
        <LevelUpModal
          level={level}
          unlockedChoices={unlockedChoices}
          onChoose={async (choice) => {
            await saveUnlockChoice(choice);
            setPendingUnlocks(p => Math.max(0, p - 1));
          }}
        />
      )}

      {/* Outer container */}
        <div style={{
          width: '100%',
          maxWidth: 1160,
          background: 'rgba(255,255,255,0.45)',
          borderRadius: 40,
          padding: '28px 32px',
          boxShadow: '0 20px 80px rgba(180,120,220,0.12), 0 4px 24px rgba(200,160,240,0.08)',
          border: '2px solid rgba(255,255,255,0.8)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>

          {/* ── TOP ROW ── */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

            {/* Welcome + Robot */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexShrink: 0 }}>
              <div>
                <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 900, color: '#2030a0', margin: 0, lineHeight: 1.1 }}>
                  Hey {firstName}!
                </h1>
                <p style={{ fontSize: '0.85rem', color: '#8090c0', margin: '6px 0 0', fontWeight: 600 }}>
                  You've collected {cards.length} card{cards.length !== 1 ? 's' : ''}
                </p>
                <div style={{ marginTop: 16 }}>
                  {localStorage.getItem('savedBot')
                    ? <SavedBotAvatar key={savedBotKey} facePixels={facePixels} faceColorPalettes={faceColorPalettes} robotColor={robotColor} />
                    : <RobotAvatar level={level} xp={xp} xpMax={500} color={robotColor} facePixels={facePixels} faceColorPalettes={faceColorPalettes} />
                  }
                </div>
                {/* Reset to default bot — only shown when a saved bot exists */}
                {localStorage.getItem('savedBot') && (
                  <button
                    onClick={() => { localStorage.removeItem('savedBot'); setSavedBotKey(k => k + 1); }}
                    style={{ width: '100%', marginTop: 8, padding: '7px 10px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em' }}
                  >
                    ↺ Reset to Default Bot
                  </button>
                )}
                {/* Build a Bot button — locked until unlocked via level up */}
                {(() => {
                  const buildabotUnlocked = unlockedChoices.includes('buildabot');
                  return (
                    <div
                      onClick={() => { if (buildabotUnlocked) window.location.hash = '/buildabot'; }}
                      style={{ cursor: buildabotUnlocked ? 'pointer' : 'not-allowed', marginTop: 10 }}
                    >
                      <div
                        style={{
                          background: buildabotUnlocked
                            ? 'linear-gradient(135deg,#43e97b,#38f9d7,#4facfe)'
                            : 'rgba(180,180,190,0.25)',
                          borderRadius: 14, padding: '11px 14px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          boxShadow: buildabotUnlocked ? '0 6px 20px rgba(67,233,123,0.3)' : 'none',
                          transition: 'all 0.2s',
                          border: buildabotUnlocked ? 'none' : '1.5px dashed rgba(150,150,160,0.4)',
                        }}
                        onMouseEnter={e => { if (buildabotUnlocked) { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 28px rgba(67,233,123,0.5)'; }}}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLDivElement).style.boxShadow = buildabotUnlocked ? '0 6px 20px rgba(67,233,123,0.3)' : 'none'; }}
                      >
                        <div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.1em', color: buildabotUnlocked ? '#fff' : 'rgba(120,120,130,0.8)', textTransform: 'uppercase', display: 'block' }}>Build a Bot</span>
                          {!buildabotUnlocked && (
                            <span style={{ fontSize: '0.55rem', color: 'rgba(120,120,130,0.65)', fontWeight: 600, letterSpacing: '0.05em' }}>🔒 Unlock via Level Up</span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.95rem', opacity: buildabotUnlocked ? 1 : 0.35 }}>🤖</span>
                      </div>
                    </div>
                  );
                })()}

                {/* My Cards button */}
                <div onClick={() => window.location.hash = '/mycards'}
                  style={{ cursor: 'pointer', marginTop: 10 }}>
                  <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 14, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 6px 20px rgba(99,102,241,0.35)', transition: 'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.1em', color: '#fff', textTransform: 'uppercase' }}>My Cards</span>
                    <span style={{ fontSize: '0.95rem' }}>🃏</span>
                  </div>
                </div>

                {/* Shop button */}
                <div onClick={() => window.location.hash = '/shop'}
                  style={{ cursor: 'pointer', marginTop: 10 }}>
                  <div style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', borderRadius: 14, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 6px 20px rgba(245,158,11,0.35)', transition: 'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.1em', color: '#fff', textTransform: 'uppercase' }}>Shop & Trade</span>
                    <span style={{ fontSize: '0.95rem' }}>🛒</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Signal panel + Pixel editor stacked */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <SignalPanel knob={knob} onKnobChange={setKnob} colorThemes={colorThemes} />
              <PixelEditor
                faceColorPalettes={faceColorPalettes}
                onSend={setFacePixels}
                onReset={() => setFacePixels(null)}
              />
            </div>

            {/* Stats panel */}
            <StatsPanel
              total={cards.length}
              medals={medals}
              scoreboard={scoreboard}
              weekEnd={getWeekEnd()}
              onSignOut={handleSignOut}
              studentName={studentName}
              studentId={studentId}
            />
          </div>

          {/* ── WEEKLY PROJECT BANNER ── */}
          {weeklyProject && (
            <WeeklyProjectBanner project={weeklyProject} onClick={() => setShowProject(true)} />
          )}

          {/* ── DEV CARD CONTROLS (bclark@gmail.com only) ── */}
          {session.user.email === 'bclark@gmail.com' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1.5px dashed rgba(239,68,68,0.35)', borderRadius: 14, marginBottom: 4 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', color: '#ef4444', textTransform: 'uppercase', flex: 1 }}>🛠 Dev · Cards: {cards.length}</span>
              <button
                onClick={async () => {
                  if (!studentId) return;
                  const teacherId = cards[0]?.teacher_id ?? 'dev-teacher';
                  const n = cards.length + 1;
                  const newCard = await Dashboard.saveCard({
                    student_id: studentId,
                    teacher_id: teacherId,
                    rarity: ['common','silver','gold-rare','prismatic'][n % 4] as Card['rarity'],
                    card_name: `Dev Card #${n}`,
                    hp: 40 + (n % 5) * 10,
                    type: 'Scholar',
                    description: `Test card ${n} added by dev controls.`,
                    stat1_name: 'Power',   stat1_val: 50 + n,
                    stat2_name: 'Speed',   stat2_val: 40 + n,
                    stat3_name: 'Luck',    stat3_val: 30 + n,
                    move1_name: 'Test Zap',    move1_dmg: 20,
                    move2_name: 'Debug Blast', move2_dmg: 35,
                    image_url: `data:image/svg+xml;utf8,${encodeURIComponent('<svg width="150" height="150" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="150" rx="18" fill="#1f2937"/><text x="75" y="82" text-anchor="middle" font-size="48">🛠</text></svg>')}`,
                    card_source: 'generated',
                  });
                  setCards(prev => [newCard, ...prev]);
                }}
                style={{ padding: '6px 14px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 800 }}
              >+ Add</button>
              <button
                onClick={async () => {
                  // Remove the most recently added card (first in list)
                  const devCard = cards.find(c => c.card_name?.startsWith('Dev Card'));
                  const toRemove = devCard ?? cards[0];
                  if (!toRemove) return;
                  await Dashboard.deleteCard(toRemove.id);
                  setCards(prev => prev.filter(c => c.id !== toRemove.id));
                }}
                disabled={cards.length === 0}
                style={{ padding: '6px 14px', background: cards.length === 0 ? '#6b7280' : '#ef4444', color: 'white', border: 'none', borderRadius: 9, cursor: cards.length === 0 ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 800 }}
              >− Remove</button>
            </div>
          )}

          {/* ── HOME COMMUNICATION ── */}
          {(pinboard || homeComms.length > 0) && (
            <div style={{ marginTop: 28, borderRadius: 22, background: 'rgba(255,255,255,0.72)', border: '1.5px solid rgba(200,190,240,0.5)', boxShadow: '0 6px 28px rgba(160,120,220,0.10)', padding: '22px 24px', backdropFilter: 'blur(8px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <span style={{ fontSize: '1.15rem' }}>🏠</span>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#3040a0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Home Communication</h2>
              </div>

              {/* Pinboard message + photo */}
              {pinboard && (
                <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: homeComms.length > 0 ? 22 : 0, padding: '18px 20px', background: 'linear-gradient(135deg, rgba(237,232,255,0.7), rgba(220,210,255,0.45))', borderRadius: 16, border: '1.5px solid rgba(180,160,230,0.3)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9080c0', marginBottom: 8 }}>📌 From your teacher</div>
                    <p style={{ margin: 0, fontSize: '0.92rem', color: '#2e3a8a', lineHeight: 1.7, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{pinboard.message}</p>
                  </div>
                  {pinboard.photo_url && (
                    <div style={{ flexShrink: 0 }}>
                      <img
                        src={pinboard.photo_url}
                        alt="From your teacher"
                        style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 14, border: '2px solid rgba(160,140,220,0.35)', boxShadow: '0 4px 16px rgba(120,100,200,0.15)', display: 'block' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Dated events */}
              {homeComms.length > 0 && (
                <>
                  {pinboard && (
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a0a8c8', marginBottom: 10 }}>📅 Upcoming Dates &amp; Events</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {homeComms.map(hc => (
                      <div key={hc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '13px 15px', background: 'rgba(240,236,255,0.55)', borderRadius: 14, border: '1px solid rgba(180,160,230,0.22)' }}>
                        <div style={{ flexShrink: 0, background: 'linear-gradient(135deg,#ede8ff,#cfc5f8)', borderRadius: 12, padding: '8px 12px', textAlign: 'center', minWidth: 62 }}>
                          <div style={{ fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7060b0', marginBottom: 1 }}>
                            {new Date(hc.event_date + 'T12:00:00').toLocaleDateString('en-NZ', { month: 'short' }).toUpperCase()}
                          </div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#4030a0', lineHeight: 1 }}>
                            {new Date(hc.event_date + 'T12:00:00').getDate()}
                          </div>
                          <div style={{ fontSize: '0.5rem', fontWeight: 700, color: '#9080c0', marginTop: 1 }}>
                            {new Date(hc.event_date + 'T12:00:00').toLocaleDateString('en-NZ', { weekday: 'short' }).toUpperCase()}
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.87rem', color: '#3040a0', lineHeight: 1.65, fontWeight: 500, flex: 1, paddingTop: 4 }}>{hc.comment}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {detailCard && <CardDetail card={detailCard} onClose={() => setDetailCard(null)} />}
      {showProject && weeklyProject && (
        <WeeklyProjectModal project={weeklyProject} onClose={() => setShowProject(false)} />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SHOP & TRADE
// ══════════════════════════════════════════════════════════════════════

const PACK_TYPES = [
  { id: 'xanimals',  label: 'Xanimals Pack',  subtitle: 'Crossed Animals!',      color: '#7c3aed', glow: '#a855f7', emoji: '🧬' },
  { id: 'animals',   label: 'Animals Pack',   subtitle: 'Real World Animals!',   color: '#16a34a', glow: '#22c55e', emoji: '🐾' },
  { id: 'creatures', label: 'Creatures Pack', subtitle: 'Magical & Mythical!',   color: '#0369a1', glow: '#38bdf8', emoji: '👾' },
  { id: 'humanoids', label: 'Humanoids Pack', subtitle: 'People & Warriors!',    color: '#b45309', glow: '#f59e0b', emoji: '🧑' },
  { id: 'robots',    label: 'Robots Pack',    subtitle: 'Mechanical & Futuristic!', color: '#374151', glow: '#9ca3af', emoji: '🤖' },
  { id: 'luckydip',  label: 'Lucky Dip Pack', subtitle: 'Mix of All Themes!',   color: '#be123c', glow: '#f43f5e', emoji: '🎲', isSpecial: true },
];

const UNLOCK_ITEMS = [
  { id: 'color',    label: 'New Bot Colour',   desc: 'Unlock an extra colour for your AuraBot', emoji: '🎨', cost: 5 },
  { id: 'face',     label: 'Face Colour Pack',  desc: 'Unlock a new face pixel colour palette',  emoji: '✨', cost: 5 },
  { id: 'buildabot', label: 'Build-a-Bot',      desc: 'Unlock the full bot customisation studio', emoji: '🔧', cost: 5 },
];

function ShopAndTrade({ studentId, unlockedChoices, onUnlock }: {
  studentId: string;
  unlockedChoices: string[];
  onUnlock: (choice: string) => Promise<void>;
}) {
  const [starPoints, setStarPoints] = React.useState<number | null>(null);
  const [packImages, setPackImages] = React.useState<Record<string, string>>({});
  const [buying, setBuying] = React.useState<string | null>(null);
  const [unlocking, setUnlocking] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    if (!studentId) return;
    // Load star points
    sb.from('student_star_points').select('points').eq('student_id', studentId).maybeSingle()
      .then(({ data }) => setStarPoints(data?.points ?? 0));
    // Load pack images uploaded by admin
    sb.from('pack_images').select('pack_id, image_url')
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((r: any) => { map[r.pack_id] = r.image_url; });
        setPackImages(map);
      });
  }, [studentId]);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleBuyPack = async (packId: string) => {
    if (starPoints === null || starPoints < 5) { showMsg('Not enough ⭐ star points! You need at least 5.'); return; }
    setBuying(packId);
    showMsg(`🎉 ${PACK_TYPES.find(p => p.id === packId)?.label} purchased! Cards coming soon…`);
    setBuying(null);
  };

  const handleUnlock = async (item: typeof UNLOCK_ITEMS[0]) => {
    if (starPoints === null || starPoints < item.cost) { showMsg(`Not enough ⭐ star points! You need ${item.cost}.`); return; }
    if (unlockedChoices.includes(item.id)) { showMsg('Already unlocked!'); return; }
    setUnlocking(item.id);
    try {
      await sb.from('student_star_points').update({ points: (starPoints || 0) - item.cost }).eq('student_id', studentId);
      setStarPoints(p => (p || 0) - item.cost);
      await onUnlock(item.id);
      showMsg(`✓ ${item.label} unlocked!`);
    } catch { showMsg('Error — try again'); }
    setUnlocking(null);
  };

  return (
    <div style={{ borderRadius: 22, background: 'rgba(255,255,255,0.72)', border: '1.5px solid rgba(200,190,240,0.5)', boxShadow: '0 6px 28px rgba(160,120,220,0.10)', padding: '22px 24px', backdropFilter: 'blur(8px)', marginTop: 8 }}>
      <style>{`
        @keyframes packFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .pack-card:hover { transform: translateY(-4px) scale(1.02); }
        .pack-card { transition: all 0.25s ease; }
        .shop-unlock:hover { transform: translateY(-2px); }
        .shop-unlock { transition: all 0.2s; }
      `}</style>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.15rem' }}>🛒</span>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#3040a0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Shop & Trade</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,rgba(255,200,50,0.15),rgba(255,165,0,0.1))', border: '1.5px solid rgba(255,200,50,0.3)', borderRadius: 20, padding: '6px 14px' }}>
          <span style={{ fontSize: '1rem' }}>⭐</span>
          <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#b45309' }}>{starPoints ?? '…'}</span>
          <span style={{ fontSize: '0.68rem', color: '#92400e', fontWeight: 700 }}>star points</span>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith('Not') ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${msg.startsWith('Not') ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`, color: msg.startsWith('Not') ? '#dc2626' : '#16a34a', borderRadius: 10, padding: '8px 14px', fontSize: '0.82rem', fontWeight: 700, marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {/* ── Card Packs ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9090c0', marginBottom: 14 }}>🃏 Card Packs — 5 ⭐ each • 3 cards per pack</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>
          {PACK_TYPES.map(pack => (
            <div key={pack.id} className="pack-card" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleBuyPack(pack.id)}>
              {/* Pack visual */}
              <div style={{ borderRadius: 14, overflow: 'hidden', border: `2.5px solid ${pack.color}`, boxShadow: `0 8px 24px ${pack.glow}44`, background: `linear-gradient(160deg, ${pack.color}ee, ${pack.color}99)`, position: 'relative', aspectRatio: '3/4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px 8px' }}>
                {packImages[pack.id] ? (
                  // Admin-uploaded image fills the pack
                  <>
                    <img src={packImages[pack.id]} alt={pack.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    {/* Overlay gradient so bottom text is readable */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7) 100%)', pointerEvents: 'none' }} />
                    {/* Pack name on top of image */}
                    <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, textAlign: 'center', zIndex: 1 }}>
                      <div style={{ fontSize: '0.62rem', fontWeight: 900, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{pack.label}</div>
                    </div>
                    {/* Bottom bar */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.75)', padding: '4px 6px', textAlign: 'center', zIndex: 1 }}>
                      <div style={{ fontSize: '0.42rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>COLLECT • TRADE • BATTLE • CREATE</div>
                    </div>
                  </>
                ) : (
                  // Styled placeholder when no image uploaded
                  <>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: 'rgba(255,255,255,0.15)' }} />
                    <div style={{ textAlign: 'center', zIndex: 1 }}>
                      <div style={{ fontSize: '0.55rem', fontWeight: 900, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.08em' }}>AURABOT PROJECT</div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 900, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>COLLECTOR CARDS</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '3px 6px', textAlign: 'center', zIndex: 1 }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 900, color: pack.id === 'luckydip' ? '#ffd700' : 'white', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{pack.label.replace(' Pack','')}</div>
                      <div style={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{pack.subtitle}</div>
                    </div>
                    <div style={{ fontSize: '2.8rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))', lineHeight: 1 }}>{pack.emoji}</div>
                    <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '50%', width: 36, height: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,0.5)', position: 'absolute', bottom: 28, left: 8 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>3</span>
                      <span style={{ fontSize: '0.3rem', fontWeight: 800, color: 'rgba(255,255,255,0.8)', lineHeight: 1.2 }}>CARDS</span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.6)', margin: '0 -8px -8px', padding: '4px 6px', textAlign: 'center', zIndex: 1, width: 'calc(100% + 16px)' }}>
                      <div style={{ fontSize: '0.42rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>COLLECT • TRADE • BATTLE • CREATE</div>
                    </div>
                  </>
                )}
              </div>

              {/* Buy button */}
              <button disabled={buying === pack.id || starPoints === null || starPoints < 5}
                onClick={e => { e.stopPropagation(); handleBuyPack(pack.id); }}
                style={{ width: '100%', marginTop: 8, padding: '6px 0', borderRadius: 10, border: 'none', background: starPoints !== null && starPoints >= 5 ? `linear-gradient(135deg,${pack.color},${pack.glow})` : 'rgba(180,180,200,0.3)', color: starPoints !== null && starPoints >= 5 ? 'white' : '#9090b0', fontWeight: 800, fontSize: '0.72rem', cursor: starPoints !== null && starPoints >= 5 ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                {buying === pack.id ? '…' : '⭐ 5 pts — Buy'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Unlocks Shop ── */}
      <div style={{ borderTop: '1.5px solid rgba(200,190,240,0.4)', paddingTop: 20, marginBottom: 20 }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9090c0', marginBottom: 14 }}>🔓 Unlocks — 5 ⭐ each</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {UNLOCK_ITEMS.map(item => {
            const owned = unlockedChoices.includes(item.id);
            const canAfford = starPoints !== null && starPoints >= item.cost;
            return (
              <div key={item.id} className="shop-unlock"
                style={{ flex: '1', minWidth: 160, background: owned ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.6)', border: `1.5px solid ${owned ? 'rgba(34,197,94,0.3)' : 'rgba(200,190,240,0.4)'}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.4rem' }}>{item.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: owned ? '#16a34a' : '#3040a0' }}>{item.label}</div>
                    <div style={{ fontSize: '0.68rem', color: '#8090b0', lineHeight: 1.3 }}>{item.desc}</div>
                  </div>
                </div>
                <button
                  disabled={owned || unlocking === item.id || !canAfford}
                  onClick={() => handleUnlock(item)}
                  style={{ width: '100%', padding: '7px 0', borderRadius: 9, border: 'none', fontWeight: 800, fontSize: '0.76rem', cursor: owned || !canAfford ? 'not-allowed' : 'pointer', background: owned ? 'rgba(34,197,94,0.15)' : canAfford ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'rgba(180,180,200,0.3)', color: owned ? '#16a34a' : canAfford ? 'white' : '#9090b0', transition: 'all 0.2s' }}>
                  {owned ? '✓ Owned' : unlocking === item.id ? '…' : `⭐ ${item.cost} pts — Unlock`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Trade ── */}
      <div style={{ borderTop: '1.5px solid rgba(200,190,240,0.4)', paddingTop: 20 }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9090c0', marginBottom: 14 }}>🔄 Trade Cards</div>
        <div style={{ background: 'rgba(160,120,220,0.06)', border: '1.5px dashed rgba(160,120,220,0.25)', borderRadius: 16, padding: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔄</div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#5040a0', marginBottom: 4 }}>Card Trading — Coming Soon</div>
          <div style={{ fontSize: '0.76rem', color: '#9090c0', lineHeight: 1.5 }}>Soon you'll be able to swap cards with your classmates right here.</div>
        </div>
      </div>
    </div>
  );
}

export default StudentPage;

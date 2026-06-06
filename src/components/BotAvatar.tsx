/**
 * BotAvatar.tsx — shared robot rendering components
 * Used by both StudentPage (live bot) and TeacherPage (stars grid thumbnails).
 */
import React, { useEffect, useRef } from 'react';

/* ─── Colour themes ──────────────────────────────────────────────────────── */

export type ColorTheme = {
  light: string; mid: string; dark: string; glow: string;
  label: string; wave: string; waveShadow: string; special: boolean;
  gradient?: string; chromatic?: boolean; blackChrome?: boolean; rainbow?: boolean;
};

export const BASE_COLOR_THEMES: ColorTheme[] = [
  { light: '#e3f2fd', mid: '#90caf9', dark: '#42a5f5', glow: 'rgba(66,165,245,0.35)',   label: 'Sky',       wave: '#42a5f5', waveShadow: 'rgba(66,165,245,0.8)',   special: false },
  { light: '#fce4ec', mid: '#f8bbd0', dark: '#f48fb1', glow: 'rgba(244,143,177,0.35)', label: 'Bubblegum', wave: '#f06292', waveShadow: 'rgba(240,98,146,0.8)',   special: false },
  { light: '#f1f8e9', mid: '#c5e1a5', dark: '#8bc34a', glow: 'rgba(139,195,74,0.35)',  label: 'Minty',     wave: '#66bb6a', waveShadow: 'rgba(102,187,106,0.8)',  special: false },
  { light: '#fffde7', mid: '#fff176', dark: '#fdd835', glow: 'rgba(253,216,53,0.35)',   label: 'Lemon',     wave: '#fdd835', waveShadow: 'rgba(253,216,53,0.8)',   special: false },
];

export const EXTRA_COLOR_THEMES: ColorTheme[] = [
  { light: '#f3e5f5', mid: '#ce93d8', dark: '#ab47bc', glow: 'rgba(171,71,188,0.35)',  label: 'Grape',     wave: '#ab47bc', waveShadow: 'rgba(171,71,188,0.8)',   special: false },
  { light: '#e0f7fa', mid: '#80deea', dark: '#00bcd4', glow: 'rgba(0,188,212,0.35)',   label: 'Ocean',     wave: '#00bcd4', waveShadow: 'rgba(0,188,212,0.8)',    special: false },
  { light: '#fff3e0', mid: '#ffcc80', dark: '#ff9800', glow: 'rgba(255,152,0,0.35)',   label: 'Tangerine', wave: '#ff9800', waveShadow: 'rgba(255,152,0,0.8)',    special: false },
  { light: '#fce4ec', mid: '#ef9a9a', dark: '#e53935', glow: 'rgba(229,57,53,0.35)',   label: 'Crimson',   wave: '#e53935', waveShadow: 'rgba(229,57,53,0.8)',    special: false },
  { light: '#fffde7', mid: '#ffe082', dark: '#ffc107', glow: 'rgba(255,193,7,0.6)',    label: '✨ Gold',    wave: '#ffd700', waveShadow: 'rgba(255,215,0,0.95)',   special: true,  gradient: 'linear-gradient(135deg,#fffbe6,#ffe066,#ffd700,#bfa000,#ffd700,#ffe066)' },
  { light: '#f5f5f5', mid: '#e0e0e0', dark: '#9e9e9e', glow: 'rgba(200,200,200,0.6)', label: '✨ Silver',  wave: '#c0c0c0', waveShadow: 'rgba(192,192,192,0.95)', special: true,  gradient: 'linear-gradient(135deg,#ffffff,#d0d0d0,#a0a0a0,#e8e8e8,#a0a0a0,#d0d0d0)' },
  { light: '#ff9de2', mid: '#a78bfa', dark: '#38bdf8', glow: 'rgba(167,139,250,0.6)', label: '🌈 Chrome', wave: '#a855f7', waveShadow: 'rgba(168,85,247,0.95)', special: true, gradient: 'linear-gradient(135deg,#ff0080,#ff8c00,#ffe000,#00ff88,#00c8ff,#a855f7,#ff0080,#ff8c00,#ffe000)', rainbow: true },
  { light: '#0a0a0f', mid: '#111118', dark: '#1a1a2e', glow: 'rgba(140,80,255,0.55)', label: '🖤 Black Chrome', wave: '#7c3aed', waveShadow: 'rgba(124,58,237,0.95)', special: true, gradient: 'linear-gradient(135deg,#0a0a0f,#1a1028,#0d0d1a,#1a1028,#0a0a0f)', blackChrome: true },
];

export const FACE_COLOR_PALETTES = [
  { label: 'Blue',   on: '#42a5f5', glow: 'rgba(66,165,245,0.8)',   gradient: 'radial-gradient(circle at 40% 35%, #c8f0ff, #6dd5fa)' },
  { label: 'Yellow', on: '#fdd835', glow: 'rgba(253,216,53,0.8)',   gradient: 'radial-gradient(circle at 40% 35%, #fffde7, #ffd600)' },
  { label: 'Green',  on: '#66bb6a', glow: 'rgba(102,187,106,0.8)',  gradient: 'radial-gradient(circle at 40% 35%, #e8f5e9, #43a047)' },
  { label: 'Pink',   on: '#f06292', glow: 'rgba(240,98,146,0.8)',   gradient: 'radial-gradient(circle at 40% 35%, #fce4ec, #e91e63)' },
];

export const ALL_COLOR_THEMES: ColorTheme[] = [...BASE_COLOR_THEMES, ...EXTRA_COLOR_THEMES];

export function buildColorThemes(unlockedColorCount: number): ColorTheme[] {
  const extras = EXTRA_COLOR_THEMES.slice(0, Math.max(0, unlockedColorCount - 4));
  return [...BASE_COLOR_THEMES, ...extras];
}
export function knobToRobotColor(k: number, themes: ColorTheme[]): ColorTheme {
  return themes[k % themes.length];
}
export function countUnlockedColors(choices: string[]): number {
  let count = 0;
  if (choices.includes('color'))  count += 2;
  if (choices.includes('color2')) count += 2;
  if (choices.includes('color3')) count += 2;
  return count;
}
export function countUnlockedFaceColors(choices: string[]): number {
  return choices.filter(c => c === 'face').length;
}

/* ─── Bot element types ──────────────────────────────────────────────────── */

export type BotElType = 'rect' | 'circle' | 'face' | 'chest' | 'group' | 'apple' | 'smiley' | 'heart' | 'thumbsup' | 'lips';
export interface BotEl {
  id: string; type: BotElType; cx: number; cy: number; w: number; h: number;
  rotation: number; rx?: number | string; color: string; scale?: number;
  baseW?: number; baseH?: number; children?: BotEl[]; flipX?: boolean; flipY?: boolean;
}

export const STICKER_MAP: Record<string, string> = { apple: '🍎', smiley: '🙂', heart: '❤️', thumbsup: '👍', lips: '👄' };

export const CONTAINER_W = 184;
export const CONTAINER_H = 293;
export const BOT_DEFAULT_COLOR = '#d6edb9';
export const DARK_SCREEN = '#111827';

export function getBotBounds(elements: BotEl[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const visit = (el: BotEl) => {
    if (el.type === 'group' && el.children) {
      el.children.forEach(c => {
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
  const PAD = 12;
  return { minX: minX - PAD, minY: minY - PAD, maxX: maxX + PAD, maxY: maxY + PAD,
           w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 };
}

/* ─── Colour remapping ───────────────────────────────────────────────────── */

export function remapBotElements(botElements: BotEl[], robotColor: ColorTheme): (BotEl & { _bodyBg?: string })[] {
  const bodyBg = (robotColor as any).gradient
    ? (robotColor as any).gradient
    : `linear-gradient(145deg,${robotColor.light},${robotColor.mid})`;

  const remapColor = (c: string, type?: string): string => {
    if (type === 'face' || type === 'chest') return DARK_SCREEN;
    if (c === BOT_DEFAULT_COLOR) return robotColor.mid;
    return c;
  };

  return botElements.map(el => {
    const color = remapColor(el.color, el.type);
    const _bodyBg = (el.type !== 'face' && el.type !== 'chest' && color === robotColor.mid) ? bodyBg : undefined;
    return {
      ...el,
      color,
      _bodyBg,
      children: el.children?.map(c => {
        const cc = remapColor(c.color, c.type);
        return { ...c, color: cc, _bodyBg: (c.type !== 'face' && c.type !== 'chest' && cc === robotColor.mid) ? bodyBg : undefined };
      }),
    };
  });
}

/* ─── renderBotEl ────────────────────────────────────────────────────────── */

export interface BotElSpecial { isRainbow?: boolean; isBlackChrome?: boolean; isGold?: boolean; isSilver?: boolean; sheenClass?: string; sheenColor?: string; }

export function renderBotEl(el: BotEl & { _bodyBg?: string }, special?: BotElSpecial): React.ReactNode {
  const isGroup   = el.type === 'group';
  const isFace    = el.type === 'face';
  const isChest   = el.type === 'chest';
  const isScreen  = isFace || isChest;
  const isCircle  = el.type === 'circle';
  const isSticker = ['apple','smiley','heart','thumbsup','lips'].includes(el.type);
  const isSpecial = !!(special && (special.isRainbow || special.isBlackChrome || special.isGold || special.isSilver));

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: el.cx, top: el.cy,
    width:  isGroup ? (el.baseW ?? el.w) : el.w,
    height: isGroup ? (el.baseH ?? el.h) : el.h,
    transform: `translate(-50%,-50%) rotate(${el.rotation}deg) scale(${isGroup ? (el.scale ?? 1) : 1}) scaleX(${el.flipX ? -1 : 1}) scaleY(${el.flipY ? -1 : 1})`,
    borderRadius: isCircle ? '50%' : (typeof el.rx === 'number' ? el.rx : 0),
    backgroundColor: (isGroup || isSticker || isScreen) ? (isScreen ? el.color : 'transparent') : (el._bodyBg ? undefined : el.color),
    background: (!isGroup && !isSticker && !isScreen) ? (el._bodyBg || undefined) : undefined,
    boxShadow: isScreen
      ? 'inset 0 0 14px rgba(0,0,0,0.85)'
      : (!isGroup && !isSticker)
        ? 'inset 6px 6px 12px rgba(255,255,255,0.65), inset -6px -6px 12px rgba(0,0,0,0.06), 8px 8px 16px rgba(0,0,0,0.08)'
        : undefined,
    overflow: isScreen ? 'hidden' : 'visible',
    zIndex: isScreen ? 2 : 1,
  };

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
        position: 'absolute', left: '50%', top: '50%',
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
    <div key={el.id} style={containerStyle}>
      <SheenStrip />
      {isGroup   && (el.children ?? []).map((c, ci) => renderChildEl(c, ci))}
      {isSticker && <span style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize: el.w * 0.7, lineHeight:1 }}>{STICKER_MAP[el.type]}</span>}
      {isScreen  && renderScreenContent(el.type, el.w, el.h)}
    </div>
  );
}

/* ─── BotCanvas — renders themed bot elements at a given size ────────────── */

interface BotCanvasProps {
  botElements: BotEl[];
  robotColor: ColorTheme;
  facePixels?: string[] | null;
  faceColorPalettes?: typeof FACE_COLOR_PALETTES;
  /** Display size; defaults to CONTAINER_W × CONTAINER_H */
  width?: number;
  height?: number;
  /** Extra CSS class on the bouncing wrapper */
  animClass?: string;
}

export function BotCanvas({ botElements, robotColor, facePixels, faceColorPalettes, width = CONTAINER_W, height = CONTAINER_H, animClass = 'saved-bot-body' }: BotCanvasProps) {
  const isGold        = robotColor.label === '✨ Gold';
  const isSilver      = robotColor.label === '✨ Silver';
  const isRainbow     = !!(robotColor as any).rainbow;
  const isBlackChrome = !!(robotColor as any).blackChrome;
  const isSpecialBot  = isGold || isSilver || isRainbow || isBlackChrome;

  const themed = remapBotElements(botElements, robotColor);
  const bounds = getBotBounds(themed);
  const scale  = Math.min(width / bounds.w, height / bounds.h);
  const displayW = bounds.w * scale;
  const displayH = bounds.h * scale;

  const palettes = faceColorPalettes ?? FACE_COLOR_PALETTES.slice(0, 1);

  const sheenClass = isRainbow ? 'sheen-chrome' : isBlackChrome ? 'sheen-black-chrome' : isGold ? 'sheen-gold' : 'sheen-silver';
  const sheenColor = isRainbow
    ? 'linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.6) 50%,transparent 70%)'
    : isBlackChrome
      ? 'linear-gradient(105deg,transparent 25%,rgba(180,140,255,0.5) 45%,rgba(255,255,255,0.35) 50%,rgba(140,100,255,0.4) 55%,transparent 75%)'
      : isGold
        ? 'linear-gradient(105deg,transparent 30%,rgba(255,250,200,0.65) 50%,transparent 70%)'
        : 'linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.6) 50%,transparent 70%)';
  const botAnimClass = isRainbow ? ' bot-rainbow' : isBlackChrome ? ' bot-black-chrome' : isGold ? ' bot-gold' : isSilver ? ' bot-silver' : '';
  const special: BotElSpecial | undefined = isSpecialBot ? { isRainbow, isBlackChrome, isGold, isSilver, sheenClass, sheenColor } : undefined;

  const renderFaceContent = (el: any) => {
    const pixels: string[] | null = facePixels ?? null;
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

  return (
    <div style={{ width, height, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className={`${animClass}${botAnimClass}`} style={{ position: 'relative', width: displayW, height: displayH }}>
        <div style={{
          position: 'absolute', width: 800, height: 850,
          transform: `scale(${scale})`, transformOrigin: 'top left',
          left: -bounds.minX * scale, top: -bounds.minY * scale,
        }}>
          {themed.map((el: any) => {
            if (el.type === 'face') {
              return (
                <div key={el.id} style={{
                  position: 'absolute', left: el.cx, top: el.cy,
                  width: el.w, height: el.h,
                  transform: `translate(-50%,-50%) rotate(${el.rotation}deg)`,
                  borderRadius: typeof el.rx === 'number' ? el.rx : 0,
                  backgroundColor: el.color,
                  boxShadow: 'inset 0 0 14px rgba(0,0,0,0.85)',
                  overflow: 'hidden', zIndex: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {renderFaceContent(el)}
                </div>
              );
            }
            return renderBotEl(el, special);
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── StudentBotAvatar — loads from localStorage, falls back to default ──── */

interface StudentBotAvatarProps {
  robotColor: ColorTheme;
  facePixels?: string[] | null;
  faceColorPalettes?: typeof FACE_COLOR_PALETTES;
  /** Per-user localStorage key, e.g. `savedBot_<userId>` */
  storageKey: string;
  width?: number;
  height?: number;
}

export function StudentBotAvatar({ robotColor, facePixels, faceColorPalettes, storageKey, width = CONTAINER_W, height = CONTAINER_H }: StudentBotAvatarProps) {
  const [botElements, setBotElements] = React.useState<BotEl[] | null>(() => {
    try { const r = localStorage.getItem(storageKey); return r ? JSON.parse(r) : null; } catch { return null; }
  });

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) { try { setBotElements(JSON.parse(raw)); } catch { setBotElements(null); } }
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        if (e.newValue) { try { setBotElements(JSON.parse(e.newValue)); } catch { setBotElements(null); } }
        else setBotElements(null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  if (!botElements) return null;
  return <BotCanvas botElements={botElements} robotColor={robotColor} facePixels={facePixels} faceColorPalettes={faceColorPalettes} width={width} height={height} />;
}

/* ─── TeacherBotThumbnail — renders a student's bot from DB data ─────────── */

interface TeacherBotThumbnailProps {
  colorIndex: number;
  botElements: BotEl[] | null;
  facePixels: string[] | null;
  size?: number;
}

const DEFAULT_BOT_ELEMENTS: BotEl[] = [
  { id: 'head',  type: 'rect',   cx: 280, cy: 170, w: 280, h: 200, rotation: 0, rx: 60,  color: BOT_DEFAULT_COLOR },
  { id: 'face',  type: 'face',   cx: 280, cy: 170, w: 220, h: 120, rotation: 0, rx: 30,  color: DARK_SCREEN },
  { id: 'neck',  type: 'rect',   cx: 280, cy: 285, w: 80,  h: 50,  rotation: 0, rx: 10,  color: BOT_DEFAULT_COLOR },
  { id: 'body',  type: 'rect',   cx: 280, cy: 420, w: 320, h: 220, rotation: 0, rx: 60,  color: BOT_DEFAULT_COLOR },
  { id: 'chest', type: 'chest',  cx: 280, cy: 420, w: 240, h: 140, rotation: 0, rx: 30,  color: DARK_SCREEN },
  { id: 'armL',  type: 'rect',   cx: 90,  cy: 400, w: 70,  h: 180, rotation: 0, rx: 35,  color: BOT_DEFAULT_COLOR },
  { id: 'armR',  type: 'rect',   cx: 470, cy: 400, w: 70,  h: 180, rotation: 0, rx: 35,  color: BOT_DEFAULT_COLOR },
  { id: 'legL',  type: 'rect',   cx: 195, cy: 590, w: 80,  h: 100, rotation: 0, rx: 30,  color: BOT_DEFAULT_COLOR },
  { id: 'legR',  type: 'rect',   cx: 365, cy: 590, w: 80,  h: 100, rotation: 0, rx: 30,  color: BOT_DEFAULT_COLOR },
  { id: 'ant',   type: 'rect',   cx: 280, cy: 55,  w: 16,  h: 60,  rotation: 0, rx: 8,   color: BOT_DEFAULT_COLOR },
  { id: 'antb',  type: 'circle', cx: 280, cy: 30,  w: 30,  h: 30,  rotation: 0, rx: '50%', color: BOT_DEFAULT_COLOR },
];

export function TeacherBotThumbnail({ colorIndex, botElements, facePixels, size = 100 }: TeacherBotThumbnailProps) {
  const theme = ALL_COLOR_THEMES[Math.min(colorIndex, ALL_COLOR_THEMES.length - 1)];
  const elements = botElements ?? DEFAULT_BOT_ELEMENTS;
  const scaleFactor = size / CONTAINER_W;

  return (
    <div style={{ position: 'relative', width: size, flexShrink: 0 }}>
      <style>{`
        @keyframes savedBotBounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
        @keyframes sheenSweep     { 0% { left:-75%; } 100% { left:130%; } }
        @keyframes sheenSweepSlow { 0% { left:-75%; } 100% { left:130%; } }
        @keyframes sheenBCSweep   { 0% { left:-75%; } 100% { left:130%; } }
        @keyframes goldPulse    { 0%,100%{filter:brightness(1) saturate(1);}   50%{filter:brightness(1.15) saturate(1.3);} }
        @keyframes silverPulse  { 0%,100%{filter:brightness(1) saturate(0.9);} 50%{filter:brightness(1.2) saturate(1.1);} }
        @keyframes bcPulse      { 0%,100%{filter:brightness(1) saturate(1.6);} 50%{filter:brightness(1.1) saturate(2.2);} }
        @keyframes rainbowPulse { 0%,100%{filter:brightness(1.05) saturate(1.2);} 50%{filter:brightness(1.2) saturate(1.5);} }
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
      <BotCanvas
        botElements={elements}
        robotColor={theme}
        facePixels={facePixels}
        faceColorPalettes={FACE_COLOR_PALETTES}
        width={size}
        height={size * (CONTAINER_H / CONTAINER_W)}
      />
    </div>
  );
}

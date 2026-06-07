/**
 * BotAvatar.tsx — shared robot rendering components
 * Used by both StudentPage (live bot) and TeacherPage (stars grid thumbnails).
 */
import React, { useEffect } from 'react';

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
  { light: '#fffde7', mid: '#ffe082', dark: '#ffc107', glow: 'rgba(255,193,7,0.7)',    label: '✨ Gold',    wave: '#ffd700', waveShadow: 'rgba(255,215,0,0.95)',   special: true,  gradient: 'linear-gradient(145deg,#fff8dc 0%,#ffe566 15%,#ffd700 28%,#b8860b 42%,#ffd700 55%,#ffe566 65%,#fff4a0 75%,#c8960a 85%,#ffe566 100%)' },
  { light: '#f5f5f5', mid: '#e0e0e0', dark: '#9e9e9e', glow: 'rgba(200,200,220,0.7)', label: '✨ Silver',  wave: '#c0c0c0', waveShadow: 'rgba(220,220,255,0.95)', special: true,  gradient: 'linear-gradient(145deg,#ffffff 0%,#d8e0f0 12%,#a0aabb 28%,#e8eaf5 42%,#8090a8 55%,#d0d8ee 65%,#f0f2ff 75%,#90a0b8 85%,#dce0f0 100%)' },
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
    const isMetallic = special.isGold || special.isSilver;
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none', zIndex: 3 }}>
        {/* Wide soft reflection */}
        <div className={special.sheenClass} style={{
          position: 'absolute', top: '-50%', left: '-120%',
          width: isMetallic ? '80%' : '60%', height: '200%',
          background: isMetallic
            ? (special.isGold
                ? 'linear-gradient(105deg,transparent,rgba(255,255,220,0.18) 30%,rgba(255,255,255,0.55) 50%,rgba(255,240,160,0.18) 70%,transparent)'
                : 'linear-gradient(105deg,transparent,rgba(220,230,255,0.18) 30%,rgba(255,255,255,0.6) 50%,rgba(200,220,255,0.18) 70%,transparent)')
            : special.sheenColor,
          transform: 'skewX(-18deg)',
        }} />
        {/* Sharp bright highlight — offset timing */}
        {isMetallic && (
          <div className={`${special.sheenClass}-sharp`} style={{
            position: 'absolute', top: '-50%', left: '-120%',
            width: '20%', height: '200%',
            background: special.isGold
              ? 'linear-gradient(105deg,transparent,rgba(255,255,200,0.7) 45%,rgba(255,255,255,0.9) 50%,rgba(255,255,200,0.7) 55%,transparent)'
              : 'linear-gradient(105deg,transparent,rgba(200,220,255,0.6) 45%,rgba(255,255,255,0.95) 50%,rgba(200,220,255,0.6) 55%,transparent)',
            transform: 'skewX(-18deg)',
          }} />
        )}
      </div>
    );
  };

  const renderScreenContent = (type: string, w: number, _h: number, pts?: number) => {
    if (type === 'face') {
      return (
        <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'15%' }}>
          <div style={{ width:'22%', aspectRatio:'1', borderRadius:'50%', background:'#8be9fd', boxShadow:'0 0 14px #8be9fd, inset 0 0 8px white' }} />
          <div style={{ width:'22%', aspectRatio:'1', borderRadius:'50%', background:'#8be9fd', boxShadow:'0 0 14px #8be9fd, inset 0 0 8px white' }} />
        </div>
      );
    }
    if (type === 'chest') {
      const fs = Math.round(w * 0.22);
      const heartSize = Math.round(w * 0.52);
      return (
        <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
          {/* Pink glowing heart SVG */}
          <svg width={heartSize} height={heartSize} viewBox="0 0 100 100" style={{ position:'absolute', filter:'drop-shadow(0 0 10px rgba(255,120,180,0.9)) drop-shadow(0 0 4px rgba(255,180,220,0.8))' }}>
            <path d="M50 85 C50 85 12 58 12 35 C12 22 22 13 34 13 C41 13 47 17 50 22 C53 17 59 13 66 13 C78 13 88 22 88 35 C88 58 50 85 50 85Z"
              fill="url(#heartGrad)" />
            <defs>
              <radialGradient id="heartGrad" cx="40%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#ffb3d9" />
                <stop offset="50%" stopColor="#ff69b4" />
                <stop offset="100%" stopColor="#e0006a" />
              </radialGradient>
            </defs>
            {/* Highlight shine */}
            <ellipse cx="38" cy="30" rx="10" ry="7" fill="rgba(255,255,255,0.3)" transform="rotate(-20,38,30)" />
          </svg>
          {/* Number on top of heart */}
          <span style={{ position:'relative', zIndex:1, fontSize: fs, fontWeight: 900, color: 'white', textShadow: '0 1px 4px rgba(180,0,80,0.7)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {pts ?? 0}
          </span>
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
  starPoints?: number;
  width?: number;
  height?: number;
  animClass?: string;
}

export function BotCanvas({ botElements, robotColor, facePixels, faceColorPalettes, starPoints, width = CONTAINER_W, height = CONTAINER_H, animClass = 'saved-bot-body' }: BotCanvasProps) {
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

  const renderFaceContent = (_el: any) => {
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
            if (el.type === 'chest') {
              const pts = starPoints ?? 0;
              const heartSize = Math.round(el.w * 0.52);
              const fs = Math.round(el.w * 0.22);
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
                  <svg width={heartSize} height={heartSize} viewBox="0 0 100 100" style={{ position:'absolute', filter:'drop-shadow(0 0 10px rgba(255,120,180,0.9)) drop-shadow(0 0 4px rgba(255,180,220,0.8))' }}>
                    <path d="M50 85 C50 85 12 58 12 35 C12 22 22 13 34 13 C41 13 47 17 50 22 C53 17 59 13 66 13 C78 13 88 22 88 35 C88 58 50 85 50 85Z" fill="url(#heartGrad2)" />
                    <defs>
                      <radialGradient id="heartGrad2" cx="40%" cy="35%" r="60%">
                        <stop offset="0%" stopColor="#ffb3d9" />
                        <stop offset="50%" stopColor="#ff69b4" />
                        <stop offset="100%" stopColor="#e0006a" />
                      </radialGradient>
                    </defs>
                    <ellipse cx="38" cy="30" rx="10" ry="7" fill="rgba(255,255,255,0.3)" transform="rotate(-20,38,30)" />
                  </svg>
                  <span style={{ position:'relative', zIndex:1, fontSize: fs, fontWeight: 900, color: 'white', textShadow: '0 1px 4px rgba(180,0,80,0.7)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {pts}
                  </span>
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
  starPoints?: number;
  storageKey: string;
  width?: number;
  height?: number;
}

export function StudentBotAvatar({ robotColor, facePixels, faceColorPalettes, starPoints, storageKey, width = CONTAINER_W, height = CONTAINER_H }: StudentBotAvatarProps) {
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
  return <BotCanvas botElements={botElements} robotColor={robotColor} facePixels={facePixels} faceColorPalettes={faceColorPalettes} starPoints={starPoints} width={width} height={height} />;
}

/* ─── TeacherBotThumbnail — renders a student's bot from DB data ─────────── */

interface TeacherBotThumbnailProps {
  colorIndex: number;
  botElements: BotEl[] | null;
  facePixels: string[] | null;
  starPoints?: number;
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

export function TeacherBotThumbnail({ colorIndex, botElements, facePixels, starPoints, size = 100 }: TeacherBotThumbnailProps) {
  const theme = ALL_COLOR_THEMES[Math.min(colorIndex, ALL_COLOR_THEMES.length - 1)];
  const elements = botElements ?? DEFAULT_BOT_ELEMENTS;

  return (
    <div style={{ position: 'relative', width: size, flexShrink: 0 }}>
      <style>{`
        @keyframes savedBotBounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
        @keyframes sheenSweep     { 0% { left:-120%; } 100% { left:150%; } }
        @keyframes sheenSweepSlow { 0% { left:-120%; } 100% { left:150%; } }
        @keyframes sheenBCSweep   { 0% { left:-120%; } 100% { left:150%; } }
        @keyframes sheenGoldSharp  { 0%   { left:-120%; } 100% { left:150%; } }
        @keyframes sheenSilverSharp{ 0%   { left:-120%; } 100% { left:150%; } }
        @keyframes goldPulse    { 0%,100%{filter:brightness(1) saturate(1.1);}   50%{filter:brightness(1.12) saturate(1.3);} }
        @keyframes silverPulse  { 0%,100%{filter:brightness(1) saturate(0.9);}   50%{filter:brightness(1.12) saturate(1.1);} }
        @keyframes bcPulse      { 0%,100%{filter:brightness(1) saturate(1.6);} 50%{filter:brightness(1.1) saturate(2.2);} }
        @keyframes rainbowPulse { 0%,100%{filter:brightness(1.05) saturate(1.2);} 50%{filter:brightness(1.2) saturate(1.5);} }
        .saved-bot-body        { animation: savedBotBounce 3s ease-in-out infinite; }
        .sheen-gold            { animation: sheenSweep 2.2s ease-in-out infinite; }
        .sheen-gold-sharp      { animation: sheenGoldSharp 2.2s ease-in-out infinite; animation-delay: 0.15s; }
        .sheen-silver          { animation: sheenSweepSlow 2.8s ease-in-out infinite; }
        .sheen-silver-sharp    { animation: sheenSilverSharp 2.8s ease-in-out infinite; animation-delay: 0.2s; }
        .sheen-chrome          { animation: sheenSweep 1.6s ease-in-out infinite; }
        .sheen-black-chrome    { animation: sheenBCSweep 2s ease-in-out infinite; }
        .bot-gold              { animation: savedBotBounce 3s ease-in-out infinite, goldPulse 2.2s ease-in-out infinite; }
        .bot-silver            { animation: savedBotBounce 3s ease-in-out infinite, silverPulse 2.8s ease-in-out infinite; }
        .bot-rainbow           { animation: savedBotBounce 3s ease-in-out infinite, rainbowPulse 3s ease-in-out infinite; }
        .bot-black-chrome      { animation: savedBotBounce 3s ease-in-out infinite, bcPulse 5s ease-in-out infinite; }
      `}</style>
      <BotCanvas
        botElements={elements}
        robotColor={theme}
        facePixels={facePixels}
        faceColorPalettes={FACE_COLOR_PALETTES}
        starPoints={starPoints}
        width={size}
        height={size * (CONTAINER_H / CONTAINER_W)}
      />
    </div>
  );
}

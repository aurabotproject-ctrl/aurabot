import { useState, useRef, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type ElementType = 'rect' | 'circle' | 'face' | 'chest' | 'group' | 'apple' | 'smiley' | 'heart' | 'thumbsup' | 'lips';

interface BotEl {
  id: string;
  type: ElementType;
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number;
  rx?: number | string;
  color: string;
  scale?: number;
  baseW?: number;
  baseH?: number;
  children?: BotEl[];
  flipX?: boolean;
  flipY?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const generateId = () => Math.random().toString(36).substr(2, 9);
const BOT_COLOR = '#d6edb9';
const DARK_SCREEN = '#111827';
const ZOOM = 0.75;

const INITIAL_ELEMENTS: BotEl[] = [
  { id: 'ant-line', type: 'rect', cx: 280, cy: 90,  w: 10,  h: 40,  rotation: 0, rx: 5,  color: BOT_COLOR },
  { id: 'ant-ball', type: 'circle', cx: 280, cy: 60, w: 30, h: 30, rotation: 0, color: BOT_COLOR },
  { id: 'ear-l',    type: 'rect', cx: 120, cy: 220, w: 40,  h: 90,  rotation: 0, rx: 20, color: BOT_COLOR },
  { id: 'ear-r',    type: 'rect', cx: 440, cy: 220, w: 40,  h: 90,  rotation: 0, rx: 20, color: BOT_COLOR },
  { id: 'head',     type: 'rect', cx: 280, cy: 220, w: 340, h: 220, rotation: 0, rx: 60, color: BOT_COLOR },
  { id: 'face-screen', type: 'face', cx: 280, cy: 220, w: 260, h: 140, rotation: 0, rx: 30, color: DARK_SCREEN },
  { id: 'neck',     type: 'rect', cx: 280, cy: 350, w: 90,  h: 40,  rotation: 0, rx: 20, color: BOT_COLOR },
  { id: 'arm-l',    type: 'rect', cx: 90,  cy: 500, w: 70,  h: 180, rotation: 0, rx: 35, color: BOT_COLOR },
  { id: 'arm-r',    type: 'rect', cx: 470, cy: 500, w: 70,  h: 180, rotation: 0, rx: 35, color: BOT_COLOR },
  { id: 'body',     type: 'rect', cx: 280, cy: 510, w: 380, h: 300, rotation: 0, rx: 80, color: BOT_COLOR },
  { id: 'chest-screen', type: 'chest', cx: 280, cy: 510, w: 260, h: 170, rotation: 0, rx: 40, color: DARK_SCREEN },
  { id: 'leg-l',    type: 'rect', cx: 210, cy: 700, w: 80,  h: 120, rotation: 0, rx: 40, color: BOT_COLOR },
  { id: 'leg-r',    type: 'rect', cx: 350, cy: 700, w: 80,  h: 120, rotation: 0, rx: 40, color: BOT_COLOR },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const FaceContent = () => (
  <div className="w-full h-full flex items-center justify-center" style={{ gap: '15%' }}>
    <div style={{ width: '22%', aspectRatio: '1', borderRadius: '50%', background: '#8be9fd', boxShadow: '0 0 20px #8be9fd, inset 0 0 12px white' }} />
    <div style={{ width: '22%', aspectRatio: '1', borderRadius: '50%', background: '#8be9fd', boxShadow: '0 0 20px #8be9fd, inset 0 0 12px white' }} />
  </div>
);

const ChestContent = () => (
  <div className="w-full h-full flex flex-col items-center justify-center" style={{ containerType: 'inline-size' }}>
    <div style={{ fontSize: '15cqw', fontWeight: 700, letterSpacing: '0.1em', color: '#8be9fd', textShadow: '0 0 10px rgba(139,233,253,0.5)' }}>LVL 5</div>
    <div style={{ fontSize: '7cqw', color: '#9ca3af', fontWeight: 500, marginBottom: '5cqw' }}>400 XP</div>
    <div style={{ width: '75cqw', height: '4cqw', background: '#1f2937', borderRadius: 9999, overflow: 'hidden' }}>
      <div style={{ width: '66%', height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg,#60a5fa,#a855f7)', boxShadow: '0 0 10px rgba(168,85,247,0.5)' }} />
    </div>
  </div>
);

const StickerContent = ({ type }: { type: string }) => {
  const map: Record<string, string> = { apple: '🍎', smiley: '🙂', heart: '❤️', thumbsup: '👍', lips: '👄' };
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ containerType: 'inline-size' }}>
      <div style={{ fontSize: '70cqw', lineHeight: 1 }}>{map[type]}</div>
    </div>
  );
};

// ── Merge helpers ─────────────────────────────────────────────────────────────

const canMerge = (el: BotEl) =>
  ['rect', 'circle', 'group', 'apple', 'smiley', 'heart', 'thumbsup', 'lips'].includes(el.type);

const extractShapes = (el: BotEl): BotEl[] => {
  if (el.type !== 'group') return [el];
  const angle = el.rotation * (Math.PI / 180);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (el.children || []).map(c => {
    const sc = el.scale || 1;
    const absCx = el.cx + (c.cx * sc * cos - c.cy * sc * sin);
    const absCy = el.cy + (c.cx * sc * sin + c.cy * sc * cos);
    return { ...c, id: generateId(), cx: absCx, cy: absCy, rotation: c.rotation + el.rotation, w: c.w * sc, h: c.h * sc, rx: typeof c.rx === 'number' ? c.rx * sc : c.rx, flipX: c.flipX || false, flipY: c.flipY || false };
  });
};

// ── BotElement ────────────────────────────────────────────────────────────────

interface BotElementProps {
  element: BotEl;
  isSelected: boolean;
  isPendingMerge: boolean;
  onPointerDown: (e: React.PointerEvent, actionType: 'drag' | 'rotate' | 'resize') => void;
}

function BotElement({ element, isSelected, isPendingMerge, onPointerDown }: BotElementProps) {
  const { type, cx, cy, w, h, rotation, rx, color, scale = 1, baseW = 0, baseH = 0, children = [], flipX = false, flipY = false } = element;
  const isGroup = type === 'group';
  const isScreen = type === 'face' || type === 'chest';
  const isCircle = type === 'circle';
  const isSticker = ['apple','smiley','heart','thumbsup','lips'].includes(type);

  const neumorphicPart = { boxShadow: 'inset 8px 8px 16px rgba(255,255,255,0.7), inset -8px -8px 16px rgba(0,0,0,0.08), 10px 10px 20px rgba(0,0,0,0.1)' };
  const neumorphicGroup = { filter: 'drop-shadow(10px 10px 15px rgba(0,0,0,0.15)) drop-shadow(-8px -8px 15px rgba(255,255,255,0.8))' };
  const screenInner = { boxShadow: 'inset 0px 0px 20px rgba(0,0,0,0.8)' };

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: cx,
    top: cy,
    width: isGroup ? baseW : w,
    height: isGroup ? baseH : h,
    transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${isGroup ? scale : 1})`,
    borderRadius: isCircle ? '50%' : (rx as number),
    backgroundColor: (isGroup || isSticker) ? 'transparent' : color,
    cursor: isSelected ? 'grab' : 'pointer',
    touchAction: 'none',
    zIndex: isScreen ? 50 : 1,
    ...(isGroup ? neumorphicGroup : isScreen ? screenInner : isSticker ? {} : neumorphicPart),
  };

  const visualStyle: React.CSSProperties = {
    width: '100%', height: '100%',
    transform: isGroup ? 'none' : `scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})`,
    position: 'absolute', left: 0, top: 0,
    borderRadius: 'inherit', pointerEvents: 'none',
  };

  const renderContent = (t: string) => {
    if (t === 'face') return <FaceContent />;
    if (t === 'chest') return <ChestContent />;
    if (['apple','smiley','heart','thumbsup','lips'].includes(t)) return <StickerContent type={t} />;
    return null;
  };

  return (
    <div style={containerStyle} onPointerDown={(e) => onPointerDown(e, 'drag')}>
      <div style={visualStyle}>
        {isGroup && children.map(child => (
          <div key={child.id} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: child.w, height: child.h,
            marginLeft: child.cx, marginTop: child.cy,
            transform: `translate(-50%,-50%) rotate(${child.rotation}deg) scaleX(${child.flipX ? -1 : 1}) scaleY(${child.flipY ? -1 : 1})`,
            backgroundColor: ['apple','smiley','heart','thumbsup','lips'].includes(child.type) ? 'transparent' : (child.color || color),
            borderRadius: child.type === 'circle' ? '50%' : (child.rx as number),
            boxShadow: child.type === 'face' || child.type === 'chest' ? 'inset 0px 0px 20px rgba(0,0,0,0.8)' : 'none',
          }}>
            {renderContent(child.type)}
          </div>
        ))}
        {renderContent(type)}
      </div>

      {isPendingMerge && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', border: '4px dashed #f97316', animation: 'pulse 1s infinite', zIndex: 50 }} />
      )}

      {isSelected && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', border: '2px solid rgba(99,102,241,0.5)' }}>
          {/* Rotate handle */}
          <div
            style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%) translateY(-35px)', pointerEvents: 'auto', cursor: 'crosshair', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 35 }}
            onPointerDown={(e) => onPointerDown(e, 'rotate')}
          >
            <div style={{ width: 2, height: 20, background: '#6366f1' }} />
            <div style={{ width: 16, height: 16, background: 'white', border: '2px solid #6366f1', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
          </div>
          {/* Resize handle */}
          {!isScreen && (
            <div
              style={{ position: 'absolute', bottom: 0, right: 0, transform: 'translate(50%,50%)', width: 24, height: 24, background: 'white', border: '2px solid #6366f1', borderRadius: '50%', pointerEvents: 'auto', cursor: 'nwse-resize', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onPointerDown={(e) => onPointerDown(e, 'resize')}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(99,102,241,0.5)' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface BuildABotPageProps {
  onBack: () => void;
}

export default function BuildABotPage({ onBack }: BuildABotPageProps) {
  const [elements, setElements] = useState<BotEl[]>(INITIAL_ELEMENTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<any>(null);
  const [pendingMergeId, setPendingMergeId] = useState<string | null>(null);
  const [isStickerOpen, setIsStickerOpen] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef<{ id: string | null; time: number }>({ id: null, time: 0 });

  const selectedEl = elements.find(e => e.id === selectedId);

  // ── Merge / unmerge ────────────────────────────────────────────────────────

  const mergeElements = (el1: BotEl, el2: BotEl) => {
    const allShapes = [...extractShapes(el1), ...extractShapes(el2)];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    allShapes.forEach(s => {
      minX = Math.min(minX, s.cx - s.w / 2);
      maxX = Math.max(maxX, s.cx + s.w / 2);
      minY = Math.min(minY, s.cy - s.h / 2);
      maxY = Math.max(maxY, s.cy + s.h / 2);
    });
    const groupCx = (minX + maxX) / 2;
    const groupCy = (minY + maxY) / 2;
    const baseW = maxX - minX;
    const baseH = maxY - minY;
    const groupChildren = allShapes.map(s => ({ ...s, cx: s.cx - groupCx, cy: s.cy - groupCy }));
    const newGroup: BotEl = { id: generateId(), type: 'group', cx: groupCx, cy: groupCy, w: baseW, h: baseH, baseW, baseH, rotation: 0, scale: 1, children: groupChildren, color: allShapes[0].color };
    setElements(prev => [...prev.filter(e => e.id !== el1.id && e.id !== el2.id), newGroup]);
    setSelectedId(newGroup.id);
  };

  const unmergeSelected = () => {
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.type !== 'group') return;
    setElements(prev => [...prev.filter(e => e.id !== selectedId), ...extractShapes(el)]);
    setSelectedId(null);
    setPendingMergeId(null);
  };

  // ── Interactions ───────────────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent, id: string, actionType: 'drag' | 'rotate' | 'resize') => {
    e.stopPropagation();
    const targetEl = elements.find(el => el.id === id);
    const now = Date.now();
    const isDoubleTap = lastTap.current.id === id && (now - lastTap.current.time < 350);
    lastTap.current = { id, time: now };

    if (isDoubleTap && targetEl && canMerge(targetEl)) {
      if (!pendingMergeId) { setPendingMergeId(id); setSelectedId(id); return; }
      else if (pendingMergeId === id) { setPendingMergeId(null); return; }
      else {
        const el1 = elements.find(el => el.id === pendingMergeId);
        if (el1 && canMerge(el1)) { mergeElements(el1, targetEl); setPendingMergeId(null); return; }
      }
    }

    if (e.shiftKey && selectedId && selectedId !== id) {
      const sel = elements.find(el => el.id === selectedId);
      if (targetEl && sel && canMerge(targetEl) && canMerge(sel)) { mergeElements(sel, targetEl); return; }
    }

    setSelectedId(id);
    if (!actionType || !targetEl || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setAction({ type: actionType, id, startCx: targetEl.cx, startCy: targetEl.cy, startW: targetEl.w, startH: targetEl.h, startRot: targetEl.rotation, startScale: targetEl.scale || 1, startMx: (e.clientX - rect.left) / ZOOM, startMy: (e.clientY - rect.top) / ZOOM });
  };

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!action || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / ZOOM;
      const my = (e.clientY - rect.top) / ZOOM;
      setElements(prev => prev.map(el => {
        if (el.id !== action.id) return el;
        let next = { ...el };
        if (action.type === 'drag') { next.cx = action.startCx + (mx - action.startMx); next.cy = action.startCy + (my - action.startMy); }
        else if (action.type === 'rotate') { next.rotation = Math.atan2(my - el.cy, mx - el.cx) * (180 / Math.PI) + 90; }
        else if (action.type === 'resize') {
          if (el.type === 'group') {
            const sd = Math.max(1, Math.hypot(action.startMx - action.startCx, action.startMy - action.startCy));
            const cd = Math.max(1, Math.hypot(mx - el.cx, my - el.cy));
            next.scale = Math.max(0.2, action.startScale * (cd / sd));
          } else {
            const ar = (el.rotation * Math.PI) / 180;
            const cos = Math.cos(-ar); const sin = Math.sin(-ar);
            const vx = mx - el.cx; const vy = my - el.cy;
            next.w = Math.max(30, Math.abs(vx * cos - vy * sin) * 2);
            next.h = Math.max(30, Math.abs(vx * sin + vy * cos) * 2);
          }
        }
        return next;
      }));
    };
    const handleUp = () => setAction(null);
    if (action) { window.addEventListener('pointermove', handleMove); window.addEventListener('pointerup', handleUp); }
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); };
  }, [action]);

  // ── Toolbar actions ────────────────────────────────────────────────────────

  const addShape = (type: ElementType) => {
    const baseColor = elements.find(e => e.type !== 'face' && e.type !== 'chest')?.color || BOT_COLOR;
    const isSticker = ['apple','smiley','heart','thumbsup','lips'].includes(type);
    const newEl: BotEl = { id: generateId(), type, cx: 280, cy: 400, w: (type === 'face' || type === 'chest') ? 240 : isSticker ? 100 : 150, h: (type === 'face' || type === 'chest') ? 140 : isSticker ? 100 : 150, rotation: 0, rx: type === 'circle' ? '50%' : 24, color: (type === 'face' || type === 'chest') ? DARK_SCREEN : isSticker ? 'transparent' : baseColor };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const deleteSelected = () => { setElements(elements.filter(e => e.id !== selectedId)); setSelectedId(null); setPendingMergeId(null); };

  const duplicateSelected = () => {
    if (!selectedEl) return;
    const copy = { ...selectedEl, id: generateId(), cx: selectedEl.cx + 30, cy: selectedEl.cy + 30 };
    setElements([...elements, copy]);
    setSelectedId(copy.id);
  };

  const changeLayer = (dir: 'up' | 'down') => {
    const idx = elements.findIndex(e => e.id === selectedId);
    if (idx < 0) return;
    const arr = [...elements];
    if (dir === 'up' && idx < arr.length - 1) [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    else if (dir === 'down' && idx > 0) [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    setElements(arr);
  };

  const flipSelected = (axis: 'horizontal' | 'vertical') => {
    setElements(elements.map(e => {
      if (e.id !== selectedId) return e;
      const isH = axis === 'horizontal';
      const upd: BotEl = { ...e, rotation: isH ? -e.rotation : (180 - e.rotation), flipX: isH ? !(e.flipX || false) : (e.flipX || false), flipY: !isH ? !(e.flipY || false) : (e.flipY || false) };
      if (e.type === 'group') upd.children = (e.children || []).map(c => ({ ...c, cx: isH ? -c.cx : c.cx, cy: !isH ? -c.cy : c.cy, rotation: isH ? -c.rotation : (180 - c.rotation), flipX: isH ? !c.flipX : c.flipX, flipY: !isH ? !c.flipY : c.flipY }));
      return upd;
    }));
  };

  const updateColor = (color: string) => {
    setElements(elements.map(e => {
      if (['face','chest','apple','smiley','heart','thumbsup','lips'].includes(e.type)) return e;
      if (e.type === 'group') return { ...e, color, children: (e.children || []).map(c => ({ ...c, color })) };
      return { ...e, color };
    }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: '#f9fafb', overflow: 'hidden', fontFamily: 'sans-serif', userSelect: 'none' }}>

      {/* SIDEBAR */}
      <div style={{ width: 280, background: 'white', borderRight: '1px solid #e5e7eb', boxShadow: '4px 0 20px rgba(0,0,0,0.08)', zIndex: 10, display: 'flex', flexDirection: 'column', padding: 24, overflowY: 'auto' }}>

        {/* Back button */}
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '10px 14px', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', boxShadow: '0 4px 12px rgba(102,126,234,0.4)' }}
        >
          ← Dashboard
        </button>

        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1f2937', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          🤖 Build a Bot
        </h1>
        <p style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 500, marginBottom: 24, lineHeight: 1.4 }}>
          Tip: Hold Shift + Click (or Double-Tap) pieces to merge!
        </p>

        {/* Add Shapes */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Add Shapes</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Circle', shape: 'circle' as ElementType, icon: '⭕' },
              { label: 'Rounded', shape: 'rect' as ElementType, icon: '▭' },
            ].map(({ label, shape, icon }) => (
              <button key={shape} onClick={() => addShape(shape)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 6px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: '#374151', gap: 6 }}>
                <span style={{ fontSize: '1.2rem' }}>{icon}</span>{label}
              </button>
            ))}

            {/* Stickers dropdown */}
            <div style={{ gridColumn: 'span 2', position: 'relative' }}>
              <button onClick={() => setIsStickerOpen(!isStickerOpen)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>😊 Add Sticker</span>
                <span style={{ transform: isStickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
              </button>
              {isStickerOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: '100%', background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 20, overflow: 'hidden' }}>
                  {[['apple','🍎','Apple'],['smiley','🙂','Smiley'],['heart','❤️','Heart'],['thumbsup','👍','Thumbs Up'],['lips','👄','Lips']].map(([t, icon, label]) => (
                    <button key={t} onClick={() => { addShape(t as ElementType); setIsStickerOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: '#374151' }}>
                      <span style={{ fontSize: '1.4rem' }}>{icon}</span>{label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit Selected */}
        <div style={{ opacity: selectedId ? 1 : 0.3, pointerEvents: selectedId ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Edit Selected</div>

          {/* Color picker */}
          {(selectedEl?.type === 'rect' || selectedEl?.type === 'circle' || selectedEl?.type === 'group') && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', marginBottom: 8 }}>Global Base Color</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={selectedEl.color} onChange={e => updateColor(e.target.value)} style={{ width: 40, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer', padding: 0 }} />
                <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#9ca3af' }}>{selectedEl.color}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['↑ Forward', () => changeLayer('up')], ['↓ Back', () => changeLayer('down')], ['⇔ Flip H', () => flipSelected('horizontal')], ['⇕ Flip V', () => flipSelected('vertical')]].map(([label, fn]) => (
              <button key={label as string} onClick={fn as () => void} style={{ padding: '8px 6px', background: '#f3f4f6', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>{label as string}</button>
            ))}
            {!(selectedEl?.type === 'face' || selectedEl?.type === 'chest') && (
              <>
                <button onClick={duplicateSelected} style={{ padding: '8px 6px', background: '#eff6ff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: '#3b82f6', marginTop: 4 }}>⧉ Duplicate</button>
                <button onClick={deleteSelected} style={{ padding: '8px 6px', background: '#fef2f2', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: '#ef4444', marginTop: 4 }}>✕ Delete</button>
              </>
            )}
            {selectedEl?.type === 'group' && (
              <button onClick={unmergeSelected} style={{ gridColumn: 'span 2', padding: '8px 6px', background: '#fff7ed', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: '#f97316', marginTop: 4 }}>⛓ Unmerge Shapes</button>
            )}
          </div>
        </div>

        {/* Save & Reset */}
        <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Save button */}
          <button
            onClick={() => {
              localStorage.setItem('savedBot', JSON.stringify(elements));
              setSaveFlash(true);
              setTimeout(() => setSaveFlash(false), 1800);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '13px',
              background: saveFlash
                ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                : 'linear-gradient(135deg,#43e97b,#38f9d7,#4facfe)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 700,
              boxShadow: saveFlash
                ? '0 4px 12px rgba(34,197,94,0.5)'
                : '0 4px 12px rgba(67,233,123,0.4)',
              transition: 'background 0.3s, box-shadow 0.3s',
              letterSpacing: '0.04em',
            }}
          >
            {saveFlash ? '✓ Saved to Profile!' : '💾 Save Bot to Profile'}
          </button>

          <button onClick={() => { setElements(INITIAL_ELEMENTS); setSelectedId(null); setPendingMergeId(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: '#1f2937', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            ↺ Reset Bot
          </button>
        </div>
      </div>

      {/* CANVAS */}
      <div
        style={{ flex: 1, overflow: 'auto', background: 'radial-gradient(circle at 50% 50%, #fff0f5 0%, #f4f0ff 100%)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onPointerDown={() => { setSelectedId(null); setPendingMergeId(null); setIsStickerOpen(false); }}
      >
        <div
          ref={canvasRef}
          style={{ position: 'relative', width: 800, height: 850, transform: `scale(${ZOOM})`, transformOrigin: 'center center' }}
        >
          {elements.map(el => (
            <BotElement
              key={el.id}
              element={el}
              isSelected={el.id === selectedId}
              isPendingMerge={el.id === pendingMergeId}
              onPointerDown={(e, actionType) => handlePointerDown(e, el.id, actionType)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

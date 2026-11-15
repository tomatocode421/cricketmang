import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FIELD, SCORING_AREAS, clampToField, fieldPositions } from '../data/positions.js';

const { cx, cy, rx, ry, innerRx, innerRy, strikerY, bowlerY } = FIELD;

const initials = (name) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Point on the line from the striker at angle (0 = towards bowler, +ve = off side / left).
const rayPoint = (deg, dist) => {
  const r = (deg * Math.PI) / 180;
  return [cx - Math.sin(r) * dist, strikerY + Math.cos(r) * dist];
};

function wedgePath(from, to) {
  const pts = [];
  for (let a = from; a <= to; a += 2) pts.push(rayPoint(a, 1400));
  pts.push(rayPoint(to, 1400));
  return `M ${cx} ${strikerY} ` + pts.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
}

// Lay out name labels so they do not overlap each other or the markers.
function layoutLabels(markers, k = 1) {
  const boxes = markers.map((m) => ({ x: m.x - 20, y: m.y - 20, w: 40, h: 40 }));
  const overlaps = (a) => boxes.some((b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
  const inField = (b) => b.x > 10 && b.x + b.w < FIELD.width - 10 && b.y > 8 && b.y + b.h < FIELD.height - 8;
  const out = {};
  for (const m of markers) {
    const text = m.label;
    const w = Math.max(30, text.length * 9.6 * k + 12);
    const h = 22 * k;
    const candidates = [
      { x: m.x - w / 2, y: m.y + 23, anchor: 'middle', tx: m.x, ty: m.y + 23 + 16 * k },
      { x: m.x - w / 2, y: m.y - 23 - h, anchor: 'middle', tx: m.x, ty: m.y - 23 - 6 * k },
      { x: m.x + 24, y: m.y - h / 2, anchor: 'start', tx: m.x + 26, ty: m.y + 6 * k },
      { x: m.x - 24 - w, y: m.y - h / 2, anchor: 'end', tx: m.x - 26, ty: m.y + 6 * k },
      { x: m.x - w / 2, y: m.y + 23 + h, anchor: 'middle', tx: m.x, ty: m.y + 23 + h + 16 * k },
      { x: m.x - w / 2, y: m.y - 23 - 2 * h, anchor: 'middle', tx: m.x, ty: m.y - 23 - h - 6 * k },
    ];
    const pick = candidates.find((c) => {
      const b = { x: c.x, y: c.y, w, h };
      return inField(b) && !overlaps(b);
    });
    if (pick) {
      boxes.push({ x: pick.x, y: pick.y, w, h });
      out[m.id] = pick;
    } else out[m.id] = null; // no room: name stays available on hover
  }
  return out;
}

export default function CricketField({
  positions = {},
  focusedId,
  onMarkerClick,
  showInactive = true,
  heat = null, // { areaId: weight }
  highlightAreas = [],
  compact = false,
  leftHanded = false, // mirror the field for a left-handed batter
  custom = [], // the setup's own custom positions
  onMove = null, // (id, x, y) — when given, fielders can be dragged around the field
  zoom = 1,
}) {
  const mirror = (x) => (leftHanded ? FIELD.width - x : x);
  const POS = fieldPositions({ positions, custom }).map((p) => ({ ...p, x: mirror(p.x) }));
  const wedge = (a) => (leftHanded ? wedgePath(-a.to, -a.from) : wedgePath(a.from, a.to));
  // On small screens, scale text up so names stay readable.
  const svgRef = useRef();
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (w) setK(Math.max(1, Math.min(1.9, 560 / w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const small = k > 1.3;
  const kz = Math.max(0.7, k / zoom);

  // ----- Zoom: centre on the selected fielder, or the middle of the field -----
  const focusPos = POS.find((p) => p.id === focusedId);
  const vw = FIELD.width / zoom;
  const vh = FIELD.height / zoom;
  const fx = zoom > 1 && focusPos ? focusPos.x : FIELD.cx;
  const fy = zoom > 1 && focusPos ? focusPos.y : FIELD.cy;
  const vx = Math.min(Math.max(0, fx - vw / 2), FIELD.width - vw);
  const vy = Math.min(Math.max(0, fy - vh / 2), FIELD.height - vh);

  // ----- Dragging fielders (mouse, touch and pen; touch events for older iPhones) -----
  const drag = useRef(null);
  const frame = useRef(0);
  const toField = (clientX, clientY) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };
  const startDrag = (id, clientX, clientY) => {
    if (!onMove) return;
    drag.current = { id, start: { clientX, clientY }, moved: false };
  };
  const moveDrag = (clientX, clientY) => {
    const d = drag.current;
    if (!d) return false;
    if (!d.moved && Math.hypot(clientX - d.start.clientX, clientY - d.start.clientY) < 4) return true;
    d.moved = true;
    const p = toField(clientX, clientY);
    if (!p) return true;
    const c = clampToField(mirror(p.x), p.y); // stored for a right-hander
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => onMove(d.id, c.x, c.y));
    return true;
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    return d;
  };
  const markerHandlers = (id) =>
    onMove
      ? {
          onPointerDown: (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            e.currentTarget.ownerSVGElement?.setPointerCapture?.(e.pointerId);
            startDrag(id, e.clientX, e.clientY);
          },
          onTouchStart: (e) => {
            if (window.PointerEvent) return;
            const t = e.touches[0];
            startDrag(id, t.clientX, t.clientY);
          },
          onClick: (e) => {
            if (wasDragged.current) {
              e.stopPropagation();
              wasDragged.current = false;
              return;
            }
            onMarkerClick?.(id);
          },
        }
      : { onClick: () => onMarkerClick?.(id) };
  const wasDragged = useRef(false);
  const svgHandlers = onMove
    ? {
        onPointerMove: (e) => moveDrag(e.clientX, e.clientY),
        onPointerUp: () => {
          const d = endDrag();
          wasDragged.current = !!d?.moved;
        },
        onPointerCancel: endDrag,
        onTouchMove: (e) => {
          if (window.PointerEvent || !drag.current) return;
          e.preventDefault();
          moveDrag(e.touches[0].clientX, e.touches[0].clientY);
        },
        onTouchEnd: () => {
          if (window.PointerEvent) return;
          const d = endDrag();
          if (d && !d.moved) onMarkerClick?.(d.id);
          wasDragged.current = !!d?.moved;
        },
      }
    : {};
  const active = POS.filter((p) => positions[p.id]?.active);
  const markers = active.map((p) => {
    const name = positions[p.id]?.player?.trim() || '';
    return { id: p.id, x: p.x, y: p.y, name, label: name || p.name, pos: p };
  });
  const labels = useMemo(() => layoutLabels(markers, kz), [JSON.stringify(markers.map((m) => [m.id, m.label, Math.round(m.x), Math.round(m.y)])), kz, leftHanded]); // eslint-disable-line
  const maxHeat = heat ? Math.max(1, ...Object.values(heat)) : 1;

  return (
    <svg
      ref={svgRef}
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      role="img"
      aria-label="Cricket field diagram"
      preserveAspectRatio="xMidYMid meet"
      className={onMove ? 'field-editable' : ''}
      {...svgHandlers}
    >
      <defs>
        <clipPath id="oval">
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
        </clipPath>
        <radialGradient id="grass" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#3f8a4a" />
          <stop offset="70%" stopColor="#2f7339" />
          <stop offset="100%" stopColor="#25602e" />
        </radialGradient>
        <radialGradient id="square" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4c9a55" />
          <stop offset="100%" stopColor="#3f8a4a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pitch" x1="0" x2="1">
          <stop offset="0%" stopColor="#c7ad7a" />
          <stop offset="50%" stopColor="#d6bf8e" />
          <stop offset="100%" stopColor="#c4a975" />
        </linearGradient>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Surrounds beyond the rope */}
      <ellipse cx={cx} cy={cy} rx={rx + 22} ry={ry + 24} fill="#1f4a27" />
      {/* Outfield with mowing stripes */}
      <g clipPath="url(#oval)">
        <rect width={FIELD.width} height={FIELD.height} fill="url(#grass)" />
        {Array.from({ length: 16 }, (_, i) => (
          <rect key={i} x="0" y={i * 70} width={FIELD.width} height="35" fill="#ffffff" opacity="0.035" />
        ))}
        <ellipse cx={cx} cy={cy} rx={innerRx} ry={innerRy} fill="url(#square)" opacity="0.6" />
        {heat &&
          SCORING_AREAS.map((a) => {
            const w = heat[a.id] || 0;
            if (!w) return null;
            const t = w / maxHeat;
            return <path key={a.id} d={wedge(a)} fill={`rgb(${Math.round(230 + 25 * t)}, ${Math.round(170 - 110 * t)}, 60)`} opacity={0.18 + 0.42 * t} />;
          })}
        {highlightAreas.map((id) => {
          const a = SCORING_AREAS.find((x) => x.id === id);
          return a ? <path key={'h' + id} d={wedge(a)} fill="none" stroke="#ffd27a" strokeWidth="3" strokeDasharray="10 8" /> : null;
        })}
      </g>
      {/* Boundary rope */}
      <ellipse cx={cx} cy={cy} rx={rx - 4} ry={ry - 4} fill="none" stroke="#f4f1e6" strokeWidth="4" opacity="0.9" />
      {/* 30-yard circle */}
      <ellipse cx={cx} cy={cy} rx={innerRx} ry={innerRy} fill="none" stroke="#e8f5ea" strokeWidth="2.5" strokeDasharray="10 12" opacity="0.55" />

      {/* Off / leg labels */}
      {!compact && (
        <g fontSize="20" fontWeight="700" letterSpacing="4" fill="#cfe3d4" opacity="0.45">
          <text x="14" y="36">{leftHanded ? 'LEG SIDE' : 'OFF SIDE'}</text>
          <text x={FIELD.width - 14} y="36" textAnchor="end">
            {leftHanded ? 'OFF SIDE' : 'LEG SIDE'}
          </text>
        </g>
      )}

      {/* Pitch */}
      <g>
        <rect x={cx - 21} y={strikerY - 22} width="42" height={bowlerY - strikerY + 44} rx="3" fill="url(#pitch)" stroke="#a88f5f" strokeWidth="1" />
        {[strikerY, bowlerY].map((y, i) => {
          const pop = i === 0 ? y + 14 : y - 14;
          return (
            <g key={y} stroke="#ffffff" strokeWidth="2" opacity="0.9">
              <line x1={cx - 30} x2={cx + 30} y1={pop} y2={pop} />
              <line x1={cx - 16} x2={cx + 16} y1={y} y2={y} />
              <line x1={cx - 16} x2={cx - 16} y1={y - 10} y2={y + 10} />
              <line x1={cx + 16} x2={cx + 16} y1={y - 10} y2={y + 10} />
              <rect x={cx - 5} y={y - 2} width="10" height="4" fill="#f0e2c0" stroke="none" />
            </g>
          );
        })}
        {!compact && (
          <g fontSize="15" fill="#e9f5ec" opacity="0.75" textAnchor="middle" fontWeight="600">
            <text x={cx} y={strikerY - 30}>
              Striker&apos;s end
            </text>
            <text x={cx} y={bowlerY + 42}>
              Bowler&apos;s end
            </text>
          </g>
        )}
        {/* Batter */}
        <circle cx={leftHanded ? cx - 10 : cx + 10} cy={strikerY + 8} r="6" fill="#f6f6f6" stroke="#1d3a23" strokeWidth="1.5" />
      </g>

      {/* Inactive positions */}
      {showInactive &&
        POS.filter((p) => !positions[p.id]?.active).map((p) => (
          <g key={p.id} className="marker" onClick={() => onMarkerClick?.(p.id)} opacity={focusedId === p.id ? 1 : 0.55} data-pos={p.id}>
            <title>{`${p.name} (not selected)`}</title>
            <circle cx={p.x} cy={p.y} r={focusedId === p.id ? 10 : 6} fill="none" stroke="#e8f5ea" strokeWidth="2" strokeDasharray={focusedId === p.id ? '' : '3 3'} />
            {!compact && !small && !markers.some((mk) => Math.hypot(mk.x - p.x, mk.y - p.y) < 70) && (
              <text x={p.x} y={p.y + 24} fontSize="15" fill="#e8f5ea" textAnchor="middle" opacity="0.85">
                {p.name}
              </text>
            )}
          </g>
        ))}

      {/* Active fielders */}
      {markers.map((m) => {
        const l = labels[m.id];
        const focused = focusedId === m.id;
        return (
          <g key={m.id} className={`marker ${onMove ? 'draggable' : ''}`} filter="url(#shadow)" data-pos={m.id} {...markerHandlers(m.id)}>
            <title>{`${m.pos.name}: ${m.name || 'no player entered'}`}</title>
            {focused && <circle cx={m.x} cy={m.y} r="27" fill="none" stroke="#ffd27a" strokeWidth="3" />}
            <circle cx={m.x} cy={m.y} r="19" fill={m.name ? '#1f9d55' : '#2c5a3a'} stroke="#ffffff" strokeWidth="2.5" />
            <text x={m.x} y={m.y + 5.5} fontSize="14.5" fontWeight="700" fill="#fff" textAnchor="middle">
              {m.name ? initials(m.name) : '?'}
            </text>
            {l && !compact && (
              <text x={l.tx} y={l.ty} textAnchor={l.anchor} className="marker-label" fontSize={17 * kz} fill={m.name ? '#ffffff' : '#cfe3d4'} fontStyle={m.name ? 'normal' : 'italic'}>
                {m.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

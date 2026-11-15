// Fielding positions for a right-handed batter.
// Coordinates are in the cricket field SVG viewBox (0 0 1000 1100).
// Striker's end is at the top of the pitch, bowler's end at the bottom.
// Off side is on the LEFT of the diagram, leg side on the RIGHT.

export const FIELD = {
  width: 1000,
  height: 1100,
  cx: 500,
  cy: 550,
  rx: 470,
  ry: 520,
  innerRx: 300,
  innerRy: 330,
  strikerY: 440,
  bowlerY: 660,
};

export const POSITION_GROUPS = [
  { id: 'close', label: 'Close catching positions' },
  { id: 'inner', label: 'Inner circle positions' },
  { id: 'outer', label: 'Outer field positions' },
];

export const POSITIONS = [
  // Close catching
  { id: 'wk', name: 'Wicketkeeper', group: 'close', x: 500, y: 368, area: 'behind' },
  { id: 'slip1', name: 'First Slip', group: 'close', x: 444, y: 376, area: 'behind' },
  { id: 'slip2', name: 'Second Slip', group: 'close', x: 392, y: 390, area: 'behind' },
  { id: 'slip3', name: 'Third Slip', group: 'close', x: 342, y: 408, area: 'behind' },
  { id: 'gully', name: 'Gully', group: 'close', x: 292, y: 440, area: 'point' },
  { id: 'shortleg', name: 'Short Leg', group: 'close', x: 590, y: 452, area: 'squareleg' },
  { id: 'sillypoint', name: 'Silly Point', group: 'close', x: 412, y: 458, area: 'point' },
  { id: 'sillymidoff', name: 'Silly Mid-off', group: 'close', x: 444, y: 530, area: 'straight' },
  { id: 'sillymidon', name: 'Silly Mid-on', group: 'close', x: 556, y: 530, area: 'straight' },
  // Inner circle
  { id: 'point', name: 'Point', group: 'inner', x: 205, y: 500, area: 'point' },
  { id: 'backwardpoint', name: 'Backward Point', group: 'inner', x: 236, y: 382, area: 'point' },
  { id: 'cover', name: 'Cover', group: 'inner', x: 240, y: 640, area: 'cover' },
  { id: 'extracover', name: 'Extra Cover', group: 'inner', x: 316, y: 742, area: 'extracover' },
  { id: 'midoff', name: 'Mid-off', group: 'inner', x: 410, y: 800, area: 'straight' },
  { id: 'midon', name: 'Mid-on', group: 'inner', x: 590, y: 800, area: 'straight' },
  { id: 'midwicket', name: 'Mid-wicket', group: 'inner', x: 760, y: 660, area: 'midwicket' },
  { id: 'squareleg', name: 'Square Leg', group: 'inner', x: 795, y: 480, area: 'squareleg' },
  { id: 'shortfineleg', name: 'Short Fine Leg', group: 'inner', x: 650, y: 340, area: 'fineleg' },
  // Outer field
  { id: 'thirdman', name: 'Third Man', group: 'outer', x: 270, y: 138, area: 'thirdman' },
  { id: 'deeppoint', name: 'Deep Point', group: 'outer', x: 70, y: 478, area: 'point' },
  { id: 'deepcover', name: 'Deep Cover', group: 'outer', x: 118, y: 776, area: 'cover' },
  { id: 'longoff', name: 'Long-off', group: 'outer', x: 388, y: 1020, area: 'straight' },
  { id: 'longon', name: 'Long-on', group: 'outer', x: 612, y: 1020, area: 'straight' },
  { id: 'deepmidwicket', name: 'Deep Mid-wicket', group: 'outer', x: 882, y: 776, area: 'midwicket' },
  { id: 'deepsquareleg', name: 'Deep Square Leg', group: 'outer', x: 930, y: 478, area: 'squareleg' },
  { id: 'deepfineleg', name: 'Deep Fine Leg', group: 'outer', x: 722, y: 132, area: 'fineleg' },
  { id: 'fineleg', name: 'Fine Leg', group: 'outer', x: 740, y: 250, area: 'fineleg' },
];

export const POSITION_BY_ID = Object.fromEntries(POSITIONS.map((p) => [p.id, p]));

// Scoring regions used by the heatmap. Angles are measured from the striker,
// 0° = straight down the ground towards the bowler, positive = off side (left).
export const SCORING_AREAS = [
  { id: 'straight', name: 'Straight', from: -22, to: 22 },
  { id: 'extracover', name: 'Extra Cover', from: 22, to: 50 },
  { id: 'cover', name: 'Cover', from: 50, to: 78 },
  { id: 'point', name: 'Point', from: 78, to: 112 },
  { id: 'thirdman', name: 'Third Man', from: 112, to: 165 },
  { id: 'behind', name: 'Behind Square (keeper / slips)', from: 165, to: 195 },
  { id: 'fineleg', name: 'Fine Leg', from: -165, to: -112 },
  { id: 'squareleg', name: 'Square Leg', from: -112, to: -68 },
  { id: 'midwicket', name: 'Mid-wicket', from: -68, to: -22 },
];

export const SCORING_AREA_BY_ID = Object.fromEntries(SCORING_AREAS.map((a) => [a.id, a]));

// Positions that protect each scoring area (used for fielding suggestions).
export const AREA_PROTECTION = {
  straight: ['midoff', 'midon', 'longoff', 'longon'],
  extracover: ['extracover', 'deepcover', 'longoff'],
  cover: ['cover', 'deepcover', 'extracover'],
  point: ['point', 'backwardpoint', 'deeppoint', 'gully'],
  thirdman: ['thirdman', 'backwardpoint', 'gully'],
  behind: ['wk', 'slip1', 'slip2', 'thirdman'],
  fineleg: ['fineleg', 'shortfineleg', 'deepfineleg'],
  squareleg: ['squareleg', 'deepsquareleg', 'shortleg'],
  midwicket: ['midwicket', 'deepmidwicket', 'midon'],
};

// One-tap field templates (10 fielders + the bowler). "outer" counts fielders outside the 30-yard circle.
export const FIELD_TEMPLATES = [
  { id: 'balanced', name: 'Balanced', note: 'A standard field for most situations.', positions: ['wk', 'slip1', 'point', 'cover', 'midoff', 'midon', 'midwicket', 'squareleg', 'fineleg', 'thirdman'] },
  { id: 'newball', name: 'Attacking new ball', note: 'Three slips and a gully for early movement.', positions: ['wk', 'slip1', 'slip2', 'slip3', 'gully', 'point', 'cover', 'midoff', 'midon', 'fineleg'] },
  { id: 'spin', name: 'Spin attack', note: 'Close catchers either side of the bat.', positions: ['wk', 'slip1', 'shortleg', 'sillypoint', 'cover', 'midoff', 'midon', 'midwicket', 'squareleg', 'longon'] },
  { id: 'powerplay', name: 'Powerplay (2 out)', note: 'Only two fielders outside the circle.', positions: ['wk', 'slip1', 'point', 'cover', 'midoff', 'midon', 'midwicket', 'squareleg', 'thirdman', 'fineleg'] },
  { id: 'death', name: 'Death overs (5 out)', note: 'Protect the boundary in the last overs.', positions: ['wk', 'point', 'cover', 'midoff', 'shortfineleg', 'deeppoint', 'longoff', 'longon', 'deepmidwicket', 'deepsquareleg'] },
  { id: 'defensive', name: 'Defensive', note: 'Save runs with sweepers on both sides.', positions: ['wk', 'point', 'cover', 'midoff', 'midon', 'deeppoint', 'deepcover', 'longon', 'deepmidwicket', 'deepfineleg'] },
];

// ---------- Custom positioning ----------
// Coordinates use the field drawing's own units (x 0–1000, y 0–1100) for a right-handed
// batter, so they stay exact whatever the window size. Left-handers are mirrored on display.
const inEllipse = (x, y, rx, ry) => ((x - FIELD.cx) / rx) ** 2 + ((y - FIELD.cy) / ry) ** 2 <= 1;

// Keep a point on the playing area (inside the boundary rope).
export function clampToField(x, y) {
  const rx = FIELD.rx - 30;
  const ry = FIELD.ry - 30;
  const dx = x - FIELD.cx;
  const dy = y - FIELD.cy;
  const k = (dx / rx) ** 2 + (dy / ry) ** 2;
  if (k <= 1) return { x: Math.round(x), y: Math.round(y) };
  const f = 1 / Math.sqrt(k);
  return { x: Math.round(FIELD.cx + dx * f), y: Math.round(FIELD.cy + dy * f) };
}

// Every position available in a setup: standard ones (with any moved coordinates or new
// name) followed by the setup's own custom positions.
export function fieldPositions(setup) {
  const pos = setup?.positions || {};
  const std = POSITIONS.map((p) => {
    const st = pos[p.id] || {};
    const x = st.x ?? p.x;
    const y = st.y ?? p.y;
    return { ...p, x, y, name: st.label?.trim() || p.name, standardName: p.name, moved: st.x != null, custom: false };
  });
  const custom = (setup?.custom || []).map((c) => {
    const st = pos[c.id] || {};
    return { id: c.id, name: st.label?.trim() || c.name, standardName: c.name, group: 'custom', x: st.x ?? c.x ?? FIELD.cx, y: st.y ?? c.y ?? 820, custom: true, moved: false };
  });
  return [...std, ...custom].map((p) => ({ ...p, area: areaAt(p.x, p.y), outer: !inEllipse(p.x, p.y, FIELD.innerRx, FIELD.innerRy) }));
}

// Which scoring area a point on the field is in (angle from the striker).
export function areaAt(x, y) {
  const dx = FIELD.cx - x; // off side (left) is positive
  const dy = y - FIELD.strikerY;
  let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (deg > 195) deg -= 360;
  if (deg < -165 && deg >= -180) deg += 360;
  const a = SCORING_AREAS.find((s) => deg >= s.from && deg < s.to);
  return a ? a.id : Math.abs(deg) > 165 ? 'behind' : 'straight';
}

// Fill a template, keeping fielders already on the field and putting the keeper behind the stumps.
export function applyFieldTemplate(setup, template, keeperName) {
  const before = setup.positions || {};
  const all = fieldPositions(setup);
  const onField = all.filter((p) => before[p.id]?.active && before[p.id].player?.trim()).map((p) => ({ pos: p.id, name: before[p.id].player.trim() }));
  const next = {};
  template.positions.forEach((pid) => {
    const kept = onField.find((x) => x.pos === pid);
    next[pid] = { active: true, player: kept ? kept.name : '' };
  });
  if (next.wk && !next.wk.player && keeperName) next.wk.player = keeperName;
  const used = new Set(Object.values(next).map((v) => v.player.toLowerCase()).filter(Boolean));
  const spare = onField.filter((x) => !used.has(x.name.toLowerCase()));
  template.positions.forEach((pid) => {
    if (!next[pid].player && spare.length) next[pid].player = spare.shift().name;
  });
  return next;
}

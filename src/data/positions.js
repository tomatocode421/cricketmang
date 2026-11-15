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

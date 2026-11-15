// Data model, defaults and pure helper functions (no React).

export const DATA_VERSION = 1;

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const MATCH_FORMATS = [
  { id: 'T20', label: 'T20', overs: 20, maxPerBowler: 4, hours: 3.5 },
  { id: '40', label: '40 overs', overs: 40, maxPerBowler: 8, hours: 6 },
  { id: '50', label: '50 overs', overs: 50, maxPerBowler: 10, hours: 7.5 },
  { id: 'other', label: 'Other', overs: null, maxPerBowler: null, hours: 6 },
];

export const formatInfo = (match) => {
  const f = MATCH_FORMATS.find((x) => x.id === match?.format);
  if (!f) return { id: '', label: 'Not set', overs: null, maxPerBowler: null, hours: 6 };
  if (f.id === 'other') {
    const overs = Number(match.customOvers) || null;
    const maxPerBowler = Number(match.customMaxPerBowler) || null;
    return { ...f, overs, maxPerBowler };
  }
  return f;
};

export const TIP_CATEGORIES = [
  'Batting',
  'Bowling',
  'Fielding',
  'Wicketkeeping',
  'Communication',
  'Teamwork',
  'Game Awareness',
  'Strategy and Tactics',
  'General Improvements',
];

export const TIP_STATUSES = ['Not Started', 'In Progress', 'Completed'];

export const NOTE_SECTIONS = [
  { id: 'general', label: 'General observations' },
  { id: 'batting', label: 'Batting performance' },
  { id: 'bowling', label: 'Bowling performance' },
  { id: 'fielding', label: 'Fielding performance' },
  { id: 'players', label: 'Player performances' },
  { id: 'tactics', label: 'Tactical decisions' },
  { id: 'moments', label: 'Important moments' },
  { id: 'well', label: 'What went well' },
  { id: 'badly', label: 'What went badly' },
  { id: 'reflections', label: 'Match reflections' },
];

export const DEFAULT_CHECKLIST = [
  'Check the weather forecast',
  'Confirm the ground and field',
  'Check the pitch conditions',
  'Confirm the 11 players',
  'Review the batting order',
  'Review the bowling order',
  'Review the fielding setup',
  'Review the opposition',
  'Finalise the match-day strategy',
];

export const PITCH_OPTIONS = {
  type: ['Grass', 'Synthetic', 'Turf', 'Other'],
  condition: ['Unknown', 'Dry', 'Damp', 'Wet', 'Hard', 'Soft', 'Cracked'],
  outfield: ['Unknown', 'Fast', 'Average', 'Slow'],
  groundSize: ['Unknown', 'Small', 'Medium', 'Large'],
  behaviour: ['Unknown', 'Yes', 'Somewhat', 'No'],
};

export const PITCH_BEHAVIOUR = [
  { id: 'bounce', label: 'Offers bounce' },
  { id: 'seam', label: 'Assists seam movement' },
  { id: 'swing', label: 'Assists swing' },
  { id: 'spin', label: 'Offers spin' },
  { id: 'flat', label: 'Flat and good for batting' },
];

export const defaultPlayers = () =>
  Array.from({ length: 11 }, (_, i) => ({ id: uid('pl'), name: `Player ${i + 1}` }));

export const newFieldingSetup = (name = 'Standard Field') => ({
  id: uid('fs'),
  name,
  positions: {}, // posId -> { active: bool, player: string }
  updatedAt: Date.now(),
});

export const newMatchDay = () => ({
  groundName: '',
  groundLocation: '',
  field: '',
  pitch: {
    type: '',
    condition: 'Unknown',
    outfield: 'Unknown',
    groundSize: 'Unknown',
    boundaryStraight: '',
    boundarySquare: '',
    boundaryBehind: '',
    boundaryOther: '',
    bounce: 'Unknown',
    seam: 'Unknown',
    swing: 'Unknown',
    spin: 'Unknown',
    flat: 'Unknown',
  },
  groundNotes: '',
  weather: null, // { status, location, fetchedAt, ... }
  research: null, // { status, title, extract, url, fetchedAt }
  groundHistory: { avgFirstInnings: '', chasingTrend: '', source: '' },
  scoring: [], // { id, area, weight, note, kind: 'mine'|'sourced', source }
  notes: '',
  checklist: DEFAULT_CHECKLIST.map((text) => ({ id: uid('ck'), text, done: false, custom: false })),
});

export const newMatch = (players, overrides = {}) => {
  const setup = newFieldingSetup('Standard Field');
  return {
    id: uid('m'),
    name: '',
    opposition: '',
    date: '',
    competition: '',
    format: '',
    customOvers: '',
    customMaxPerBowler: '',
    startTime: '',
    info: '',
    status: 'In Preparation',
    result: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rosterSnapshot: null,
    fielding: { setups: [setup], activeSetupId: setup.id },
    batting: Array.from({ length: 11 }, (_, i) => ({ playerId: players[i]?.id || null, notes: '' })),
    bowling: Array.from({ length: 6 }, () => ({ playerId: null, overs: '', notes: '' })),
    notes: Object.fromEntries(NOTE_SECTIONS.map((s) => [s.id, ''])),
    notesUpdatedAt: null,
    matchDay: newMatchDay(),
    ...overrides,
  };
};

export const initialData = () => {
  const players = defaultPlayers();
  return {
    version: DATA_VERSION,
    players,
    currentMatchId: null,
    matches: [],
    tips: [],
    activity: [],
    savedAt: null,
  };
};

// Make sure older or partial data has every field we expect.
export function normaliseData(raw) {
  const base = initialData();
  if (!raw || typeof raw !== 'object') return base;
  const data = { ...base, ...raw };
  if (!Array.isArray(data.players) || data.players.length === 0) data.players = base.players;
  while (data.players.length < 11) data.players.push({ id: uid('pl'), name: `Player ${data.players.length + 1}` });
  data.players = data.players.slice(0, 11);
  data.matches = Array.isArray(data.matches) ? data.matches.map((m) => normaliseMatch(m, data.players)) : [];
  data.tips = Array.isArray(data.tips) ? data.tips : [];
  data.activity = Array.isArray(data.activity) ? data.activity : [];
  if (data.currentMatchId && !data.matches.find((m) => m.id === data.currentMatchId)) data.currentMatchId = null;
  return data;
}

function normaliseMatch(m, players) {
  const fresh = newMatch(players);
  const md = { ...fresh.matchDay, ...(m.matchDay || {}) };
  md.pitch = { ...fresh.matchDay.pitch, ...(m.matchDay?.pitch || {}) };
  md.groundHistory = { ...fresh.matchDay.groundHistory, ...(m.matchDay?.groundHistory || {}) };
  const match = { ...fresh, ...m, matchDay: md };
  match.notes = { ...fresh.notes, ...(m.notes || {}) };
  if (!match.fielding?.setups?.length) match.fielding = fresh.fielding;
  if (!Array.isArray(match.batting) || match.batting.length !== 11) {
    const b = Array.isArray(match.batting) ? match.batting.slice(0, 11) : [];
    while (b.length < 11) b.push({ playerId: null, notes: '' });
    match.batting = b;
  }
  if (!Array.isArray(match.bowling)) match.bowling = fresh.bowling;
  return match;
}

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const formatDate = (iso, opts = {}) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { weekday: opts.short ? undefined : 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

export const timeAgo = (ts) => {
  if (!ts) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const matchTitle = (m) => m?.name?.trim() || (m?.opposition ? `vs ${m.opposition}` : 'Untitled match');

// Player name for an id in a match (finished matches use the roster at the time).
export const playerName = (players, match, id) => {
  if (!id) return '';
  const snap = match?.rosterSnapshot?.find((p) => p.id === id);
  if (snap) return snap.name;
  return players.find((p) => p.id === id)?.name || '';
};

// Move an item within a list, returning a new list.
export const moveItem = (list, from, to) => {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

// Assign a player to a lineup slot. If they already occupy another slot the two
// rows swap places (notes and overs stay with each player) so nobody appears twice.
export const assignInLineup = (lineup, index, playerId) => {
  const next = lineup.map((r) => ({ ...r }));
  if (!playerId) {
    next[index] = { ...next[index], playerId: null };
    return next;
  }
  const existing = next.findIndex((r, i) => i !== index && r.playerId === playerId);
  if (existing >= 0) {
    const a = next[index];
    next[index] = next[existing];
    next[existing] = a;
  } else {
    next[index] = { ...next[index], playerId };
  }
  return next;
};

export const fieldingSummary = (setup) => {
  const active = Object.entries(setup?.positions || {}).filter(([, v]) => v.active);
  return { count: active.length, named: active.filter(([, v]) => v.player?.trim()).length };
};

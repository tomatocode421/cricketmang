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

export const PLAYER_ROLES = ['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'];
export const BOWLING_STYLES = ['Fast', 'Medium pace', 'Off-spin', 'Leg-spin', 'Left-arm spin'];
export const isPace = (style) => style === 'Fast' || style === 'Medium pace';
export const isSpin = (style) => /spin/i.test(style || '');
export const playerTag = (p) => {
  if (!p) return '';
  const bits = [];
  if (p.role === 'Wicketkeeper') bits.push('WK');
  if (p.bowling) bits.push(p.bowling);
  if (p.bats === 'Left') bits.push('LHB');
  return bits.join(', ');
};

// The squad has 12 players; 11 are picked for each match and the other is the 12th player (reserve).
export const SQUAD_SIZE = 12;
export const XI_SIZE = 11;

export const defaultPlayers = () =>
  Array.from({ length: SQUAD_SIZE }, (_, i) => ({ id: uid('pl'), name: `Player ${i + 1}` }));

// The 11 players picked for a match (always 11 valid squad ids, in squad order where unset).
export function matchXI(match, players) {
  const ids = new Set(players.map((p) => p.id));
  const xi = (match?.xi || []).filter((id) => ids.has(id));
  for (const p of players) {
    if (xi.length >= XI_SIZE) break;
    if (!xi.includes(p.id)) xi.push(p.id);
  }
  return xi.slice(0, XI_SIZE);
}
export const reservePlayers = (match, players) => {
  const xi = matchXI(match, players);
  return players.filter((p) => !xi.includes(p.id));
};

// Change the playing XI. Anyone dropped is replaced by the incoming player in the batting
// and bowling orders, so nobody who isn't playing stays in a lineup.
export function changeXI(match, players, nextXI) {
  const before = matchXI(match, players);
  const out = before.filter((id) => !nextXI.includes(id));
  const incoming = nextXI.filter((id) => !before.includes(id));
  match.xi = nextXI.slice(0, XI_SIZE);
  out.forEach((id, i) => {
    const sub = incoming[i] || null;
    match.batting = match.batting.map((r) => (r.playerId === id ? { ...r, playerId: sub, notes: '' } : r));
    match.bowling = match.bowling.map((r) => (r.playerId === id ? { ...r, playerId: sub, notes: '' } : r));
  });
  // Anyone in the XI but missing from the batting order fills an empty slot.
  for (const id of match.xi) {
    if (!match.batting.some((r) => r.playerId === id)) {
      const slot = match.batting.findIndex((r) => !r.playerId);
      if (slot >= 0) match.batting[slot] = { ...match.batting[slot], playerId: id };
    }
  }
  return match;
}

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
    xi: players.slice(0, XI_SIZE).map((p) => p.id),
    batting: Array.from({ length: XI_SIZE }, (_, i) => ({ playerId: players[i]?.id || null, notes: '' })),
    live: null,
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
    deleted: { matches: [], tips: [] },
    scorecards: [],
    savedAt: null,
  };
};

// Make sure older or partial data has every field we expect.
export function normaliseData(raw) {
  const base = initialData();
  if (!raw || typeof raw !== 'object') return base;
  const data = { ...base, ...raw };
  if (!Array.isArray(data.players) || data.players.length === 0) data.players = base.players;
  data.players = data.players.slice();
  while (data.players.length < SQUAD_SIZE) data.players.push({ id: uid('pl'), name: `Player ${data.players.length + 1}` });
  data.players = data.players.slice(0, SQUAD_SIZE).map((p) => ({ role: '', bowling: '', bats: 'Right', ...p }));
  data.scorecards = Array.isArray(data.scorecards) ? data.scorecards : [];
  data.matches = Array.isArray(data.matches) ? data.matches.map((m) => normaliseMatch(m, data.players)) : [];
  data.tips = Array.isArray(data.tips) ? data.tips : [];
  data.activity = Array.isArray(data.activity) ? data.activity : [];
  data.deleted = { matches: data.deleted?.matches || [], tips: data.deleted?.tips || [] };
  // Data from before sync existed has no player timestamp: if the team was customised,
  // mark it so a brand-new device's default "Player 1…11" never replaces it.
  if (!data.playersUpdatedAt && data.players.some((p) => (p.name && !/^Player \d+$/.test(p.name.trim())) || p.role || p.bowling || p.bats === 'Left')) data.playersUpdatedAt = 1;
  if (data.currentMatchId && !data.matches.find((m) => m.id === data.currentMatchId)) data.currentMatchId = null;
  if (data.currentMatchId && !data.currentMatchAt) data.currentMatchAt = 1;
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
  if (!Array.isArray(match.xi) || !match.xi.length) {
    // Older matches: the XI is whoever is in the batting order, topped up in squad order.
    match.xi = matchXI({ xi: match.batting.map((r) => r.playerId).filter(Boolean) }, players);
  }
  match.fielding.setups = match.fielding.setups.map((st) => ({ custom: [], ...st }));
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

// Plain-text team sheet for sending to the team (group chat, email, notes).
export function teamSheet(match, players, { fieldPositions }) {
  const name = (id) => playerName(players, match, id);
  const fmt = formatInfo(match);
  const md = match.matchDay || {};
  const lines = [];
  const when = [match.date && formatDate(match.date), match.startTime && `start ${match.startTime}`].filter(Boolean).join(', ');
  const where = [md.groundName, md.field].filter(Boolean).join(' – ');
  lines.push(`🏏 ${matchTitle(match)}${match.opposition && match.name ? ` vs ${match.opposition}` : ''}`);
  if (when) lines.push(`📅 ${when}`);
  if (where) lines.push(`📍 ${where}${md.groundLocation ? `, ${md.groundLocation}` : ''}`);
  if (fmt.id) lines.push(`Format: ${fmt.label}`);
  const bat = match.batting.filter((r) => r.playerId);
  if (bat.length) {
    lines.push('', 'BATTING ORDER');
    match.batting.forEach((r, i) => r.playerId && lines.push(`${i + 1}. ${name(r.playerId)}`));
  }
  const bowl = match.bowling.filter((r) => r.playerId);
  if (bowl.length) {
    lines.push('', 'BOWLING');
    bowl.forEach((r, i) => lines.push(`${i + 1}. ${name(r.playerId)}${Number(r.overs) ? ` – ${r.overs} over${Number(r.overs) === 1 ? '' : 's'}` : ''}`));
  }
  const roster = match.rosterSnapshot || players;
  const reserve = reservePlayers(match, roster);
  if (reserve.length) lines.push('', `12th player: ${reserve.map((p) => p.name).join(', ')}`);
  const setup = match.fielding.setups.find((s) => s.id === match.fielding.activeSetupId) || match.fielding.setups[0];
  const placed = setup ? fieldPositions(setup).filter((p) => setup.positions[p.id]?.active) : [];
  if (placed.length) {
    lines.push('', `FIELD (${setup.name}${setup.leftHanded ? ', left-handed batter' : ''})`);
    placed.forEach((p) => lines.push(`${p.name}: ${setup.positions[p.id].player || '–'}`));
  }
  if (match.info?.trim()) lines.push('', match.info.trim());
  return lines.join('\n');
}

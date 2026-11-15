// Keeps two copies of the app's data (e.g. Mac and iPhone) in step.
// Every match and tip carries the time it last changed; deletions are remembered,
// so merging two copies keeps the newest version of each item and never brings a
// deleted item back.

const strip = (o) => {
  if (!o) return '';
  const { updatedAt, ...rest } = o;
  return JSON.stringify(rest);
};

// Called after every local change: records what changed and when.
export function stamp(prev, next, now = Date.now()) {
  if (!prev || prev === next) return next;
  next.deleted = { matches: [...(prev.deleted?.matches || [])], tips: [...(prev.deleted?.tips || [])], ...(next.deleted || {}) };
  next.deleted.matches = [...new Set([...(prev.deleted?.matches || []), ...(next.deleted.matches || [])])];
  next.deleted.tips = [...new Set([...(prev.deleted?.tips || []), ...(next.deleted.tips || [])])];

  if (JSON.stringify(prev.players) !== JSON.stringify(next.players)) next.playersUpdatedAt = now;
  if (prev.currentMatchId !== next.currentMatchId) next.currentMatchAt = now;
  if (!!prev.hideGettingStarted !== !!next.hideGettingStarted) next.hideGettingStartedAt = now;

  for (const key of ['matches', 'tips']) {
    const before = new Map((prev[key] || []).map((x) => [x.id, x]));
    const ids = new Set();
    for (const item of next[key] || []) {
      ids.add(item.id);
      const old = before.get(item.id);
      if (!old || strip(old) !== strip(item)) item.updatedAt = Math.max(now, (old?.updatedAt || 0) + 1);
    }
    for (const id of before.keys()) if (!ids.has(id) && !next.deleted[key].includes(id)) next.deleted[key].push(id);
  }
  return next;
}

const pickNewer = (a, b, field) => ((a?.[field] || 0) >= (b?.[field] || 0) ? a : b);

function mergeList(a = [], b = [], deleted = []) {
  const gone = new Set(deleted);
  const map = new Map();
  for (const item of [...a, ...b]) {
    if (gone.has(item.id)) continue;
    const have = map.get(item.id);
    if (!have || (item.updatedAt || 0) > (have.updatedAt || 0)) map.set(item.id, item);
  }
  // keep a stable order: a's order first, then anything new from b
  const order = [...a.map((x) => x.id), ...b.map((x) => x.id)];
  return [...new Set(order)].filter((id) => map.has(id)).map((id) => map.get(id));
}

// Combine two copies of the data. `a` wins ties (pass the local copy as `a`).
export function mergeData(a, b) {
  if (!b) return a;
  if (!a) return b;
  const deleted = {
    matches: [...new Set([...(a.deleted?.matches || []), ...(b.deleted?.matches || [])])],
    tips: [...new Set([...(a.deleted?.tips || []), ...(b.deleted?.tips || [])])],
  };
  const players = pickNewer(a, b, 'playersUpdatedAt');
  const current = pickNewer(a, b, 'currentMatchAt');
  const gs = pickNewer(a, b, 'hideGettingStartedAt');
  const matches = mergeList(a.matches, b.matches, deleted.matches);
  let currentMatchId = current.currentMatchId ?? null;
  // Neither copy has recorded a change: keep whichever has a current match.
  if ((a.currentMatchAt || 0) === (b.currentMatchAt || 0)) currentMatchId = a.currentMatchId || b.currentMatchId || null;
  if (currentMatchId && !matches.some((m) => m.id === currentMatchId)) currentMatchId = null;
  const activity = [...new Map([...(a.activity || []), ...(b.activity || [])].map((x) => [x.id, x])).values()].sort((x, y) => y.ts - x.ts).slice(0, 60);
  return {
    ...b,
    ...a,
    players: players.players,
    playersUpdatedAt: Math.max(a.playersUpdatedAt || 0, b.playersUpdatedAt || 0) || undefined,
    currentMatchId,
    currentMatchAt: Math.max(a.currentMatchAt || 0, b.currentMatchAt || 0) || undefined,
    hideGettingStarted: !!gs.hideGettingStarted,
    hideGettingStartedAt: Math.max(a.hideGettingStartedAt || 0, b.hideGettingStartedAt || 0) || undefined,
    matches,
    tips: mergeList(a.tips, b.tips, deleted.tips),
    activity,
    deleted,
    savedAt: Math.max(a.savedAt || 0, b.savedAt || 0) || null,
  };
}

// True when two copies hold the same information (ignores save times).
export function sameData(a, b) {
  const clean = (d) => (d ? JSON.stringify({ ...d, savedAt: 0, exportedAt: 0, app: 0 }) : '');
  return clean(a) === clean(b);
}

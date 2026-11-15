// Season statistics for the squad, built from imported scorecards (Play-Cricket or CSV)
// and innings scored live in the app. Each scorecard row is matched to a squad player by
// their Play-Cricket id or by name.
import { computeInnings, nameFor, oversText } from './live.js';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

// Find the squad player a scorecard name or id belongs to.
export function resolvePlayer(row, players) {
  if (row.playerId && players.some((p) => p.id === row.playerId)) return row.playerId;
  if (row.pcId) {
    const hit = players.find((p) => p.pcId && String(p.pcId) === String(row.pcId));
    if (hit) return hit.id;
  }
  const n = norm(row.name);
  if (!n) return null;
  const exact = players.find((p) => norm(p.name) === n || (p.pcName && norm(p.pcName) === n));
  if (exact) return exact.id;
  // "J Smith" or "Smith, John" style names: match surname plus first initial.
  const parts = n.split(' ');
  const surname = parts[parts.length - 1];
  const initial = parts[0][0];
  const loose = players.filter((p) => {
    const q = norm(p.name).split(' ');
    if (parts.length === 1) return q[q.length - 1] === surname; // surname only, e.g. "c Patel"
    return q.length > 1 && q[q.length - 1] === surname && q[0][0] === initial;
  });
  return loose.length === 1 ? loose[0].id : null;
}

// Turn a live-scored match into the same shape as an imported scorecard.
export function liveScorecard(match, roster) {
  const live = match.live;
  if (!live?.innings?.some((i) => i.balls.length)) return null;
  const innings = live.innings
    .filter((i) => i.balls.length)
    .map((inn) => {
      const s = computeInnings(inn);
      const nm = (id) => nameFor(id, match, roster, inn);
      return {
        ours: inn.battingSide === 'us',
        team: inn.battingSide === 'us' ? 'Us' : match.opposition || 'Opposition',
        runs: s.runs,
        wickets: s.wickets,
        overs: s.overs,
        bat: [...s.batters.values()].map((b) => ({
          name: nm(b.id),
          playerId: inn.battingSide === 'us' ? b.id : null,
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          notOut: !b.out,
          howOut: b.out ? b.out.type : 'not out',
          fielder: b.out?.fielder ? nm(b.out.fielder) : '',
          fielderId: inn.battingSide === 'them' && b.out?.fielder ? b.out.fielder : null,
          caught: b.out?.type === 'Caught',
        })),
        bowl: [...s.bowlers.values()].map((b) => ({ name: nm(b.id), playerId: inn.battingSide === 'them' ? b.id : null, overs: oversText(b.legal), balls: b.legal, maidens: b.maidens, runs: b.runs, wickets: b.wickets })),
      };
    });
  return { id: 'live-' + match.id, source: 'live', matchId: match.id, date: match.date, title: match.opposition ? `vs ${match.opposition}` : match.name || 'Live match', innings };
}

const ballsFromOvers = (o) => {
  if (o == null || o === '') return 0;
  const [whole, part] = String(o).split('.');
  return (Number(whole) || 0) * 6 + (Number(part) || 0);
};

// All scorecards: imported ones plus live ones (an imported card for the same match wins).
export function allScorecards(data) {
  const imported = data.scorecards || [];
  const linked = new Set(imported.map((c) => c.matchId).filter(Boolean));
  const live = data.matches
    .filter((m) => !linked.has(m.id))
    .map((m) => liveScorecard(m, m.rosterSnapshot || data.players))
    .filter(Boolean);
  return [...imported, ...live];
}

export function playerStats(data) {
  const players = data.players;
  const stats = new Map(players.map((p) => [p.id, { id: p.id, matches: new Set(), inns: 0, notOuts: 0, runs: 0, balls: 0, high: 0, highNO: false, fours: 0, sixes: 0, fifties: 0, bowlBalls: 0, bowlRuns: 0, wickets: 0, maidens: 0, best: null, catches: 0 }]));
  for (const card of allScorecards(data)) {
    for (const inn of card.innings || []) {
      if (inn.ours) {
        for (const row of inn.bat || []) {
          const id = resolvePlayer(row, players);
          const st = id && stats.get(id);
          if (!st) continue;
          st.matches.add(card.id);
          if (row.didNotBat) continue;
          st.inns += 1;
          if (row.notOut) st.notOuts += 1;
          const r = Number(row.runs) || 0;
          st.runs += r;
          st.balls += Number(row.balls) || 0;
          st.fours += Number(row.fours) || 0;
          st.sixes += Number(row.sixes) || 0;
          if (r >= 50) st.fifties += 1;
          if (r > st.high || (r === st.high && row.notOut)) (st.high = r), (st.highNO = !!row.notOut);
        }
      } else {
        for (const row of inn.bowl || []) {
          const id = resolvePlayer(row, players);
          const st = id && stats.get(id);
          if (!st) continue;
          st.matches.add(card.id);
          st.bowlBalls += row.balls ?? ballsFromOvers(row.overs);
          st.bowlRuns += Number(row.runs) || 0;
          st.wickets += Number(row.wickets) || 0;
          st.maidens += Number(row.maidens) || 0;
          const w = Number(row.wickets) || 0;
          const rr = Number(row.runs) || 0;
          if (!st.best || w > st.best.w || (w === st.best.w && rr < st.best.r)) st.best = { w, r: rr };
        }
        for (const row of inn.bat || []) {
          if (!row.caught && !/^c(t|aught)?\b/i.test(row.howOut || '')) continue;
          const id = resolvePlayer({ playerId: row.fielderId, pcId: row.fielderPcId, name: row.fielder }, players);
          const st = id && stats.get(id);
          if (st) (st.catches += 1), st.matches.add(card.id);
        }
      }
    }
  }
  for (const st of stats.values()) {
    st.played = st.matches.size;
    st.avg = st.inns - st.notOuts > 0 ? st.runs / (st.inns - st.notOuts) : null;
    st.sr = st.balls ? (st.runs / st.balls) * 100 : null;
    st.econ = st.bowlBalls ? (st.bowlRuns / st.bowlBalls) * 6 : null;
    st.bowlAvg = st.wickets ? st.bowlRuns / st.wickets : null;
    st.bowlOvers = oversText(st.bowlBalls);
  }
  return stats;
}

export const fmt1 = (n) => (n == null ? '–' : (Math.round(n * 10) / 10).toFixed(1));
export const fmt0 = (n) => (n == null ? '–' : String(Math.round(n)));

// ---------- CSV scorecards ----------
export const CSV_TEMPLATE = `section,name,runs,balls,fours,sixes,how_out,overs,maidens,wickets
our_batting,James Carter,34,28,4,1,c Smith b Jones,,,
our_batting,Liam Patel,12,20,1,0,not out,,,
our_bowling,Oliver Brown,22,,,,,4,0,2
opp_batting,A Smith,45,40,6,0,c Patel b Brown,,,
opp_bowling,B Jones,30,,,,,4,0,1`;

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') (cur += '"'), i++;
      else q = !q;
    } else if (ch === ',' && !q) out.push(cur), (cur = '');
    else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

// "c Smith b Jones" → fielder "Smith"
export const fielderFromHowOut = (how) => {
  const m = /^c(?:t)?\.?\s+(.+?)\s+b\s+/i.exec(how || '') || /^(?:caught|ct)\s+(.+)$/i.exec(how || '');
  if (!m) return '';
  return /^&|^\(?sub\)?$/i.test(m[1]) ? '' : m[1].replace(/^†/, '').trim();
};

export function parseScorecardCsv(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error('The file is empty.');
  const head = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (k) => head.indexOf(k);
  if (col('section') < 0 || col('name') < 0) throw new Error('The first line must be the column headings, starting with "section,name". Use the template.');
  const inn = { us: { ours: true, team: 'Us', bat: [], bowl: [] }, them: { ours: false, team: 'Opposition', bat: [], bowl: [] } };
  let rows = 0;
  for (const line of lines.slice(1)) {
    const c = splitCsvLine(line);
    const get = (k) => (col(k) >= 0 ? c[col(k)] : '');
    const section = get('section').toLowerCase();
    const name = get('name');
    if (!name) continue;
    const num = (k) => (get(k) === '' ? 0 : Number(get(k)) || 0);
    const how = get('how_out');
    const batRow = { name, runs: num('runs'), balls: num('balls'), fours: num('fours'), sixes: num('sixes'), howOut: how || 'not out', notOut: !how || /not\s*out|retired\s*not/i.test(how), fielder: fielderFromHowOut(how), didNotBat: /^(dnb|did not bat)$/i.test(how) };
    const bowlRow = { name, overs: get('overs') || '0', maidens: num('maidens'), runs: num('runs'), wickets: num('wickets') };
    if (section === 'our_batting') inn.us.bat.push(batRow);
    else if (section === 'our_bowling') inn.them.bowl.push(bowlRow);
    else if (section === 'opp_batting') inn.them.bat.push(batRow);
    else if (section === 'opp_bowling') inn.us.bowl.push(bowlRow);
    else throw new Error(`Unknown section "${get('section')}" on line ${rows + 2}. Use our_batting, our_bowling, opp_batting or opp_bowling.`);
    rows++;
  }
  if (!rows) throw new Error('No player rows found.');
  for (const i of [inn.us, inn.them]) {
    i.runs = i.bat.reduce((a, b) => a + b.runs, 0);
    i.wickets = i.bat.filter((b) => !b.notOut && !b.didNotBat).length;
  }
  return { innings: [inn.us, inn.them].filter((i) => i.bat.length || i.bowl.length), rows };
}

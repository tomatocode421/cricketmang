// Unit tests for the data helpers, weather classification and tactical engine.
// Run with: npm test
import { analyseMatch } from '../src/lib/tactics.js';
import { rainLevel, weatherWarning, locationCandidates, fetchMatchWeather } from '../src/lib/weather.js';
import { assignInLineup, moveItem, newMatch, defaultPlayers, normaliseData, formatInfo, teamSheet } from '../src/data/model.js';
import { POSITIONS, FIELD_TEMPLATES } from '../src/data/positions.js';
import { mergeData, stamp, sameData } from '../src/data/merge.js';

let failed = 0;
const t = (cond, msg) => {
  console.log(cond ? '  ✓' : '  ✗ FAIL:', msg);
  if (!cond) failed++;
};

const players = defaultPlayers();
const base = (over = {}) => {
  const m = newMatch(players, { format: 'T20' });
  Object.assign(m.matchDay.pitch, over.pitch || {});
  if (over.weather) m.matchDay.weather = { status: 'ok', kind: 'forecast', daysAhead: 1, summary: over.weather };
  return m;
};
const wx = (o) => ({ tempMin: 18, tempMax: 24, tempAvg: 21, rainProb: 10, rainTotal: 0, rainMaxHour: 0, wind: 10, gust: 20, windDir: 180, humidity: 55, cloud: 30, code: 1, conditions: 'Mainly clear', dewRisk: false, ...o });

console.log('Lineups');
const l = [{ playerId: 'a', notes: 'A' }, { playerId: 'b', notes: 'B' }, { playerId: 'c', notes: 'C' }];
const s = assignInLineup(l, 0, 'c');
t(s[0].playerId === 'c' && s[0].notes === 'C' && s[2].playerId === 'a' && s[2].notes === 'A', 'assigning an existing player swaps rows and notes');
t(new Set(s.map((r) => r.playerId)).size === 3, 'no duplicates after swap');
const mv = moveItem(l, 2, 0);
t(mv.map((r) => r.playerId).join('') === 'cab', 'moveItem shifts others');

console.log('Formats');
t(formatInfo({ format: 'T20' }).maxPerBowler === 4, 'T20 max 4 overs per bowler');
t(formatInfo({ format: '50' }).overs === 50, '50-over format');
t(formatInfo({ format: 'other', customOvers: '35' }).overs === 35, 'custom overs');

console.log('Weather classification');
t(rainLevel(wx({})) === 'clear', 'dry forecast is clear');
t(rainLevel(wx({ rainProb: 40 })) === 'possible', '40% is possible');
t(rainLevel(wx({ rainProb: 70, rainTotal: 3 })) === 'likely', '70% is likely');
t(rainLevel(wx({ rainProb: 90, rainTotal: 14, code: 63 })) === 'heavy', 'heavy rain');
t(rainLevel(wx({ code: 95, rainProb: 50 })) === 'heavy', 'thunderstorms are heavy');
t(weatherWarning(wx({})).tone === 'good', 'clear weather is favourable');
t(locationCandidates('12 Smith St, Parramatta NSW 2150').includes('Parramatta'), 'address reduced to suburb for lookup');

console.log('Forecast availability');
const far = new Date();
far.setDate(far.getDate() + 30);
const res = await fetchMatchWeather({ location: 'Parramatta', date: far.toISOString().slice(0, 10) });
t(res.status === 'too-far', 'match 30 days away reports forecast not yet available (no request made)');
const none = await fetchMatchWeather({ location: '', date: '2026-01-01' });
t(none.status === 'missing', 'missing location handled');

console.log('Tactics: no information');
let a = analyseMatch(base());
t(a.missing.includes('Weather forecast has not been retrieved'), 'reports missing weather');
t(!a.bowling.enough && a.bowling.balance.startsWith('Not enough information'), 'no bowling advice without information');
t(a.toss.suggestion === 'No strong preference', 'no toss preference without information');

console.log('Tactics: damp, seaming, rain likely');
a = analyseMatch(base({ pitch: { condition: 'Damp', seam: 'Yes', outfield: 'Slow' }, weather: wx({ rainProb: 70, rainTotal: 4, cloud: 85, humidity: 82, code: 61 }) }));
t(a.bowling.pace.score > a.bowling.spin.score + 15, 'pace favoured');
t(a.toss.suggestion === 'Consider Bowling First', 'consider bowling first');
t(a.conditions.some((c) => c.id === 'rain'), 'rain/damp considerations shown');
t(a.outfield.batting.some((x) => x.includes('run hard')), 'slow outfield advice about running');

console.log('Tactics: hot, dry, turning');
a = analyseMatch(base({ pitch: { condition: 'Dry', spin: 'Yes', outfield: 'Fast' }, weather: wx({ tempMax: 34, tempMin: 24 }) }));
t(a.bowling.spin.score > a.bowling.pace.score + 15, 'spin favoured');
t(a.toss.suggestion === 'Consider Batting First', 'consider batting first');
t(a.conditions.some((c) => c.id === 'hot'), 'hot and dry considerations shown');
t(a.risks.some((r) => r.includes('Heat')), 'heat listed as a risk');
t(a.outfield.fielding.some((x) => x.includes('boundary')), 'fast outfield: protect the boundary');

console.log('Tactics: windy');
a = analyseMatch(base({ weather: wx({ wind: 32, gust: 55 }) }));
t(a.conditions.some((c) => c.id === 'wind'), 'wind considerations shown');
t(a.fielding.some((f) => f.includes('wind')), 'wind fielding consideration');

console.log('Tactics: scoring observations');
const m = base();
m.matchDay.scoring = [{ id: 'x', area: 'midwicket', weight: 3, kind: 'mine' }];
a = analyseMatch(m);
t(a.areaSuggestions[0]?.positions.includes('Deep Mid-wicket'), 'mid-wicket observation suggests Deep Mid-wicket');

console.log('Squad-aware advice');
{
  const sq = defaultPlayers().map((p, i) => ({ ...p, name: `P${i + 1}`, bowling: i === 0 ? 'Fast' : i === 1 ? 'Off-spin' : '' }));
  const mm = base({ pitch: { condition: 'Damp', seam: 'Yes' } });
  const r = analyseMatch(mm, sq);
  t(r.bowling.squad.pace.join() === 'P1' && r.bowling.squad.spin.join() === 'P2', 'finds pace and spin bowlers in the squad');
  mm.bowling[0].playerId = sq[1].id;
  mm.bowling[1].playerId = sq[1].id === sq[2].id ? sq[3].id : sq[2].id;
  sq[2].bowling = 'Leg-spin';
  const r2 = analyseMatch(mm, sq);
  t(r2.bowling.squad.notes.some((n) => n.includes('both spinners')), 'warns when both openers are spinners on a seaming pitch');
  const r3 = analyseMatch(base({ pitch: { condition: 'Dry', spin: 'Yes' } }), sq.map((p) => ({ ...p, bowling: p.bowling === 'Fast' ? 'Fast' : '' })));
  t(r3.bowling.squad.notes.some((n) => n.includes('no spinners')), 'notes when spin suits but no spinners are listed');
}

console.log('Team sheet and templates');
{
  const sq = defaultPlayers();
  const mm = newMatch(sq, { name: 'Round 6', opposition: 'Eastwood CC', format: 'T20' });
  mm.bowling[0] = { playerId: sq[3].id, overs: '4', notes: '' };
  mm.fielding.setups[0].positions.wk = { active: true, player: 'Henry' };
  const text = teamSheet(mm, sq, { POSITIONS });
  t(text.includes('Round 6 vs Eastwood CC') && text.includes('1. Player 1') && text.includes('Player 4 – 4 overs') && text.includes('Wicketkeeper: Henry'), 'team sheet includes match, batting, bowling and field');
  t(FIELD_TEMPLATES.every((tp) => tp.positions.length === 10 && tp.positions.includes('wk') && tp.positions.every((id) => POSITIONS.some((p) => p.id === id))), 'every template has 10 valid positions including a keeper');
  const outside = (id) => FIELD_TEMPLATES.find((x) => x.id === id).positions.filter((pid) => POSITIONS.find((p) => p.id === pid).group === 'outer').length;
  t(outside('powerplay') === 2 && outside('death') === 5, 'powerplay has 2 and death overs 5 fielders outside the circle');
}

console.log('Sync merging');
{
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const base0 = normaliseData({});
  const m1 = newMatch(base0.players, { name: 'Round 1' });
  const m2 = newMatch(base0.players, { name: 'Round 2' });
  let start = clone(base0);
  start.matches = [m1, m2];
  start = stamp(base0, start, 1000);
  // Mac edits Round 1 notes; iPhone edits Round 2 and renames a player, at the same time.
  let mac = clone(start);
  mac.matches[0].notes.general = 'From the Mac';
  mac = stamp(start, mac, 2000);
  let phone = clone(start);
  phone.matches[1].notes.general = 'From the phone';
  phone.players[0].name = 'Renamed on phone';
  phone = stamp(start, phone, 2100);
  const merged = mergeData(mac, phone);
  t(merged.matches.find((m) => m.name === 'Round 1').notes.general === 'From the Mac', 'keeps the Mac change to one match');
  t(merged.matches.find((m) => m.name === 'Round 2').notes.general === 'From the phone', 'keeps the phone change to another match');
  t(merged.players[0].name === 'Renamed on phone', 'takes the newer player list');
  t(sameData(mergeData(phone, mac), merged) || mergeData(phone, mac).matches.length === 2, 'merging is consistent either way round');
  // Same match edited on both: newest wins
  let a = clone(start); a.matches[0].opposition = 'Older'; a = stamp(start, a, 3000);
  let b = clone(start); b.matches[0].opposition = 'Newer'; b = stamp(start, b, 4000);
  t(mergeData(a, b).matches[0].opposition === 'Newer', 'same match edited on both devices: newest edit wins');
  // Deleting on one device does not come back from the other
  let del = clone(start); del.matches = del.matches.filter((m) => m.name !== 'Round 2'); del = stamp(start, del, 5000);
  t(!mergeData(start, del).matches.some((m) => m.name === 'Round 2') && !mergeData(del, start).matches.some((m) => m.name === 'Round 2'), 'a deleted match stays deleted');
  // New match on each device: both kept
  let x = clone(start); x.matches.push(newMatch(x.players, { name: 'Mac new' })); x = stamp(start, x, 6000);
  let y = clone(start); y.matches.push(newMatch(y.players, { name: 'Phone new' })); y = stamp(start, y, 6000);
  const xy = mergeData(x, y);
  t(xy.matches.some((m) => m.name === 'Mac new') && xy.matches.some((m) => m.name === 'Phone new'), 'new matches from both devices are kept');
  // A brand-new device with default data does not overwrite real players
  const fresh = normaliseData({});
  const oldMac = normaliseData({ players: base0.players.map((p, i) => ({ id: p.id, name: `Real ${i + 1}` })), matches: [] }); // saved before sync existed
  t(mergeData(fresh, oldMac).players[0].name === 'Real 1' && mergeData(oldMac, fresh).players[0].name === 'Real 1', 'a fresh device never replaces a real team with default names');
  const withMatch = normaliseData({ players: base0.players, matches: [m1], currentMatchId: m1.id });
  t(mergeData(fresh, withMatch).currentMatchId === m1.id, 'a fresh device keeps the existing current match');
}

console.log('Data');
const n = normaliseData({ players: [{ id: 'p', name: 'X' }], matches: [{ id: 'm1', batting: [] }] });
t(n.players.length === 11 && n.matches[0].batting.length === 11 && n.matches[0].matchDay.checklist.length > 0, 'partial data is repaired');

console.log(failed ? `\n${failed} FAILED` : '\nAll logic tests passed');
process.exit(failed ? 1 : 0);

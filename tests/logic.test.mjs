// Unit tests for the data helpers, weather classification and tactical engine.
// Run with: npm test
import { analyseMatch } from '../src/lib/tactics.js';
import { rainLevel, weatherWarning, locationCandidates, fetchMatchWeather } from '../src/lib/weather.js';
import { assignInLineup, moveItem, newMatch, defaultPlayers, normaliseData, formatInfo } from '../src/data/model.js';

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

console.log('Data');
const n = normaliseData({ players: [{ id: 'p', name: 'X' }], matches: [{ id: 'm1', batting: [] }] });
t(n.players.length === 11 && n.matches[0].batting.length === 11 && n.matches[0].matchDay.checklist.length > 0, 'partial data is repaired');

console.log(failed ? `\n${failed} FAILED` : '\nAll logic tests passed');
process.exit(failed ? 1 : 0);

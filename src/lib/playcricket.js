// Play-Cricket (ECB) API client.
// Access needs an API key that the ECB issues to a club after a club admin or committee
// member signs their data-sharing agreement through the Play-Cricket help desk.
// Requests go from the Mac app directly to play-cricket.com; the key is kept only on
// that device. The API is for results after play and is not a live feed.
import { getJson } from './net.js';
import { fielderFromHowOut } from './stats.js';

const KEY = 'cricket-playcricket-config';
const BASE = 'https://play-cricket.com/api/v2';

export function getPcConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    return c && c.siteId && c.token ? c : null;
  } catch {
    return null;
  }
}
export function setPcConfig(c) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const pcAvailable = () => typeof window !== 'undefined' && !!window.desktop;

async function call(path, params, cfg) {
  if (!pcAvailable()) throw new Error('Play-Cricket can be reached from the Mac app. Imported scorecards and stats then appear on your other devices through sync.');
  const q = new URLSearchParams({ ...params, api_token: cfg.token }).toString();
  try {
    return await getJson(`${BASE}${path}?${q}`);
  } catch (err) {
    const msg = String(err.message || err);
    if (/401|403/.test(msg)) throw new Error('Play-Cricket did not accept the API key for this site ID. Check both with your club admin.');
    if (/404/.test(msg)) throw new Error('Play-Cricket could not find that. Check the site ID.');
    throw new Error(`Could not reach Play-Cricket: ${msg}`);
  }
}

const first = (o, ...keys) => {
  for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k];
  return undefined;
};
const num = (v) => (v == null || v === '' ? 0 : Number(v) || 0);

export async function fetchPlayers(cfg) {
  const data = await call(`/sites/${encodeURIComponent(cfg.siteId)}/players`, {}, cfg);
  const list = data?.players || data?.data || [];
  if (!Array.isArray(list)) throw new Error('Play-Cricket returned players in an unexpected format.');
  return list.map((p) => ({ id: String(first(p, 'member_id', 'player_id', 'id')), name: String(first(p, 'name', 'player_name') || '').trim() })).filter((p) => p.id && p.name);
}

export async function fetchResults(cfg, season) {
  const data = await call('/result_summary.json', { site_id: cfg.siteId, season }, cfg);
  const list = data?.result_summary || data?.matches || [];
  if (!Array.isArray(list)) throw new Error('Play-Cricket returned results in an unexpected format.');
  return list.map((r) => ({
    id: String(first(r, 'id', 'match_id')),
    date: String(first(r, 'match_date', 'date') || ''),
    home: first(r, 'home_team_name') ? `${first(r, 'home_club_name') || ''} ${first(r, 'home_team_name')}`.trim() : first(r, 'home_club_name') || '',
    away: first(r, 'away_team_name') ? `${first(r, 'away_club_name') || ''} ${first(r, 'away_team_name')}`.trim() : first(r, 'away_club_name') || '',
    homeClubId: String(first(r, 'home_club_id') || ''),
    awayClubId: String(first(r, 'away_club_id') || ''),
    homeTeamId: String(first(r, 'home_team_id') || ''),
    awayTeamId: String(first(r, 'away_team_id') || ''),
    result: first(r, 'result_description', 'result') || '',
    competition: first(r, 'competition_name', 'league_name') || '',
  }));
}

// Turn Play-Cricket's match detail into the app's scorecard shape.
export function toScorecard(detail, cfg) {
  const homeClub = String(first(detail, 'home_club_id') || '');
  const awayClub = String(first(detail, 'away_club_id') || '');
  const homeTeam = String(first(detail, 'home_team_id') || '');
  const awayTeam = String(first(detail, 'away_team_id') || '');
  let ourTeam = cfg.teamId ? String(cfg.teamId) : '';
  if (!ourTeam) ourTeam = homeClub === String(cfg.siteId) ? homeTeam : awayClub === String(cfg.siteId) ? awayTeam : '';
  const innings = (detail.innings || []).map((inn) => {
    const battingId = String(first(inn, 'team_batting_id') || '');
    const ours = ourTeam ? battingId === ourTeam : false;
    return {
      ours,
      team: first(inn, 'team_batting_name') || (ours ? 'Us' : 'Opposition'),
      runs: num(first(inn, 'runs')),
      wickets: num(first(inn, 'wickets')),
      overs: String(first(inn, 'overs') || ''),
      bat: (inn.bat || []).map((b) => {
        const how = String(first(b, 'how_out') || '');
        return {
          name: String(first(b, 'batsman_name') || ''),
          pcId: first(b, 'batsman_id') ? String(b.batsman_id) : null,
          runs: num(first(b, 'runs')),
          balls: num(first(b, 'balls')),
          fours: num(first(b, 'fours')),
          sixes: num(first(b, 'sixes')),
          howOut: how || 'not out',
          notOut: !how || /not\s*out|^no$|retired\s*not/i.test(how),
          didNotBat: /did not bat|^dnb$/i.test(how),
          fielder: String(first(b, 'fielder_name') || fielderFromHowOut(how) || ''),
          fielderPcId: first(b, 'fielder_id') ? String(b.fielder_id) : null,
          caught: /^c(t|aught)?\b/i.test(how),
        };
      }),
      bowl: (inn.bowl || []).map((b) => ({
        name: String(first(b, 'bowler_name') || ''),
        pcId: first(b, 'bowler_id') ? String(b.bowler_id) : null,
        overs: String(first(b, 'overs') || '0'),
        maidens: num(first(b, 'maidens')),
        runs: num(first(b, 'runs')),
        wickets: num(first(b, 'wickets')),
      })),
    };
  });
  return {
    id: 'pc-' + String(first(detail, 'id', 'match_id')),
    source: 'play-cricket',
    pcMatchId: String(first(detail, 'id', 'match_id')),
    date: String(first(detail, 'match_date') || ''),
    title: `${first(detail, 'home_club_name') || ''} ${first(detail, 'home_team_name') || ''} v ${first(detail, 'away_club_name') || ''} ${first(detail, 'away_team_name') || ''}`.replace(/\s+/g, ' ').trim(),
    result: String(first(detail, 'result_description') || ''),
    ourTeamKnown: !!ourTeam,
    innings,
    fetchedAt: Date.now(),
  };
}

export async function fetchScorecard(cfg, matchId) {
  const data = await call('/match_detail.json', { match_id: matchId }, cfg);
  const detail = (data?.match_details || data?.match_detail || [])[0] || data?.match_details;
  if (!detail || !Array.isArray(detail.innings)) throw new Error('Play-Cricket has no scorecard for this match yet.');
  return toScorecard(detail, cfg);
}

// Best guess at which Play-Cricket player each squad player is (exact name, then surname + initial).
export function suggestLinks(squad, pcPlayers) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  const out = {};
  for (const p of squad) {
    if (p.pcId) continue;
    const n = norm(p.name);
    if (!n || /^player \d+$/.test(n)) continue;
    let hit = pcPlayers.find((x) => norm(x.name) === n);
    if (!hit) {
      const parts = n.split(' ');
      const cands = pcPlayers.filter((x) => {
        const q = norm(x.name).split(' ');
        return q[q.length - 1] === parts[parts.length - 1] && q[0][0] === parts[0][0];
      });
      if (cands.length === 1) hit = cands[0];
    }
    if (hit) out[p.id] = hit;
  }
  return out;
}

export const matchCentreUrl = (pcMatchId) => `https://play-cricket.com/website/results/${encodeURIComponent(pcMatchId)}`;

// Live scoring: every ball is stored, and everything else (score, figures, partnerships,
// scoring areas) is worked out from the list of balls, so "undo" is always exact.
import { uid, formatInfo, playerName, isPace, isSpin, matchXI } from '../data/model.js';
import { AREA_PROTECTION, FIELD_TEMPLATES, SCORING_AREA_BY_ID, applyFieldTemplate, fieldPositions } from '../data/positions.js';

export const WICKET_TYPES = ['Bowled', 'Caught', 'LBW', 'Run out', 'Stumped', 'Hit wicket', 'Retired', 'Other'];
const BOWLER_CREDIT = new Set(['Bowled', 'Caught', 'LBW', 'Stumped', 'Hit wicket']);
export const needsFielder = (type) => type === 'Caught' || type === 'Run out' || type === 'Stumped';

export function newLive(match, { battingFirst = 'us', maxOvers } = {}) {
  const fmt = formatInfo(match);
  return {
    startedAt: Date.now(),
    maxOvers: Number(maxOvers) || fmt.overs || 20,
    maxPerBowler: fmt.maxPerBowler || null,
    current: 0,
    innings: [newInnings(battingFirst)],
    suggestionState: {},
    updatedAt: Date.now(),
  };
}

export const newInnings = (battingSide, target = null, opp = []) => ({
  id: uid('inn'),
  battingSide, // 'us' or 'them'
  target,
  balls: [],
  striker: null,
  nonStriker: null,
  bowler: null,
  opp, // opposition players: [{ id, name }]
  closed: false,
});

// Runs added to the total by one ball.
export const ballTotal = (b) =>
  b.extra === 'wd' ? 1 + (b.extraRuns || 0) : b.extra === 'nb' ? 1 + (b.runs || 0) + (b.extraRuns || 0) : b.extra === 'b' || b.extra === 'lb' ? b.extraRuns || 0 : b.runs || 0;
export const isLegal = (b) => b.extra !== 'wd' && b.extra !== 'nb';
// Runs the batters ran (decides whether they swap ends).
const ranRuns = (b) => (b.extra === 'wd' || b.extra === 'b' || b.extra === 'lb' ? b.extraRuns || 0 : (b.runs || 0) + (b.extra === 'nb' ? b.extraRuns || 0 : 0));
// Runs charged to the bowler.
const bowlerRuns = (b) => (b.extra === 'b' || b.extra === 'lb' ? 0 : ballTotal(b));

export const oversText = (legal) => `${Math.floor(legal / 6)}.${legal % 6}`;
export const ballSymbol = (b) => {
  if (b.wicket) return 'W';
  if (b.extra === 'wd') return `${1 + (b.extraRuns || 0)}wd`;
  if (b.extra === 'nb') return `${(b.runs || 0) + 1}nb`;
  if (b.extra === 'b') return `${b.extraRuns || 0}b`;
  if (b.extra === 'lb') return `${b.extraRuns || 0}lb`;
  return b.runs ? String(b.runs) : '•';
};

// Work out everything about an innings from its balls.
export function computeInnings(inn) {
  const s = {
    runs: 0,
    wickets: 0,
    legal: 0,
    extras: 0,
    batters: new Map(),
    bowlers: new Map(),
    overRuns: [],
    fow: [],
    partnership: { runs: 0, balls: 0, a: null, b: null, aRuns: 0, bRuns: 0, aBalls: 0, bBalls: 0 },
    recent: [],
    areaRuns: { batter: {}, bowler: {}, all: {} },
    boundaries: { batter: {} },
  };
  const bat = (id) => {
    if (!s.batters.has(id)) s.batters.set(id, { id, runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, out: null });
    return s.batters.get(id);
  };
  const bowl = (id) => {
    if (!s.bowlers.has(id)) s.bowlers.set(id, { id, legal: 0, runs: 0, wickets: 0, dots: 0, maidens: 0, fours: 0, sixes: 0, overs: [] });
    return s.bowlers.get(id);
  };
  let overRuns = 0;
  let overLegal = 0;
  let overBowlerRuns = 0;
  for (const b of inn.balls) {
    const total = ballTotal(b);
    s.runs += total;
    if (b.extra) s.extras += total - (b.extra === 'nb' ? b.runs || 0 : 0);
    overRuns += total;
    const bt = b.batter ? bat(b.batter) : null;
    if (b.nonStriker) bat(b.nonStriker);
    const bw = b.bowler ? bowl(b.bowler) : null;
    if (bt && b.extra !== 'wd') {
      bt.balls += 1;
      if (!b.extra || b.extra === 'nb') {
        bt.runs += b.runs || 0;
        if (b.runs === 4) bt.fours++;
        if (b.runs === 6) bt.sixes++;
        if (!b.runs && !b.extra) bt.dots++;
      }
    }
    if (bw) {
      bw.runs += bowlerRuns(b);
      overBowlerRuns += bowlerRuns(b);
      if (isLegal(b)) bw.legal += 1;
      if (isLegal(b) && !ballTotal(b)) bw.dots++;
      if ((!b.extra || b.extra === 'nb') && b.runs === 4) bw.fours++;
      if ((!b.extra || b.extra === 'nb') && b.runs === 6) bw.sixes++;
    }
    // partnership
    const p = s.partnership;
    if (!p.a && b.batter) p.a = b.batter;
    if (!p.b && b.nonStriker && b.nonStriker !== p.a) p.b = b.nonStriker;
    p.runs += total;
    if (b.extra !== 'wd') p.balls += 1;
    if (b.batter === p.a && (!b.extra || b.extra === 'nb')) (p.aRuns += b.runs || 0), (p.aBalls += 1);
    if (b.batter === p.b && (!b.extra || b.extra === 'nb')) (p.bRuns += b.runs || 0), (p.bBalls += 1);
    // scoring areas (runs off the bat)
    const batRuns = !b.extra || b.extra === 'nb' ? b.runs || 0 : 0;
    if (b.area && batRuns) {
      const add = (obj, key) => {
        obj[key] = obj[key] || {};
        obj[key][b.area] = (obj[key][b.area] || 0) + batRuns;
      };
      add(s.areaRuns.batter, b.batter);
      add(s.areaRuns.bowler, b.bowler);
      s.areaRuns.all[b.area] = (s.areaRuns.all[b.area] || 0) + batRuns;
      if (batRuns >= 4) {
        s.boundaries.batter[b.batter] = s.boundaries.batter[b.batter] || {};
        s.boundaries.batter[b.batter][b.area] = (s.boundaries.batter[b.batter][b.area] || 0) + 1;
      }
    }
    if (b.wicket) {
      s.wickets += 1;
      const outId = b.wicket.out || b.batter;
      const ob = bat(outId);
      ob.out = { type: b.wicket.type, bowler: b.bowler, fielder: b.wicket.fielder || '' };
      if (bw && BOWLER_CREDIT.has(b.wicket.type)) bw.wickets += 1;
      s.fow.push({ wicket: s.wickets, runs: s.runs, legal: s.legal + (isLegal(b) ? 1 : 0), out: outId });
      s.partnership = { runs: 0, balls: 0, a: null, b: null, aRuns: 0, bRuns: 0, aBalls: 0, bBalls: 0 };
    }
    if (isLegal(b)) {
      s.legal += 1;
      overLegal += 1;
      if (overLegal === 6) {
        s.overRuns.push(overRuns);
        if (bw) {
          bw.overs.push(overBowlerRuns);
          if (overBowlerRuns === 0) bw.maidens += 1;
        }
        overRuns = 0;
        overLegal = 0;
        overBowlerRuns = 0;
      }
    }
    s.recent.push(ballSymbol(b));
  }
  s.recent = s.recent.slice(-12);
  s.thisOver = { runs: overRuns, legal: overLegal };
  s.overs = oversText(s.legal);
  s.runRate = s.legal ? (s.runs / s.legal) * 6 : 0;
  return s;
}

export function chase(inn, s, maxOvers) {
  if (!inn.target) return null;
  const need = inn.target - s.runs;
  const ballsLeft = Math.max(0, maxOvers * 6 - s.legal);
  return { need, ballsLeft, rrr: ballsLeft ? (need / ballsLeft) * 6 : null, won: need <= 0 };
}

// Apply a new ball: returns the next striker / non-striker / bowler.
export function afterBall(inn, ball) {
  let striker = inn.striker;
  let nonStriker = inn.nonStriker;
  let bowler = inn.bowler;
  if (ranRuns(ball) % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
  if (ball.wicket) {
    const out = ball.wicket.out || ball.batter;
    if (striker === out) striker = null;
    if (nonStriker === out) nonStriker = null;
  }
  const legalSoFar = inn.balls.filter(isLegal).length + (isLegal(ball) ? 1 : 0);
  let overDone = false;
  if (isLegal(ball) && legalSoFar % 6 === 0) {
    [striker, nonStriker] = [nonStriker, striker];
    bowler = null;
    overDone = true;
  }
  return { striker, nonStriker, bowler, overDone };
}

export function recordBall(inn, fields) {
  const ball = { id: uid('b'), batter: inn.striker, nonStriker: inn.nonStriker, bowler: inn.bowler, runs: 0, extra: '', extraRuns: 0, wicket: null, area: '', ts: Date.now(), before: { striker: inn.striker, nonStriker: inn.nonStriker, bowler: inn.bowler }, ...fields };
  const next = afterBall(inn, ball);
  inn.balls.push(ball);
  inn.striker = next.striker;
  inn.nonStriker = next.nonStriker;
  inn.bowler = next.bowler;
  if (next.overDone) inn.lastOverBowler = ball.bowler;
  return next;
}

export function undoBall(inn) {
  const b = inn.balls.pop();
  if (!b) return null;
  inn.striker = b.before.striker;
  inn.nonStriker = b.before.nonStriker;
  inn.bowler = b.before.bowler;
  const prevOver = [...inn.balls].reverse().find((x) => isLegal(x) && inn.balls.filter(isLegal).indexOf(x) % 6 === 5);
  inn.lastOverBowler = prevOver ? prevOver.bowler : null;
  return b;
}

// Name lookup for both sides of an innings.
export function nameFor(id, match, roster, inn) {
  if (!id) return '';
  const opp = inn?.opp?.find((o) => o.id === id);
  if (opp) return opp.name;
  return playerName(roster, match, id) || 'Unknown';
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const r1 = (n) => Math.round(n * 10) / 10;
const areaName = (id) => SCORING_AREA_BY_ID[id]?.name || id;

// ---------- Tactical suggestions from the live innings ----------
// Every suggestion explains its evidence and is only made once there are enough balls to go on.
export function liveSuggestions({ match, roster, inn, s, setup }) {
  if (!inn || !s) return [];
  const out = [];
  const fmt = formatInfo(match);
  const name = (id) => nameFor(id, match, roster, inn);
  const weBowl = inn.battingSide === 'them';
  const live = match.live;
  const maxOvers = live?.maxOvers || fmt.overs || 20;

  if (weBowl && setup) {
    const all = fieldPositions(setup);
    const active = all.filter((p) => setup.positions[p.id]?.active);
    const coversArea = (area, deepOnly = false) => active.some((p) => p.area === area && p.id !== 'wk' && (!deepOnly || p.outer));
    // Batters who keep scoring in one area
    for (const id of [inn.striker, inn.nonStriker].filter(Boolean)) {
      const st = s.batters.get(id);
      const areas = s.areaRuns.batter[id] || {};
      const total = Object.values(areas).reduce((a, b) => a + b, 0);
      const shots = Object.keys(areas).length;
      if (!st || total < 10 || st.balls < 8) continue;
      const [top, topRuns] = Object.entries(areas).sort((a, b) => b[1] - a[1])[0] || [];
      if (!top || topRuns < 8 || topRuns / total < 0.4) continue;
      const fours = s.boundaries.batter[id]?.[top] || 0;
      const needDeep = fours >= 2;
      if (coversArea(top, needDeep)) continue;
      // Take a fielder from where this batter hasn't scored.
      const donor = active
        .filter((p) => p.id !== 'wk' && p.area !== top && !(areas[p.area] > 0) && !/slip/.test(p.id))
        .sort((a, b) => (a.outer === needDeep ? -1 : 1) - (b.outer === needDeep ? -1 : 1))[0];
      const targets = (AREA_PROTECTION[top] || []).map((pid) => all.find((p) => p.id === pid)).filter((p) => p && !setup.positions[p.id]?.active);
      const target = targets.find((p) => p.outer === needDeep) || targets[0];
      out.push({
        id: `F-area-${id}-${top}-${needDeep ? 'deep' : 'in'}`,
        type: 'Fielding',
        title: `Protect ${areaName(top)} for ${name(id)}`,
        why: `${name(id)} has scored ${topRuns} of ${total} recorded runs (${pct(topRuns, total)}%) through ${areaName(top)}${fours ? `, including ${fours} boundar${fours === 1 ? 'y' : 'ies'}` : ''}, and nobody is fielding ${needDeep ? 'deep ' : ''}there.`,
        evidence: [`${st.runs} (${st.balls}) · ${shots} scoring area${shots === 1 ? '' : 's'} recorded`],
        action: donor && target ? { kind: 'moveFielder', from: donor.id, to: target.id, label: `Move ${setup.positions[donor.id].player || donor.name} from ${donor.name} to ${target.name}` } : null,
      });
    }
    // Field setting: attacking or defensive
    if (s.legal >= 18) {
      const last18 = inn.balls.filter(isLegal).slice(-18);
      const lastIds = new Set(last18.map((b) => b.id));
      const recent = inn.balls.filter((b) => lastIds.has(b.id));
      const wkts = recent.filter((b) => b.wicket).length;
      const fours = recent.filter((b) => (b.runs || 0) >= 4 && (!b.extra || b.extra === 'nb')).length;
      const recentRuns = recent.reduce((a, b) => a + ballTotal(b), 0);
      const outerNow = active.filter((p) => p.outer).length;
      if ((wkts >= 2 || recentRuns <= 12) && outerNow >= 4) {
        const bowlerStyle = roster.find((p) => p.id === inn.bowler)?.bowling;
        const tpl = isSpin(bowlerStyle) ? FIELD_TEMPLATES.find((t) => t.id === 'spin') : FIELD_TEMPLATES.find((t) => t.id === 'newball');
        out.push({
          id: `F-attack-${Math.floor(s.legal / 18)}`,
          type: 'Fielding',
          title: 'Consider a more attacking field',
          why: `${wkts} wicket${wkts === 1 ? '' : 's'} and ${recentRuns} runs in the last 3 overs, with ${outerNow} fielders on the boundary. Catchers could create more chances.`,
          evidence: [`Last 3 overs: ${recentRuns} runs, ${wkts} wickets`],
          action: { kind: 'template', template: tpl.id, label: `Apply "${tpl.name}"` },
        });
      } else if (fours >= 4 && outerNow <= 2) {
        out.push({
          id: `F-defend-${Math.floor(s.legal / 18)}`,
          type: 'Fielding',
          title: 'Consider a more defensive field',
          why: `${fours} boundaries in the last 3 overs with only ${outerNow} fielder${outerNow === 1 ? '' : 's'} outside the circle.`,
          evidence: [`Last 3 overs: ${recentRuns} runs`],
          action: { kind: 'template', template: 'defensive', label: 'Apply "Defensive"' },
        });
      }
    }
  }

  if (weBowl) {
    // Bowlers who are struggling — only after two overs
    const cur = inn.bowler ? s.bowlers.get(inn.bowler) : null;
    const rr = s.runRate;
    const bowled = [...s.bowlers.values()];
    const oversLeft = (p) => (live?.maxPerBowler || fmt.maxPerBowler ? (live?.maxPerBowler || fmt.maxPerBowler) * 6 - (s.bowlers.get(p.id)?.legal || 0) : 99);
    const xi = matchXI(match, roster);
    const candidates = roster
      .filter((p) => xi.includes(p.id) && p.bowling && p.id !== inn.bowler && p.id !== inn.lastOverBowler && oversLeft(p) >= 6)
      .map((p) => ({ p, st: s.bowlers.get(p.id) }))
      .sort((a, b) => (a.st?.legal >= 6 ? (a.st.runs / a.st.legal) * 6 : 6.5) - (b.st?.legal >= 6 ? (b.st.runs / b.st.legal) * 6 : 6.5));
    const lastBowlerId = inn.bowler || inn.lastOverBowler;
    const lb = lastBowlerId ? s.bowlers.get(lastBowlerId) : null;
    if (lb && lb.legal >= 12) {
      const econ = (lb.runs / lb.legal) * 6;
      const lastOver = lb.overs[lb.overs.length - 1] ?? null;
      if (econ >= Math.max(rr * 1.35, 7.5) || (lastOver !== null && lastOver >= 14)) {
        const alt = candidates[0];
        out.push({
          id: `B-change-${lastBowlerId}-${lb.overs.length}`,
          type: 'Bowling',
          title: `Consider a bowling change for ${name(lastBowlerId)}`,
          why: `${name(lastBowlerId)} is going at ${r1(econ)} an over against an innings rate of ${r1(rr)}${lastOver !== null ? `, with ${lastOver} off the last over` : ''}.`,
          evidence: [`${oversText(lb.legal)}-${lb.maidens}-${lb.runs}-${lb.wickets}`],
          suggestion: alt ? `${alt.p.name} (${alt.p.bowling}${alt.st?.legal ? `, ${oversText(alt.st.legal)}-${alt.st.runs}-${alt.st.wickets}` : ', yet to bowl'}) is available.` : null,
          action: alt ? { kind: 'nextBowler', bowler: alt.p.id, label: `Bowl ${alt.p.name} next` } : null,
        });
      }
    }
    // Pace vs spin so far
    const byType = (test) => bowled.filter((b) => test(roster.find((p) => p.id === b.id)?.bowling));
    const sum = (list) => list.reduce((a, b) => ({ runs: a.runs + b.runs, legal: a.legal + b.legal, w: a.w + b.wickets }), { runs: 0, legal: 0, w: 0 });
    const pace = sum(byType(isPace));
    const spin = sum(byType(isSpin));
    if (pace.legal >= 12 && spin.legal >= 12) {
      const pe = (pace.runs / pace.legal) * 6;
      const se = (spin.runs / spin.legal) * 6;
      if (Math.abs(pe - se) >= 2) {
        const better = pe < se ? 'pace' : 'spin';
        out.push({
          id: `B-type-${better}-${Math.floor(s.legal / 24)}`,
          type: 'Bowling',
          title: `${better === 'pace' ? 'Pace' : 'Spin'} is going better today`,
          why: `Pace: ${r1(pe)} an over (${pace.w} wkts in ${oversText(pace.legal)}). Spin: ${r1(se)} an over (${spin.w} wkts in ${oversText(spin.legal)}). Consider giving more overs to your ${better} bowlers.`,
          evidence: [],
          action: null,
        });
      }
    }
    // A bowler conceding in one area
    if (cur && cur.legal >= 9 && setup) {
      const areas = s.areaRuns.bowler[cur.id] || {};
      const total = Object.values(areas).reduce((a, b) => a + b, 0);
      const [top, topRuns] = Object.entries(areas).sort((a, b) => b[1] - a[1])[0] || [];
      if (top && total >= 12 && topRuns / total >= 0.5) {
        out.push({
          id: `B-area-${cur.id}-${top}`,
          type: 'Bowling',
          title: `${name(cur.id)} is going through ${areaName(top)}`,
          why: `${topRuns} of the ${total} runs recorded off ${name(cur.id)} have gone through ${areaName(top)}. Consider bowling a different line or adding a fielder there.`,
          evidence: [],
          action: null,
        });
      }
    }
    // Keeper in the XI but not keeping
    if (setup) {
      const keeper = roster.find((p) => p.role === 'Wicketkeeper' && xi.includes(p.id));
      const wk = setup.positions.wk;
      if (keeper && wk?.active && wk.player && wk.player.trim().toLowerCase() !== keeper.name.trim().toLowerCase()) {
        out.push({ id: `P-keeper-${wk.player}`, type: 'Positioning', title: `${keeper.name} is your listed wicketkeeper`, why: `${wk.player} is keeping. ${keeper.name} is marked as the team's keeper in Player Management.`, evidence: [], action: { kind: 'setPlayer', pos: 'wk', player: keeper.name, label: `Put ${keeper.name} behind the stumps` } });
      }
      // Good catchers into catching positions
      const catches = {};
      for (const b of inn.balls) if (b.wicket?.type === 'Caught' && b.wicket.fielder) catches[b.wicket.fielder] = (catches[b.wicket.fielder] || 0) + 1;
      const slip = setup.positions.slip1;
      for (const [fid, n] of Object.entries(catches)) {
        const fname = name(fid);
        if (n >= 2 && slip?.active && slip.player && slip.player !== fname && fid !== keeper?.id) {
          out.push({ id: `P-catcher-${fid}`, type: 'Positioning', title: `${fname} is catching well`, why: `${fname} has taken ${n} catches this innings. Consider them at First Slip, where chances come quickest.`, evidence: [], action: { kind: 'swapInto', pos: 'slip1', player: fname, label: `Move ${fname} to First Slip` } });
        }
      }
    }
  } else {
    // We are batting
    for (const id of [inn.striker, inn.nonStriker].filter(Boolean)) {
      const st = s.batters.get(id);
      if (!st || st.balls < 15) continue;
      const sr = (st.runs / st.balls) * 100;
      const dotPct = pct(st.dots, st.balls);
      if (sr < 60 && dotPct >= 65) {
        out.push({ id: `T-slow-${id}-${Math.floor(st.balls / 12)}`, type: 'Batting', title: `${name(id)} is finding it hard to score`, why: `${st.runs} off ${st.balls} balls (strike rate ${Math.round(sr)}), with ${dotPct}% dot balls. Look for singles to rotate the strike rather than forcing big shots.`, evidence: [], action: null });
      }
    }
    const p = s.partnership;
    if (p.runs >= 30) {
      out.push({ id: `T-partner-${p.a}-${p.b}-${Math.floor(p.runs / 25)}`, type: 'Batting', title: `Good partnership: ${p.runs} runs`, why: `${name(p.a)} and ${name(p.b)} have added ${p.runs} off ${p.balls} balls. Keep building — losing a wicket now would let the bowlers back in.`, evidence: [], action: null });
    }
    if (p.runs >= 20 && p.a && p.b) {
      const [main, other, mr, or, ob] = p.aRuns >= p.bRuns ? [p.a, p.b, p.aRuns, p.bRuns, p.bBalls] : [p.b, p.a, p.bRuns, p.aRuns, p.aBalls];
      if (mr / Math.max(1, mr + or) >= 0.75 && ob >= 10 && (or / ob) * 100 < 70) {
        out.push({ id: `T-support-${other}-${Math.floor(p.runs / 20)}`, type: 'Batting', title: `${name(other)} could give ${name(main)} more of the strike`, why: `${name(main)} has scored ${mr} of the ${mr + or} runs in this partnership. ${name(other)} has ${or} off ${ob}: a single to get ${name(main)} on strike can be worth more than a risky shot.`, evidence: [], action: null });
      }
    }
    if (s.overRuns.length >= 6) {
      const last3 = s.overRuns.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const before = s.overRuns.slice(0, -3).reduce((a, b) => a + b, 0) / (s.overRuns.length - 3);
      if (Math.abs(last3 - before) >= 3) {
        out.push({ id: `T-rate-${s.overRuns.length}`, type: 'Batting', title: last3 > before ? 'Scoring rate has picked up' : 'Scoring rate has dropped', why: `${r1(last3)} an over in the last 3 overs, compared with ${r1(before)} before that.`, evidence: [], action: null });
      }
    }
    const c = chase(inn, s, maxOvers);
    if (c && !c.won && c.rrr != null && c.ballsLeft <= 60 && c.rrr - s.runRate >= 2) {
      out.push({ id: `T-chase-${Math.floor(c.ballsLeft / 12)}`, type: 'Batting', title: 'The required rate is climbing', why: `${c.need} needed off ${c.ballsLeft} balls (${r1(c.rrr)} an over) against ${r1(s.runRate)} so far. Look to target the weaker bowlers and run hard.`, evidence: [], action: null });
    }
  }
  const state = live?.suggestionState || {};
  return out.map((x) => ({ ...x, status: state[x.id] || 'open' }));
}

// Carry out an accepted suggestion on the match (fielding setup or bowler).
export function applySuggestion(match, sug, roster) {
  const a = sug.action;
  if (!a) return;
  const setup = match.fielding.setups.find((x) => x.id === match.fielding.activeSetupId) || match.fielding.setups[0];
  if (a.kind === 'moveFielder' && setup) {
    const from = setup.positions[a.from] || {};
    setup.positions[a.to] = { ...(setup.positions[a.to] || {}), active: true, player: from.player || '' };
    setup.positions[a.from] = { ...from, active: false, player: '' };
  }
  if (a.kind === 'template' && setup) {
    const tpl = FIELD_TEMPLATES.find((t) => t.id === a.template);
    const keeper = roster.find((p) => p.role === 'Wicketkeeper' && matchXI(match, roster).includes(p.id))?.name;
    if (tpl) setup.positions = applyFieldTemplate(setup, tpl, keeper);
  }
  if (a.kind === 'setPlayer' && setup) {
    const other = Object.entries(setup.positions).find(([pid, st]) => pid !== a.pos && st.active && st.player?.trim().toLowerCase() === a.player.toLowerCase());
    const current = setup.positions[a.pos]?.player || '';
    if (other) setup.positions[other[0]] = { ...other[1], player: current };
    setup.positions[a.pos] = { ...(setup.positions[a.pos] || {}), active: true, player: a.player };
  }
  if (a.kind === 'swapInto' && setup) {
    const other = Object.entries(setup.positions).find(([pid, st]) => pid !== a.pos && st.active && st.player?.trim().toLowerCase() === a.player.toLowerCase());
    const current = setup.positions[a.pos]?.player || '';
    if (other) setup.positions[other[0]] = { ...other[1], player: current };
    setup.positions[a.pos] = { ...(setup.positions[a.pos] || {}), active: true, player: a.player };
  }
  if (a.kind === 'nextBowler') {
    const inn = match.live.innings[match.live.current];
    if (inn && !inn.bowler) inn.bowler = a.bowler;
    else if (inn) inn.nextBowler = a.bowler;
  }
}

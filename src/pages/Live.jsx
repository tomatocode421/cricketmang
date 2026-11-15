import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Flag, Play, RotateCcw, Undo2, X, Radio, AlertTriangle } from 'lucide-react';
import { useStore, logActivity } from '../store.jsx';
import { Field, Modal, PageHeader, Select, SourceTag, useDialog, useNav, useToast } from '../components/ui.jsx';
import NoMatch from '../components/NoMatch.jsx';
import CricketField from '../components/CricketField.jsx';
import { formatInfo, matchTitle, matchXI, timeAgo, uid } from '../data/model.js';
import { SCORING_AREA_BY_ID } from '../data/positions.js';
import { WICKET_TYPES, applySuggestion, chase, computeInnings, liveSuggestions, nameFor, needsFielder, newInnings, newLive, oversText, recordBall, undoBall } from '../lib/live.js';

const r1 = (n) => (n == null || !isFinite(n) ? '–' : (Math.round(n * 10) / 10).toFixed(1));
// Shot directions laid out as seen from behind a right-handed batter's stumps (off side on the left).
const AREA_GRID = [
  ['thirdman', 'behind', 'fineleg'],
  ['point', null, 'squareleg'],
  ['cover', null, 'midwicket'],
  ['extracover', 'straight', null],
];

export default function Live() {
  const { data, match: m, updateMatch, sync } = useStore();
  const { confirm } = useDialog();
  const { go } = useNav();
  const toast = useToast();
  const roster = m?.rosterSnapshot || data.players;
  const [first, setFirst] = useState('us');
  const [overs, setOvers] = useState('');
  const [pending, setPending] = useState(null); // { runs, extra, extraRuns } waiting for a shot direction
  const [extraOpen, setExtraOpen] = useState(null); // 'wd' | 'nb' | 'b' | 'lb'
  const [wicketOpen, setWicketOpen] = useState(false);
  const [areaView, setAreaView] = useState('striker');
  const [showOld, setShowOld] = useState(false);
  const [showCard, setShowCard] = useState(false);

  const live = m?.live;
  const inn = live ? live.innings[live.current] : null;
  const s = useMemo(() => (inn ? computeInnings(inn) : null), [inn]);
  const setup = m ? m.fielding.setups.find((x) => x.id === m.fielding.activeSetupId) || m.fielding.setups[0] : null;
  const suggestions = useMemo(() => (m && inn && s ? liveSuggestions({ match: m, roster, inn, s, setup }) : []), [m, roster, inn, s, setup]);

  if (!m)
    return (
      <>
        <PageHeader title="Live Match" />
        <div className="content">
          <NoMatch what="live scoring" />
        </div>
      </>
    );

  const fmt = formatInfo(m);
  const xi = matchXI(m, roster);
  const name = (id) => nameFor(id, m, roster, inn);
  const editLive = (recipe, activity) =>
    updateMatch(m.id, (mm, draft) => {
      recipe(mm.live, mm);
      mm.live.updatedAt = Date.now();
      if (activity) logActivity(draft, { key: 'live-' + m.id, type: 'match', text: activity, matchId: m.id, target: 'live' });
    });

  // ---------- Not started ----------
  if (!live) {
    return (
      <>
        <PageHeader title="Live Match" subtitle={`${matchTitle(m)} · score each ball to get live figures and tactical suggestions`} />
        <div className="content">
          <div className="stack" style={{ maxWidth: 640 }}>
            <section className="panel">
              <div className="panel-head">
                <h2>
                  <Radio size={16} color="var(--green-soft)" /> Start scoring
                </h2>
              </div>
              <div className="panel-body stack">
                <Field label="Who is batting first?">
                  <div className="seg" style={{ alignSelf: 'flex-start' }}>
                    <button type="button" className={first === 'us' ? 'on' : ''} onClick={() => setFirst('us')}>
                      We bat first
                    </button>
                    <button type="button" className={first === 'them' ? 'on' : ''} onClick={() => setFirst('them')}>
                      {m.opposition || 'Opposition'} bat first
                    </button>
                  </div>
                </Field>
                <Field label="Overs per innings" hint={fmt.overs ? `From the match format (${fmt.label})` : 'Set the match format in Current Match, or enter it here'}>
                  <input className="input" type="number" min="1" inputMode="numeric" style={{ maxWidth: 140 }} value={overs || fmt.overs || ''} placeholder="20" onChange={(e) => setOvers(e.target.value)} aria-label="Overs per innings" />
                </Field>
                <p className="muted small">Tap the runs for each ball and, if you like, where the shot went. The app works out the score, run rates, every batter&apos;s and bowler&apos;s figures, partnerships and scoring areas, and suggests tactical changes as the game goes on. Everything saves as you go.</p>
                <button
                  className="btn primary"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() =>
                    updateMatch(m.id, (mm, draft) => {
                      mm.live = newLive(mm, { battingFirst: first, maxOvers: overs || fmt.overs || 20 });
                      logActivity(draft, { key: 'live-' + m.id, type: 'match', text: `Started live scoring for ${matchTitle(mm)}`, matchId: m.id, target: 'live' });
                    })
                  }
                >
                  <Play size={15} /> Start scoring
                </button>
              </div>
            </section>
            <div className="callout info">
              <AlertTriangle size={16} />
              <div>
                <strong>About Play-Cricket and live scores</strong>
                Play-Cricket&apos;s official access is for results after play and does not provide a live ball-by-ball feed to other apps. Scoring here gives you live analysis; afterwards you can import the official scorecard in Stats &amp; Play-Cricket.
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ---------- Innings state ----------
  const weBat = inn.battingSide === 'us';
  const c = chase(inn, s, live.maxOvers);
  const allOut = s.wickets >= 10;
  const oversDone = s.legal >= live.maxOvers * 6;
  const inningsOver = inn.closed || allOut || oversDone || (c && c.won);
  const battingIds = weBat ? xi : inn.opp.map((o) => o.id);
  const outIds = new Set([...s.batters.values()].filter((b) => b.out).map((b) => b.id));
  const available = battingIds.filter((id) => !outIds.has(id) && id !== inn.striker && id !== inn.nonStriker);
  const needBatters = !inningsOver && (!inn.striker || !inn.nonStriker);
  const needBowler = !inningsOver && !needBatters && !inn.bowler;
  const bowlerIds = weBat ? inn.opp.map((o) => o.id) : xi;
  const maxPer = live.maxPerBowler;
  const bowlerOk = (id) => id !== inn.lastOverBowler && (!maxPer || (s.bowlers.get(id)?.legal || 0) < maxPer * 6);
  const striker = inn.striker ? s.batters.get(inn.striker) || { runs: 0, balls: 0, fours: 0, sixes: 0 } : null;
  const nonStriker = inn.nonStriker ? s.batters.get(inn.nonStriker) || { runs: 0, balls: 0, fours: 0, sixes: 0 } : null;
  const bowler = inn.bowler ? s.bowlers.get(inn.bowler) || { legal: 0, runs: 0, wickets: 0, maidens: 0 } : null;
  const batterHand = (id) => (weBat ? roster.find((p) => p.id === id)?.bats : inn.opp.find((o) => o.id === id)?.bats) || 'Right';

  const record = (fields) => {
    let next;
    editLive((lv) => {
      const i = lv.innings[lv.current];
      next = recordBall(i, fields);
      if (next.overDone && i.nextBowler) {
        i.bowler = i.nextBowler !== i.lastOverBowler ? i.nextBowler : null;
        delete i.nextBowler;
      }
    });
    setPending(null);
    setExtraOpen(null);
  };
  const tapRuns = (runs) => {
    if (runs === 0) return record({ runs: 0 });
    setPending({ runs });
  };
  const undo = () => {
    if (!inn.balls.length) return;
    editLive((lv) => undoBall(lv.innings[lv.current]));
    setPending(null);
    toast('Last ball removed');
  };

  const setBatter = (slot, id) => editLive((lv) => (lv.innings[lv.current][slot] = id));
  const addOpp = (nm, slot) => {
    const id = uid('op');
    editLive((lv) => {
      const i = lv.innings[lv.current];
      i.opp.push({ id, name: nm.trim(), bats: 'Right' });
      if (slot) i[slot] = id;
    });
    return id;
  };
  const setBowler = (id) => editLive((lv) => (lv.innings[lv.current].bowler = id));

  const nextInnings = async () => {
    const ok = await confirm({ title: 'Start the second innings?', message: `${weBat ? 'We' : m.opposition || 'The opposition'} finished on ${s.runs}/${s.wickets} (${s.overs} overs). ${weBat ? m.opposition || 'The opposition' : 'We'} will need ${s.runs + 1} to win.`, confirmLabel: 'Start second innings' });
    if (!ok) return;
    editLive((lv) => {
      const prev = lv.innings[lv.current];
      prev.closed = true;
      lv.innings.push(newInnings(prev.battingSide === 'us' ? 'them' : 'us', s.runs + 1, prev.opp));
      lv.current = lv.innings.length - 1;
    }, `Second innings started in ${matchTitle(m)}`);
  };
  const endInnings = async () => {
    const ok = await confirm({ title: 'End this innings now?', message: 'Use this for a declaration or if play is stopped. You can still undo the last ball afterwards.', confirmLabel: 'End innings' });
    if (ok) editLive((lv) => (lv.innings[lv.current].closed = true));
  };
  const resetLive = async () => {
    const ok = await confirm({ title: 'Delete live scoring for this match?', message: 'Every ball recorded for this match will be deleted. Your fielding, batting and bowling plans are not affected.', confirmLabel: 'Delete scoring', danger: true });
    if (ok) updateMatch(m.id, (mm) => (mm.live = null));
  };

  const decide = (sug, status) =>
    updateMatch(m.id, (mm, draft) => {
      mm.live.suggestionState = { ...(mm.live.suggestionState || {}), [sug.id]: status };
      if (status === 'accepted') applySuggestion(mm, sug, roster);
      logActivity(draft, { key: 'sug-' + sug.id, type: 'fielding', text: `${status === 'accepted' ? 'Accepted' : 'Dismissed'}: ${sug.title}`, matchId: m.id, target: 'live' });
    });

  const open = suggestions.filter((x) => x.status === 'open');
  const old = suggestions.filter((x) => x.status !== 'open');
  const areaFor = areaView === 'innings' ? s.areaRuns.all : areaView === 'bowler' ? s.areaRuns.bowler[inn.bowler || inn.lastOverBowler] || {} : s.areaRuns.batter[inn.striker] || {};
  const lefty = areaView === 'striker' && batterHand(inn.striker) === 'Left';
  const syncWarning = sync?.enabled && (sync.state === 'error' || sync.state === 'offline');

  return (
    <>
      <PageHeader title="Live Match" subtitle={`${matchTitle(m)} · innings ${live.current + 1} · ${weBat ? 'we are batting' : 'we are bowling'}`}>
        {inningsOver && live.innings.length < 2 && (
          <button className="btn primary" onClick={nextInnings}>
            <Play size={15} /> Start second innings
          </button>
        )}
        {!inningsOver && (
          <button className="btn" onClick={endInnings}>
            <Flag size={15} /> End innings
          </button>
        )}
        <button className="btn ghost" onClick={resetLive}>
          <RotateCcw size={15} /> Delete scoring
        </button>
      </PageHeader>
      <div className="content">
        <div className="live-grid">
          <div className="stack">
            {/* Scoreboard */}
            <section className="panel scoreboard" aria-label="Score">
              <div className="sb-main">
                <div>
                  <div className="faint small">{weBat ? 'Us' : m.opposition || 'Opposition'}</div>
                  <div className="sb-score">
                    {s.runs}/{s.wickets}
                  </div>
                </div>
                <div className="sb-stats">
                  <div>
                    <span className="k">Overs</span>
                    <span className="v">
                      {s.overs}
                      <small> / {live.maxOvers}</small>
                    </span>
                  </div>
                  <div>
                    <span className="k">Run rate</span>
                    <span className="v">{r1(s.runRate)}</span>
                  </div>
                  {c && (
                    <div>
                      <span className="k">Need</span>
                      <span className="v">{c.won ? 'Won' : `${c.need} off ${c.ballsLeft}`}</span>
                    </div>
                  )}
                  {c && !c.won && (
                    <div>
                      <span className="k">Req. rate</span>
                      <span className="v">{r1(c.rrr)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="sb-foot">
                <span className="recent" aria-label="Recent balls">
                  {s.recent.map((r, i) => (
                    <span key={i} className={`rb ${r === 'W' ? 'w' : r === '4' || r === '6' ? 'b' : r === '•' ? 'd' : ''}`}>
                      {r}
                    </span>
                  ))}
                </span>
                <span className="spacer" />
                <span className="faint small">
                  <SourceTag kind="manual" /> {inn.balls.length ? `Last ball ${timeAgo(inn.balls[inn.balls.length - 1].ts)}` : 'No balls yet'}
                </span>
              </div>
              {syncWarning && <div className="callout caution small" style={{ margin: '0 14px 12px' }}>Sync is {sync.state === 'offline' ? 'offline' : 'not working'}, so other devices may show an older score.</div>}
            </section>

            {/* Who's in */}
            {needBatters && <PickBatters weBat={weBat} inn={inn} available={available} name={name} setBatter={setBatter} addOpp={addOpp} />}
            {needBowler && <PickBowler weBat={weBat} inn={inn} ids={bowlerIds} ok={bowlerOk} name={name} s={s} setBowler={setBowler} addOpp={addOpp} suggestion={suggestions.find((x) => x.action?.kind === 'nextBowler' && x.status === 'open')} />}
            {inningsOver && (
              <div className="callout good">
                <Check size={16} />
                <div>
                  <strong>Innings complete</strong>
                  {weBat ? 'We' : m.opposition || 'The opposition'} made {s.runs}/{s.wickets} in {s.overs} overs.
                  {c ? (c.won ? ' Target reached.' : ` Fell ${c.need - 1 === 0 ? 'one run' : `${c.need - 1} runs`} short of a tie.`) : ''}
                </div>
              </div>
            )}

            {(striker || nonStriker || bowler) && (
              <section className="panel">
                <table className="table live-table">
                  <thead>
                    <tr>
                      <th>Batter</th>
                      <th>R</th>
                      <th>B</th>
                      <th className="hide-sm">4s</th>
                      <th className="hide-sm">6s</th>
                      <th>SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [inn.striker, striker, true],
                      [inn.nonStriker, nonStriker, false],
                    ]
                      .filter(([id]) => id)
                      .map(([id, b, on]) => (
                        <tr key={id} className={on ? 'selected' : ''}>
                          <td style={{ fontWeight: 600 }}>
                            {name(id)}
                            {on ? ' *' : ''}
                          </td>
                          <td>{b.runs}</td>
                          <td>{b.balls}</td>
                          <td className="hide-sm">{b.fours}</td>
                          <td className="hide-sm">{b.sixes}</td>
                          <td>{b.balls ? Math.round((b.runs / b.balls) * 100) : '–'}</td>
                        </tr>
                      ))}
                  </tbody>
                  {inn.bowler && (
                    <>
                      <thead>
                        <tr>
                          <th>Bowler</th>
                          <th>O</th>
                          <th>M</th>
                          <th className="hide-sm">R</th>
                          <th className="hide-sm">W</th>
                          <th>Econ</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 600 }}>{name(inn.bowler)}</td>
                          <td>{oversText(bowler.legal)}</td>
                          <td>{bowler.maidens}</td>
                          <td className="hide-sm">{bowler.runs}</td>
                          <td className="hide-sm">{bowler.wickets}</td>
                          <td>{bowler.legal ? r1((bowler.runs / bowler.legal) * 6) : '–'}</td>
                        </tr>
                      </tbody>
                    </>
                  )}
                </table>
                {s.partnership.runs > 0 && (
                  <div className="faint small" style={{ padding: '8px 14px 12px' }}>
                    Partnership {s.partnership.runs} ({s.partnership.balls}) · this over {s.thisOver.runs} from {s.thisOver.legal} ball{s.thisOver.legal === 1 ? '' : 's'}
                  </div>
                )}
              </section>
            )}

            {/* Scoring pad */}
            {!inningsOver && !needBatters && !needBowler && (
              <section className="panel panel-pad pad">
                {pending ? (
                  <div className="stack-sm">
                    <div className="row">
                      <strong>Where did it go?</strong>
                      <span className="faint small">
                        {pending.extra === 'nb' ? `${pending.runs} off a no-ball` : `${pending.runs} run${pending.runs === 1 ? '' : 's'}`} · {name(inn.striker)} ({batterHand(inn.striker) === 'Left' ? 'left' : 'right'}-handed)
                      </span>
                    </div>
                    <div className="area-grid">
                      {AREA_GRID.map((row, ri) =>
                        (batterHand(inn.striker) === 'Left' ? [...row].reverse() : row).map((a, ci) =>
                          a ? (
                            <button key={`${ri}-${ci}`} className="btn area-btn" onClick={() => record({ ...pending, area: a })}>
                              {SCORING_AREA_BY_ID[a].name.replace(' (keeper / slips)', '')}
                            </button>
                          ) : (
                            <span key={`${ri}-${ci}`} className={ri === 1 ? 'area-pitch' : ''} />
                          )
                        )
                      )}
                    </div>
                    <div className="row">
                      <button className="btn" onClick={() => record(pending)}>
                        Skip direction
                      </button>
                      <button className="btn ghost" onClick={() => setPending(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : extraOpen ? (
                  <ExtraPicker kind={extraOpen} onPick={(f) => (f.extra === 'nb' && f.runs > 0 ? setPending(f) : record(f))} onCancel={() => setExtraOpen(null)} />
                ) : (
                  <div className="stack-sm">
                    <div className="pad-runs">
                      {[0, 1, 2, 3, 4, 6].map((r) => (
                        <button key={r} className={`btn pad-btn ${r >= 4 ? 'boundary' : ''}`} onClick={() => tapRuns(r)} aria-label={r === 0 ? 'Dot ball' : `${r} runs`}>
                          {r === 0 ? '•' : r}
                        </button>
                      ))}
                    </div>
                    <div className="pad-extras">
                      {[
                        ['wd', 'Wide'],
                        ['nb', 'No ball'],
                        ['b', 'Bye'],
                        ['lb', 'Leg bye'],
                      ].map(([k, l]) => (
                        <button key={k} className="btn" onClick={() => setExtraOpen(k)}>
                          {l}
                        </button>
                      ))}
                      <button className="btn danger" onClick={() => setWicketOpen(true)}>
                        Wicket
                      </button>
                      <button className="btn ghost" onClick={undo} disabled={!inn.balls.length} aria-label="Undo last ball">
                        <Undo2 size={15} /> Undo
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
            {inningsOver && inn.balls.length > 0 && (
              <button className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={undo}>
                <Undo2 size={15} /> Undo last ball
              </button>
            )}

            <section className="panel">
              <button className="panel-head card-toggle" onClick={() => setShowCard((v) => !v)} aria-expanded={showCard}>
                <h2>Full scorecard</h2>
                <span className="spacer" />
                {showCard ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showCard && <Scorecard live={live} m={m} roster={roster} />}
            </section>
          </div>

          <div className="stack">
            <section className="panel">
              <div className="panel-head">
                <h2>Tactical suggestions</h2>
                <SourceTag kind="generated" />
              </div>
              <div className="panel-body stack-sm">
                {open.length === 0 && (
                  <p className="muted small">
                    {s.legal < 12 ? 'Suggestions appear once there are enough balls to go on — the app never judges a player on one or two deliveries.' : 'Nothing to suggest right now. Recording where shots go makes fielding suggestions possible.'}
                  </p>
                )}
                {open.map((sug) => (
                  <div key={sug.id} className={`sug sug-${sug.type.toLowerCase()}`}>
                    <div className="row">
                      <span className="tag grey">{sug.type}</span>
                      <strong style={{ flex: 1 }}>{sug.title}</strong>
                    </div>
                    <p className="muted small">{sug.why}</p>
                    {sug.suggestion && <p className="small">{sug.suggestion}</p>}
                    {sug.evidence?.length > 0 && <p className="faint small">Figures: {sug.evidence.join(' · ')}</p>}
                    <div className="row row-wrap">
                      {sug.action && (
                        <button className="btn sm primary" onClick={() => (decide(sug, 'accepted'), toast(sug.action.kind === 'nextBowler' ? 'Noted for the next over' : 'Fielding setup updated'))}>
                          <Check size={14} /> {sug.action.label}
                        </button>
                      )}
                      {!sug.action && (
                        <button className="btn sm" onClick={() => decide(sug, 'accepted')}>
                          <Check size={14} /> Noted
                        </button>
                      )}
                      <button className="btn sm ghost" onClick={() => decide(sug, 'dismissed')}>
                        <X size={14} /> Dismiss
                      </button>
                    </div>
                  </div>
                ))}
                {old.length > 0 && (
                  <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setShowOld((v) => !v)}>
                    {showOld ? 'Hide' : 'Show'} {old.length} earlier suggestion{old.length === 1 ? '' : 's'}
                  </button>
                )}
                {showOld &&
                  old.map((sug) => (
                    <div key={sug.id} className="faint small">
                      {sug.status === 'accepted' ? '✓ Accepted' : '✕ Dismissed'}: {sug.title}
                    </div>
                  ))}
                <p className="faint small">Suggestions are the app&apos;s reading of the figures above. Nothing changes unless you accept it.</p>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Scoring areas</h2>
                <div className="seg">
                  {[
                    ['striker', 'Striker'],
                    ['bowler', 'Bowler'],
                    ['innings', 'Innings'],
                  ].map(([k, l]) => (
                    <button key={k} className={areaView === k ? 'on' : ''} onClick={() => setAreaView(k)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="panel-body">
                <div className="live-field">
                  <CricketField positions={!weBat && setup ? setup.positions : {}} custom={!weBat && setup ? setup.custom || [] : []} showInactive={false} heat={Object.keys(areaFor).length ? areaFor : null} compact leftHanded={lefty} />
                </div>
                <div className="area-list">
                  {Object.entries(areaFor)
                    .sort((a, b) => b[1] - a[1])
                    .map(([a, r]) => (
                      <span key={a} className="tag grey">
                        {SCORING_AREA_BY_ID[a]?.name.replace(' (keeper / slips)', '')}: {r}
                      </span>
                    ))}
                  {!Object.keys(areaFor).length && <span className="faint small">No shot directions recorded yet.</span>}
                </div>
                {!weBat && <p className="faint small">Green markers are your current field ({setup?.name}).</p>}
              </div>
            </section>
            <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => go('fielding')}>
              Open Fielding Positions
            </button>
          </div>
        </div>
      </div>
      {wicketOpen && (
        <WicketDialog
          inn={inn}
          weBat={weBat}
          xi={xi}
          name={name}
          onClose={() => setWicketOpen(false)}
          onSave={(w, runs) => {
            setWicketOpen(false);
            record({ runs, wicket: w });
          }}
        />
      )}
    </>
  );
}

function PickBatters({ weBat, inn, available, name, setBatter, addOpp }) {
  const [txt, setTxt] = useState({ striker: '', nonStriker: '' });
  return (
    <section className="panel panel-pad stack-sm pick">
      <strong>Who&apos;s batting?</strong>
      {['striker', 'nonStriker'].map((slot) =>
        inn[slot] ? (
          <div key={slot} className="small muted">
            {slot === 'striker' ? 'On strike' : 'Non-striker'}: <strong style={{ color: 'var(--text)' }}>{name(inn[slot])}</strong>
          </div>
        ) : weBat ? (
          <Field key={slot} label={slot === 'striker' ? 'On strike' : 'Non-striker'}>
            <Select value="" onChange={(v) => v && setBatter(slot, v)} placeholder="Choose batter…" options={available.map((id) => ({ value: id, label: name(id) }))} aria-label={slot === 'striker' ? 'Striker' : 'Non-striker'} />
          </Field>
        ) : (
          <Field key={slot} label={slot === 'striker' ? 'On strike' : 'Non-striker'}>
            <div className="row">
              <input className="input" value={txt[slot]} onChange={(e) => setTxt({ ...txt, [slot]: e.target.value })} placeholder={`Batter ${inn.opp.length + 1}`} aria-label={slot === 'striker' ? 'Striker name' : 'Non-striker name'} />
              <button className="btn primary" onClick={() => addOpp(txt[slot] || `Batter ${inn.opp.length + 1}`, slot)}>
                Add
              </button>
            </div>
            {available.length > 0 && (
              <Select value="" onChange={(v) => v && setBatter(slot, v)} placeholder="…or choose someone already named" options={available.map((id) => ({ value: id, label: name(id) }))} />
            )}
          </Field>
        )
      )}
    </section>
  );
}

function PickBowler({ weBat, inn, ids, ok, name, s, setBowler, addOpp, suggestion }) {
  const [txt, setTxt] = useState('');
  return (
    <section className="panel panel-pad stack-sm pick">
      <strong>Who&apos;s bowling {s.legal ? 'the next over' : 'first'}?</strong>
      {suggestion && <p className="small muted">Suggested: {suggestion.suggestion}</p>}
      {weBat ? (
        <>
          <div className="row">
            <input className="input" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Bowler's name" aria-label="Bowler name" />
            <button className="btn primary" onClick={() => setBowler(addOpp(txt || `Bowler ${inn.opp.length + 1}`))}>
              Add
            </button>
          </div>
          {ids.filter(ok).length > 0 && <Select value="" onChange={(v) => v && setBowler(v)} placeholder="…or choose a bowler already used" options={ids.filter(ok).map((id) => ({ value: id, label: name(id) }))} />}
        </>
      ) : (
        <Select
          value=""
          onChange={(v) => v && setBowler(v)}
          placeholder="Choose bowler…"
          aria-label="Bowler"
          options={ids.map((id) => {
            const b = s.bowlers.get(id);
            return { value: id, label: `${name(id)}${b ? ` (${oversText(b.legal)}-${b.runs}-${b.wickets})` : ''}${id === inn.lastOverBowler ? ' — bowled last over' : ''}`, disabled: !ok(id) };
          })}
        />
      )}
    </section>
  );
}

function ExtraPicker({ kind, onPick, onCancel }) {
  const label = { wd: 'Wide', nb: 'No ball', b: 'Byes', lb: 'Leg byes' }[kind];
  const opts = kind === 'wd' ? [0, 1, 2, 3, 4] : kind === 'nb' ? [0, 1, 2, 3, 4, 6] : [1, 2, 3, 4];
  return (
    <div className="stack-sm">
      <strong>{label}</strong>
      <span className="faint small">{kind === 'wd' ? 'Extra runs run or overthrows (the wide itself counts 1)' : kind === 'nb' ? 'Runs off the bat (the no-ball itself counts 1)' : 'Runs taken'}</span>
      <div className="pad-runs">
        {opts.map((n) => (
          <button key={n} className="btn pad-btn" onClick={() => onPick(kind === 'nb' ? { extra: 'nb', runs: n } : { extra: kind, extraRuns: n })}>
            {kind === 'wd' || kind === 'nb' ? `+${n}` : n}
          </button>
        ))}
      </div>
      <button className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function WicketDialog({ inn, weBat, xi, name, onClose, onSave }) {
  const [type, setType] = useState('Bowled');
  const [out, setOut] = useState(inn.striker);
  const [fielder, setFielder] = useState('');
  const [runs, setRuns] = useState(0);
  const fielders = weBat ? inn.opp : xi.map((id) => ({ id, name: name(id) }));
  return (
    <Modal
      title="Wicket"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn solid-danger" onClick={() => onSave({ type, out, fielder: needsFielder(type) ? fielder : '' }, type === 'Run out' ? runs : 0)}>
            Record wicket
          </button>
        </>
      }
    >
      <div className="stack">
        <Field label="How out">
          <Select value={type} onChange={setType} options={WICKET_TYPES} aria-label="How out" />
        </Field>
        <Field label="Who is out">
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            {[inn.striker, inn.nonStriker].filter(Boolean).map((id) => (
              <button key={id} type="button" className={out === id ? 'on' : ''} onClick={() => setOut(id)}>
                {name(id)}
                {id === inn.striker ? ' (striker)' : ''}
              </button>
            ))}
          </div>
        </Field>
        {needsFielder(type) && (
          <Field label={type === 'Stumped' ? 'Wicketkeeper' : 'Fielder'}>
            {weBat ? (
              <input className="input" value={fielder} onChange={(e) => setFielder(e.target.value)} placeholder="Fielder's name (optional)" aria-label="Fielder" />
            ) : (
              <Select value={fielder} onChange={setFielder} placeholder="Choose fielder…" options={fielders.map((f) => ({ value: f.id, label: f.name }))} aria-label="Fielder" />
            )}
          </Field>
        )}
        {type === 'Run out' && (
          <Field label="Runs completed before the run out">
            <input className="input" type="number" min="0" max="6" inputMode="numeric" value={runs} onChange={(e) => setRuns(Math.max(0, Number(e.target.value) || 0))} style={{ maxWidth: 120 }} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function Scorecard({ live, m, roster }) {
  return (
    <div className="panel-body stack">
      {live.innings.map((inn, i) => {
        const s = computeInnings(inn);
        const nm = (id) => nameFor(id, m, roster, inn);
        return (
          <div key={inn.id} className="stack-sm">
            <strong>
              Innings {i + 1}: {inn.battingSide === 'us' ? 'Us' : m.opposition || 'Opposition'} {s.runs}/{s.wickets} ({s.overs} ov)
            </strong>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Batter</th>
                    <th>How out</th>
                    <th>R</th>
                    <th>B</th>
                  </tr>
                </thead>
                <tbody>
                  {[...s.batters.values()].map((b) => (
                    <tr key={b.id}>
                      <td>{nm(b.id)}</td>
                      <td className="muted">{b.out ? `${b.out.type}${b.out.fielder ? ` (${nm(b.out.fielder) || b.out.fielder})` : ''}${['Run out', 'Retired', 'Other'].includes(b.out.type) ? '' : ` b ${nm(b.out.bowler)}`}` : 'not out'}</td>
                      <td>{b.runs}</td>
                      <td>{b.balls}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="muted">Extras</td>
                    <td />
                    <td>{s.extras}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
              <table className="table">
                <thead>
                  <tr>
                    <th>Bowler</th>
                    <th>O</th>
                    <th>M</th>
                    <th>R</th>
                    <th>W</th>
                  </tr>
                </thead>
                <tbody>
                  {[...s.bowlers.values()].map((b) => (
                    <tr key={b.id}>
                      <td>{nm(b.id)}</td>
                      <td>{oversText(b.legal)}</td>
                      <td>{b.maidens}</td>
                      <td>{b.runs}</td>
                      <td>{b.wickets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}


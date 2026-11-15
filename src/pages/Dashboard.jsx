import { ArrowRight, CircleDot, CloudSun, Crosshair, Lightbulb, ListOrdered, NotebookPen, Plus, Trophy, Users, History } from 'lucide-react';
import { useStore } from '../store.jsx';
import { PageHeader, useNav } from '../components/ui.jsx';
import { fieldingSummary, formatDate, formatInfo, matchTitle, timeAgo } from '../data/model.js';
import { weatherWarning } from '../lib/weather.js';

const QUICK = [
  { id: 'fielding', title: 'Fielding Positions', text: 'Tick positions, enter fielders and see them on the field.', icon: Crosshair },
  { id: 'batting', title: 'Batting Order', text: 'Set and rearrange the order your 11 players bat in.', icon: ListOrdered },
  { id: 'bowling', title: 'Bowling Order', text: 'Plan your bowlers, their sequence and planned overs.', icon: CircleDot },
  { id: 'matchday', title: 'Match Day', text: 'Weather, pitch, ground and tactical recommendations.', icon: CloudSun },
  { id: 'notes', title: 'Game Notes', text: 'Record observations, performances and reflections.', icon: NotebookPen },
  { id: 'tips', title: 'Tips and Improvements', text: 'Track advice and areas the team is working on.', icon: Lightbulb },
];

const ACT_ICONS = { notes: NotebookPen, fielding: Crosshair, tip: Lightbulb, match: Trophy, batting: ListOrdered, bowling: CircleDot, matchday: CloudSun, players: Users };

export default function Dashboard() {
  const { data, setWorkingMatchId } = useStore();
  const { go, openNewMatch } = useNav();
  const current = data.matches.find((m) => m.id === data.currentMatchId);
  const m = current || null;

  let overview = null;
  if (m) {
    const batFilled = m.batting.filter((r) => r.playerId).length;
    const bowlers = m.bowling.filter((r) => r.playerId);
    const overs = bowlers.reduce((a, r) => a + (Number(r.overs) || 0), 0);
    const fmt = formatInfo(m);
    const setup = m.fielding.setups.find((s) => s.id === m.fielding.activeSetupId) || m.fielding.setups[0];
    const fs = fieldingSummary(setup);
    const done = m.matchDay.checklist.filter((c) => c.done).length;
    const total = m.matchDay.checklist.length;
    const warn = m.matchDay.weather?.status === 'ok' ? weatherWarning(m.matchDay.weather.summary) : null;
    overview = { batFilled, bowlers: bowlers.length, overs, fmt, setup, fs, done, total, warn };
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your cricket team at a glance">
        <button className="btn primary" onClick={openNewMatch}>
          <Plus size={16} /> New Match
        </button>
      </PageHeader>
      <div className="content">
        <div className="stack" style={{ gap: 20 }}>
          <div className="hero">
            <div>
              <h2>Welcome back</h2>
              <p className="muted">
                Organise your team, plan fielding positions, set batting and bowling orders, and prepare for match day — all in one place.
              </p>
            </div>
            {m ? (
              <div style={{ textAlign: 'right' }}>
                <div className="faint small">Current match</div>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{matchTitle(m)}</div>
                <div className="muted small">{m.date ? formatDate(m.date) : 'Date not set'}</div>
              </div>
            ) : (
              <button className="btn primary" onClick={openNewMatch}>
                Create your first match
              </button>
            )}
          </div>

          {m && overview && (
            <section className="panel">
              <div className="panel-head">
                <h2>
                  <Trophy size={16} color="var(--green-soft)" /> Current Match Overview
                </h2>
                <button className="btn sm" onClick={() => go('match')}>
                  Open match <ArrowRight size={14} />
                </button>
              </div>
              <div className="stat-list" style={{ borderRadius: 0 }}>
                <div className="stat">
                  <div className="k">Match</div>
                  <div className="v">{matchTitle(m)}</div>
                  <div className="s">{m.competition || overview.fmt.label}</div>
                </div>
                <div className="stat">
                  <div className="k">Opposition</div>
                  <div className="v">{m.opposition || '—'}</div>
                </div>
                <div className="stat">
                  <div className="k">Date</div>
                  <div className="v">{m.date ? formatDate(m.date) : '—'}</div>
                  <div className="s">{m.startTime ? `Start ${m.startTime}` : ''}</div>
                </div>
                <div className="stat">
                  <div className="k">Location</div>
                  <div className="v">{m.matchDay.groundName || '—'}</div>
                  <div className="s">{[m.matchDay.field, m.matchDay.groundLocation].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="stat">
                  <div className="k">Batting order</div>
                  <div className="v">{overview.batFilled === 11 ? 'Complete' : `${overview.batFilled} of 11 set`}</div>
                  <div className="progress" style={{ marginTop: 8 }}>
                    <div style={{ width: `${(overview.batFilled / 11) * 100}%` }} />
                  </div>
                </div>
                <div className="stat">
                  <div className="k">Bowling order</div>
                  <div className="v">{overview.bowlers ? `${overview.bowlers} bowlers` : 'Not set'}</div>
                  <div className="s">
                    {overview.overs} {overview.fmt.overs ? `of ${overview.fmt.overs}` : ''} overs planned
                  </div>
                </div>
                <div className="stat">
                  <div className="k">Fielding setup</div>
                  <div className="v">{overview.setup?.name}</div>
                  <div className="s">
                    {overview.fs.count} positions · {overview.fs.named} fielders named
                  </div>
                </div>
                <div className="stat">
                  <div className="k">Match Day preparation</div>
                  <div className="v">
                    {overview.done} of {overview.total} checklist items
                  </div>
                  <div className="s">{overview.warn ? overview.warn.title : m.matchDay.weather ? 'Weather checked' : 'Weather not checked yet'}</div>
                </div>
              </div>
            </section>
          )}

          <section>
            <h2 className="section-title">Quick access</h2>
            <div className="grid grid-3">
              {QUICK.map((q) => (
                <button key={q.id} className="panel quick" onClick={() => go(q.id)}>
                  <div className="quick-icon">
                    <q.icon size={19} />
                  </div>
                  <h3>{q.title}</h3>
                  <p>{q.text}</p>
                  <span className="go">
                    Open <ArrowRight size={13} />
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-2">
            <section className="panel">
              <div className="panel-head">
                <h2>Recent activity</h2>
              </div>
              <div className="panel-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
                {data.activity.length === 0 && <p className="muted" style={{ padding: '14px 0' }}>Your recent notes, fielding setups and improvements will appear here.</p>}
                {data.activity.slice(0, 7).map((a) => {
                  const Icon = ACT_ICONS[a.type] || Trophy;
                  const mm = data.matches.find((x) => x.id === a.matchId);
                  return (
                    <button
                      className="activity-item"
                      key={a.id}
                      onClick={() => {
                        if (mm && mm.id !== data.currentMatchId && !['tips', 'players'].includes(a.target)) return go('history', { open: mm.id });
                        setWorkingMatchId(null);
                        go(a.target || 'dashboard');
                      }}
                    >
                      <div className="activity-icon">
                        <Icon size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.text}</div>
                        <div className="faint small">
                          {timeAgo(a.ts)}
                          {mm ? ` · ${matchTitle(mm)}` : ''}
                        </div>
                      </div>
                      <ArrowRight size={14} className="faint" />
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2>Team</h2>
                <button className="btn sm" onClick={() => go('players')}>
                  Manage players
                </button>
              </div>
              <div className="panel-body grid grid-2" style={{ gap: '6px 18px' }}>
                {data.players.map((p, i) => (
                  <div key={p.id} className="row" style={{ gap: 10 }}>
                    <span className="player-num" style={{ width: 24, height: 24, fontSize: 11 }}>
                      {i + 1}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || <em className="faint">Empty slot</em>}</span>
                  </div>
                ))}
              </div>
              <div className="panel-body row" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, paddingBottom: 12 }}>
                <History size={15} className="faint" />
                <span className="muted small">
                  {data.matches.length} match{data.matches.length === 1 ? '' : 'es'} saved · {data.tips.length} tips recorded
                </span>
                <span className="spacer" />
                <button className="btn sm ghost" onClick={() => go('history')}>
                  Match History <ArrowRight size={13} />
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

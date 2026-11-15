import { Fragment, useState } from 'react';
import { ArrowLeft, History as HistoryIcon, Pencil, Plus, RotateCcw, Star, Trash2, Lock } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Empty, PageHeader, Select, SourceTag, useDialog, useNav, useToast } from '../components/ui.jsx';
import CricketField from '../components/CricketField.jsx';
import { WeatherPanel } from './MatchDay.jsx';
import { TipCard } from './Tips.jsx';
import { NOTE_SECTIONS, PITCH_BEHAVIOUR, formatDate, formatInfo, matchTitle, ordinal, playerName } from '../data/model.js';
import { POSITIONS } from '../data/positions.js';
import { SCORING_AREA_BY_ID } from '../data/positions.js';

const statusTag = (m, currentId) =>
  m.id === currentId ? <span className="tag green">Current</span> : m.status === 'Finished' ? <span className="tag grey">Finished</span> : <span className="tag amber">In Preparation</span>;

export default function History() {
  const { data, update, setWorkingMatchId } = useStore();
  const { params, go, openNewMatch } = useNav();
  const { confirm } = useDialog();
  const toast = useToast();
  const [openId, setOpenId] = useState(params.open || null);
  const [filter, setFilter] = useState('');
  const open = data.matches.find((m) => m.id === openId);

  const sorted = [...data.matches]
    .filter((m) => !filter || (filter === 'Finished' ? m.status === 'Finished' : m.status !== 'Finished'))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);

  const edit = (m) => {
    setWorkingMatchId(m.id === data.currentMatchId ? null : m.id);
    go('match');
  };
  const reopen = (m) => {
    update((d) => {
      const x = d.matches.find((y) => y.id === m.id);
      x.status = 'In Preparation';
      x.rosterSnapshot = null;
    });
    toast('Match reopened');
  };
  const makeCurrent = (m) => {
    update((d) => {
      d.currentMatchId = m.id;
      const x = d.matches.find((y) => y.id === m.id);
      if (x.status === 'Finished') {
        x.status = 'In Preparation';
        x.rosterSnapshot = null;
      }
    });
    setWorkingMatchId(null);
    toast(`${matchTitle(m)} is now the current match`);
  };
  const remove = async (m) => {
    const ok = await confirm({
      title: `Delete "${matchTitle(m)}"?`,
      message: 'This permanently deletes the match and everything saved with it: fielding setups, batting and bowling orders, Match Day information and game notes. This cannot be undone.',
      confirmLabel: 'Delete match',
      danger: true,
    });
    if (!ok) return;
    update((d) => {
      d.matches = d.matches.filter((x) => x.id !== m.id);
      if (d.currentMatchId === m.id) d.currentMatchId = null;
      d.tips.forEach((t) => t.matchId === m.id && (t.matchId = ''));
    });
    setWorkingMatchId(null);
    setOpenId(null);
    toast('Match deleted');
  };

  if (open) {
    return (
      <>
        <PageHeader title={matchTitle(open)} subtitle={`Match History · ${open.date ? formatDate(open.date) : 'no date'}${open.result ? ' · ' + open.result : ''}`}>
          <button className="btn" onClick={() => setOpenId(null)}>
            <ArrowLeft size={15} /> All matches
          </button>
          {open.id !== data.currentMatchId && (
            <button className="btn" onClick={() => makeCurrent(open)}>
              <Star size={15} /> Make current match
            </button>
          )}
          {open.status === 'Finished' && open.id !== data.currentMatchId && (
            <button className="btn" onClick={() => reopen(open)}>
              <RotateCcw size={15} /> Reopen
            </button>
          )}
          <button className="btn primary" onClick={() => edit(open)}>
            <Pencil size={15} /> Edit this match
          </button>
        </PageHeader>
        <div className="content">
          <MatchReview m={open} />
          <div style={{ marginTop: 28 }}>
            <button className="btn danger" onClick={() => remove(open)}>
              <Trash2 size={14} /> Delete match
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Match History" subtitle="Every match you have organised, with everything saved at the time">
        <button className="btn primary" onClick={openNewMatch}>
          <Plus size={16} /> New Match
        </button>
      </PageHeader>
      <div className="content">
        {data.matches.length === 0 ? (
          <Empty icon={HistoryIcon} title="No matches yet" action={<button className="btn primary" onClick={openNewMatch}><Plus size={15} /> New Match</button>}>
            When you create and finish matches they are kept here, so you can look back at fielding setups, orders, conditions and notes.
          </Empty>
        ) : (
          <div className="stack">
            <div className="seg" style={{ alignSelf: 'flex-start' }}>
              {[
                ['', 'All'],
                ['Upcoming', 'Upcoming'],
                ['Finished', 'Finished'],
              ].map(([v, l]) => (
                <button key={v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>
                  {l}
                </button>
              ))}
            </div>
            <div className="panel">
              <table className="table">
                <thead>
                  <tr>
                    <th>Match</th>
                    <th>Opposition</th>
                    <th>Date</th>
                    <th className="hide-sm">Ground</th>
                    <th>Status</th>
                    <th className="hide-sm">Result</th>
                    <th className="hide-sm" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((m) => (
                    <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(m.id)} className={m.id === data.currentMatchId ? 'selected' : ''}>
                      <td style={{ fontWeight: 550 }}>{matchTitle(m)}</td>
                      <td className="muted">{m.opposition || '—'}</td>
                      <td className="muted">{m.date ? formatDate(m.date, { short: true }) : '—'}</td>
                      <td className="muted hide-sm">{[m.matchDay.groundName, m.matchDay.field].filter(Boolean).join(' · ') || '—'}</td>
                      <td>{statusTag(m, data.currentMatchId)}</td>
                      <td className="muted hide-sm">{m.result || '—'}</td>
                      <td className="hide-sm" style={{ textAlign: 'right' }}>
                        <button className="btn sm" onClick={(e) => (e.stopPropagation(), setOpenId(m.id))}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const REVIEW_TABS = ['Details', 'Match Day', 'Fielding', 'Batting', 'Bowling', 'Game Notes', 'Tips'];

export function MatchReview({ m }) {
  const { data } = useStore();
  const [tab, setTab] = useState('Details');
  const [setupId, setSetupId] = useState(m.fielding.activeSetupId);
  const setup = m.fielding.setups.find((s) => s.id === setupId) || m.fielding.setups[0];
  const fmt = formatInfo(m);
  const md = m.matchDay;
  const rec = md.recommendations;
  const name = (id) => playerName(data.players, m, id) || <span className="faint">—</span>;
  const tips = data.tips.filter((t) => t.matchId === m.id);
  const v = (x) => x || <span className="faint">Not recorded</span>;

  return (
    <div className="stack">
      <div className="row faint small">
        <Lock size={13} /> Read-only view — use “Edit this match” to make changes.
      </div>
      <div className="md-tabs">
        {REVIEW_TABS.map((t) => (
          <button key={t} className={`md-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Details' && (
        <div className="panel panel-pad">
          <dl className="kv">
            <dt>Match name</dt>
            <dd>{v(m.name)}</dd>
            <dt>Opposition</dt>
            <dd>{v(m.opposition)}</dd>
            <dt>Date</dt>
            <dd>{m.date ? formatDate(m.date) : v('')}</dd>
            <dt>Start time</dt>
            <dd>{v(m.startTime)}</dd>
            <dt>Competition</dt>
            <dd>{v(m.competition)}</dd>
            <dt>Format</dt>
            <dd>{fmt.id ? fmt.label : v('')}</dd>
            <dt>Ground</dt>
            <dd>{v([md.groundName, md.field, md.groundLocation].filter(Boolean).join(' · '))}</dd>
            <dt>Status</dt>
            <dd>{m.status}</dd>
            <dt>Result</dt>
            <dd>{v(m.result)}</dd>
            <dt>Information</dt>
            <dd className="pre">{v(m.info)}</dd>
          </dl>
        </div>
      )}

      {tab === 'Match Day' && (
        <div className="stack">
          {md.weather?.status === 'ok' ? (
            <WeatherPanel w={md.weather} />
          ) : (
            <div className="callout missing">{md.weather?.message || 'No weather was retrieved for this match.'}</div>
          )}
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <div className="panel panel-pad">
              <div className="row" style={{ marginBottom: 10 }}>
                <h3 style={{ fontSize: 14.5 }}>Pitch and ground</h3>
                <span className="spacer" />
                <SourceTag kind="manual" />
              </div>
              <dl className="kv">
                <dt>Pitch type</dt>
                <dd>{v(md.pitch.type)}</dd>
                <dt>Condition</dt>
                <dd>{md.pitch.condition}</dd>
                <dt>Outfield</dt>
                <dd>{md.pitch.outfield}</dd>
                <dt>Ground size</dt>
                <dd>{md.pitch.groundSize}</dd>
                {PITCH_BEHAVIOUR.map((b) => (
                  <Fragment key={b.id}>
                    <dt>{b.label}</dt>
                    <dd>{md.pitch[b.id]}</dd>
                  </Fragment>
                ))}
                <dt>Boundaries</dt>
                <dd>
                  {v(
                    [
                      md.pitch.boundaryStraight && `Straight ${md.pitch.boundaryStraight}`,
                      md.pitch.boundarySquare && `Square ${md.pitch.boundarySquare}`,
                      md.pitch.boundaryBehind && `Behind ${md.pitch.boundaryBehind}`,
                      md.pitch.boundaryOther && `Other ${md.pitch.boundaryOther}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  )}
                </dd>
                <dt>Notes</dt>
                <dd className="pre">{v(md.groundNotes)}</dd>
              </dl>
            </div>
            <div className="stack">
              <div className="panel panel-pad">
                <div className="row" style={{ marginBottom: 10 }}>
                  <h3 style={{ fontSize: 14.5 }}>Recommendations at the time</h3>
                  <span className="spacer" />
                  <SourceTag kind="generated" />
                </div>
                {rec ? (
                  <div className="stack-sm">
                    <div>
                      <strong>Toss:</strong> {rec.toss}
                    </div>
                    {rec.summary.map((s) => (
                      <div key={s.id} className="plan-item">
                        <h4>{s.title}</h4>
                        <p>{s.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No recommendations were generated for this match.</p>
                )}
              </div>
              <div className="panel panel-pad">
                <h3 style={{ fontSize: 14.5, marginBottom: 8 }}>Scoring observations</h3>
                {md.scoring?.length ? (
                  md.scoring.map((o) => (
                    <p key={o.id} className="muted small">
                      • {SCORING_AREA_BY_ID[o.area]?.name}: {o.note || '—'} {o.kind === 'sourced' ? `(source: ${o.source})` : '(your observation)'}
                    </p>
                  ))
                ) : (
                  <p className="muted small">None recorded.</p>
                )}
              </div>
              <div className="panel panel-pad">
                <h3 style={{ fontSize: 14.5, marginBottom: 8 }}>
                  Checklist ({md.checklist.filter((c) => c.done).length}/{md.checklist.length})
                </h3>
                {md.checklist.map((c) => (
                  <p key={c.id} className="small" style={{ color: c.done ? 'var(--green-soft)' : 'var(--text-3)' }}>
                    {c.done ? '✓' : '○'} {c.text}
                  </p>
                ))}
              </div>
              <div className="panel panel-pad">
                <h3 style={{ fontSize: 14.5, marginBottom: 8 }}>Personal Match Day notes</h3>
                <p className="pre">{v(md.notes)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Fielding' && (
        <div className="grid split" style={{ gridTemplateColumns: '300px minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
          <div className="stack">
            <Select value={setup.id} onChange={setSetupId} options={m.fielding.setups.map((s) => ({ value: s.id, label: s.name }))} aria-label="Fielding setup" />
            <div className="panel panel-pad stack-sm">
              {POSITIONS.filter((p) => setup.positions[p.id]?.active).map((p) => (
                <div key={p.id} className="row small" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">{p.name}</span>
                  <span>{setup.positions[p.id].player || '—'}</span>
                </div>
              ))}
              {!POSITIONS.some((p) => setup.positions[p.id]?.active) && <p className="muted small">No positions selected in this setup.</p>}
            </div>
          </div>
          <div className="field-svg-wrap review-field">
            <CricketField positions={setup.positions} showInactive={false} leftHanded={!!setup.leftHanded} />
          </div>
        </div>
      )}

      {tab === 'Batting' && (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Position</th>
                <th>Player</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {m.batting.map((r, i) => (
                <tr key={i}>
                  <td className="order-num">{ordinal(i + 1)}</td>
                  <td>{name(r.playerId)}</td>
                  <td className="muted">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Bowling' && (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Order</th>
                <th>Bowler</th>
                <th>Planned overs</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {m.bowling.map((r, i) => (
                <tr key={i}>
                  <td className="order-num">{ordinal(i + 1)}</td>
                  <td>{name(r.playerId)}</td>
                  <td>{r.overs || '—'}</td>
                  <td className="muted">{r.notes}</td>
                </tr>
              ))}
              <tr>
                <td />
                <td className="muted">Total</td>
                <td style={{ fontWeight: 600 }}>
                  {m.bowling.reduce((a, r) => a + (Number(r.overs) || 0), 0)}
                  {fmt.overs ? ` / ${fmt.overs}` : ''}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Game Notes' && (
        <div className="grid grid-2">
          {NOTE_SECTIONS.filter((s) => m.notes[s.id]?.trim()).map((s) => (
            <div key={s.id} className="panel panel-pad">
              <h3 style={{ fontSize: 14.5, marginBottom: 6 }}>{s.label}</h3>
              <p className="pre">{m.notes[s.id]}</p>
            </div>
          ))}
          {!NOTE_SECTIONS.some((s) => m.notes[s.id]?.trim()) && <p className="muted">No game notes were written for this match.</p>}
        </div>
      )}

      {tab === 'Tips' && (
        <div className="grid grid-3">
          {tips.length ? tips.map((t) => <TipCard key={t.id} t={t} data={data} />) : <p className="muted">No tips or improvements are linked to this match.</p>}
        </div>
      )}
    </div>
  );
}

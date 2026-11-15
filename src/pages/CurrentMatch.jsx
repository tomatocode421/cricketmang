import { useState } from 'react';
import { ArrowRight, CheckCircle2, CircleDot, CloudSun, Crosshair, Flag, History, ListOrdered, NotebookPen, Pencil, Plus, Save, Repeat, Share2 } from 'lucide-react';
import TeamSheetModal from '../components/TeamSheetModal.jsx';
import { useStore, logActivity } from '../store.jsx';
import { Field, PageHeader, Select, SourceTag, useDialog, useNav, useToast } from '../components/ui.jsx';
import NoMatch from '../components/NoMatch.jsx';
import { MATCH_FORMATS, XI_SIZE, changeXI, fieldingSummary, formatDate, formatInfo, matchTitle, matchXI } from '../data/model.js';
import { fmt1, playerStats } from '../lib/stats.js';
import { analyseMatch } from '../lib/tactics.js';

export function MatchDetailsForm({ m, set, setMd }) {
  const fmt = formatInfo(m);
  return (
    <div className="stack">
      <div className="grid grid-3">
        <Field label="Match name">
          <input className="input" value={m.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Round 5" />
        </Field>
        <Field label="Opposition">
          <input className="input" value={m.opposition} onChange={(e) => set('opposition', e.target.value)} placeholder="Opposing team" />
        </Field>
        <Field label="Match date">
          <input className="input" type="date" value={m.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Competition or league (optional)">
          <input className="input" value={m.competition} onChange={(e) => set('competition', e.target.value)} placeholder="e.g. Saturday B Grade" />
        </Field>
        <Field label="Ground name (optional)">
          <input className="input" value={m.matchDay.groundName} onChange={(e) => setMd('groundName', e.target.value)} placeholder="e.g. Memorial Oval" />
        </Field>
        <Field label="Ground location (optional)" hint="Suburb, town or address — used for the weather forecast">
          <input className="input" value={m.matchDay.groundLocation} onChange={(e) => setMd('groundLocation', e.target.value)} placeholder="e.g. Parramatta" />
        </Field>
        <Field label="Field or oval (optional)">
          <input className="input" value={m.matchDay.field} onChange={(e) => setMd('field', e.target.value)} placeholder="e.g. Oval 1" />
        </Field>
        <Field label="Match format (optional)">
          <Select value={m.format} onChange={(v) => set('format', v)} placeholder="Not set" options={MATCH_FORMATS.map((f) => ({ value: f.id, label: f.label }))} />
        </Field>
        <Field label="Start time (optional)">
          <input className="input" type="time" value={m.startTime} onChange={(e) => set('startTime', e.target.value)} />
        </Field>
      </div>
      {m.format === 'other' && (
        <div className="grid grid-3">
          <Field label="Overs per innings">
            <input className="input" type="number" min="1" value={m.customOvers} onChange={(e) => set('customOvers', e.target.value)} placeholder="e.g. 35" />
          </Field>
          <Field label="Max overs per bowler (optional)">
            <input className="input" type="number" min="1" value={m.customMaxPerBowler} onChange={(e) => set('customMaxPerBowler', e.target.value)} placeholder="e.g. 7" />
          </Field>
        </div>
      )}
      {fmt.overs && (
        <p className="faint small">
          {fmt.label}: {fmt.overs} overs per innings{fmt.maxPerBowler ? `, maximum ${fmt.maxPerBowler} overs per bowler` : ''}.
        </p>
      )}
      <Field label="General match information">
        <textarea className="textarea" value={m.info} onChange={(e) => set('info', e.target.value)} placeholder="Anything else about this match — meeting time, umpires, kit, travel…" />
      </Field>
    </div>
  );
}

export default function CurrentMatch() {
  const { data, match: m, updateMatch, update, flush, isEditingPrevious, setWorkingMatchId } = useStore();
  const { go, openNewMatch, params } = useNav();
  const [sheetOpen, setSheetOpen] = useState(!!params.share);
  const { confirm, prompt } = useDialog();
  const toast = useToast();
  const [editing, setEditing] = useState(() => !!m && !m.name && !m.opposition);

  if (!m)
    return (
      <>
        <PageHeader title="Current Match" subtitle="The game you are currently organising">
          <button className="btn primary" onClick={openNewMatch}>
            <Plus size={16} /> New Match
          </button>
        </PageHeader>
        <div className="content">
          <NoMatch what="match management" />
          <OtherMatches />
        </div>
      </>
    );

  const set = (k, v) =>
    updateMatch(m.id, (mm, draft) => {
      mm[k] = v;
      logActivity(draft, { key: 'details-' + m.id, type: 'match', text: `Updated match details for ${matchTitle(mm)}`, matchId: m.id, target: 'match' });
    });
  const setMd = (k, v) => updateMatch(m.id, (mm) => (mm.matchDay[k] = v));

  const finish = async () => {
    const ok = await confirm({
      title: 'Finish this match?',
      message: `"${matchTitle(m)}" will be saved to Match History with all of its fielding setups, batting and bowling orders, Match Day information and notes. You can reopen and edit it later.`,
      confirmLabel: 'Finish match',
    });
    if (!ok) return;
    const result = await prompt({ title: 'Match result (optional)', label: 'Result', placeholder: 'e.g. Won by 24 runs', confirmLabel: 'Save result' });
    update((draft) => {
      const mm = draft.matches.find((x) => x.id === m.id);
      mm.status = 'Finished';
      mm.finishedAt = Date.now();
      mm.result = result || mm.result || '';
      mm.rosterSnapshot = draft.players.map((p) => ({ ...p }));
      if (draft.currentMatchId === m.id) draft.currentMatchId = null;
      logActivity(draft, { key: 'finish-' + m.id, type: 'match', text: `Finished match ${matchTitle(mm)}`, matchId: m.id, target: 'history' });
    });
    setWorkingMatchId(null);
    toast('Match finished and saved to Match History');
    go('history', { open: m.id });
  };

  const save = async () => {
    await flush();
    toast('Match saved');
  };

  const a = analyseMatch(m, data.players);
  const fmt = formatInfo(m);
  const setup = m.fielding.setups.find((s) => s.id === m.fielding.activeSetupId) || m.fielding.setups[0];
  const fs = fieldingSummary(setup);
  const bat = m.batting.filter((r) => r.playerId).length;
  const bowlers = m.bowling.filter((r) => r.playerId);
  const overs = bowlers.reduce((x, r) => x + (Number(r.overs) || 0), 0);
  const checks = m.matchDay.checklist.filter((c) => c.done).length;
  const notesWords = Object.values(m.notes).join(' ').trim().split(/\s+/).filter(Boolean).length;

  const sections = [
    { id: 'matchday', icon: CloudSun, title: 'Match Day', status: `${checks}/${m.matchDay.checklist.length} checklist · ${m.matchDay.weather?.status === 'ok' ? 'weather retrieved' : 'weather not checked'}` },
    { id: 'fielding', icon: Crosshair, title: 'Fielding Positions', status: `${m.fielding.setups.length} setup${m.fielding.setups.length > 1 ? 's' : ''} · ${setup.name}: ${fs.count} positions` },
    { id: 'batting', icon: ListOrdered, title: 'Batting Order', status: `${bat} of 11 positions set` },
    { id: 'bowling', icon: CircleDot, title: 'Bowling Order', status: `${bowlers.length} bowlers · ${overs}${fmt.overs ? '/' + fmt.overs : ''} overs` },
    { id: 'notes', icon: NotebookPen, title: 'Game Notes', status: notesWords ? `${notesWords} words written` : 'No notes yet' },
  ];

  return (
    <>
      <PageHeader title="Current Match" subtitle={`${matchTitle(m)}${m.date ? ' · ' + formatDate(m.date) : ''}${m.status === 'Finished' ? ' · Finished' : ''}`}>
        <button className="btn" onClick={() => setSheetOpen(true)}>
          <Share2 size={15} /> Share team sheet
        </button>
        <button className="btn" onClick={() => go('history')}>
          <History size={15} /> View Match History
        </button>
        <button className="btn" onClick={save}>
          <Save size={15} /> Save Current Match
        </button>
        {m.status !== 'Finished' && (
          <button className="btn" onClick={finish}>
            <Flag size={15} /> Finish Match
          </button>
        )}
        <button className="btn primary" onClick={openNewMatch}>
          <Plus size={16} /> New Match
        </button>
      </PageHeader>
      <div className="content">
        <div className="stack" style={{ gap: 20 }}>
          <section className="panel">
            <div className="panel-head">
              <h2>Match details</h2>
              {editing ? (
                <button className="btn sm primary" onClick={() => setEditing(false)}>
                  <CheckCircle2 size={14} /> Done
                </button>
              ) : (
                <button className="btn sm" onClick={() => setEditing(true)}>
                  <Pencil size={14} /> Edit Match Details
                </button>
              )}
            </div>
            <div className="panel-body">
              {editing ? (
                <MatchDetailsForm m={m} set={set} setMd={setMd} />
              ) : (
                <dl className="kv">
                  <dt>Match name</dt>
                  <dd>{m.name || <span className="faint">Not set</span>}</dd>
                  <dt>Opposition</dt>
                  <dd>{m.opposition || <span className="faint">Not set</span>}</dd>
                  <dt>Date</dt>
                  <dd>{m.date ? formatDate(m.date) : <span className="faint">Not set</span>}</dd>
                  <dt>Start time</dt>
                  <dd>{m.startTime || <span className="faint">Not set</span>}</dd>
                  <dt>Competition</dt>
                  <dd>{m.competition || <span className="faint">Not set</span>}</dd>
                  <dt>Format</dt>
                  <dd>{fmt.id ? `${fmt.label}${fmt.overs ? ` (${fmt.overs} overs${fmt.maxPerBowler ? `, max ${fmt.maxPerBowler} per bowler` : ''})` : ''}` : <span className="faint">Not set</span>}</dd>
                  <dt>Location</dt>
                  <dd>{[m.matchDay.groundName, m.matchDay.field, m.matchDay.groundLocation].filter(Boolean).join(' · ') || <span className="faint">Not set</span>}</dd>
                  <dt>Information</dt>
                  <dd className="pre">{m.info || <span className="faint">None</span>}</dd>
                </dl>
              )}
            </div>
          </section>

          <TeamSelection m={m} />
          <div className="grid split" style={{ gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', alignItems: 'start' }}>
            <section className="panel">
              <div className="panel-head">
                <h2>Match plan</h2>
                <span className="muted small">Everything below belongs to this match</span>
              </div>
              <div className="panel-body stack-sm">
                {sections.map((s) => (
                  <button key={s.id} className="panel row" style={{ padding: '12px 14px', background: 'var(--panel-2)', cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'left' }} onClick={() => go(s.id)}>
                    <s.icon size={18} color="var(--green-soft)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 550 }}>{s.title}</div>
                      <div className="muted small">{s.status}</div>
                    </div>
                    <ArrowRight size={15} className="faint" />
                  </button>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2>Toss Strategy</h2>
                <SourceTag kind="generated" />
              </div>
              <div className="panel-body stack-sm">
                <div style={{ fontSize: 17, fontWeight: 600, color: a.toss.suggestion === 'No strong preference' ? 'var(--text)' : 'var(--green-soft)' }}>{a.toss.suggestion}</div>
                <p className="muted">{a.toss.text}</p>
                {a.toss.reasons.length > 0 && (
                  <ul className="reason-list">
                    {a.toss.reasons.slice(0, 3).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                <button className="btn sm" style={{ alignSelf: 'flex-start', marginTop: 6 }} onClick={() => go('matchday')}>
                  Full Match Day analysis <ArrowRight size={13} />
                </button>
              </div>
            </section>
          </div>
          {!isEditingPrevious && <OtherMatches />}
        </div>
      </div>
      {sheetOpen && <TeamSheetModal match={m} onClose={() => setSheetOpen(false)} />}
    </>
  );
}

function OtherMatches() {
  const { data, update } = useStore();
  const toast = useToast();
  const others = data.matches.filter((x) => x.status !== 'Finished' && x.id !== data.currentMatchId);
  if (!others.length) return null;
  return (
    <section className="panel" style={{ marginTop: 4 }}>
      <div className="panel-head">
        <h2>
          <Repeat size={15} /> Other upcoming matches
        </h2>
        <span className="muted small">Switching keeps every match&apos;s arrangements</span>
      </div>
      <table className="table">
        <tbody>
          {others.map((o) => (
            <tr key={o.id}>
              <td style={{ fontWeight: 550 }}>{matchTitle(o)}</td>
              <td className="muted hide-sm">{o.opposition}</td>
              <td className="muted">{o.date ? formatDate(o.date) : 'No date'}</td>
              <td style={{ textAlign: 'right' }}>
                <button
                  className="btn sm"
                  onClick={() => {
                    update((d) => {
                      d.currentMatchId = o.id;
                    });
                    toast(`${matchTitle(o)} is now the current match`);
                  }}
                >
                  Make current match
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TeamSelection({ m }) {
  const { data, updateMatch } = useStore();
  const roster = m.rosterSnapshot || data.players;
  const xi = matchXI(m, roster);
  const stats = playerStats(data);
  const swap = (inId, outId) => updateMatch(m.id, (mm) => changeXI(mm, roster, xi.map((x) => (x === outId ? inId : x))));
  const reserve = roster.filter((p) => !xi.includes(p.id));
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Playing XI</h2>
        <span className="muted small">
          {xi.length} of {XI_SIZE} picked · 12th player: {reserve.map((p) => p.name).join(', ') || '—'}
        </span>
      </div>
      <div className="panel-body xi-grid">
        {roster.map((p) => {
          const st = stats.get(p.id);
          const playing = xi.includes(p.id);
          return (
            <div key={p.id} className={`xi-row ${playing ? '' : 'reserve'}`}>
              <span className="xi-name">
                {p.name}
                {!playing && <span className="tag amber" style={{ marginLeft: 6 }}>12th</span>}
              </span>
              <span className="faint small">{st && st.played ? `${st.runs} runs @ ${fmt1(st.avg)} · ${st.wickets} wkts` : p.bowling || p.role || ''}</span>
              {playing ? (
                reserve.length > 0 && (
                  <button className="btn sm ghost" onClick={() => swap(reserve[0].id, p.id)} aria-label={`Make ${p.name} 12th player`}>
                    Make 12th
                  </button>
                )
              ) : (
                <span className="faint small">reserve</span>
              )}
            </div>
          );
        })}
        <p className="faint small" style={{ gridColumn: '1 / -1' }}>
          Making someone 12th brings the current 12th player into the XI; they take the same place in the batting and bowling orders. The 12th player is never put in a fielding position automatically.
        </p>
      </div>
    </section>
  );
}

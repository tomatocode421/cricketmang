import { useMemo, useState } from 'react';
import { useStore, logActivity } from '../store.jsx';
import { Field, Modal, Select, useNav, useToast } from './ui.jsx';
import { formatDate, matchTitle, newMatch, uid, MATCH_FORMATS } from '../data/model.js';

export default function NewMatchModal({ onClose }) {
  const { data, update, setWorkingMatchId } = useStore();
  const { go } = useNav();
  const toast = useToast();
  const sources = useMemo(() => [...data.matches].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt), [data.matches]);
  const current = data.matches.find((m) => m.id === data.currentMatchId);

  const [name, setName] = useState('');
  const [opposition, setOpposition] = useState('');
  const [date, setDate] = useState('');
  const [format, setFormat] = useState(sources[0]?.format || '');
  const [mode, setMode] = useState(sources.length ? 'copy' : 'blank');
  const [sourceId, setSourceId] = useState(sources[0]?.id || '');
  const source = data.matches.find((m) => m.id === sourceId);
  const [copyBatting, setCopyBatting] = useState(true);
  const [copyBowling, setCopyBowling] = useState(true);
  const [setupIds, setSetupIds] = useState(() => (sources[0]?.fielding.setups || []).map((s) => s.id));
  const [copyPrep, setCopyPrep] = useState(false);

  const changeSource = (id) => {
    setSourceId(id);
    const m = data.matches.find((x) => x.id === id);
    setSetupIds((m?.fielding.setups || []).map((s) => s.id));
  };

  const create = () => {
    let newId;
    update((draft) => {
      const m = newMatch(draft.players, { name: name.trim(), opposition: opposition.trim(), date, format });
      newId = m.id;
      const src = draft.matches.find((x) => x.id === sourceId);
      if (mode === 'copy' && src) {
        if (copyBatting) m.batting = structuredClone(src.batting);
        if (copyBowling) m.bowling = structuredClone(src.bowling);
        const setups = src.fielding.setups.filter((s) => setupIds.includes(s.id)).map((s) => ({ ...structuredClone(s), id: uid('fs'), updatedAt: Date.now() }));
        if (setups.length) m.fielding = { setups, activeSetupId: setups[0].id };
        if (copyPrep) {
          const smd = src.matchDay;
          Object.assign(m.matchDay, {
            groundName: smd.groundName,
            groundLocation: smd.groundLocation,
            field: smd.field,
            pitch: structuredClone(smd.pitch),
            groundNotes: smd.groundNotes,
            groundHistory: structuredClone(smd.groundHistory),
            scoring: structuredClone(smd.scoring || []),
            notes: smd.notes,
            research: smd.research ? structuredClone(smd.research) : null,
          });
          const custom = smd.checklist.filter((c) => c.custom).map((c) => ({ ...c, id: uid('ck'), done: false }));
          m.matchDay.checklist.push(...custom);
          m.competition = src.competition;
          if (!format) m.format = src.format;
          m.customOvers = src.customOvers;
          m.customMaxPerBowler = src.customMaxPerBowler;
        }
      }
      draft.matches.push(m);
      draft.currentMatchId = m.id;
      logActivity(draft, { key: 'match-' + m.id, type: 'match', text: `Created match ${matchTitle(m)}`, matchId: m.id, target: 'match' });
    });
    setWorkingMatchId(null);
    toast('New match created');
    onClose();
    go('match');
  };

  return (
    <Modal
      wide
      title="Start a new match"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={create} disabled={!name.trim() && !opposition.trim()}>
            Create match
          </button>
        </>
      }
    >
      <div className="stack">
        {current && (
          <p className="muted small">
            Your current match <strong>{matchTitle(current)}</strong> will stay saved in Match History with all of its information.
          </p>
        )}
        <div className="grid grid-2">
          <Field label="Match name">
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Round 5" />
          </Field>
          <Field label="Opposition">
            <input className="input" value={opposition} onChange={(e) => setOpposition(e.target.value)} placeholder="e.g. Eastwood CC" />
          </Field>
          <Field label="Match date">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Match format (optional)">
            <Select value={format} onChange={setFormat} placeholder="Not set" options={MATCH_FORMATS.map((f) => ({ value: f.id, label: f.label }))} />
          </Field>
        </div>

        <div className="field">
          <label>How would you like to start?</label>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            <button type="button" className={mode === 'blank' ? 'on' : ''} onClick={() => setMode('blank')}>
              Completely blank setup
            </button>
            <button type="button" className={mode === 'copy' ? 'on' : ''} onClick={() => setMode('copy')} disabled={!sources.length}>
              Copy from a previous match
            </button>
          </div>
          {!sources.length && <span className="hint">There are no previous matches to copy from yet.</span>}
        </div>

        {mode === 'copy' && source && (
          <div className="panel panel-pad stack" style={{ background: 'var(--panel-2)' }}>
            <Field label="Copy from">
              <Select
                value={sourceId}
                onChange={changeSource}
                options={sources.map((m) => ({ value: m.id, label: `${matchTitle(m)}${m.date ? ' — ' + formatDate(m.date, { short: true }) : ''}${m.status === 'Finished' ? ' (finished)' : ''}` }))}
              />
            </Field>
            <label className="row">
              <input type="checkbox" className="checkbox" checked={copyBatting} onChange={(e) => setCopyBatting(e.target.checked)} />
              Copy the batting order (including notes)
            </label>
            <label className="row">
              <input type="checkbox" className="checkbox" checked={copyBowling} onChange={(e) => setCopyBowling(e.target.checked)} />
              Copy the bowling order and planned overs
            </label>
            <div className="stack-sm">
              <span className="label">Copy fielding setups</span>
              <div className="row row-wrap">
                {source.fielding.setups.map((s) => (
                  <label key={s.id} className="row" style={{ gap: 6, marginRight: 12 }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={setupIds.includes(s.id)}
                      onChange={(e) => setSetupIds((ids) => (e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id)))}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
            <label className="row">
              <input type="checkbox" className="checkbox" checked={copyPrep} onChange={(e) => setCopyPrep(e.target.checked)} />
              Copy match preparation notes (ground, pitch observations, scoring notes, personal notes, custom checklist items)
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}

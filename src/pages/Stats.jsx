import { useMemo, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Field, PageHeader, Select, useDialog, useToast } from '../components/ui.jsx';
import { matchTitle, uid } from '../data/model.js';
import { CSV_TEMPLATE, allScorecards, fmt0, fmt1, parseScorecardCsv, playerStats } from '../lib/stats.js';

const TABS = ['Season stats', 'Scorecards', 'Import CSV'];

export default function Stats() {
  const { data } = useStore();
  const [tab, setTab] = useState('Season stats');
  return (
    <>
      <PageHeader title="Stats" subtitle="Squad statistics from imported scorecards and matches scored live" />
      <div className="content">
        <div className="md-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" className={`md-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        {tab === 'Season stats' && <SeasonStats data={data} />}
        {tab === 'Scorecards' && <Scorecards />}
        {tab === 'Import CSV' && <ImportCsv />}
      </div>
    </>
  );
}

function SeasonStats({ data }) {
  const stats = useMemo(() => playerStats(data), [data]);
  const cards = allScorecards(data);
  const rows = data.players.map((p) => ({ p, s: stats.get(p.id) }));
  return (
    <div className="stack">
      <p className="muted small">From {cards.length} scorecard{cards.length === 1 ? '' : 's'} (imported or scored live). Players are matched by name.</p>
      <div className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th>M</th>
              <th>Inns</th>
              <th>Runs</th>
              <th>HS</th>
              <th>Avg</th>
              <th className="hide-sm">SR</th>
              <th>Overs</th>
              <th>Wkts</th>
              <th className="hide-sm">Econ</th>
              <th className="hide-sm">Best</th>
              <th>Ct</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, s }) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 550 }}>{p.name}</td>
                <td>{s.played}</td>
                <td>{s.inns}</td>
                <td>{s.runs}</td>
                <td>{s.inns ? `${s.high}${s.highNO ? '*' : ''}` : '–'}</td>
                <td>{fmt1(s.avg)}</td>
                <td className="hide-sm">{fmt0(s.sr)}</td>
                <td>{s.bowlBalls ? s.bowlOvers : '–'}</td>
                <td>{s.wickets}</td>
                <td className="hide-sm">{fmt1(s.econ)}</td>
                <td className="hide-sm">{s.best ? `${s.best.w}/${s.best.r}` : '–'}</td>
                <td>{s.catches}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Scorecards() {
  const { data, update } = useStore();
  const { confirm } = useDialog();
  const cards = allScorecards(data);
  const [open, setOpen] = useState(null);
  const link = (id, matchId) => update((d) => (d.scorecards.find((c) => c.id === id).matchId = matchId || null));
  const remove = async (c) => {
    if (await confirm({ title: 'Delete this scorecard?', message: `"${c.title}" will be removed from your stats.`, confirmLabel: 'Delete', danger: true })) update((d) => (d.scorecards = d.scorecards.filter((x) => x.id !== c.id)));
  };
  if (!cards.length) return <p className="muted">No scorecards yet. Import one from a CSV file, or score a match in Live Match.</p>;
  return (
    <div className="stack">
      {cards.map((c) => (
        <div key={c.id} className="panel panel-pad stack-sm">
          <div className="row row-wrap">
            <strong style={{ flex: 1 }}>{c.title}</strong>
            <span className="tag grey">{c.source === 'live' ? 'Scored live' : 'CSV'}</span>
            <span className="faint small">{c.date}</span>
          </div>
          {c.result && <div className="muted small">{c.result}</div>}
          <div className="small">{(c.innings || []).map((i) => `${i.team}: ${i.runs}/${i.wickets}${i.overs ? ` (${i.overs})` : ''}`).join(' · ')}</div>
          <div className="row row-wrap">
            <button className="btn sm" onClick={() => setOpen(open === c.id ? null : c.id)}>
              {open === c.id ? 'Hide' : 'Show'} scorecard
            </button>
            {c.source !== 'live' && (
              <>
                <div style={{ width: 230 }}>
                  <Select value={c.matchId || ''} onChange={(v) => link(c.id, v)} placeholder="Not linked to a match" options={data.matches.map((m) => ({ value: m.id, label: matchTitle(m) }))} aria-label="Linked match" />
                </div>
                <button className="btn sm ghost" onClick={() => remove(c)}>
                  <Trash2 size={13} /> Delete
                </button>
              </>
            )}
          </div>
          {open === c.id && <CardDetail card={c} />}
        </div>
      ))}
    </div>
  );
}

export function CardDetail({ card }) {
  return (
    <div className="stack-sm">
      {(card.innings || []).map((i, n) => (
        <div key={n} className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{i.team} batting</th>
                <th>How out</th>
                <th>R</th>
                <th>B</th>
              </tr>
            </thead>
            <tbody>
              {(i.bat || []).map((b, k) => (
                <tr key={k}>
                  <td>{b.name}</td>
                  <td className="muted">{b.howOut}</td>
                  <td>{b.runs}</td>
                  <td>{b.balls || '–'}</td>
                </tr>
              ))}
            </tbody>
            <thead>
              <tr>
                <th>Bowling</th>
                <th>O</th>
                <th>R</th>
                <th>W</th>
              </tr>
            </thead>
            <tbody>
              {(i.bowl || []).map((b, k) => (
                <tr key={k}>
                  <td>{b.name}</td>
                  <td>{b.overs}</td>
                  <td>{b.runs}</td>
                  <td>{b.wickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function ImportCsv() {
  const { data, update } = useStore();
  const toast = useToast();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [matchId, setMatchId] = useState('');
  const [error, setError] = useState('');
  const doImport = () => {
    try {
      const parsed = parseScorecardCsv(text);
      update((d) => {
        d.scorecards.unshift({ id: uid('sc'), source: 'csv', matchId: matchId || null, date: data.matches.find((m) => m.id === matchId)?.date || '', title: title || 'Imported scorecard', innings: parsed.innings, importedAt: Date.now() });
      });
      setText('');
      setError('');
      toast(`Imported ${parsed.rows} rows`);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <p className="muted small">Paste a scorecard in this format, or choose a .csv file. Use our_batting / our_bowling for your team and opp_batting / opp_bowling for the opposition; for bowlers the runs column is runs conceded.</p>
      <pre className="pre panel panel-pad small" style={{ overflowX: 'auto' }}>{CSV_TEMPLATE}</pre>
      <div className="grid grid-2">
        <Field label="Title">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Round 4 vs Eastwood" />
        </Field>
        <Field label="Link to a match (optional)">
          <Select value={matchId} onChange={setMatchId} placeholder="Not linked" options={data.matches.map((m) => ({ value: m.id, label: matchTitle(m) }))} />
        </Field>
      </div>
      <textarea className="textarea" style={{ minHeight: 180, fontFamily: 'ui-monospace, Menlo, monospace' }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste CSV here" aria-label="CSV scorecard" />
      <div className="row row-wrap">
        <label className="btn">
          <Upload size={14} /> Choose file…
          <input type="file" accept=".csv,text/csv" hidden onChange={async (e) => e.target.files?.[0] && setText(await e.target.files[0].text())} />
        </label>
        <button className="btn primary" disabled={!text.trim()} onClick={doImport}>
          Import scorecard
        </button>
      </div>
      {error && <div className="callout danger small">{error}</div>}
    </div>
  );
}

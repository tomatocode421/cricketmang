import { useMemo, useState } from 'react';
import { Download, Link2, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Field, PageHeader, Select, useDialog, useToast } from '../components/ui.jsx';
import { matchTitle, uid } from '../data/model.js';
import { CSV_TEMPLATE, allScorecards, fmt0, fmt1, parseScorecardCsv, playerStats } from '../lib/stats.js';
import { fetchPlayers, fetchResults, fetchScorecard, getPcConfig, pcAvailable, setPcConfig, suggestLinks } from '../lib/playcricket.js';

const TABS = ['Season stats', 'Scorecards', 'Play-Cricket', 'Import CSV'];

export default function Stats() {
  const { data } = useStore();
  const [tab, setTab] = useState('Season stats');
  return (
    <>
      <PageHeader title="Stats & Play-Cricket" subtitle="Squad statistics from imported scorecards and matches scored live" />
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
        {tab === 'Play-Cricket' && <PlayCricket />}
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
      <p className="muted small">From {cards.length} scorecard{cards.length === 1 ? '' : 's'} (imported or scored live). Players are matched by their linked Play-Cricket profile or by name.</p>
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
  if (!cards.length) return <p className="muted">No scorecards yet. Import one from Play-Cricket or a CSV file, or score a match in Live Match.</p>;
  return (
    <div className="stack">
      {cards.map((c) => (
        <div key={c.id} className="panel panel-pad stack-sm">
          <div className="row row-wrap">
            <strong style={{ flex: 1 }}>{c.title}</strong>
            <span className="tag grey">{c.source === 'live' ? 'Scored live' : c.source === 'play-cricket' ? 'Play-Cricket' : 'CSV'}</span>
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

function PlayCricket() {
  const { data, update } = useStore();
  const toast = useToast();
  const [cfg, setCfg] = useState(getPcConfig());
  const [form, setForm] = useState({ siteId: '', token: '', teamId: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [pcPlayers, setPcPlayers] = useState([]);
  const [results, setResults] = useState([]);
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const run = async (label, fn) => {
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  if (!pcAvailable())
    return (
      <div className="callout info" style={{ maxWidth: 720 }}>
        <div>
          <strong>Connect Play-Cricket from the Mac app</strong>
          Play-Cricket is reached from the Mac app so your club&apos;s API key stays on that computer. Anything you import there — scorecards and player links — appears here automatically if sync is on. You can also import a scorecard here with Import CSV.
        </div>
      </div>
    );

  if (!cfg)
    return (
      <div className="panel panel-pad stack" style={{ maxWidth: 720 }}>
        <strong>Connect your club&apos;s Play-Cricket account</strong>
        <ol className="reason-list">
          <li>Play-Cricket gives API access to clubs: a club admin or committee member asks the Play-Cricket help desk and signs the ECB&apos;s data agreement. They then receive an API key.</li>
          <li>Your club&apos;s site ID is the number in your club&apos;s Play-Cricket admin pages (ask your admin if unsure).</li>
          <li>The key is stored only on this Mac and sent only to Play-Cricket.</li>
        </ol>
        <div className="grid grid-2">
          <Field label="Club site ID">
            <input className="input" value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value.trim() })} aria-label="Site ID" />
          </Field>
          <Field label="Team ID (optional)" hint="Which of your club's teams is yours">
            <input className="input" value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value.trim() })} aria-label="Team ID" />
          </Field>
        </div>
        <Field label="API key">
          <input className="input" type="password" autoComplete="off" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value.trim() })} aria-label="Play-Cricket API key" />
        </Field>
        {error && <div className="callout danger small">{error}</div>}
        <button
          className="btn primary"
          style={{ alignSelf: 'flex-start' }}
          disabled={!form.siteId || !form.token || !!busy}
          onClick={() =>
            run('connect', async () => {
              const list = await fetchPlayers(form);
              setPcConfig(form);
              setCfg(form);
              setPcPlayers(list);
              toast(`Connected — ${list.length} players found`);
            })
          }
        >
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      </div>
    );

  const links = suggestLinks(data.players, pcPlayers);
  const setLink = (pid, pc) =>
    update((d) => {
      const p = d.players.find((x) => x.id === pid);
      p.pcId = pc?.id || null;
      p.pcName = pc?.name || null;
    });
  const importCard = (r) =>
    run('import-' + r.id, async () => {
      const card = await fetchScorecard(cfg, r.id);
      update((d) => {
        const existing = d.scorecards.find((c) => c.id === card.id);
        if (existing) Object.assign(existing, { ...card, matchId: existing.matchId });
        else d.scorecards.unshift(card);
      });
      toast(card.ourTeamKnown ? 'Scorecard imported' : 'Imported — add your team ID so the app knows which side is yours');
    });

  return (
    <div className="stack">
      <div className="row row-wrap">
        <span className="tag green">Connected · site {cfg.siteId}</span>
        <button className="btn sm ghost" onClick={() => (setPcConfig(null), setCfg(null))}>
          Disconnect
        </button>
      </div>
      {error && <div className="callout danger small">{error}</div>}
      <section className="panel">
        <div className="panel-head">
          <h2>
            <Link2 size={15} /> Link squad players
          </h2>
          <button className="btn sm" disabled={!!busy} onClick={() => run('players', async () => setPcPlayers(await fetchPlayers(cfg)))}>
            <RefreshCw size={13} /> Load Play-Cricket players
          </button>
        </div>
        <div className="panel-body stack-sm">
          {data.players.map((p) => (
            <div key={p.id} className="row">
              <span style={{ width: 160 }}>{p.name}</span>
              <div style={{ flex: 1 }}>
                <Select
                  value={p.pcId || ''}
                  onChange={(v) => setLink(p.id, pcPlayers.find((x) => x.id === v) || (v ? { id: v, name: p.pcName } : null))}
                  placeholder={p.pcName ? p.pcName : pcPlayers.length ? 'Not linked' : 'Load players first'}
                  options={pcPlayers.map((x) => ({ value: x.id, label: x.name }))}
                  aria-label={`Play-Cricket profile for ${p.name}`}
                />
              </div>
              {links[p.id] && !p.pcId && (
                <button className="btn sm" onClick={() => setLink(p.id, links[p.id])}>
                  Link {links[p.id].name}?
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Results and scorecards</h2>
          <div className="row">
            <input className="input" style={{ width: 90 }} value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Season" />
            <button className="btn sm" disabled={!!busy} onClick={() => run('results', async () => setResults(await fetchResults(cfg, season)))}>
              <Download size={13} /> Load season
            </button>
          </div>
        </div>
        <div className="panel-body stack-sm">
          {!results.length && <p className="muted small">Load a season to see your club&apos;s results, then import the scorecards you want in your stats.</p>}
          {results.map((r) => (
            <div key={r.id} className="row row-wrap">
              <span className="faint small" style={{ width: 90 }}>
                {r.date}
              </span>
              <span style={{ flex: 1 }}>
                {r.home} v {r.away}
                <span className="faint small"> · {r.result}</span>
              </span>
              <button className="btn sm" disabled={!!busy} onClick={() => importCard(r)}>
                {data.scorecards.some((c) => c.pcMatchId === r.id) ? 'Refresh' : 'Import'}
              </button>
            </div>
          ))}
          <p className="faint small">Play-Cricket provides results after play, not a live feed; for live analysis use Live Match.</p>
        </div>
      </section>
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

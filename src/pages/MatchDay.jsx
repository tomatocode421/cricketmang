import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CloudSun,
  Droplets,
  ExternalLink,
  Gauge,
  Info,
  ListChecks,
  Loader2,
  MapPin,
  NotebookPen,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sprout,
  Target,
  Thermometer,
  Trash2,
  Umbrella,
  Wind,
  Swords,
} from 'lucide-react';
import { useStore, logActivity } from '../store.jsx';
import { Callout, Field, PageHeader, Segmented, Select, SourceTag, useNav, useToast } from '../components/ui.jsx';
import NoMatch from '../components/NoMatch.jsx';
import CricketField from '../components/CricketField.jsx';
import { BowlingRecommendation } from './Bowling.jsx';
import { MATCH_FORMATS, PITCH_BEHAVIOUR, PITCH_OPTIONS, formatDate, formatInfo, matchTitle, timeAgo, uid } from '../data/model.js';
import { SCORING_AREAS, SCORING_AREA_BY_ID } from '../data/positions.js';
import { compass, fetchMatchWeather, weatherWarning, FORECAST_DAYS } from '../lib/weather.js';
import { researchGround } from '../lib/research.js';
import { openExternal } from '../lib/net.js';
import { analyseMatch } from '../lib/tactics.js';

const TABS = [
  { id: 'info', label: 'Match Information', short: 'Info', icon: CalendarDays },
  { id: 'weather', label: 'Weather Forecast', short: 'Weather', icon: CloudSun },
  { id: 'ground', label: 'Ground & Pitch', short: 'Pitch', icon: Sprout },
  { id: 'conditions', label: 'Playing Conditions', short: 'Conditions', icon: Gauge },
  { id: 'strategy', label: 'Tactical Recommendations', short: 'Tactics', icon: Swords },
  { id: 'checklist', label: 'Checklist', short: 'Checklist', icon: ListChecks },
  { id: 'notes', label: 'Personal Notes', short: 'Notes', icon: NotebookPen },
];

export default function MatchDay() {
  const { data, match: m, updateMatch, flush } = useStore();
  const { params } = useNav();
  const [tab, setTab] = useState(params.tab || 'info');
  const analysis = useMemo(() => (m ? analyseMatch(m, data.players) : null), [m, data.players]);

  // Keep a saved copy of the generated recommendations with the match so they can be reviewed later.
  useEffect(() => {
    if (!m || m.status === 'Finished') return;
    const snapshot = {
      summary: analysis.summary,
      toss: analysis.toss.suggestion,
      balance: analysis.bowling.balance,
      missing: analysis.missing,
    };
    const prev = m.matchDay.recommendations;
    if (!prev || JSON.stringify({ ...prev, generatedAt: undefined }) !== JSON.stringify({ ...snapshot, generatedAt: undefined })) {
      updateMatch(m.id, (mm) => (mm.matchDay.recommendations = { ...snapshot, generatedAt: Date.now() }));
    }
  }, [analysis]); // eslint-disable-line

  if (!m)
    return (
      <>
        <PageHeader title="Match Day" subtitle="Game preparation and cricket conditions" />
        <div className="content">
          <NoMatch what="Match Day preparation" />
        </div>
      </>
    );

  const md = m.matchDay;
  const done = md.checklist.filter((c) => c.done).length;

  return (
    <>
      <PageHeader title="Match Day" subtitle={`${matchTitle(m)}${m.date ? ' · ' + formatDate(m.date) : ''}${md.groundName ? ' · ' + md.groundName : ''}`}>
        <span className="tag grey">
          <ListChecks size={12} /> Checklist {done}/{md.checklist.length}
        </span>
      </PageHeader>
      <div className="content">
        <div className="md-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`md-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              <t.icon size={15} /> <span className="tab-full">{t.label}</span>
              <span className="tab-short">{t.short}</span>
            </button>
          ))}
        </div>
        {tab === 'info' && <InfoTab m={m} updateMatch={updateMatch} flush={flush} setTab={setTab} />}
        {tab === 'weather' && <WeatherTab m={m} updateMatch={updateMatch} setTab={setTab} />}
        {tab === 'ground' && <GroundTab m={m} updateMatch={updateMatch} />}
        {tab === 'conditions' && <ConditionsTab m={m} a={analysis} updateMatch={updateMatch} setTab={setTab} />}
        {tab === 'strategy' && <StrategyTab m={m} a={analysis} setTab={setTab} />}
        {tab === 'checklist' && <ChecklistTab m={m} updateMatch={updateMatch} />}
        {tab === 'notes' && <NotesTab m={m} updateMatch={updateMatch} />}
      </div>
    </>
  );
}

/* ---------------- Match information ---------------- */
function InfoTab({ m, updateMatch, flush, setTab }) {
  const toast = useToast();
  const set = (k, v) => updateMatch(m.id, (mm) => (mm[k] = v));
  const setMd = (k, v) => updateMatch(m.id, (mm) => (mm.matchDay[k] = v));
  const fmt = formatInfo(m);
  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <section className="panel">
        <div className="panel-head">
          <h2>Upcoming game</h2>
          <SourceTag kind="manual" />
        </div>
        <div className="panel-body stack">
          <div className="grid grid-2">
            <Field label="Match date" hint="Used to retrieve the weather forecast">
              <input className="input" type="date" value={m.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
            <Field label="Opposition">
              <input className="input" value={m.opposition} onChange={(e) => set('opposition', e.target.value)} placeholder="Opposing team's name" />
            </Field>
            <Field label="Ground name">
              <input className="input" value={m.matchDay.groundName} onChange={(e) => setMd('groundName', e.target.value)} placeholder="e.g. Memorial Oval" />
            </Field>
            <Field label="Ground location" hint="Suburb, town or full address — used to find the forecast">
              <input className="input" value={m.matchDay.groundLocation} onChange={(e) => setMd('groundLocation', e.target.value)} placeholder="e.g. Parramatta NSW" />
            </Field>
            <Field label="Field or oval">
              <input className="input" value={m.matchDay.field} onChange={(e) => setMd('field', e.target.value)} placeholder="e.g. Oval 1, Main Ground, Pitch 3" />
            </Field>
            <Field label="Match format (optional)">
              <Select value={m.format} onChange={(v) => set('format', v)} placeholder="Not set" options={MATCH_FORMATS.map((f) => ({ value: f.id, label: f.label }))} />
            </Field>
            {m.format === 'other' && (
              <Field label="Overs per innings">
                <input className="input" type="number" min="1" value={m.customOvers} onChange={(e) => set('customOvers', e.target.value)} placeholder="e.g. 35" />
              </Field>
            )}
            <Field label="Match start time (optional)" hint={m.startTime ? '' : 'If left empty, a 10:00 start is assumed for the weather'}>
              <input className="input" type="time" value={m.startTime} onChange={(e) => set('startTime', e.target.value)} />
            </Field>
          </div>
          <Field label="Additional information">
            <textarea className="textarea" value={m.info} onChange={(e) => set('info', e.target.value)} placeholder="Anything else you want to record about the game" />
          </Field>
          <div className="row row-wrap">
            <button
              className="btn primary"
              onClick={async () => {
                await flush();
                toast('Match details saved');
              }}
            >
              <Save size={15} /> Save Match Details
            </button>
            <span className="faint small">Changes also save automatically and are shared with Current Match.</span>
            <span className="spacer" />
            <button className="btn" onClick={() => setTab('weather')} disabled={!m.date || !m.matchDay.groundLocation}>
              <CloudSun size={15} /> Check the weather
            </button>
          </div>
          {fmt.overs && <p className="faint small">{fmt.label}: estimated match duration about {fmt.hours} hours (used for the weather window).</p>}
        </div>
      </section>
    </div>
  );
}

/* ---------------- Weather ---------------- */
function WeatherTab({ m, updateMatch, setTab }) {
  const md = m.matchDay;
  const w = md.weather;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fmt = formatInfo(m);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchMatchWeather({ location: md.groundLocation || md.groundName, date: m.date, startTime: m.startTime, durationHours: fmt.hours });
      updateMatch(m.id, (mm, draft) => {
        mm.matchDay.weather = { ...res, query: { location: md.groundLocation || md.groundName, date: m.date, startTime: m.startTime } };
        if (res.status === 'ok') {
          const ck = mm.matchDay.checklist.find((c) => c.text === 'Check the weather forecast');
          if (ck) ck.done = true;
          logActivity(draft, { key: 'wx-' + m.id, type: 'matchday', text: `Retrieved weather for ${matchTitle(mm)}`, matchId: m.id, target: 'matchday' });
        }
      });
    } catch (err) {
      setError(err.message || 'Could not retrieve the weather.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch automatically when there is no forecast yet, when the match details changed,
  // or when an upcoming match's forecast is more than 3 hours old.
  useEffect(() => {
    if (!m.date || !(md.groundLocation || md.groundName)) return;
    const q = w?.query;
    const changed = q && (q.date !== m.date || q.location !== (md.groundLocation || md.groundName) || q.startTime !== m.startTime);
    const old = w && Date.now() - w.fetchedAt > 3 * 3600 * 1000 && m.date >= new Date().toISOString().slice(0, 10);
    if (!w || changed || old) refresh();
  }, []); // eslint-disable-line

  const stale = w?.query && (w.query.date !== m.date || w.query.location !== (md.groundLocation || md.groundName) || w.query.startTime !== m.startTime);
  const canFetch = m.date && (md.groundLocation || md.groundName);

  return (
    <div className="stack" style={{ maxWidth: 1080 }}>
      <div className="row">
        <div>
          <div style={{ fontWeight: 600 }}>
            <MapPin size={14} style={{ verticalAlign: -2 }} /> {md.groundLocation || md.groundName || 'No location entered'}
          </div>
          <div className="muted small">{m.date ? formatDate(m.date) : 'No match date'}{m.startTime ? ` · start ${m.startTime}` : ''}</div>
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={refresh} disabled={!canFetch || loading}>
          {loading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />} {w ? 'Refresh forecast' : 'Get forecast'}
        </button>
      </div>

      {!canFetch && (
        <Callout tone="missing" title="Missing information">
          Enter the match date and ground location to retrieve the weather.{' '}
          <a href="#" onClick={(e) => (e.preventDefault(), setTab('info'))}>
            Go to Match Information
          </a>
        </Callout>
      )}
      {error && (
        <Callout tone="danger" title="Couldn't retrieve the weather">
          {error} {w?.status === 'ok' ? 'The last saved forecast is shown below.' : 'You can still prepare manually and try again later.'}
        </Callout>
      )}
      {stale && <Callout tone="caution" title="Details have changed">The match date, time or location has changed since this forecast was retrieved. Refresh to update it.</Callout>}

      {w && w.status !== 'ok' && (
        <Callout tone="missing" title={w.status === 'too-far' ? 'Forecast not available yet' : 'Weather unavailable'}>
          {w.message}
          <div className="faint small" style={{ marginTop: 4 }}>
            Checked {timeAgo(w.fetchedAt)}
          </div>
        </Callout>
      )}

      {w?.status === 'ok' && <WeatherPanel w={w} />}
      <p className="faint small">
        Weather data from Open-Meteo. Forecasts are available up to {FORECAST_DAYS - 1} days ahead and become more reliable closer to the match. No weather is ever shown unless it was retrieved from the service.
      </p>
    </div>
  );
}

export function WeatherPanel({ w }) {
  const s = w.summary;
  const warn = weatherWarning(s);
  return (
    <div className="stack">
      {warn && <Callout tone={warn.tone} title={warn.title}>{warn.text}</Callout>}
      <section className="panel">
        <div className="panel-head">
          <h2>
            <CloudSun size={16} color="var(--blue)" /> Match Day Weather
          </h2>
          <div className="row">
            <span className={`tag ${w.kind === 'historical' ? 'violet' : 'blue'}`}>{w.kind === 'historical' ? 'Recorded weather (past date)' : 'Forecast'}</span>
            <SourceTag kind="weather" />
          </div>
        </div>
        <div className="panel-body stack">
          <div className="weather-main">
            <div className="weather-temp">{Math.round(s.tempMax)}°C</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 550 }}>{s.conditions}</div>
              <div className="muted small">
                {w.location.name}
                {w.location.admin1 ? `, ${w.location.admin1}` : ''}
                {w.location.country ? `, ${w.location.country}` : ''}
              </div>
              <div className="faint small">
                Match hours {w.window.start}–{w.window.end}
                {w.window.assumedStart ? ' (assumed start — enter a start time for accuracy)' : ''}
              </div>
            </div>
            <span className="spacer" />
            <div className="faint small" style={{ textAlign: 'right' }}>
              Last updated
              <br />
              {new Date(w.fetchedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
          <div className="wx-grid">
            <div className="wx-cell">
              <div className="k">
                <Thermometer size={13} /> Temperature
              </div>
              <div className="v">
                {Math.round(s.tempMin)}° – {Math.round(s.tempMax)}°C
              </div>
            </div>
            <div className="wx-cell">
              <div className="k">
                <Umbrella size={13} /> Chance of rain
              </div>
              <div className="v">{s.rainProb != null ? `${Math.round(s.rainProb)}%` : 'n/a'}</div>
            </div>
            <div className="wx-cell">
              <div className="k">
                <Droplets size={13} /> Expected rainfall
              </div>
              <div className="v">{s.rainTotal.toFixed(1)} mm</div>
            </div>
            <div className="wx-cell">
              <div className="k">
                <Wind size={13} /> Wind
              </div>
              <div className="v">
                {Math.round(s.wind)} km/h {compass(s.windDir)}
              </div>
            </div>
            <div className="wx-cell">
              <div className="k">
                <Wind size={13} /> Gusts
              </div>
              <div className="v">{s.gust != null ? `${Math.round(s.gust)} km/h` : 'n/a'}</div>
            </div>
            <div className="wx-cell">
              <div className="k">
                <Droplets size={13} /> Humidity
              </div>
              <div className="v">{s.humidity != null ? `${Math.round(s.humidity)}%` : 'n/a'}</div>
            </div>
            <div className="wx-cell">
              <div className="k">
                <CloudSun size={13} /> Cloud cover
              </div>
              <div className="v">{s.cloud != null ? `${Math.round(s.cloud)}%` : 'n/a'}</div>
            </div>
            <div className="wx-cell">
              <div className="k">
                <Info size={13} /> Dew later
              </div>
              <div className="v">{s.dewRisk ? 'Possible' : 'Unlikely'}</div>
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              Expected conditions during the match
            </div>
            <div className="hourly">
              {w.hourly.map((h) => (
                <div className="hour" key={h.time}>
                  <div className="t">{h.time}</div>
                  <div className="temp">{Math.round(h.temp)}°</div>
                  <div className="faint" style={{ fontSize: 11, minHeight: 28 }}>
                    {describeShort(h.code)}
                  </div>
                  <div style={{ color: (h.prob ?? 0) >= 50 || h.precip >= 0.3 ? '#8fc6f2' : 'var(--text-3)', fontSize: 11.5 }}>
                    {h.prob != null ? `${h.prob}%` : `${h.precip.toFixed(1)}mm`}
                  </div>
                  <div className="faint" style={{ fontSize: 11 }}>
                    {Math.round(h.wind)} {compass(h.dir)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const describeShort = (code) => {
  if (code >= 95) return 'Storms';
  if (code >= 80) return 'Showers';
  if (code >= 71) return 'Snow';
  if (code >= 61) return 'Rain';
  if (code >= 51) return 'Drizzle';
  if (code >= 45) return 'Fog';
  if (code === 3) return 'Overcast';
  if (code === 2) return 'Partly cloudy';
  if (code === 1) return 'Mostly clear';
  return 'Clear';
};

/* ---------------- Ground & pitch ---------------- */
function GroundTab({ m, updateMatch }) {
  const md = m.matchDay;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setPitch = (k, v) => updateMatch(m.id, (mm) => (mm.matchDay.pitch[k] = v));
  const setMd = (k, v) => updateMatch(m.id, (mm) => (mm.matchDay[k] = v));
  const setHist = (k, v) => updateMatch(m.id, (mm) => (mm.matchDay.groundHistory[k] = v));
  const research = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await researchGround(md.groundName, md.groundLocation);
      updateMatch(m.id, (mm) => (mm.matchDay.research = res));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const r = md.research;
  return (
    <div className="grid split" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', alignItems: 'start', gap: 20 }}>
      <div className="stack">
        <section className="panel">
          <div className="panel-head">
            <h2>Pitch and ground</h2>
            <SourceTag kind="manual" />
          </div>
          <div className="panel-body stack">
            <Field label="Pitch type">
              <Segmented value={md.pitch.type} onChange={(v) => setPitch('type', v)} options={PITCH_OPTIONS.type} />
            </Field>
            <Field label="Pitch condition">
              <Segmented value={md.pitch.condition} onChange={(v) => setPitch('condition', v)} options={PITCH_OPTIONS.condition} />
            </Field>
            <div className="grid grid-2">
              <Field label="Outfield speed">
                <Segmented value={md.pitch.outfield} onChange={(v) => setPitch('outfield', v)} options={PITCH_OPTIONS.outfield} />
              </Field>
              <Field label="Ground size">
                <Segmented value={md.pitch.groundSize} onChange={(v) => setPitch('groundSize', v)} options={PITCH_OPTIONS.groundSize} />
              </Field>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>
                Boundary dimensions (approximate, optional)
              </div>
              <div className="grid grid-4" style={{ gap: 10 }}>
                {[
                  ['boundaryStraight', 'Straight'],
                  ['boundarySquare', 'Square'],
                  ['boundaryBehind', 'Behind / fine'],
                  ['boundaryOther', 'Other / short side'],
                ].map(([k, l]) => (
                  <Field key={k} label={l}>
                    <input className="input" value={md.pitch[k]} onChange={(e) => setPitch(k, e.target.value)} placeholder="e.g. 65 m" />
                  </Field>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Pitch behaviour</h2>
            <SourceTag kind="manual" />
          </div>
          <div className="panel-body stack-sm">
            {PITCH_BEHAVIOUR.map((b) => (
              <div key={b.id} className="row behaviour-row" style={{ justifyContent: 'space-between' }}>
                <span>{b.label}</span>
                <Segmented value={md.pitch[b.id]} onChange={(v) => setPitch(b.id, v)} options={PITCH_OPTIONS.behaviour} />
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Pitch and ground notes</h2>
          </div>
          <div className="panel-body">
            <textarea className="textarea" style={{ minHeight: 140 }} value={md.groundNotes} onChange={(e) => setMd('groundNotes', e.target.value)} placeholder="Anything unusual about the pitch or ground — slopes, short boundaries, bare patches, sightscreens…" />
          </div>
        </section>
      </div>

      <div className="stack">
        <section className="panel">
          <div className="panel-head">
            <h2>Ground research</h2>
            <SourceTag kind="research" />
          </div>
          <div className="panel-body stack-sm">
            <p className="muted small">Looks up published information about the ground. This is historical, general information — not the conditions expected on match day.</p>
            <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={research} disabled={!md.groundName || loading}>
              {loading ? <Loader2 size={15} className="spin" /> : <Search size={15} />} {r ? 'Search again' : 'Search for ground information'}
            </button>
            {!md.groundName && <span className="hint">Enter the ground name in Match Information first.</span>}
            {error && <Callout tone="danger">{error}</Callout>}
            {r?.status === 'ok' && (
              <div className="panel panel-pad" style={{ background: 'var(--panel-2)' }}>
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                {r.description && <div className="faint small">{r.description}</div>}
                <p className="muted small" style={{ marginTop: 8 }}>
                  {r.extract}
                </p>
                <a href={r.url} className="small row" style={{ marginTop: 8, gap: 4 }} onClick={(e) => (e.preventDefault(), openExternal(r.url))}>
                  Source: {r.source} <ExternalLink size={12} />
                </a>
                <div className="faint small" style={{ marginTop: 4 }}>
                  Retrieved {timeAgo(r.fetchedAt)}
                </div>
              </div>
            )}
            {r && r.status !== 'ok' && <Callout tone="missing">{r.message}</Callout>}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Ground history</h2>
            <span className="tag grey">Entered by you</span>
          </div>
          <div className="panel-body stack">
            <p className="muted small">Record historical information you trust (for example from your club&apos;s records or the competition website). Leave the source empty for your own knowledge.</p>
            <Field label="Average first-innings score">
              <input className="input" value={md.groundHistory.avgFirstInnings} onChange={(e) => setHist('avgFirstInnings', e.target.value)} placeholder="e.g. 165" />
            </Field>
            <Field label="Batting first or chasing trend">
              <Select
                value={md.groundHistory.chasingTrend}
                onChange={(v) => setHist('chasingTrend', v)}
                placeholder="Unknown"
                options={['Batting-first teams usually win', 'Chasing teams usually win', 'No clear trend']}
              />
            </Field>
            <Field label="Source (optional)">
              <input className="input" value={md.groundHistory.source} onChange={(e) => setHist('source', e.target.value)} placeholder="e.g. Club scorebook 2023–24" />
            </Field>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------------- Playing conditions & scoring ---------------- */
function ConditionsTab({ m, a, updateMatch, setTab }) {
  const md = m.matchDay;
  const { go } = useNav();
  const [area, setArea] = useState('midwicket');
  const [weight, setWeight] = useState('2');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('mine');
  const [source, setSource] = useState('');
  const heat = {};
  (md.scoring || []).forEach((o) => (heat[o.area] = (heat[o.area] || 0) + (Number(o.weight) || 1)));
  const sourcedCount = (md.scoring || []).filter((o) => o.kind === 'sourced').length;

  const add = () => {
    updateMatch(m.id, (mm) => {
      mm.matchDay.scoring = [...(mm.matchDay.scoring || []), { id: uid('sc'), area, weight: Number(weight), note: note.trim(), kind, source: kind === 'sourced' ? source.trim() : '' }];
    });
    setNote('');
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      {a.missing.length > 0 && (
        <Callout tone="missing" title="Some information is missing">
          {a.missing.join(' · ')}. Recommendations are based only on what has been entered.{' '}
          <a href="#" onClick={(e) => (e.preventDefault(), setTab(md.weather ? 'ground' : 'weather'))}>
            Add it now
          </a>
        </Callout>
      )}
      <section>
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Weather and pitch analysis
          </h2>
          <SourceTag kind="generated" />
        </div>
        {a.conditions.length === 0 ? (
          <Callout tone="missing">Retrieve the weather and describe the pitch to see what the conditions might mean for your team.</Callout>
        ) : (
          <div className="grid grid-2">
            {a.conditions.map((c) => (
              <div key={c.id} className={`callout ${c.tone}`} style={{ display: 'block' }}>
                <strong>{c.title}</strong>
                <ul className="reason-list" style={{ color: 'inherit', opacity: 0.9 }}>
                  {c.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="faint small" style={{ marginTop: 8 }}>
          These are tactical considerations, not guaranteed predictions. Weather alone never determines how a pitch will play.
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Outfield speed and run-scoring</h2>
          <span className={`tag ${a.outfield.speed === 'Unknown' ? 'amber' : 'green'}`}>Outfield: {a.outfield.speed}</span>
        </div>
        <div className="panel-body grid grid-2">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              What it means for batting
            </div>
            <ul className="reason-list">
              {a.outfield.batting.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              What it means for fielding
            </div>
            <ul className="reason-list">
              {a.outfield.fielding.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          {a.outfield.notes.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              {a.outfield.notes.map((n) => (
                <p key={n} className="muted small">
                  • {n}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>
            <Target size={16} /> Where runs are scored
          </h2>
          <button className="btn sm" onClick={() => go('fielding')}>
            Plan fielding
          </button>
        </div>
        <div className="panel-body grid split" style={{ gridTemplateColumns: 'minmax(0, 380px) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
          <div>
            <div style={{ background: '#111413', borderRadius: 8, border: '1px solid var(--border)', padding: 8 }}>
              <CricketField positions={{}} showInactive={false} heat={heat} compact />
            </div>
            <div className="legend" style={{ marginTop: 8 }}>
              <span>
                <i style={{ background: 'rgba(240,160,60,0.35)' }} />
                Some scoring
              </span>
              <span>
                <i style={{ background: 'rgba(250,70,60,0.7)' }} />
                Frequent scoring
              </span>
            </div>
          </div>
          <div className="stack">
            {sourcedCount === 0 && (
              <Callout tone="missing" title="No sourced ground statistics">
                No reliable ground-specific scoring statistics are available for this ground, so no scoring percentages are shown. The heatmap only shows the observations you add below.
              </Callout>
            )}
            <div className="panel panel-pad stack-sm" style={{ background: 'var(--panel-2)' }}>
              <div className="label">Add a scoring observation</div>
              <div className="grid grid-2" style={{ gap: 10 }}>
                <Select value={area} onChange={setArea} options={SCORING_AREAS.map((s) => ({ value: s.id, label: s.name }))} aria-label="Scoring area" />
                <Select value={weight} onChange={setWeight} options={[{ value: '1', label: 'Occasionally' }, { value: '2', label: 'Often' }, { value: '3', label: 'Very often' }]} aria-label="How often" />
              </div>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Their opener hits through mid-wicket" />
              <div className="row row-wrap">
                <div className="seg">
                  <button type="button" className={kind === 'mine' ? 'on' : ''} onClick={() => setKind('mine')}>
                    My observation
                  </button>
                  <button type="button" className={kind === 'sourced' ? 'on' : ''} onClick={() => setKind('sourced')}>
                    Sourced statistic
                  </button>
                </div>
                {kind === 'sourced' && <input className="input" style={{ flex: 1, minWidth: 160 }} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source (required)" />}
                <span className="spacer" />
                <button className="btn primary sm" onClick={add} disabled={kind === 'sourced' && !source.trim()}>
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
            {(md.scoring || []).length > 0 && (
              <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>How often</th>
                    <th>Note</th>
                    <th>Type</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {md.scoring.map((o) => (
                    <tr key={o.id}>
                      <td>{SCORING_AREA_BY_ID[o.area]?.name}</td>
                      <td className="muted">{['', 'Occasionally', 'Often', 'Very often'][o.weight] || o.weight}</td>
                      <td className="muted">{o.note}</td>
                      <td>{o.kind === 'sourced' ? <span className="tag violet" title={o.source}>Sourced: {o.source}</span> : <span className="tag grey">My observation</span>}</td>
                      <td>
                        <button className="btn ghost icon" title="Remove" onClick={() => updateMatch(m.id, (mm) => (mm.matchDay.scoring = mm.matchDay.scoring.filter((x) => x.id !== o.id)))}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            {a.areaSuggestions.length > 0 && (
              <div className="stack-sm">
                <div className="row">
                  <div className="label">Fielding suggestions</div>
                  <SourceTag kind="generated" />
                </div>
                {a.areaSuggestions.map((s) => (
                  <p key={s.area} className="muted small">
                    • Consider extra protection at <strong style={{ color: 'var(--text)' }}>{s.areaName}</strong>: {s.positions.join(', ')}.
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Strategy ---------------- */
function StrategyTab({ m, a, setTab }) {
  const { go } = useNav();
  return (
    <div className="stack" style={{ gap: 20 }}>
      {a.missing.length > 0 && (
        <Callout tone="missing" title="Recommendations are limited">
          Missing: {a.missing.join(' · ')}.
        </Callout>
      )}
      <section className="panel">
        <div className="panel-head">
          <h2>Match Day Game Plan</h2>
          <SourceTag kind="generated" />
        </div>
        <div className="panel-body grid grid-2" style={{ gap: 12 }}>
          {a.summary.map((s) => (
            <div key={s.id} className="plan-item">
              <h4>{s.title}</h4>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="grid grid-2" style={{ alignItems: 'start', gap: 20 }}>
        <section className="panel">
          <div className="panel-head">
            <h2>Bowling Strategy Recommendation</h2>
            <SourceTag kind="generated" />
          </div>
          <div className="panel-body stack-sm">
            <BowlingRecommendation a={a} />
            <p className="faint small">This never changes your bowling order or team automatically.</p>
            <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => go('bowling')}>
              Open Bowling Order
            </button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Toss Strategy Recommendation</h2>
            <SourceTag kind="generated" />
          </div>
          <div className="panel-body stack-sm">
            <div className="faint small">Suggested approach</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: a.toss.suggestion === 'No strong preference' ? 'var(--text)' : 'var(--green-soft)' }}>{a.toss.suggestion}</div>
            <p className="muted">{a.toss.text}</p>
            {a.toss.reasons.length > 0 && (
              <>
                <div className="label" style={{ marginTop: 8 }}>
                  Why
                </div>
                <ul className="reason-list">
                  {a.toss.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="label" style={{ marginTop: 8 }}>
              Uncertainties
            </div>
            <ul className="reason-list">
              {a.toss.uncertainties.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="faint small" style={{ marginTop: 6 }}>
              This is never a guaranteed winning strategy.
            </p>
          </div>
        </section>
      </div>
      <div className="grid grid-3" style={{ alignItems: 'start' }}>
        <section className="panel panel-pad stack-sm">
          <h3 style={{ fontSize: 14.5 }}>Fielding considerations</h3>
          <ul className="reason-list">
            {a.fielding.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => go('fielding')}>
            Open Fielding Positions
          </button>
        </section>
        <section className="panel panel-pad stack-sm">
          <h3 style={{ fontSize: 14.5 }}>Potential risks</h3>
          {a.risks.length ? (
            <ul className="reason-list">
              {a.risks.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No significant risks identified from the information available.</p>
          )}
        </section>
        <section className="panel panel-pad stack-sm">
          <h3 style={{ fontSize: 14.5 }}>Suggested preparation</h3>
          <ul className="reason-list">
            {a.prep.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setTab('checklist')}>
            Open checklist
          </button>
        </section>
      </div>
    </div>
  );
}

/* ---------------- Checklist ---------------- */
function ChecklistTab({ m, updateMatch }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const list = m.matchDay.checklist;
  const done = list.filter((c) => c.done).length;
  const add = () => {
    if (!text.trim()) return;
    updateMatch(m.id, (mm) => mm.matchDay.checklist.push({ id: uid('ck'), text: text.trim(), done: false, custom: true }));
    setText('');
  };
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="row">
        <div style={{ flex: 1 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <strong>Match Day Checklist</strong>
            <span className="muted small">
              {done} of {list.length} complete
            </span>
          </div>
          <div className="progress">
            <div style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      <div className="stack-sm">
        {list.map((c, i) => (
          <label key={c.id} className={`check-item ${c.done ? 'done' : ''}`}>
            <input type="checkbox" className="checkbox" checked={c.done} onChange={(e) => updateMatch(m.id, (mm) => (mm.matchDay.checklist[i].done = e.target.checked))} />
            <span style={{ flex: 1 }}>{c.text}</span>
            {c.custom && <span className="tag grey">Your item</span>}
            <button
              className="btn ghost icon"
              title="Remove item"
              onClick={(e) => {
                e.preventDefault();
                updateMatch(m.id, (mm) => (mm.matchDay.checklist = mm.matchDay.checklist.filter((x) => x.id !== c.id)));
                toast('Checklist item removed', { action: { label: 'Undo', run: () => updateMatch(m.id, (mm) => mm.matchDay.checklist.splice(i, 0, c)) } });
              }}
            >
              <Trash2 size={14} />
            </button>
          </label>
        ))}
      </div>
      <div className="row">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Add your own checklist item…" />
        <button className="btn primary" onClick={add} disabled={!text.trim()}>
          <Plus size={15} /> Add item
        </button>
      </div>
    </div>
  );
}

/* ---------------- Personal notes ---------------- */
function NotesTab({ m, updateMatch }) {
  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <div className="row">
        <div>
          <h2 style={{ fontSize: 17 }}>Personal Match Day Notes</h2>
          <p className="muted small">Your own observations and plans for this match. Saved automatically.</p>
        </div>
        <span className="spacer" />
        {m.matchDay.notesUpdatedAt && <span className="faint small">Last edited {timeAgo(m.matchDay.notesUpdatedAt)}</span>}
      </div>
      <textarea
        className="textarea editor"
        value={m.matchDay.notes}
        onChange={(e) =>
          updateMatch(m.id, (mm, draft) => {
            mm.matchDay.notes = e.target.value;
            mm.matchDay.notesUpdatedAt = Date.now();
            logActivity(draft, { key: 'mdnotes-' + m.id, type: 'notes', text: `Edited Match Day notes for ${matchTitle(mm)}`, matchId: m.id, target: 'matchday' });
          })
        }
        placeholder={'e.g.\n• Their opening batter struggles against spin.\n• Their number four likes hitting over mid-wicket.\n• Our quicker bowlers should attack early.\n• Keep a deep fielder on the leg side.'}
      />
    </div>
  );
}

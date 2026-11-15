import { Plus, Save, Trash2, Info, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useStore, logActivity } from '../store.jsx';
import { PageHeader, Select, SourceTag, useNav, useToast } from '../components/ui.jsx';
import NoMatch from '../components/NoMatch.jsx';
import Lineup from '../components/Lineup.jsx';
import { assignInLineup, formatInfo, matchTitle, moveItem, ordinal, playerName } from '../data/model.js';
import { analyseMatch } from '../lib/tactics.js';

const COLS = '30px 50px 120px minmax(170px, 1fr) 96px minmax(180px, 1.5fr) 34px';

export function BowlingRecommendation({ a, compact }) {
  const meter = (score) => (
    <div className="meter" style={{ marginTop: 6 }}>
      <div style={{ width: `${score}%`, background: score >= 65 ? 'var(--green-strong)' : score >= 45 ? 'var(--amber)' : 'var(--red)' }} />
    </div>
  );
  const b = a.bowling;
  return (
    <div className="stack-sm">
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="panel panel-pad" style={{ background: 'var(--panel-2)', padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Pace bowling</strong>
            <span className="small muted">{b.enough ? b.pace.level : 'Unknown'}</span>
          </div>
          {meter(b.enough ? b.pace.score : 0)}
          <p className="muted small" style={{ marginTop: 8 }}>
            {b.enough ? b.paceText : 'Not enough information yet.'}
          </p>
          {!compact && b.enough && (
            <ul className="reason-list">
              {b.pace.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel panel-pad" style={{ background: 'var(--panel-2)', padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Spin bowling</strong>
            <span className="small muted">{b.enough ? b.spin.level : 'Unknown'}</span>
          </div>
          {meter(b.enough ? b.spin.score : 0)}
          <p className="muted small" style={{ marginTop: 8 }}>
            {b.enough ? b.spinText : 'Not enough information yet.'}
          </p>
          {!compact && b.enough && (
            <ul className="reason-list">
              {b.spin.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="plan-item">
        <h4>Recommended bowling balance</h4>
        <p>{b.balance}</p>
      </div>
    </div>
  );
}

export default function Bowling() {
  const { data, match: m, updateMatch, flush } = useStore();
  const { go } = useNav();
  const toast = useToast();
  if (!m)
    return (
      <>
        <PageHeader title="Bowling Order" />
        <div className="content">
          <NoMatch what="the bowling order" />
        </div>
      </>
    );

  const fmt = formatInfo(m);
  const a = analyseMatch(m);
  const setLineup = (fn) =>
    updateMatch(m.id, (mm, draft) => {
      mm.bowling = fn(mm.bowling);
      logActivity(draft, { key: 'bowl-' + m.id, type: 'bowling', text: `Updated bowling plan for ${matchTitle(mm)}`, matchId: m.id, target: 'bowling' });
    });
  const setRow = (i, patch) => setLineup((b) => b.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const assign = (i, playerId) => {
    const other = m.bowling.findIndex((r, j) => j !== i && r.playerId === playerId);
    setLineup((b) => assignInLineup(b, i, playerId || null));
    if (playerId && other >= 0) toast(`${playerName(data.players, m, playerId)} moved to bowl ${ordinal(i + 1)}`);
  };

  const total = m.bowling.reduce((x, r) => x + (r.playerId ? Number(r.overs) || 0 : 0), 0);
  const overLimit = fmt.maxPerBowler ? m.bowling.filter((r) => r.playerId && Number(r.overs) > fmt.maxPerBowler) : [];
  const invalid = m.bowling.filter((r) => r.overs !== '' && (Number(r.overs) < 0 || Number.isNaN(Number(r.overs))));
  const bowlers = m.bowling.filter((r) => r.playerId).length;

  return (
    <>
      <PageHeader title="Bowling Order" subtitle={`${matchTitle(m)} · ${fmt.id ? fmt.label : 'format not set'}`}>
        <button className="btn" onClick={() => setLineup((b) => [...b, { playerId: null, overs: '', notes: '' }])} disabled={m.bowling.length >= 11}>
          <Plus size={15} /> Add bowler
        </button>
        <button
          className="btn primary"
          onClick={async () => {
            setLineup((b) => b);
            await flush();
            toast('Bowling order saved with this match');
          }}
        >
          <Save size={15} /> Save Bowling Order
        </button>
      </PageHeader>
      <div className="content">
        <div className="grid split" style={{ gridTemplateColumns: 'minmax(0, 1fr) 360px', alignItems: 'start', gap: 20 }}>
          <div className="stack">
            <div className="grid grid-3" style={{ gap: 12 }}>
              <div className="panel panel-pad" style={{ padding: 14 }}>
                <div className="faint small">Total planned overs</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>
                  {total}
                  <span className="muted" style={{ fontSize: 15, fontWeight: 400 }}>
                    {fmt.overs ? ` / ${fmt.overs}` : ''}
                  </span>
                </div>
                {fmt.overs && (
                  <div className="progress" style={{ marginTop: 6 }}>
                    <div style={{ width: `${Math.min(100, (total / fmt.overs) * 100)}%`, background: total > fmt.overs ? 'var(--red)' : undefined }} />
                  </div>
                )}
              </div>
              <div className="panel panel-pad" style={{ padding: 14 }}>
                <div className="faint small">Bowlers</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{bowlers}</div>
                <div className="muted small">{fmt.overs && fmt.maxPerBowler ? `At least ${Math.ceil(fmt.overs / fmt.maxPerBowler)} needed` : ''}</div>
              </div>
              <div className="panel panel-pad" style={{ padding: 14 }}>
                <div className="faint small">Max per bowler</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{fmt.maxPerBowler || '—'}</div>
                <div className="muted small">{fmt.id ? fmt.label : 'Set the format in Current Match'}</div>
              </div>
            </div>

            {fmt.overs && total > fmt.overs && (
              <div className="callout warning">
                <AlertTriangle size={17} />
                <div>
                  <strong>Too many overs planned</strong>
                  You have planned {total} overs but a {fmt.label} innings only has {fmt.overs}. Reduce some bowlers&apos; overs by {total - fmt.overs}.
                </div>
              </div>
            )}
            {fmt.overs && total < fmt.overs && bowlers > 0 && (
              <div className="callout caution">
                <Info size={17} />
                <div>
                  {fmt.overs - total} of {fmt.overs} overs are not yet allocated.
                  {fmt.maxPerBowler && bowlers * fmt.maxPerBowler < fmt.overs ? ` With ${bowlers} bowlers and a limit of ${fmt.maxPerBowler} overs each you can only cover ${bowlers * fmt.maxPerBowler} overs — add another bowler.` : ''}
                </div>
              </div>
            )}
            {fmt.overs && total === fmt.overs && overLimit.length === 0 && (
              <div className="callout good">
                <CheckCircle2 size={17} />
                <div>All {fmt.overs} overs are planned.</div>
              </div>
            )}
            {overLimit.length > 0 && (
              <div className="callout warning">
                <AlertTriangle size={17} />
                <div>
                  <strong>Bowling restriction</strong>
                  In {fmt.label} each bowler may bowl at most {fmt.maxPerBowler} overs. Over the limit: {overLimit.map((r) => `${playerName(data.players, m, r.playerId)} (${r.overs})`).join(', ')}.
                </div>
              </div>
            )}
            {!fmt.overs && (
              <div className="callout missing">
                <Info size={17} />
                <div>
                  Set the match format in Current Match to check your plan against the available overs and bowling restrictions.{' '}
                  <a href="#match" onClick={(e) => (e.preventDefault(), go('match'))}>
                    Open Current Match
                  </a>
                </div>
              </div>
            )}
            {invalid.length > 0 && <div className="callout danger"><AlertTriangle size={17} /><div>Planned overs must be zero or more.</div></div>}

            <Lineup
              rows={m.bowling}
              columns={COLS}
              header={['#', 'Order', 'Bowler', 'Overs', 'Notes', '']}
              onMove={(from, to) => setLineup((b) => moveItem(b, from, to))}
              renderRow={(row, i) => {
                const over = fmt.maxPerBowler && Number(row.overs) > fmt.maxPerBowler;
                return (
                  <>
                    <span className="order-num c-order">{ordinal(i + 1)}</span>
                    <div className="c-move">
                    <Select
                      aria-label={`Move ${ordinal(i + 1)} bowler`}
                      value={String(i)}
                      onChange={(v) => setLineup((b) => moveItem(b, i, Number(v)))}
                      options={m.bowling.map((_, j) => ({ value: String(j), label: j === i ? `Bowls ${ordinal(j + 1)}` : `Move to ${ordinal(j + 1)}` }))}
                    />
                    </div>
                    <div className="c-player">
                    <Select
                      aria-label={`${ordinal(i + 1)} bowler`}
                      value={row.playerId || ''}
                      onChange={(v) => assign(i, v)}
                      placeholder="— Select bowler —"
                      options={data.players.map((p) => {
                        const at = m.bowling.findIndex((r) => r.playerId === p.id);
                        return { value: p.id, label: `${p.name || 'Unnamed player'}${at >= 0 && at !== i ? `  (bowls ${ordinal(at + 1)})` : ''}` };
                      })}
                    />
                    </div>
                    <input
                      className="input overs-input c-overs"
                      inputMode="numeric"
                      type="number"
                      min="0"
                      max={fmt.maxPerBowler || 50}
                      step="1"
                      value={row.overs}
                      placeholder="0"
                      style={over ? { borderColor: 'var(--red)' } : undefined}
                      onChange={(e) => setRow(i, { overs: e.target.value === '' ? '' : String(Math.max(0, Number(e.target.value))) })}
                      aria-label={`${ordinal(i + 1)} bowler planned overs`}
                    />
                    <input className="input c-notes" value={row.notes} placeholder="e.g. Attack the stumps" onChange={(e) => setRow(i, { notes: e.target.value })} aria-label={`${ordinal(i + 1)} bowler notes`} />
                    <button
                      className="btn ghost icon c-remove"
                      aria-label={`Remove ${ordinal(i + 1)} bowler row`}
                      title="Remove this row"
                      onClick={() => {
                        const removed = m.bowling[i];
                        setLineup((b) => b.filter((_, j) => j !== i));
                        toast('Bowler row removed', { action: { label: 'Undo', run: () => setLineup((b) => [...b.slice(0, i), removed, ...b.slice(i)]) } });
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                );
              }}
            />
          </div>
          <aside className="panel">
            <div className="panel-head">
              <h3>Bowling Strategy</h3>
              <SourceTag kind="generated" />
            </div>
            <div className="panel-body stack-sm">
              <BowlingRecommendation a={a} compact />
              <p className="faint small">Advice only — your bowling order is never changed automatically.</p>
              <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => go('matchday', { tab: 'strategy' })}>
                See the reasoning <ArrowRight size={13} />
              </button>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

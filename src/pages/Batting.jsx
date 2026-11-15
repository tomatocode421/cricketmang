import { RotateCcw, Save, Info } from 'lucide-react';
import { useStore, logActivity } from '../store.jsx';
import { PageHeader, Select, useDialog, useToast } from '../components/ui.jsx';
import NoMatch from '../components/NoMatch.jsx';
import Lineup from '../components/Lineup.jsx';
import { assignInLineup, matchTitle, moveItem, ordinal, playerName } from '../data/model.js';

const COLS = '30px 50px 120px minmax(180px, 1fr) minmax(200px, 1.6fr)';

export default function Batting() {
  const { data, match: m, updateMatch, flush } = useStore();
  const { confirm } = useDialog();
  const toast = useToast();
  if (!m)
    return (
      <>
        <PageHeader title="Batting Order" />
        <div className="content">
          <NoMatch what="the batting order" />
        </div>
      </>
    );

  const setLineup = (fn) =>
    updateMatch(m.id, (mm, draft) => {
      mm.batting = fn(mm.batting);
      logActivity(draft, { key: 'bat-' + m.id, type: 'batting', text: `Updated batting order for ${matchTitle(mm)}`, matchId: m.id, target: 'batting' });
    });

  const assign = (i, playerId) => {
    const other = m.batting.findIndex((r, j) => j !== i && r.playerId === playerId);
    setLineup((b) => assignInLineup(b, i, playerId || null));
    if (playerId && other >= 0) {
      const who = playerName(data.players, m, playerId);
      const moved = playerName(data.players, m, m.batting[i].playerId);
      toast(moved ? `${who} moved to ${ordinal(i + 1)}; ${moved} moved to ${ordinal(other + 1)}` : `${who} moved from ${ordinal(other + 1)} to ${ordinal(i + 1)}`);
    }
  };

  const reset = async () => {
    const ok = await confirm({ title: 'Reset batting order?', message: 'Set the order back to the roster order (Player 1 bats 1st, and so on) and clear all batting notes.', confirmLabel: 'Reset', danger: true });
    if (ok) setLineup(() => data.players.map((p) => ({ playerId: p.id, notes: '' })));
  };

  const filled = m.batting.filter((r) => r.playerId).length;
  const unassigned = data.players.filter((p) => !m.batting.some((r) => r.playerId === p.id));

  return (
    <>
      <PageHeader title="Batting Order" subtitle={`${matchTitle(m)} · reorder batters and add notes`}>
        <button className="btn" onClick={reset}>
          <RotateCcw size={15} /> Reset to roster order
        </button>
        <button
          className="btn primary"
          onClick={async () => {
            setLineup((b) => b);
            await flush();
            toast('Batting order saved with this match');
          }}
        >
          <Save size={15} /> Save Batting Order
        </button>
      </PageHeader>
      <div className="content">
        <div className="stack">
          <div className="row">
            <span className={`tag ${filled === 11 ? 'green' : 'amber'}`}>{filled} of 11 positions filled</span>
            {unassigned.length > 0 && <span className="muted small">Not in the order: {unassigned.map((p) => p.name || 'Unnamed').join(', ')}</span>}
          </div>
          <Lineup
            rows={m.batting}
            columns={COLS}
            header={['#', 'Position', 'Player', 'Notes']}
            onMove={(from, to) => setLineup((b) => moveItem(b, from, to))}
            renderRow={(row, i) => (
              <>
                <span className="order-num c-order">{ordinal(i + 1)}</span>
                <div className="c-move">
                <Select
                  aria-label={`Move ${ordinal(i + 1)} batter to position`}
                  value={String(i)}
                  onChange={(v) => setLineup((b) => moveItem(b, i, Number(v)))}
                  options={m.batting.map((_, j) => ({ value: String(j), label: j === i ? `Bats ${ordinal(j + 1)}` : `Move to ${ordinal(j + 1)}` }))}
                />
                </div>
                <div className="c-player">
                <Select
                  aria-label={`${ordinal(i + 1)} batter`}
                  value={row.playerId || ''}
                  onChange={(v) => assign(i, v)}
                  placeholder="— Select player —"
                  options={data.players.map((p) => {
                    const at = m.batting.findIndex((r) => r.playerId === p.id);
                    const tag = [p.role === 'Wicketkeeper' && 'WK', p.bats === 'Left' && 'LHB'].filter(Boolean).join(', ');
                    return { value: p.id, label: `${p.name || 'Unnamed player'}${tag ? ` · ${tag}` : ''}${at >= 0 && at !== i ? `  (bats ${ordinal(at + 1)})` : ''}` };
                  })}
                />
                </div>
                <input
                  className="input c-notes"
                  value={row.notes}
                  placeholder="Optional notes, e.g. strong against spin"
                  onChange={(e) => setLineup((b) => b.map((r, j) => (j === i ? { ...r, notes: e.target.value } : r)))}
                  aria-label={`${ordinal(i + 1)} batter notes`}
                />
              </>
            )}
          />
          <p className="faint small row">
            <Info size={14} /> Choosing a player who is already in the order swaps the two players, so nobody appears twice. Notes move with the player.
          </p>
        </div>
      </div>
    </>
  );
}

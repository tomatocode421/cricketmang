import { Info } from 'lucide-react';
import { useStore, logActivity } from '../store.jsx';
import { PageHeader } from '../components/ui.jsx';

export default function Players() {
  const { data, update } = useStore();

  const rename = (id, name) =>
    update((draft) => {
      const p = draft.players.find((x) => x.id === id);
      const old = p.name;
      p.name = name;
      // Keep fielding entries that used the old name in step (unfinished matches only).
      if (old.trim() && name.trim()) {
        draft.matches
          .filter((m) => m.status !== 'Finished')
          .forEach((m) =>
            m.fielding.setups.forEach((s) =>
              Object.values(s.positions).forEach((pos) => {
                if (pos.player?.trim().toLowerCase() === old.trim().toLowerCase()) pos.player = name;
              })
            )
          );
      }
      logActivity(draft, { key: 'players', type: 'players', text: 'Updated team player names', target: 'players' });
    });

  return (
    <>
      <PageHeader title="Player Management" subtitle="Your 11-player team roster — enter each name once and it is used everywhere" />
      <div className="content">
        <div className="grid split" style={{ gridTemplateColumns: 'minmax(0, 560px) minmax(0, 1fr)', alignItems: 'start' }}>
          <section className="panel">
            <div className="panel-head">
              <h2>Team roster</h2>
              <span className="muted small">{data.players.filter((p) => p.name.trim()).length} of 11 named</span>
            </div>
            <div className="panel-body" style={{ paddingTop: 8 }}>
              {data.players.map((p, i) => (
                <div className="player-row" key={p.id}>
                  <span className="player-num">{i + 1}</span>
                  <input
                    className="input"
                    value={p.name}
                    placeholder={`Player ${i + 1}`}
                    onChange={(e) => rename(p.id, e.target.value)}
                    aria-label={`Player ${i + 1} name`}
                  />
                </div>
              ))}
            </div>
          </section>
          <section className="panel panel-pad stack-sm">
            <h3 className="row" style={{ fontSize: 14.5 }}>
              <Info size={16} color="var(--green-soft)" /> How the roster works
            </h3>
            <ul className="reason-list">
              <li>These 11 names appear in the Batting Order and Bowling Order dropdowns and as suggestions when you type in Fielding Positions.</li>
              <li>Renaming a player updates their name in batting and bowling orders, and in fielding setups for matches that are not yet finished.</li>
              <li>Finished matches keep the names exactly as they were when the match was finished, so your history stays accurate.</li>
              <li>Changes save automatically.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

import { Info } from 'lucide-react';
import { useStore, logActivity } from '../store.jsx';
import { PageHeader, Select } from '../components/ui.jsx';
import { BOWLING_STYLES, PLAYER_ROLES, isPace, isSpin } from '../data/model.js';

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
      logActivity(draft, { key: 'players', type: 'players', text: 'Updated team players', target: 'players' });
    });

  const setField = (id, key, value) =>
    update((draft) => {
      const p = draft.players.find((x) => x.id === id);
      p[key] = value;
      logActivity(draft, { key: 'players', type: 'players', text: 'Updated team players', target: 'players' });
    });

  const pace = data.players.filter((p) => isPace(p.bowling));
  const spin = data.players.filter((p) => isSpin(p.bowling));
  const keepers = data.players.filter((p) => p.role === 'Wicketkeeper');
  const lefties = data.players.filter((p) => p.bats === 'Left');

  return (
    <>
      <PageHeader title="Player Management" subtitle="Your 11-player team — enter each name once and it is used everywhere" />
      <div className="content">
        <div className="grid split" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 300px)', alignItems: 'start' }}>
          <section className="panel">
            <div className="panel-head">
              <h2>Team roster</h2>
              <span className="muted small">{data.players.filter((p) => p.name.trim()).length} of 11 named</span>
            </div>
            <div className="roster-head">
              <span>#</span>
              <span>Name</span>
              <span>Role</span>
              <span>Bowling</span>
              <span>Bats</span>
            </div>
            <div className="panel-body" style={{ paddingTop: 4 }}>
              {data.players.map((p, i) => (
                <div className="player-row roster-row" key={p.id}>
                  <span className="player-num">{i + 1}</span>
                  <input className="input r-name" value={p.name} placeholder={`Player ${i + 1}`} onChange={(e) => rename(p.id, e.target.value)} aria-label={`Player ${i + 1} name`} />
                  <div className="r-role">
                    <Select value={p.role} onChange={(v) => setField(p.id, 'role', v)} placeholder="Role…" options={PLAYER_ROLES} aria-label={`Player ${i + 1} role`} />
                  </div>
                  <div className="r-bowl">
                    <Select value={p.bowling} onChange={(v) => setField(p.id, 'bowling', v)} placeholder="Doesn't bowl" options={BOWLING_STYLES} aria-label={`Player ${i + 1} bowling style`} />
                  </div>
                  <div className="seg r-bats" role="radiogroup" aria-label={`Player ${i + 1} batting hand`}>
                    {['Right', 'Left'].map((h) => (
                      <button key={h} type="button" role="radio" aria-checked={(p.bats || 'Right') === h} className={(p.bats || 'Right') === h ? 'on' : ''} onClick={() => setField(p.id, 'bats', h)}>
                        {h === 'Right' ? 'RHB' : 'LHB'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <div className="stack">
            <section className="panel panel-pad stack-sm">
              <h3 style={{ fontSize: 14.5 }}>Your squad</h3>
              <div className="squad-line">
                <span className="faint">Pace</span>
                <span>{pace.length ? pace.map((p) => p.name).join(', ') : '—'}</span>
              </div>
              <div className="squad-line">
                <span className="faint">Spin</span>
                <span>{spin.length ? spin.map((p) => p.name).join(', ') : '—'}</span>
              </div>
              <div className="squad-line">
                <span className="faint">Keeper</span>
                <span>{keepers.length ? keepers.map((p) => p.name).join(', ') : '—'}</span>
              </div>
              <div className="squad-line">
                <span className="faint">Left-handers</span>
                <span>{lefties.length ? lefties.map((p) => p.name).join(', ') : '—'}</span>
              </div>
            </section>
            <section className="panel panel-pad stack-sm">
              <h3 className="row" style={{ fontSize: 14.5 }}>
                <Info size={16} color="var(--green-soft)" /> How the roster works
              </h3>
              <ul className="reason-list">
                <li>Names appear in the Batting and Bowling Order dropdowns, and as suggestions in Fielding Positions.</li>
                <li>Bowling styles let Match Day advice name your actual pace and spin options.</li>
                <li>The keeper is placed automatically when you use a field template.</li>
                <li>Renaming a player updates unfinished matches. Finished matches keep the names as they were.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

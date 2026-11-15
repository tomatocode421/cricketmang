import { useMemo, useRef, useState } from 'react';
import { Lightbulb, Copy, FilePlus2, Pencil, Save, Trash2, Flame, Eye, EyeOff, AlertTriangle, CloudSun } from 'lucide-react';
import { useStore, logActivity } from '../store.jsx';
import { Modal, PageHeader, Select, SourceTag, useDialog, useNav, useToast } from '../components/ui.jsx';
import NoMatch from '../components/NoMatch.jsx';
import CricketField from '../components/CricketField.jsx';
import { POSITIONS, POSITION_GROUPS, POSITION_BY_ID } from '../data/positions.js';
import { fieldingSummary, matchTitle, newFieldingSetup, uid } from '../data/model.js';
import { analyseMatch } from '../lib/tactics.js';

export default function Fielding() {
  const { data, match: m, updateMatch, flush } = useStore();
  const { confirm, prompt } = useDialog();
  const { go } = useNav();
  const toast = useToast();
  const [focused, setFocused] = useState(null);
  const [showInactive, setShowInactive] = useState(true);
  const [showHeat, setShowHeat] = useState(false);
  const [sidePopup, setSidePopup] = useState(false);
  const rowRefs = useRef({});

  const analysis = useMemo(() => (m ? analyseMatch(m) : null), [m]);
  if (!m)
    return (
      <>
        <PageHeader title="Fielding Positions" />
        <div className="content">
          <NoMatch what="fielding positions" />
        </div>
      </>
    );

  const setups = m.fielding.setups;
  const setup = setups.find((s) => s.id === m.fielding.activeSetupId) || setups[0];
  const positions = setup.positions;
  const summary = fieldingSummary(setup);

  const editSetup = (recipe, activity = true) =>
    updateMatch(m.id, (mm, draft) => {
      const s = mm.fielding.setups.find((x) => x.id === setup.id);
      recipe(s, mm);
      s.updatedAt = Date.now();
      if (activity) logActivity(draft, { key: 'field-' + s.id, type: 'fielding', text: `Updated fielding setup "${s.name}"`, matchId: m.id, target: 'fielding' });
    });

  const toggle = (posId, checked) => {
    const prev = positions[posId];
    if (!checked && prev?.player?.trim()) {
      const name = prev.player;
      editSetup((s) => {
        s.positions[posId] = { active: false, player: '' };
      });
      toast(`Removed ${name} from ${POSITION_BY_ID[posId].name}`, {
        action: {
          label: 'Undo',
          run: () =>
            updateMatch(m.id, (mm) => {
              const s = mm.fielding.setups.find((x) => x.id === setup.id);
              if (s) s.positions[posId] = { active: true, player: name };
            }),
        },
      });
    } else {
      editSetup((s) => {
        s.positions[posId] = { active: checked, player: checked ? prev?.player || '' : '' };
      });
    }
    setFocused(posId);
  };

  const setPlayer = (posId, player) =>
    editSetup((s) => {
      s.positions[posId] = { active: true, player };
    });

  const selectSetup = (id) => updateMatch(m.id, (mm) => (mm.fielding.activeSetupId = id));

  const createSetup = async () => {
    const name = await prompt({ title: 'Create new fielding setup', label: 'Setup name', placeholder: 'e.g. Attacking Field', confirmLabel: 'Create' });
    if (!name) return;
    const s = newFieldingSetup(name);
    updateMatch(m.id, (mm, draft) => {
      mm.fielding.setups.push(s);
      mm.fielding.activeSetupId = s.id;
      logActivity(draft, { key: 'field-' + s.id, type: 'fielding', text: `Created fielding setup "${name}"`, matchId: m.id, target: 'fielding' });
    });
    toast(`Created "${name}"`);
  };
  const renameSetup = async () => {
    const name = await prompt({ title: 'Rename fielding setup', label: 'Setup name', defaultValue: setup.name, confirmLabel: 'Rename' });
    if (!name) return;
    editSetup((s) => (s.name = name));
    toast('Setup renamed');
  };
  const duplicateSetup = async () => {
    const name = await prompt({ title: 'Duplicate fielding setup', label: 'Name for the copy', defaultValue: `${setup.name} (copy)`, confirmLabel: 'Duplicate' });
    if (!name) return;
    const copy = { ...structuredClone(setup), id: uid('fs'), name, updatedAt: Date.now() };
    updateMatch(m.id, (mm, draft) => {
      mm.fielding.setups.push(copy);
      mm.fielding.activeSetupId = copy.id;
      logActivity(draft, { key: 'field-' + copy.id, type: 'fielding', text: `Duplicated fielding setup as "${name}"`, matchId: m.id, target: 'fielding' });
    });
    toast(`Duplicated as "${name}"`);
  };
  const deleteSetup = async () => {
    const ok = await confirm({
      title: `Delete "${setup.name}"?`,
      message: `This permanently removes this fielding setup and its ${summary.count} selected positions. Other setups are not affected.`,
      confirmLabel: 'Delete setup',
      danger: true,
    });
    if (!ok) return;
    updateMatch(m.id, (mm) => {
      mm.fielding.setups = mm.fielding.setups.filter((s) => s.id !== setup.id);
      if (!mm.fielding.setups.length) mm.fielding.setups.push(newFieldingSetup('Standard Field'));
      mm.fielding.activeSetupId = mm.fielding.setups[0].id;
    });
    toast('Setup deleted');
  };
  const saveSetup = async () => {
    editSetup(() => {});
    await flush();
    toast(`"${setup.name}" saved`);
  };
  const clearAll = async () => {
    const ok = await confirm({ title: 'Clear all positions?', message: `Untick every position in "${setup.name}" and clear the names.`, confirmLabel: 'Clear all', danger: true });
    if (ok) editSetup((s) => (s.positions = {}));
  };

  const focusRow = (id) => {
    setFocused(id);
    rowRefs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const input = rowRefs.current[id]?.querySelector('input[type=text]');
    if (input && !input.disabled) input.focus();
  };

  const usedNames = Object.values(positions)
    .filter((p) => p.active && p.player?.trim())
    .map((p) => p.player.trim().toLowerCase());
  const dupes = [...new Set(usedNames.filter((n, i) => usedNames.indexOf(n) !== i))];
  const unplaced = data.players.filter((p) => p.name.trim() && !usedNames.includes(p.name.trim().toLowerCase()));
  const heat = {};
  (m.matchDay.scoring || []).forEach((o) => (heat[o.area] = (heat[o.area] || 0) + (Number(o.weight) || 1)));
  const hasHeat = Object.keys(heat).length > 0;

  const sideContent = (
    <>
                {(summary.count > 10 || dupes.length > 0) && (
                  <div className="callout caution">
                    <AlertTriangle size={16} />
                    <div>
                      {summary.count > 10 && <div>{summary.count} positions are selected. With a bowler, a team can only place 10 fielders including the keeper.</div>}
                      {dupes.length > 0 && <div>The same name is used in more than one position: {dupes.join(', ')}.</div>}
                    </div>
                  </div>
                )}
                <div className="panel panel-pad stack-sm">
                  <div className="row">
                    <strong style={{ fontSize: 13.5 }}>On the field</strong>
                  </div>
                  {summary.count === 0 && <p className="muted small">Tick positions on the left to place fielders.</p>}
                  {POSITIONS.filter((p) => positions[p.id]?.active).map((p) => (
                    <div key={p.id} className="row small" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => focusRow(p.id)}>
                      <span className="muted">{p.name}</span>
                      <span style={{ fontWeight: 550 }}>{positions[p.id].player || <em className="faint">no name</em>}</span>
                    </div>
                  ))}
                  {unplaced.length > 0 && summary.count > 0 && (
                    <div className="small faint" style={{ marginTop: 6 }}>
                      Not placed: {unplaced.map((p) => p.name).join(', ')}
                    </div>
                  )}
                </div>
                <div className="panel panel-pad stack-sm">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: 13.5 }}>Match Day suggestions</strong>
                    <SourceTag kind="generated" />
                  </div>
                  {analysis.fielding.slice(0, 4).map((f) => (
                    <p key={f} className="muted small">
                      • {f}
                    </p>
                  ))}
                  {analysis.areaSuggestions.length === 0 && (
                    <p className="faint small">Record scoring areas in Match Day to get suggestions for protecting them.</p>
                  )}
                  <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => go('matchday')}>
                    <CloudSun size={13} /> Open Match Day
                  </button>
                </div>
                  </>
  );

  return (
    <>
      <PageHeader title="Fielding Positions" subtitle={`${matchTitle(m)} · tick a position, then type the player's name`}>
        <button className="btn primary" onClick={saveSetup}>
          <Save size={15} /> Save Setup
        </button>
      </PageHeader>
      <div className="content no-pad">
        <div className="fielding">
          <aside className="pos-list">
            <div className="pos-list-head">
              <div className="row">
                <div style={{ flex: 1 }}>
                  <Select
                    aria-label="Fielding setup"
                    value={setup.id}
                    onChange={selectSetup}
                    options={setups.map((s) => ({ value: s.id, label: `${s.name} (${fieldingSummary(s).count})` }))}
                  />
                </div>
              </div>
              <div className="setup-actions">
                <button className="btn sm primary" onClick={createSetup} title="Create New Setup">
                  <FilePlus2 size={14} /> New
                </button>
                <button className="btn sm" onClick={renameSetup} title="Rename Setup">
                  <Pencil size={13} /> Rename
                </button>
                <button className="btn sm" onClick={duplicateSetup} title="Duplicate Setup">
                  <Copy size={13} /> Duplicate
                </button>
                <button className="btn sm danger" onClick={deleteSetup} title="Delete Setup">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
            <div className="pos-scroll">
              <datalist id="roster-names">
                {data.players.filter((p) => p.name.trim()).map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
              <div className="pos-cols" style={{ paddingTop: 10 }}>
                <span>Select</span>
                <span>Fielding position</span>
                <span>Player name</span>
              </div>
              {POSITION_GROUPS.map((g) => {
                const list = POSITIONS.filter((p) => p.group === g.id);
                const n = list.filter((p) => positions[p.id]?.active).length;
                return (
                  <div key={g.id}>
                    <div className="pos-group">
                      <span>{g.label}</span>
                      <span>{n ? `${n} selected` : ''}</span>
                    </div>
                    {list.map((p) => {
                      const st = positions[p.id] || { active: false, player: '' };
                      return (
                        <div
                          key={p.id}
                          ref={(el) => (rowRefs.current[p.id] = el)}
                          className={`pos-row ${st.active ? 'active' : ''} ${focused === p.id ? 'focused' : ''}`}
                          onMouseEnter={() => setFocused(p.id)}
                        >
                          <input type="checkbox" className="checkbox" checked={!!st.active} onChange={(e) => toggle(p.id, e.target.checked)} aria-label={`Select ${p.name}`} />
                          <span className="pname" onClick={() => toggle(p.id, !st.active)}>
                            {p.name}
                          </span>
                          <input
                            type="text"
                            className="input"
                            list="roster-names"
                            disabled={!st.active}
                            value={st.player || ''}
                            placeholder={st.active ? 'Type a name' : ''}
                            onFocus={() => setFocused(p.id)}
                            onChange={(e) => setPlayer(p.id, e.target.value)}
                            aria-label={`${p.name} player name`}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="field-area">
            <div className="field-toolbar">
              <span className={`tag ${summary.count > 10 ? 'amber' : 'green'}`}>
                {summary.count} position{summary.count === 1 ? '' : 's'} selected · {summary.named} named
              </span>
              <span className="faint small">Right-handed batter · off side on the left</span>
              <span className="spacer" />
              <button className="btn sm ghost" onClick={() => setShowInactive((v) => !v)}>
                {showInactive ? <EyeOff size={14} /> : <Eye size={14} />} {showInactive ? 'Hide' : 'Show'} unselected positions
              </button>
              <button className="btn sm ghost" disabled={!hasHeat} title={hasHeat ? '' : 'Add scoring areas in Match Day to use this'} onClick={() => setShowHeat((v) => !v)}>
                <Flame size={14} /> {showHeat ? 'Hide' : 'Show'} scoring areas
              </button>
              <button className="btn sm ghost only-narrow" onClick={() => setSidePopup(true)}>
                <Lightbulb size={14} /> Suggestions
              </button>
              <button className="btn sm ghost" onClick={clearAll} disabled={!summary.count}>
                Clear all
              </button>
            </div>
            <div className="field-wrap">
              <div className="field-svg-wrap">
                <CricketField positions={positions} focusedId={focused} onMarkerClick={focusRow} showInactive={showInactive} heat={showHeat ? heat : null} />
              </div>
              <div className="field-side">{sideContent}</div>
            </div>
          </section>
        </div>
      </div>
      {sidePopup && (
        <Modal title="Fielding overview and suggestions" onClose={() => setSidePopup(false)}>
          <div className="stack">{sideContent}</div>
        </Modal>
      )}
    </>
  );
}

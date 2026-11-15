import { useMemo, useRef, useState } from 'react';
import { Lightbulb, Copy, FilePlus2, Pencil, Save, Trash2, Flame, Eye, EyeOff, AlertTriangle, CloudSun, ZoomIn, ZoomOut, Maximize, Plus, RotateCcw, Move } from 'lucide-react';
import { useStore, logActivity } from '../store.jsx';
import { Field, Modal, PageHeader, Select, SourceTag, useDialog, useNav, useToast } from '../components/ui.jsx';
import NoMatch from '../components/NoMatch.jsx';
import CricketField from '../components/CricketField.jsx';
import { FIELD, FIELD_TEMPLATES, POSITION_GROUPS, POSITION_BY_ID, applyFieldTemplate, clampToField, fieldPositions } from '../data/positions.js';
import { fieldingSummary, matchTitle, matchXI, newFieldingSetup, playerName, reservePlayers, uid } from '../data/model.js';
import { analyseMatch } from '../lib/tactics.js';

const ZOOMS = [1, 1.5, 2, 3];
// Slider scale: 0–100 across and down the playing area.
const X0 = 30;
const X1 = FIELD.width - 30;
const Y0 = 30;
const Y1 = FIELD.height - 30;
const toPct = (v, a, b) => Math.round(((v - a) / (b - a)) * 100);
const fromPct = (p, a, b) => a + (p / 100) * (b - a);

// Custom position names and spots used in any setup, so they can be reused.
function customLibrary(matches) {
  const lib = new Map();
  for (const m of matches) {
    for (const s of m.fielding.setups) {
      for (const c of s.custom || []) {
        const st = s.positions[c.id] || {};
        const name = (st.label || c.name || '').trim();
        if (name) lib.set(name.toLowerCase(), { name, x: st.x ?? c.x, y: st.y ?? c.y });
      }
    }
  }
  return [...lib.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function Fielding() {
  const { data, match: m, updateMatch, flush } = useStore();
  const { confirm, prompt } = useDialog();
  const { go } = useNav();
  const toast = useToast();
  const [focused, setFocused] = useState(null);
  const [showInactive, setShowInactive] = useState(true);
  const [showHeat, setShowHeat] = useState(false);
  const [sidePopup, setSidePopup] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const rowRefs = useRef({});

  const analysis = useMemo(() => (m ? analyseMatch(m, data.players) : null), [m, data.players]);
  const library = useMemo(() => customLibrary(data.matches), [data.matches]);
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
  const all = fieldPositions(setup);
  const byId = Object.fromEntries(all.map((p) => [p.id, p]));
  const summary = fieldingSummary(setup);
  const activeList = all.filter((p) => positions[p.id]?.active);
  const outsideCount = activeList.filter((p) => p.outer).length;
  const insideCount = activeList.length - outsideCount;
  const roster = m.rosterSnapshot || data.players;
  const xi = matchXI(m, roster);
  const reserve = reservePlayers(m, roster);
  const mirror = (x) => (setup.leftHanded ? FIELD.width - x : x);

  const editSetup = (recipe, activity = true) =>
    updateMatch(m.id, (mm, draft) => {
      const s = mm.fielding.setups.find((x) => x.id === setup.id);
      s.custom = s.custom || [];
      recipe(s, mm);
      s.updatedAt = Date.now();
      if (activity) logActivity(draft, { key: 'field-' + s.id, type: 'fielding', text: `Updated fielding setup "${s.name}"`, matchId: m.id, target: 'fielding' });
    });

  const posName = (id) => byId[id]?.name || POSITION_BY_ID[id]?.name || 'position';

  const toggle = (posId, checked) => {
    const prev = positions[posId] || {};
    if (!checked && prev.player?.trim()) {
      const name = prev.player;
      const before = { ...prev };
      editSetup((s) => {
        s.positions[posId] = { ...prev, active: false, player: '' };
      });
      toast(`Removed ${name} from ${posName(posId)}`, {
        action: {
          label: 'Undo',
          run: () =>
            updateMatch(m.id, (mm) => {
              const s = mm.fielding.setups.find((x) => x.id === setup.id);
              if (s) s.positions[posId] = before;
            }),
        },
      });
    } else {
      editSetup((s) => {
        s.positions[posId] = { ...prev, active: checked, player: checked ? prev.player || '' : '' };
      });
    }
    setFocused(posId);
  };

  const setPlayer = (posId, player) =>
    editSetup((s) => {
      s.positions[posId] = { ...(s.positions[posId] || {}), active: true, player };
    });

  // Move a fielder (from the sliders or by dragging). Stored for a right-handed batter.
  const moveTo = (posId, x, y) => {
    const c = clampToField(x, y);
    editSetup((s) => {
      s.positions[posId] = { ...(s.positions[posId] || { active: true, player: '' }), x: c.x, y: c.y };
      const cust = s.custom.find((cc) => cc.id === posId);
      if (cust) Object.assign(cust, { x: c.x, y: c.y });
    }, false);
  };
  const resetPosition = (posId) =>
    editSetup((s) => {
      const st = { ...(s.positions[posId] || {}) };
      delete st.x;
      delete st.y;
      s.positions[posId] = st;
    });
  const renamePosition = (posId, label) =>
    editSetup((s) => {
      s.positions[posId] = { ...(s.positions[posId] || { active: true, player: '' }), label };
    }, false);
  const removeCustom = async (posId) => {
    const ok = await confirm({ title: `Remove "${posName(posId)}"?`, message: 'This custom position is removed from this setup only. You can add it again later from your saved custom positions.', confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    editSetup((s) => {
      s.custom = s.custom.filter((c) => c.id !== posId);
      delete s.positions[posId];
    });
    setFocused(null);
  };
  const addCustom = () => {
    const name = newName.trim();
    if (!name) return;
    const saved = library.find((l) => l.name.toLowerCase() === name.toLowerCase());
    const id = uid('cp');
    const spot = clampToField(saved?.x ?? FIELD.cx, saved?.y ?? 860);
    editSetup((s) => {
      s.custom.push({ id, name, x: spot.x, y: spot.y });
      s.positions[id] = { active: true, player: '', x: spot.x, y: spot.y };
    });
    setAddOpen(false);
    setNewName('');
    setFocused(id);
    toast(saved ? `Added "${name}" at its saved spot — drag it or use the sliders to adjust` : `Added "${name}" — drag it on the field or use the sliders`);
  };

  const selectSetup = (id) => updateMatch(m.id, (mm) => (mm.fielding.activeSetupId = id));

  const createSetup = async () => {
    const name = await prompt({ title: 'Create new fielding setup', label: 'Setup name', placeholder: 'e.g. Attacking Field', confirmLabel: 'Create' });
    if (!name) return;
    const s = newFieldingSetup(name);
    updateMatch(m.id, (mm, draft) => {
      mm.fielding.setups.push({ custom: [], ...s });
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
      if (!mm.fielding.setups.length) mm.fielding.setups.push({ custom: [], ...newFieldingSetup('Standard Field') });
      mm.fielding.activeSetupId = mm.fielding.setups[0].id;
    });
    toast('Setup deleted');
  };
  const saveSetup = async () => {
    editSetup(() => {});
    await flush();
    toast(`"${setup.name}" saved`);
  };
  const applyTemplate = (id) => {
    const tpl = FIELD_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    const before = structuredClone(setup.positions);
    const keeper = roster.find((p) => p.role === 'Wicketkeeper' && p.name.trim() && xi.includes(p.id))?.name;
    const next = applyFieldTemplate(setup, tpl, keeper);
    editSetup((s) => (s.positions = next));
    toast(`Applied "${tpl.name}"`, {
      action: {
        label: 'Undo',
        run: () =>
          updateMatch(m.id, (mm) => {
            const s = mm.fielding.setups.find((x) => x.id === setup.id);
            if (s) s.positions = before;
          }),
      },
    });
  };

  const setLeftHanded = (left) => editSetup((s) => (s.leftHanded = left));

  const clearAll = async () => {
    const ok = await confirm({ title: 'Clear all positions?', message: `Untick every position in "${setup.name}" and clear the names and moved spots.`, confirmLabel: 'Clear all', danger: true });
    if (ok) editSetup((s) => (s.positions = {}));
  };

  const focusRow = (id) => {
    setFocused(id);
    rowRefs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const usedNames = activeList.map((p) => positions[p.id].player?.trim().toLowerCase()).filter(Boolean);
  const dupes = [...new Set(usedNames.filter((n, i) => usedNames.indexOf(n) !== i))];
  const unplaced = xi.map((id) => playerName(roster, m, id)).filter((n) => n.trim() && !usedNames.includes(n.trim().toLowerCase()));
  const heat = {};
  (m.matchDay.scoring || []).forEach((o) => (heat[o.area] = (heat[o.area] || 0) + (Number(o.weight) || 1)));
  const hasHeat = Object.keys(heat).length > 0;
  const fp = focused && positions[focused]?.active ? byId[focused] : null;

  const editor = fp ? (
    <div className="panel panel-pad stack-sm pos-editor" aria-label="Position editor">
      <div className="row">
        <Move size={15} color="var(--green-soft)" />
        <strong style={{ fontSize: 13.5, flex: 1 }}>
          {fp.name}
          {positions[fp.id].player ? ` · ${positions[fp.id].player}` : ''}
        </strong>
        {fp.custom ? <span className="tag violet">Custom</span> : fp.moved ? <span className="tag amber">Moved</span> : <span className="tag grey">Standard spot</span>}
      </div>
      <Field label="Position name">
        <input className="input" value={positions[fp.id].label ?? (fp.custom ? fp.name : '')} placeholder={fp.standardName} onChange={(e) => renamePosition(fp.id, e.target.value)} aria-label="Position name" />
      </Field>
      <div className="slider-row">
        <label htmlFor="pos-x">Left ↔ right</label>
        <input id="pos-x" type="range" min="0" max="100" value={toPct(mirror(fp.x), X0, X1)} onChange={(e) => moveTo(fp.id, mirror(fromPct(Number(e.target.value), X0, X1)), fp.y)} aria-label="Horizontal position" />
        <span className="slider-val">{toPct(mirror(fp.x), X0, X1)}</span>
      </div>
      <div className="slider-row">
        <label htmlFor="pos-y">Up ↕ down</label>
        <input id="pos-y" type="range" min="0" max="100" value={toPct(fp.y, Y0, Y1)} onChange={(e) => moveTo(fp.id, fp.x, fromPct(Number(e.target.value), Y0, Y1))} aria-label="Vertical position" />
        <span className="slider-val">{toPct(fp.y, Y0, Y1)}</span>
      </div>
      <p className="faint small">
        {fp.outer ? 'Outside' : 'Inside'} the circle · {fp.area.replace(/^\w/, (c) => c.toUpperCase())} region. You can also drag the marker on the field.
      </p>
      <div className="row row-wrap">
        {!fp.custom && (
          <button className="btn sm" onClick={() => resetPosition(fp.id)} disabled={!fp.moved}>
            <RotateCcw size={13} /> Back to standard spot
          </button>
        )}
        {fp.custom && (
          <button className="btn sm danger" onClick={() => removeCustom(fp.id)}>
            <Trash2 size={13} /> Remove custom position
          </button>
        )}
      </div>
    </div>
  ) : (
    <div className="panel panel-pad pos-editor faint small">Select a fielder (tap the marker or the position name) to move them with sliders, rename the position, or drag them on the field.</div>
  );

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
        <strong style={{ fontSize: 13.5 }}>On the field</strong>
        {summary.count === 0 && <p className="muted small">Tick positions to place fielders.</p>}
        {activeList.map((p) => (
          <div key={p.id} className="row small" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => focusRow(p.id)}>
            <span className="muted">{p.name}</span>
            <span style={{ fontWeight: 550 }}>{positions[p.id].player || <em className="faint">no name</em>}</span>
          </div>
        ))}
        {unplaced.length > 0 && summary.count > 0 && <div className="small faint" style={{ marginTop: 6 }}>Not placed: {unplaced.join(', ')}</div>}
        {reserve.length > 0 && <div className="small faint">12th player: {reserve.map((p) => p.name).join(', ')}</div>}
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
        {analysis.areaSuggestions.length === 0 && <p className="faint small">Record scoring areas in Match Day to get suggestions for protecting them.</p>}
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => go('matchday')}>
          <CloudSun size={13} /> Open Match Day
        </button>
      </div>
    </>
  );

  const groups = [...POSITION_GROUPS, { id: 'custom', label: 'Custom positions' }];

  return (
    <>
      <PageHeader title="Fielding Positions" subtitle={`${matchTitle(m)} · tick a position, type the player, then drag or slide to fine-tune`}>
        <button className="btn primary" onClick={saveSetup}>
          <Save size={15} /> Save Setup
        </button>
      </PageHeader>
      <div className="content no-pad">
        <div className="fielding">
          <aside className="pos-list">
            <div className="pos-list-head">
              <Select aria-label="Fielding setup" value={setup.id} onChange={selectSetup} options={setups.map((s) => ({ value: s.id, label: `${s.name} (${fieldingSummary(s).count})` }))} />
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
                {xi
                  .map((id) => playerName(roster, m, id))
                  .filter((n) => n.trim())
                  .map((n) => (
                    <option key={n} value={n} />
                  ))}
              </datalist>
              <div className="pos-cols" style={{ paddingTop: 10 }}>
                <span>Select</span>
                <span>Fielding position</span>
                <span>Player name</span>
              </div>
              {groups.map((g) => {
                const list = all.filter((p) => (g.id === 'custom' ? p.custom : !p.custom && p.group === g.id));
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
                        >
                          <input type="checkbox" className="checkbox" checked={!!st.active} onChange={(e) => toggle(p.id, e.target.checked)} aria-label={`Select ${p.name}`} />
                          <span className="pname" onClick={() => (st.active ? setFocused(p.id) : toggle(p.id, true))}>
                            {p.name}
                            {(p.moved || (p.custom && st.active)) && <span className="moved-dot" title={p.custom ? 'Custom position' : 'Moved from the standard spot'} />}
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
                    {g.id === 'custom' && (
                      <div style={{ padding: '6px 8px' }}>
                        <button className="btn sm" onClick={() => setAddOpen(true)}>
                          <Plus size={14} /> Add custom position
                        </button>
                      </div>
                    )}
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
              <span className="tag grey" title="Fielders inside / outside the 30-yard circle">
                {insideCount} in · {outsideCount} out
              </span>
              <div className="seg" role="radiogroup" aria-label="Batter">
                <button type="button" role="radio" aria-checked={!setup.leftHanded} className={!setup.leftHanded ? 'on' : ''} onClick={() => setLeftHanded(false)}>
                  Right-hander
                </button>
                <button type="button" role="radio" aria-checked={!!setup.leftHanded} className={setup.leftHanded ? 'on' : ''} onClick={() => setLeftHanded(true)}>
                  Left-hander
                </button>
              </div>
              <span className="spacer" />
              <div style={{ width: 190 }}>
                <Select aria-label="Apply a field template" value="" onChange={applyTemplate} placeholder="Apply a template…" options={FIELD_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))} />
              </div>
              <div className="zoom-ctl" role="group" aria-label="Zoom">
                <button className="btn sm ghost icon" aria-label="Zoom out" disabled={zoom === ZOOMS[0]} onClick={() => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])}>
                  <ZoomOut size={15} />
                </button>
                <span className="zoom-val">{Math.round(zoom * 100)}%</span>
                <button className="btn sm ghost icon" aria-label="Zoom in" disabled={zoom === ZOOMS[ZOOMS.length - 1]} onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])}>
                  <ZoomIn size={15} />
                </button>
                <button className="btn sm ghost icon" aria-label="Show whole field" disabled={zoom === 1} onClick={() => setZoom(1)}>
                  <Maximize size={14} />
                </button>
              </div>
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
              <div className="field-column">
                <div className="field-svg-wrap">
                  <CricketField
                    positions={positions}
                    custom={setup.custom || []}
                    focusedId={focused}
                    onMarkerClick={focusRow}
                    onMove={moveTo}
                    zoom={zoom}
                    showInactive={showInactive}
                    heat={showHeat ? heat : null}
                    leftHanded={!!setup.leftHanded}
                  />
                </div>
                {editor}
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
      {addOpen && (
        <Modal
          title="Add a custom position"
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" disabled={!newName.trim()} onClick={addCustom}>
                Add position
              </button>
            </>
          }
        >
          <div className="stack-sm">
            <Field label="Position name" hint={library.length ? 'Pick one of your saved custom positions or type a new name' : 'e.g. Deep Extra Cover, Very Deep Mid-wicket'}>
              <input className="input" autoFocus list="custom-library" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} aria-label="Custom position name" />
              <datalist id="custom-library">
                {library.map((l) => (
                  <option key={l.name} value={l.name} />
                ))}
              </datalist>
            </Field>
            {library.length > 0 && (
              <div className="row row-wrap" style={{ gap: 6 }}>
                {library.map((l) => (
                  <button key={l.name} className="btn sm" onClick={() => setNewName(l.name)}>
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

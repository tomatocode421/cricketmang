import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Plus, History, Check, CornerDownLeft, HardDriveDownload, LayoutGrid, Share2, X } from 'lucide-react';
import { useStore } from '../store.jsx';
import { useNav } from './ui.jsx';
import { NAV_ITEMS } from './Sidebar.jsx';
import { formatDate, matchTitle } from '../data/model.js';

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = isMac ? '⌘' : 'Ctrl+';

const MATCH_DAY_TABS = [
  ['weather', 'Weather Forecast'],
  ['ground', 'Ground & Pitch'],
  ['conditions', 'Playing Conditions'],
  ['strategy', 'Tactical Recommendations'],
  ['checklist', 'Match Day Checklist'],
  ['notes', 'Match Day Notes'],
];

/* ---------- Quick search (⌘K) ---------- */
export function CommandPalette({ onClose }) {
  const { data, setWorkingMatchId } = useStore();
  const { go, openNewMatch, openBackup } = useNav();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef();

  const items = useMemo(() => {
    const all = [
      ...NAV_ITEMS.map((n, i) => ({ group: 'Go to', label: n.label, icon: n.icon, hint: i < 9 ? `${MOD}${i + 1}` : '', run: () => go(n.id) })),
      ...MATCH_DAY_TABS.map(([tab, label]) => ({ group: 'Match Day', label, run: () => go('matchday', { tab }) })),
      { group: 'Actions', label: 'New match', icon: Plus, hint: `${MOD}N`, run: openNewMatch },
      { group: 'Actions', label: 'Share team sheet', icon: Share2, run: () => go('match', { share: true }) },
      { group: 'Actions', label: 'Add a tip or improvement', icon: Plus, run: () => go('tips', { add: true }) },
      { group: 'Actions', label: 'Sync & Backup', icon: HardDriveDownload, run: openBackup },
      ...[...data.matches]
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .map((m) => ({
          group: 'Matches',
          label: matchTitle(m),
          detail: [m.opposition, m.date && formatDate(m.date, { short: true }), m.id === data.currentMatchId ? 'current' : m.status === 'Finished' ? 'finished' : ''].filter(Boolean).join(' · '),
          icon: History,
          run: () => {
            if (m.id === data.currentMatchId) {
              setWorkingMatchId(null);
              go('match');
            } else go('history', { open: m.id });
          },
        })),
      ...data.tips.map((t) => ({ group: 'Tips', label: t.title, detail: `${t.category} · ${t.status}`, run: () => go('tips', { q: t.title }) })),
      ...data.players.filter((p) => p.name.trim()).map((p) => ({ group: 'Players', label: p.name, run: () => go('players') })),
    ];
    const s = q.trim().toLowerCase();
    if (!s) return all.filter((x) => x.group !== 'Tips' && x.group !== 'Players').slice(0, 30);
    return all
      .map((x) => {
        const hay = `${x.label} ${x.detail || ''} ${x.group}`.toLowerCase();
        const idx = x.label.toLowerCase().indexOf(s);
        const words = s.split(/\s+/);
        if (!words.every((w) => hay.includes(w))) return null;
        return { ...x, score: idx === 0 ? 0 : idx > 0 ? 1 : 2 };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40);
  }, [q, data, go, openNewMatch, openBackup, setWorkingMatchId]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('.cmd-item.on')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const run = (item) => {
    onClose();
    item?.run();
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(items[sel]);
    } else if (e.key === 'Escape') onClose();
  };

  let lastGroup = null;
  return (
    <div className="modal-backdrop cmd-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmd" role="dialog" aria-label="Search the app">
        <div className="cmd-input">
          <Search size={17} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search sections, matches, tips and players…" aria-label="Quick search" />
          <button className="btn ghost icon" onClick={onClose} aria-label="Close search">
            <X size={16} />
          </button>
        </div>
        <div className="cmd-list" ref={listRef}>
          {items.length === 0 && <div className="cmd-empty">Nothing matches “{q}”.</div>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? <div className="cmd-group">{it.group}</div> : null;
            lastGroup = it.group;
            const Icon = it.icon || CornerDownLeft;
            return (
              <div key={i}>
                {header}
                <button className={`cmd-item ${i === sel ? 'on' : ''}`} onMouseMove={() => setSel(i)} onClick={() => run(it)}>
                  <Icon size={15} />
                  <span className="cmd-label">{it.label}</span>
                  {it.detail && <span className="cmd-detail">{it.detail}</span>}
                  <span className="spacer" />
                  {it.hint && <kbd>{it.hint}</kbd>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="cmd-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>↵</kbd> to open
          </span>
          <span>
            <kbd>esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Match switcher (sidebar) ---------- */
export function MatchSwitcher() {
  const { data, update, match, isEditingPrevious, setWorkingMatchId } = useStore();
  const { go, openNewMatch } = useNav();
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const current = data.matches.find((m) => m.id === data.currentMatchId);
  const upcoming = data.matches.filter((m) => m.status !== 'Finished').sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const shown = isEditingPrevious ? match : current;
  return (
    <div className="switcher" ref={ref}>
      <button className={`switcher-btn ${isEditingPrevious ? 'editing' : ''}`} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="switcher-k">{isEditingPrevious ? 'Editing previous match' : 'Current match'}</div>
          <div className="switcher-v">{shown ? matchTitle(shown) : 'No match yet'}</div>
          {shown?.date && <div className="switcher-s">{formatDate(shown.date, { short: true })}</div>}
        </div>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="switcher-menu" role="menu">
          {upcoming.length > 0 && <div className="cmd-group">Upcoming matches</div>}
          {upcoming.map((m) => (
            <button
              key={m.id}
              className="cmd-item"
              role="menuitem"
              onClick={() => {
                update((d) => {
                  d.currentMatchId = m.id;
                });
                setWorkingMatchId(null);
                setOpen(false);
              }}
            >
              {m.id === data.currentMatchId && !isEditingPrevious ? <Check size={14} color="var(--green-strong)" /> : <span style={{ width: 14 }} />}
              <span className="cmd-label">{matchTitle(m)}</span>
              <span className="cmd-detail">{m.date ? formatDate(m.date, { short: true }) : ''}</span>
            </button>
          ))}
          <div className="switcher-sep" />
          <button className="cmd-item" role="menuitem" onClick={() => (setOpen(false), openNewMatch())}>
            <Plus size={14} /> <span className="cmd-label">New match…</span>
          </button>
          <button className="cmd-item" role="menuitem" onClick={() => (setOpen(false), go('history'))}>
            <History size={14} /> <span className="cmd-label">Match history</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Phone navigation ---------- */
const TAB_IDS = ['dashboard', 'matchday', 'fielding', 'batting'];

export function MobileNav({ onSearch }) {
  const { page, go, openBackup } = useNav();
  const [more, setMore] = useState(false);
  const tabs = TAB_IDS.map((id) => NAV_ITEMS.find((n) => n.id === id));
  const short = { dashboard: 'Home', matchday: 'Match Day', fielding: 'Fielding', batting: 'Batting' };
  const inMore = !TAB_IDS.includes(page);
  return (
    <>
      <nav className="tabbar" aria-label="Main">
        {tabs.map((t) => (
          <button key={t.id} className={page === t.id && !more ? 'on' : ''} onClick={() => (setMore(false), go(t.id))}>
            <t.icon size={21} strokeWidth={1.9} />
            <span>{short[t.id]}</span>
          </button>
        ))}
        <button className={inMore || more ? 'on' : ''} onClick={() => setMore((m) => !m)} aria-expanded={more}>
          <LayoutGrid size={21} strokeWidth={1.9} />
          <span>More</span>
        </button>
      </nav>
      {more && (
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="menu" aria-label="All sections">
            <div className="sheet-handle" />
            <button className="sheet-search" onClick={() => (setMore(false), onSearch())}>
              <Search size={16} /> Search sections, matches, tips…
            </button>
            <div className="sheet-grid">
              {NAV_ITEMS.map((n) => (
                <button key={n.id} className={page === n.id ? 'on' : ''} onClick={() => (setMore(false), go(n.id))} role="menuitem">
                  <n.icon size={20} strokeWidth={1.9} />
                  <span>{n.label}</span>
                </button>
              ))}
              <button onClick={() => (setMore(false), openBackup())} role="menuitem">
                <HardDriveDownload size={20} strokeWidth={1.9} />
                <span>Sync &amp; Backup</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

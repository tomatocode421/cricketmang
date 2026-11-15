import { useCallback, useEffect, useRef, useState } from 'react';
import { PencilLine } from 'lucide-react';
import { StoreProvider, useStore } from './store.jsx';
import { NavContext, UIProvider } from './components/ui.jsx';
import Sidebar from './components/Sidebar.jsx';
import BackupModal from './components/BackupModal.jsx';
import NewMatchModal from './components/NewMatchModal.jsx';
import { CommandPalette, MobileNav } from './components/Navigation.jsx';
import { NAV_ITEMS } from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CurrentMatch from './pages/CurrentMatch.jsx';
import MatchDay from './pages/MatchDay.jsx';
import Fielding from './pages/Fielding.jsx';
import Batting from './pages/Batting.jsx';
import Bowling from './pages/Bowling.jsx';
import GameNotes from './pages/GameNotes.jsx';
import Tips from './pages/Tips.jsx';
import Players from './pages/Players.jsx';
import History from './pages/History.jsx';
import Live from './pages/Live.jsx';
import Stats from './pages/Stats.jsx';
import { matchTitle } from './data/model.js';

const PAGES = {
  dashboard: Dashboard,
  match: CurrentMatch,
  matchday: MatchDay,
  fielding: Fielding,
  batting: Batting,
  bowling: Bowling,
  notes: GameNotes,
  tips: Tips,
  players: Players,
  history: History,
  live: Live,
  stats: Stats,
};

function Shell() {
  const store = useStore();
  // The app always opens on the Dashboard; the hash keeps the back gesture working.
  const [page, setPage] = useState('dashboard');
  const [params, setParams] = useState({});
  const [backupOpen, setBackupOpen] = useState(false);
  const [newMatchOpen, setNewMatchOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const contentKey = useRef(0);

  const go = useCallback((id, p = {}) => {
    setPage(id);
    setParams(p);
    contentKey.current++;
    try {
      if (location.hash.slice(1) !== id) history.pushState(null, '', '#' + id);
    } catch {
      /* ignore */
    }
    document.querySelector('.content')?.scrollTo?.(0, 0);
  }, []);

  useEffect(() => {
    try {
      history.replaceState(null, '', '#dashboard');
    } catch {
      /* ignore */
    }
    const onPop = () => {
      const id = location.hash.slice(1);
      if (PAGES[id]) {
        setPage(id);
        setParams({});
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        store.flush();
      } else if (k === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (k === 'n' && !e.shiftKey) {
        e.preventDefault();
        setNewMatchOpen(true);
      } else if (/^[1-9]$/.test(e.key) && !e.shiftKey && !e.altKey) {
        const item = NAV_ITEMS[Number(e.key) - 1];
        if (item) {
          e.preventDefault();
          go(item.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, go]);

  const Page = PAGES[page] || Dashboard;
  return (
    <NavContext.Provider value={{ page, go, params, openNewMatch: () => setNewMatchOpen(true), openBackup: () => setBackupOpen(true), openSearch: () => setSearchOpen(true) }}>
      <div className="app">
        <Sidebar onBackup={() => setBackupOpen(true)} onSearch={() => setSearchOpen(true)} />
        <main className="main">
          {store.isEditingPrevious && (
            <div className="banner">
              <PencilLine size={16} />
              <span className="banner-text">
                You are editing a previous match: <strong>{matchTitle(store.match)}</strong>. Changes are saved to that match only.
              </span>
              <span className="spacer" />
              <button className="btn sm" onClick={() => go('history', { open: store.match.id })}>
                Back to Match History
              </button>
              <button className="btn sm primary" onClick={() => store.setWorkingMatchId(null)}>
                Return to current match
              </button>
            </div>
          )}
          <Page key={page + (store.match?.id || '') + contentKey.current} />
          <MobileNav onSearch={() => setSearchOpen(true)} />
        </main>
      </div>
      {backupOpen && <BackupModal onClose={() => setBackupOpen(false)} />}
      {newMatchOpen && <NewMatchModal onClose={() => setNewMatchOpen(false)} />}
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
    </NavContext.Provider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <UIProvider>
        <Shell />
      </UIProvider>
    </StoreProvider>
  );
}

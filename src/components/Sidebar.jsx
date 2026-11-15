import {
  LayoutDashboard,
  Trophy,
  CloudSun,
  Crosshair,
  ListOrdered,
  CircleDot,
  NotebookPen,
  Lightbulb,
  Users,
  History,
  HardDriveDownload,
  Search,
} from 'lucide-react';
import { useNav } from './ui.jsx';
import { MatchSwitcher, MOD } from './Navigation.jsx';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'match', label: 'Current Match', icon: Trophy },
  { id: 'matchday', label: 'Match Day', icon: CloudSun },
  { id: 'fielding', label: 'Fielding Positions', icon: Crosshair },
  { id: 'batting', label: 'Batting Order', icon: ListOrdered },
  { id: 'bowling', label: 'Bowling Order', icon: CircleDot },
  { id: 'notes', label: 'Game Notes', icon: NotebookPen },
  { id: 'tips', label: 'Tips and Improvements', icon: Lightbulb },
  { id: 'players', label: 'Player Management', icon: Users },
  { id: 'history', label: 'Match History', icon: History },
];

function BallLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#c8392f" />
      <path d="M6.2 5.2c3 3.4 3 10.2 0 13.6M17.8 5.2c-3 3.4-3 10.2 0 13.6" stroke="#f3e6d6" strokeWidth="1.2" fill="none" strokeDasharray="1.6 1.4" />
    </svg>
  );
}

export default function Sidebar({ onBackup, onSearch }) {
  const { page, go } = useNav();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          <BallLogo />
        </div>
        <div>
          <div className="brand-name">Cricket Manager</div>
          <div className="brand-sub">Team &amp; match preparation</div>
        </div>
      </div>
      <button className="search-btn" onClick={onSearch}>
        <Search size={15} /> <span>Search</span> <kbd>{MOD}K</kbd>
      </button>
      <MatchSwitcher />
      <nav className="nav" aria-label="Main">
        {NAV_ITEMS.map((item, i) => (
          <div key={item.id}>
            {i === 1 && <div className="nav-section">Match</div>}
            {i === 6 && <div className="nav-section">Team &amp; records</div>}
            <button className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => go(item.id)} style={{ width: '100%' }} title={i < 9 ? `${item.label} (${MOD}${i + 1})` : item.label}>
              <item.icon size={17} strokeWidth={1.9} />
              {item.label}
            </button>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="nav-item" onClick={onBackup}>
          <HardDriveDownload size={17} strokeWidth={1.9} />
          Backup &amp; Restore
        </button>
      </div>
    </aside>
  );
}

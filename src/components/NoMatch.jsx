import { Trophy } from 'lucide-react';
import { Empty, useNav } from './ui.jsx';

export default function NoMatch({ what = 'this section' }) {
  const { openNewMatch, go } = useNav();
  return (
    <Empty
      icon={Trophy}
      title="No current match"
      action={
        <div className="row">
          <button className="btn primary" onClick={openNewMatch}>
            New Match
          </button>
          <button className="btn" onClick={() => go('history')}>
            View Match History
          </button>
        </div>
      }
    >
      Create a match to start using {what}. Each match keeps its own fielding setups, batting and bowling orders, Match Day preparation and notes.
    </Empty>
  );
}

import { useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { useStore, logActivity } from '../store.jsx';
import { Empty, PageHeader, Select, useNav } from '../components/ui.jsx';
import { NOTE_SECTIONS, formatDate, matchTitle, timeAgo } from '../data/model.js';

const words = (t) => (t || '').trim().split(/\s+/).filter(Boolean).length;

export default function GameNotes() {
  const { data, match, updateMatch } = useStore();
  const { openNewMatch } = useNav();
  const [selectedId, setSelectedId] = useState(match?.id || data.matches[data.matches.length - 1]?.id || '');
  const [section, setSection] = useState('general');
  const m = data.matches.find((x) => x.id === selectedId);

  const sorted = [...data.matches].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);

  if (!data.matches.length)
    return (
      <>
        <PageHeader title="Game Notes" />
        <div className="content">
          <Empty icon={NotebookPen} title="No matches yet" action={<button className="btn primary" onClick={openNewMatch}>New Match</button>}>
            Notes are saved against a match. Create a match to start writing.
          </Empty>
        </div>
      </>
    );

  const setNote = (value) =>
    updateMatch(m.id, (mm, draft) => {
      mm.notes[section] = value;
      mm.notesUpdatedAt = Date.now();
      logActivity(draft, { key: 'notes-' + m.id, type: 'notes', text: `Edited game notes for ${matchTitle(mm)}`, matchId: m.id, target: 'notes' });
    });
  const current = NOTE_SECTIONS.find((s) => s.id === section);

  return (
    <>
      <PageHeader title="Game Notes" subtitle="A notebook for every match — saved automatically">
        <div style={{ width: 300 }}>
          <Select
            aria-label="Match"
            value={selectedId}
            onChange={setSelectedId}
            options={sorted.map((x) => ({ value: x.id, label: `${matchTitle(x)}${x.date ? ' — ' + formatDate(x.date, { short: true }) : ''}${x.id === data.currentMatchId ? ' (current)' : ''}` }))}
          />
        </div>
      </PageHeader>
      <div className="content">
        {m && (
          <div className="stack">
            <div className="panel panel-pad row row-wrap" style={{ gap: "12px 28px" }}>
              <div>
                <div className="faint small">Match</div>
                <div style={{ fontWeight: 600 }}>{matchTitle(m)}</div>
              </div>
              <div>
                <div className="faint small">Date</div>
                <div>{m.date ? formatDate(m.date) : '—'}</div>
              </div>
              <div>
                <div className="faint small">Opposition</div>
                <div>{m.opposition || '—'}</div>
              </div>
              <div>
                <div className="faint small">Status</div>
                <div>{m.status}</div>
              </div>
              <span className="spacer" />
              <div className="faint small">{m.notesUpdatedAt ? `Last edited ${timeAgo(m.notesUpdatedAt)}` : 'No notes yet'}</div>
            </div>
            <div className="notes-layout">
              <nav className="notes-nav panel" style={{ padding: 6, alignSelf: 'start' }}>
                {NOTE_SECTIONS.map((s) => (
                  <button key={s.id} className={section === s.id ? 'on' : ''} onClick={() => setSection(s.id)}>
                    <span>{s.label}</span>
                    {words(m.notes[s.id]) > 0 && <span className="faint small">{words(m.notes[s.id])}</span>}
                  </button>
                ))}
              </nav>
              <div className="stack-sm">
                <div className="row">
                  <h2 style={{ fontSize: 16 }}>{current.label}</h2>
                  <span className="spacer" />
                  <span className="faint small">{words(m.notes[section])} words</span>
                </div>
                <textarea
                  className="textarea editor"
                  value={m.notes[section]}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={`Write about ${current.label.toLowerCase()}…`}
                  aria-label={current.label}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

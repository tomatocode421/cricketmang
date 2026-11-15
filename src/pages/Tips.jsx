import { useState } from 'react';
import { Lightbulb, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useStore, logActivity } from '../store.jsx';
import { Empty, Field, Modal, PageHeader, Select, useDialog, useNav, useToast } from '../components/ui.jsx';
import { TIP_CATEGORIES, TIP_STATUSES, matchTitle, timeAgo, uid } from '../data/model.js';

export const STATUS_STYLE = {
  'Not Started': { color: '#8a9490', tag: 'grey' },
  'In Progress': { color: '#e0a43a', tag: 'amber' },
  Completed: { color: '#37c477', tag: 'green' },
};

const blank = (matchId) => ({ title: '', description: '', category: 'General Improvements', notes: '', status: 'Not Started', matchId: matchId || '' });

export function TipCard({ t, data, onEdit, onDelete, onStatus }) {
  const mm = data.matches.find((m) => m.id === t.matchId);
  return (
    <div className="panel tip-card">
      <div className="row">
        <span className="tag grey">{t.category}</span>
        <span className="spacer" />
        {onStatus ? (
          <select className="select" style={{ width: 140, padding: '4px 28px 4px 10px', fontSize: 12.5, height: 28 }} value={t.status} onChange={(e) => onStatus(e.target.value)} aria-label="Status">
            {TIP_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        ) : (
          <span className={`tag ${STATUS_STYLE[t.status].tag}`}>{t.status}</span>
        )}
      </div>
      <h3 className="row" style={{ gap: 8 }}>
        <span className="status-dot" style={{ background: STATUS_STYLE[t.status].color }} />
        {t.title}
      </h3>
      {t.description && <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{t.description}</p>}
      {t.notes && <p className="faint small" style={{ whiteSpace: 'pre-wrap' }}>{t.notes}</p>}
      <div className="row faint small" style={{ marginTop: 4 }}>
        <span>{mm ? `Match: ${matchTitle(mm)} · ` : ''}Updated {timeAgo(t.updatedAt)}</span>
        <span className="spacer" />
        {onEdit && (
          <button className="btn ghost sm" onClick={onEdit}>
            <Pencil size={13} /> Edit
          </button>
        )}
        {onDelete && (
          <button className="btn ghost sm" onClick={onDelete} style={{ color: '#ff9c95' }}>
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default function Tips() {
  const { data, update, match } = useStore();
  const { confirm } = useDialog();
  const toast = useToast();
  const { params } = useNav();
  const [editing, setEditing] = useState(() => (params.add ? blank(match?.id) : null)); // tip object (with id or not)
  const [q, setQ] = useState(params.q || '');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');

  const save = () => {
    const t = editing;
    update((draft) => {
      if (t.id) {
        const i = draft.tips.findIndex((x) => x.id === t.id);
        draft.tips[i] = { ...t, updatedAt: Date.now() };
      } else {
        draft.tips.unshift({ ...t, id: uid('tip'), createdAt: Date.now(), updatedAt: Date.now() });
      }
      logActivity(draft, { key: 'tip-' + (t.id || t.title), type: 'tip', text: `${t.id ? 'Updated' : 'Added'} improvement "${t.title}"`, matchId: t.matchId || null, target: 'tips' });
    });
    toast(t.id ? 'Entry updated' : 'Entry added');
    setEditing(null);
  };
  const remove = async (t) => {
    const ok = await confirm({ title: 'Delete this entry?', message: `"${t.title}" will be permanently deleted.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    update((draft) => {
      draft.tips = draft.tips.filter((x) => x.id !== t.id);
    });
    toast('Entry deleted');
  };
  const setTipStatus = (t, s) =>
    update((draft) => {
      const x = draft.tips.find((y) => y.id === t.id);
      x.status = s;
      x.updatedAt = Date.now();
      logActivity(draft, { key: 'tip-' + t.id, type: 'tip', text: `"${t.title}" marked ${s}`, target: 'tips' });
    });

  const ql = q.trim().toLowerCase();
  const list = data.tips.filter(
    (t) => (!cat || t.category === cat) && (!status || t.status === status) && (!ql || [t.title, t.description, t.notes, t.category].join(' ').toLowerCase().includes(ql))
  );
  const counts = Object.fromEntries(TIP_STATUSES.map((s) => [s, data.tips.filter((t) => t.status === s).length]));

  return (
    <>
      <PageHeader title="Tips and Improvements" subtitle="Advice, cricket tips and areas the team is working on">
        <button className="btn primary" onClick={() => setEditing(blank(match?.id))}>
          <Plus size={16} /> Add New
        </button>
      </PageHeader>
      <div className="content">
        <div className="stack">
          <div className="row row-wrap">
            <div className="row" style={{ flex: '1 1 260px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--text-3)' }} />
              <input className="input" style={{ paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tips and improvements" aria-label="Search" />
            </div>
            <div style={{ width: 220 }}>
              <Select value={cat} onChange={setCat} placeholder="All categories" options={TIP_CATEGORIES} aria-label="Filter by category" />
            </div>
            <div className="seg">
              <button className={!status ? 'on' : ''} onClick={() => setStatus('')}>
                All ({data.tips.length})
              </button>
              {TIP_STATUSES.map((s) => (
                <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>
                  <span className="status-dot" style={{ background: STATUS_STYLE[s].color, marginRight: 6 }} />
                  {s} ({counts[s]})
                </button>
              ))}
            </div>
          </div>

          {data.tips.length === 0 ? (
            <Empty icon={Lightbulb} title="No tips or improvements yet" action={<button className="btn primary" onClick={() => setEditing(blank(match?.id))}><Plus size={15} /> Add New</button>}>
              Record advice, useful cricket tips and the areas the team needs to work on, then track progress from Not Started to Completed.
            </Empty>
          ) : list.length === 0 ? (
            <Empty icon={Search} title="Nothing matches">
              Try a different search or clear the filters.
            </Empty>
          ) : (
            <div className="grid grid-3" style={{ alignItems: 'start' }}>
              {list.map((t) => (
                <TipCard key={t.id} t={t} data={data} onEdit={() => setEditing({ ...t })} onDelete={() => remove(t)} onStatus={(s) => setTipStatus(t, s)} />
              ))}
            </div>
          )}
        </div>
      </div>
      {editing && (
        <Modal
          title={editing.id ? 'Edit entry' : 'Add new tip or improvement'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn primary" disabled={!editing.title.trim()} onClick={save}>
                {editing.id ? 'Save changes' : 'Add entry'}
              </button>
            </>
          }
        >
          <div className="stack">
            <Field label="Title">
              <input className="input" autoFocus value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Back up throws at the stumps" />
            </Field>
            <Field label="Description">
              <textarea className="textarea" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>
            <div className="grid grid-2">
              <Field label="Category">
                <Select value={editing.category} onChange={(v) => setEditing({ ...editing, category: v })} options={TIP_CATEGORIES} />
              </Field>
              <Field label="Improvement status">
                <Select value={editing.status} onChange={(v) => setEditing({ ...editing, status: v })} options={TIP_STATUSES} />
              </Field>
            </div>
            <Field label="Linked match (optional)">
              <Select
                value={editing.matchId}
                onChange={(v) => setEditing({ ...editing, matchId: v })}
                placeholder="Not linked to a match"
                options={data.matches.map((m) => ({ value: m.id, label: matchTitle(m) }))}
              />
            </Field>
            <Field label="Additional notes (optional)">
              <textarea className="textarea" style={{ minHeight: 70 }} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}

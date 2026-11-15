import { useEffect, useRef, useState } from 'react';
import { Download, Upload, FolderOpen } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Modal, useDialog, useToast } from './ui.jsx';

const isValidBackup = (d) => d && typeof d === 'object' && Array.isArray(d.players) && Array.isArray(d.matches);

export default function BackupModal({ onClose }) {
  const { data, replaceAll, flush } = useStore();
  const { confirm } = useDialog();
  const toast = useToast();
  const [location, setLocation] = useState('');
  const fileInput = useRef();

  useEffect(() => {
    window.desktop?.dataLocation?.().then(setLocation);
  }, []);

  const exportBackup = async () => {
    await flush();
    const payload = { ...data, exportedAt: Date.now(), app: 'Cricket Team Manager' };
    if (window.desktop?.exportBackup) {
      const res = await window.desktop.exportBackup(payload);
      if (res.ok) toast('Backup saved');
      return;
    }
    const name = `Cricket-Backup-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    // iPhone / iPad: open the share sheet (Save to Files, AirDrop to your Mac, Mail…).
    try {
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Cricket Team Manager backup' });
        toast('Backup shared');
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup downloaded');
  };

  const restoreFrom = async (backup) => {
    if (!isValidBackup(backup)) {
      toast('That file is not a valid Cricket Team Manager backup.', { tone: 'error' });
      return;
    }
    const when = backup.exportedAt || backup.savedAt;
    const ok = await confirm({
      title: 'Restore this backup?',
      message: `This will replace ALL of your current information (players, ${data.matches.length} matches, ${data.tips.length} tips) with the backup${
        when ? ` from ${new Date(when).toLocaleString()}` : ''
      } containing ${backup.matches.length} matches and ${backup.tips?.length || 0} tips.\n\nTip: save a backup of your current data first if you might want it later.`,
      confirmLabel: 'Replace my data',
      danger: true,
    });
    if (!ok) return;
    const { exportedAt, app, ...rest } = backup;
    replaceAll(rest);
    toast('Backup restored');
    onClose();
  };

  const importBackup = async () => {
    if (window.desktop?.importBackup) {
      const res = await window.desktop.importBackup();
      if (res.canceled) return;
      if (!res.ok) return toast(res.error || 'Could not read that file.', { tone: 'error' });
      return restoreFrom(res.data);
    }
    fileInput.current.click();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      restoreFrom(JSON.parse(await file.text()));
    } catch {
      toast('That file is not a valid backup.', { tone: 'error' });
    }
  };

  return (
    <Modal title="Backup & Restore" onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="stack">
        <p className="muted">
          Everything is saved automatically on this Mac. Create a backup file to keep a copy somewhere safe (for example iCloud Drive or a USB stick), and restore it later if needed.
        </p>
        <div className="panel panel-pad row" style={{ background: 'var(--panel-2)' }}>
          <Download size={20} color="var(--green-soft)" />
          <div style={{ flex: 1 }}>
            <strong>Create a backup</strong>
            <div className="muted small">Saves all players, matches, notes and tips to a single file.</div>
          </div>
          <button className="btn primary" onClick={exportBackup}>
            Save backup…
          </button>
        </div>
        <div className="panel panel-pad row" style={{ background: 'var(--panel-2)' }}>
          <Upload size={20} color="var(--amber)" />
          <div style={{ flex: 1 }}>
            <strong>Restore from a backup</strong>
            <div className="muted small">Replaces your current information. You will be asked to confirm.</div>
          </div>
          <button className="btn" onClick={importBackup}>
            Choose file…
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onFile} />
        </div>
        <p className="faint small">
          To move your information between your Mac and iPhone, save a backup on one (on iPhone you can AirDrop it or save it to Files) and restore it on the other.
        </p>
        {location && (
          <p className="faint small row">
            <FolderOpen size={14} /> Data file: {location}
          </p>
        )}
        {data.savedAt && <p className="faint small">Last saved {new Date(data.savedAt).toLocaleString()}</p>}
      </div>
    </Modal>
  );
}

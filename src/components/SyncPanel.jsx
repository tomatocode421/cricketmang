import { useState } from 'react';
import { Cloud, CloudOff, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Field, useDialog, useToast } from './ui.jsx';
import { connect, getSyncConfig } from '../lib/sync.js';
import { timeAgo } from '../data/model.js';
import { openExternal } from '../lib/net.js';

const link = (url, text) => (
  <a href={url} onClick={(e) => (e.preventDefault(), openExternal(url))}>
    {text} <ExternalLink size={11} style={{ verticalAlign: -1 }} />
  </a>
);

export function syncLabel(sync) {
  if (!sync.enabled) return '';
  if (sync.state === 'syncing') return 'Syncing…';
  if (sync.state === 'offline') return 'Offline — will sync later';
  if (sync.state === 'error') return 'Sync problem';
  if (sync.lastSync) return 'Synced';
  return 'Sync on';
}

export default function SyncPanel() {
  const { sync, syncNow, connectSync, disconnectSync } = useStore();
  const { confirm } = useDialog();
  const toast = useToast();
  const cfg = getSyncConfig();
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState('cricket-data');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const doConnect = async () => {
    setBusy(true);
    setError('');
    try {
      const c = await connect({ token, repo });
      await connectSync(c);
      setToken('');
      toast('Sync is on for this device');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const doDisconnect = async () => {
    const ok = await confirm({
      title: 'Turn off sync on this device?',
      message: 'Your information stays on this device, but changes will no longer be shared with your other devices. The access key is removed from this device.',
      confirmLabel: 'Turn off sync',
    });
    if (ok) disconnectSync();
  };

  if (cfg && sync.enabled) {
    return (
      <div className="panel panel-pad stack-sm" style={{ background: 'var(--panel-2)' }}>
        <div className="row">
          <Cloud size={20} color={sync.state === 'error' ? 'var(--red)' : 'var(--green-soft)'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>Sync between devices is on</strong>
            <div className="muted small" style={{ wordBreak: 'break-all' }}>
              Private repository: {cfg.repo}
            </div>
          </div>
        </div>
        <div className="small" style={{ color: sync.state === 'error' ? '#ff9c95' : 'var(--text-2)' }}>
          {sync.state === 'syncing'
            ? 'Syncing…'
            : sync.state === 'pending'
              ? 'Changes waiting to sync…'
            : sync.state === 'error' || sync.state === 'offline'
              ? sync.error
              : sync.lastSync
                ? `Up to date · last synced ${timeAgo(sync.lastSync)}`
                : 'Waiting to sync'}
        </div>
        <div className="row row-wrap">
          <button className="btn sm" onClick={syncNow} disabled={sync.state === 'syncing'}>
            {sync.state === 'syncing' ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Sync now
          </button>
          <button className="btn sm ghost" onClick={doDisconnect}>
            <CloudOff size={14} /> Turn off on this device
          </button>
        </div>
        <p className="faint small">Changes appear on your other devices within a few seconds of them opening the app. Each device keeps its own copy, so it still works offline.</p>
      </div>
    );
  }

  return (
    <div className="panel panel-pad stack-sm" style={{ background: 'var(--panel-2)' }}>
      <div className="row">
        <Cloud size={20} color="var(--blue)" />
        <div style={{ flex: 1 }}>
          <strong>Sync between your Mac and iPhone</strong>
          <div className="muted small">Keeps every device up to date using a private GitHub repository that only you can see.</div>
        </div>
      </div>
      <ol className="reason-list sync-steps">
        <li>
          {link('https://github.com/new', 'Create a new repository')} named <strong>cricket-data</strong> and choose <strong>Private</strong>.
        </li>
        <li>
          {link('https://github.com/settings/personal-access-tokens/new', 'Create an access key')} (a “fine-grained token”): under <strong>Repository access</strong> choose <strong>Only select repositories → cricket-data</strong>; under <strong>Permissions → Repository permissions</strong> set <strong>Contents</strong> to <strong>Read and write</strong>. Generate it and copy it.
        </li>
        <li>Paste it below, then do the same on your other device (you can use the same key).</li>
      </ol>
      <Field label="Access key">
        <input className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" aria-label="Access key" />
      </Field>
      <Field label="Repository" hint="Just the name is fine, e.g. cricket-data">
        <input className="input" value={repo} onChange={(e) => setRepo(e.target.value)} aria-label="Repository" autoCapitalize="none" autoCorrect="off" />
      </Field>
      {error && <div className="callout danger small">{error}</div>}
      <div className="row">
        <button className="btn primary" onClick={doConnect} disabled={!token.trim() || !repo.trim() || busy}>
          {busy ? <Loader2 size={15} className="spin" /> : <Cloud size={15} />} Turn on sync
        </button>
      </div>
      <p className="faint small">The key is stored only on this device and never included in backups. Your information is combined, not overwritten: if both devices have changes, each match and tip keeps its newest version.</p>
    </div>
  );
}

// Sync through a private GitHub repository the user owns.
// The data lives in one file, cricket-data.json. The access key is kept only on
// this device and is never included in backups or in the synced file.

const KEY = 'cricket-sync-config';
export const SYNC_FILE = 'cricket-data.json';

export function getSyncConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    return c && c.token && c.repo ? c : null;
  } catch {
    return null;
  }
}
export function setSyncConfig(c) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export class SyncError extends Error {
  constructor(message, { status, conflict, offline } = {}) {
    super(message);
    this.status = status;
    this.conflict = !!conflict;
    this.offline = !!offline;
  }
}

async function api(cfg, path, { method = 'GET', body } = {}) {
  const sep = path.includes('?') ? '&' : '?';
  // A changing query stops the browser serving an old cached copy.
  const url = `https://api.github.com${path}${method === 'GET' ? `${sep}_=${Date.now()}` : ''}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new SyncError('No internet connection — changes are saved on this device and will sync later.', { offline: true });
  }
  return res;
}

const describe = (status) =>
  status === 401
    ? 'The access key was not accepted. It may have expired — create a new one and reconnect.'
    : status === 403
      ? 'The access key does not have permission to change this repository. Give it "Contents: Read and write".'
      : status === 404
        ? 'Repository not found. Check the name and that the access key includes this repository.'
        : `GitHub returned an error (${status}).`;

// UTF-8 safe base64 that also works on older Safari.
const toBase64 = (str) => btoa(unescape(encodeURIComponent(str)));
const fromBase64 = (b64) => decodeURIComponent(escape(atob(String(b64).replace(/\s/g, ''))));

// Work out the full "owner/name" and check the repository is private.
export async function connect({ token, repo }) {
  const cfg = { token: token.trim(), repo: repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '') };
  if (!cfg.repo.includes('/')) {
    const me = await api(cfg, '/user');
    if (!me.ok) throw new SyncError(describe(me.status), { status: me.status });
    cfg.repo = `${(await me.json()).login}/${cfg.repo}`;
  }
  const res = await api(cfg, `/repos/${cfg.repo}`);
  if (!res.ok) throw new SyncError(describe(res.status), { status: res.status });
  const info = await res.json();
  if (!info.private) throw new SyncError('This repository is public, so anyone could read your team information. Use a private repository.');
  return cfg;
}

export async function readRemote(cfg) {
  const res = await api(cfg, `/repos/${cfg.repo}/contents/${SYNC_FILE}`);
  if (res.status === 404) return { data: null, sha: null };
  if (!res.ok) throw new SyncError(describe(res.status), { status: res.status });
  const file = await res.json();
  let text;
  if (file.content && file.encoding === 'base64') text = fromBase64(file.content);
  else {
    // Files over 1 MB come without content; fetch them raw.
    const raw = await fetch(file.download_url, { cache: 'no-store', headers: { Authorization: `Bearer ${cfg.token}` } });
    text = await raw.text();
  }
  return { data: JSON.parse(text), sha: file.sha };
}

export async function writeRemote(cfg, data, sha, device) {
  const res = await api(cfg, `/repos/${cfg.repo}/contents/${SYNC_FILE}`, {
    method: 'PUT',
    body: { message: `Sync from ${device}`, content: toBase64(JSON.stringify(data, null, 1)), ...(sha ? { sha } : {}) },
  });
  if (res.status === 409 || res.status === 422) throw new SyncError('Changed on another device', { status: res.status, conflict: true });
  if (!res.ok) throw new SyncError(describe(res.status), { status: res.status });
  return (await res.json()).content?.sha || null;
}

export const deviceName = () => {
  if (typeof window !== 'undefined' && window.desktop) return 'Mac';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Mac/.test(ua) ? 'Mac' : 'browser';
};

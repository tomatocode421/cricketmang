import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initialData, normaliseData, uid } from './data/model.js';
import { mergeData, sameData, stamp } from './data/merge.js';
import { deviceName, getSyncConfig, readRemote, setSyncConfig, writeRemote } from './lib/sync.js';

const STORAGE_KEY = 'cricket-team-manager-data';
const StoreContext = createContext(null);

const storage = {
  async load() {
    if (window.desktop?.loadData) return window.desktop.loadData();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  async save(data) {
    if (window.desktop?.saveData) return window.desktop.saveData(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  },
  saveSync(data) {
    if (window.desktop?.saveDataSync) return window.desktop.saveDataSync(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  },
};

// Add an entry to the recent activity log. Repeated edits to the same thing
// within 10 minutes update the existing entry rather than flooding the log.
export function logActivity(draft, { key, type, text, matchId = null, target = null }) {
  const now = Date.now();
  const existing = draft.activity.find((a) => a.key === key);
  if (existing && now - existing.ts < 10 * 60 * 1000) {
    existing.ts = now;
    existing.text = text;
    draft.activity = [existing, ...draft.activity.filter((a) => a !== existing)];
  } else {
    draft.activity.unshift({ id: uid('act'), key, type, text, matchId, target, ts: now });
  }
  draft.activity = draft.activity.slice(0, 60);
}

export function StoreProvider({ children }) {
  const [data, setData] = useState(null);
  const [saveState, setSaveState] = useState('saved');
  const [workingMatchId, setWorkingMatchId] = useState(null);
  const latest = useRef(null);
  const dirty = useRef(false);
  const timer = useRef(null);
  const loaded = useRef(false);

  // ---------- Sync between devices ----------
  const [sync, setSync] = useState(() => ({ enabled: !!getSyncConfig(), state: 'idle', lastSync: null, error: '' }));
  const syncBusy = useRef(false);
  const syncAgain = useRef(false);
  const syncTimer = useRef(null);
  const forcePush = useRef(false);
  const syncRef = useRef(() => {});
  const scheduleSync = useCallback((delay = 2000) => {
    if (!getSyncConfig()) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => syncRef.current(), delay);
  }, []);

  // Merge another device's copy into the newest local copy (so nothing typed meanwhile is lost).
  const applyRemote = useCallback(async (remoteData) => {
    const merged = mergeData(latest.current, remoteData);
    if (!sameData(merged, latest.current)) {
      latest.current = merged;
      setData(merged);
      await storage.save({ ...merged, savedAt: Date.now() });
    }
    return merged;
  }, []);

  const syncNow = useCallback(async () => {
    const cfg = getSyncConfig();
    if (!cfg || !latest.current) return;
    if (syncBusy.current) {
      syncAgain.current = true;
      return;
    }
    syncBusy.current = true;
    setSync((x) => ({ ...x, enabled: true, state: 'syncing', error: '' }));
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await readRemote(cfg);
        const remoteData = remote.data ? normaliseData(remote.data) : null;
        const merged = forcePush.current || !remoteData ? latest.current : await applyRemote(remoteData);
        if (!remoteData || forcePush.current || !sameData(merged, remoteData)) {
          try {
            await writeRemote(cfg, { ...merged, savedAt: Date.now() }, remote.sha, deviceName());
          } catch (err) {
            if (err.conflict && attempt < 2) continue;
            throw err;
          }
        }
        forcePush.current = false;
        break;
      }
      setSync((x) => ({ ...x, state: 'synced', lastSync: Date.now(), error: '' }));
    } catch (err) {
      setSync((x) => ({ ...x, state: err.offline ? 'offline' : 'error', error: err.message || 'Sync failed' }));
    } finally {
      syncBusy.current = false;
      if (syncAgain.current) {
        syncAgain.current = false;
        scheduleSync(800);
      }
    }
  }, [applyRemote, scheduleSync]);
  syncRef.current = syncNow;

  const connectSync = useCallback(
    async (cfg) => {
      setSyncConfig(cfg);
      setSync({ enabled: true, state: 'idle', lastSync: null, error: '' });
      await syncNow();
    },
    [syncNow]
  );
  const disconnectSync = useCallback(() => {
    setSyncConfig(null);
    clearTimeout(syncTimer.current);
    setSync({ enabled: false, state: 'idle', lastSync: null, error: '' });
  }, []);

  // Check for changes from other devices: on start, every 45 s, and whenever the app comes back into view.
  useEffect(() => {
    const onShow = () => document.visibilityState !== 'hidden' && scheduleSync(300);
    const tick = setInterval(() => document.visibilityState !== 'hidden' && scheduleSync(0), 45000);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    window.addEventListener('online', onShow);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
      window.removeEventListener('online', onShow);
    };
  }, [scheduleSync]);

  useEffect(() => {
    storage.load().then((raw) => {
      const d = normaliseData(raw);
      latest.current = d;
      setData(d);
      loaded.current = true;
      scheduleSync(300);
    });
  }, [scheduleSync]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!dirty.current || !latest.current) return;
    dirty.current = false;
    setSaveState('saving');
    try {
      const toSave = { ...latest.current, savedAt: Date.now() };
      await storage.save(toSave);
      setSaveState(dirty.current ? 'unsaved' : 'saved');
      if (getSyncConfig()) {
        setSync((x) => (x.state === 'syncing' ? x : { ...x, state: 'pending' }));
        scheduleSync(2500);
      }
    } catch (err) {
      console.error(err);
      dirty.current = true;
      setSaveState('error');
    }
  }, [scheduleSync]);

  useEffect(() => {
    const onUnload = () => {
      if (dirty.current && latest.current) storage.saveSync({ ...latest.current, savedAt: Date.now() });
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // update(recipe): recipe receives a deep copy it may mutate (or return a new value).
  const update = useCallback(
    (recipe) => {
      setData((prev) => {
        const draft = structuredClone(prev);
        const result = recipe(draft);
        const next = stamp(prev, result || draft);
        latest.current = next;
        return next;
      });
      dirty.current = true;
      setSaveState('unsaved');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 600);
    },
    [flush]
  );

  const replaceAll = useCallback(
    (raw) => {
      const d = normaliseData(raw);
      latest.current = d;
      setData(d);
      setWorkingMatchId(null);
      // A restored backup replaces the synced copy too, rather than being merged with it.
      if (getSyncConfig()) forcePush.current = true;
      dirty.current = true;
      flush();
    },
    [flush]
  );

  const value = useMemo(() => {
    if (!data) return null;
    const matchId = workingMatchId && data.matches.some((m) => m.id === workingMatchId) ? workingMatchId : data.currentMatchId;
    const match = data.matches.find((m) => m.id === matchId) || null;
    const updateMatch = (id, recipe) =>
      update((draft) => {
        const m = draft.matches.find((x) => x.id === id);
        if (!m) return;
        recipe(m, draft);
        m.updatedAt = Date.now();
      });
    return {
      data,
      update,
      replaceAll,
      flush,
      saveState,
      match,
      isEditingPrevious: !!(workingMatchId && match && match.id !== data.currentMatchId),
      workingMatchId,
      setWorkingMatchId,
      updateMatch,
      updateActive: (recipe) => match && updateMatch(match.id, recipe),
      sync,
      syncNow,
      connectSync,
      disconnectSync,
    };
  }, [data, update, replaceAll, flush, saveState, workingMatchId, sync, syncNow, connectSync, disconnectSync]);

  if (!value) {
    return (
      <div className="loading-screen">
        <div className="loading-ball" />
        <p>Loading your team…</p>
      </div>
    );
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);
export { initialData };

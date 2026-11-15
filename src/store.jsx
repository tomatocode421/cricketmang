import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initialData, normaliseData, uid } from './data/model.js';

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

  useEffect(() => {
    storage.load().then((raw) => {
      const d = normaliseData(raw);
      latest.current = d;
      setData(d);
      loaded.current = true;
    });
  }, []);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!dirty.current || !latest.current) return;
    dirty.current = false;
    setSaveState('saving');
    try {
      const toSave = { ...latest.current, savedAt: Date.now() };
      await storage.save(toSave);
      setSaveState(dirty.current ? 'unsaved' : 'saved');
    } catch (err) {
      console.error(err);
      dirty.current = true;
      setSaveState('error');
    }
  }, []);

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
        const next = result || draft;
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
    };
  }, [data, update, replaceAll, flush, saveState, workingMatchId]);

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

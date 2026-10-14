import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as api from "./api.js";
import { DEFAULT_SETTINGS, computeStats } from "./utils.js";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("cs.settings") || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function AppProvider({ children }) {
  const [settings, setSettingsState] = useState(loadSettings);
  const [models, setModels] = useState(null);
  const [eda, setEda] = useState(null);
  const [runs, setRuns] = useState([]);
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [apiDown, setApiDown] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [pendingQuery, setPendingQuery] = useState("");

  const toast = useCallback((text, tone = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const setSettings = useCallback((patch) => {
    setSettingsState((s) => {
      const next = { ...s, ...patch };
      try { localStorage.setItem("cs.settings", JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const refreshRuns = useCallback(() => api.getRuns().then(setRuns).catch(() => {}), []);

  const openRun = useCallback(async (id) => {
    setBusy(true);
    try { setRun(await api.getRun(id)); setError(""); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, []);

  // Runs load once; models and dataset stats reload whenever the model family changes.
  // Both retry while the API is unreachable (e.g. it is restarting).
  useEffect(() => {
    let timer;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await api.getRuns();
        if (cancelled) return;
        setRuns(r); setApiDown(false);
        if (r[0]) openRun(r[0].id);
      } catch {
        if (cancelled) return;
        setApiDown(true);
        timer = setTimeout(tick, 3000);
      }
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [openRun]);

  const family = settings.family;
  useEffect(() => {
    let timer;
    let cancelled = false;
    setModels(null); setEda(null);
    const tick = async () => {
      try {
        const [m, e] = await Promise.all([api.getModels(family), api.getEda(family)]);
        if (cancelled) return;
        setModels(m); setEda(e); setApiDown(false);
      } catch {
        if (cancelled) return;
        setApiDown(true);
        timer = setTimeout(tick, 3000);
      }
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [family]);

  // Runs an analysis call, then loads the persisted run so every page sees one shape.
  const analyze = useCallback(async (fn) => {
    setBusy(true);
    setError("");
    try {
      const res = await fn();
      await refreshRuns();
      setRun(await api.getRun(res.run_id));
      toast("Analysis complete", "good");
      return res.run_id;
    } catch (e) {
      setError(e.message);
      toast(e.message, "bad");
      return null;
    } finally {
      setBusy(false);
    }
  }, [refreshRuns, toast]);

  const removeRun = useCallback(async (id) => {
    await api.deleteRun(id);
    if (run?.id === id) setRun(null);
    refreshRuns();
    toast(`Deleted run #${id}`);
  }, [run, refreshRuns, toast]);

  // The most recent earlier run of the same project scored by the same family and model, so trend deltas compare like with like.
  const prevRun = useMemo(() => (run ? runs.filter((r) => r.name === run.name && r.id < run.id && r.model === run.model
    && r.summary.family === run.summary.family).sort((a, b) => b.id - a.id)[0] ?? null : null), [runs, run]);

  // Effective settings. A run is judged by the thresholds of the family that scored it; a custom
  // threshold only applies to runs of the currently selected family (probabilities differ across families).
  const runFamily = run?.summary?.family;
  const runThr = run?.summary?.risk_thresholds;
  const sameFamily = !runFamily || runFamily === settings.family;
  const effective = useMemo(() => {
    // Calibrated thresholds: this family's when the run matches it, otherwise the ones saved with the run.
    const calibrated = (sameFamily ? models?.risk_thresholds : runThr) ?? runThr ?? { high: 0.4, medium: 0.25 };
    const custom = sameFamily ? settings : {};
    return {
      ...settings,
      // A model chosen under another family may not exist here; fall back to the family default.
      model: models && models.leaderboard.some((m) => m.model === settings.model) ? settings.model : "",
      high: custom.high ?? calibrated.high,
      medium: custom.medium ?? calibrated.medium,
    };
  }, [settings, models, runThr, sameFamily]);
  const stats = useMemo(() => (run ? computeStats(run, effective) : null), [run, effective]);
  const activeModel = settings.model || models?.default_model || "";

  const value = { settings: effective, rawSettings: settings, setSettings, models, eda, runs, run, stats, busy, error, setError, apiDown,
    analyze, openRun, removeRun, refreshRuns, activeModel, toasts, toast, dismissToast, pendingQuery, setPendingQuery, prevRun };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

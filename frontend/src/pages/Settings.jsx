import { useApp } from "../state.jsx";
import { PageHeader, Panel } from "../components/ui.jsx";
import { DEFAULT_SETTINGS, FAMILY_INFO, modelLabel, pct } from "../utils.js";

const Row = ({ label, hint, children }) => (
  <div className="setting"><div><b>{label}</b><p className="muted small">{hint}</p></div><div className="setting-ctl">{children}</div></div>
);

export default function Settings() {
  const { settings: s, rawSettings: raw, setSettings, models } = useApp();
  return (
    <>
      <PageHeader title="Settings" subtitle="Tune how risk is presented. Stored in this browser only."
        actions={<button className="btn" onClick={() => setSettings(DEFAULT_SETTINGS)}>Reset to defaults</button>} />
      <div className="grid g-2">
        <Panel title="Risk thresholds" subtitle="Applied instantly to every page"
          actions={(raw.high != null || raw.medium != null) && <button className="link" onClick={() => setSettings({ high: null, medium: null })}>Use calibrated</button>}>
          <p className="muted small" style={{ marginBottom: 6 }}>
            {raw.high == null && raw.medium == null
              ? "Calibrated to this model family: the riskiest 5% of training functions are high, the next 10% medium."
              : "Custom thresholds in use."}</p>
          <Row label="High risk at or above" hint="Functions at or above this probability are flagged high. ">
            <input type="range" min="0.02" max="0.95" step="0.01" value={s.high} onChange={(e) => setSettings({ high: Math.max(+e.target.value, s.medium + 0.01) })} aria-label="High threshold" />
            <b>{pct(s.high, 1)}</b></Row>
          <Row label="Medium risk at or above" hint="Between this and the high threshold is medium.">
            <input type="range" min="0.01" max="0.9" step="0.01" value={s.medium} onChange={(e) => setSettings({ medium: Math.min(+e.target.value, s.high - 0.01) })} aria-label="Medium threshold" />
            <b>{pct(s.medium, 1)}</b></Row>
          <Row label="Minimum function size" hint="Ignore functions shorter than this many lines (trivial getters skew averages).">
            <input type="number" className="input sm" min="1" max="50" value={s.minLoc} onChange={(e) => setSettings({ minLoc: Math.max(1, +e.target.value || 1) })} aria-label="Minimum LOC" /></Row>
        </Panel>
        <Panel title="Model & appearance">
          <Row label="Model family" hint={FAMILY_INFO[s.family]?.blurb}>
            <div className="seg">{Object.entries(FAMILY_INFO).map(([id, f]) => (
              <button key={id} className={s.family === id ? "active" : ""} onClick={() => setSettings({ family: id })}>{f.label}</button>))}</div></Row>
          <Row label="Default model" hint="Used for new analyses.">
            <select className="input" value={s.model} onChange={(e) => setSettings({ model: e.target.value })} aria-label="Default model">
              <option value="">Best cross-project ({modelLabel(models?.default_model ?? "…")})</option>
              {models?.leaderboard.map((m) => <option key={m.model} value={m.model}>{modelLabel(m.model)}</option>)}
            </select></Row>
          <Row label="Theme" hint="Dark or light interface.">
            <div className="seg">{["dark", "light"].map((t) => <button key={t} className={s.theme === t ? "active" : ""} onClick={() => setSettings({ theme: t })}>{t}</button>)}</div></Row>
        </Panel>
      </div>
      <Panel title="About & limitations" className="mt">
        <ul className="recs plain">
          <li><b>Python-native</b> models learn from functions in 12 open-source Python repos. The label is "a bug-fix commit touched this function within 12 months", found by commit-message heuristics, so it is noisy.</li>
          <li><b>NASA</b> models learn from C/C++ modules. Applied to Python they are out of domain; treat those scores as a rough ranking only.</li>
          <li>Scores are a <b>relative ranking</b> for prioritising review, not calibrated probabilities. Metrics-only models have a low accuracy ceiling.</li>
        </ul>
      </Panel>
    </>
  );
}

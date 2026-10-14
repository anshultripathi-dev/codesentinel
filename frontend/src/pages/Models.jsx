import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trophy } from "lucide-react";
import * as api from "../api.js";
import { useApp } from "../state.jsx";
import { ChartTooltip, Empty, Heatmap, PageHeader, Panel, Tabs } from "../components/ui.jsx";
import { FAMILY_INFO, featLabel, fix, modelLabel, num, pct } from "../utils.js";

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#a855f7", "#14b8a6"];
const seq = (v) => `rgba(99,102,241,${0.1 + Math.max(0, Math.min(1, (v - 0.55) / 0.25)) * 0.8})`;

function Confusion({ c }) {
  const total = c.tn + c.fp + c.fn + c.tp;
  const cell = (v, label, good) => (
    <div className={`cm ${good ? "good" : "bad"}`}><b>{num(v)}</b><span>{label}</span><small>{pct(v / total, 1)}</small></div>
  );
  return (
    <div className="cm-grid">
      {cell(c.tn, "True negative", true)}{cell(c.fp, "False positive", false)}
      {cell(c.fn, "False negative", false)}{cell(c.tp, "True positive", true)}
    </div>
  );
}

export default function Models() {
  const { models, run } = useApp();
  const [tab, setTab] = useState("board");
  const [mode, setMode] = useState("cross_project");
  const [sel, setSel] = useState(null);
  const [sortKey, setSortKey] = useState("auc");
  const [agree, setAgree] = useState(null);

  useEffect(() => { if (models && !sel) setSel(models.default_model); }, [models, sel]);
  useEffect(() => { setAgree(null); if (run && tab === "agree") api.compareRun(run.id).then(setAgree).catch(() => {}); }, [run, tab]);

  // Temporal has no ROC / confusion matrix, so those tabs fall back to cross-project.
  const curveMode = mode === "temporal" ? "cross_project" : mode;
  const hasTemporal = !!models?.leaderboard.some((m) => m.temporal);
  useEffect(() => { if (models && mode === "temporal" && !hasTemporal) setMode("cross_project"); }, [models, mode, hasTemporal]);

  const rows = useMemo(() => models?.leaderboard.filter((m) => m[mode]).map((m) => {
    const s = m[mode];
    return { model: m.model, auc: mode === "cross_project" ? s.auc_per_project_mean : s.auc, pr: s.pr_auc, r10: s.recall_at_10pct,
      f1: s.f1, mcc: s.mcc, precision: s.precision, recall: s.recall, thr: m.threshold };
  }).sort((a, b) => b[sortKey] - a[sortKey]), [models, mode, sortKey]);

  const roc = useMemo(() => {
    if (!models) return [];
    const key = curveMode === "cross_project" ? "roc_cross" : "roc_within";
    return models.leaderboard[0][key].fpr.map((x, i) => {
      const row = { fpr: x, chance: x };
      models.leaderboard.forEach((m) => { row[m.model] = m[key].tpr[i]; });
      return row;
    });
  }, [models, curveMode]);

  if (!models) return <><PageHeader title="Models" /><Panel><Empty title="Loading models…" text="Requires the API to be running." /></Panel></>;
  const chosen = models.leaderboard.find((m) => m.model === sel) ?? models.leaderboard[0];
  const fi = models.feature_importance;
  const fiData = Object.keys(fi.random_forest).map((k) => ({ f: k, rf: +fi.random_forest[k].toFixed(3), lr: +fi.logistic_regression[k].toFixed(3) }))
    .sort((a, b) => b.rf - a.rf);
  const projects = models.projects;
  const th = (k, l) => <th className={`sortable r ${sortKey === k ? "on" : ""}`} onClick={() => setSortKey(k)}>{l}{sortKey === k ? " ▾" : ""}</th>;

  return (
    <>
      <PageHeader title="Models" subtitle={`${FAMILY_INFO[models.family]?.label ?? models.family} family · seven algorithms benchmarked on ${models.n_modules.toLocaleString()} ${models.family === "python" ? "functions" : "modules"}`}
        actions={<div className="seg">
          <button className={mode === "cross_project" ? "active" : ""} onClick={() => setMode("cross_project")}>Cross-project</button>
          <button className={mode === "within_project" ? "active" : ""} onClick={() => setMode("within_project")}>Within-project</button>
          {hasTemporal && <button className={mode === "temporal" ? "active" : ""} onClick={() => setMode("temporal")}>Temporal</button>}</div>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "board", label: "Leaderboard" }, { id: "roc", label: "ROC & confusion" },
        { id: "feat", label: "Feature importance" }, { id: "proj", label: "Per project" }, { id: "agree", label: "Agreement" }]} />

      {tab === "board" && (
        <>
          <Panel pad={false} title="Leaderboard" subtitle={mode === "cross_project" ? "Train on all repos but one, test on the held-out repo (mean AUC per repo)"
              : mode === "temporal" ? "Train on early snapshots, test on later ones" : "Grouped 5-fold CV: no file appears in both train and test"}>
            <table className="table hover">
              <thead><tr><th>#</th><th>Model</th>{th("auc", "AUC")}{th("pr", "PR-AUC")}{th("r10", "Recall@10%")}{th("f1", "F1")}{th("mcc", "MCC")}{th("precision", "Precision")}{th("recall", "Recall")}<th className="r">Threshold</th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={r.model} onClick={() => { setSel(r.model); setTab("roc"); }}>
                  <td>{i === 0 ? <Trophy size={15} color="#f59e0b" /> : i + 1}</td>
                  <td><b>{modelLabel(r.model)}</b>{r.model === models.default_model && <span className="chip">default</span>}</td>
                  <td className="r">{fix(r.auc)}</td><td className="r">{fix(r.pr)}</td><td className="r">{pct(r.r10)}</td><td className="r">{fix(r.f1)}</td><td className="r">{fix(r.mcc)}</td>
                  <td className="r">{fix(r.precision)}</td><td className="r">{fix(r.recall)}</td><td className="r muted">{fix(r.thr, 3)}</td></tr>))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Reading these numbers">
            <p className="muted small">Only {pct(models.defect_rate, 1)} of samples are defective, so accuracy is misleading. AUC measures ranking quality; PR-AUC is stricter on rare positives
              (a random model scores about {pct(models.defect_rate, 1)}). <b>Recall@10%</b> is the share of all defects found by reviewing only the riskiest 10% of functions, which is the number that
              matters for prioritising review effort. Thresholds are tuned per model to maximise F1.</p>
          </Panel>
        </>
      )}

      {tab === "roc" && (
        <div className="grid g-3-2">
          <Panel title="ROC curves" subtitle="Higher and further left is better">
            <div style={{ height: 380 }}><ResponsiveContainer><LineChart data={roc}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="fpr" type="number" domain={[0, 1]} stroke="var(--muted)" fontSize={11} label={{ value: "False positive rate", position: "insideBottom", offset: -4, fill: "var(--muted)", fontSize: 11 }} />
              <YAxis domain={[0, 1]} stroke="var(--muted)" fontSize={11} />
              <Tooltip content={<ChartTooltip fmt={(v) => v.toFixed(2)} />} /><Legend formatter={modelLabel} wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="chance" name="Chance" stroke="var(--muted)" strokeDasharray="4 4" dot={false} legendType="none" />
              {models.leaderboard.map((m, i) => <Line key={m.model} dataKey={m.model} name={modelLabel(m.model)} stroke={COLORS[i]} dot={false}
                strokeWidth={m.model === sel ? 3 : 1.4} strokeOpacity={m.model === sel ? 1 : 0.55} />)}
            </LineChart></ResponsiveContainer></div>
          </Panel>
          <Panel title="Confusion matrix" actions={<select className="input sm" value={sel ?? ""} onChange={(e) => setSel(e.target.value)} aria-label="Model">
            {models.leaderboard.map((m) => <option key={m.model} value={m.model}>{modelLabel(m.model)}</option>)}</select>}>
            <Confusion c={curveMode === "cross_project" ? chosen.confusion_cross : chosen.confusion_within} />
            <p className="muted small" style={{ marginTop: 12 }}>At threshold {fix(chosen.threshold, 3)}. False negatives are defects the model missed; false positives are wasted review effort.</p>
          </Panel>
        </div>
      )}

      {tab === "feat" && (
        <Panel title="Feature importance" subtitle="Random forest impurity importance vs. absolute logistic coefficient">
          <div style={{ height: 340 }}><ResponsiveContainer><BarChart data={fiData} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
            <XAxis type="number" stroke="var(--muted)" fontSize={11} /><YAxis type="category" dataKey="f" width={140} stroke="var(--muted)" fontSize={11} tickFormatter={featLabel} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--hover)" }} /><Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="rf" name="Random forest" fill="#6366f1" radius={[0, 4, 4, 0]} /><Bar dataKey="lr" name="Logistic |coef|" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
          </BarChart></ResponsiveContainer></div>
        </Panel>
      )}

      {tab === "proj" && (
        <Panel title="Cross-project AUC by held-out project" subtitle="Each column is a project the model never saw in training">
          <Heatmap labels={projects} rows={models.leaderboard.map((m) => modelLabel(m.model))}
            matrix={models.leaderboard.map((m) => projects.map((p) => m.per_project_auc[p]))} scale={seq} cell={64} />
        </Panel>
      )}

      {tab === "agree" && (
        <Panel title="Model agreement on your project" subtitle="Correlation of risk scores across models for the current run">
          {!run ? <Empty title="No project loaded" text="Run an analysis first." /> : !agree ? <p className="muted">Scoring with all models…</p> : (
            <Heatmap labels={agree.agreement.labels.map(modelLabel)} matrix={agree.agreement.matrix}
              scale={(v) => `rgba(16,185,129,${0.1 + Math.max(0, v) * 0.75})`} cell={64} />
          )}
        </Panel>
      )}
    </>
  );
}

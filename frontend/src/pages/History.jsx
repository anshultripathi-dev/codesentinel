import { useMemo, useState } from "react";
import { History as HistoryIcon, Trash2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "../state.jsx";
import { ChartTooltip, Empty, PageHeader, Panel } from "../components/ui.jsx";
import { modelLabel, num, pct } from "../utils.js";

const Delta = ({ a, b, invert, fmt = (x) => x }) => {
  const d = b - a;
  if (!d) return <span className="muted">no change</span>;
  const good = invert ? d < 0 : d > 0;
  return <span className={good ? "t-down" : "t-up"}>{d > 0 ? "+" : ""}{fmt(d)}</span>;
};

export default function History({ go }) {
  const { runs, run, openRun, removeRun } = useApp();
  const [cmp, setCmp] = useState([]);
  const toggle = (id) => setCmp((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)));
  const [a, b] = cmp.map((id) => runs.find((r) => r.id === id));
  const [project, setProject] = useState("");
  // Trends only compare runs of one project scored by one model, because risk scores differ between models.
  const keyOf = (r) => `${r.name}||${r.model}||${r.summary.family ?? "nasa"}`;
  const labelOf = (r) => `${r.name.slice(0, 40)} · ${modelLabel(r.model)}`;
  const groups = useMemo(() => {
    const m = new Map();
    runs.forEach((r) => { if (!m.has(keyOf(r))) m.set(keyOf(r), { key: keyOf(r), label: labelOf(r), n: 0 }); m.get(keyOf(r)).n++; });
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [runs]);
  const names = groups.map((g) => g.key);
  const trend = useMemo(() => {
    const pick = project || names[0];
    return runs.filter((r) => keyOf(r) === pick).sort((a, b) => a.id - b.id).map((r) => ({
      run: `#${r.id}`, high: +(100 * r.summary.high_risk / Math.max(r.summary.functions, 1)).toFixed(2), avg: +(100 * r.summary.avg_risk).toFixed(2),
      cc: r.summary.avg_cyclomatic, functions: r.summary.functions, anomalies: r.summary.anomalies }));
  }, [runs, project, names]);

  if (!runs.length) return <><PageHeader title="History" /><Panel><Empty icon={HistoryIcon} title="No runs yet" text="Completed analyses are saved here."
    action={<button className="btn primary" onClick={() => go("analyze")}>New analysis</button>} /></Panel></>;

  return (
    <>
      <PageHeader title="History" subtitle="Every analysis is saved. Select two runs to compare." />
      {names.length > 0 && (
        <Panel title="Trends" subtitle={trend.length < 2 ? "Run the same project at least twice to see a trend" : `${trend.length} runs of the selected project and model`}
          actions={<select className="input sm" value={project || names[0]} onChange={(e) => setProject(e.target.value)} aria-label="Project">
            {groups.map((g) => <option key={g.key} value={g.key}>{g.label} ({g.n})</option>)}</select>}>
          {trend.length >= 2 ? (
            <div className="grid g-2" style={{ marginBottom: 0 }}>
              <div style={{ height: 220 }}><ResponsiveContainer><LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="run" stroke="var(--muted)" fontSize={11} /><YAxis stroke="var(--muted)" fontSize={11} unit="%" />
                <Tooltip content={<ChartTooltip fmt={(v) => `${v}%`} />} />
                <Line type="monotone" dataKey="high" name="High-risk share" stroke="var(--bad)" strokeWidth={2} dot />
                <Line type="monotone" dataKey="avg" name="Average risk" stroke="var(--accent)" strokeWidth={2} dot />
              </LineChart></ResponsiveContainer></div>
              <div style={{ height: 220 }}><ResponsiveContainer><LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="run" stroke="var(--muted)" fontSize={11} /><YAxis yAxisId="l" stroke="var(--muted)" fontSize={11} />
                <YAxis yAxisId="r" orientation="right" stroke="var(--muted)" fontSize={11} />
                <Tooltip content={<ChartTooltip />} />
                <Line yAxisId="l" type="monotone" dataKey="functions" name="Functions" stroke="#0ea5e9" strokeWidth={2} dot />
                <Line yAxisId="r" type="monotone" dataKey="cc" name="Avg complexity" stroke="#f59e0b" strokeWidth={2} dot />
              </LineChart></ResponsiveContainer></div>
            </div>
          ) : <p className="muted small">Re-analysing the same project, for example from the demo, adds points to these charts.</p>}
        </Panel>
      )}

      <Panel pad={false} className="mt">
        <table className="table hover">
          <thead><tr><th /><th>#</th><th>Project</th><th>Model</th><th className="r">Files</th><th className="r">Functions</th><th className="r">High risk</th><th>When</th><th /></tr></thead>
          <tbody>{runs.map((r) => (
            <tr key={r.id} className={run?.id === r.id ? "current" : ""}>
              <td><input type="checkbox" checked={cmp.includes(r.id)} onChange={() => toggle(r.id)} aria-label={`Compare run ${r.id}`} /></td>
              <td>{r.id}</td><td className="ellipsis">{r.name}</td><td>{modelLabel(r.model)}</td>
              <td className="r">{r.summary.files}</td><td className="r">{num(r.summary.functions)}</td><td className="r">{r.summary.high_risk}</td>
              <td className="muted small">{r.created}</td>
              <td className="r nowrap">
                <button className="btn sm" onClick={async () => { await openRun(r.id); go("overview"); }}>Open</button>
                <button className="icon-btn" onClick={() => window.confirm(`Delete run ${r.id}?`) && removeRun(r.id)} aria-label="Delete run"><Trash2 size={15} /></button>
              </td></tr>))}
          </tbody>
        </table>
      </Panel>

      {a && b && (
        <Panel title={`Run #${a.id} → #${b.id}`} subtitle="Change from the first selected run to the second" className="mt">
          <table className="table">
            <thead><tr><th>Metric</th><th className="r">#{a.id}</th><th className="r">#{b.id}</th><th className="r">Change</th></tr></thead>
            <tbody>
              <tr><td>Functions</td><td className="r">{a.summary.functions}</td><td className="r">{b.summary.functions}</td><td className="r"><Delta a={a.summary.functions} b={b.summary.functions} invert /></td></tr>
              <tr><td>High-risk functions</td><td className="r">{a.summary.high_risk}</td><td className="r">{b.summary.high_risk}</td><td className="r"><Delta a={a.summary.high_risk} b={b.summary.high_risk} invert /></td></tr>
              <tr><td>Average risk</td><td className="r">{pct(a.summary.avg_risk, 1)}</td><td className="r">{pct(b.summary.avg_risk, 1)}</td><td className="r"><Delta a={a.summary.avg_risk} b={b.summary.avg_risk} invert fmt={(x) => pct(x, 1)} /></td></tr>
              <tr><td>Average complexity</td><td className="r">{a.summary.avg_cyclomatic}</td><td className="r">{b.summary.avg_cyclomatic}</td><td className="r"><Delta a={a.summary.avg_cyclomatic} b={b.summary.avg_cyclomatic} invert fmt={(x) => x.toFixed(2)} /></td></tr>
              <tr><td>Anomalies</td><td className="r">{a.summary.anomalies}</td><td className="r">{b.summary.anomalies}</td><td className="r"><Delta a={a.summary.anomalies} b={b.summary.anomalies} invert /></td></tr>
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}

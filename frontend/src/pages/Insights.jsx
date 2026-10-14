import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { useApp } from "../state.jsx";
import { ChartTooltip, Empty, Heatmap, PageHeader, Panel, Tabs } from "../components/ui.jsx";
import { FEATURE_META, RISK_COLOR, featLabel, pct } from "../utils.js";

const LOG_TICKS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
const diverging = (v) => {
  const a = Math.min(Math.abs(v), 1);
  return v >= 0 ? `rgba(244,63,94,${0.12 + a * 0.75})` : `rgba(56,189,248,${0.12 + a * 0.75})`;
};

export default function Insights() {
  const { eda, stats, settings } = useApp();
  const [tab, setTab] = useState("dataset");
  const [feat, setFeat] = useState("cyclomatic");

  const scatter = useMemo(() => stats?.funcs.slice(0, 1500).map((f) => ({
    loc: f.loc_total, cc: f.cyclomatic, risk: f.defect_probability, name: f.name, level: f.risk })) ?? [], [stats]);

  const riskHist = useMemo(() => {
    if (!stats) return [];
    const edges = [0, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.2, 0.35, 1.01];
    return edges.slice(0, -1).map((lo, i) => {
      const hi = edges[i + 1];
      return { bin: hi > 1 ? `≥${Math.round(lo * 100)}%` : `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`, n: stats.funcs.filter((f) => f.defect_probability >= lo && f.defect_probability < hi).length, mid: lo };
    });
  }, [stats]);

  const topDrivers = useMemo(() => {
    if (!stats) return [];
    const risky = [...stats.funcs].sort((a, b) => b.defect_probability - a.defect_probability).slice(0, Math.max(10, Math.ceil(stats.n * 0.1)));
    const sums = {};
    risky.forEach((f) => (f.drivers ?? []).forEach((d) => { (sums[d.feature] ||= []).push(d.impact); }));
    return Object.entries(sums).map(([feature, v]) => ({ feature, impact: +(v.reduce((a, b) => a + b, 0) / risky.length).toFixed(3) })).sort((a, b) => b.impact - a.impact);
  }, [stats]);

  if (!eda) return <><PageHeader title="Insights" /><Panel><Empty title="Loading dataset analysis…" text="Requires the API to be running." /></Panel></>;

  const c = eda.correlation;
  const corrDefect = c.labels.map((l, i) => ({ f: l, v: c.matrix[i][c.labels.length - 1] })).filter((x) => x.f !== "defective")
    .sort((a, b) => b.v - a.v);

  return (
    <>
      <PageHeader title="Insights" subtitle={`What ${eda.n.toLocaleString()} ${eda.family === "python" ? "Python functions from open-source repos" : "NASA C/C++ modules"} say about metrics and defects`} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "dataset", label: "Defect drivers" }, { id: "dist", label: "Distributions" },
        { id: "corr", label: "Correlations" }, { id: "project", label: "Your project" }]} />

      {tab === "dataset" && (
        <>
          <div className="grid g-2">
            <Panel title="Defect rate by cyclomatic complexity" subtitle="Risk rises steadily with branching">
              <div style={{ height: 280 }}><ResponsiveContainer><BarChart data={eda.defect_rate_by_cc}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="bin" stroke="var(--muted)" fontSize={11} /><YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => pct(v)} />
                <Tooltip content={<ChartTooltip fmt={(v) => pct(v, 1)} />} cursor={{ fill: "var(--hover)" }} />
                <Bar dataKey="defect_rate" name="Defect rate" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart></ResponsiveContainer></div>
            </Panel>
            <Panel title="Defect rate by function length (LOC)" subtitle="Longer functions carry more defects">
              <div style={{ height: 280 }}><ResponsiveContainer><BarChart data={eda.defect_rate_by_loc}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="bin" stroke="var(--muted)" fontSize={11} /><YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => pct(v)} />
                <Tooltip content={<ChartTooltip fmt={(v) => pct(v, 1)} />} cursor={{ fill: "var(--hover)" }} />
                <Bar dataKey="defect_rate" name="Defect rate" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart></ResponsiveContainer></div>
            </Panel>
          </div>
          <Panel title={`Defect rate by ${eda.family === "python" ? "repository" : "project"}`} subtitle="Base rates differ a lot between projects, which is why cross-project prediction is hard">
            <div style={{ height: 240 }}><ResponsiveContainer><BarChart data={eda.projects}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="project" stroke="var(--muted)" fontSize={11} /><YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => pct(v)} />
              <Tooltip content={<ChartTooltip fmt={(v) => pct(v, 1)} />} cursor={{ fill: "var(--hover)" }} />
              <Bar dataKey="defect_rate" name="Defect rate" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart></ResponsiveContainer></div>
          </Panel>
          <Panel title="Metric profile: defective vs. clean modules" pad={false}>
            <table className="table">
              <thead><tr><th>Metric</th><th className="r">Median</th><th className="r">P90</th><th className="r">Mean (clean)</th><th className="r">Mean (defective)</th><th className="r">Ratio</th></tr></thead>
              <tbody>{eda.summary.map((s) => (
                <tr key={s.feature}><td title={FEATURE_META[s.feature]?.hint}>{featLabel(s.feature)}</td>
                  <td className="r">{s.median}</td><td className="r">{s.p90}</td><td className="r">{s.mean_clean}</td><td className="r">{s.mean_defective}</td>
                  <td className="r"><b>{s.mean_clean ? (s.mean_defective / s.mean_clean).toFixed(1) : "–"}×</b></td></tr>))}
              </tbody>
            </table>
          </Panel>
        </>
      )}

      {tab === "dist" && (
        <Panel title="Metric distribution" subtitle="Module counts by value; defective modules skew right"
          actions={<select className="input sm" value={feat} onChange={(e) => setFeat(e.target.value)} aria-label="Metric">
            {Object.keys(FEATURE_META).map((k) => <option key={k} value={k}>{featLabel(k)}</option>)}</select>}>
          <div style={{ height: 340 }}><ResponsiveContainer><AreaChart data={eda.histograms[feat]}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="x" stroke="var(--muted)" fontSize={11} /><YAxis stroke="var(--muted)" fontSize={11} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="clean" name="Clean" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
            <Area type="monotone" dataKey="defective" name="Defective" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.35} />
          </AreaChart></ResponsiveContainer></div>
          <p className="muted small">{FEATURE_META[feat].hint}. Bins are log-spaced.</p>
        </Panel>
      )}

      {tab === "corr" && (
        <div className="grid g-3-2">
          <Panel title="Spearman correlation matrix" subtitle="Metrics are heavily collinear, so single metrics add little beyond size and complexity">
            <Heatmap labels={c.labels.map((l) => (FEATURE_META[l]?.short ?? "Defect"))} rows={c.labels.map((l) => (FEATURE_META[l]?.short ?? "Defect"))}
              matrix={c.matrix} scale={diverging} cell={58} />
          </Panel>
          <Panel title="Correlation with defects">
            <div style={{ height: 300 }}><ResponsiveContainer><BarChart data={corrDefect} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
              <XAxis type="number" stroke="var(--muted)" fontSize={11} /><YAxis type="category" dataKey="f" width={110} stroke="var(--muted)" fontSize={11} tickFormatter={featLabel} />
              <Tooltip content={<ChartTooltip fmt={(v) => v.toFixed(3)} />} cursor={{ fill: "var(--hover)" }} />
              <Bar dataKey="v" name="ρ" fill="var(--accent)" radius={[0, 4, 4, 0]} />
            </BarChart></ResponsiveContainer></div>
          </Panel>
        </div>
      )}

      {tab === "project" && (stats ? (
        <>
        <div className="grid g-2">
          <Panel title="Risk score distribution" subtitle="How many of your functions fall in each predicted-risk range">
            <div style={{ height: 260 }}><ResponsiveContainer><BarChart data={riskHist}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="bin" stroke="var(--muted)" fontSize={10} interval={0} /><YAxis stroke="var(--muted)" fontSize={11} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--hover)" }} />
              <Bar dataKey="n" name="Functions" radius={[4, 4, 0, 0]}>
                {riskHist.map((d) => <Cell key={d.bin} fill={RISK_COLOR[d.mid >= settings.high ? "high" : d.mid >= settings.medium ? "medium" : "low"]} />)}
              </Bar>
            </BarChart></ResponsiveContainer></div>
          </Panel>
          <Panel title="What drives your riskiest functions" subtitle="Mean logistic-model contribution across your top 10% (positive raises risk)">
            <div style={{ height: 260 }}><ResponsiveContainer><BarChart data={topDrivers} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
              <XAxis type="number" stroke="var(--muted)" fontSize={11} /><YAxis type="category" dataKey="feature" width={120} stroke="var(--muted)" fontSize={11} tickFormatter={featLabel} />
              <Tooltip content={<ChartTooltip labelFmt={featLabel} fmt={(v) => v.toFixed(3)} />} cursor={{ fill: "var(--hover)" }} />
              <Bar dataKey="impact" name="Mean impact" radius={[0, 4, 4, 0]}>
                {topDrivers.map((d) => <Cell key={d.feature} fill={d.impact >= 0 ? "#f43f5e" : "#10b981"} />)}
              </Bar>
            </BarChart></ResponsiveContainer></div>
          </Panel>
        </div>
        <Panel title="Complexity vs. size, coloured by risk" subtitle={`${scatter.length.toLocaleString()} functions from your current run`}>
          <div style={{ height: 420 }}><ResponsiveContainer><ScatterChart margin={{ left: 0, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis type="number" dataKey="loc" name="LOC" scale="log" domain={[1, "auto"]} ticks={LOG_TICKS} allowDuplicatedCategory={false} stroke="var(--muted)" fontSize={11} label={{ value: "Lines of code (log)", position: "insideBottom", offset: -4, fill: "var(--muted)", fontSize: 11 }} />
            <YAxis type="number" dataKey="cc" name="CC" scale="log" domain={[1, "auto"]} ticks={LOG_TICKS} allowDuplicatedCategory={false} stroke="var(--muted)" fontSize={11} label={{ value: "Cyclomatic complexity (log)", angle: -90, position: "insideLeft", fill: "var(--muted)", fontSize: 11 }} />
            <ZAxis type="number" dataKey="risk" range={[30, 30]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => payload?.[0] ? (
              <div className="tooltip"><div className="tooltip-title">{payload[0].payload.name}</div>
                LOC {payload[0].payload.loc} · CC {payload[0].payload.cc} · risk {pct(payload[0].payload.risk)}</div>) : null} />
            <Scatter data={scatter}>{scatter.map((d, i) => <Cell key={i} fill={RISK_COLOR[d.level]} fillOpacity={0.6} />)}</Scatter>
          </ScatterChart></ResponsiveContainer></div>
        </Panel>
        </>
      ) : <Panel><Empty title="No project loaded" text="Run an analysis to see your own metric profile here." /></Panel>)}
    </>
  );
}

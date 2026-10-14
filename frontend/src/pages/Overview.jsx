import { useMemo } from "react";
import { Activity, AlertTriangle, ArrowRight, Code2, FileCode2, Gauge as GaugeIcon, HeartPulse, ShieldAlert, Upload } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Treemap, Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { useApp } from "../state.jsx";
import { Badge, ChartTooltip, Empty, GradeRing, Kpi, PageHeader, PageSkeleton, Panel } from "../components/ui.jsx";
import { FAMILY_INFO, GRADE_TONE, RISK_COLOR, findings, grade, modelLabel, num, pct, riskOf } from "../utils.js";

function TreeCell({ x, y, width, height, name, risk, depth }) {
  if (depth < 1 || width < 4 || height < 4) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={RISK_COLOR[risk] ?? "#64748b"} fillOpacity={0.85} stroke="var(--panel)" strokeWidth={2} />
      {width > 70 && height > 22 && (
        <text x={x + 8} y={y + 16} fontSize={11} fill="#fff" style={{ pointerEvents: "none" }}>
          {String(name).split("/").pop().slice(0, Math.floor(width / 7))}
        </text>
      )}
    </g>
  );
}

export default function Overview({ go }) {
  const { run, runs, stats, settings, activeModel, prevRun, busy } = useApp();

  const donut = useMemo(() => stats && [
    { name: "High", value: stats.high, color: RISK_COLOR.high },
    { name: "Medium", value: stats.medium, color: RISK_COLOR.medium },
    { name: "Low", value: stats.low, color: RISK_COLOR.low },
  ], [stats]);

  const treemap = useMemo(() => run && [...run.files].sort((a, b) => b.loc - a.loc).slice(0, 60)
    .map((f) => ({ name: f.file, size: Math.max(f.loc, 1), risk: riskOf(f.max_risk, settings) })), [run, settings]);

  const byDir = useMemo(() => {
    if (!stats) return [];
    const m = {};
    stats.funcs.forEach((f) => { (m[f.dir] ||= []).push(f.defect_probability); });
    return Object.entries(m).map(([dir, v]) => ({ dir, risk: +(100 * v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), n: v.length }))
      .sort((a, b) => b.risk - a.risk).slice(0, 8);
  }, [stats]);

  const tips = useMemo(() => (run && stats ? findings(stats, run) : []), [run, stats]);

  if ((!run || !stats) && (busy || runs.length > 0)) return <PageSkeleton />;
  if (!run || !stats) {
    return (
      <>
        <PageHeader title="Overview" subtitle="Portfolio health at a glance" />
        <Panel><Empty icon={FileCode2} title="No analysis yet" text="Upload a project or run the built-in demo to see quality metrics and defect risk."
          action={<button className="btn primary" onClick={() => go("analyze")}><Upload size={16} /> Start an analysis</button>} /></Panel>
      </>
    );
  }

  const top = [...stats.funcs].sort((a, b) => b.defect_probability - a.defect_probability).slice(0, 8);
  const letter = grade(stats.quality);
  const qTone = GRADE_TONE[letter];
  const ps = prevRun?.summary;

  return (
    <>
      <PageHeader title="Overview" subtitle={`${run.name} · scored with ${modelLabel(run.model)} (${FAMILY_INFO[run.summary.family ?? "nasa"]?.label ?? run.summary.family}) · ${run.created}`}
        actions={<button className="btn" onClick={() => go("results")}>Open results explorer</button>} />

      <div className="kpis">
        <Kpi icon={GaugeIcon} tone={qTone} label="Quality score" value={<>{stats.quality}<span className="kpi-grade">{letter}</span></>} sub="100 minus LOC-weighted risk" />
        <Kpi icon={FileCode2} label="Files" value={num(stats.files)} sub={`${num(stats.totalLoc)} lines`} delta={ps ? stats.files - ps.files : null} />
        <Kpi icon={Code2} label="Functions" value={num(stats.n)} sub={`avg complexity ${stats.avgCC.toFixed(1)}`} delta={ps ? stats.n - ps.functions : null} lowerIsBetter />
        <Kpi icon={ShieldAlert} tone="bad" label="High risk" value={num(stats.high)} sub={`${pct(stats.n ? stats.high / stats.n : 0, 1)} of functions`} delta={ps ? stats.high - ps.high_risk : null} lowerIsBetter />
        <Kpi icon={AlertTriangle} tone="warn" label="Anomalies" value={num(stats.anomalies)} sub="unusual structure" delta={ps ? stats.anomalies - ps.anomalies : null} lowerIsBetter />
        <Kpi icon={Activity} label="Maintainability" value={stats.avgMI != null ? stats.avgMI.toFixed(0) : "n/a"} sub="radon MI, 0-100" />
      </div>

      <Panel title="At a glance" subtitle={prevRun ? `Compared with run #${prevRun.id}` : "Key findings for this run"}
        actions={<div className="btn-row"><button className="btn sm" onClick={() => go("health")}><HeartPulse size={14} /> Code health</button><button className="btn sm" onClick={() => go("report")}>Report <ArrowRight size={14} /></button></div>}>
        <div className="health-top">
          <GradeRing value={stats.quality} letter={letter} tone={qTone} />
          <ul className="findings">{tips.map((t, i) => <li key={i}><i className={`tone-${t.tone}`} />{t.text}</li>)}</ul>
        </div>
      </Panel>
      <div className="mt" />

      <div className="grid g-3-2">
        <Panel title="Hotspot map" subtitle="Rectangle size is file LOC; colour is the riskiest function inside">
          <div style={{ height: 320 }}>
            <ResponsiveContainer>
              <Treemap data={treemap} dataKey="size" content={<TreeCell />} isAnimationActive={false}>
                <Tooltip content={({ payload }) => payload?.[0] ? (
                  <div className="tooltip"><div className="tooltip-title">{payload[0].payload.name}</div>
                    {num(payload[0].payload.size)} LOC · <Badge risk={payload[0].payload.risk} /></div>) : null} />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Risk distribution" subtitle={`Thresholds: high ≥ ${pct(settings.high)}, medium ≥ ${pct(settings.medium)}`}>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donut} dataKey="value" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                  {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legend">
            {donut.map((d) => <span key={d.name}><i style={{ background: d.color }} />{d.name} <b>{num(d.value)}</b></span>)}
          </div>
        </Panel>
      </div>

      <div className="grid g-2">
        <Panel title="Top risky functions" actions={<button className="link" onClick={() => go("results")}>See all</button>} pad={false}>
          <table className="table">
            <thead><tr><th>Function</th><th>File</th><th>Risk</th><th className="r">CC</th></tr></thead>
            <tbody>
              {top.map((f, i) => (
                <tr key={i}>
                  <td><code>{f.name}</code></td>
                  <td className="muted small ellipsis">{f.file}:{f.start_line}</td>
                  <td><Badge risk={f.risk}>{pct(f.defect_probability)}</Badge></td>
                  <td className="r">{f.cyclomatic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Average risk by directory" subtitle="Where to focus review effort first">
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={byDir} layout="vertical" margin={{ left: 10, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="var(--muted)" fontSize={11} unit="%" />
                <YAxis type="category" dataKey="dir" width={130} stroke="var(--muted)" fontSize={11} tickFormatter={(v) => (v.length > 20 ? `…${v.slice(-19)}` : v)} />
                <Tooltip content={<ChartTooltip fmt={(v) => `${v}%`} />} cursor={{ fill: "var(--hover)" }} />
                <Bar dataKey="risk" name="Avg risk" radius={[0, 4, 4, 0]} fill="var(--accent)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <p className="muted small foot">Active model: {modelLabel(activeModel)}. Scores are relative risk rankings, not calibrated probabilities.</p>
    </>
  );
}

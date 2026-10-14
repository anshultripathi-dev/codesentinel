import { useMemo } from "react";
import { Activity, FileCode2, HeartPulse } from "lucide-react";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { useApp } from "../state.jsx";
import { ChartTooltip, Empty, GradeRing, PageHeader, Panel } from "../components/ui.jsx";
import { FEATURE_META, GRADE_TONE, MI_BANDS, RISK_COLOR, ccBandCounts, findings, grade, miBand, num, paretoCurve, percentileOf, pct, riskOf } from "../utils.js";

const RADAR_KEYS = ["cyclomatic", "loc_total", "halstead_volume", "halstead_difficulty", "halstead_effort", "param_count"];
const LOG_TICKS = [1, 10, 100, 1000, 10000];
const TONE_DOT = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)", info: "var(--accent)" };

// Colour a table cell from 0 (cool) to 1 (hot).
const heat = (t) => `rgba(244,63,94,${(0.08 + Math.min(Math.max(t, 0), 1) * 0.55).toFixed(2)})`;

export default function Health({ go }) {
  const { run, stats, settings, eda } = useApp();

  const pareto = useMemo(() => (stats ? paretoCurve(stats.funcs) : []), [stats]);
  const bands = useMemo(() => (stats ? ccBandCounts(stats.funcs) : []), [stats]);
  const tips = useMemo(() => (stats && run ? findings(stats, run) : []), [stats, run]);

  const mi = useMemo(() => {
    if (!run) return { donut: [], hist: [] };
    const vals = run.files.map((f) => f.maintainability_index).filter((x) => x != null);
    const donut = MI_BANDS.map((b) => ({ name: b.label, value: vals.filter((v) => miBand(v) === b.id).length, color: b.color })).filter((d) => d.value);
    const hist = Array.from({ length: 10 }, (_, i) => ({ bin: `${i * 10}`, files: vals.filter((v) => v >= i * 10 && (i === 9 ? v <= 100 : v < (i + 1) * 10)).length, mid: i * 10 + 5 }));
    return { donut, hist };
  }, [run]);

  const bubbles = useMemo(() => run && run.files.map((f) => ({
    file: f.file, loc: Math.max(f.loc, 1), risk: +(f.max_risk * 100).toFixed(1), n: f.n_functions, level: riskOf(f.max_risk, settings) })), [run, settings]);

  const radar = useMemo(() => {
    const pcts = eda?.percentiles;
    if (!stats || !pcts) return [];
    return RADAR_KEYS.filter((k) => pcts[k]).map((k) => ({
      metric: FEATURE_META[k].short,
      project: +(stats.funcs.reduce((a, f) => a + percentileOf(f[k], pcts[k]), 0) / stats.n).toFixed(1),
      corpus: 50,
    }));
  }, [stats, eda]);

  const comments = useMemo(() => {
    if (!stats) return [];
    const edges = [[0, 1, "0%"], [1, 5, "1–5%"], [5, 10, "5–10%"], [10, 20, "10–20%"], [20, Infinity, "20%+"]];
    return edges.map(([lo, hi, label]) => {
      const g = stats.funcs.filter((f) => f.comment_pct >= lo && f.comment_pct < hi);
      return { label, n: g.length, risk: g.length ? +(100 * g.reduce((a, f) => a + f.defect_probability, 0) / g.length).toFixed(2) : 0 };
    });
  }, [stats]);

  const hotFiles = useMemo(() => {
    if (!run) return [];
    const rows = [...run.files].sort((a, b) => b.max_risk - a.max_risk).slice(0, 12);
    const maxCC = Math.max(...rows.map((r) => r.cyclomatic_max), 1), maxLoc = Math.max(...rows.map((r) => r.loc), 1), maxN = Math.max(...rows.map((r) => r.n_functions), 1);
    return rows.map((f) => ({ ...f, tRisk: f.max_risk / Math.max(rows[0].max_risk, 1e-6), tCC: f.cyclomatic_max / maxCC, tLoc: f.loc / maxLoc, tN: f.n_functions / maxN,
      tMI: f.maintainability_index == null ? 0 : 1 - f.maintainability_index / 100 }));
  }, [run]);

  if (!run || !stats) {
    return (<><PageHeader title="Code health" subtitle="Deep dive into complexity, maintainability and review effort" />
      <Panel><Empty icon={HeartPulse} title="No analysis yet" text="Run an analysis to see the health breakdown."
        action={<button className="btn primary" onClick={() => go("analyze")}>New analysis</button>} /></Panel></>);
  }

  const q = stats.quality, letter = grade(q), tone = GRADE_TONE[letter];
  const at10 = pareto.find((p) => p.reviewed === 10);
  const axis = { stroke: "var(--muted)", fontSize: 11 };

  return (
    <>
      <PageHeader title="Code health" subtitle={`${run.name} · ${num(stats.n)} functions across ${num(stats.files)} files`} />

      <div className="grid g-3-2">
        <Panel title="Health summary" subtitle="Plain-language findings for this run">
          <div className="health-top">
            <GradeRing value={q} letter={letter} tone={tone} size={92} />
            <ul className="findings">
              {tips.map((t, i) => <li key={i}><i style={{ background: TONE_DOT[t.tone] }} />{t.text}</li>)}
            </ul>
          </div>
        </Panel>
        <Panel title="Review-effort curve" subtitle="Share of total predicted risk caught by reviewing the riskiest functions first">
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <ComposedChart data={pareto} margin={{ left: 0, right: 12, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="reviewed" type="number" domain={[0, 100]} unit="%" {...axis} />
                <YAxis domain={[0, 100]} unit="%" {...axis} />
                <Tooltip content={<ChartTooltip fmt={(v) => `${v}%`} labelFmt={(l) => `Review the top ${l}%`} />} />
                <Area type="monotone" dataKey="captured" name="Risk captured" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} />
                <Line type="linear" dataKey="random" name="Random order" stroke="var(--muted)" strokeDasharray="4 4" dot={false} />
                {at10 && <ReferenceLine x={10} stroke="var(--warn)" strokeDasharray="3 3" />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {at10 && <p className="muted small">The riskiest 10% of functions hold <b>{at10.captured}%</b> of the predicted risk, versus 10% if reviewed at random.</p>}
        </Panel>
      </div>

      <div className="grid g-2">
        <Panel title="Complexity bands" subtitle="Functions by cyclomatic complexity, split by risk level">
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={bands}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="band" {...axis} /><YAxis {...axis} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--hover)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="low" name="Low" stackId="a" fill={RISK_COLOR.low} />
                <Bar dataKey="medium" name="Medium" stackId="a" fill={RISK_COLOR.medium} />
                <Bar dataKey="high" name="High" stackId="a" fill={RISK_COLOR.high} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Project profile vs. training corpus" subtitle="Average percentile of your functions (50 = typical of the corpus)">
          {radar.length ? (
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <RadarChart data={radar}>
                  <PolarGrid stroke="var(--line)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="corpus" name="Corpus median" stroke="var(--muted)" fill="var(--muted)" fillOpacity={0.12} strokeDasharray="4 4" />
                  <Radar dataKey="project" name="Your project" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.35} />
                  <Tooltip content={<ChartTooltip fmt={(v) => `p${v}`} />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="Loading reference data…" text="Percentiles come from the training corpus." />}
        </Panel>
      </div>

      <div className="grid g-2">
        <Panel title="File maintainability" subtitle="Radon maintainability index per file (higher is easier to maintain)">
          <div className="mi-row">
            <div style={{ height: 230, width: 190, flex: "none" }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={mi.donut} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none">
                    {mi.donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ height: 230, flex: 1, minWidth: 0 }}>
              <ResponsiveContainer>
                <BarChart data={mi.hist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="bin" {...axis} /><YAxis allowDecimals={false} {...axis} />
                  <Tooltip content={<ChartTooltip labelFmt={(l) => `MI ${l}–${+l + 10}`} />} cursor={{ fill: "var(--hover)" }} />
                  <Bar dataKey="files" name="Files" radius={[4, 4, 0, 0]}>
                    {mi.hist.map((d) => <Cell key={d.bin} fill={MI_BANDS.find((b) => d.mid >= b.min).color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="legend">{MI_BANDS.map((b) => <span key={b.id}><i style={{ background: b.color }} />{b.label}</span>)}</div>
        </Panel>

        <Panel title="Does commenting lower risk?" subtitle="Average predicted risk by comment density (bar) and function count">
          <div style={{ height: 270 }}>
            <ResponsiveContainer>
              <BarChart data={comments}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" {...axis} /><YAxis unit="%" {...axis} />
                <Tooltip content={<ChartTooltip fmt={(v) => `${v}%`} labelFmt={(l, p) => `${l} comments · ${p?.[0]?.payload?.n ?? 0} functions`} />} cursor={{ fill: "var(--hover)" }} />
                <Bar dataKey="risk" name="Avg risk" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="File bubble chart" subtitle="Size vs. riskiest function; bubble area is function count" className="mt">
        <div style={{ height: 380 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ left: 0, right: 36, top: 8, bottom: 18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis type="number" dataKey="loc" name="LOC" scale="log" domain={[1, "auto"]} ticks={LOG_TICKS} allowDataOverflow {...axis}
                label={{ value: "File lines of code (log)", position: "insideBottom", offset: -4, fill: "var(--muted)", fontSize: 11 }} />
              <YAxis type="number" dataKey="risk" name="Max risk" unit="%" {...axis}
                label={{ value: "Riskiest function", angle: -90, position: "insideLeft", fill: "var(--muted)", fontSize: 11 }} />
              <ZAxis type="number" dataKey="n" range={[30, 420]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => payload?.[0] ? (
                <div className="tooltip"><div className="tooltip-title">{payload[0].payload.file}</div>
                  {num(payload[0].payload.loc)} LOC · {payload[0].payload.n} functions · max risk {payload[0].payload.risk}%</div>) : null} />
              <ReferenceLine y={+(settings.high * 100).toFixed(1)} stroke={RISK_COLOR.high} strokeDasharray="4 4" label={{ value: "high", fill: RISK_COLOR.high, fontSize: 11, position: "right" }} />
              <Scatter data={bubbles}>{bubbles.map((d, i) => <Cell key={i} fill={RISK_COLOR[d.level]} fillOpacity={0.55} stroke={RISK_COLOR[d.level]} />)}</Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Hotspot matrix" subtitle="The 12 files with the riskiest functions; darker cells are worse within this table" className="mt" pad={false}>
        <div className="table-scroll">
          <table className="table hotspot">
            <thead><tr><th>File</th><th className="r">Max risk</th><th className="r">Max CC</th><th className="r">LOC</th><th className="r">Functions</th><th className="r">Maintainability</th></tr></thead>
            <tbody>
              {hotFiles.map((f) => (
                <tr key={f.file}>
                  <td className="ellipsis" title={f.file}><FileCode2 size={13} className="muted" /> {f.file}</td>
                  <td className="r" style={{ background: heat(f.tRisk) }}>{pct(f.max_risk, 1)}</td>
                  <td className="r" style={{ background: heat(f.tCC) }}>{f.cyclomatic_max}</td>
                  <td className="r" style={{ background: heat(f.tLoc) }}>{num(f.loc)}</td>
                  <td className="r" style={{ background: heat(f.tN) }}>{f.n_functions}</td>
                  <td className="r" style={{ background: heat(f.tMI) }}>{f.maintainability_index != null ? f.maintainability_index.toFixed(0) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="muted small foot"><Activity size={12} /> All charts are computed in the browser from the stored run; thresholds follow your Settings.</p>
    </>
  );
}

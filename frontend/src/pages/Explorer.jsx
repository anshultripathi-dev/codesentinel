import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { useApp } from "../state.jsx";
import { Badge, Drawer, Empty, Gauge, PageHeader, Panel, Tabs } from "../components/ui.jsx";
import { FEATURE_META, downloadCSV, featLabel, num, pct, percentileOf, recommendations } from "../utils.js";

const RADAR = ["cyclomatic", "loc_total", "halstead_volume", "halstead_difficulty", "halstead_effort"];

function Detail({ f, eda, settings }) {
  const radar = RADAR.map((k) => ({ metric: FEATURE_META[k].short, pctl: percentileOf(f[k], eda?.percentiles?.[k]) }));
  const recs = recommendations(f);
  const maxImpact = Math.max(...f.drivers.map((d) => Math.abs(d.impact)), 0.01);
  return (
    <div className="stack">
      <div className="detail-top">
        <Gauge value={f.defect_probability} level={f.risk} />
        <div>
          <code className="big">{f.name}</code>
          <p className="muted small">{f.file}:{f.start_line}-{f.end_line}</p>
          <div className="chips">
            <Badge risk={f.risk} />
            {f.predicted_defective && <span className="chip">predicted defective</span>}
            {f.anomaly && <span className="chip warn">anomaly</span>}
          </div>
        </div>
      </div>

      <Panel title="Metrics vs. training corpus" subtitle="Percentile among the reference modules the model was trained on" className="inner">
        <div style={{ height: 220 }}>
          <ResponsiveContainer>
            <RadarChart data={radar}>
              <PolarGrid stroke="var(--line)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <Radar dataKey="pctl" name="Percentile" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <table className="table compact">
          <tbody>
            {Object.keys(FEATURE_META).map((k) => (
              <tr key={k} title={FEATURE_META[k].hint}>
                <td>{featLabel(k)}</td><td className="r"><b>{num(f[k])}</b></td>
                <td className="r muted small">p{percentileOf(f[k], eda?.percentiles?.[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Why this score" subtitle="Top drivers from the interpretable logistic model" className="inner">
        {f.drivers.map((d) => (
          <div key={d.feature} className="driver">
            <span>{featLabel(d.feature)}</span>
            <div className="bar"><i className={d.impact > 0 ? "up" : "down"} style={{ width: `${(Math.abs(d.impact) / maxImpact) * 100}%` }} /></div>
            <b className={d.impact > 0 ? "t-up" : "t-down"}>{d.impact > 0 ? "+" : ""}{d.impact}</b>
          </div>
        ))}
      </Panel>

      <Panel title="Recommendations" className="inner">
        <ul className="recs">{recs.map((r, i) => <li key={i} className={`sev-${r.sev}`}>{r.text}</li>)}</ul>
      </Panel>
    </div>
  );
}

export default function Explorer({ go }) {
  const { run, stats, eda, settings, pendingQuery, setPendingQuery } = useApp();
  const [view, setView] = useState("functions");
  const [q, setQ] = useState(pendingQuery);
  useEffect(() => { if (pendingQuery) setPendingQuery(""); }, [pendingQuery, setPendingQuery]);
  const [risk, setRisk] = useState("all");
  const [onlyAnom, setOnlyAnom] = useState(false);
  const [sort, setSort] = useState({ key: "defect_probability", dir: -1 });
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(null);
  const PAGE = 25;

  const rows = useMemo(() => {
    if (!stats) return [];
    const needle = q.toLowerCase();
    return stats.funcs
      .filter((f) => (risk === "all" || f.risk === risk) && (!onlyAnom || f.anomaly)
        && (!needle || f.name.toLowerCase().includes(needle) || f.file.toLowerCase().includes(needle)))
      .sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : a[sort.key] < b[sort.key] ? -1 : 0) * sort.dir);
  }, [stats, q, risk, onlyAnom, sort]);

  const fileRows = useMemo(() => {
    if (!run) return [];
    const needle = q.toLowerCase();
    return run.files.filter((f) => !needle || f.file.toLowerCase().includes(needle))
      .map((f) => ({ file: f.file, loc: f.loc, n: f.n_functions, cc: f.cyclomatic_max, mi: f.maintainability_index, risk: f.max_risk }))
      .sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : -1) * sort.dir);
  }, [run, q, sort]);

  if (!run) {
    return (<><PageHeader title="Results" /><Panel><Empty title="Nothing to explore" text="Run an analysis first."
      action={<button className="btn primary" onClick={() => go("analyze")}>New analysis</button>} /></Panel></>);
  }

  const th = (key, label, cls = "") => (
    <th className={`sortable ${cls}`} onClick={() => { setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 })); setPage(0); }}>
      {label}{sort.key === key ? (sort.dir < 0 ? " ▾" : " ▴") : ""}
    </th>
  );
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil((view === "functions" ? rows.length : fileRows.length) / PAGE));
  const fileShown = fileRows.slice(page * PAGE, page * PAGE + PAGE);
  const selected = sel != null ? rows[sel] : null;

  return (
    <>
      <PageHeader title="Results" subtitle={`${run.name} · ${rows.length.toLocaleString()} of ${stats.n.toLocaleString()} functions`}
        actions={<button className="btn" onClick={() => downloadCSV(`codesentinel-run-${run.id}.csv`,
          rows.map((f) => ({ file: f.file, function: f.name, line: f.start_line, risk: f.risk, probability: f.defect_probability,
            cyclomatic: f.cyclomatic, loc: f.loc_total, halstead_volume: f.halstead_volume, anomaly: f.anomaly })))}>
          <Download size={16} /> Export CSV</button>} />

      <Panel pad={false}>
        <div className="filters">
          <Tabs value={view} onChange={(v) => { setView(v); setPage(0); setSort({ key: v === "files" ? "risk" : "defect_probability", dir: -1 }); }}
            tabs={[{ id: "functions", label: "Functions" }, { id: "files", label: "Files" }]} />
          <div className="search"><Search size={15} /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search function or file" aria-label="Search" /></div>
          {view === "functions" && (
            <>
              <div className="seg">
                {["all", "high", "medium", "low"].map((r) => (
                  <button key={r} className={risk === r ? "active" : ""} onClick={() => { setRisk(r); setPage(0); }}>{r}</button>))}
              </div>
              <label className="check"><input type="checkbox" checked={onlyAnom} onChange={(e) => { setOnlyAnom(e.target.checked); setPage(0); }} /> Anomalies only</label>
            </>
          )}
        </div>

        <div className="table-scroll">
          {view === "functions" ? (
            <table className="table hover">
              <thead><tr>{th("name", "Function")}{th("file", "File")}{th("defect_probability", "Risk")}{th("cyclomatic", "CC", "r")}
                {th("loc_total", "LOC", "r")}{th("halstead_volume", "H. volume", "r")}{th("comment_pct", "Cmt %", "r")}<th>Flags</th></tr></thead>
              <tbody>
                {shown.map((f, i) => (
                  <tr key={`${f.file}-${f.start_line}-${i}`} onClick={() => setSel(page * PAGE + i)} tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSel(page * PAGE + i)}>
                    <td><code>{f.name}</code></td>
                    <td className="muted small ellipsis">{f.file}:{f.start_line}</td>
                    <td><Badge risk={f.risk}>{pct(f.defect_probability)}</Badge></td>
                    <td className="r">{f.cyclomatic}</td><td className="r">{f.loc_total}</td>
                    <td className="r">{num(f.halstead_volume)}</td><td className="r">{f.comment_pct.toFixed(0)}</td>
                    <td>{f.anomaly && <span className="chip warn">anomaly</span>}</td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={8} className="muted center">No functions match these filters.</td></tr>}
              </tbody>
            </table>
          ) : (
            <table className="table hover">
              <thead><tr>{th("file", "File")}{th("risk", "Max risk")}{th("loc", "LOC", "r")}{th("n", "Functions", "r")}{th("cc", "Max CC", "r")}{th("mi", "MI", "r")}</tr></thead>
              <tbody>
                {fileShown.map((f) => (
                  <tr key={f.file} onClick={() => { setQ(f.file); setView("functions"); setPage(0); setSort({ key: "defect_probability", dir: -1 }); }}>
                    <td className="ellipsis">{f.file}</td>
                    <td><Badge risk={f.risk >= settings.high ? "high" : f.risk >= settings.medium ? "medium" : "low"}>{pct(f.risk)}</Badge></td>
                    <td className="r">{f.loc}</td><td className="r">{f.n}</td><td className="r">{f.cc}</td><td className="r">{f.mi ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="pager">
          <span className="muted small">Page {page + 1} of {pages}</span>
          <div>
            <button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
            <button className="btn sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </Panel>

      <Drawer open={!!selected} onClose={() => setSel(null)} title="Function detail">
        {selected && <Detail f={selected} eda={eda} settings={settings} />}
      </Drawer>
    </>
  );
}

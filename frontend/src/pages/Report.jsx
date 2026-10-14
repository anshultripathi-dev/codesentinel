import { useMemo } from "react";
import { ClipboardCopy, Download, FileText, Printer } from "lucide-react";
import { useApp } from "../state.jsx";
import { Badge, Empty, GradeRing, PageHeader } from "../components/ui.jsx";
import { FAMILY_INFO, GRADE_TONE, ccBandCounts, downloadCSV, findings, grade, modelLabel, num, pct, recommendations } from "../utils.js";

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Executive summary of the current run. The print stylesheet hides app chrome, so "Print / Save as PDF" yields a clean document.
export default function Report({ go }) {
  const { run, stats, settings, activeModel, toast } = useApp();

  const top = useMemo(() => (stats ? [...stats.funcs].sort((a, b) => b.defect_probability - a.defect_probability).slice(0, 15) : []), [stats]);
  const bands = useMemo(() => (stats ? ccBandCounts(stats.funcs) : []), [stats]);
  const tips = useMemo(() => (stats && run ? findings(stats, run) : []), [stats, run]);
  const dirs = useMemo(() => {
    if (!stats) return [];
    const m = {};
    stats.funcs.forEach((f) => { (m[f.dir] ||= []).push(f); });
    return Object.entries(m).map(([dir, fs]) => ({ dir, n: fs.length, high: fs.filter((f) => f.risk === "high").length,
      avg: fs.reduce((a, f) => a + f.defect_probability, 0) / fs.length })).sort((a, b) => b.avg - a.avg).slice(0, 8);
  }, [stats]);

  if (!run || !stats) {
    return (<><PageHeader title="Report" /><div className="panel"><Empty icon={FileText} title="No analysis yet" text="Run an analysis to generate a report."
      action={<button className="btn primary" onClick={() => go("analyze")}>New analysis</button>} /></div></>);
  }

  const q = stats.quality, letter = grade(q);
  const markdown = () => [
    `# CodeSentinel report: ${run.name}`,
    `Run #${run.id} · ${run.created} · model ${modelLabel(run.model)}`,
    "",
    `**Quality score:** ${q}/100 (grade ${letter})  `,
    `**Files:** ${stats.files} · **Functions:** ${stats.n} · **High risk:** ${stats.high} · **Anomalies:** ${stats.anomalies}`,
    "",
    "## Findings", ...tips.map((t) => `- ${t.text}`),
    "",
    "## Top risky functions",
    "| Function | Location | Risk | CC | LOC |", "|---|---|---|---|---|",
    ...top.map((f) => `| \`${f.name}\` | ${f.file}:${f.start_line} | ${pct(f.defect_probability, 1)} | ${f.cyclomatic} | ${f.loc_total} |`),
  ].join("\n");

  return (
    <>
      <PageHeader title="Report" subtitle="Shareable summary of the current run"
        actions={(
          <div className="btn-row no-print">
            <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(markdown()); toast("Markdown copied to clipboard", "good"); } catch { toast("Clipboard unavailable", "bad"); } }}>
              <ClipboardCopy size={16} /> Copy Markdown</button>
            <button className="btn" onClick={() => download(`codesentinel-run-${run.id}.json`, JSON.stringify(run, null, 2), "application/json")}><Download size={16} /> JSON</button>
            <button className="btn" onClick={() => downloadCSV(`codesentinel-top-risk-${run.id}.csv`, top.map((f) => ({ file: f.file, function: f.name, line: f.start_line, risk: f.defect_probability, cyclomatic: f.cyclomatic, loc: f.loc_total })))}><Download size={16} /> Top-risk CSV</button>
            <button className="btn primary" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button>
          </div>
        )} />

      <article className="report">
        <header className="report-head">
          <div>
            <p className="muted small">CodeSentinel · Quality & defect-risk report</p>
            <h2>{run.name}</h2>
            <p className="muted small">Run #{run.id} · {run.created} · {modelLabel(activeModel || run.model)} ({FAMILY_INFO[run.summary.family]?.label ?? run.summary.family})</p>
          </div>
          <GradeRing value={q} letter={letter} tone={GRADE_TONE[letter]} size={96} />
        </header>

        <section className="report-kpis">
          {[["Quality score", `${q}/100`], ["Files", num(stats.files)], ["Functions", num(stats.n)], ["Lines of code", num(stats.totalLoc)],
            ["High risk", `${num(stats.high)} (${pct(stats.n ? stats.high / stats.n : 0, 1)})`], ["Anomalies", num(stats.anomalies)]].map(([k, v]) => (
            <div key={k}><span className="muted small">{k}</span><b>{v}</b></div>))}
        </section>

        <section><h3>Key findings</h3><ul className="findings plain">{tips.map((t, i) => <li key={i}>{t.text}</li>)}</ul></section>

        <section>
          <h3>Highest-risk functions</h3>
          <table className="table compact">
            <thead><tr><th>Function</th><th>Location</th><th>Risk</th><th className="r">CC</th><th className="r">LOC</th><th>Suggested action</th></tr></thead>
            <tbody>{top.map((f, i) => (
              <tr key={i}><td><code>{f.name}</code></td><td className="small">{f.file}:{f.start_line}</td>
                <td><Badge risk={f.risk}>{pct(f.defect_probability, 1)}</Badge></td><td className="r">{f.cyclomatic}</td><td className="r">{f.loc_total}</td>
                <td className="small">{recommendations(f)[0].text}</td></tr>))}</tbody>
          </table>
        </section>

        <div className="report-cols">
          <section>
            <h3>Complexity distribution</h3>
            <table className="table compact">
              <thead><tr><th>Cyclomatic band</th><th className="r">Functions</th><th className="r">High risk</th></tr></thead>
              <tbody>{bands.map((b) => <tr key={b.band}><td>{b.label}</td><td className="r">{b.total}</td><td className="r">{b.high}</td></tr>)}</tbody>
            </table>
          </section>
          <section>
            <h3>Riskiest directories</h3>
            <table className="table compact">
              <thead><tr><th>Directory</th><th className="r">Functions</th><th className="r">Avg risk</th></tr></thead>
              <tbody>{dirs.map((d) => <tr key={d.dir}><td className="ellipsis" title={d.dir}>{d.dir}</td><td className="r">{d.n}</td><td className="r">{pct(d.avg, 1)}</td></tr>)}</tbody>
            </table>
          </section>
        </div>

        <section className="muted small">
          <h3>Method & caveats</h3>
          <p>Metrics (cyclomatic complexity, Halstead, LOC, comment ratio) are extracted per function and scored by a defect-prediction model. {FAMILY_INFO[run.summary.family]?.blurb}
            {" "}Risk bands: high ≥ {pct(settings.high, 1)}, medium ≥ {pct(settings.medium, 1)}. Metrics-only prediction is a prioritisation aid for code review, not a release gate.</p>
        </section>
      </article>
    </>
  );
}

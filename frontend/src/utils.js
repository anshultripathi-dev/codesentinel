export const FEATURE_META = {
  loc_total: { label: "Lines of code", short: "LOC", hint: "Total lines in the function" },
  loc_executable: { label: "Executable LOC", short: "Exec LOC", hint: "Non-blank, non-comment lines" },
  cyclomatic: { label: "Cyclomatic complexity", short: "CC", hint: "Independent paths through the code" },
  halstead_volume: { label: "Halstead volume", short: "H. volume", hint: "Size of the implementation in bits" },
  halstead_difficulty: { label: "Halstead difficulty", short: "H. difficulty", hint: "How error-prone to write or understand" },
  halstead_effort: { label: "Halstead effort", short: "H. effort", hint: "Mental effort to develop" },
  param_count: { label: "Parameters", short: "Params", hint: "Number of function parameters" },
  comment_pct: { label: "Comment %", short: "Comments", hint: "Share of lines that are comments" },
};

export const featLabel = (f) => FEATURE_META[f]?.label ?? f.replaceAll("_", " ");
export const modelLabel = (m) => m.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const pct = (x, d = 0) => (x == null || Number.isNaN(x) ? "–" : `${(x * 100).toFixed(d)}%`);
export const fix = (x, d = 3) => (x == null || Number.isNaN(x) ? "–" : Number(x).toFixed(d));
export const num = (x) => (x >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : x >= 1e4 ? `${(x / 1e3).toFixed(0)}k` : Number(x).toLocaleString(undefined, { maximumFractionDigits: 1 }));

// high/medium are null until the user overrides them: the calibrated thresholds shipped with each model family apply.
export const DEFAULT_SETTINGS = { high: null, medium: null, family: "python", model: "", minLoc: 1, theme: "dark" };

export const FAMILY_INFO = {
  python: { label: "Python-native", blurb: "Trained on functions mined from 12 open-source Python repos; risk = fixed by a bug-fix commit within 12 months." },
  nasa: { label: "NASA C/C++", blurb: "Trained on NASA MDP modules (C/C++). Classic benchmark, but applied to Python it is out of domain." },
};

export const riskOf = (p, s) => (p >= s.high ? "high" : p >= s.medium ? "medium" : "low");
export const RISK_COLOR = { high: "#f43f5e", medium: "#f59e0b", low: "#10b981" };

export function flatten(run) {
  if (!run) return [];
  return run.files.flatMap((f) =>
    f.functions.map((fn) => ({ ...fn, file: f.file, dir: f.file.includes("/") ? f.file.split("/").slice(0, -1).join("/") : "." })),
  );
}

export function computeStats(run, settings) {
  const funcs = flatten(run).filter((f) => f.loc_total >= settings.minLoc);
  const n = funcs.length;
  const withRisk = funcs.map((f) => ({ ...f, risk: riskOf(f.defect_probability, settings) }));
  const totalLoc = withRisk.reduce((a, f) => a + f.loc_total, 0) || 1;
  const weighted = withRisk.reduce((a, f) => a + f.defect_probability * f.loc_total, 0) / totalLoc;
  const mis = run.files.map((f) => f.maintainability_index).filter((x) => x != null);
  return {
    funcs: withRisk,
    n,
    high: withRisk.filter((f) => f.risk === "high").length,
    medium: withRisk.filter((f) => f.risk === "medium").length,
    low: withRisk.filter((f) => f.risk === "low").length,
    anomalies: withRisk.filter((f) => f.anomaly).length,
    quality: Math.round(100 * (1 - weighted)),
    avgCC: n ? withRisk.reduce((a, f) => a + f.cyclomatic, 0) / n : 0,
    totalLoc: run.files.reduce((a, f) => a + f.loc, 0),
    avgMI: mis.length ? mis.reduce((a, b) => a + b, 0) / mis.length : null,
    files: run.files.length,
  };
}

export function percentileOf(value, arr) {
  if (!arr) return 0;
  for (let i = 0; i < arr.length; i++) if (value <= arr[i]) return i * 5;
  return 100;
}

export function recommendations(f) {
  const r = [];
  if (f.cyclomatic >= 15) r.push({ sev: "high", text: `Cyclomatic complexity is ${f.cyclomatic}. Split into smaller functions (target ≤ 10).` });
  else if (f.cyclomatic >= 10) r.push({ sev: "medium", text: `Cyclomatic complexity is ${f.cyclomatic}. Consider extracting branches into helpers.` });
  if (f.loc_total >= 60) r.push({ sev: "high", text: `${f.loc_total} lines long. Long functions are harder to test and review.` });
  if (f.param_count >= 5) r.push({ sev: "medium", text: `${f.param_count} parameters. Group related ones into an object.` });
  if (f.halstead_volume >= 1500) r.push({ sev: "medium", text: "High Halstead volume. Simplify expressions and reduce distinct operators." });
  if (f.comment_pct < 5 && f.loc_total >= 20) r.push({ sev: "low", text: "Almost no comments. Document intent and edge cases." });
  if (f.anomaly) r.push({ sev: "medium", text: "Structurally unusual versus the training corpus. Worth a manual review." });
  if (!r.length) r.push({ sev: "low", text: "No structural red flags. Keep tests in place." });
  return r;
}

export function downloadCSV(name, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---- Analytics helpers (all derived client-side from a run) ----

export const grade = (q) => (q >= 90 ? "A" : q >= 80 ? "B" : q >= 70 ? "C" : q >= 60 ? "D" : "F");
export const GRADE_TONE = { A: "good", B: "good", C: "warn", D: "warn", F: "bad" };

// Cumulative risk captured when reviewing functions from riskiest down. x = % of functions, y = % of total risk mass.
export function paretoCurve(funcs, steps = 50) {
  const sorted = [...funcs].sort((a, b) => b.defect_probability - a.defect_probability);
  const total = sorted.reduce((a, f) => a + f.defect_probability, 0) || 1;
  const n = sorted.length;
  if (!n) return [];
  const out = [{ reviewed: 0, captured: 0, random: 0 }];
  let acc = 0, i = 0;
  for (let s = 1; s <= steps; s++) {
    const upTo = Math.round((n * s) / steps);
    while (i < upTo) acc += sorted[i++].defect_probability;
    out.push({ reviewed: +((100 * s) / steps).toFixed(1), captured: +((100 * acc) / total).toFixed(1), random: +((100 * s) / steps).toFixed(1) });
  }
  return out;
}

export const CC_BANDS = [
  { id: "1-5", label: "1–5 simple", max: 5 },
  { id: "6-10", label: "6–10 moderate", max: 10 },
  { id: "11-20", label: "11–20 complex", max: 20 },
  { id: "21-50", label: "21–50 very complex", max: 50 },
  { id: "50+", label: "50+ untestable", max: Infinity },
];
export const ccBand = (cc) => CC_BANDS.find((b) => cc <= b.max).id;

export function ccBandCounts(funcs) {
  const rows = CC_BANDS.map((b) => ({ band: b.id, label: b.label, high: 0, medium: 0, low: 0, total: 0 }));
  funcs.forEach((f) => { const r = rows.find((x) => x.band === ccBand(f.cyclomatic)); r[f.risk]++; r.total++; });
  return rows;
}

// Maintainability index bands, using radon's A/B/C ranks on its 0-100 scale.
export const MI_BANDS = [
  { id: "A", label: "A · easy (≥ 85)", min: 85, color: "#10b981" },
  { id: "B", label: "B · moderate (65–85)", min: 65, color: "#f59e0b" },
  { id: "C", label: "C · hard (< 65)", min: -Infinity, color: "#f43f5e" },
];
export const miBand = (mi) => MI_BANDS.find((b) => mi >= b.min).id;

export const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Plain-language summary lines for the report and overview.
export function findings(stats, run) {
  const out = [];
  if (!stats.n) return out;
  const top10 = [...stats.funcs].sort((a, b) => b.defect_probability - a.defect_probability);
  const k = Math.max(1, Math.ceil(stats.n * 0.1));
  const total = top10.reduce((a, f) => a + f.defect_probability, 0) || 1;
  const share = top10.slice(0, k).reduce((a, f) => a + f.defect_probability, 0) / total;
  out.push({ tone: "info", text: `Reviewing the riskiest 10% of functions (${k.toLocaleString()}) covers ${(share * 100).toFixed(0)}% of the total predicted risk.` });
  const complex = stats.funcs.filter((f) => f.cyclomatic > 20).length;
  if (complex) out.push({ tone: "bad", text: `${complex} function${complex > 1 ? "s" : ""} exceed cyclomatic complexity 20 and are hard to test exhaustively.` });
  const long = stats.funcs.filter((f) => f.loc_total >= 60).length;
  if (long) out.push({ tone: "warn", text: `${long} function${long > 1 ? "s are" : " is"} 60+ lines long; consider splitting.` });
  const hardFiles = run.files.filter((f) => f.maintainability_index != null && f.maintainability_index < 65).length;
  if (hardFiles) out.push({ tone: "warn", text: `${hardFiles} file${hardFiles > 1 ? "s have" : " has"} a maintainability index below 65 (hard to maintain).` });
  if (stats.anomalies) out.push({ tone: "info", text: `${stats.anomalies} functions look structurally unusual versus the training corpus and merit a manual look.` });
  if (!complex && !long && !hardFiles) out.push({ tone: "good", text: "No extreme complexity, length or maintainability outliers were found." });
  return out;
}

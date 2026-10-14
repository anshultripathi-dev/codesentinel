import { useRef, useState } from "react";
import { FlaskConical, FileArchive, ClipboardPaste, Loader2, UploadCloud } from "lucide-react";
import { useApp } from "../state.jsx";
import * as api from "../api.js";
import { PageHeader, Panel, Tabs } from "../components/ui.jsx";
import { FAMILY_INFO, modelLabel } from "../utils.js";

const SAMPLE = `def price(order, rules):
    total = 0
    for item in order["items"]:
        if item["qty"] > 0:
            if item["type"] == "book":
                total += item["qty"] * item["price"] * 0.9
            elif item["type"] == "food":
                if item.get("perishable"):
                    total += item["qty"] * item["price"] * 1.05
                else:
                    total += item["qty"] * item["price"]
            else:
                for r in rules:
                    if r["applies"](item) and r["active"]:
                        total += r["fn"](item)
                        break
    return total
`;

export default function Analyze({ go }) {
  const { models, activeModel, settings, setSettings, analyze, busy, error } = useApp();
  const [tab, setTab] = useState("zip");
  const [drag, setDrag] = useState(false);
  const [code, setCode] = useState(SAMPLE);
  const [filename, setFilename] = useState("snippet.py");
  const fileRef = useRef(null);
  const model = settings.model;
  const family = settings.family;

  const done = async (p) => { if (await p) go("overview"); };
  const onFile = (f) => f && done(analyze(() => api.analyzeZip(f, model, family)));

  return (
    <>
      <PageHeader title="New analysis" subtitle="Extract metrics and score defect risk with your chosen model" />
      <div className="grid g-3-2">
        <Panel>
          <Tabs value={tab} onChange={setTab} tabs={[
            { id: "zip", label: "Upload project" }, { id: "paste", label: "Paste code" }, { id: "demo", label: "Demo project" }]} />

          {tab === "zip" && (
            <div className={`drop ${drag ? "over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}>
              <UploadCloud size={40} strokeWidth={1.3} />
              <h3>Drop a .zip of your project</h3>
              <p className="muted">or click to browse. Python, Java, C/C++, JS/TS, Go and C# are parsed; up to 25 MB.</p>
              <input ref={fileRef} type="file" accept=".zip" hidden onChange={(e) => onFile(e.target.files[0])} />
            </div>
          )}

          {tab === "paste" && (
            <div className="stack">
              <input className="input" value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="filename.py" aria-label="Filename" />
              <textarea className="code" rows={14} value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} aria-label="Source code" />
              <div><button className="btn primary" disabled={busy || !code.trim()} onClick={() => done(analyze(() => api.analyzeSnippet(code, filename, model, family)))}>
                Analyze code</button></div>
            </div>
          )}

          {tab === "demo" && (
            <div className="stack">
              <div className="callout">
                <FlaskConical size={20} />
                <div>
                  <b>CPython standard library sample</b>
                  <p className="muted small">Analyzes the <code>json</code>, <code>http</code>, <code>email</code>, <code>unittest</code> and <code>logging</code> packages that ship with Python. Real, varied code with no upload needed.</p>
                </div>
              </div>
              <div><button className="btn primary" disabled={busy} onClick={() => done(analyze(() => api.analyzeDemo(model, family)))}>Run demo analysis</button></div>
            </div>
          )}

          {busy && <div className="status"><Loader2 className="spin" size={16} /> Extracting metrics and scoring functions…</div>}
          {error && <div className="alert">{error}</div>}
        </Panel>

        <div className="stack">
          <Panel title="Model family" subtitle="What the models were trained on">
            <div className="seg full">
              {Object.entries(FAMILY_INFO).map(([id, f]) => (
                <button key={id} className={family === id ? "active" : ""} onClick={() => setSettings({ family: id })}>{f.label}</button>))}
            </div>
            <p className="muted small" style={{ marginTop: 10 }}>{FAMILY_INFO[family]?.blurb}</p>
          </Panel>
          <Panel title="Model" subtitle="Which algorithm scores your code">
            <select className="input" value={model} onChange={(e) => setSettings({ model: e.target.value })} aria-label="Model">
              <option value="">Default · {modelLabel(models?.default_model ?? "…")}</option>
              {models?.leaderboard.map((m) => <option key={m.model} value={m.model}>{modelLabel(m.model)} · AUC {m.cross_project.auc_per_project_mean.toFixed(3)}</option>)}
            </select>
            <p className="muted small" style={{ marginTop: 10 }}>Currently using <b>{modelLabel(activeModel)}</b>. Compare all seven on the Models page.</p>
          </Panel>
          <Panel title="What happens">
            <ol className="steps">
              <li><b>Parse</b> source with radon and lizard.</li>
              <li><b>Extract</b> LOC, cyclomatic complexity and Halstead metrics per function.</li>
              <li><b>Score</b> defect probability and flag structural anomalies.</li>
              <li><b>Explain</b> the top drivers and give refactoring hints.</li>
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}

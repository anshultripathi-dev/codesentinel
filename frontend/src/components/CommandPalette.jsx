import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, FileCode2, History as HistoryIcon, Moon, PlayCircle, Search, Sun } from "lucide-react";
import { useApp } from "../state.jsx";
import { modelLabel, pct } from "../utils.js";

// Cmd/Ctrl+K launcher: jump to pages, switch runs, toggle theme, or find a function.
export default function CommandPalette({ open, onClose, nav, go }) {
  const { runs, openRun, stats, settings, setSettings, setPendingQuery } = useApp();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = [
      ...nav.map((i) => ({ key: `p-${i.id}`, group: "Pages", icon: i.icon, label: `Go to ${i.label}`, run: () => go(i.id) })),
      { key: "theme", group: "Actions", icon: settings.theme === "dark" ? Sun : Moon, label: `Switch to ${settings.theme === "dark" ? "light" : "dark"} theme`,
        run: () => setSettings({ theme: settings.theme === "dark" ? "light" : "dark" }) },
      { key: "new", group: "Actions", icon: PlayCircle, label: "Start a new analysis", run: () => go("analyze") },
      ...runs.slice(0, 8).map((r) => ({ key: `r-${r.id}`, group: "Runs", icon: HistoryIcon, label: `Open run #${r.id} · ${r.name}`,
        hint: modelLabel(r.model), run: async () => { await openRun(r.id); go("overview"); } })),
    ];
    const base = needle ? all.filter((i) => i.label.toLowerCase().includes(needle)) : all;
    const funcs = needle.length >= 2 && stats
      ? stats.funcs.filter((f) => f.name.toLowerCase().includes(needle) || f.file.toLowerCase().includes(needle))
        .sort((a, b) => b.defect_probability - a.defect_probability).slice(0, 6)
        .map((f, i) => ({ key: `f-${i}-${f.file}-${f.start_line}`, group: "Functions", icon: FileCode2, label: f.name,
          hint: `${f.file}:${f.start_line} · ${pct(f.defect_probability)}`, run: () => { setPendingQuery(f.name); go("results"); } }))
      : [];
    return [...base, ...funcs];
  }, [q, nav, runs, stats, settings.theme, go, openRun, setSettings, setPendingQuery]);

  useEffect(() => setIdx(0), [q]);
  if (!open) return null;

  const choose = (it) => { onClose(); it?.run(); };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(items[idx]); }
    else if (e.key === "Escape") onClose();
  };

  let last = "";
  return (
    <div className="palette-scrim" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="palette-input">
          <Search size={16} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages, runs, functions…" aria-label="Command search" />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list">
          {items.length === 0 && <div className="muted center">No matches</div>}
          {items.map((it, i) => {
            const head = it.group !== last ? <div className="palette-group">{(last = it.group)}</div> : null;
            return (
              <div key={it.key}>
                {head}
                <button className={`palette-item ${i === idx ? "active" : ""}`} onMouseEnter={() => setIdx(i)} onClick={() => choose(it)}>
                  <it.icon size={16} /><span className="ellipsis-flex">{it.label}</span>
                  {it.hint && <span className="muted small">{it.hint}</span>}
                  {i === idx && <CornerDownLeft size={13} className="muted" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot muted small"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> select</span></div>
      </div>
    </div>
  );
}

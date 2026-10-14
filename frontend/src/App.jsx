import { useEffect, useState } from "react";
import { BarChart3, Boxes, FileText, HeartPulse, History as HistoryIcon, LayoutDashboard, Menu, Microscope, Moon, PanelLeftClose, PanelLeftOpen, PlayCircle, Search, Settings as SettingsIcon, ShieldCheck, Sun, Table2 } from "lucide-react";
import { useApp } from "./state.jsx";
import Overview from "./pages/Overview.jsx";
import Analyze from "./pages/Analyze.jsx";
import Explorer from "./pages/Explorer.jsx";
import Insights from "./pages/Insights.jsx";
import Models from "./pages/Models.jsx";
import History from "./pages/History.jsx";
import Settings from "./pages/Settings.jsx";
import Health from "./pages/Health.jsx";
import Report from "./pages/Report.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import { Toasts } from "./components/ui.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { modelLabel } from "./utils.js";

const NAV = [
  { group: "Workspace", items: [
    { id: "overview", label: "Overview", icon: LayoutDashboard, page: Overview },
    { id: "analyze", label: "New analysis", icon: PlayCircle, page: Analyze },
    { id: "results", label: "Results", icon: Table2, page: Explorer } ] },
  { group: "Intelligence", items: [
    { id: "health", label: "Code health", icon: HeartPulse, page: Health },
    { id: "insights", label: "Insights", icon: Microscope, page: Insights },
    { id: "models", label: "Models", icon: Boxes, page: Models } ] },
  { group: "System", items: [
    { id: "report", label: "Report", icon: FileText, page: Report },
    { id: "history", label: "History", icon: HistoryIcon, page: History },
    { id: "settings", label: "Settings", icon: SettingsIcon, page: Settings } ] },
];
const ALL = NAV.flatMap((g) => g.items);

const readHash = () => (ALL.find((i) => `#/${i.id}` === window.location.hash) ?? ALL[0]).id;

export default function App() {
  const [route, setRoute] = useState(readHash);
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("cs.collapsed") === "1"; } catch { return false; } });
  const { run, runs, openRun, settings, setSettings, activeModel, apiDown, busy, stats, toasts, dismissToast } = useApp();
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem("cs.collapsed", c ? "0" : "1"); } catch { /* storage unavailable */ } return !c; });

  useEffect(() => {
    const on = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (id) => { window.location.hash = `#/${id}`; setOpen(false); window.scrollTo(0, 0); };
  const Page = ALL.find((i) => i.id === route).page;
  useEffect(() => { document.title = `${ALL.find((i) => i.id === route).label} · CodeSentinel`; }, [route]);

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand"><span className="logo"><ShieldCheck size={20} /></span><div><b>CodeSentinel</b><small>Quality intelligence</small></div></div>
        <nav>
          {NAV.map((g) => (
            <div key={g.group} className="nav-group">
              <div className="nav-title">{g.group}</div>
              {g.items.map((i) => (
                <button key={i.id} className={`nav-item ${route === i.id ? "active" : ""}`} onClick={() => go(i.id)} aria-current={route === i.id ? "page" : undefined}>
                  <i.icon size={17} /><span className="nav-label">{i.label}</span>
                  {i.id === "results" && stats && stats.high > 0 && <span className="nav-count">{stats.high > 999 ? "999+" : stats.high}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <div className={`dot ${apiDown ? "off" : "on"}`} /><span className="nav-label">{apiDown ? "API offline" : "API connected"}</span>
          <button className="icon-btn collapse-btn" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
        </div>
      </aside>
      {open && <div className="scrim show" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="crumb"><BarChart3 size={15} />{ALL.find((i) => i.id === route).label}</div>
          <button className="search-btn" onClick={() => setPalette(true)} aria-label="Open command palette">
            <Search size={14} /><span>Search or jump to…</span><kbd>⌘K</kbd></button>
          <div className="top-right">
            {runs.length > 0 && (
              <select className="input sm run-pick" value={run?.id ?? ""} onChange={(e) => openRun(+e.target.value)} aria-label="Current run">
                {!run && <option value="">Select run…</option>}
                {runs.map((r) => <option key={r.id} value={r.id}>#{r.id} · {r.name.slice(0, 32)}</option>)}
              </select>
            )}
            <span className="pill" title="Active scoring model">{modelLabel(activeModel || "…")}</span>
            <button className="icon-btn" onClick={() => setSettings({ theme: settings.theme === "dark" ? "light" : "dark" })} aria-label="Toggle theme">
              {settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </header>
        {busy && <div className="progress" />}
        <main className="content">
          {apiDown && <div className="alert">Cannot reach the API. Start it with <code>uvicorn backend.app.main:app --port 8000</code>. Retrying automatically.</div>}
          <ErrorBoundary key={route}><Page go={go} /></ErrorBoundary>
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} nav={ALL} go={go} />
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

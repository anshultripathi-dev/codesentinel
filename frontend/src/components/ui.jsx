import { ArrowDownRight, ArrowUpRight, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { RISK_COLOR } from "../utils.js";

export const Panel = ({ title, subtitle, actions, children, className = "", pad = true }) => (
  <section className={`panel ${className}`}>
    {(title || actions) && (
      <div className="panel-head">
        <div>
          {title && <h3>{title}</h3>}
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        {actions && <div className="panel-actions">{actions}</div>}
      </div>
    )}
    <div className={pad ? "panel-body" : ""}>{children}</div>
  </section>
);

// `delta` is the change since the previous run; `lowerIsBetter` flips the good/bad colouring.
export const Kpi = ({ icon: Icon, label, value, sub, tone, delta, lowerIsBetter, fmtDelta = (d) => d }) => (
  <div className="kpi">
    <div className="kpi-top">
      <span className="kpi-label">{label}</span>
      {Icon && <span className={`kpi-icon ${tone || ""}`}><Icon size={16} /></span>}
    </div>
    <div className="kpi-value">{value}</div>
    <div className="kpi-sub">
      {sub}
      {delta != null && delta !== 0 && (
        <span className={`delta ${(delta < 0) === !!lowerIsBetter ? "good" : "bad"}`} title="Change since the previous run of this project">
          {delta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{fmtDelta(Math.abs(delta))}
        </span>
      )}
    </div>
  </div>
);

export const Skeleton = ({ h = 16, w = "100%", r = 6, className = "" }) => (
  <div className={`skeleton ${className}`} style={{ height: h, width: w, borderRadius: r }} />
);

export const PageSkeleton = () => (
  <div className="stack" aria-busy="true" aria-label="Loading">
    <Skeleton h={30} w={220} />
    <div className="kpis">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={92} r={12} />)}</div>
    <div className="grid g-3-2"><Skeleton h={360} r={12} /><Skeleton h={360} r={12} /></div>
  </div>
);

const TOAST_ICON = { good: CheckCircle2, bad: XCircle, info: Info };
export const Toasts = ({ toasts, onDismiss }) => (
  <div className="toasts" role="status" aria-live="polite">
    {toasts.map((t) => {
      const I = TOAST_ICON[t.tone] ?? Info;
      return (
        <div key={t.id} className={`toast ${t.tone}`}>
          <I size={16} /><span>{t.text}</span>
          <button className="icon-btn" onClick={() => onDismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      );
    })}
  </div>
);

// Letter grade ring, e.g. quality 92 -> "A".
export function GradeRing({ value, letter, tone, size = 76 }) {
  const r = 30, c = 2 * Math.PI * r;
  const color = tone === "good" ? "var(--good)" : tone === "warn" ? "var(--warn)" : "var(--bad)";
  return (
    <svg viewBox="0 0 76 76" width={size} height={size} role="img" aria-label={`Grade ${letter}, score ${value}`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 38 38)" style={{ transition: "stroke-dasharray .8s ease" }} />
      <text x="38" y="46" textAnchor="middle" fontSize="24" fontWeight="700" fill={color}>{letter}</text>
    </svg>
  );
}

export const Badge = ({ risk, children }) => (
  <span className={`badge badge-${risk}`}>{children ?? risk}</span>
);

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="page-head">
    <div>
      <h1>{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

export const Empty = ({ icon: Icon, title, text, action }) => (
  <div className="empty">
    {Icon && <Icon size={36} strokeWidth={1.4} />}
    <h3>{title}</h3>
    <p className="muted">{text}</p>
    {action}
  </div>
);

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs" role="tablist">
    {tabs.map((t) => (
      <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? "active" : ""} onClick={() => onChange(t.id)}>
        {t.label}
      </button>
    ))}
  </div>
);

export const Drawer = ({ open, onClose, title, children }) => (
  <>
    <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} />
    <aside className={`drawer ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="drawer-head">
        <h3>{title}</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="drawer-body">{open && children}</div>
    </aside>
  </>
);

export function Gauge({ value, level }) {
  const r = 52, c = 2 * Math.PI * r, color = RISK_COLOR[level];
  return (
    <svg viewBox="0 0 130 130" width="130" height="130" role="img" aria-label={`Risk ${Math.round(value * 100)}%`}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${c * value} ${c}`} transform="rotate(-90 65 65)" />
      <text x="65" y="63" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--fg)">{Math.round(value * 100)}%</text>
      <text x="65" y="82" textAnchor="middle" fontSize="11" fill="var(--muted)">defect risk</text>
    </svg>
  );
}

// Generic heatmap; `scale(v)` returns a background colour.
export function Heatmap({ labels, rows, matrix, scale, fmt = (v) => (v == null ? "–" : v.toFixed(2)), cell = 56 }) {
  return (
    <div className="heat-wrap">
      <table className="heat">
        <thead>
          <tr><th />{labels.map((l) => <th key={l} className="heat-col"><span>{l}</span></th>)}</tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th className="heat-row">{(rows || labels)[i]}</th>
              {row.map((v, j) => (
                <td key={j} style={{ background: scale(v), width: cell, minWidth: cell }} title={`${(rows || labels)[i]} × ${labels[j]}: ${fmt(v)}`}>
                  {fmt(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const ChartTooltip = ({ active, payload, label, fmt, labelFmt }) =>
  active && payload?.length ? (
    <div className="tooltip">
      {label != null && <div className="tooltip-title">{labelFmt ? labelFmt(label, payload) : label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey ?? p.name} className="tooltip-row">
          <i style={{ background: p.color || p.fill }} />
          {p.name}: <b>{fmt ? fmt(p.value) : p.value}</b>
        </div>
      ))}
    </div>
  ) : null;

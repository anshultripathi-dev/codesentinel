"""Exploratory data analysis over the training corpus (Module 3: data collection & analysis)."""
from __future__ import annotations

from functools import lru_cache

import numpy as np

from .data import load_family

CC_BINS = [(1, 2), (3, 5), (6, 10), (11, 20), (21, 50), (51, 10**6)]
LOC_BINS = [(1, 5), (6, 15), (16, 30), (31, 60), (61, 120), (121, 10**6)]


def _bin_label(lo, hi):
    return f"{lo}+" if hi >= 10**6 else (str(lo) if lo == hi else f"{lo}-{hi}")


def _rate_by_bins(values, y, bins):
    out = []
    for lo, hi in bins:
        m = (values >= lo) & (values <= hi)
        out.append({"bin": _bin_label(lo, hi), "n": int(m.sum()),
                    "defect_rate": round(float(y[m].mean()), 4) if m.any() else 0.0})
    return out


@lru_cache(maxsize=None)
def compute(family: str = "python") -> dict:
    df, FUNC_FEATURES = load_family(family)
    y = df["defective"].values

    summary = []
    for f in FUNC_FEATURES:
        v = df[f]
        summary.append({
            "feature": f, "mean": round(float(v.mean()), 2), "median": round(float(v.median()), 2),
            "p90": round(float(v.quantile(.9)), 2), "p99": round(float(v.quantile(.99)), 2),
            "mean_defective": round(float(v[y == 1].mean()), 2), "mean_clean": round(float(v[y == 0].mean()), 2),
        })

    cols = FUNC_FEATURES + ["defective"]
    corr = df[cols].corr(method="spearman").round(3)

    hists = {}
    for f in FUNC_FEATURES:
        v = np.log1p(df[f].clip(lower=0).values)
        edges = np.linspace(v.min(), np.percentile(v, 99.5), 13)
        hc, _ = np.histogram(v[y == 0], bins=edges)
        hd, _ = np.histogram(v[y == 1], bins=edges)
        hists[f] = [{"x": round(float(np.expm1(edges[i])), 1), "clean": int(hc[i]), "defective": int(hd[i])}
                    for i in range(len(hc))]

    # Percentile lookup so the UI can say "more complex than 93% of NASA modules".
    percentiles = {f: np.percentile(df[f].values, np.arange(0, 101, 5)).round(3).tolist() for f in FUNC_FEATURES}

    return {
        "family": family, "n": int(len(df)), "defect_rate": round(float(y.mean()), 4),
        "projects": [{"project": p, "n": int(len(g)), "defect_rate": round(float(g["defective"].mean()), 4)}
                     for p, g in df.groupby("project")],
        "summary": summary,
        "correlation": {"labels": cols, "matrix": corr.values.tolist()},
        "defect_rate_by_cc": _rate_by_bins(df["cyclomatic"].values, y, CC_BINS),
        "defect_rate_by_loc": _rate_by_bins(df["loc_total"].values, y, LOC_BINS),
        "histograms": hists,
        "percentiles": percentiles,
    }

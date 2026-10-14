"""Inference: score functions with any trained model of a family, plus anomaly + explanation."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np

ART = Path(__file__).resolve().parents[3] / "ml" / "artifacts"
DEFAULT_FAMILY = "python"


def families() -> list[str]:
    return sorted(p.parent.name for p in ART.glob("*/leaderboard.json"))


@lru_cache(maxsize=None)
def _load(name: str, family: str) -> dict:
    return joblib.load(ART / family / f"{name}.joblib")


@lru_cache(maxsize=None)
def leaderboard(family: str = DEFAULT_FAMILY) -> dict:
    return json.loads((ART / family / "leaderboard.json").read_text())


def model_names(family: str = DEFAULT_FAMILY) -> list[str]:
    return [r["model"] for r in leaderboard(family)["leaderboard"]]


def _matrix(funcs: list[dict], features: list[str]) -> np.ndarray:
    return np.array([[f[k] for k in features] for f in funcs], dtype=float)


def risk_level(p: float, family: str) -> str:
    t = leaderboard(family)["risk_thresholds"]
    return "high" if p >= t["high"] else "medium" if p >= t["medium"] else "low"


def explain(X: np.ndarray, family: str) -> list[list[dict]]:
    """Per-feature contribution to risk from the interpretable logistic model:
    coefficient x standardised(log1p(value)). Positive pushes risk up."""
    bundle = _load("logistic_regression", family)
    scaler, lr = bundle["model"].steps[1][1], bundle["model"].steps[2][1]
    feats = bundle["features"]
    contrib = scaler.transform(np.log1p(np.clip(X, 0, None))) * lr.coef_[0]
    return [[{"feature": feats[i], "impact": round(float(row[i]), 3)} for i in np.argsort(-np.abs(row))[:3]]
            for row in contrib]


def score(funcs: list[dict], model: str | None = None, family: str = DEFAULT_FAMILY) -> list[dict]:
    """Return funcs annotated with probability, risk level, anomaly flag, drivers."""
    if not funcs:
        return []
    model = model or leaderboard(family)["default_model"]
    bundle = _load(model, family)
    X = _matrix(funcs, bundle["features"])
    probs = bundle["model"].predict_proba(X)[:, 1]
    raw = _load("anomaly_isolation_forest", family)["model"].decision_function(X)
    # Real code sits off the training distribution, so an absolute cutoff flags nearly everything.
    # In a real run, flag the ~5% most unusual relative to the run itself.
    anomalous = raw <= np.percentile(raw, 5) if len(raw) >= 20 else raw < 0
    drivers = explain(X, family)
    return [{**f, "defect_probability": round(float(p), 4), "predicted_defective": bool(p >= bundle["threshold"]),
             "risk": risk_level(float(p), family), "anomaly": bool(a), "drivers": d}
            for f, p, a, d in zip(funcs, probs, anomalous, drivers)]


def compare_models(funcs: list[dict], family: str = DEFAULT_FAMILY) -> dict[str, list[float]]:
    out = {}
    for n in model_names(family):
        b = _load(n, family)
        out[n] = [round(float(p), 4) for p in b["model"].predict_proba(_matrix(funcs, b["features"]))[:, 1]]
    return out

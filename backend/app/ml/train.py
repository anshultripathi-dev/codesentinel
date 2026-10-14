"""Train and benchmark defect-prediction models for a data family.

Families:
  nasa    C/C++ modules from NASA MDP (module-level, ~19% defective)
  python  Python functions mined from git history (function-level, time-forward labels)

Evaluations (per model):
  within    grouped CV: no file (python) / module (nasa) appears in both train and test
  cross     leave-one-project-out: train on N-1 projects, test on the held-out one
  temporal  (python only) train on early snapshots, test on later ones

Artifacts go to ml/artifacts/<family>/. Run: python -m backend.app.ml.train [python|nasa]
"""
from __future__ import annotations

import json
import sys
import time
import warnings
from pathlib import Path

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import (HistGradientBoostingClassifier, IsolationForest,
                              RandomForestClassifier, StackingClassifier)
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, confusion_matrix, f1_score,
                             matthews_corrcoef, precision_score, recall_score, roc_auc_score, roc_curve)
from sklearn.model_selection import StratifiedGroupKFold, cross_val_predict
from sklearn.naive_bayes import GaussianNB
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler
from sklearn.svm import SVC, LinearSVC

from .data import load_family
from .transforms import log1p_clip

ART_ROOT = Path(__file__).resolve().parents[3] / "ml" / "artifacts"
SEED = 42
TEMPORAL_SPLIT = ("2021-01-01", "2021-07-01", "2022-01-01")  # train snapshots; the rest are test


def _prep():
    # Metrics are heavy-tailed; log-transform then standardise.
    return [FunctionTransformer(log1p_clip), StandardScaler()]


def _rf():
    return RandomForestClassifier(n_estimators=100, class_weight="balanced_subsample",
                                  min_samples_leaf=5, n_jobs=-1, random_state=SEED)


def _cal(est):
    """Class weights fix ranking on rare positives but inflate probabilities; sigmoid calibration
    maps scores back to real frequencies so a displayed 12% actually means about 12%."""
    return CalibratedClassifierCV(est, method="sigmoid", cv=3)


def build_models(family: str) -> dict:
    rf = _rf()
    hgb = HistGradientBoostingClassifier(class_weight="balanced", max_depth=4,
                                         learning_rate=0.05, max_iter=200, random_state=SEED)
    # Unweighted logistic regression is calibrated by construction.
    lr = make_pipeline(*_prep(), LogisticRegression(max_iter=1000))
    # RBF-SVM is O(n^2): fine for 12k NASA modules, too slow for the larger Python set.
    svm = ("svm_rbf", make_pipeline(*_prep(), SVC(class_weight="balanced", probability=True, random_state=SEED))) \
        if family == "nasa" else \
        ("svm_linear", make_pipeline(*_prep(), CalibratedClassifierCV(
            LinearSVC(class_weight="balanced", dual=False), cv=3)))
    return {
        "logistic_regression": lr,
        "naive_bayes": make_pipeline(*_prep(), _cal(GaussianNB())),
        svm[0]: svm[1],
        "random_forest": _cal(rf),
        "gradient_boosting": _cal(hgb),
        "mlp": make_pipeline(*_prep(), MLPClassifier((32, 16), max_iter=300, early_stopping=True, random_state=SEED)),
        "stacking_ensemble": StackingClassifier(
            estimators=[("lr", lr), ("rf", rf), ("hgb", hgb)],
            final_estimator=LogisticRegression(max_iter=1000), cv=3, n_jobs=1),
    }


def _best_threshold(y, p):
    """Threshold maximising F1 (imbalanced data: 0.5 is a poor default)."""
    ts = np.unique(np.quantile(p, np.linspace(0.5, 0.995, 100)))
    return float(ts[int(np.argmax([f1_score(y, p >= t, zero_division=0) for t in ts]))])


def _scores(y, p, thr):
    yhat = (p >= thr).astype(int)
    return {
        "auc": roc_auc_score(y, p), "pr_auc": average_precision_score(y, p),
        "f1": f1_score(y, yhat, zero_division=0), "mcc": matthews_corrcoef(y, yhat),
        "precision": precision_score(y, yhat, zero_division=0), "recall": recall_score(y, yhat, zero_division=0),
        # share of all defects found among the riskiest 10% of functions: a review-effort metric
        "recall_at_10pct": float(y[np.argsort(-p)[: max(1, len(p) // 10)]].sum() / max(y.sum(), 1)),
    }


def _roc(y, p, n=40):
    fpr, tpr, _ = roc_curve(y, p)
    grid = np.linspace(0, 1, n)
    return {"fpr": grid.round(4).tolist(), "tpr": np.interp(grid, fpr, tpr).round(4).tolist()}


def _confusion(y, p, thr):
    tn, fp, fn, tp = confusion_matrix(y, (p >= thr).astype(int)).ravel()
    return {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}


def main(family: str = "python"):
    warnings.filterwarnings("ignore")
    art = ART_ROOT / family
    art.mkdir(parents=True, exist_ok=True)
    df, features = load_family(family)
    X, y = df[features].values, df["defective"].values
    projects, groups = df["project"].values, df["group"].values
    plist = sorted(set(projects))
    print(f"[{family}] {len(df)} rows, {y.mean():.1%} defective, {len(plist)} projects", flush=True)

    temporal = None
    if family == "python":
        tr = df["snapshot"].isin(TEMPORAL_SPLIT).values
        temporal = (tr, ~tr)

    cv = StratifiedGroupKFold(5, shuffle=True, random_state=SEED)
    board, oof_by_model = [], {}
    for name in build_models(family):
        t0 = time.time()
        oof = cross_val_predict(build_models(family)[name], X, y, groups=groups, cv=cv, method="predict_proba")[:, 1]
        thr = _best_threshold(y, oof)
        within = _scores(y, oof, thr)

        cp = np.zeros(len(y))
        for proj in plist:
            te = projects == proj
            cp[te] = build_models(family)[name].fit(X[~te], y[~te]).predict_proba(X[te])[:, 1]
        cross = _scores(y, cp, thr)
        per_project = {g: float(roc_auc_score(y[projects == g], cp[projects == g]))
                       for g in plist if 0 < y[projects == g].sum() < (projects == g).sum()}
        cross["auc_per_project_mean"] = float(np.mean(list(per_project.values())))

        entry = {"model": name, "threshold": thr, "within_project": within, "cross_project": cross,
                 "per_project_auc": per_project,
                 "roc_within": _roc(y, oof), "roc_cross": _roc(y, cp),
                 "confusion_within": _confusion(y, oof, thr), "confusion_cross": _confusion(y, cp, thr)}
        if temporal:
            tr, te = temporal
            tp = build_models(family)[name].fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]
            entry["temporal"] = _scores(y[te], tp, _best_threshold(y[tr], oof[tr]))
        oof_by_model[name] = oof

        final = build_models(family)[name].fit(X, y)
        joblib.dump({"model": final, "threshold": thr, "features": features}, art / f"{name}.joblib")
        entry["seconds"] = round(time.time() - t0, 1)
        board.append(entry)
        extra = f" temporal AUC={entry['temporal']['auc']:.3f}" if temporal else ""
        print(f"{name:20s} within AUC={within['auc']:.3f} PR={within['pr_auc']:.3f} | "
              f"cross AUC={cross['auc_per_project_mean']:.3f} R@10%={cross['recall_at_10pct']:.2f}{extra} ({entry['seconds']}s)", flush=True)

    board.sort(key=lambda r: r["cross_project"]["auc_per_project_mean"], reverse=True)
    # Default = best cross-project AUC, except that logistic regression wins ties (within 0.005 AUC):
    # it is calibrated, fast, and is the model that powers the per-function explanations.
    default = board[0]["model"]
    lr_row = next(r for r in board if r["model"] == "logistic_regression")
    if lr_row["cross_project"]["auc_per_project_mean"] >= board[0]["cross_project"]["auc_per_project_mean"] - 0.005:
        default = "logistic_regression"

    # Risk levels are relative to the data: top 5% of out-of-fold scores is "high", next 10% "medium".
    # A fixed 0.4 cut-off would never fire on a 5%-defective dataset.
    oof_default = oof_by_model[default]
    risk_thresholds = {"high": float(np.quantile(oof_default, 0.95)), "medium": float(np.quantile(oof_default, 0.85))}

    iso = make_pipeline(*_prep(), IsolationForest(n_estimators=200, contamination=0.05, random_state=SEED)).fit(X)
    joblib.dump({"model": iso, "features": features}, art / "anomaly_isolation_forest.joblib")

    lr_pipe = joblib.load(art / "logistic_regression.joblib")["model"]
    rf = _rf().fit(X, y)  # plain forest, only for importances (the saved one is wrapped by calibration)
    meta = {
        "family": family, "n_modules": int(len(df)), "defect_rate": float(y.mean()), "projects": plist,
        "features": features, "default_model": default, "risk_thresholds": risk_thresholds,
        "feature_importance": {
            "random_forest": dict(zip(features, map(float, rf.feature_importances_))),
            "logistic_regression": dict(zip(features, map(float, np.abs(lr_pipe.steps[2][1].coef_[0])))),
        },
        "leaderboard": board,
    }
    (art / "leaderboard.json").write_text(json.dumps(meta, indent=2))
    print("default model:", default, "| risk thresholds:", {k: round(v, 3) for k, v in risk_thresholds.items()}, flush=True)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "python")

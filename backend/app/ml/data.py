"""Dataset loading for NASA MDP ARFF files (module-level C/C++ metrics)."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..metrics.extractor import FUNC_FEATURES, NASA_COLUMN_MAP

DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "nasa"


def read_arff(path: Path) -> pd.DataFrame:
    cols, rows, in_data = [], [], False
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("%"):
            continue
        low = line.lower()
        if low.startswith("@attribute"):
            cols.append(line.split()[1])
        elif low.startswith("@data"):
            in_data = True
        elif in_data:
            rows.append(line.split(","))
    return pd.DataFrame(rows, columns=cols)


def load_project(name: str) -> pd.DataFrame:
    """Return aligned features + `defective` (0/1) + `project` for one dataset."""
    raw = read_arff(DATA_DIR / f"{name}.arff")
    df = raw[list(NASA_COLUMN_MAP)].astype(float).rename(columns=NASA_COLUMN_MAP)
    df["comment_pct"] = (100 * raw["LOC_COMMENTS"].astype(float) / df["loc_total"].clip(lower=1)).clip(0, 100)
    label = raw["Defective"] if "Defective" in raw else raw["label"]
    df["defective"] = label.str.upper().isin(["Y", "TRUE"]).astype(int)
    df["project"] = name
    return df[FUNC_FEATURES + ["defective", "project"]]


def load_all() -> pd.DataFrame:
    frames = [load_project(p.stem) for p in sorted(DATA_DIR.glob("*.arff"))]
    return pd.concat(frames, ignore_index=True)


PY_FEATURES = FUNC_FEATURES + ["param_count"]
PY_CSV = Path(__file__).resolve().parents[3] / "data" / "python" / "dataset.csv"


def load_python() -> pd.DataFrame:
    """Mined Python dataset: features + defective + project (repo) + group (repo/file) + snapshot."""
    df = pd.read_csv(PY_CSV)
    df["project"] = df["repo"]
    df["group"] = df["repo"] + "/" + df["file"]
    return df[PY_FEATURES + ["defective", "project", "group", "snapshot"]]


def load_family(family: str) -> tuple[pd.DataFrame, list[str]]:
    if family == "python":
        return load_python(), PY_FEATURES
    if family == "nasa":
        df = load_all()
        df["group"] = df["project"] + "/" + df.index.astype(str)  # rows are independent modules
        return df, FUNC_FEATURES
    raise ValueError(f"unknown family {family!r}")

"""Metrics engine: per-function and per-file software metrics.

radon supplies Python Halstead / MI / raw LOC; lizard supplies multi-language
function boundaries, NLOC, CC and parameter counts. The per-function feature
set (FUNC_FEATURES) is deliberately aligned with columns available in the NASA
MDP defect datasets, so a model trained on them can score functions extracted
here without a feature mismatch.
"""
from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Iterable

import lizard
from radon.metrics import mi_visit
from radon.raw import analyze

LIZARD_EXTS = {".py", ".java", ".c", ".cpp", ".cc", ".h", ".hpp", ".js", ".ts", ".go", ".cs"}
IGNORED_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", ".idea"}

# NASA column -> our feature name (shared by training and inference).
# comment_pct is derived (100 * LOC_COMMENTS / LOC_TOTAL) because PERCENT_COMMENTS
# is missing from KC1/JM1; PARAMETER_COUNT is also missing there so it is not a feature.
NASA_COLUMN_MAP = {
    "LOC_TOTAL": "loc_total",
    "LOC_EXECUTABLE": "loc_executable",
    "CYCLOMATIC_COMPLEXITY": "cyclomatic",
    "HALSTEAD_VOLUME": "halstead_volume",
    "HALSTEAD_DIFFICULTY": "halstead_difficulty",
    "HALSTEAD_EFFORT": "halstead_effort",
}
FUNC_FEATURES = list(NASA_COLUMN_MAP.values()) + ["comment_pct"]


def _div(a: float, b: float) -> float:
    return a / b if b else 0.0


_COMMENTS = re.compile(r"/\*[\s\S]*?\*/|//[^\n]*|#[^\n]*|\"\"\"[\s\S]*?\"\"\"|'''[\s\S]*?'''")
_TOKEN = re.compile(
    r"\"(?:\\.|[^\"\\\n])*\"|'(?:\\.|[^'\\\n])*'|[A-Za-z_]\w*|\d+(?:\.\d+)?"
    r"|==|!=|<=|>=|&&|\|\||\+\+|--|->|::|\*\*|<<|>>|[-+*/%=<>!&|^~?:.,;(){}\[\]]")
_KEYWORDS = set(
    "if else elif for while do switch case default break continue return def class lambda try except finally catch "
    "throw raise with as import from in is not and or new delete sizeof void int char float double long short unsigned "
    "signed struct union enum typedef static const public private protected final async await yield pass global "
    "nonlocal assert del function var let package interface extends implements throws goto".split())


def halstead(code: str) -> tuple[float, float, float]:
    """Token-based Halstead (volume, difficulty, effort), close to how NASA MDP counts.

    radon's AST-based Halstead only counts a subset of operators (and returns nothing for
    many functions), which made Python metrics systematically smaller than the training data.
    """
    ops, opnds = [], []
    for t in _TOKEN.findall(_COMMENTS.sub(" ", code)):
        (ops if t in _KEYWORDS or not (t[0].isalnum() or t[0] in "_\"'") else opnds).append(t)
    n1, n2 = len(set(ops)), len(set(opnds))
    if n1 == 0 or n2 == 0:
        return 0.0, 0.0, 0.0
    volume = (len(ops) + len(opnds)) * math.log2(n1 + n2)
    difficulty = (n1 / 2) * (len(opnds) / n2)
    return volume, difficulty, volume * difficulty


def _function_records(code: str, filename: str, ext: str) -> list[dict]:
    liz = lizard.analyze_file.analyze_source_code(filename, code)
    lines = code.splitlines()

    out = []
    for f in liz.function_list:
        seg = "\n".join(lines[f.start_line - 1:f.end_line])
        total = max(f.end_line - f.start_line + 1, 1)
        comments = 0
        if ext == ".py":
            try:
                r = analyze(seg)
                comments = r.comments + r.multi
            except Exception:
                pass
        hv, hd, he = halstead(seg)
        out.append({
            "name": f.name,
            "start_line": f.start_line,
            "end_line": f.end_line,
            "loc_total": total,
            "loc_executable": f.nloc,
            "comment_pct": round(100 * _div(comments, total), 2),
            "cyclomatic": f.cyclomatic_complexity,
            "param_count": len(f.parameters),
            "halstead_volume": round(hv, 3),
            "halstead_difficulty": round(hd, 3),
            "halstead_effort": round(he, 3),
        })
    return out


def analyze_source(code: str, filename: str = "<memory>") -> dict:
    """Metrics for one file: file-level summary plus per-function records."""
    ext = Path(filename).suffix.lower()
    funcs = _function_records(code, filename, ext)
    n_lines = len(code.splitlines())

    mi = comments = None
    sloc = n_lines
    if ext == ".py":
        try:
            raw = analyze(code)
            sloc, comments = raw.sloc, raw.comments + raw.multi
            n_lines = raw.loc
            mi = round(mi_visit(code, multi=True), 2)
        except Exception:
            pass

    ccs = [f["cyclomatic"] for f in funcs]
    return {
        "file": filename,
        "loc": n_lines,
        "sloc": sloc,
        "comment_ratio": round(_div(comments or 0, n_lines), 4),
        "n_functions": len(funcs),
        "cyclomatic_total": sum(ccs),
        "cyclomatic_max": max(ccs, default=0),
        "cyclomatic_avg": round(_div(sum(ccs), len(ccs)), 2),
        "halstead_volume": round(sum(f["halstead_volume"] for f in funcs), 2),
        "maintainability_index": mi,
        "functions": funcs,
    }


def iter_source_files(root: Path) -> Iterable[Path]:
    for p in sorted(root.rglob("*")):
        if p.is_file() and p.suffix.lower() in LIZARD_EXTS and not (set(p.parts) & IGNORED_DIRS):
            yield p


def analyze_directory(root: str | Path) -> list[dict]:
    root = Path(root)
    results = []
    for p in iter_source_files(root):
        code = p.read_text(encoding="utf-8", errors="ignore")
        if code.strip():
            results.append(analyze_source(code, str(p.relative_to(root))))
    return results

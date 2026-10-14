"""Mine a Python-native, function-level defect dataset from git history.

Labelling (time-forward, "post-release" style):
  * Take snapshots of a repo at fixed dates.
  * Extract metrics for every function at each snapshot with the SAME extractor the app uses.
  * A function is `defective` if a bug-fix commit modifies it within WINDOW_DAYS (12 months) after the snapshot.

Bug-fix commits are found by commit-message heuristics (noisy by nature; see README limitations).
The function a fix touched is located in the pre-fix revision from the diff hunks, and identity is
(file path, qualified name), so renames and moves are treated as new functions.

Run: python -m backend.app.ml.mining [repo_name ...]
"""
from __future__ import annotations

import ast
import csv
import json
import random
import re
import shutil
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from ..metrics.extractor import FUNC_FEATURES, analyze_source

ROOT = Path(__file__).resolve().parents[3] / "data" / "python"
REPOS_DIR = ROOT / "repos"

REPOS = {
    "requests": "https://github.com/psf/requests",
    "flask": "https://github.com/pallets/flask",
    "werkzeug": "https://github.com/pallets/werkzeug",
    "click": "https://github.com/pallets/click",
    "jinja": "https://github.com/pallets/jinja",
    "httpx": "https://github.com/encode/httpx",
    "rich": "https://github.com/Textualize/rich",
    "tornado": "https://github.com/tornadoweb/tornado",
    "scrapy": "https://github.com/scrapy/scrapy",
    "celery": "https://github.com/celery/celery",
    "pytest": "https://github.com/pytest-dev/pytest",
    "black": "https://github.com/psf/black",
}

SHALLOW_SINCE = "2020-01-01"
SNAPSHOTS = ["2021-01-01", "2021-07-01", "2022-01-01", "2022-07-01", "2023-01-01"]
WINDOW_DAYS = 365
MAX_PER_SNAPSHOT = 1500  # random cap per repo-snapshot, keeps the natural defect rate
MAX_FILE_CHARS = 400_000
MAX_FILES_PER_FIX = 15   # larger commits are usually refactors / mass edits

FIX_RE = re.compile(r"\b(fix(es|ed|ing)?|bug(s|fix)?|defect|crash(es)?|regression|incorrect(ly)?|broken|fail(s|ed|ure)?|"
                    r"exception|traceback|hotfix|leak|race|deadlock|overflow|wrong)\b", re.I)
NOT_FIX_RE = re.compile(r"\b(typo|docs?|documentation|readme|changelog|lint|flake8|pre-commit|style|black|isort|ci|bump|"
                        r"release|version|deprecat\w*|refactor\w*|tests?|mypy|typing|type hints?|revert|merge)\b", re.I)
SKIP_PATH = re.compile(r"(^|/)(tests?|testing|docs?|examples?|benchmarks?|profiling|scripts|migrations|\.github|conftest\.py|setup\.py|noxfile\.py)(/|$|\.)")


def git(repo: Path, *args: str, check: bool = True) -> str:
    r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, errors="replace")
    if check and r.returncode:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()[:200]}")
    return r.stdout


def clone(name: str) -> Path:
    dest = REPOS_DIR / name
    if dest.exists():
        return dest
    REPOS_DIR.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):  # clones of big repos occasionally time out
        r = subprocess.run(["git", "clone", "-q", f"--shallow-since={SHALLOW_SINCE}", "--no-tags",
                            REPOS[name], str(dest)])
        if r.returncode == 0:
            return dest
        shutil.rmtree(dest, ignore_errors=True)
    raise RuntimeError(f"could not clone {name}")


def is_source(path: str) -> bool:
    return path.endswith(".py") and not SKIP_PATH.search(path)


def qualnames(code: str) -> list[tuple[str, int, int]]:
    """(qualified name, start line, end line) for every function via ast."""
    try:
        tree = ast.parse(code)
    except (SyntaxError, ValueError):
        return []
    out: list[tuple[str, int, int]] = []

    def walk(node, prefix):
        for ch in ast.iter_child_nodes(node):
            if isinstance(ch, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                q = f"{prefix}{ch.name}"
                if not isinstance(ch, ast.ClassDef):
                    out.append((q, ch.lineno, getattr(ch, "end_lineno", ch.lineno)))
                walk(ch, q + ".")
            else:
                walk(ch, prefix)

    walk(tree, "")
    return out


def bug_fixes(repo: Path) -> list[dict]:
    """[{date, file, func}] for every function touched by a bug-fix commit."""
    log = git(repo, "log", "--no-merges", "--format=%H%x1f%ct%x1f%s", "HEAD")
    events = []
    for line in log.splitlines():
        sha, ts, subject = line.split("\x1f", 2)
        if not FIX_RE.search(subject) or NOT_FIX_RE.search(subject):
            continue
        files = [f for f in git(repo, "diff-tree", "--no-commit-id", "--name-only", "-r", sha).split() if is_source(f)]
        if not files or len(files) > MAX_FILES_PER_FIX:
            continue
        if git(repo, "rev-parse", "--verify", "-q", f"{sha}^", check=False).strip() == "":
            continue  # shallow boundary: no parent to diff against
        date = datetime.fromtimestamp(int(ts), tz=timezone.utc)
        for f in files:
            old = git(repo, "show", f"{sha}^:{f}", check=False)
            if not old:
                continue  # new file, nothing pre-existing was fixed
            funcs = qualnames(old)
            for h in re.finditer(r"^@@ -(\d+)(?:,(\d+))? \+", git(repo, "diff", "-U0", f"{sha}^", sha, "--", f), re.M):
                start, n = int(h.group(1)), int(h.group(2) if h.group(2) is not None else 1)
                lo, hi = (start, start + n - 1) if n else (start, start)
                for q, a, b in funcs:
                    if a <= hi and b >= lo:
                        events.append({"date": date, "file": f, "func": q, "sha": sha})
    return events


def snapshot_rows(repo: Path, name: str, date: str, fixes: dict, rng: random.Random) -> list[dict]:
    snap = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
    rev = git(repo, "rev-list", "-1", f"--before={date}", "HEAD").strip()
    if not rev:
        return []
    files = [f for f in git(repo, "ls-tree", "-r", "--name-only", rev).splitlines() if is_source(f)]
    end = snap + timedelta(days=WINDOW_DAYS)
    rows = []
    for f in files:
        code = git(repo, "show", f"{rev}:{f}", check=False)
        if not code.strip() or len(code) > MAX_FILE_CHARS:
            continue  # empty, or generated / data file (tokenizer can take minutes on these)
        try:
            res = analyze_source(code, f)
        except Exception:
            continue
        names = qualnames(code)
        for fn in res["functions"]:
            short = fn["name"].split("::")[-1].split(".")[-1]
            cands = [(abs(a - fn["start_line"]), q) for q, a, _ in names if q.split(".")[-1] == short]
            if not cands:
                continue
            q = min(cands)[1]
            hit = any(snap < d <= end for d in fixes.get((f, q), []))
            rows.append({"repo": name, "snapshot": date, "file": f, "function": q,
                         **{k: fn[k] for k in FUNC_FEATURES}, "param_count": fn["param_count"],
                         "defective": int(hit)})
    rng.shuffle(rows)
    return rows[:MAX_PER_SNAPSHOT]


COLS = ["repo", "snapshot", "file", "function", *FUNC_FEATURES, "param_count", "defective"]
CACHE = ROOT / "cache"


def mine_repo(name: str) -> list[dict]:
    """Rows for one repo, cached on disk so a failure elsewhere never loses finished work."""
    cached = CACHE / f"{name}.csv"
    if cached.exists():
        with cached.open() as fh:
            rows = [{**r, **{c: float(r[c]) for c in (*FUNC_FEATURES, "param_count")}, "defective": int(r["defective"])}
                    for r in csv.DictReader(fh)]
        print(f"{name:10s} (cached) rows={len(rows):6d}", flush=True)
        return rows
    rows = _mine_repo(name)
    CACHE.mkdir(parents=True, exist_ok=True)
    with cached.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLS)
        w.writeheader()
        w.writerows(rows)
    return rows


def _mine_repo(name: str) -> list[dict]:
    repo = clone(name)
    events = bug_fixes(repo)
    fixes: dict = {}
    for e in events:
        fixes.setdefault((e["file"], e["func"]), []).append(e["date"])
    rng = random.Random(42)
    rows = []
    for d in SNAPSHOTS:
        rows += snapshot_rows(repo, name, d, fixes, rng)
    rate = sum(r["defective"] for r in rows) / max(len(rows), 1)
    print(f"{name:10s} fix-touches={len(events):5d} rows={len(rows):6d} defect_rate={rate:.1%}", flush=True)
    return rows


def main(names: list[str]):
    names = names or list(REPOS)
    all_rows, done = [], []
    for n in names:
        try:
            all_rows += mine_repo(n)
            done.append(n)
        except Exception as e:  # keep going: one bad repo should not sink the dataset
            print(f"{n:10s} SKIPPED: {e}", flush=True)
    names = done
    out = ROOT / "dataset.csv"
    ROOT.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLS)
        w.writeheader()
        w.writerows(all_rows)
    heads = {n: git(REPOS_DIR / n, "rev-parse", "HEAD").strip() for n in names}
    (ROOT / "manifest.json").write_text(json.dumps({
        "snapshots": SNAPSHOTS, "window_days": WINDOW_DAYS, "shallow_since": SHALLOW_SINCE,
        "max_per_snapshot": MAX_PER_SNAPSHOT, "repo_heads": heads, "rows": len(all_rows),
        "defect_rate": sum(r["defective"] for r in all_rows) / max(len(all_rows), 1)}, indent=2))
    print("wrote", out, len(all_rows), "rows")


if __name__ == "__main__":
    main(sys.argv[1:])

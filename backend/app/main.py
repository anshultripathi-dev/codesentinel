"""CodeSentinel API."""
from __future__ import annotations

import io
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .metrics.extractor import analyze_directory, analyze_source
from .ml import eda, predict
from .store import Store

MAX_ZIP_BYTES = 25 * 1024 * 1024
MAX_UNZIPPED_BYTES = 100 * 1024 * 1024

app = FastAPI(title="CodeSentinel", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                   allow_methods=["*"], allow_headers=["*"])
store = Store()


class CodeIn(BaseModel):
    filename: str = "snippet.py"
    code: str
    model: Optional[str] = None
    family: str = predict.DEFAULT_FAMILY


def _summarise(files: list[dict], family: str) -> dict:
    funcs = [f for fl in files for f in fl["functions"]]
    n = len(funcs)
    return {
        "family": family,
        "risk_thresholds": predict.leaderboard(family)["risk_thresholds"],
        "files": len(files),
        "functions": n,
        "high_risk": sum(f["risk"] == "high" for f in funcs),
        "medium_risk": sum(f["risk"] == "medium" for f in funcs),
        "anomalies": sum(f["anomaly"] for f in funcs),
        "avg_risk": round(sum(f["defect_probability"] for f in funcs) / n, 4) if n else 0,
        "total_loc": sum(fl["loc"] for fl in files),
        "avg_cyclomatic": round(sum(f["cyclomatic"] for f in funcs) / n, 2) if n else 0,
    }


def _score_files(files: list[dict], model: Optional[str], family: str) -> list[dict]:
    flat = [(i, f) for i, fl in enumerate(files) for f in fl["functions"]]
    scored = predict.score([{**f, "file": files[i]["file"]} for i, f in flat], model, family)
    for fl in files:
        fl["functions"] = []
    for (i, _), s in zip(flat, scored):
        files[i]["functions"].append(s)
    for fl in files:
        fl["max_risk"] = max((f["defect_probability"] for f in fl["functions"]), default=0.0)
    return files


def _validate(model: Optional[str], family: str):
    if family not in predict.families():
        raise HTTPException(400, f"unknown family; choose from {predict.families()}")
    if model and model not in predict.model_names(family):
        raise HTTPException(400, f"unknown model; choose from {predict.model_names(family)}")


def _safe_extract(data: bytes, dest: Path):
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise HTTPException(400, "not a valid zip file")
    if sum(i.file_size for i in zf.infolist()) > MAX_UNZIPPED_BYTES:
        raise HTTPException(413, "archive expands too large")
    root = dest.resolve()
    for info in zf.infolist():  # zip-slip guard
        if not (root / info.filename).resolve().is_relative_to(root):
            raise HTTPException(400, "unsafe path in archive")
    zf.extractall(dest)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/families")
def get_families():
    return {"default": predict.DEFAULT_FAMILY, "families": predict.families()}


@app.get("/api/models")
def models(family: str = Query(predict.DEFAULT_FAMILY)):
    _validate(None, family)
    return predict.leaderboard(family)


@app.post("/api/analyze/snippet")
def analyze_snippet(body: CodeIn):
    _validate(body.model, body.family)
    files = _score_files([analyze_source(body.code, body.filename)], body.model, body.family)
    summary = _summarise(files, body.family)
    run_id = store.save(f"Snippet: {body.filename}", body.model or predict.leaderboard(body.family)["default_model"], summary, files)
    return {"run_id": run_id, "summary": summary, "files": files}


@app.post("/api/analyze/upload")
async def analyze_upload(file: UploadFile = File(...), model: Optional[str] = Query(None),
                         family: str = Query(predict.DEFAULT_FAMILY)):
    _validate(model, family)
    data = await file.read()
    if len(data) > MAX_ZIP_BYTES:
        raise HTTPException(413, "upload too large")
    tmp = Path(tempfile.mkdtemp(prefix="cs_"))
    try:
        _safe_extract(data, tmp)
        files = analyze_directory(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if not files:
        raise HTTPException(422, "no supported source files found")
    files = _score_files(files, model, family)
    summary = _summarise(files, family)
    run_id = store.save(file.filename or "upload.zip", model or predict.leaderboard(family)["default_model"], summary, files)
    return {"run_id": run_id, "summary": summary, "files": files}


@app.post("/api/compare")
def compare(body: CodeIn):
    """Score one snippet's functions with every model side by side."""
    _validate(None, body.family)
    funcs = analyze_source(body.code, body.filename)["functions"]
    return {"functions": [f["name"] for f in funcs], "scores": predict.compare_models(funcs, body.family) if funcs else {}}


@app.get("/api/eda")
def get_eda(family: str = Query(predict.DEFAULT_FAMILY)):
    _validate(None, family)
    return eda.compute(family)


DEMO_PACKAGES = ["json", "http", "email", "unittest", "logging"]


@app.post("/api/analyze/demo")
def analyze_demo(model: Optional[str] = Query(None), family: str = Query(predict.DEFAULT_FAMILY)):
    """Analyze a slice of the CPython standard library: real, varied, no upload needed."""
    import sysconfig
    stdlib = Path(sysconfig.get_paths()["stdlib"])
    tmp = Path(tempfile.mkdtemp(prefix="cs_demo_"))
    try:
        for pkg in DEMO_PACKAGES:
            src = stdlib / pkg
            if src.is_dir():
                shutil.copytree(src, tmp / pkg, ignore=shutil.ignore_patterns("test*", "__pycache__"))
        files = analyze_directory(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if not files:
        raise HTTPException(500, "standard library not found")
    _validate(model, family)
    files = _score_files(files, model, family)
    summary = _summarise(files, family)
    run_id = store.save("CPython stdlib (json, http, email, unittest, logging)",
                        model or predict.leaderboard(family)["default_model"], summary, files)
    return {"run_id": run_id, "summary": summary, "files": files}


@app.get("/api/runs/{run_id}/compare")
def compare_run(run_id: int):
    """Score every function of a stored run with every model and report agreement."""
    import numpy as np
    r = store.get(run_id)
    if not r:
        raise HTTPException(404, "run not found")
    funcs = [f for fl in r["files"] for f in fl["functions"]]
    if not funcs:
        return {"models": [], "agreement": {"labels": [], "matrix": []}}
    family = r["summary"].get("family", predict.DEFAULT_FAMILY)
    scores = predict.compare_models(funcs, family)
    names = list(scores)
    mat = np.array([scores[n] for n in names])
    corr = np.corrcoef(mat) if len(funcs) > 1 else np.ones((len(names), len(names)))
    return {
        "models": [{"model": n, "mean_risk": round(float(np.mean(scores[n])), 4),
                    "high_risk": int(sum(p >= predict.leaderboard(family)["risk_thresholds"]["high"] for p in scores[n])),
                    "flagged": int(sum(p >= predict._load(n, family)["threshold"] for p in scores[n]))} for n in names],
        "agreement": {"labels": names, "matrix": np.nan_to_num(corr).round(3).tolist()},
    }


@app.delete("/api/runs/{run_id}")
def delete_run(run_id: int):
    if not store.delete(run_id):
        raise HTTPException(404, "run not found")
    return {"deleted": run_id}


@app.get("/api/runs")
def runs():
    return store.list()


@app.get("/api/runs/{run_id}")
def run(run_id: int):
    r = store.get(run_id)
    if not r:
        raise HTTPException(404, "run not found")
    return r

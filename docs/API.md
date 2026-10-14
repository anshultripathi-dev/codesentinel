# API reference

Base URL `http://localhost:8000`. Interactive docs at `/docs`. `family` is `python` (default) or `nasa`; `model` is any model name from `GET /api/models`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness check. |
| GET | `/api/families` | Available model families and the default. |
| GET | `/api/models?family=` | Leaderboard, thresholds, feature importance, curves for a family. |
| GET | `/api/eda?family=` | Training-data statistics: distributions, correlations, defect rate by bin. |
| POST | `/api/analyze/snippet` | JSON `{code, filename?, model?, family?}`. Scores one source file. |
| POST | `/api/analyze/upload?model=&family=` | Multipart `file` (.zip, max 25 MB). Scores a project. |
| POST | `/api/analyze/demo?model=&family=` | Scores a built-in slice of the CPython standard library. |
| POST | `/api/compare` | JSON `{code, filename?, family?}`. Scores each function with every model. |
| GET | `/api/runs` | Saved runs, newest first. |
| GET | `/api/runs/{id}` | One run with all file and function results. |
| GET | `/api/runs/{id}/compare` | Score a stored run with every model and report agreement. |
| DELETE | `/api/runs/{id}` | Delete a run. |

Analyze endpoints return `{run_id, summary, files}`. Each function carries its metrics plus `defect_probability`, `risk` (`low` / `medium` / `high`), `predicted_defective`, `anomaly` and the top three `drivers`.

```bash
curl -s -X POST localhost:8000/api/analyze/snippet \
  -H 'Content-Type: application/json' \
  -d '{"code": "def f(x):\n    return x\n", "filename": "a.py"}'
```

Errors use standard status codes with a `detail` message: 400 (unknown model/family, bad zip, unsafe path), 413 (too large), 422 (no supported source files), 404 (unknown run).

import io
import zipfile

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.metrics.extractor import analyze_source

client = TestClient(app)

RISKY = "def f(a,b,c):\n" + "".join(f"    if a=={i}:\n        b+=c*{i}\n" for i in range(25)) + "    return b\n"


def test_metrics_basic():
    r = analyze_source("def f(x):\n    if x:\n        return 1\n    return 0\n", "a.py")
    assert r["n_functions"] == 1
    assert r["functions"][0]["cyclomatic"] == 2


def test_snippet_scores_and_ranks_risk():
    simple = client.post("/api/analyze/snippet", json={"code": "def g(x):\n    return x\n"}).json()
    risky = client.post("/api/analyze/snippet", json={"code": RISKY}).json()
    assert 0 <= simple["files"][0]["functions"][0]["defect_probability"] <= 1
    assert risky["files"][0]["max_risk"] > simple["files"][0]["max_risk"]


def test_unknown_model_rejected():
    assert client.post("/api/analyze/snippet", json={"code": "x=1", "model": "nope"}).status_code == 400


def test_upload_zip_and_history():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("pkg/a.py", RISKY)
    r = client.post("/api/analyze/upload", files={"file": ("p.zip", buf.getvalue())})
    assert r.status_code == 200
    assert client.get(f"/api/runs/{r.json()['run_id']}").status_code == 200


def test_zip_slip_rejected():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("../evil.py", "x=1")
    assert client.post("/api/analyze/upload", files={"file": ("p.zip", buf.getvalue())}).status_code == 400


def test_families_listed_with_python_default():
    r = client.get("/api/families").json()
    assert r["default"] == "python" and {"python", "nasa"} <= set(r["families"])


def test_unknown_family_rejected():
    assert client.post("/api/analyze/snippet", json={"code": "x=1", "family": "cobol"}).status_code == 400
    assert client.get("/api/models?family=cobol").status_code == 400


def test_models_expose_calibrated_thresholds_and_metrics():
    m = client.get("/api/models?family=python").json()
    assert 0 < m["risk_thresholds"]["medium"] < m["risk_thresholds"]["high"] < 1
    row = m["leaderboard"][0]
    assert {"pr_auc", "recall_at_10pct"} <= set(row["cross_project"]) and "temporal" in row


def test_both_families_score_and_differ_in_features():
    body = {"code": RISKY}
    py = client.post("/api/analyze/snippet", json={**body, "family": "python"}).json()
    nasa = client.post("/api/analyze/snippet", json={**body, "family": "nasa"}).json()
    assert py["summary"]["family"] == "python" and nasa["summary"]["family"] == "nasa"
    assert "param_count" in client.get("/api/models?family=python").json()["features"]
    assert "param_count" not in client.get("/api/models?family=nasa").json()["features"]

import pandas as pd
import pytest

from backend.app.ml.data import PY_CSV, PY_FEATURES
from backend.app.ml.mining import FIX_RE, NOT_FIX_RE, is_source, qualnames

CODE = '''
def top(a):
    return a

class A:
    def m(self):
        def inner():
            pass
        return inner

    @staticmethod
    def s(x):
        return x
'''


def test_qualnames_include_class_and_nesting():
    names = {q for q, _, _ in qualnames(CODE)}
    assert names == {"top", "A.m", "A.m.inner", "A.s"}


def test_qualnames_line_ranges():
    by = {q: (a, b) for q, a, b in qualnames(CODE)}
    assert by["top"] == (2, 3)
    assert by["A.m"][0] < by["A.m.inner"][0] <= by["A.m.inner"][1] <= by["A.m"][1]


def test_qualnames_bad_syntax_returns_empty():
    assert qualnames("def (:") == []


@pytest.mark.parametrize("msg,is_fix", [
    ("Fix crash when header is empty", True),
    ("Fixed regression in session handling", True),
    ("Fix typo in docs", False),          # fix keyword but documentation
    ("Bump version to 2.0", False),
    ("Add feature flag", False),
    ("Refactor parser (fixes lint)", False),
])
def test_fix_message_heuristic(msg, is_fix):
    assert bool(FIX_RE.search(msg) and not NOT_FIX_RE.search(msg)) is is_fix


def test_source_path_filter():
    assert is_source("src/pkg/mod.py")
    assert not is_source("tests/test_mod.py")
    assert not is_source("docs/conf.py")
    assert not is_source("profiling/mix_huge.py")
    assert not is_source("pkg/data.json")


@pytest.mark.skipif(not PY_CSV.exists(), reason="dataset not mined")
def test_dataset_sanity():
    d = pd.read_csv(PY_CSV)
    assert set(PY_FEATURES) <= set(d.columns)
    assert d["defective"].isin([0, 1]).all()
    assert 0.005 < d["defective"].mean() < 0.2          # rare but present
    assert d["repo"].nunique() >= 8
    # buggy functions should be larger on average: the core signal the models rely on
    assert d[d.defective == 1]["loc_total"].median() > d[d.defective == 0]["loc_total"].median()
    assert not d[PY_FEATURES].isna().any().any()

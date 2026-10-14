"""SQLite persistence for analysis runs."""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

DB = Path(os.environ.get("CODESENTINEL_DB", Path(__file__).resolve().parents[2] / "codesentinel.db"))


class Store:
    def __init__(self, path: Path = DB):
        self.path = path
        with self._c() as c:
            c.execute("""CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, model TEXT,
                created TEXT DEFAULT CURRENT_TIMESTAMP, summary TEXT, files TEXT)""")

    def _c(self):
        return sqlite3.connect(self.path)

    def save(self, name, model, summary, files) -> int:
        with self._c() as c:
            cur = c.execute("INSERT INTO runs(name, model, summary, files) VALUES (?,?,?,?)",
                            (name, model, json.dumps(summary), json.dumps(files)))
            return cur.lastrowid

    def list(self):
        with self._c() as c:
            rows = c.execute("SELECT id, name, model, created, summary FROM runs ORDER BY id DESC LIMIT 50").fetchall()
        return [{"id": r[0], "name": r[1], "model": r[2], "created": r[3], "summary": json.loads(r[4])} for r in rows]

    def get(self, run_id: int):
        with self._c() as c:
            r = c.execute("SELECT id, name, model, created, summary, files FROM runs WHERE id=?", (run_id,)).fetchone()
        return r and {"id": r[0], "name": r[1], "model": r[2], "created": r[3],
                      "summary": json.loads(r[4]), "files": json.loads(r[5])}

    def delete(self, run_id: int) -> bool:
        with self._c() as c:
            return c.execute("DELETE FROM runs WHERE id=?", (run_id,)).rowcount > 0

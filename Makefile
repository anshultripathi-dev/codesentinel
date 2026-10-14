PY ?= .venv/bin/python

.PHONY: setup train api ui test mine build

setup:            ## create venv, install backend + frontend deps
	python3 -m venv .venv
	.venv/bin/pip install -r requirements-dev.txt
	cd frontend && npm install

train:            ## train both model families (~7 min)
	$(PY) -m backend.app.ml.train python
	$(PY) -m backend.app.ml.train nasa

api:              ## API on :8000
	.venv/bin/uvicorn backend.app.main:app --port 8000 --reload

ui:               ## dashboard on :5173
	cd frontend && npm run dev

test:
	$(PY) -m pytest -q backend/tests

build:            ## production build of the dashboard
	cd frontend && npm run build

mine:             ## re-mine the Python dataset from git history (~15 min, needs network)
	$(PY) -m backend.app.ml.mining

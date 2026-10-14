# Dataset and evaluation

## Python-native dataset (`data/python/dataset.csv`)

Mined by `python -m backend.app.ml.mining` from the git history of 12 repositories: requests, flask, werkzeug, click, jinja, httpx, rich, tornado, scrapy, celery, pytest, black. Clones are shallow (since 2020-01-01), and the exact commits are recorded in `data/python/manifest.json`.

**Snapshots.** Five points in time: 2021-01, 2021-07, 2022-01, 2022-07, 2023-01. At each, every function in non-test source files is measured with the same extractor the app uses (at most 1,500 sampled per repo and snapshot; files over 400 KB are skipped).

**Label.** A function is `defective = 1` if a bug-fix commit modifies it within 365 days after the snapshot.

- *Bug-fix commits* are non-merge commits whose subject matches fix/bug/crash/regression-style keywords and does not match docs/typo/refactor/test/release-style keywords, touching at most 15 source files.
- *The touched function* is located in the pre-fix version of the file from the diff hunks, using the Python AST. Function identity is `(file path, qualified name)`.

**Size.** 50,826 rows, 2.8% defective (1,401 rows, 799 distinct functions), 14,714 distinct functions.

**Features** (same for training and inference): lines of code, executable LOC, comment %, cyclomatic complexity, Halstead volume / difficulty / effort, parameter count.

## NASA MDP benchmark (`data/nasa/*.arff`)

Cleaned NASA Metrics Data Program datasets CM1, JM1, KC1, PC1, PC3, PC4: 12,211 C/C++ modules, 18.9% defective. Only the metrics also computable by the extractor are used (no parameter count). Source: [klainfo/NASADefectDataset](https://github.com/klainfo/NASADefectDataset).

## Evaluation

| Scheme | Python family | NASA family |
|---|---|---|
| Within | 5-fold CV grouped by file, so no file is in both train and test | 5-fold CV |
| Cross-project | Leave one repo out; report mean AUC across repos | Leave one project out |
| Temporal | Train on the first three snapshots, test on the last two | n/a |

Reported per model: ROC-AUC, PR-AUC, F1, MCC, precision, recall (at an F1-optimal threshold chosen on out-of-fold scores), and **recall@10%**, the share of positives found in the top-ranked 10%. Models with class weights are probability-calibrated (sigmoid) so displayed risks match observed frequencies.

## Threats to validity

- **Label noise.** Keyword heuristics miss silent fixes and include some non-bug commits.
- **Identity.** Renames and moves look like new functions.
- **Repeated functions.** The same function appears in several snapshots; grouped CV prevents file leakage, but snapshots are not independent.
- **Sample.** Twelve mostly library-style repos; results may not transfer to applications or other domains.
- **Ceiling.** Static metrics alone reach about 0.73 AUC. Process metrics (churn, authorship, recency) would likely help but need history at inference time.

Reproduce everything with `make mine` (network, ~15 min) and `make train`.

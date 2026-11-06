# Data + ML pipeline (bronze -> silver -> gold -> evaluation)

Run from the repo root (`pip install -r pipeline/requirements.txt`):

```bash
python -m pipeline.run all        # or: ingest | silver | gold | evaluate
python -m pytest tests/pipeline   # leakage and metric tests
```

## Source
`openfootball/football.json` (public domain, CC0): Premier League, Bundesliga, La Liga, Serie A and Ligue 1, seasons 2014-15 to 2025-26. Results only (no xG, lineups or odds), so features are limited to form, rest, table position and Elo.

## Zones
| Zone | Output | Rules |
|---|---|---|
| Bronze | `data/raw/openfootball/<season>/<league>.json`, `data/lineage/bronze_manifest.json` | Never overwritten; SHA-256 + timestamp per file |
| Silver | `data/silver/matches.parquet`, `quarantine.parquet`, `quality_report.json` | Team-name normalization with an alias audit; cancelled/awarded/unplayed rows quarantined with a reason; completeness per league-season |
| Gold | `data/gold/features.parquet`, `feature_report.json`, `data/processed/matches.csv` | Point-in-time features, cold-start rows flagged (not deleted), fixed season splits |

## Leakage rules (enforced by tests)
- A match uses only matches on dates **strictly before** its date; same-day matches never see each other.
- State (form, Elo, table) updates only after all of a date's features are computed.
- Changing a match's own score cannot change its features; changing later results cannot change earlier features.
- Windows: last 5 matches (any venue, across seasons). A team needs 5 earlier matches or the row is excluded (`cold_start_insufficient_history`).
- Elo: start 1500, K=20, home advantage 60, 25% regression to the mean at each season start.
- Splits (fixed before tuning): train 2014-15..2021-22, validation 2022-23..2023-24, test 2024-25..2025-26.

## Evaluation and promotion
Baselines: class frequency, Elo-only logistic. Candidates: logistic, random forest, histogram gradient boosting, MLP, each on the 12-feature API contract (`f12`) and on 12 + Elo (`f15`). Hyperparameters and the winner are chosen on validation only. Isotonic calibration is kept only if it helps on a held-out half of validation. Metrics: log loss, Brier, RPS, accuracy, macro-F1, calibration bins, paired bootstrap CIs.

A model is written to `artifacts/football_result.joblib` only if it beats the class-frequency baseline (95% CI) **and** the Elo-only baseline on the test window. Reports: `artifacts/reports/evaluation.md|json`, `calibration.png`. `python -m ai.train` is the older ungated trainer and bypasses this check; do not serve its output.

## Current result
See `artifacts/reports/evaluation.md`. No model is promoted: every `f12` candidate beats the frequency baseline but loses to the Elo-only baseline. Elo carries nearly all the signal (logistic on f15 ties Elo-only). To ship a model, extend the serving contract with Elo ratings (a ratings snapshot service) rather than adding model complexity.

## Update: serving, registry and baselines
- Baselines now include Poisson/Dixon–Coles (monthly rolling refit, 3-year window, exact score matrix available from `pipeline.baselines.score_matrix`).
- Serving candidates now include Elo features; the winner (chosen on validation) passed the gate and is written to `artifacts/models/<version>/` with metadata and a checksum. `pipeline/model_card.py` writes `artifacts/reports/model_card.md`.
- Honest status: the winner is statistically tied with the Elo-only baseline and the Dixon–Coles baseline scored slightly better on the test window. Treat it as a calibrated rating forecaster.

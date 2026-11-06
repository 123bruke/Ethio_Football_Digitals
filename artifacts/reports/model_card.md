# Model card — pitchside-1x2-20261104T235919Z

## Intended use
Pre-match home/draw/away probabilities for top-flight fixtures in the five covered leagues, shown with uncertainty and data freshness. Not for betting advice, in-play forecasting, exact-score claims or leagues outside coverage.

## Model
`logreg_f15` (C=0.01); feature set fs-1.0.0; calibration applied: False.

## Data
openfootball/football.json (Public domain (CC0), per openfootball/football.json README); leagues en.1, de.1, es.1, it.1, fr.1; seasons 2014-15 to 2025-26; rows by split {'train': 13947, 'validation': 3528, 'test': 3446}; features hash `fdf65ebbedd8accb…`.

## Evaluation (untouched test window)
Log loss 0.9942, Brier 0.5934, RPS 0.2028, accuracy 0.522 on 3446 matches.
Versus class frequency: -0.0805 log loss (95% CI -0.0937 to -0.0664).
Versus Elo-only: -0.0001 (CI -0.0028 to +0.0027); versus Dixon-Coles: +0.0019 (CI -0.0040 to +0.0081).

## Known limitations
- Results-only data: no xG, lineups, injuries, odds or in-play events.
- Gains over a simple Elo rating are not statistically distinguishable; the model is a calibrated rating-based forecaster, not a breakthrough predictor.
- Promoted teams and teams with fewer than 5 earlier matches are not forecast.
- Ratings come from a snapshot; predictions are marked stale when the snapshot is older than 14 days.

## Release status
Promotion gate passed: True. The registry still requires explicit lifecycle approval (candidate → offline_validated → shadow → canary → production).

Code commit: `uncommitted` · run 2026-11-04T23:59:19.754347+00:00
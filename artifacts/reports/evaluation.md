# PitchSide 1X2 evaluation report

Run: 2026-11-04T23:59:19.754347+00:00 · feature set fs-1.0.0 · commit `uncommitted`

Data: openfootball/football.json (Public domain (CC0), per openfootball/football.json README); leagues en.1, de.1, es.1, it.1, fr.1; seasons 2014-15–2025-26.
Rows by split: {'train': 13947, 'validation': 3528, 'test': 3446}

| Model | Hyperparameters (chosen on validation) | Val log loss | Test log loss | Test Brier | Test RPS | Test acc |
|---|---|---|---|---|---|---|
| baseline_dixon_coles | — | 0.9930 | 0.9923 | 0.5917 | 0.2024 | 0.520 |
| logreg_f15 | C=0.01 | 0.9810 | 0.9942 | 0.5934 | 0.2028 | 0.522 |
| baseline_elo_only | — | 0.9861 | 0.9943 | 0.5935 | 0.2030 | 0.522 |
| random_forest_f15 | leaf=50 | 0.9850 | 0.9966 | 0.5948 | 0.2036 | 0.521 |
| mlp_f15 | 10ep,alpha=1e-3 (shipping config) | 0.9870 | 0.9970 | 0.5947 | 0.2036 | 0.519 |
| hist_gb_f15 | depth=2,iter=100 | 0.9863 | 0.9974 | 0.5947 | 0.2033 | 0.518 |
| hist_gb_f12 | depth=2,iter=100 | 1.0001 | 1.0154 | 0.6076 | 0.2096 | 0.494 |
| logreg_f12 | C=0.1 | 0.9979 | 1.0173 | 0.6095 | 0.2106 | 0.503 |
| random_forest_f12 | leaf=50 | 0.9999 | 1.0177 | 0.6095 | 0.2107 | 0.498 |
| mlp_f12 | 10ep,alpha=1e-3 (shipping config) | 1.0005 | 1.0210 | 0.6114 | 0.2113 | 0.496 |
| baseline_class_frequency | — | 1.0707 | 1.0747 | 0.6505 | 0.2309 | 0.432 |

**Serving winner (chosen on validation):** `logreg_f15` · calibration applied: False (gain -0.0275)
**Test (final):** {'n': 3446, 'log_loss': 0.994151059865794, 'brier': 0.5933703232202755, 'rps': 0.20284701780870665, 'accuracy': 0.5217643644805572, 'macro_f1': 0.38820936790731064}

vs class-frequency baseline: Δlog-loss -0.0805, 95% CI [-0.09370094657903415, -0.06640211317942638]
vs Elo-only baseline: Δlog-loss -0.0001, 95% CI [-0.0027789566822387897, 0.002658542064524984]

vs Dixon-Coles baseline: Δlog-loss +0.0019, 95% CI [-0.0039608967986998, 0.008077176266573009]

**Promotion rule:** CI95 of log-loss difference vs class-frequency baseline must be < 0 AND mean log loss must not be worse than the Elo-only baseline
**Promoted:** True

_Test window covers 2024-25 and 2025-26 (completed matches). Football outcomes are noisy; results are probabilistic skill estimates, not guarantees._
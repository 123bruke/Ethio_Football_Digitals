import numpy as np, pandas as pd
from pipeline import metrics as M
from pipeline.gold import compute_features, FEATURES, EXTRA_FEATURES
from pipeline import config as C


def _league(n_teams=6, rounds=4, seed=0):
    rng = np.random.default_rng(seed); teams = [f"t{i}" for i in range(n_teams)]; rows, day = [], pd.Timestamp("2020-08-01", tz="UTC")
    for r in range(rounds):
        for i in range(0, n_teams, 2):
            h, a = (teams[i], teams[i + 1]) if r % 2 == 0 else (teams[i + 1], teams[i])
            hg, ag = int(rng.poisson(1.5)), int(rng.poisson(1.1))
            rows.append({"match_id": f"m{len(rows)}", "league": "en.1", "season": "2020-21", "kickoff_date": day + pd.Timedelta(days=7 * r),
                         "kickoff_time_local": None, "home_team": h, "away_team": a, "home_goals": hg, "away_goals": ag,
                         "result": "home" if hg > ag else "away" if hg < ag else "draw", "match_domain": "professional", "source_sha256": "x"})
        teams = teams[:1] + teams[-1:] + teams[1:-1]  # rotate pairings
    return pd.DataFrame(rows)


def test_target_match_result_never_changes_its_own_features():
    df = _league(); base = compute_features(df).set_index("match_id")
    for idx in (len(df) - 1, len(df) // 2):
        mod = df.copy(); mod.loc[idx, ["home_goals", "away_goals", "result"]] = [9, 0, "home"]
        got = compute_features(mod).set_index("match_id")
        mid = df.loc[idx, "match_id"]
        cols = FEATURES + EXTRA_FEATURES
        pd.testing.assert_series_equal(base.loc[mid, cols].astype(float), got.loc[mid, cols].astype(float))


def test_future_results_never_change_past_features():
    df = _league(); base = compute_features(df).set_index("match_id")
    cutoff = df.kickoff_date.iloc[len(df) // 2]
    mod = df.copy(); late = mod.kickoff_date > cutoff
    mod.loc[late, ["home_goals", "away_goals"]] = [7, 7]; mod.loc[late, "result"] = "draw"
    got = compute_features(mod).set_index("match_id")
    early = df[df.kickoff_date <= cutoff].match_id
    pd.testing.assert_frame_equal(base.loc[early, FEATURES + EXTRA_FEATURES].astype(float), got.loc[early, FEATURES + EXTRA_FEATURES].astype(float))


def test_same_day_matches_do_not_see_each_other():
    df = _league(rounds=2); first_day = df[df.kickoff_date == df.kickoff_date.min()]
    feats = compute_features(df); day1 = feats[feats.kickoff_date == feats.kickoff_date.min()]
    assert day1.home_elo.eq(C.ELO_START).all() and day1.away_elo.eq(C.ELO_START).all()  # nothing learned before the first date


def test_cold_start_rows_are_flagged_not_dropped():
    feats = compute_features(_league(rounds=8))
    assert len(feats) == 24 and (~feats.included).sum() > 0
    assert set(feats[~feats.included].exclusion_reason) == {"cold_start_insufficient_history"}


def test_splits_are_chronologically_disjoint_if_gold_exists():
    import pytest
    path = C.GOLD_DIR / "features.parquet"
    if not path.exists():
        pytest.skip("gold not built")
    g = pd.read_parquet(path); g = g[g.included]
    mx = {s: g[g.split == s].kickoff_date.max() for s in ("train", "validation", "test")}
    mn = {s: g[g.split == s].kickoff_date.min() for s in ("train", "validation", "test")}
    assert mx["train"] < mn["validation"] and mx["validation"] < mn["test"]


def test_metrics_perfect_and_uniform():
    y = np.array(["home", "draw", "away"]); perfect = np.eye(3)
    assert M.log_loss_rows(perfect, y).max() < 1e-9 and M.brier_rows(perfect, y).max() == 0 and M.rps_rows(perfect, y).max() == 0
    uniform = np.full((3, 3), 1 / 3)
    assert np.allclose(M.log_loss_rows(uniform, y), np.log(3))
    # RPS penalizes a far miss (predict home, truth away) more than a near miss (predict draw, truth away)
    far = M.rps_rows(np.array([[1.0, 0, 0]]), np.array(["away"]))[0]; near = M.rps_rows(np.array([[0, 1.0, 0]]), np.array(["away"]))[0]
    assert far > near

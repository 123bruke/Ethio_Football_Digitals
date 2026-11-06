"""Baselines -> candidate models, tuned on validation only, evaluated once on the untouched test window (spec 12.2, 12.6, 16.5)."""
import hashlib, json, subprocess, warnings
from datetime import datetime, timezone
import joblib, numpy as np, pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from pipeline import config as C, FEATURE_SET_VERSION
from pipeline.gold import FEATURES, EXTRA_FEATURES
from pipeline import metrics as M

F12, F15 = FEATURES, FEATURES + EXTRA_FEATURES
warnings.filterwarnings("ignore")


def _order(model, P):  # sklearn sorts classes alphabetically; metrics need home, draw, away
    idx = [list(model.classes_).index(c) for c in M.CLASSES]
    return P[:, idx]


def _mlp(epochs, alpha):
    net = MLPClassifier(hidden_layer_sizes=(32, 16), alpha=alpha, learning_rate_init=0.001, max_iter=1, warm_start=True, random_state=42)
    class Wrapper:
        def fit(self, X, y):
            for _ in range(epochs):
                net.fit(X, y)
            self.classes_ = net.classes_; return self
        def predict_proba(self, X): return net.predict_proba(X)
    return Wrapper()


def candidates() -> dict:
    """name -> (feature_set, list of (hyperparameter-label, factory))."""
    grid = {}
    for fs_name, fs in (("f12", F12), ("f15", F15)):
        grid[f"logreg_{fs_name}"] = (fs, [(f"C={c}", lambda c=c: LogisticRegression(C=c, max_iter=2000)) for c in (0.01, 0.1, 1.0, 10.0)])
        grid[f"random_forest_{fs_name}"] = (fs, [(f"leaf={l}", lambda l=l: RandomForestClassifier(300, min_samples_leaf=l, n_jobs=-1, random_state=42)) for l in (20, 50)])
        grid[f"hist_gb_{fs_name}"] = (fs, [(f"depth={d},iter={i}", lambda d=d, i=i: HistGradientBoostingClassifier(learning_rate=0.05, max_depth=d, max_iter=i, l2_regularization=1.0, random_state=42)) for d in (2, 3) for i in (100, 200)])
        grid[f"mlp_{fs_name}"] = (fs, [("10ep,alpha=1e-3 (shipping config)", lambda: _mlp(10, 1e-3)), ("50ep,alpha=1e-2", lambda: _mlp(50, 1e-2))])
    return grid


class Prep:
    def __init__(self, cols, train_df):
        self.cols = cols
        self.imp = SimpleImputer(strategy="median").fit(train_df[cols].to_numpy(float))
        self.sc = StandardScaler().fit(self.imp.transform(train_df[cols].to_numpy(float)))
    def __call__(self, df): return self.sc.transform(self.imp.transform(df[self.cols].to_numpy(float)))


def _fit_predict(factory, cols, fit_df, pred_dfs):
    prep = Prep(cols, fit_df); model = factory().fit(prep(fit_df), fit_df.target.to_numpy())
    return model, prep, [_order(model, model.predict_proba(prep(d))) for d in pred_dfs]


def _isotonic_fit(P, y):
    O = M.onehot(y); return [IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(P[:, k], O[:, k]) for k in range(3)]


def _isotonic_apply(cals, P):
    Q = np.stack([c.predict(P[:, k]) for k, c in enumerate(cals)], axis=1) + 1e-6
    return Q / Q.sum(axis=1, keepdims=True)


def _git_commit():
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=C.ROOT, stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        return "uncommitted"


def run_evaluation() -> dict:
    gold = pd.read_parquet(C.GOLD_DIR / "features.parquet"); gold = gold[gold.included]
    tr, va, te = (gold[gold.split == s].reset_index(drop=True) for s in ("train", "validation", "test"))
    assert tr.kickoff_date.max() < va.kickoff_date.min() and va.kickoff_date.max() < te.kickoff_date.min(), "splits overlap in time"

    results, test_probs = {}, {}
    # --- baselines (fit on train only) ---
    freq = tr.target.value_counts(normalize=True).reindex(M.CLASSES).to_numpy()
    for name, df in (("validation", va), ("test", te)):
        results.setdefault("baseline_class_frequency", {})[name] = M.summarize(np.tile(freq, (len(df), 1)), df.target)
    test_probs["baseline_class_frequency"] = np.tile(freq, (len(te), 1))
    _, _, (pv, pt) = _fit_predict(lambda: LogisticRegression(C=1.0, max_iter=2000), ["elo_diff"], tr, [va, te])
    results["baseline_elo_only"] = {"validation": M.summarize(pv, va.target), "test": M.summarize(pt, te.target)}
    test_probs["baseline_elo_only"] = pt

    from pipeline.baselines import dixon_coles_predictions
    silver = pd.read_parquet(C.SILVER_DIR / "matches.parquet")
    dc_v, dc_t = dixon_coles_predictions(silver, va), dixon_coles_predictions(silver, te)
    results["baseline_dixon_coles"] = {"validation": M.summarize(dc_v, va.target), "test": M.summarize(dc_t, te.target)}
    test_probs["baseline_dixon_coles"] = dc_t
    print("dixon_coles val/test ll", results["baseline_dixon_coles"]["validation"]["log_loss"], results["baseline_dixon_coles"]["test"]["log_loss"], flush=True)

    # --- candidates: tune on validation, report test once ---
    chosen = {}
    for name, (cols, options) in candidates().items():
        best = None
        for label, factory in options:
            _, _, (pv, pt) = _fit_predict(factory, cols, tr, [va, te])
            val = M.summarize(pv, va.target)
            if best is None or val["log_loss"] < best["val"]["log_loss"]:
                best = {"label": label, "factory": factory, "val": val, "pv": pv, "pt": pt, "tried": best["tried"] if best else {}}
            best["tried"][label] = round(val["log_loss"], 5)
        chosen[name] = best
        results[name] = {"hyperparameters": best["label"], "validation_search_log_loss": best["tried"],
                         "validation": best["val"], "test": M.summarize(best["pt"], te.target)}
        test_probs[name] = best["pt"]
        print(f"{name:24s} val_ll={best['val']['log_loss']:.4f} test_ll={results[name]['test']['log_loss']:.4f} [{best['label']}]", flush=True)

    # --- selection by VALIDATION only; every candidate is serveable because features come from the shared team-state snapshot ---
    serving = {n: r for n, r in results.items() if not n.startswith("baseline")}
    winner = min(serving, key=lambda n: serving[n]["validation"]["log_loss"])
    research_best = min((n for n in results if not n.startswith("baseline")), key=lambda n: results[n]["validation"]["log_loss"])

    # --- calibration: pre-registered rule; fit on first half of validation, judged on second half ---
    half = len(va) // 2; va_a, va_b = va.iloc[:half], va.iloc[half:]
    cols = candidates()[winner][0]; factory = chosen[winner]["factory"]
    _, _, (pa, pb) = _fit_predict(factory, cols, tr, [va_a, va_b])
    cal_gain = float(M.log_loss_rows(pb, va_b.target).mean() - M.log_loss_rows(_isotonic_apply(_isotonic_fit(pa, va_a.target), pb), va_b.target).mean())
    use_cal = cal_gain > 0.001
    cals = _isotonic_fit(chosen[winner]["pv"], va.target) if use_cal else None
    pt_final = _isotonic_apply(cals, chosen[winner]["pt"]) if use_cal else chosen[winner]["pt"]
    winner_test = M.summarize(pt_final, te.target)

    # --- significance on the test window (paired bootstrap on per-match log loss) ---
    ll = {n: M.log_loss_rows(p, te.target) for n, p in test_probs.items()}
    ll_win = M.log_loss_rows(pt_final, te.target)
    vs_freq = M.paired_bootstrap_diff(ll_win, ll["baseline_class_frequency"]); vs_elo = M.paired_bootstrap_diff(ll_win, ll["baseline_elo_only"])
    vs_dc = M.paired_bootstrap_diff(ll_win, ll["baseline_dixon_coles"])
    beats_freq = vs_freq["ci95"][1] < 0; beats_elo = vs_elo["mean_diff"] <= 0
    promote = bool(beats_freq and beats_elo)
    per_league = {l: M.summarize(pt_final[(te.league == l).to_numpy()], te[te.league == l].target) for l in C.LEAGUES}

    version = datetime.now(timezone.utc).strftime("pitchside-1x2-%Y%m%dT%H%M%SZ")
    artifact_info = None
    if promote:  # refit locked config on train+validation; test figures above refer to the train-only fit
        fit_df = pd.concat([tr, va], ignore_index=True)
        prep = Prep(cols, fit_df); model = factory().fit(prep(fit_df), fit_df.target.to_numpy())
        bundle = {"imputer": prep.imp, "scaler": prep.sc, "model": model, "features": cols, "version": version, "feature_set_version": FEATURE_SET_VERSION}
        if use_cal:
            bundle["calibrator"] = _isotonic_fit(_order(model, model.predict_proba(prep(va))), va.target)  # note: calibrator fit on in-sample val; documented
        C.ROOT.joinpath("artifacts").mkdir(exist_ok=True)
        path = C.ROOT / "artifacts" / "football_result.joblib"; joblib.dump(bundle, path)
        vdir = C.ROOT / "artifacts" / "models" / version; vdir.mkdir(parents=True, exist_ok=True)
        joblib.dump(bundle, vdir / "model.joblib")
        artifact_info = {"path": "artifacts/football_result.joblib", "versioned_path": f"artifacts/models/{version}/model.joblib", "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "refit_on": "train+validation"}

    gold_report = json.loads((C.GOLD_DIR / "feature_report.json").read_text())
    report = {
        "run_at": datetime.now(timezone.utc).isoformat(), "version": version, "feature_set_version": FEATURE_SET_VERSION,
        "code_commit": _git_commit(), "data": {"source": C.SOURCE, "license": C.SOURCE_LICENSE, "leagues": list(C.LEAGUES), "seasons": [C.SEASONS[0], C.SEASONS[-1]],
                                              "features_sha256": gold_report["features_sha256"], "rows_by_split": gold_report["rows_by_split"], "date_range_by_split": gold_report["date_range_by_split"]},
        "results": results, "selection": {"serving_winner_by_validation": winner, "research_best_by_validation": research_best,
                                          "calibration_rule": "isotonic fit on first half of validation, kept only if log loss on second half improves by >0.001",
                                          "calibration_gain_on_validation_half": cal_gain, "calibration_applied": use_cal},
        "winner_test": winner_test, "winner_vs_class_frequency": vs_freq, "winner_vs_elo_only": vs_elo, "winner_vs_dixon_coles": vs_dc,
        "winner_per_league_test": per_league, "winner_test_calibration": M.calibration_table(pt_final, te.target),
        "promotion": {"rule": "CI95 of log-loss difference vs class-frequency baseline must be < 0 AND mean log loss must not be worse than the Elo-only baseline",
                      "promoted": promote, "artifact": artifact_info},
        "caveat": "Test window covers 2024-25 and 2025-26 (completed matches). Football outcomes are noisy; results are probabilistic skill estimates, not guarantees.",
    }
    C.REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (C.REPORT_DIR / "evaluation.json").write_text(json.dumps(report, indent=2, default=str))
    (C.LINEAGE_DIR / "model_lineage.json").write_text(json.dumps({"bronze_manifest": "data/lineage/bronze_manifest.json", "silver_report": "data/silver/quality_report.json",
        "feature_report": "data/gold/feature_report.json", "split_boundaries": gold_report["split_boundaries"], "code_commit": report["code_commit"],
        "model_version": version, "artifact": artifact_info, "evaluation_report": "artifacts/reports/evaluation.json"}, indent=2))
    if promote:
        meta = {"version": version, "trained_at": report["run_at"], "data_file": "data/processed/matches.csv", "model": winner, "hyperparameters": chosen[winner]["label"],
                "classes": M.CLASSES, "features": cols, "feature_set_version": FEATURE_SET_VERSION, "test_metrics": winner_test, "evaluation_report": "artifacts/reports/evaluation.json",
                "warning": report["caveat"]}
        (C.ROOT / "artifacts" / "football_result_metadata.json").write_text(json.dumps(meta, indent=2))
        (C.ROOT / "artifacts" / "models" / version / "metadata.json").write_text(json.dumps({**meta, "artifact_sha256": artifact_info["sha256"]}, indent=2))
    _write_markdown(report, results)
    from pipeline.model_card import write_model_card
    write_model_card(report)
    _plot(report)
    print(json.dumps({"winner": winner, "winner_test": winner_test, "vs_freq": vs_freq, "vs_elo": vs_elo, "promoted": promote}, indent=1))
    return report


def _write_markdown(report, results):
    lines = ["# PitchSide 1X2 evaluation report", "", f"Run: {report['run_at']} · feature set {report['feature_set_version']} · commit `{report['code_commit']}`", "",
             f"Data: {report['data']['source']} ({report['data']['license']}); leagues {', '.join(report['data']['leagues'])}; seasons {report['data']['seasons'][0]}–{report['data']['seasons'][1]}.",
             f"Rows by split: {report['data']['rows_by_split']}", "",
             "| Model | Hyperparameters (chosen on validation) | Val log loss | Test log loss | Test Brier | Test RPS | Test acc |", "|---|---|---|---|---|---|---|"]
    for name, r in sorted(results.items(), key=lambda kv: kv[1]["test"]["log_loss"]):
        t = r["test"]; lines.append(f"| {name} | {r.get('hyperparameters', '—')} | {r['validation']['log_loss']:.4f} | {t['log_loss']:.4f} | {t['brier']:.4f} | {t['rps']:.4f} | {t['accuracy']:.3f} |")
    s = report["selection"]; p = report["promotion"]
    lines += ["", f"**Serving winner (chosen on validation):** `{s['serving_winner_by_validation']}` · calibration applied: {s['calibration_applied']} (gain {s['calibration_gain_on_validation_half']:+.4f})",
              f"**Test (final):** {report['winner_test']}", "",
              f"vs class-frequency baseline: Δlog-loss {report['winner_vs_class_frequency']['mean_diff']:+.4f}, 95% CI {report['winner_vs_class_frequency']['ci95']}",
              f"vs Elo-only baseline: Δlog-loss {report['winner_vs_elo_only']['mean_diff']:+.4f}, 95% CI {report['winner_vs_elo_only']['ci95']}", "",
              f"vs Dixon-Coles baseline: Δlog-loss {report['winner_vs_dixon_coles']['mean_diff']:+.4f}, 95% CI {report['winner_vs_dixon_coles']['ci95']}", "",
              f"**Promotion rule:** {p['rule']}", f"**Promoted:** {p['promoted']}", "", f"_{report['caveat']}_"]
    (C.REPORT_DIR / "evaluation.md").write_text("\n".join(lines))


def _plot(report):
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(1, 3, figsize=(12, 3.8))
    for a, c in zip(ax, M.CLASSES):
        b = report["winner_test_calibration"][c]["bins"]
        a.plot([0, 1], [0, 1], "k--", lw=1); a.plot([x["mean_predicted"] for x in b], [x["observed_freq"] for x in b], "o-")
        a.set_title(f"{c} (ECE {report['winner_test_calibration'][c]['ece']:.3f})"); a.set_xlabel("predicted"); a.set_ylabel("observed")
    fig.suptitle(f"Test calibration — {report['selection']['serving_winner_by_validation']}"); fig.tight_layout()
    fig.savefig(C.REPORT_DIR / "calibration.png", dpi=110)

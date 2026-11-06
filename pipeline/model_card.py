"""Model card generated from the evaluation report (spec 16.5). Called by evaluate; also runnable alone."""
import json
from pipeline import config as C


def write_model_card(report: dict | None = None) -> str:
    report = report or json.loads((C.REPORT_DIR / "evaluation.json").read_text())
    s, w, p = report["selection"], report["winner_test"], report["promotion"]
    res = report["results"][s["serving_winner_by_validation"]]
    lines = [
        f"# Model card — {report['version']}", "",
        "## Intended use", "Pre-match home/draw/away probabilities for top-flight fixtures in the five covered leagues, shown with uncertainty and data freshness. Not for betting advice, in-play forecasting, exact-score claims or leagues outside coverage.", "",
        "## Model", f"`{s['serving_winner_by_validation']}` ({res.get('hyperparameters', '')}); feature set {report['feature_set_version']}; calibration applied: {s['calibration_applied']}.", "",
        "## Data", f"{report['data']['source']} ({report['data']['license']}); leagues {', '.join(report['data']['leagues'])}; seasons {report['data']['seasons'][0]} to {report['data']['seasons'][1]}; rows by split {report['data']['rows_by_split']}; features hash `{report['data']['features_sha256'][:16]}…`.", "",
        "## Evaluation (untouched test window)", f"Log loss {w['log_loss']:.4f}, Brier {w['brier']:.4f}, RPS {w['rps']:.4f}, accuracy {w['accuracy']:.3f} on {w['n']} matches.",
        f"Versus class frequency: {report['winner_vs_class_frequency']['mean_diff']:+.4f} log loss (95% CI {report['winner_vs_class_frequency']['ci95'][0]:+.4f} to {report['winner_vs_class_frequency']['ci95'][1]:+.4f}).",
        f"Versus Elo-only: {report['winner_vs_elo_only']['mean_diff']:+.4f} (CI {report['winner_vs_elo_only']['ci95'][0]:+.4f} to {report['winner_vs_elo_only']['ci95'][1]:+.4f}); versus Dixon-Coles: {report['winner_vs_dixon_coles']['mean_diff']:+.4f} (CI {report['winner_vs_dixon_coles']['ci95'][0]:+.4f} to {report['winner_vs_dixon_coles']['ci95'][1]:+.4f}).", "",
        "## Known limitations",
        "- Results-only data: no xG, lineups, injuries, odds or in-play events.",
        "- Gains over a simple Elo rating are not statistically distinguishable; the model is a calibrated rating-based forecaster, not a breakthrough predictor.",
        "- Promoted teams and teams with fewer than 5 earlier matches are not forecast.", "- Ratings come from a snapshot; predictions are marked stale when the snapshot is older than 14 days.", "",
        "## Release status", f"Promotion gate passed: {p['promoted']}. The registry still requires explicit lifecycle approval (candidate → offline_validated → shadow → canary → production).", "",
        f"Code commit: `{report['code_commit']}` · run {report['run_at']}",
    ]
    out = C.REPORT_DIR / "model_card.md"; out.write_text("\n".join(lines)); return str(out)


if __name__ == "__main__":
    print(write_model_card())

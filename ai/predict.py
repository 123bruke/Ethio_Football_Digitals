"""Pre-match prediction serving (spec 12.10, 13.1-13.3).

Two entry points share one artifact loader:
  predict_match(features)  - caller supplies the feature vector (legacy contract, validated against the artifact's own feature list)
  predict_fixture(...)     - caller supplies league/teams/kickoff; features are computed server-side from the team-state snapshot
                             with the SAME FormState code used for training, so train/serve skew is impossible by construction."""
import difflib
import json
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app.core.config import settings
from ai.features import validate_inference_features

CLASS_ORDER = ("home", "draw", "away")
FRESH_DAYS, DEGRADED_DAYS = 14, 120


class PredictionNotReady(RuntimeError):
    pass


@lru_cache(maxsize=4)
def _load_bundle(path_text: str, modified_time: float):
    del modified_time
    return joblib.load(path_text)


@lru_cache(maxsize=1)
def _load_state(path_text: str, modified_time: float):
    del modified_time
    from pipeline.gold import FormState
    return FormState.from_json(json.loads(Path(path_text).read_text(encoding="utf-8")))


def _bundle(artifact_path: str | None):
    artifact = Path(artifact_path or settings.model_artifact_path)
    if not artifact.exists():
        raise PredictionNotReady("No approved prediction model is installed. Run `python -m pipeline.run all` and promote a version in the admin registry.")
    return _load_bundle(str(artifact), artifact.stat().st_mtime)


def _probabilities(bundle, values: list[float]) -> dict[str, float]:
    X = bundle["scaler"].transform(bundle["imputer"].transform(np.asarray([values], dtype=float)))
    model = bundle["model"]; raw = model.predict_proba(X)[0]
    by_class = {str(label): float(score) for label, score in zip(model.classes_, raw)}
    calibrators = bundle.get("calibrator")
    if calibrators:
        ordered = [calibrators[i].predict([by_class[c]])[0] + 1e-6 for i, c in enumerate(CLASS_ORDER)]
        total = sum(ordered); by_class = {c: ordered[i] / total for i, c in enumerate(CLASS_ORDER)}
    return {c: by_class.get(c, 0.0) for c in CLASS_ORDER}


def _finish(probability: dict, bundle) -> dict:
    from app.services.metta_reasoner import explain_confidence
    predicted = max(CLASS_ORDER, key=lambda c: probability[c]); confidence = probability[predicted]
    return {**probability, "predicted": predicted, "confidence": confidence,
            "model_version": bundle.get("version", "unknown"), "explanation": explain_confidence(confidence)}


def predict_match(features: dict[str, float], artifact_path: str | None = None) -> dict:
    bundle = _bundle(artifact_path)
    values = validate_inference_features(features, list(bundle["features"]))
    return _finish(_probabilities(bundle, values), bundle)


def season_label(date: pd.Timestamp) -> str:
    start = date.year if date.month >= 7 else date.year - 1
    return f"{start}-{str(start + 1)[2:]}"


def _freshness(age_days: int) -> str:
    return "fresh" if age_days <= FRESH_DAYS else "stale" if age_days <= DEGRADED_DAYS else "degraded"


def predict_fixture(league: str, home_team: str, away_team: str, kickoff_date: str | None = None, artifact_path: str | None = None) -> dict:
    from pipeline.silver import team_key
    bundle = _bundle(artifact_path)
    state_path = Path(settings.team_state_path)
    if not state_path.exists():
        raise PredictionNotReady("Team-state snapshot is missing. Run `python -m pipeline.run gold`.")
    state = _load_state(str(state_path), state_path.stat().st_mtime)
    if bundle.get("feature_set_version") and state.to_json()["feature_set_version"] != bundle["feature_set_version"]:
        raise PredictionNotReady("Model and team-state snapshot use different feature-set versions; refusing to predict.")
    kickoff = pd.Timestamp(kickoff_date, tz="UTC") if kickoff_date else pd.Timestamp(datetime.now(timezone.utc).date(), tz="UTC")
    if state.as_of is not None and kickoff <= state.as_of:
        raise ValueError(f"Kickoff {kickoff.date()} is not after the snapshot date {state.as_of.date()}; historical what-if predictions are not served.")
    home, away = team_key(home_team), team_key(away_team)
    if home == away:
        raise ValueError("Home and away teams must differ.")
    known = sorted({t for (l, t) in state.elo if l == league})
    if not known:
        raise ValueError(f"Unknown league '{league}'.")
    for raw, key in ((home_team, home), (away_team, away)):
        if key not in known:
            hint = difflib.get_close_matches(key, known, n=3, cutoff=0.6)
            raise ValueError(f"Unknown team '{raw}' in {league}." + (f" Did you mean: {', '.join(hint)}?" if hint else ""))
    features = state.features_for(league, season_label(kickoff), home, away, kickoff)
    if not features.pop("history_ok"):
        raise ValueError("Not enough recent matches for one of the teams; no prediction available.")
    values = validate_inference_features({k: features[k] for k in bundle["features"]}, list(bundle["features"]))
    result = _finish(_probabilities(bundle, values), bundle)
    age = (kickoff - state.as_of).days if state.as_of is not None else 9999
    fresh = _freshness(age)
    result.update({
        "horizon": "pre_match", "predicted_at": datetime.now(timezone.utc).isoformat(), "kickoff_date": str(kickoff.date()),
        "data_as_of": str(state.as_of.date()) if state.as_of is not None else None, "data_age_days": age, "freshness": fresh,
        "feature_set_version": bundle.get("feature_set_version", "unknown"),
        "uncertainty_note": ("Football outcomes are noisy: even the best calibrated models in this project assign the favourite roughly 45-65% in most fixtures. "
                             + ("Ratings are older than two weeks (possible off-season or missing recent results), so treat this as lower quality." if fresh != "fresh" else "")).strip(),
        "evidence": {"home_elo": round(features["home_elo"], 1), "away_elo": round(features["away_elo"], 1),
                     "home_recent_points": round(features["home_recent_points"], 2), "away_recent_points": round(features["away_recent_points"], 2),
                     "home_rest_days": features["home_rest_days"], "away_rest_days": features["away_rest_days"]},
        "teams": {"home": home, "away": away},
    })
    return result

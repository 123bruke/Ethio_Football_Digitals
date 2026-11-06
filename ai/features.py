from pathlib import Path
import pandas as pd

FEATURE_COLUMNS = [
    "home_recent_points",
    "away_recent_points",
    "home_goals_for_avg",
    "away_goals_for_avg",
    "home_goals_against_avg",
    "away_goals_against_avg",
    "home_win_rate",
    "away_win_rate",
    "home_rest_days",
    "away_rest_days",
    "home_league_position_norm",
    "away_league_position_norm",
]
TARGET_COLUMN = "target"
VALID_CLASSES = {"home", "draw", "away"}


def read_training_data(path: str | Path) -> pd.DataFrame:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(
            f"Training file not found: {file_path}. Add a licensed historical match CSV; see data/raw/README.md."
        )
    data = pd.read_csv(file_path)
    required = set(FEATURE_COLUMNS + [TARGET_COLUMN])
    missing = sorted(required - set(data.columns))
    if missing:
        raise ValueError(f"Training CSV is missing required columns: {', '.join(missing)}")
    data = data.dropna(subset=[TARGET_COLUMN]).copy()
    for column in FEATURE_COLUMNS:
        data[column] = pd.to_numeric(data[column], errors="coerce")
    data[TARGET_COLUMN] = data[TARGET_COLUMN].astype(str).str.strip().str.lower()
    data = data.dropna(subset=FEATURE_COLUMNS)
    unexpected = sorted(set(data[TARGET_COLUMN]) - VALID_CLASSES)
    if unexpected:
        raise ValueError(f"Unknown target labels: {unexpected}. Expected home, draw, away.")
    if "kickoff_date" in data.columns:
        data["kickoff_date"] = pd.to_datetime(data["kickoff_date"], errors="coerce", utc=True)
        data = data.sort_values("kickoff_date", kind="stable")
    if len(data) < 60:
        raise ValueError(f"Only {len(data)} usable rows found. Use at least 60; several hundred or more are preferable.")
    if set(data[TARGET_COLUMN]) != VALID_CLASSES:
        raise ValueError("Training data must contain all three target classes: home, draw, and away.")
    return data.reset_index(drop=True)


def validate_inference_features(features: dict[str, float], columns: list[str] | None = None) -> list[float]:
    columns = columns or FEATURE_COLUMNS
    missing = [column for column in columns if column not in features]
    extra = [column for column in features if column not in columns]
    if missing:
        raise ValueError(f"Missing input features: {', '.join(missing)}")
    if extra:
        raise ValueError(f"Unknown input features: {', '.join(extra)}")
    values = [float(features[column]) for column in columns]
    if any(not (-5000 <= value <= 5000) for value in values):
        raise ValueError("Feature values are outside the accepted numeric range.")
    return values

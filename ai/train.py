"""Train a small CPU-only neural network for home/draw/away classification.

Run from the repository root:
    python -m ai.train --data data/processed/matches.csv --epochs 10
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report, f1_score, log_loss
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

from ai.features import FEATURE_COLUMNS, TARGET_COLUMN, read_training_data

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"


def train(data_path: str, epochs: int = 10) -> dict:
    frame = read_training_data(data_path)
    X = frame[FEATURE_COLUMNS].to_numpy(dtype=float)
    y = frame[TARGET_COLUMN].to_numpy(dtype=str)

    # Keep the most recent matches as a holdout set to reduce temporal leakage.
    split_at = int(len(frame) * 0.8)
    if split_at < 40 or len(frame) - split_at < 12:
        raise ValueError("Not enough data for a useful chronological train/test split.")
    X_train, X_test = X[:split_at], X[split_at:]
    y_train, y_test = y[:split_at], y[split_at:]
    classes = np.array(["away", "draw", "home"])
    if set(y_train) != set(classes):
        raise ValueError("The training portion must contain home, draw, and away outcomes. Add more historical data.")

    imputer = SimpleImputer(strategy="median")
    X_train = imputer.fit_transform(X_train)
    X_test = imputer.transform(X_test)
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    network = MLPClassifier(
        hidden_layer_sizes=(32, 16),
        activation="relu",
        solver="adam",
        alpha=0.001,
        learning_rate_init=0.001,
        batch_size="auto",
        max_iter=1,
        warm_start=True,
        random_state=42,
    )
    epoch_losses: list[float] = []
    for epoch in range(max(1, min(100, epochs))):
        network.fit(X_train, y_train)
        epoch_losses.append(float(network.loss_))

    probabilities = network.predict_proba(X_test)
    predictions = network.classes_[np.argmax(probabilities, axis=1)]
    metrics = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "macro_f1": float(f1_score(y_test, predictions, average="macro", zero_division=0)),
        "log_loss": float(log_loss(y_test, probabilities, labels=network.classes_)),
        "classification_report": classification_report(y_test, predictions, labels=classes, zero_division=0, output_dict=True),
    }
    version = datetime.now(timezone.utc).strftime("nn-%Y%m%dT%H%M%SZ")
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    model_path = ARTIFACTS / "football_result.joblib"
    metadata_path = ARTIFACTS / "football_result_metadata.json"
    joblib.dump({"imputer": imputer, "scaler": scaler, "model": network, "features": FEATURE_COLUMNS, "version": version}, model_path)
    metadata = {
        "version": version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "data_file": str(Path(data_path)),
        "rows_total": int(len(frame)),
        "rows_train": int(len(y_train)),
        "rows_test": int(len(y_test)),
        "epochs": int(len(epoch_losses)),
        "classes": [str(item) for item in network.classes_],
        "features": FEATURE_COLUMNS,
        "epoch_losses": epoch_losses,
        "metrics": metrics,
        "warning": "Evaluation quality depends on data quality, coverage, feature timing and sample size. Not a guarantee of future outcomes.",
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"model": str(model_path), "metadata": str(metadata_path), "metrics": metrics, "loss_by_epoch": epoch_losses}, indent=2))
    return metadata


def main():
    parser = argparse.ArgumentParser(description="Train the PitchSide football-result neural network")
    parser.add_argument("--data", default=str(ROOT / "data" / "processed" / "matches.csv"))
    parser.add_argument("--epochs", type=int, default=10)
    args = parser.parse_args()
    train(args.data, args.epochs)


if __name__ == "__main__":
    main()

"""Probabilistic forecast metrics for ordered 1X2 outcomes (spec 12.7). Class order is always home, draw, away."""
import numpy as np

CLASSES = ["home", "draw", "away"]
_EPS = 1e-12


def onehot(y) -> np.ndarray:
    y = np.asarray(y)
    return np.stack([(y == c).astype(float) for c in CLASSES], axis=1)


def log_loss_rows(P, y):
    return -np.log(np.clip((np.asarray(P) * onehot(y)).sum(axis=1), _EPS, 1.0))


def brier_rows(P, y):  # multiclass Brier: sum over classes of squared error
    return ((np.asarray(P) - onehot(y)) ** 2).sum(axis=1)


def rps_rows(P, y):  # ranked probability score over ordered home < draw < away
    d = np.cumsum(np.asarray(P), axis=1)[:, :-1] - np.cumsum(onehot(y), axis=1)[:, :-1]
    return (d ** 2).sum(axis=1) / (len(CLASSES) - 1)


def summarize(P, y) -> dict:
    P = np.asarray(P); y = np.asarray(y)
    pred = np.array(CLASSES)[P.argmax(axis=1)]
    f1s = []
    for c in CLASSES:
        tp = ((pred == c) & (y == c)).sum(); fp = ((pred == c) & (y != c)).sum(); fn = ((pred != c) & (y == c)).sum()
        f1s.append(0.0 if tp == 0 else 2 * tp / (2 * tp + fp + fn))
    return {"n": int(len(y)), "log_loss": float(log_loss_rows(P, y).mean()), "brier": float(brier_rows(P, y).mean()),
            "rps": float(rps_rows(P, y).mean()), "accuracy": float((pred == y).mean()), "macro_f1": float(np.mean(f1s))}


def paired_bootstrap_diff(loss_a, loss_b, n_boot=2000, seed=7) -> dict:
    """Mean(loss_a - loss_b) with a 95% percentile CI; negative favors model A."""
    d = np.asarray(loss_a) - np.asarray(loss_b)
    rng = np.random.default_rng(seed)
    means = d[rng.integers(0, len(d), size=(n_boot, len(d)))].mean(axis=1)
    return {"mean_diff": float(d.mean()), "ci95": [float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))]}


def calibration_table(P, y, bins=10) -> dict:
    P = np.asarray(P); O = onehot(y); out = {}
    for k, c in enumerate(CLASSES):
        edges = np.linspace(0, 1, bins + 1); idx = np.clip(np.digitize(P[:, k], edges) - 1, 0, bins - 1)
        rows, ece = [], 0.0
        for b in range(bins):
            mask = idx == b
            if mask.sum() == 0:
                continue
            conf, freq = float(P[mask, k].mean()), float(O[mask, k].mean())
            rows.append({"bin": b, "n": int(mask.sum()), "mean_predicted": round(conf, 4), "observed_freq": round(freq, 4)})
            ece += mask.mean() * abs(conf - freq)
        out[c] = {"ece": float(ece), "bins": rows}
    return out

"""MeTTa/Hyperon explanation rules with a safe Python fallback.

MeTTa is used for explainability hints only. It never authorizes user/account actions.
"""
from pathlib import Path
from app.core.config import settings

RULES_PATH = Path(__file__).resolve().parents[3] / "ai" / "metta" / "prediction_rules.metta"


def explain_confidence(confidence: float) -> str:
    if confidence < 0.45:
        fallback = "The model is uncertain. Treat all three outcomes as plausible and avoid over-interpreting the top probability."
    elif confidence < 0.60:
        fallback = "The model has a modest preference, but the probabilities are close enough that the match remains difficult to call."
    else:
        fallback = "The model has a clearer preference, but a probability is not a guarantee and unexpected events can change the result."

    try:
        from hyperon import MeTTa  # type: ignore
        if not RULES_PATH.exists():
            return fallback
        interpreter = MeTTa()
        result = interpreter.run(RULES_PATH.read_text(encoding="utf-8"))
        # Interpreter output is deliberately not used as executable authority.
        return fallback if result is None else fallback
    except Exception:
        # Hyperon is experimental and optional in deployments; app behavior remains stable.
        return fallback

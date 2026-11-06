from fastapi import APIRouter
from sqlalchemy import text
from app.db.session import engine
from app.core.config import settings
from pathlib import Path

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    db_ok = False
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass
    model_path = Path(settings.model_artifact_path)
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unavailable",
        "prediction_model": "trained" if model_path.exists() else "not_trained",
        "environment": settings.environment,
    }

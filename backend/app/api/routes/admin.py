from datetime import datetime, timedelta, timezone
import json
import shutil
import psutil
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api.deps import get_admin_user
from app.core.config import settings
from app.db.models import DirectMessage, MatchRecord, Post, PredictionRecord, User
from app.db.session import get_db
from pathlib import Path

router = APIRouter(prefix="/admin", tags=["admin"])


def _directory_size_bytes(directory: Path) -> int:
    if not directory.exists():
        return 0
    total = 0
    try:
        for item in directory.rglob("*"):
            if item.is_file():
                try:
                    total += item.stat().st_size
                except OSError:
                    continue
    except OSError:
        return total
    return total


class UserStatusUpdate(BaseModel):
    is_active: bool


@router.get("/metrics")
def metrics(_admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    active_since = now - timedelta(hours=24)
    users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.last_seen_at >= active_since, User.is_active.is_(True)).scalar() or 0
    predictions = db.query(func.count(PredictionRecord.id)).scalar() or 0
    matches = db.query(func.count(MatchRecord.id)).scalar() or 0
    posts = db.query(func.count(Post.id)).scalar() or 0
    messages = db.query(func.count(DirectMessage.id)).scalar() or 0
    prediction_counts = db.query(PredictionRecord.predicted_class, func.count(PredictionRecord.id)).group_by(PredictionRecord.predicted_class).all()
    usage = psutil.virtual_memory()
    process_memory = psutil.Process().memory_info().rss
    disk_path = Path(settings.data_directory)
    if not disk_path.exists():
        disk_path = Path.cwd()
    disk = shutil.disk_usage(disk_path)
    project_storage_bytes = _directory_size_bytes(Path(settings.data_directory)) + _directory_size_bytes(Path(settings.model_artifact_path).parent)
    model_path = Path(settings.model_artifact_path)
    metadata_path = Path(settings.model_metadata_path)
    training = {}
    if metadata_path.exists():
        try:
            training = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            training = {}
    model_size_mb = round(model_path.stat().st_size / (1024 ** 2), 2) if model_path.exists() else 0.0
    training_metrics = training.get("metrics", {}) if isinstance(training, dict) else {}
    epoch_losses = training.get("epoch_losses", []) if isinstance(training, dict) else []
    return {
        "users_total": users,
        "users_active_24h": active_users,
        "predictions_total": predictions,
        "matches_total": matches,
        "posts_total": posts,
        "messages_total": messages,
        "prediction_classes": {label: count for label, count in prediction_counts},
        "system": {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "ram_percent": usage.percent,
            "ram_used_gb": round(usage.used / (1024 ** 3), 2),
            "ram_total_gb": round(usage.total / (1024 ** 3), 2),
            "api_process_ram_mb": round(process_memory / (1024 ** 2), 1),
            "disk_used_gb": round(disk.used / (1024 ** 3), 2),
            "disk_total_gb": round(disk.total / (1024 ** 3), 2),
            "disk_path": str(disk_path),
            "project_data_models_mb": round(project_storage_bytes / (1024 ** 2), 2),
        },
        "ai": {
            "prediction_model": "trained" if model_path.exists() else "not_trained",
            "assistant_provider": f"Ollama · {settings.ollama_model}",
            "reasoning_layer": "Hyperon/MeTTa optional with Python fallback",
            "training": {
                "epochs_completed": len(epoch_losses),
                "epochs_requested": training.get("epochs", 0) if isinstance(training, dict) else 0,
                "latest_loss": epoch_losses[-1] if epoch_losses else None,
                "accuracy": training_metrics.get("accuracy"),
                "macro_f1": training_metrics.get("macro_f1"),
                "trained_at": training.get("trained_at") if isinstance(training, dict) else None,
                "version": training.get("version") if isinstance(training, dict) else None,
                "model_size_mb": model_size_mb,
            },
        },
        "generated_at": now.isoformat(),
    }


@router.get("/users")
def list_users(_admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).limit(200).all()
    return [
        {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat(),
            "last_seen_at": user.last_seen_at.isoformat() if user.last_seen_at else None,
        }
        for user in users
    ]


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Account not found")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own administrator account")
    if target.role == "admin":
        raise HTTPException(status_code=403, detail="This endpoint only manages player accounts")
    target.is_active = payload.is_active
    db.commit()
    db.refresh(target)
    return {"id": target.id, "username": target.username, "is_active": target.is_active}

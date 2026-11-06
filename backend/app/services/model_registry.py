"""Model registry with an enforced release lifecycle (spec 13.4, 16.5):
candidate -> offline_validated -> shadow -> canary -> production -> retired, plus rollback.
Every state change writes an audit event. Rollback restores the previous production artifact only if its
feature contract is compatible with the live team-state snapshot (spec 13.4)."""
import json
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.models import AuditEvent, ModelVersion

ALLOWED = {
    "candidate": {"offline_validated", "retired"},
    "offline_validated": {"shadow", "retired"},
    "shadow": {"canary", "offline_validated", "retired"},
    "canary": {"production", "shadow", "retired"},
    "production": {"retired"},
    "retired": set(),
}


class RegistryError(ValueError):
    pass


def _audit(db: Session, actor_id: str, action: str, target: str, details: dict):
    db.add(AuditEvent(actor_id=actor_id, action=action, target=target, details=details))


def _snapshot_feature_set() -> str | None:
    path = Path(settings.team_state_path)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8")).get("feature_set_version")


def _check_contract(model: ModelVersion):
    live = _snapshot_feature_set()
    if live is not None and live != model.feature_set_version:
        raise RegistryError(f"Feature contract mismatch: model uses {model.feature_set_version}, live snapshot uses {live}.")


def register(db: Session, version: str, actor_id: str) -> ModelVersion:
    if "/" in version or ".." in version:
        raise RegistryError("Invalid version name.")
    directory = Path(settings.models_directory) / version
    meta_path, artifact = directory / "metadata.json", directory / "model.joblib"
    if not meta_path.exists() or not artifact.exists():
        raise RegistryError(f"No artifact directory for version '{version}'.")
    if db.query(ModelVersion).filter_by(version=version).first():
        raise RegistryError("Version already registered.")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    row = ModelVersion(version=version, feature_set_version=meta.get("feature_set_version", "unknown"), features=meta["features"],
                       artifact_path=str(artifact), artifact_sha256=meta.get("artifact_sha256", ""), metrics=meta.get("test_metrics", {}),
                       model_card={k: meta.get(k) for k in ("model", "hyperparameters", "classes", "evaluation_report", "warning")}, created_by=actor_id)
    db.add(row); _audit(db, actor_id, "model.register", version, {"sha256": row.artifact_sha256}); db.commit()
    return row


def current_production(db: Session) -> ModelVersion | None:
    return db.query(ModelVersion).filter_by(stage="production").first()


def transition(db: Session, version: str, to_stage: str, actor_id: str, note: str) -> ModelVersion:
    row = db.query(ModelVersion).filter_by(version=version).first()
    if not row:
        raise RegistryError("Unknown model version.")
    if to_stage not in ALLOWED.get(row.stage, set()):
        raise RegistryError(f"Illegal transition {row.stage} -> {to_stage}.")
    if to_stage == "production":
        if not note.strip():
            raise RegistryError("Promotion to production requires an approval note.")
        if settings.environment == "production" and row.created_by == actor_id:
            raise RegistryError("Four-eyes rule: the person who registered a model cannot promote it.")
        _check_contract(row)
        if not Path(row.artifact_path).exists():
            raise RegistryError("Artifact file is missing.")
        old = current_production(db)
        if old:
            old.stage = "retired"; _audit(db, actor_id, "model.retire", old.version, {"reason": "superseded", "by": version})
        row.production_since = datetime.now(timezone.utc)
    previous = row.stage; row.stage = to_stage
    _audit(db, actor_id, "model.transition", version, {"from": previous, "to": to_stage, "note": note}); db.commit()
    return row


def rollback(db: Session, actor_id: str, note: str) -> ModelVersion:
    if not note.strip():
        raise RegistryError("Rollback requires a note.")
    current = current_production(db)
    candidates = db.query(ModelVersion).filter(ModelVersion.stage == "retired", ModelVersion.production_since.isnot(None)) \
        .order_by(ModelVersion.production_since.desc()).all()
    previous = next((m for m in candidates if not current or m.id != current.id), None)
    if not previous:
        raise RegistryError("No previously deployed version to roll back to.")
    _check_contract(previous)
    if not Path(previous.artifact_path).exists():
        raise RegistryError("Previous artifact file is missing.")
    if current:
        current.stage = "retired"
    previous.stage = "production"; previous.production_since = datetime.now(timezone.utc)
    _audit(db, actor_id, "model.rollback", previous.version, {"from": current.version if current else None, "note": note}); db.commit()
    return previous


def active_artifact_path(db: Session) -> str | None:
    row = current_production(db)
    return row.artifact_path if row else None

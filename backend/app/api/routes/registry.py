from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.api.deps import get_admin_user
from app.db.models import AuditEvent, ModelVersion, User
from app.db.session import get_db
from app.services import model_registry as registry

router = APIRouter(prefix="/admin", tags=["model-registry"])


class RegisterBody(BaseModel):
    version: str = Field(min_length=3, max_length=80)


class TransitionBody(BaseModel):
    to_stage: str
    note: str = Field(default="", max_length=500)


class NoteBody(BaseModel):
    note: str = Field(min_length=1, max_length=500)


def _view(m: ModelVersion) -> dict:
    return {"version": m.version, "task": m.task, "stage": m.stage, "feature_set_version": m.feature_set_version, "features": m.features,
            "artifact_sha256": m.artifact_sha256, "metrics": m.metrics, "model_card": m.model_card, "created_by": m.created_by,
            "created_at": m.created_at.isoformat(), "production_since": m.production_since.isoformat() if m.production_since else None}


def _guard(fn):
    try:
        return fn()
    except registry.RegistryError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/models")
def list_models(_a: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return [_view(m) for m in db.query(ModelVersion).order_by(ModelVersion.created_at.desc()).all()]


@router.post("/models/register")
def register_model(body: RegisterBody, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return _view(_guard(lambda: registry.register(db, body.version, admin.id)))


@router.post("/models/rollback")
def rollback_model(body: NoteBody, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return _view(_guard(lambda: registry.rollback(db, admin.id, body.note)))


@router.post("/models/{version}/transition")
def transition_model(version: str, body: TransitionBody, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return _view(_guard(lambda: registry.transition(db, version, body.to_stage, admin.id, body.note)))


@router.get("/audit")
def audit_trail(_a: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    rows = db.query(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(200).all()
    return [{"id": r.id, "actor_id": r.actor_id, "action": r.action, "target": r.target, "details": r.details, "created_at": r.created_at.isoformat()} for r in rows]

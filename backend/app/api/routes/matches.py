from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.models import MatchRecord, User
from app.db.session import get_db
from app.schemas import MatchCreate

router = APIRouter(prefix="/matches", tags=["matches"])


@router.post("", status_code=201)
def save_match(payload: MatchCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = MatchRecord(
        user_id=user.id,
        home_score=payload.home_score,
        away_score=payload.away_score,
        duration_seconds=payload.duration_seconds,
        result=payload.result,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "home_score": record.home_score, "away_score": record.away_score, "duration_seconds": record.duration_seconds, "created_at": record.created_at.isoformat()}


@router.get("/me")
def my_matches(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = (
        db.query(MatchRecord)
        .filter(MatchRecord.user_id == user.id)
        .order_by(MatchRecord.created_at.desc())
        .limit(50)
        .all()
    )
    return [{"id": item.id, "home_score": item.home_score, "away_score": item.away_score, "duration_seconds": item.duration_seconds, "result": item.result, "created_at": item.created_at.isoformat()} for item in records]

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.models import PredictionRecord, User
from app.db.session import get_db
from app.schemas import FixturePredictionRequest, FixturePredictionResponse, PredictionRequest, PredictionResponse
from app.services.model_registry import active_artifact_path
from ai.predict import PredictionNotReady, predict_fixture, predict_match

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.post("", response_model=PredictionResponse)
def create_prediction(payload: PredictionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        result = predict_match(payload.features, active_artifact_path(db))
    except PredictionNotReady as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    record = PredictionRecord(
        user_id=user.id,
        home_team=payload.home_team,
        away_team=payload.away_team,
        predicted_class=result["predicted"],
        probabilities={"home": result["home"], "draw": result["draw"], "away": result["away"]},
        model_version=result["model_version"],
    )
    db.add(record)
    db.commit()
    return PredictionResponse(**result)


@router.post("/fixture", response_model=FixturePredictionResponse)
def predict_fixture_route(payload: FixturePredictionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Pre-match forecast from team names only; features are computed server-side from the team-state snapshot."""
    try:
        result = predict_fixture(payload.league, payload.home_team, payload.away_team, payload.kickoff_date, active_artifact_path(db))
    except PredictionNotReady as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    db.add(PredictionRecord(
        user_id=user.id, home_team=payload.home_team, away_team=payload.away_team, predicted_class=result["predicted"],
        probabilities={"home": result["home"], "draw": result["draw"], "away": result["away"]}, model_version=result["model_version"],
        details={k: result[k] for k in ("horizon", "kickoff_date", "data_as_of", "freshness", "feature_set_version", "evidence", "league") if k in result} | {"league": payload.league}))
    db.commit()
    return FixturePredictionResponse(**result)

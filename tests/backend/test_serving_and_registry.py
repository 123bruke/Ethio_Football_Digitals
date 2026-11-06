import json, os, shutil, sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT), str(ROOT / "backend")]
os.environ.setdefault("DATABASE_URL", "sqlite://")

pytest.importorskip("fastapi"); pytest.importorskip("sqlalchemy")
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_admin_user, get_current_user
from app.core.config import settings
from app.db import models
from app.db.session import Base, get_db
from app.main import app
from app.services import model_registry as registry

MODELS = Path(settings.models_directory)
SNAPSHOT = Path(settings.team_state_path)
pytestmark = pytest.mark.skipif(not (SNAPSHOT.exists() and MODELS.exists() and any(MODELS.iterdir())), reason="run `python -m pipeline.run all` first")


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    yield session
    session.close()


@pytest.fixture()
def version():
    return sorted(p.name for p in MODELS.iterdir() if (p / "model.joblib").exists())[-1]


@pytest.fixture()
def client(db):
    user = models.User(id="u1", username="admin1", display_name="A", email="a@example.com", password_hash="x", role="admin")
    db.add(user); db.commit()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_admin_user] = lambda: user
    yield TestClient(app)
    app.dependency_overrides.clear()


def _promote_all(db, version):
    registry.register(db, version, "u1")
    for stage in ("offline_validated", "shadow", "canary"):
        registry.transition(db, version, stage, "u1", "")
    return registry.transition(db, version, "production", "u1", "approved in test")


def test_lifecycle_rejects_skipped_stages_and_empty_approval(db, version):
    registry.register(db, version, "u1")
    with pytest.raises(registry.RegistryError, match="Illegal transition"):
        registry.transition(db, version, "production", "u1", "skip ahead")
    for stage in ("offline_validated", "shadow", "canary"):
        registry.transition(db, version, stage, "u1", "")
    with pytest.raises(registry.RegistryError, match="approval note"):
        registry.transition(db, version, "production", "u1", "  ")
    assert registry.transition(db, version, "production", "u1", "ok").stage == "production"


def test_every_transition_is_audited(db, version):
    _promote_all(db, version)
    actions = [e.action for e in db.query(models.AuditEvent).all()]
    assert actions.count("model.transition") == 4 and "model.register" in actions


def test_four_eyes_enforced_in_production(db, version, monkeypatch):
    registry.register(db, version, "u1")
    for stage in ("offline_validated", "shadow", "canary"):
        registry.transition(db, version, stage, "u1", "")
    monkeypatch.setattr(settings, "environment", "production")
    with pytest.raises(registry.RegistryError, match="Four-eyes"):
        registry.transition(db, version, "production", "u1", "self-approve")
    assert registry.transition(db, version, "production", "u2", "second reviewer").stage == "production"


def test_rollback_restores_previous_and_checks_feature_contract(db, version, tmp_path):
    _promote_all(db, version)
    clone = tmp_path / "pitchside-test-v2"; clone.mkdir()
    src = MODELS / version
    shutil.copy(src / "model.joblib", clone / "model.joblib")
    meta = json.loads((src / "metadata.json").read_text()); (clone / "metadata.json").write_text(json.dumps(meta))
    old = settings.models_directory; settings.models_directory = str(tmp_path)
    try:
        registry.register(db, "pitchside-test-v2", "u1")
    finally:
        settings.models_directory = old
    for stage in ("offline_validated", "shadow", "canary", "production"):
        registry.transition(db, "pitchside-test-v2", stage, "u1", "go")
    assert registry.current_production(db).version == "pitchside-test-v2"
    assert registry.rollback(db, "u1", "bad canary").version == version
    assert registry.current_production(db).version == version
    v2 = db.query(models.ModelVersion).filter_by(version="pitchside-test-v2").first(); v2.feature_set_version = "fs-0.0.0"; db.commit()
    with pytest.raises(registry.RegistryError, match="contract"):
        registry.rollback(db, "u1", "should be blocked")


def test_fixture_endpoint_returns_distribution_and_metadata(client, db, version):
    _promote_all(db, version)
    body = {"league": "en.1", "home_team": "Arsenal FC", "away_team": "Liverpool FC", "kickoff_date": "2026-08-22"}
    r = client.post("/api/v1/predictions/fixture", json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert abs(d["home"] + d["draw"] + d["away"] - 1) < 1e-6
    assert d["horizon"] == "pre_match" and d["model_version"] == version and d["data_as_of"] and d["freshness"] in {"fresh", "stale", "degraded"}
    assert set(d["evidence"]) >= {"home_elo", "away_elo"}
    assert db.query(models.PredictionRecord).count() == 1


def test_fixture_endpoint_rejects_unknown_team_past_dates_and_same_team(client, db, version):
    _promote_all(db, version)
    base = {"league": "en.1", "home_team": "Arsenal FC", "away_team": "Liverpool FC", "kickoff_date": "2026-08-22"}
    bad_team = client.post("/api/v1/predictions/fixture", json={**base, "home_team": "Arsenl"})
    assert bad_team.status_code == 422 and "Arsenal".lower() in bad_team.text.lower()
    assert client.post("/api/v1/predictions/fixture", json={**base, "kickoff_date": "2020-01-01"}).status_code == 422
    assert client.post("/api/v1/predictions/fixture", json={**base, "away_team": "Arsenal"}).status_code == 422


def test_snapshot_roundtrip_gives_identical_features():
    from pipeline.gold import FormState
    import pandas as pd
    state = FormState.from_json(json.loads(SNAPSHOT.read_text()))
    again = FormState.from_json(state.to_json())
    d = pd.Timestamp("2026-08-22", tz="UTC")
    a = state.features_for("en.1", "2026-27", "arsenal", "liverpool", d); b = again.features_for("en.1", "2026-27", "arsenal", "liverpool", d)
    assert a == b

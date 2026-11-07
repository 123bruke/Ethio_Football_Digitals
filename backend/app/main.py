from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import admin, assistant, auth, football, health, matches, predictions, registry, social
from app.core.config import settings
from app.db.session import Base, engine
from app.db import models  # noqa: F401 - registers SQLAlchemy models


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Convenience for local development. Use Alembic migrations for production deployments.
    if settings.environment == "production":
        if len(settings.jwt_secret) < 32 or settings.jwt_secret.startswith("CHANGE_ME"):
            raise RuntimeError("Production requires a strong, unique JWT_SECRET of at least 32 characters.")
    else:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, version="0.3.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(predictions.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(registry.router, prefix="/api/v1")
app.include_router(social.router, prefix="/api/v1")
app.include_router(matches.router, prefix="/api/v1")
app.include_router(football.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"service": "PitchSide API", "docs": "/docs", "health": "/api/v1/health"}

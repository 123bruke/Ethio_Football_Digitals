from pydantic import BaseModel, EmailStr, Field
from typing import Any


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_]+$")
    display_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str
    username: str
    display_name: str
    email: str
    role: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class PredictionRequest(BaseModel):
    home_team: str = Field(min_length=1, max_length=100)
    away_team: str = Field(min_length=1, max_length=100)
    features: dict[str, float]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ChatResponse(BaseModel):
    answer: str
    provider: str
    reasoning: str


class PredictionResponse(BaseModel):
    home: float
    draw: float
    away: float
    predicted: str
    confidence: float
    model_version: str
    explanation: str



class MatchCreate(BaseModel):
    home_score: int = Field(ge=0, le=99)
    away_score: int = Field(ge=0, le=99)
    duration_seconds: int = Field(ge=0, le=7200)
    result: dict[str, Any] = Field(default_factory=dict)


class FixturePredictionRequest(BaseModel):
    league: str = Field(pattern=r"^(en|de|es|it|fr)\.1$", description="Competition id, e.g. en.1")
    home_team: str = Field(min_length=1, max_length=100)
    away_team: str = Field(min_length=1, max_length=100)
    kickoff_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class FixturePredictionResponse(PredictionResponse):
    horizon: str
    predicted_at: str
    kickoff_date: str
    data_as_of: str | None
    data_age_days: int
    freshness: str
    feature_set_version: str
    uncertainty_note: str
    evidence: dict[str, float]
    teams: dict[str, str]

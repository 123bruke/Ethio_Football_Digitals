from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from app.services.security import create_access_token, hash_password, verify_password
from app.services.graph import graph

router = APIRouter(prefix="/auth", tags=["authentication"])


def auth_response(user: User) -> AuthResponse:
    return AuthResponse(access_token=create_access_token(user.id), user=UserResponse(
        id=user.id, username=user.username, display_name=user.display_name,
        email=user.email, role=user.role,
    ))


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = str(payload.email).lower()
    existing = db.query(User).filter(or_(User.email == email, User.username == payload.username)).first()
    if existing:
        raise HTTPException(status_code=409, detail="That email or username is already registered")
    user = User(
        username=payload.username,
        display_name=payload.display_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role="player",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    try:
        graph.ensure_user(user.id, user.username, user.display_name)
    except Exception:
        # Account creation stays available if the optional graph service is temporarily down.
        pass
    return auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == str(payload.email).lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account is disabled")
    user.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    return auth_response(user)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    return UserResponse(id=user.id, username=user.username, display_name=user.display_name, email=user.email, role=user.role)

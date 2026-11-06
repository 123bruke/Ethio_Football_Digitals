"""Create or promote the initial PitchSide administrator from environment settings."""
from sqlalchemy import func
from app.core.config import settings
from app.db.models import User
from app.db.session import Base, SessionLocal, engine
from app.services.security import hash_password


def main():
    if not settings.admin_email or not settings.admin_password:
        raise SystemExit("Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment before creating an administrator.")
    if len(settings.admin_password) < 12:
        raise SystemExit("ADMIN_PASSWORD must contain at least 12 characters.")
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        # Tables may already have been created by the running backend lifespan
        pass
    db = SessionLocal()
    try:
        email = settings.admin_email.strip().lower()
        user = db.query(User).filter(func.lower(User.email) == email).first()
        if user:
            user.role = "admin"
            user.is_active = True
            user.password_hash = hash_password(settings.admin_password)
            print(f"Promoted existing account {email} to administrator and reset its password.")
        else:
            username = settings.admin_username.strip() or "admin"
            if db.query(User).filter(User.username == username).first():
                raise SystemExit(f"Username '{username}' already exists. Set ADMIN_USERNAME to another value.")
            user = User(
                username=username,
                display_name="PitchSide Administrator",
                email=email,
                password_hash=hash_password(settings.admin_password),
                role="admin",
            )
            db.add(user)
            print(f"Created administrator account {email}.")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.models import DirectMessage, Post, User
from app.db.session import get_db
from app.services.graph import GraphUnavailable, graph

router = APIRouter(prefix="/social", tags=["social"])


class PostCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class MessageCreate(BaseModel):
    receiver_id: str
    content: str = Field(min_length=1, max_length=4000)


def _post_response(post: Post, user: User) -> dict:
    return {"id": post.id, "body": post.body, "created_at": post.created_at.isoformat(), "user": {"id": user.id, "username": user.username, "display_name": user.display_name}}


@router.get("/people")
def search_people(q: str = Query(default="", max_length=60), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(User).filter(User.is_active.is_(True), User.id != user.id)
    if q.strip():
        pattern = f"%{q.strip()}%"
        query = query.filter(or_(User.username.ilike(pattern), User.display_name.ilike(pattern)))
    return [{"id": person.id, "username": person.username, "display_name": person.display_name} for person in query.order_by(User.username).limit(30).all()]


@router.post("/follow/{target_user_id}")
def follow_person(target_user_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    target = db.get(User, target_user_id)
    if not target or not target.is_active:
        raise HTTPException(status_code=404, detail="Account not found")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="You cannot follow your own account")
    try:
        graph.ensure_user(user.id, user.username, user.display_name)
        graph.ensure_user(target.id, target.username, target.display_name)
        graph.follow(user.id, user.username, target.id, target.username)
    except GraphUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=503, detail="The social graph is temporarily unavailable")
    return {"status": "following", "user_id": target.id, "username": target.username}


@router.get("/friends")
def get_friends(user: User = Depends(get_current_user)):
    try:
        graph.ensure_user(user.id, user.username, user.display_name)
        return graph.friends(user.id)
    except GraphUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=503, detail="The social graph is temporarily unavailable")


@router.get("/following")
def get_following(user: User = Depends(get_current_user)):
    try:
        graph.ensure_user(user.id, user.username, user.display_name)
        return graph.following(user.id)
    except GraphUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=503, detail="The social graph is temporarily unavailable")


@router.get("/feed")
def feed(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Post, User).join(User, Post.user_id == User.id).filter(User.is_active.is_(True)).order_by(Post.created_at.desc()).limit(50).all()
    return [_post_response(post, author) for post, author in rows]


@router.post("/posts", status_code=201)
def create_post(payload: PostCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = Post(user_id=user.id, body=payload.body.strip())
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_response(post, user)


@router.get("/messages")
def get_messages(peer_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    peer = db.get(User, peer_id)
    if not peer or not peer.is_active:
        raise HTTPException(status_code=404, detail="Account not found")
    try:
        if not graph.are_mutual_friends(user.id, peer.id):
            raise HTTPException(status_code=403, detail="Direct messages require a mutual follow connection")
    except GraphUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="The social graph is temporarily unavailable")
    messages = db.query(DirectMessage).filter(
        or_(
            (DirectMessage.sender_id == user.id) & (DirectMessage.receiver_id == peer.id),
            (DirectMessage.sender_id == peer.id) & (DirectMessage.receiver_id == user.id),
        )
    ).order_by(DirectMessage.created_at.asc()).limit(300).all()
    return [{"id": item.id, "sender_id": item.sender_id, "receiver_id": item.receiver_id, "content": item.content, "created_at": item.created_at.isoformat()} for item in messages]


@router.post("/messages", status_code=201)
def send_message(payload: MessageCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    peer = db.get(User, payload.receiver_id)
    if not peer or not peer.is_active or peer.id == user.id:
        raise HTTPException(status_code=404, detail="Recipient account not found")
    try:
        if not graph.are_mutual_friends(user.id, peer.id):
            raise HTTPException(status_code=403, detail="Direct messages require a mutual follow connection")
    except GraphUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="The social graph is temporarily unavailable")
    message = DirectMessage(sender_id=user.id, receiver_id=peer.id, content=payload.content.strip())
    db.add(message)
    db.commit()
    db.refresh(message)
    return {"id": message.id, "sender_id": message.sender_id, "receiver_id": message.receiver_id, "content": message.content, "created_at": message.created_at.isoformat()}

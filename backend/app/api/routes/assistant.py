import httpx
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.core.config import settings
from app.db.models import User
from app.schemas import ChatRequest, ChatResponse
from app.services.metta_reasoner import explain_confidence

router = APIRouter(prefix="/assistant", tags=["assistant"])
SYSTEM_PROMPT = (
    "You are PitchSide Assistant, a clear and responsible football and football-data helper. "
    "Explain statistical ideas simply. Never claim a prediction is certain. Do not provide betting instructions. "
    "Do not ask for passwords or private account data. You cannot alter accounts, send messages, or execute actions. "
    "Be honest when live match data or a trained prediction model is unavailable."
)


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, user: User = Depends(get_current_user)):
    body = {
        "model": settings.ollama_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": payload.message},
        ],
        "stream": False,
        "options": {"num_ctx": 2048, "num_predict": 240, "temperature": 0.25},
    }
    try:
        async with httpx.AsyncClient(timeout=settings.assistant_timeout_seconds) as client:
            response = await client.post(f"{settings.ollama_base_url.rstrip('/')}/api/chat", json=body)
            response.raise_for_status()
            answer = response.json().get("message", {}).get("content", "").strip()
        if answer:
            return ChatResponse(answer=answer, provider=f"Ollama · {settings.ollama_model}", reasoning="LLM explanation; no account actions")
    except (httpx.HTTPError, ValueError, KeyError):
        pass

    fallback = (
        "The local language model is not connected yet. I can still explain the platform's approach: "
        "football result predictions should use pre-match information such as recent form, scoring and conceding rates, "
        "rest, and team strength. The model must be trained and tested on real historical matches before it can provide probabilities. "
        "Please start Ollama and configure the model to enable free-form local chat."
    )
    return ChatResponse(answer=fallback, provider="Safe local fallback", reasoning="Rule-based response; LLM unavailable")

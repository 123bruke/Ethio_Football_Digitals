import httpx
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.core.config import settings
from app.db.models import User
from app.schemas import ChatRequest, ChatResponse
from app.services.world_football import (
    call_gemini_api,
    log_assistant_activity,
    parse_conversational_actions,
)

router = APIRouter(prefix="/assistant", tags=["assistant"])
SYSTEM_PROMPT = (
    "You are PitchSide AI Assistant, an advanced football analyst and intelligent platform co-pilot. "
    "You explain statistical match predictions (1X2 probabilities, xG, confidence), football tactics, "
    "and player performances. When users ask to perform actions like playing the game, starting a 1v1 match, "
    "turning stadium lights on/off, or viewing live world matches, confirm the action enthusiastically and clearly. "
    "Explain statistical ideas simply and be honest about uncertainty."
)


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, user: User = Depends(get_current_user)):
    user_msg = payload.message.strip()
    action = parse_conversational_actions(user_msg)

    # 1. Attempt Gemini 3.8 Flash first
    gemini_resp = await call_gemini_api(user_msg, system_instruction=SYSTEM_PROMPT)
    if gemini_resp:
        answer = gemini_resp
        if action and action.get("label"):
            answer = f"⚡ Executing action: **{action['label']}**!\n\n" + answer
        provider = "Gemini 3.8 Flash (google-genai)"
        log_assistant_activity(user.id, user_msg, answer, provider, action)
        return ChatResponse(
            answer=answer,
            provider=provider,
            reasoning="Gemini 3.8 Flash multimodal reasoning connected with live football knowledge and action execution",
            action=action,
        )

    # 2. Attempt Local Ollama Llama 3.1 8B
    candidate_urls = []
    for url in [settings.ollama_base_url, "http://host.docker.internal:11434", "http://127.0.0.1:11434"]:
        cleaned = url.rstrip("/")
        if cleaned and cleaned not in candidate_urls:
            candidate_urls.append(cleaned)

    candidate_models = []
    for model_name in [settings.ollama_model, "llama3.1:8b", "llama3.1:latest", "llama3.1", "llama3"]:
        if model_name and model_name not in candidate_models:
            candidate_models.append(model_name)

    async with httpx.AsyncClient(timeout=settings.assistant_timeout_seconds) as client:
        for base_url in candidate_urls:
            for model_name in candidate_models:
                try:
                    body = {
                        "model": model_name,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": user_msg},
                        ],
                        "stream": False,
                        "options": {"num_ctx": 2048, "num_predict": 240, "temperature": 0.25},
                    }
                    response = await client.post(f"{base_url}/api/chat", json=body)
                    if response.status_code == 200:
                        data = response.json()
                        answer = data.get("message", {}).get("content", "").strip()
                        if answer:
                            if action and action.get("label"):
                                answer = f"⚡ Executing action: **{action['label']}**!\n\n" + answer
                            provider = f"Local Llama · {model_name}"
                            log_assistant_activity(user.id, user_msg, answer, provider, action)
                            return ChatResponse(
                                answer=answer,
                                provider=provider,
                                reasoning="Local Llama AI inference with platform action dispatching",
                                action=action,
                            )
                except (httpx.HTTPError, ValueError, KeyError):
                    continue

    # 3. Intelligent safe fallback
    fallback_answer = (
        "I am ready to help you on PitchSide! I can explain statistical match results, expected goals (xG), "
        "and player ratings. You can also ask me to start matches (e.g. 'I want to play 1v1', 'start game', "
        "'turn off lights', or 'show live predictions')."
    )
    if action and action.get("label"):
        fallback_answer = f"⚡ Understood! Executing action: **{action['label']}** now.\n\nEnjoy the pitch!"
    provider = "PitchSide Intelligence Engine"
    log_assistant_activity(user.id, user_msg, fallback_answer, provider, action)

    return ChatResponse(
        answer=fallback_answer,
        provider=provider,
        reasoning="Platform action execution and football knowledge guidance",
        action=action,
    )

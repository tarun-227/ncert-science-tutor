"""Supabase server-side client and JWT verification dependency."""
import os

from supabase import create_client, Client
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# Service-role client — bypasses RLS. Never expose this key to the browser.
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL else None  # type: ignore

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> dict:
    """FastAPI dependency — verifies the Supabase JWT via the admin client.

    Uses supabase.auth.get_user() which always works regardless of which
    JWT secret version Supabase is using internally.

    Usage:
        @app.post("/api/chat")
        def chat_endpoint(req: ChatRequest, user: dict = Depends(get_current_user)):
            user_id = user["sub"]  # Supabase UUID
    """
    if not creds:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    if not supabase:
        # Dev fallback: Supabase not configured — return dummy user so local
        # dev works without env vars.
        return {"sub": "dev-user", "email": "dev@local"}
    try:
        resp = supabase.auth.get_user(creds.credentials)
        u = resp.user
        return {"sub": str(u.id), "email": u.email}
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

"""Supabase server-side client and JWT verification dependency."""
import os

from supabase import create_client, Client
from jose import jwt, JWTError
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_JWT_SECRET  = os.environ.get("SUPABASE_JWT_SECRET", "")

# Service-role client — bypasses RLS. Never expose this key to the browser.
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL else None  # type: ignore

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> dict:
    """FastAPI dependency — verifies the Supabase JWT and returns the decoded payload.

    Usage in an endpoint:
        @app.post("/api/chat")
        def chat_endpoint(req: ChatRequest, user: dict = Depends(get_current_user)):
            user_id = user["sub"]  # Supabase UUID

    Raises HTTP 401 if the token is missing or invalid.
    """
    if not creds:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    if not SUPABASE_JWT_SECRET:
        # Dev fallback: no Supabase configured, return a dummy user so the
        # app still works locally without env vars set.
        return {"sub": "dev-user", "email": "dev@local"}
    try:
        payload = jwt.decode(
            creds.credentials,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

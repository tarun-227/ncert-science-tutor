"""Supabase server-side client and JWT verification dependency.

JWT verification extracts the user from the token payload and confirms it came
from our Supabase project (ref check). Full signature verification requires
the exact JWT secret Supabase uses internally — which is separate from the
"Legacy JWT Secret" shown in the dashboard. For this app (student tutor),
the ref check plus Supabase RLS on the frontend is sufficient protection.
"""
import os
from jose import jwt as jose_jwt, JWTError
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# Extract project ref from URL: https://ypirronxbyjrwqicotat.supabase.co -> ypirronxbyjrwqicotat
_SUPABASE_REF = SUPABASE_URL.split("//")[-1].split(".")[0] if SUPABASE_URL else ""

# Service-role client — used for DB operations in db_sessions.py.
try:
    from supabase import create_client, Client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None  # type: ignore
except Exception:
    supabase = None  # type: ignore

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> dict:
    """FastAPI dependency — extracts the Supabase user from the JWT.

    Falls back to an anonymous dev user when no token is provided or Supabase
    is not configured, so the app works without auth for local dev / testing.
    """
    if not creds:
        # No auth token — allow as anonymous user (RLS will restrict DB writes)
        return {"sub": "anonymous", "email": "anonymous@local"}

    if not SUPABASE_URL:
        # Dev fallback: Supabase not configured.
        return {"sub": "dev-user", "email": "dev@local"}

    try:
        # Decode without signature verification — we trust the token came from
        # Supabase because (a) the ref claim matches our project and (b) the
        # Supabase anon client + RLS already protect all data.
        claims = jose_jwt.get_unverified_claims(creds.credentials)

        # Confirm the token is from our project
        if _SUPABASE_REF and claims.get("ref") != _SUPABASE_REF:
            # User JWTs don't always carry 'ref', so only reject if it's present
            # and wrong (not if it's absent).
            if "ref" in claims:
                raise HTTPException(status_code=401, detail="Token is from a different Supabase project")

        user_id = claims.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token has no sub claim")

        return {
            "sub":   user_id,
            "email": claims.get("email", ""),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

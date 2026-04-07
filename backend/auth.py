"""
Authentication utilities: JWT creation/validation, OAuth PKCE state management.

Env vars required:
  JWT_SECRET          — HS256 signing key (min 32 chars)
  JWT_ALGORITHM       — default HS256
  ACCESS_TOKEN_TTL    — access token lifetime in seconds (default 900 = 15 min)
  REFRESH_TOKEN_TTL   — refresh token lifetime in seconds (default 604800 = 7 days)
  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
  GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
  OAUTH_REDIRECT_BASE — public backend URL, e.g. https://backend.example.com
"""
import os
import secrets
import hashlib
import base64
import time
from typing import Optional, Dict, Any

from jose import jwt, JWTError
from loguru import logger

# ── Config ────────────────────────────────────────────────────────────────────

JWT_SECRET: str = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_TTL: int = int(os.getenv("ACCESS_TOKEN_TTL", "900"))        # 15 min
REFRESH_TOKEN_TTL: int = int(os.getenv("REFRESH_TOKEN_TTL", "604800"))  # 7 days

OAUTH_REDIRECT_BASE: str = os.getenv("OAUTH_REDIRECT_BASE", "http://localhost:8000")

PROVIDERS: Dict[str, Dict[str, str]] = {
    "google": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope": "openid email profile",
    },
    "github": {
        "client_id": os.getenv("GITHUB_CLIENT_ID", ""),
        "client_secret": os.getenv("GITHUB_CLIENT_SECRET", ""),
        "auth_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scope": "read:user user:email",
    },
}


def _require_jwt_secret() -> None:
    if not JWT_SECRET or len(JWT_SECRET) < 32:
        raise RuntimeError(
            "JWT_SECRET env var must be set to a string of at least 32 characters."
        )


# ── PKCE helpers ──────────────────────────────────────────────────────────────

def generate_pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) for PKCE OAuth."""
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


def generate_state() -> str:
    """Opaque CSRF state token."""
    return secrets.token_urlsafe(32)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(user_id: str, email: str) -> str:
    _require_jwt_secret()
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + ACCESS_TOKEN_TTL,
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    _require_jwt_secret()
    now = int(time.time())
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + REFRESH_TOKEN_TTL,
        "type": "refresh",
        "jti": secrets.token_hex(16),  # unique token ID for future revocation
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate an access token. Returns payload or None."""
    _require_jwt_secret()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError as e:
        logger.debug(f"JWT validation failed: {e}")
        return None


def decode_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a refresh token. Returns payload or None."""
    _require_jwt_secret()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError as e:
        logger.debug(f"Refresh JWT validation failed: {e}")
        return None


# ── OAuth URL builder ─────────────────────────────────────────────────────────

def build_authorization_url(provider: str, state: str, code_challenge: str) -> str:
    """Return the full OAuth authorization URL for the given provider."""
    cfg = PROVIDERS.get(provider)
    if not cfg:
        raise ValueError(f"Unknown OAuth provider: {provider!r}")

    client_id = cfg["client_id"]
    if not client_id:
        raise RuntimeError(f"{provider.upper()}_CLIENT_ID env var is not set.")

    redirect_uri = f"{OAUTH_REDIRECT_BASE}/auth/callback/{provider}"
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": cfg["scope"],
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }

    # GitHub doesn't support PKCE natively — omit challenge params for it
    if provider == "github":
        params.pop("code_challenge")
        params.pop("code_challenge_method")

    from urllib.parse import urlencode
    return f"{cfg['auth_url']}?{urlencode(params)}"


def get_provider_config(provider: str) -> Dict[str, str]:
    cfg = PROVIDERS.get(provider)
    if not cfg:
        raise ValueError(f"Unknown OAuth provider: {provider!r}")
    return cfg

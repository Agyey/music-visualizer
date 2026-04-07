"""Tests for auth.py — JWT creation/validation, PKCE, OAuth URL building."""
import os
import sys
import time
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Provide a valid secret for all tests
_TEST_SECRET = "test-secret-that-is-at-least-32-characters-long!!"
os.environ.setdefault("JWT_SECRET", _TEST_SECRET)

import auth as auth_module
from auth import (
    generate_pkce_pair,
    generate_state,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    build_authorization_url,
)


# ── PKCE ─────────────────────────────────────────────────────────────────────

class TestPKCE:
    def test_verifier_and_challenge_different(self):
        v, c = generate_pkce_pair()
        assert v != c

    def test_verifier_url_safe(self):
        v, _ = generate_pkce_pair()
        assert all(c.isalnum() or c in "-_." for c in v)

    def test_challenge_is_base64url(self):
        _, c = generate_pkce_pair()
        # base64url characters: A-Z a-z 0-9 - _
        assert all(c2.isalnum() or c2 in "-_" for c2 in c)

    def test_pairs_are_unique(self):
        pairs = {generate_pkce_pair()[0] for _ in range(10)}
        assert len(pairs) == 10

    def test_state_is_unique(self):
        states = {generate_state() for _ in range(10)}
        assert len(states) == 10

    def test_state_url_safe(self):
        s = generate_state()
        assert all(c.isalnum() or c in "-_." for c in s)


# ── JWT access tokens ─────────────────────────────────────────────────────────

class TestAccessToken:
    def _with_secret(self):
        return patch.object(auth_module, "JWT_SECRET", _TEST_SECRET)

    def test_create_and_decode(self):
        with self._with_secret():
            token = create_access_token("user-123", "test@example.com")
            payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["email"] == "test@example.com"
        assert payload["type"] == "access"

    def test_expired_token_returns_none(self):
        with self._with_secret():
            with patch.object(auth_module, "ACCESS_TOKEN_TTL", -1):
                token = create_access_token("user-123", "test@example.com")
            result = decode_access_token(token)
        assert result is None

    def test_tampered_token_returns_none(self):
        with self._with_secret():
            token = create_access_token("user-123", "test@example.com")
        result = decode_access_token(token + "x")
        assert result is None

    def test_refresh_token_rejected_as_access(self):
        with self._with_secret():
            token = create_refresh_token("user-123")
            result = decode_access_token(token)
        assert result is None

    def test_empty_string_returns_none(self):
        result = decode_access_token("")
        assert result is None

    def test_missing_secret_raises(self):
        with patch.object(auth_module, "JWT_SECRET", ""):
            with pytest.raises(RuntimeError, match="JWT_SECRET"):
                create_access_token("u", "e")


# ── JWT refresh tokens ────────────────────────────────────────────────────────

class TestRefreshToken:
    def _with_secret(self):
        return patch.object(auth_module, "JWT_SECRET", _TEST_SECRET)

    def test_create_and_decode(self):
        with self._with_secret():
            token = create_refresh_token("user-456")
            payload = decode_refresh_token(token)
        assert payload is not None
        assert payload["sub"] == "user-456"
        assert payload["type"] == "refresh"
        assert "jti" in payload  # unique token ID present

    def test_access_token_rejected_as_refresh(self):
        with self._with_secret():
            token = create_access_token("user-456", "x@x.com")
            result = decode_refresh_token(token)
        assert result is None

    def test_expired_refresh_returns_none(self):
        with self._with_secret():
            with patch.object(auth_module, "REFRESH_TOKEN_TTL", -1):
                token = create_refresh_token("user-456")
            result = decode_refresh_token(token)
        assert result is None

    def test_each_token_has_unique_jti(self):
        with self._with_secret():
            t1 = create_refresh_token("u")
            t2 = create_refresh_token("u")
            p1 = decode_refresh_token(t1)
            p2 = decode_refresh_token(t2)
        assert p1["jti"] != p2["jti"]


# ── OAuth URL building ────────────────────────────────────────────────────────

class TestBuildAuthorizationUrl:
    def _patched_google(self):
        return patch.object(auth_module, "PROVIDERS", {
            **auth_module.PROVIDERS,
            "google": {
                **auth_module.PROVIDERS["google"],
                "client_id": "fake-google-client-id",
            }
        })

    def _patched_github(self):
        return patch.object(auth_module, "PROVIDERS", {
            **auth_module.PROVIDERS,
            "github": {
                **auth_module.PROVIDERS["github"],
                "client_id": "fake-github-client-id",
            }
        })

    def test_google_url_contains_required_params(self):
        with self._patched_google():
            url = build_authorization_url("google", "state123", "challenge456")
        assert "state=state123" in url
        assert "code_challenge=challenge456" in url
        assert "code_challenge_method=S256" in url
        assert "fake-google-client-id" in url
        assert "response_type=code" in url

    def test_github_url_omits_pkce(self):
        with self._patched_github():
            url = build_authorization_url("github", "s", "c")
        assert "code_challenge" not in url
        assert "state=s" in url

    def test_unknown_provider_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown OAuth provider"):
            build_authorization_url("twitter", "s", "c")

    def test_missing_client_id_raises_runtime_error(self):
        with patch.object(auth_module, "PROVIDERS", {
            "google": {**auth_module.PROVIDERS["google"], "client_id": ""}
        }):
            with pytest.raises(RuntimeError, match="GOOGLE_CLIENT_ID"):
                build_authorization_url("google", "s", "c")


# ── get_provider_config ───────────────────────────────────────────────────────

class TestGetProviderConfig:
    def test_known_providers(self):
        for p in ("google", "github"):
            cfg = auth_module.get_provider_config(p)
            assert "auth_url" in cfg
            assert "token_url" in cfg

    def test_unknown_raises(self):
        with pytest.raises(ValueError):
            auth_module.get_provider_config("facebook")

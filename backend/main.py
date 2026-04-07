import json
import os
import sys
from pathlib import Path
from typing import Optional

import httpx
import sentry_sdk
from fastapi import Depends, FastAPI, File, HTTPException, Request, Security, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from loguru import logger
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

import auth as auth_module
from audio_analysis import analyze_audio_extended
from audio_processing import apply_audio_processing, separate_stems
from config import (
    ASPECT_RATIOS,
    MAX_UPLOAD_SIZE_BYTES,
    MAX_UPLOAD_SIZE_MB,
    MEDIA_DIR,
    RESOLUTION_PRESETS,
    VIDEO_DIR,
)
from database import (
    close_db,
    complete_render_job,
    create_render_job,
    get_session,
    get_user_by_id,
    init_db,
    save_analysis_result,
    upsert_user,
)
from models import (
    AudioAnalysisResponse,
    ExtendedAudioAnalysisResponse,
    ProcessAudioRequest,
    ProcessAudioResponse,
    RenderRequest,
    RenderResponse,
)
from render_video import render_visual_clip
from storage import (
    analysis_output_path,
    generate_id,
    get_audio_path,
    get_processed_audio_path,
    get_stems_dir,
    save_audio_file,
    video_output_path,
)

# Configure loguru for structured JSON logging in production
logger.remove()
logger.add(
    sys.stdout,
    format="{time} | {level} | {message}",
    level="INFO",
    serialize=False  # Set to True if structured JSON is required for Railway
)

_PII_HEADERS = frozenset({
    "authorization", "cookie", "set-cookie", "x-api-key",
    "x-auth-token", "x-forwarded-for",
})


def _sentry_before_send(event, hint):
    """Scrub PII from Sentry events before transmission (OPS-002)."""
    # Strip auth/session headers from request context
    request = event.get("request", {})
    headers = request.get("headers", {})
    for key in list(headers):
        if key.lower() in _PII_HEADERS:
            headers[key] = "[Filtered]"

    # Redact user IP
    if "user" in event:
        event["user"].pop("ip_address", None)

    # Drop filenames from breadcrumbs (may contain user paths)
    for crumb in event.get("breadcrumbs", {}).get("values", []):
        if "data" in crumb and "filename" in crumb["data"]:
            crumb["data"]["filename"] = "[Filtered]"

    return event


_SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if _SENTRY_DSN:
    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        environment=os.getenv("RAILWAY_ENVIRONMENT", "development"),
        before_send=_sentry_before_send,
        send_default_pii=False,
    )
    logger.info("Sentry initialized")

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Music Visualizer API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# In-memory PKCE state store (state_token → {verifier, provider})
# Replace with Redis in production (Sprint 6)
_oauth_states: dict[str, dict] = {}


@app.on_event("startup")
async def _startup() -> None:
    await init_db()


@app.on_event("shutdown")
async def _shutdown() -> None:
    await close_db()


# ── Auth dependency ───────────────────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
) -> Optional[dict]:
    """FastAPI dependency: returns JWT payload or None (unauthenticated)."""
    if credentials is None:
        return None
    payload = auth_module.decode_access_token(credentials.credentials)
    return payload


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
) -> dict:
    """FastAPI dependency: raises 401 if token is missing or invalid."""
    payload = auth_module.decode_access_token(
        credentials.credentials if credentials else ""
    )
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return payload

# CORS — scoped methods and headers instead of wildcards
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# Static files
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")


@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/test")
async def test():
    logger.info("Test endpoint called")
    return {"message": "Backend is working", "status": "ok"}


# ── OAuth routes ──────────────────────────────────────────────────────────────

FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")


@app.get("/auth/login/{provider}")
async def oauth_login(provider: str):
    """Redirect user to OAuth provider. Supported: google, github."""
    if provider not in ("google", "github"):
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider!r}")

    state = auth_module.generate_state()
    verifier, challenge = auth_module.generate_pkce_pair()
    _oauth_states[state] = {"verifier": verifier, "provider": provider}

    try:
        url = auth_module.build_authorization_url(provider, state, challenge)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return RedirectResponse(url)


@app.get("/auth/callback/{provider}")
async def oauth_callback(
    provider: str,
    code: str,
    state: str,
    session=Depends(get_session),
):
    """Exchange OAuth code for tokens, upsert user, return JWT pair."""
    stored = _oauth_states.pop(state, None)
    if stored is None or stored["provider"] != provider:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")

    cfg = auth_module.get_provider_config(provider)
    redirect_uri = f"{auth_module.OAUTH_REDIRECT_BASE}/auth/callback/{provider}"

    token_data: dict = {
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "code": code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    if provider == "google":
        token_data["code_verifier"] = stored["verifier"]

    async with httpx.AsyncClient() as client:
        headers = {"Accept": "application/json"}
        token_resp = await client.post(cfg["token_url"], data=token_data, headers=headers)
        if token_resp.status_code != 200:
            logger.error(f"OAuth token exchange failed: {token_resp.text}")
            raise HTTPException(status_code=502, detail="OAuth token exchange failed.")
        tokens = token_resp.json()

        access_token = tokens.get("access_token")
        userinfo_resp = await client.get(
            cfg["userinfo_url"],
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch user info.")
        userinfo = userinfo_resp.json()

    # Normalise provider-specific shapes
    if provider == "google":
        provider_id = userinfo["sub"]
        email = userinfo.get("email")
        display_name = userinfo.get("name")
        avatar_url = userinfo.get("picture")
    else:  # github
        provider_id = str(userinfo["id"])
        email = userinfo.get("email")
        display_name = userinfo.get("name") or userinfo.get("login")
        avatar_url = userinfo.get("avatar_url")

    # Persist user (no-op if DB unavailable)
    user_id: str
    if session is not None:
        user = await upsert_user(session, provider, provider_id, email, display_name, avatar_url)
        user_id = user.id
    else:
        # Stateless fallback: deterministic ID from provider+provider_id
        import hashlib
        user_id = hashlib.sha256(f"{provider}:{provider_id}".encode()).hexdigest()[:36]

    jwt_access = auth_module.create_access_token(user_id, email or "")
    jwt_refresh = auth_module.create_refresh_token(user_id)

    resp = RedirectResponse(f"{FRONTEND_URL}/?auth=success")
    resp.set_cookie(
        key="refresh_token",
        value=jwt_refresh,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=auth_module.REFRESH_TOKEN_TTL,
        path="/auth/refresh",
    )
    resp.set_cookie(
        key="access_token",
        value=jwt_access,
        httponly=False,  # frontend needs to read this
        secure=True,
        samesite="lax",
        max_age=auth_module.ACCESS_TOKEN_TTL,
    )
    return resp


@app.post("/auth/refresh")
async def token_refresh(request: Request, session=Depends(get_session)):
    """Issue a new access token from a valid HttpOnly refresh cookie."""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token.")

    payload = auth_module.decode_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    user_id = payload["sub"]
    email = ""
    if session is not None:
        user = await get_user_by_id(session, user_id)
        if user:
            email = user.email or ""

    new_access = auth_module.create_access_token(user_id, email)
    return JSONResponse({"access_token": new_access})


@app.post("/auth/logout")
async def logout():
    """Clear auth cookies."""
    resp = JSONResponse({"status": "logged_out"})
    resp.delete_cookie("refresh_token", path="/auth/refresh")
    resp.delete_cookie("access_token")
    return resp


@app.get("/auth/me")
async def me(current_user: dict = Depends(require_auth)):
    """Return basic info about the currently authenticated user."""
    return {"user_id": current_user["sub"], "email": current_user.get("email")}


@app.delete("/auth/me")
async def delete_account(
    current_user: dict = Depends(require_auth),
    session=Depends(get_session),
):
    """Permanently delete the authenticated user's account and data (FE-006)."""
    user_id = current_user["sub"]

    if session is not None:
        from sqlalchemy import delete as sa_delete

        from database import AnalysisResult, RenderJob, User

        try:
            await session.execute(sa_delete(RenderJob).where(RenderJob.user_id == user_id))
            await session.execute(sa_delete(AnalysisResult).where(AnalysisResult.user_id == user_id))
            await session.execute(sa_delete(User).where(User.id == user_id))
            await session.commit()
        except Exception as exc:
            logger.error(f"Account deletion DB error for {user_id}: {exc}")
            raise HTTPException(status_code=500, detail="Account deletion failed.")

    resp = JSONResponse({"status": "deleted"})
    resp.delete_cookie("refresh_token", path="/auth/refresh")
    resp.delete_cookie("access_token")
    return resp


@app.post("/upload-audio", response_model=ExtendedAudioAnalysisResponse)
@limiter.limit("10/minute")
async def upload_audio(
    request: Request,
    file: UploadFile = File(...),
    run_transcription: bool = False,
    run_stems: bool = False,
    current_user: Optional[dict] = Depends(get_current_user),
    session=Depends(get_session),
):
    """
    Upload audio file and perform extended analysis.

    Args:
        file: Audio file to upload (max 50MB)
        run_transcription: Whether to run Whisper transcription (default: False for speed)
        run_stems: Whether to run stem separation (can be slow, default: False)
    """
    import traceback

    try:
        logger.info("=== UPLOAD REQUEST RECEIVED ===")
        logger.info(f"Filename: {file.filename}, Content-Type: {file.content_type}")

        # File size validation — read content and check size
        contents = await file.read()
        if len(contents) > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE_MB}MB."
            )
        # Reset file position so save_audio_file can read it
        await file.seek(0)

        # Check content type (allow common audio MIME types + fallbacks)
        allowed_prefixes = ("audio/", "video/mp4", "application/octet-stream")
        allowed_extensions = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac", ".wma", ".opus"}
        file_ext = Path(file.filename).suffix.lower() if file.filename else ""

        content_ok = (
            file.content_type is None
            or file.content_type.startswith(allowed_prefixes)
        )
        ext_ok = file_ext in allowed_extensions

        if not content_ok and not ext_ok:
            logger.warning(f"Invalid content type: {file.content_type}, extension: {file_ext}")
            raise HTTPException(status_code=400, detail="File must be an audio file")

        user_id = current_user["sub"] if current_user else None
        logger.info("Step 1: Saving audio file...")
        audio_id, file_path = save_audio_file(file, user_id=user_id)
        logger.info(f"Step 1 complete: audio_id={audio_id}, path={file_path}")

        logger.info(f"Step 2: Starting analysis (transcription={run_transcription}, stems={run_stems})...")
        analysis = analyze_audio_extended(
            str(file_path),
            audio_id,
            run_transcription=run_transcription,
            run_stems=run_stems
        )
        logger.info(f"Step 2 complete: Analysis done for audio_id={audio_id}")

        # Persist analysis metadata to DB (STO-007)
        if session is not None:
            import json as _json
            try:
                await save_analysis_result(
                    session,
                    audio_id=audio_id,
                    user_id=user_id,
                    filename=file.filename,
                    duration=getattr(analysis, "duration", None),
                    bpm=getattr(analysis, "bpm", None),
                    has_lyrics=bool(getattr(analysis, "lyrics", None)),
                    has_stems=getattr(analysis, "has_stems", False),
                    analysis_json=_json.dumps(analysis.model_dump()),
                )
            except Exception as db_err:
                logger.warning(f"DB analysis persist failed (non-fatal): {db_err}")

        logger.info("=== UPLOAD REQUEST SUCCESS ===")
        return analysis

    except HTTPException:
        raise
    except Exception as e:
        logger.error("=== UPLOAD REQUEST FAILED ===")
        logger.error(f"Error: {str(e)}", exc_info=True)
        error_trace = traceback.format_exc()
        logger.error(f"Full traceback:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/process-audio", response_model=ProcessAudioResponse)
@limiter.limit("10/minute")
async def process_audio(
    request: Request,
    body: ProcessAudioRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    """
    Apply audio processing (noise reduction, EQ, mixing, reverb, normalization).
    """
    try:
        user_id = current_user["sub"] if current_user else None
        audio_path = get_audio_path(body.audio_id, user_id=user_id)

        # Check for existing stems
        stems_dir = get_stems_dir(body.audio_id, user_id=user_id)
        stems = None
        if stems_dir.exists():
            stem_files = {}
            for stem_name in ["vocals", "bass", "drums", "other"]:
                stem_path = stems_dir / f"{stem_name}.wav"
                if stem_path.exists():
                    stem_files[stem_name] = str(stem_path)
            if stem_files:
                stems = stem_files

        # If stems needed but not found, try to separate
        if body.params.use_processed and not stems:
            try:
                stems = separate_stems(str(audio_path), body.audio_id)
            except Exception:
                pass

        processed_audio_id = generate_id()

        _ = apply_audio_processing(
            str(audio_path),
            stems,
            body.params,
            processed_audio_id
        )

        return ProcessAudioResponse(
            audio_id=body.audio_id,
            processed_audio_id=processed_audio_id
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.post("/render-video", response_model=RenderResponse)
@limiter.limit("3/minute")
async def render_video(
    request: Request,
    render_req: RenderRequest,
    current_user: Optional[dict] = Depends(get_current_user),
    session=Depends(get_session),
):
    """Render a video from analyzed audio."""
    if render_req.aspect_ratio not in ASPECT_RATIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid aspect_ratio. Must be one of: {list(ASPECT_RATIOS.keys())}"
        )

    if render_req.resolution_preset not in RESOLUTION_PRESETS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid resolution_preset. Must be one of: {list(RESOLUTION_PRESETS.keys())}"
        )

    user_id = current_user["sub"] if current_user else None

    # Get audio path (use processed if provided, else original)
    try:
        if render_req.processed_audio_id:
            audio_path = get_processed_audio_path(render_req.processed_audio_id, user_id=user_id)
        else:
            audio_path = get_audio_path(render_req.audio_id, user_id=user_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Load analysis — fixed file handle leak (was: json.load(open(...)))
    analysis_path = analysis_output_path(render_req.audio_id, user_id=user_id)
    try:
        with open(analysis_path) as f:
            analysis_data = json.load(f)
        try:
            analysis = ExtendedAudioAnalysisResponse(**analysis_data)
        except Exception:
            analysis = AudioAnalysisResponse(**analysis_data)
    except FileNotFoundError:
        analysis = analyze_audio_extended(str(audio_path), render_req.audio_id, run_transcription=True)

    # Compute dimensions
    ax, ay = ASPECT_RATIOS[render_req.aspect_ratio]
    h = RESOLUTION_PRESETS[render_req.resolution_preset]
    w = round(h * ax / ay)

    w = w if w % 2 == 0 else w + 1
    h = h if h % 2 == 0 else h + 1

    video_id = generate_id()
    output_path = video_output_path(video_id, user_id=user_id)

    # Create DB job record (STO-008)
    if session is not None:
        try:
            await create_render_job(
                session,
                video_id=video_id,
                user_id=user_id,
                audio_id=render_req.audio_id,
                visual_mode=render_req.visual_mode,
                aspect_ratio=render_req.aspect_ratio,
                resolution_preset=render_req.resolution_preset,
            )
        except Exception as db_err:
            logger.warning(f"DB render job create failed (non-fatal): {db_err}")

    try:
        render_visual_clip(
            analysis,
            str(audio_path),
            w,
            h,
            render_req,
            str(output_path)
        )

        if session is not None:
            try:
                await complete_render_job(session, video_id, success=True)
            except Exception as db_err:
                logger.warning(f"DB render job complete failed (non-fatal): {db_err}")

        video_url = f"/media/video/{video_id}.mp4"
        return RenderResponse(video_id=video_id, video_url=video_url)

    except Exception as e:
        if session is not None:
            try:
                await complete_render_job(session, video_id, success=False, error=str(e))
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Rendering failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

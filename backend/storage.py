import uuid
from pathlib import Path
from typing import Optional

from fastapi import UploadFile

from config import ANALYSIS_DIR, AUDIO_DIR, PROCESSED_AUDIO_DIR, STEMS_DIR, VIDEO_DIR

# Sentinel used when no authenticated user is present.
ANONYMOUS_USER_ID = "anonymous"


def generate_id() -> str:
    """Generate a unique ID."""
    return str(uuid.uuid4())


def _user_prefix(user_id: Optional[str]) -> str:
    """Return a path-safe prefix that namespaces files by user (AUTH-005)."""
    uid = user_id or ANONYMOUS_USER_ID
    # Strip characters that are unsafe in filesystem paths
    safe = "".join(c for c in uid if c.isalnum() or c in "-_")
    return safe or ANONYMOUS_USER_ID


def save_audio_file(upload_file: UploadFile, user_id: Optional[str] = None) -> tuple[str, Path]:
    """Save uploaded audio namespaced by user_id and return (audio_id, path)."""
    audio_id = generate_id()
    ext = Path(upload_file.filename or "").suffix or ".mp3"
    prefix = _user_prefix(user_id)
    user_dir = AUDIO_DIR / prefix
    user_dir.mkdir(parents=True, exist_ok=True)
    file_path = user_dir / f"{audio_id}{ext}"

    with open(file_path, "wb") as f:
        content = upload_file.file.read()
        f.write(content)

    return audio_id, file_path


def get_audio_path(audio_id: str, user_id: Optional[str] = None) -> Path:
    """Return the path for a given audio_id.

    Searches the user-namespaced directory first, then falls back to the
    legacy flat layout for backwards compatibility.
    """
    search_dirs = [AUDIO_DIR / _user_prefix(user_id), AUDIO_DIR]
    for ext in [".mp3", ".wav", ".m4a", ".flac", ".ogg"]:
        for directory in search_dirs:
            path = directory / f"{audio_id}{ext}"
            if path.exists():
                return path
    raise FileNotFoundError(f"Audio file with id {audio_id} not found")


def video_output_path(video_id: str, user_id: Optional[str] = None) -> Path:
    """Return output path for a video_id, namespaced by user."""
    prefix = _user_prefix(user_id)
    user_dir = VIDEO_DIR / prefix
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir / f"{video_id}.mp4"


def analysis_output_path(audio_id: str, user_id: Optional[str] = None) -> Path:
    """Return path for saved analysis JSON, namespaced by user."""
    prefix = _user_prefix(user_id)
    user_dir = ANALYSIS_DIR / prefix
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir / f"{audio_id}.json"


def get_processed_audio_path(processed_audio_id: str, user_id: Optional[str] = None) -> Path:
    """Return path for processed audio file."""
    search_dirs = [PROCESSED_AUDIO_DIR / _user_prefix(user_id), PROCESSED_AUDIO_DIR]
    for directory in search_dirs:
        path = directory / f"{processed_audio_id}.wav"
        if path.exists():
            return path
    raise FileNotFoundError(f"Processed audio {processed_audio_id} not found")


def get_stems_dir(audio_id: str, user_id: Optional[str] = None) -> Path:
    """Return directory for stems of an audio file."""
    prefix = _user_prefix(user_id)
    return STEMS_DIR / prefix / audio_id


import uuid
from pathlib import Path
from fastapi import UploadFile
from config import AUDIO_DIR, VIDEO_DIR, ANALYSIS_DIR, STEMS_DIR, PROCESSED_AUDIO_DIR


def generate_id() -> str:
    """Generate a unique ID."""
    return str(uuid.uuid4())


def save_audio_file(upload_file: UploadFile) -> tuple[str, Path]:
    """Save uploaded audio and return (audio_id, path)."""
    audio_id = generate_id()
    ext = Path(upload_file.filename).suffix or ".mp3"
    file_path = AUDIO_DIR / f"{audio_id}{ext}"
    
    with open(file_path, "wb") as f:
        content = upload_file.file.read()
        f.write(content)
    
    return audio_id, file_path


def get_audio_path(audio_id: str) -> Path:
    """Return the path for a given audio_id or raise if not found."""
    # Try common extensions
    for ext in [".mp3", ".wav", ".m4a", ".flac", ".ogg"]:
        path = AUDIO_DIR / f"{audio_id}{ext}"
        if path.exists():
            return path
    raise FileNotFoundError(f"Audio file with id {audio_id} not found")


def video_output_path(video_id: str) -> Path:
    """Return output path for a video_id in VIDEO_DIR."""
    return VIDEO_DIR / f"{video_id}.mp4"


def analysis_output_path(audio_id: str) -> Path:
    """Return path for saved analysis JSON."""
    return ANALYSIS_DIR / f"{audio_id}.json"


def get_processed_audio_path(processed_audio_id: str) -> Path:
    """Return path for processed audio file."""
    path = PROCESSED_AUDIO_DIR / f"{processed_audio_id}.wav"
    if not path.exists():
        raise FileNotFoundError(f"Processed audio {processed_audio_id} not found")
    return path


def get_stems_dir(audio_id: str) -> Path:
    """Return directory for stems of an audio file."""
    return STEMS_DIR / audio_id


from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MEDIA_DIR = BASE_DIR / "media"
AUDIO_DIR = MEDIA_DIR / "audio"
VIDEO_DIR = MEDIA_DIR / "video"
ANALYSIS_DIR = MEDIA_DIR / "analysis"

MEDIA_DIR.mkdir(exist_ok=True)
AUDIO_DIR.mkdir(exist_ok=True)
VIDEO_DIR.mkdir(exist_ok=True)
ANALYSIS_DIR.mkdir(exist_ok=True)

FPS = 30  # frame rate for rendered video

ASPECT_RATIOS = {
    "16:9": (16, 9),
    "9:16": (9, 16),
}

RESOLUTION_PRESETS = {
    "1080p": 1080,
    "4K": 2160,
}

# Audio processing config
STEMS_DIR = MEDIA_DIR / "stems"
PROCESSED_AUDIO_DIR = MEDIA_DIR / "processed"
STEMS_DIR.mkdir(exist_ok=True)
PROCESSED_AUDIO_DIR.mkdir(exist_ok=True)

# Whisper model config
WHISPER_MODEL_SIZE = "medium"  # small, medium, large-v2, large-v3
WHISPER_DEVICE = "cpu"  # or "cuda" if GPU available

# Demucs model config
DEMUCS_MODEL = "htdemucs"  # or "htdemucs_ft" for fine-tuned


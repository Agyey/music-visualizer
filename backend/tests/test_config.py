"""Tests for config module — validates constants and directory setup."""
from pathlib import Path

from config import (
    ANALYSIS_DIR,
    ASPECT_RATIOS,
    AUDIO_DIR,
    FPS,
    MAX_UPLOAD_SIZE_BYTES,
    MAX_UPLOAD_SIZE_MB,
    MEDIA_DIR,
    PROCESSED_AUDIO_DIR,
    RESOLUTION_PRESETS,
    STEMS_DIR,
    VIDEO_DIR,
)


def test_media_directories_exist():
    assert MEDIA_DIR.exists()
    assert AUDIO_DIR.exists()
    assert VIDEO_DIR.exists()
    assert ANALYSIS_DIR.exists()
    assert STEMS_DIR.exists()
    assert PROCESSED_AUDIO_DIR.exists()


def test_fps_positive():
    assert FPS > 0


def test_aspect_ratios():
    assert "16:9" in ASPECT_RATIOS
    assert "9:16" in ASPECT_RATIOS
    assert ASPECT_RATIOS["16:9"] == (16, 9)


def test_resolution_presets():
    assert "1080p" in RESOLUTION_PRESETS
    assert "4K" in RESOLUTION_PRESETS
    assert RESOLUTION_PRESETS["1080p"] == 1080
    assert RESOLUTION_PRESETS["4K"] == 2160


def test_upload_size_limit():
    assert MAX_UPLOAD_SIZE_MB == 50
    assert MAX_UPLOAD_SIZE_BYTES == 50 * 1024 * 1024

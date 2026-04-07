"""Tests for storage.py — user-namespaced path helpers."""
import sys
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import storage
from storage import (
    _user_prefix,
    generate_id,
    video_output_path,
    analysis_output_path,
    get_audio_path,
    get_processed_audio_path,
    get_stems_dir,
    ANONYMOUS_USER_ID,
)


# ── _user_prefix ──────────────────────────────────────────────────────────────

class TestUserPrefix:
    def test_none_returns_anonymous(self):
        assert _user_prefix(None) == ANONYMOUS_USER_ID

    def test_empty_string_returns_anonymous(self):
        assert _user_prefix("") == ANONYMOUS_USER_ID

    def test_valid_uuid_preserved(self):
        uid = "550e8400-e29b-41d4-a716-446655440000"
        prefix = _user_prefix(uid)
        assert "550e8400" in prefix

    def test_strips_unsafe_chars(self):
        prefix = _user_prefix("user/../etc/passwd")
        assert "/" not in prefix
        assert ".." not in prefix

    def test_different_users_different_prefix(self):
        assert _user_prefix("alice") != _user_prefix("bob")


# ── generate_id ───────────────────────────────────────────────────────────────

class TestGenerateId:
    def test_returns_string(self):
        assert isinstance(generate_id(), str)

    def test_unique_ids(self):
        ids = {generate_id() for _ in range(20)}
        assert len(ids) == 20

    def test_uuid_format(self):
        import uuid
        uid = generate_id()
        uuid.UUID(uid)  # raises if not valid UUID


# ── Path helpers with user namespacing ────────────────────────────────────────

class TestVideoOutputPath:
    def test_anonymous_path(self, tmp_path):
        with patch.object(storage, "VIDEO_DIR", tmp_path):
            p = video_output_path("vid-1", user_id=None)
        assert ANONYMOUS_USER_ID in str(p)
        assert p.suffix == ".mp4"

    def test_user_path(self, tmp_path):
        with patch.object(storage, "VIDEO_DIR", tmp_path):
            p = video_output_path("vid-1", user_id="user-abc")
        assert "userabc" in str(p).replace("-", "")
        assert p.suffix == ".mp4"

    def test_different_users_different_paths(self, tmp_path):
        with patch.object(storage, "VIDEO_DIR", tmp_path):
            p1 = video_output_path("vid-1", user_id="alice")
            p2 = video_output_path("vid-1", user_id="bob")
        assert p1 != p2


class TestAnalysisOutputPath:
    def test_creates_user_subdirectory(self, tmp_path):
        with patch.object(storage, "ANALYSIS_DIR", tmp_path):
            p = analysis_output_path("audio-1", user_id="user-xyz")
        assert p.suffix == ".json"
        assert p.parent.exists()

    def test_anonymous_subdir(self, tmp_path):
        with patch.object(storage, "ANALYSIS_DIR", tmp_path):
            p = analysis_output_path("audio-1", user_id=None)
        assert ANONYMOUS_USER_ID in str(p)


class TestGetStemsDir:
    def test_namespaced(self, tmp_path):
        with patch.object(storage, "STEMS_DIR", tmp_path):
            p = get_stems_dir("audio-1", user_id="alice")
        assert "alice" in str(p)
        assert "audio-1" in str(p)

    def test_anonymous(self, tmp_path):
        with patch.object(storage, "STEMS_DIR", tmp_path):
            p = get_stems_dir("audio-1", user_id=None)
        assert ANONYMOUS_USER_ID in str(p)


class TestGetAudioPath:
    def test_raises_when_not_found(self, tmp_path):
        with patch.object(storage, "AUDIO_DIR", tmp_path):
            with pytest.raises(FileNotFoundError):
                get_audio_path("nonexistent", user_id=None)

    def test_finds_file_in_user_dir(self, tmp_path):
        uid = "alice"
        user_dir = tmp_path / _user_prefix(uid)
        user_dir.mkdir(parents=True)
        audio_file = user_dir / "test-audio.mp3"
        audio_file.touch()
        with patch.object(storage, "AUDIO_DIR", tmp_path):
            p = get_audio_path("test-audio", user_id=uid)
        assert p == audio_file

    def test_fallback_to_flat_dir(self, tmp_path):
        # Legacy files stored in flat AUDIO_DIR
        audio_file = tmp_path / "legacy-audio.wav"
        audio_file.touch()
        with patch.object(storage, "AUDIO_DIR", tmp_path):
            p = get_audio_path("legacy-audio", user_id="alice")
        assert p == audio_file


class TestGetProcessedAudioPath:
    def test_raises_when_not_found(self, tmp_path):
        with patch.object(storage, "PROCESSED_AUDIO_DIR", tmp_path):
            with pytest.raises(FileNotFoundError):
                get_processed_audio_path("nope", user_id=None)

    def test_finds_in_user_dir(self, tmp_path):
        uid = "bob"
        user_dir = tmp_path / _user_prefix(uid)
        user_dir.mkdir(parents=True)
        pf = user_dir / "proc-1.wav"
        pf.touch()
        with patch.object(storage, "PROCESSED_AUDIO_DIR", tmp_path):
            p = get_processed_audio_path("proc-1", user_id=uid)
        assert p == pf

"""Tests for Pydantic models — validates schema, defaults, and edge cases."""
import pytest
from pydantic import ValidationError

from models import (
    AudioAnalysisResponse,
    AudioEmotionSummary,
    AudioProcessingParams,
    BeatInfo,
    ExtendedAudioAnalysisResponse,
    FrameFeature,
    LyricEntry,
    LyricSegment,
    ProcessAudioRequest,
    RenderRequest,
    RenderResponse,
    Section,
    SectionInfo,
)


class TestBeatInfo:
    def test_valid(self):
        b = BeatInfo(time=1.5, strength=0.8)
        assert b.time == 1.5
        assert b.strength == 0.8

    def test_missing_field(self):
        with pytest.raises(ValidationError):
            BeatInfo(time=1.5)


class TestFrameFeature:
    def test_valid(self):
        f = FrameFeature(time=0.0, bass=0.5, mid=0.3, treble=0.2, energy=0.4)
        assert f.energy == 0.4

    def test_missing_field(self):
        with pytest.raises(ValidationError):
            FrameFeature(time=0.0, bass=0.5)


class TestLyricSegment:
    def test_defaults(self):
        ls = LyricSegment(
            start=0.0, end=3.0, text="hello",
            language="en", sentiment=0.5, emotion="happy", intensity=0.8
        )
        assert ls.translated_text is None

    def test_with_translation(self):
        ls = LyricSegment(
            start=0.0, end=3.0, text="hola",
            language="es", sentiment=0.2, emotion="chill", intensity=0.3,
            translated_text="hello"
        )
        assert ls.translated_text == "hello"


class TestAudioAnalysisResponse:
    def test_minimal(self):
        resp = AudioAnalysisResponse(
            audio_id="abc123",
            duration=120.0,
            bpm=128.0,
            beats=[BeatInfo(time=0.5, strength=0.9)],
            frames=[FrameFeature(time=0.0, bass=0.5, mid=0.3, treble=0.2, energy=0.4)],
        )
        assert resp.audio_id == "abc123"
        assert resp.lyrics is None
        assert resp.sections is None

    def test_with_lyrics(self):
        resp = AudioAnalysisResponse(
            audio_id="abc123",
            duration=60.0,
            bpm=100.0,
            beats=[],
            frames=[],
            lyrics=[LyricEntry(time=1.0, text="hello", sentiment=0.5, energy=0.7)],
        )
        assert len(resp.lyrics) == 1


class TestExtendedAudioAnalysisResponse:
    def test_defaults(self):
        resp = ExtendedAudioAnalysisResponse(
            audio_id="ext123",
            duration=180.0,
            bpm=140.0,
            beats=[],
            frames=[],
        )
        assert resp.has_stems is False
        assert resp.detected_language is None
        assert resp.emotion_summary is None

    def test_full(self):
        resp = ExtendedAudioAnalysisResponse(
            audio_id="ext123",
            duration=180.0,
            bpm=140.0,
            beats=[BeatInfo(time=0.5, strength=1.0)],
            frames=[FrameFeature(time=0.0, bass=1.0, mid=0.5, treble=0.3, energy=0.8)],
            lyrics=[LyricSegment(
                start=0.0, end=3.0, text="test",
                language="en", sentiment=0.5, emotion="happy", intensity=0.8
            )],
            sections=[SectionInfo(start=0.0, end=30.0, type="intro", energy=0.3)],
            emotion_summary=AudioEmotionSummary(
                overall_sentiment=0.6, overall_emotion="happy",
                arousal=0.7, valence=0.5
            ),
            has_stems=True,
            detected_language="en",
        )
        assert resp.has_stems is True
        assert resp.emotion_summary.overall_emotion == "happy"


class TestAudioProcessingParams:
    def test_defaults(self):
        p = AudioProcessingParams()
        assert p.use_processed is False
        assert p.noise_reduction_strength == 0.5
        assert p.normalize_lufs == -14.0

    def test_custom(self):
        p = AudioProcessingParams(low_gain_db=3.0, high_gain_db=-2.0)
        assert p.low_gain_db == 3.0


class TestRenderRequest:
    def test_minimal(self):
        r = RenderRequest(
            audio_id="abc",
            aspect_ratio="16:9",
            resolution_preset="1080p",
        )
        assert r.visual_mode == "geometric"
        assert r.use_lyrics is True

    def test_invalid_visual_mode(self):
        with pytest.raises(ValidationError):
            RenderRequest(
                audio_id="abc",
                aspect_ratio="16:9",
                resolution_preset="1080p",
                visual_mode="invalid_mode",
            )

"""Tests for nlp_analysis.py with mocked ML pipelines (TST-006).

All HuggingFace model calls are patched so tests run without GPU/network.
Covers: analyze_sentiment, analyze_emotion, compute_intensity, analyze_lyrics,
        compute_emotion_summary, and both keyword fallbacks.
"""
import sys
import os
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import nlp_analysis
from nlp_analysis import (
    analyze_sentiment,
    analyze_emotion,
    compute_intensity,
    analyze_lyrics,
    compute_emotion_summary,
    _fallback_sentiment,
    _fallback_emotion,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mock_sentiment_result(label: str, score: float):
    """Return a callable that mimics a HuggingFace sentiment pipeline."""
    def _call(text):
        return [{"label": label, "score": score}]
    return _call


def _mock_emotion_result(label: str, score: float = 0.9):
    def _call(text):
        return [{"label": label, "score": score}]
    return _call


# ── _fallback_sentiment ───────────────────────────────────────────────────────

class TestFallbackSentiment:
    def test_positive_words(self):
        assert _fallback_sentiment("I love this happy song") > 0

    def test_negative_words(self):
        assert _fallback_sentiment("I hate this sad pain") < 0

    def test_neutral_no_keywords(self):
        assert _fallback_sentiment("the quick brown fox") == 0.0

    def test_mixed_returns_ratio(self):
        # 2 positive, 1 negative → positive result
        score = _fallback_sentiment("love happy terrible")
        assert score > 0

    def test_result_clamped(self):
        score = _fallback_sentiment("love love love love")
        assert -1.0 <= score <= 1.0

    def test_empty_string(self):
        assert _fallback_sentiment("") == 0.0


# ── _fallback_emotion ─────────────────────────────────────────────────────────

class TestFallbackEmotion:
    def test_happy_keyword(self):
        assert _fallback_emotion("I feel happy today") == "happy"

    def test_sad_keyword(self):
        assert _fallback_emotion("I want to cry") == "sad"

    def test_angry_keyword(self):
        assert _fallback_emotion("I am so angry and full of rage") == "angry"

    def test_hopeful_keyword(self):
        assert _fallback_emotion("I have a dream for the future") == "hopeful"

    def test_default_is_chill(self):
        assert _fallback_emotion("the quick brown fox") == "chill"

    def test_case_insensitive(self):
        assert _fallback_emotion("I feel HAPPY") == "happy"


# ── analyze_sentiment ─────────────────────────────────────────────────────────

class TestAnalyzeSentiment:
    def test_positive_label(self):
        mock_pipe = _mock_sentiment_result("positive", 0.9)
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=mock_pipe):
            score = analyze_sentiment("great song")
        assert score == pytest.approx(0.9)

    def test_five_star_label(self):
        mock_pipe = _mock_sentiment_result("5 stars", 0.95)
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=mock_pipe):
            score = analyze_sentiment("amazing!")
        assert score == pytest.approx(0.95)

    def test_negative_label(self):
        mock_pipe = _mock_sentiment_result("negative", 0.8)
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=mock_pipe):
            score = analyze_sentiment("awful track")
        assert score == pytest.approx(-0.8)

    def test_one_star_label(self):
        mock_pipe = _mock_sentiment_result("1 star", 0.7)
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=mock_pipe):
            score = analyze_sentiment("terrible")
        assert score == pytest.approx(-0.7)

    def test_neutral_label_returns_zero(self):
        mock_pipe = _mock_sentiment_result("neutral", 0.6)
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=mock_pipe):
            score = analyze_sentiment("okay I guess")
        assert score == pytest.approx(0.0)

    def test_none_pipeline_uses_fallback(self):
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=None):
            score = analyze_sentiment("love happy joy")
        assert score > 0

    def test_pipeline_exception_uses_fallback(self):
        def _raise(_):
            raise RuntimeError("model error")
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=_raise):
            score = analyze_sentiment("love this song")
        # fallback: positive words present
        assert score >= 0.0

    def test_long_text_truncated(self):
        long_text = "a" * 600
        results = []
        def _capture(text):
            results.append(len(text))
            return [{"label": "positive", "score": 0.5}]
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=_capture):
            analyze_sentiment(long_text)
        assert results[0] <= 512


# ── analyze_emotion ───────────────────────────────────────────────────────────

class TestAnalyzeEmotion:
    @pytest.mark.parametrize("label,expected", [
        ("joy", "happy"),
        ("happiness", "happy"),
        ("sadness", "sad"),
        ("anger", "angry"),
        ("disgust", "angry"),
        ("fear", "chill"),
        ("surprise", "hopeful"),
        ("neutral", "chill"),
    ])
    def test_label_mapping(self, label, expected):
        mock_pipe = _mock_emotion_result(label)
        with patch.object(nlp_analysis, "get_emotion_pipeline", return_value=mock_pipe):
            assert analyze_emotion("some text") == expected

    def test_unknown_label_defaults_to_chill(self):
        mock_pipe = _mock_emotion_result("confusion")
        with patch.object(nlp_analysis, "get_emotion_pipeline", return_value=mock_pipe):
            assert analyze_emotion("whatever") == "chill"

    def test_none_pipeline_uses_fallback(self):
        with patch.object(nlp_analysis, "get_emotion_pipeline", return_value=None):
            result = analyze_emotion("I feel happy")
        assert result == "happy"

    def test_pipeline_exception_uses_fallback(self):
        def _raise(_):
            raise ValueError("broken")
        with patch.object(nlp_analysis, "get_emotion_pipeline", return_value=_raise):
            result = analyze_emotion("so sad I cry")
        assert result == "sad"

    def test_long_text_truncated(self):
        captured = []
        def _capture(text):
            captured.append(len(text))
            return [{"label": "joy", "score": 0.9}]
        with patch.object(nlp_analysis, "get_emotion_pipeline", return_value=_capture):
            analyze_emotion("x" * 600)
        assert captured[0] <= 512


# ── compute_intensity ─────────────────────────────────────────────────────────

class TestComputeIntensity:
    def test_empty_text_zero_sentiment_is_low(self):
        i = compute_intensity("", 0.0)
        assert i == pytest.approx(0.0)

    def test_high_sentiment_magnitude_increases_intensity(self):
        low = compute_intensity("a", 0.1)
        high = compute_intensity("a", 0.9)
        assert high > low

    def test_longer_text_increases_intensity(self):
        short = compute_intensity("hi", 0.5)
        long_ = compute_intensity("x" * 50, 0.5)
        assert long_ >= short

    def test_intensity_keywords_boost(self):
        base = compute_intensity("something", 0.3)
        boosted = compute_intensity("something fire!", 0.3)
        assert boosted > base

    def test_result_clamped_to_0_1(self):
        i = compute_intensity("fire!!! burn!! explode!!", 1.0)
        assert 0.0 <= i <= 1.0

    def test_exclamation_boost(self):
        without = compute_intensity("this is great", 0.5)
        with_ = compute_intensity("this is great!", 0.5)
        assert with_ >= without


# ── analyze_lyrics ────────────────────────────────────────────────────────────

class TestAnalyzeLyrics:
    def _null_pipelines(self):
        """Context manager: both pipelines return None so fallbacks are used."""
        return (
            patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=None),
            patch.object(nlp_analysis, "get_emotion_pipeline", return_value=None),
        )

    def test_empty_input(self):
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=None), \
             patch.object(nlp_analysis, "get_emotion_pipeline", return_value=None):
            result = analyze_lyrics([])
        assert result == []

    def test_whitespace_only_segments_skipped(self):
        segs = [{"start": 0.0, "end": 1.0, "text": "   ", "language": "en"}]
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=None), \
             patch.object(nlp_analysis, "get_emotion_pipeline", return_value=None):
            result = analyze_lyrics(segs)
        assert result == []

    def test_output_schema(self):
        segs = [{"start": 1.0, "end": 3.0, "text": "I love this", "language": "en"}]
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=None), \
             patch.object(nlp_analysis, "get_emotion_pipeline", return_value=None):
            result = analyze_lyrics(segs)
        assert len(result) == 1
        r = result[0]
        assert r["start"] == 1.0
        assert r["end"] == 3.0
        assert r["text"] == "I love this"
        assert r["language"] == "en"
        assert "sentiment" in r
        assert "emotion" in r
        assert "intensity" in r
        assert r["translated_text"] is None

    def test_multiple_segments(self):
        segs = [
            {"start": 0.0, "end": 2.0, "text": "happy day", "language": "en"},
            {"start": 2.0, "end": 4.0, "text": "sad night", "language": "en"},
        ]
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=None), \
             patch.object(nlp_analysis, "get_emotion_pipeline", return_value=None):
            result = analyze_lyrics(segs)
        assert len(result) == 2

    def test_uses_mocked_pipeline(self):
        segs = [{"start": 0.0, "end": 2.0, "text": "test", "language": "en"}]
        mock_sent = _mock_sentiment_result("positive", 0.95)
        mock_emot = _mock_emotion_result("joy")
        with patch.object(nlp_analysis, "get_sentiment_pipeline", return_value=mock_sent), \
             patch.object(nlp_analysis, "get_emotion_pipeline", return_value=mock_emot):
            result = analyze_lyrics(segs)
        assert result[0]["sentiment"] == pytest.approx(0.95)
        assert result[0]["emotion"] == "happy"


# ── compute_emotion_summary ───────────────────────────────────────────────────

class TestComputeEmotionSummary:
    def test_empty_returns_defaults(self):
        summary = compute_emotion_summary([])
        assert summary["overall_sentiment"] == 0.0
        assert summary["overall_emotion"] == "neutral"
        assert summary["arousal"] == 0.5
        assert summary["valence"] == 0.0

    def test_single_segment(self):
        segs = [{"sentiment": 0.8, "emotion": "happy", "intensity": 0.7}]
        s = compute_emotion_summary(segs)
        assert s["overall_sentiment"] == pytest.approx(0.8)
        assert s["overall_emotion"] == "happy"
        assert s["arousal"] == pytest.approx(0.7)
        assert s["valence"] == pytest.approx(0.8)

    def test_most_common_emotion_wins(self):
        segs = [
            {"sentiment": 0.5, "emotion": "happy", "intensity": 0.6},
            {"sentiment": 0.6, "emotion": "happy", "intensity": 0.7},
            {"sentiment": -0.3, "emotion": "sad", "intensity": 0.4},
        ]
        s = compute_emotion_summary(segs)
        assert s["overall_emotion"] == "happy"

    def test_sentiment_averaged(self):
        segs = [
            {"sentiment": 1.0, "emotion": "happy", "intensity": 0.8},
            {"sentiment": -1.0, "emotion": "sad", "intensity": 0.8},
        ]
        s = compute_emotion_summary(segs)
        assert s["overall_sentiment"] == pytest.approx(0.0)

    def test_arousal_is_mean_intensity(self):
        segs = [
            {"sentiment": 0.0, "emotion": "chill", "intensity": 0.2},
            {"sentiment": 0.0, "emotion": "chill", "intensity": 0.8},
        ]
        s = compute_emotion_summary(segs)
        assert s["arousal"] == pytest.approx(0.5)

    def test_valence_equals_overall_sentiment(self):
        segs = [{"sentiment": 0.6, "emotion": "happy", "intensity": 0.5}]
        s = compute_emotion_summary(segs)
        assert s["valence"] == s["overall_sentiment"]

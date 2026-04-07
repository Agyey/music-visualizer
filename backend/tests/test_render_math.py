"""Tests for render_video math helpers (TST-007).

Covers: interpolate_features, get_beat_pulse, get_current_section,
        get_visual_state, hsv_to_rgb, VisualStateAtTime.
"""
import math
import sys
import os

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models import (
    AudioAnalysisResponse, ExtendedAudioAnalysisResponse,
    BeatInfo, FrameFeature, LyricSegment, Section,
)
from render_video import (
    VisualStateAtTime,
    interpolate_features,
    get_beat_pulse,
    get_current_section,
    get_visual_state,
    hsv_to_rgb,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_analysis(frames=None, beats=None, sections=None) -> AudioAnalysisResponse:
    return AudioAnalysisResponse(
        audio_id="test",
        duration=10.0,
        bpm=120.0,
        beats=beats or [],
        frames=frames or [],
        sections=sections,
    )


def make_frames():
    return [
        FrameFeature(time=0.0, bass=0.0, mid=0.0, treble=0.0, energy=0.0),
        FrameFeature(time=1.0, bass=0.5, mid=0.4, treble=0.3, energy=0.6),
        FrameFeature(time=2.0, bass=1.0, mid=0.8, treble=0.6, energy=1.0),
    ]


# ── interpolate_features ──────────────────────────────────────────────────────

class TestInterpolateFeatures:
    def test_empty_frames_returns_zeros(self):
        analysis = make_analysis(frames=[])
        result = interpolate_features(analysis, 0.5)
        assert result == {"bass": 0.0, "mid": 0.0, "treble": 0.0, "energy": 0.0}

    def test_before_first_frame_clamps_to_first(self):
        analysis = make_analysis(frames=make_frames())
        result = interpolate_features(analysis, -1.0)
        assert result["bass"] == 0.0
        assert result["energy"] == 0.0

    def test_after_last_frame_clamps_to_last(self):
        analysis = make_analysis(frames=make_frames())
        result = interpolate_features(analysis, 100.0)
        assert result["bass"] == 1.0
        assert result["energy"] == 1.0

    def test_exact_frame_time(self):
        analysis = make_analysis(frames=make_frames())
        result = interpolate_features(analysis, 1.0)
        assert result["bass"] == pytest.approx(0.5)
        assert result["mid"] == pytest.approx(0.4)
        assert result["treble"] == pytest.approx(0.3)
        assert result["energy"] == pytest.approx(0.6)

    def test_midpoint_interpolation(self):
        analysis = make_analysis(frames=make_frames())
        result = interpolate_features(analysis, 1.5)
        # halfway between frame@1.0 and frame@2.0
        assert result["bass"] == pytest.approx(0.75)
        assert result["mid"] == pytest.approx(0.6)
        assert result["treble"] == pytest.approx(0.45)
        assert result["energy"] == pytest.approx(0.8)

    def test_quarter_interpolation(self):
        analysis = make_analysis(frames=make_frames())
        result = interpolate_features(analysis, 0.25)
        assert result["bass"] == pytest.approx(0.125)
        assert result["energy"] == pytest.approx(0.15)

    def test_single_frame_clamps_both_directions(self):
        single = [FrameFeature(time=5.0, bass=0.9, mid=0.1, treble=0.2, energy=0.7)]
        analysis = make_analysis(frames=single)
        assert interpolate_features(analysis, 0.0)["bass"] == pytest.approx(0.9)
        assert interpolate_features(analysis, 10.0)["bass"] == pytest.approx(0.9)


# ── get_beat_pulse ────────────────────────────────────────────────────────────

class TestGetBeatPulse:
    def test_no_beats_returns_zero(self):
        analysis = make_analysis(beats=[])
        assert get_beat_pulse(analysis, 1.0) == 0.0

    def test_exact_beat_returns_strength(self):
        beats = [BeatInfo(time=2.0, strength=0.8)]
        analysis = make_analysis(beats=beats)
        pulse = get_beat_pulse(analysis, 2.0)
        assert pulse == pytest.approx(0.8)

    def test_pulse_decays_within_window(self):
        beats = [BeatInfo(time=2.0, strength=1.0)]
        analysis = make_analysis(beats=beats)
        pulse_near = get_beat_pulse(analysis, 2.03, window=0.06)
        assert 0.0 < pulse_near < 1.0

    def test_pulse_zero_outside_window(self):
        beats = [BeatInfo(time=2.0, strength=1.0)]
        analysis = make_analysis(beats=beats)
        assert get_beat_pulse(analysis, 2.1, window=0.06) == 0.0

    def test_multiple_beats_returns_max(self):
        beats = [
            BeatInfo(time=2.0, strength=0.5),
            BeatInfo(time=2.02, strength=0.9),
        ]
        analysis = make_analysis(beats=beats)
        pulse = get_beat_pulse(analysis, 2.0, window=0.06)
        # Both beats contribute; the stronger nearby one should dominate
        assert pulse >= 0.5

    def test_strength_scaling(self):
        beats = [BeatInfo(time=0.0, strength=0.5)]
        analysis = make_analysis(beats=beats)
        assert get_beat_pulse(analysis, 0.0) == pytest.approx(0.5)


# ── get_current_section ───────────────────────────────────────────────────────

class TestGetCurrentSection:
    def test_no_sections_returns_intro(self):
        analysis = make_analysis(sections=None)
        assert get_current_section(analysis, 5.0) == "intro"

    def test_within_section(self):
        sections = [Section(start=4.0, end=8.0, type="chorus")]
        analysis = make_analysis(sections=sections)
        assert get_current_section(analysis, 6.0) == "chorus"

    def test_before_all_sections_returns_intro(self):
        sections = [Section(start=4.0, end=8.0, type="verse")]
        analysis = make_analysis(sections=sections)
        assert get_current_section(analysis, 1.0) == "intro"

    def test_boundary_start_is_inclusive(self):
        sections = [Section(start=4.0, end=8.0, type="bridge")]
        analysis = make_analysis(sections=sections)
        assert get_current_section(analysis, 4.0) == "bridge"

    def test_boundary_end_is_inclusive(self):
        sections = [Section(start=4.0, end=8.0, type="bridge")]
        analysis = make_analysis(sections=sections)
        assert get_current_section(analysis, 8.0) == "bridge"

    def test_multiple_sections_picks_correct(self):
        sections = [
            Section(start=0.0, end=10.0, type="intro"),
            Section(start=10.0, end=40.0, type="verse"),
            Section(start=40.0, end=70.0, type="chorus"),
        ]
        analysis = make_analysis(sections=sections)
        assert get_current_section(analysis, 5.0) == "intro"
        assert get_current_section(analysis, 25.0) == "verse"
        assert get_current_section(analysis, 55.0) == "chorus"


# ── get_visual_state ──────────────────────────────────────────────────────────

class TestGetVisualState:
    def test_returns_visual_state_at_time(self):
        analysis = make_analysis(frames=make_frames())
        state = get_visual_state(analysis, 1.0)
        assert isinstance(state, VisualStateAtTime)
        assert state.time == pytest.approx(1.0)
        assert state.bass == pytest.approx(0.5)
        assert state.beat_pulse == 0.0

    def test_beat_pulse_propagates(self):
        beats = [BeatInfo(time=1.0, strength=0.9)]
        analysis = make_analysis(frames=make_frames(), beats=beats)
        state = get_visual_state(analysis, 1.0)
        assert state.beat_pulse == pytest.approx(0.9)

    def test_section_propagates(self):
        sections = [Section(start=0.0, end=5.0, type="verse")]
        analysis = make_analysis(frames=make_frames(), sections=sections)
        state = get_visual_state(analysis, 1.0)
        assert state.current_section == "verse"

    def test_lyric_sentiment_from_extended_analysis(self):
        frames = make_frames()
        lyric = LyricSegment(
            start=0.5, end=1.5, text="test",
            language="en", sentiment=0.75, emotion="happy", intensity=0.9
        )
        analysis = ExtendedAudioAnalysisResponse(
            audio_id="x", duration=10.0, bpm=120.0,
            beats=[], frames=frames, lyrics=[lyric]
        )
        state = get_visual_state(analysis, 1.0)
        assert state.lyric_sentiment == pytest.approx(0.75)
        assert state.lyric_energy == pytest.approx(0.9)

    def test_lyric_outside_range_uses_defaults(self):
        frames = make_frames()
        lyric = LyricSegment(
            start=5.0, end=7.0, text="test",
            language="en", sentiment=0.9, emotion="happy", intensity=0.95
        )
        analysis = ExtendedAudioAnalysisResponse(
            audio_id="x", duration=10.0, bpm=120.0,
            beats=[], frames=frames, lyrics=[lyric]
        )
        state = get_visual_state(analysis, 1.0)
        assert state.lyric_sentiment == pytest.approx(0.0)
        # lyric_energy falls back to frame energy
        assert state.lyric_energy == pytest.approx(state.energy)


# ── hsv_to_rgb ────────────────────────────────────────────────────────────────

class TestHsvToRgb:
    def test_red(self):
        r, g, b = hsv_to_rgb(0, 1.0, 1.0)
        assert r == 255
        assert g == 0
        assert b == 0

    def test_green(self):
        r, g, b = hsv_to_rgb(120, 1.0, 1.0)
        assert r == 0
        assert g == 255
        assert b == 0

    def test_blue(self):
        r, g, b = hsv_to_rgb(240, 1.0, 1.0)
        assert r == 0
        assert g == 0
        assert b == 255

    def test_black(self):
        r, g, b = hsv_to_rgb(0, 0.0, 0.0)
        assert r == 0 and g == 0 and b == 0

    def test_white(self):
        r, g, b = hsv_to_rgb(0, 0.0, 1.0)
        assert r == 255 and g == 255 and b == 255

    def test_hue_wraps_at_360(self):
        assert hsv_to_rgb(0, 1.0, 1.0) == hsv_to_rgb(360, 1.0, 1.0)

    def test_hue_wraps_past_360(self):
        assert hsv_to_rgb(0, 1.0, 1.0) == hsv_to_rgb(720, 1.0, 1.0)

    def test_output_range(self):
        for h in range(0, 360, 30):
            r, g, b = hsv_to_rgb(h, 0.7, 0.8)
            assert 0 <= r <= 255
            assert 0 <= g <= 255
            assert 0 <= b <= 255

    def test_all_sectors_covered(self):
        # Drive each of the 6 hue sectors
        sectors = [0, 60, 120, 180, 240, 300]
        for h in sectors:
            r, g, b = hsv_to_rgb(h + 10, 1.0, 1.0)
            assert 0 <= r <= 255

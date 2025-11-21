from pydantic import BaseModel
from typing import List, Optional, Literal


class BeatInfo(BaseModel):
    time: float       # seconds
    strength: float   # 0..1


class FrameFeature(BaseModel):
    time: float       # seconds, center of frame
    bass: float       # 0..1
    mid: float        # 0..1
    treble: float     # 0..1
    energy: float     # 0..1


class LyricEntry(BaseModel):
    time: float       # seconds
    text: str
    sentiment: float  # -1 to 1
    energy: float     # 0 to 1


class LyricSegment(BaseModel):
    start: float
    end: float
    text: str
    language: str
    sentiment: float          # -1..1
    emotion: str              # e.g. "happy", "sad", "angry", "chill"
    intensity: float          # 0..1
    translated_text: Optional[str] = None


class Section(BaseModel):
    start: float
    end: float
    type: str  # "intro", "verse", "chorus", "drop", "bridge", "outro"


class SectionInfo(BaseModel):
    start: float
    end: float
    type: str                 # "intro", "verse", "chorus", "drop", "bridge", etc.
    energy: float             # 0..1
    emotion: Optional[str] = None


class AudioEmotionSummary(BaseModel):
    overall_sentiment: float
    overall_emotion: str
    arousal: float            # 0..1
    valence: float            # -1..1


class AudioAnalysisResponse(BaseModel):
    audio_id: str
    duration: float
    bpm: float
    beats: List[BeatInfo]
    frames: List[FrameFeature]
    lyrics: Optional[List[LyricEntry]] = None
    sections: Optional[List[Section]] = None


class ExtendedAudioAnalysisResponse(AudioAnalysisResponse):
    """Extended analysis with transcription, emotion, and stems."""
    lyrics: Optional[List[LyricSegment]] = None
    sections: Optional[List[SectionInfo]] = None
    emotion_summary: Optional[AudioEmotionSummary] = None
    has_stems: bool = False
    detected_language: Optional[str] = None


class AudioProcessingParams(BaseModel):
    use_processed: bool = False
    noise_reduction_strength: float = 0.5  # 0..1
    low_gain_db: float = 0.0
    mid_gain_db: float = 0.0
    high_gain_db: float = 0.0
    vocal_gain_db: float = 0.0
    background_gain_db: float = 0.0
    reverb_amount: float = 0.0
    normalize_lufs: Optional[float] = -14.0


class ProcessAudioRequest(BaseModel):
    audio_id: str
    params: AudioProcessingParams


class ProcessAudioResponse(BaseModel):
    audio_id: str
    processed_audio_id: str        # id of processed audio file


class RenderRequest(BaseModel):
    audio_id: str
    processed_audio_id: Optional[str] = None
    aspect_ratio: str        # "16:9" or "9:16"
    resolution_preset: str   # "1080p" or "4K"
    visual_mode: Literal["geometric", "psychedelic", "particles", "threeD"] = "geometric"
    visual_variant: Optional[str] = None   # sub-style within modes
    use_lyrics: bool = True
    use_emotion: bool = True
    # optional controls to tune the look without changing code:
    line_thickness: Optional[float] = None
    glow_strength: Optional[float] = None
    bar_count: Optional[int] = None
    color_mode: Optional[str] = None  # e.g. "default", "red_blue", etc.


class RenderResponse(BaseModel):
    video_id: str
    video_url: str   # relative or absolute path that frontend can GET


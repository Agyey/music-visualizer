"""
Whisper-based audio transcription with multilingual support.
Supports Hindi, English, and auto language detection.
"""
from faster_whisper import WhisperModel
from pathlib import Path
from typing import List, Dict, Optional
from config import WHISPER_MODEL_SIZE, WHISPER_DEVICE
import logging

logger = logging.getLogger(__name__)

# Global model instance (lazy loaded)
_model: Optional[WhisperModel] = None


def get_whisper_model() -> WhisperModel:
    """Get or initialize Whisper model (singleton)."""
    global _model
    if _model is None:
        logger.info(f"Loading Whisper model: {WHISPER_MODEL_SIZE} on {WHISPER_DEVICE}")
        _model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
            compute_type="int8" if WHISPER_DEVICE == "cpu" else "float16"
        )
    return _model


def transcribe_audio(audio_path: str, language: Optional[str] = None) -> Dict:
    """
    Transcribe audio using Whisper.
    
    Args:
        audio_path: Path to audio file
        language: Optional language code (e.g., "hi", "en"). If None, auto-detect.
    
    Returns:
        Dict with:
            - segments: List of {start, end, text, language}
            - detected_language: str
            - language_probability: float
    """
    model = get_whisper_model()
    
    # Transcribe with language detection if not specified
    if language:
        segments, info = model.transcribe(
            audio_path,
            language=language,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
    else:
        segments, info = model.transcribe(
            audio_path,
            language=None,  # Auto-detect
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
    
    # Convert segments to list
    segment_list = []
    for segment in segments:
        segment_list.append({
            "start": float(segment.start),
            "end": float(segment.end),
            "text": segment.text.strip(),
            "language": info.language,
            "no_speech_prob": float(segment.no_speech_prob) if hasattr(segment, 'no_speech_prob') else 0.0
        })
    
    return {
        "segments": segment_list,
        "detected_language": info.language,
        "language_probability": float(info.language_probability)
    }


def transcribe_audio_simple(audio_path: str) -> List[Dict]:
    """
    Simplified transcription that returns just segments.
    Used for backward compatibility.
    """
    result = transcribe_audio(audio_path)
    return result["segments"]


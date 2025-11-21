import librosa
import numpy as np
import json
import re
from pathlib import Path
from models import (
    AudioAnalysisResponse, ExtendedAudioAnalysisResponse,
    BeatInfo, FrameFeature, LyricEntry, Section,
    LyricSegment, SectionInfo, AudioEmotionSummary
)
from storage import analysis_output_path
from transcription import transcribe_audio
from nlp_analysis import analyze_lyrics, compute_emotion_summary
from audio_processing import separate_stems
import logging

logger = logging.getLogger(__name__)


def analyze_audio(file_path: str, audio_id: str) -> AudioAnalysisResponse:
    """
    Use librosa to load audio and compute:
    - duration
    - bpm + beat times
    - per-frame bass/mid/treble energy
    - normalized energy (0..1)
    """
    # Load audio
    y, sr = librosa.load(file_path, sr=None, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)
    
    # Beat tracking
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    
    # Onset envelope for beat strength
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    beat_strengths_raw = onset_env[beat_frames]
    beat_strengths = beat_strengths_raw / (beat_strengths_raw.max() + 1e-9)
    
    beats = [
        BeatInfo(time=float(t), strength=float(s))
        for t, s in zip(beat_times, beat_strengths)
    ]
    
    # STFT for frequency analysis
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    times = librosa.frames_to_time(
        np.arange(S.shape[1]), 
        sr=sr, 
        hop_length=512, 
        n_fft=2048
    )
    
    # Define frequency bands (Hz)
    bass_idx = np.where((freqs >= 20) & (freqs < 250))[0]
    mid_idx = np.where((freqs >= 250) & (freqs < 4000))[0]
    treble_idx = np.where((freqs >= 4000) & (freqs < 12000))[0]
    
    # Compute per-frame magnitudes
    bass_mag = S[bass_idx, :].mean(axis=0)
    mid_mag = S[mid_idx, :].mean(axis=0)
    treble_mag = S[treble_idx, :].mean(axis=0)
    
    # Normalize each band to 0..1
    bass_norm = bass_mag / (bass_mag.max() + 1e-9)
    mid_norm = mid_mag / (mid_mag.max() + 1e-9)
    treble_norm = treble_mag / (treble_mag.max() + 1e-9)
    
    # Energy (weighted combination)
    energy_raw = 0.5 * bass_norm + 0.3 * mid_norm + 0.2 * treble_norm
    energy = energy_raw / (energy_raw.max() + 1e-9)
    
    # Construct frame features
    frames = [
        FrameFeature(
            time=float(times[i]),
            bass=float(bass_norm[i]),
            mid=float(mid_norm[i]),
            treble=float(treble_norm[i]),
            energy=float(energy[i])
        )
        for i in range(len(times))
    ]
    
    # Detect sections (basic)
    sections_basic = detect_sections(y, sr, duration, energy, times)
    
    # Try to load lyrics from .lrc file if available (legacy)
    lyrics_legacy = load_lyrics(file_path, audio_id)
    
    # Create basic response
    response = AudioAnalysisResponse(
        audio_id=audio_id,
        duration=float(duration),
        bpm=float(tempo),
        beats=beats,
        frames=frames,
        sections=sections_basic,
        lyrics=lyrics_legacy
    )
    
    # Save basic analysis
    analysis_path = analysis_output_path(audio_id)
    with open(analysis_path, "w") as f:
        json.dump(response.model_dump(), f, indent=2)
    
    return response


def analyze_audio_extended(file_path: str, audio_id: str, run_transcription: bool = True, run_stems: bool = False) -> ExtendedAudioAnalysisResponse:
    """
    Extended audio analysis with transcription, NLP, and optional stem separation.
    
    Args:
        file_path: Path to audio file
        audio_id: Audio ID
        run_transcription: Whether to run Whisper transcription
        run_stems: Whether to run stem separation (can be slow)
    
    Returns:
        ExtendedAudioAnalysisResponse with all analysis
    """
    # Run basic analysis first
    basic_response = analyze_audio(file_path, audio_id)
    
    # Transcription and NLP
    lyric_segments = None
    detected_language = None
    emotion_summary = None
    
    if run_transcription:
        try:
            logger.info(f"Transcribing audio {audio_id}...")
            transcription_result = transcribe_audio(file_path)
            detected_language = transcription_result["detected_language"]
            
            # Analyze lyrics with NLP
            logger.info(f"Analyzing lyrics with NLP...")
            analyzed_lyrics = analyze_lyrics(transcription_result["segments"])
            
            # Convert to LyricSegment models
            lyric_segments = [
                LyricSegment(
                    start=seg["start"],
                    end=seg["end"],
                    text=seg["text"],
                    language=seg["language"],
                    sentiment=seg["sentiment"],
                    emotion=seg["emotion"],
                    intensity=seg["intensity"],
                    translated_text=seg.get("translated_text")
                )
                for seg in analyzed_lyrics
            ]
            
            # Compute emotion summary
            emotion_summary = AudioEmotionSummary(
                **compute_emotion_summary(analyzed_lyrics)
            )
            
        except Exception as e:
            logger.error(f"Transcription/NLP failed: {e}", exc_info=True)
            # Continue without transcription
    
    # Enhanced section detection (using lyrics if available)
    sections_enhanced = detect_sections_enhanced(
        basic_response.frames,
        basic_response.beats,
        lyric_segments if lyric_segments else None
    )
    
    # Stem separation (optional, can be slow)
    has_stems = False
    if run_stems:
        try:
            logger.info(f"Separating stems for {audio_id}...")
            stems = separate_stems(file_path, audio_id)
            has_stems = len(stems) > 0
        except Exception as e:
            logger.warning(f"Stem separation failed: {e}")
    
    # Create extended response
    # Ensure defaults for optional fields
    if lyric_segments is None:
        lyric_segments = []
    if emotion_summary is None:
        emotion_summary = AudioEmotionSummary(
            overall_sentiment=0.0,
            overall_emotion="neutral",
            arousal=0.0,
            valence=0.0
        )
    
    extended_response = ExtendedAudioAnalysisResponse(
        audio_id=basic_response.audio_id,
        duration=basic_response.duration,
        bpm=basic_response.bpm,
        beats=basic_response.beats,
        frames=basic_response.frames,
        lyrics=lyric_segments,
        sections=sections_enhanced,
        emotion_summary=emotion_summary,
        has_stems=has_stems,
        detected_language=detected_language
    )
    
    # Save extended analysis
    analysis_path = analysis_output_path(audio_id)
    with open(analysis_path, "w") as f:
        json.dump(extended_response.model_dump(), f, indent=2)
    
    return extended_response


def detect_sections_enhanced(frames, beats, lyrics):
    """
    Enhanced section detection using frames, beats, and lyrics.
    Returns SectionInfo with energy and emotion.
    """
    if not frames:
        return []
    
    # Extract energy over time
    energy_values = [f.energy for f in frames]
    times = [f.time for f in frames]
    duration = times[-1] if times else 0
    
    # Smooth energy
    energy_smooth = np.convolve(energy_values, np.ones(10)/10, mode='same')
    energy_mean = np.mean(energy_smooth)
    energy_std = np.std(energy_smooth)
    
    # Thresholds
    high_threshold = energy_mean + energy_std * 0.5
    low_threshold = energy_mean - energy_std * 0.5
    
    # Analyze lyrics density
    lyric_density = np.zeros(len(times))
    if lyrics:
        for lyric in lyrics:
            start_idx = np.searchsorted(times, lyric.start)
            end_idx = np.searchsorted(times, lyric.end)
            lyric_density[start_idx:end_idx] += 1
    
    sections = []
    current_section = "intro"
    section_start = 0.0
    
    window_size = max(1, len(energy_smooth) // 20)
    
    for i in range(0, len(energy_smooth), window_size):
        window_energy = np.mean(energy_smooth[i:min(i+window_size, len(energy_smooth))])
        window_lyric_density = np.mean(lyric_density[i:min(i+window_size, len(lyric_density))])
        t = times[i] if i < len(times) else duration
        
        new_section = None
        
        # Determine section type
        if window_energy > high_threshold * 1.2:
            new_section = "drop"
        elif window_energy > high_threshold:
            if window_lyric_density > 0.5:
                new_section = "chorus"
            else:
                new_section = "drop"
        elif window_energy < low_threshold:
            if window_lyric_density > 0.3:
                new_section = "verse"
            else:
                new_section = "intro" if i < len(energy_smooth) // 4 else "bridge"
        else:
            if window_lyric_density > 0.4:
                new_section = "verse"
            else:
                new_section = "bridge"
        
        if new_section and new_section != current_section:
            if section_start < t - 2.0:  # Minimum section length
                section_energy = np.mean(energy_smooth[
                    int(np.searchsorted(times, section_start)):
                    int(np.searchsorted(times, t))
                ])
                
                # Determine emotion for section
                section_emotion = None
                if lyrics:
                    section_lyrics = [l for l in lyrics if section_start <= l.start < t]
                    if section_lyrics:
                        emotions = [l.emotion for l in section_lyrics]
                        from collections import Counter
                        section_emotion = Counter(emotions).most_common(1)[0][0] if emotions else None
                
                sections.append(SectionInfo(
                    start=section_start,
                    end=t,
                    type=current_section,
                    energy=float(section_energy),
                    emotion=section_emotion
                ))
                section_start = t
                current_section = new_section
    
    # Add final section
    if section_start < duration:
        section_energy = np.mean(energy_smooth[
            int(np.searchsorted(times, section_start)):
        ])
        section_emotion = None
        if lyrics:
            section_lyrics = [l for l in lyrics if l.start >= section_start]
            if section_lyrics:
                emotions = [l.emotion for l in section_lyrics]
                from collections import Counter
                section_emotion = Counter(emotions).most_common(1)[0][0] if emotions else None
        
        sections.append(SectionInfo(
            start=section_start,
            end=duration,
            type=current_section,
            energy=float(section_energy),
            emotion=section_emotion
        ))
    
    # Ensure we have at least an intro
    if not sections or sections[0].start > 1.0:
        sections.insert(0, SectionInfo(
            start=0.0,
            end=sections[0].start if sections else duration,
            type="intro",
            energy=0.3,
            emotion=None
        ))
    
    return sections


def detect_sections(y, sr, duration, energy, times):
    """Detect song sections based on energy and tempo changes."""
    sections = []
    
    # Simple section detection based on energy patterns
    # In production, you'd use more sophisticated methods
    
    # Find energy peaks and valleys
    energy_smooth = np.convolve(energy, np.ones(10)/10, mode='same')
    energy_mean = np.mean(energy_smooth)
    energy_std = np.std(energy_smooth)
    
    # Thresholds
    high_threshold = energy_mean + energy_std * 0.5
    low_threshold = energy_mean - energy_std * 0.5
    
    current_section = "intro"
    section_start = 0.0
    
    window_size = int(duration / 20)  # Check every 5% of song
    
    for i in range(0, len(energy_smooth), window_size):
        window_energy = np.mean(energy_smooth[i:min(i+window_size, len(energy_smooth))])
        t = times[i] if i < len(times) else duration
        
        new_section = None
        
        if window_energy > high_threshold:
            if current_section != "chorus" and current_section != "drop":
                new_section = "chorus"
        elif window_energy < low_threshold:
            if current_section != "verse" and current_section != "intro":
                new_section = "verse"
        elif window_energy > high_threshold * 1.2:
            new_section = "drop"
        
        if new_section and new_section != current_section:
            if section_start < t - 2.0:  # Minimum section length
                sections.append(Section(
                    start=section_start,
                    end=t,
                    type=current_section
                ))
                section_start = t
                current_section = new_section
    
    # Add final section
    if section_start < duration:
        sections.append(Section(
            start=section_start,
            end=duration,
            type=current_section
        ))
    
    # Ensure we have at least an intro
    if not sections or sections[0].start > 1.0:
        sections.insert(0, Section(start=0.0, end=sections[0].start if sections else duration, type="intro"))
    
    return sections


def load_lyrics(file_path: str, audio_id: str) -> list:
    """Load lyrics from .lrc file if available."""
    audio_path = Path(file_path)
    lrc_path = audio_path.parent / f"{audio_id}.lrc"
    
    if not lrc_path.exists():
        # Try with original filename
        lrc_path = audio_path.with_suffix('.lrc')
    
    if not lrc_path.exists():
        return None
    
    lyrics = []
    
    try:
        with open(lrc_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Parse LRC format: [mm:ss.xx]text
        pattern = r'\[(\d{2}):(\d{2})\.(\d{2})\](.+)'
        
        for line in content.split('\n'):
            match = re.match(pattern, line.strip())
            if match:
                minutes = int(match.group(1))
                seconds = int(match.group(2))
                centiseconds = int(match.group(3))
                text = match.group(4).strip()
                
                time = minutes * 60 + seconds + centiseconds / 100.0
                
                # Simple sentiment analysis (very basic)
                sentiment = analyze_sentiment(text)
                lyric_energy = min(len(text) / 50.0, 1.0)  # Longer text = more energy
                
                lyrics.append(LyricEntry(
                    time=time,
                    text=text,
                    sentiment=sentiment,
                    energy=lyric_energy
                ))
    except Exception as e:
        print(f"Error loading lyrics: {e}")
        return None
    
    return lyrics if lyrics else None


def analyze_sentiment(text: str) -> float:
    """Simple sentiment analysis. Returns -1 (negative) to 1 (positive)."""
    # Very basic keyword-based sentiment
    positive_words = ['love', 'happy', 'joy', 'great', 'wonderful', 'beautiful', 'amazing', 'good', 'yes']
    negative_words = ['hate', 'sad', 'pain', 'bad', 'terrible', 'awful', 'no', 'never', 'cry']
    
    text_lower = text.lower()
    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)
    
    if positive_count + negative_count == 0:
        return 0.0
    
    sentiment = (positive_count - negative_count) / (positive_count + negative_count)
    return max(-1.0, min(1.0, sentiment))


def load_analysis(audio_id: str) -> AudioAnalysisResponse:
    """Load saved analysis from disk."""
    analysis_path = analysis_output_path(audio_id)
    if not analysis_path.exists():
        raise FileNotFoundError(f"Analysis for audio_id {audio_id} not found")
    
    with open(analysis_path, "r") as f:
        data = json.load(f)
    
    return AudioAnalysisResponse(**data)


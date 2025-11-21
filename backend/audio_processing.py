"""
Audio processing: source separation, EQ, noise reduction, reverb, mixing.
Uses demucs for source separation and librosa/scipy for processing.
"""
import librosa
import numpy as np
import soundfile as sf
from pathlib import Path
from typing import Dict, Optional, Tuple
import logging
import noisereduce as nr
from scipy import signal
from config import STEMS_DIR, PROCESSED_AUDIO_DIR, DEMUCS_MODEL
import subprocess
import os

logger = logging.getLogger(__name__)


def separate_stems(audio_path: str, audio_id: str) -> Dict[str, str]:
    """
    Separate audio into stems using demucs.
    
    Returns:
        Dict with paths to stems: {"vocals": path1, "bass": path2, "drums": path3, "other": path4}
    """
    try:
        # Create output directory for stems
        stems_output_dir = STEMS_DIR / audio_id
        stems_output_dir.mkdir(parents=True, exist_ok=True)
        
        # Run demucs via command line (more reliable than Python API)
        logger.info(f"Separating stems for {audio_id} using demucs...")
        
        # Use demucs command line
        cmd = [
            "python", "-m", "demucs.separate",
            "--out", str(stems_output_dir),
            "--name", DEMUCS_MODEL,
            audio_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600  # 10 minute timeout
        )
        
        if result.returncode != 0:
            logger.error(f"Demucs separation failed: {result.stderr}")
            raise RuntimeError(f"Stem separation failed: {result.stderr}")
        
        # Demucs creates: stems/{model}/{filename}/vocals.wav, etc.
        # Find the output file
        model_output_dir = stems_output_dir / DEMUCS_MODEL / Path(audio_path).stem
        
        stems = {}
        for stem_name in ["vocals", "bass", "drums", "other"]:
            stem_path = model_output_dir / f"{stem_name}.wav"
            if stem_path.exists():
                stems[stem_name] = str(stem_path)
            else:
                logger.warning(f"Stem {stem_name} not found at {stem_path}")
        
        if not stems:
            raise RuntimeError("No stems were generated")
        
        logger.info(f"Successfully separated {len(stems)} stems")
        return stems
        
    except FileNotFoundError:
        logger.warning("Demucs not found. Falling back to simple separation.")
        return _simple_separation(audio_path, audio_id)
    except Exception as e:
        logger.error(f"Stem separation error: {e}")
        return _simple_separation(audio_path, audio_id)


def _simple_separation(audio_path: str, audio_id: str) -> Dict[str, str]:
    """
    Fallback: simple frequency-based separation (not as good as demucs).
    """
    logger.info("Using simple frequency-based separation")
    
    y, sr = librosa.load(audio_path, sr=None, mono=False)
    if y.ndim == 1:
        y = np.array([y, y])  # Make stereo
    
    # Simple frequency splitting
    S = librosa.stft(y[0], n_fft=2048, hop_length=512)
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    
    # Define bands
    bass_idx = np.where((freqs >= 20) & (freqs < 250))[0]
    mid_idx = np.where((freqs >= 250) & (freqs < 4000))[0]
    treble_idx = np.where((freqs >= 4000))[0]
    
    # Create stems (simplified)
    stems_output_dir = STEMS_DIR / audio_id
    stems_output_dir.mkdir(parents=True, exist_ok=True)
    
    stems = {}
    
    # Vocals: mid-high frequencies
    S_vocals = S.copy()
    S_vocals[bass_idx, :] *= 0.1
    y_vocals = librosa.istft(S_vocals, hop_length=512)
    vocals_path = stems_output_dir / "vocals.wav"
    sf.write(str(vocals_path), y_vocals, sr)
    stems["vocals"] = str(vocals_path)
    
    # Background: everything else
    S_bg = S.copy()
    S_bg[mid_idx, :] *= 0.3
    S_bg[treble_idx, :] *= 0.3
    y_bg = librosa.istft(S_bg, hop_length=512)
    bg_path = stems_output_dir / "other.wav"
    sf.write(str(bg_path), y_bg, sr)
    stems["other"] = str(bg_path)
    
    return stems


def apply_eq(y: np.ndarray, sr: int, low_gain_db: float, mid_gain_db: float, high_gain_db: float) -> np.ndarray:
    """
    Apply 3-band EQ to audio.
    
    Args:
        y: Audio signal
        sr: Sample rate
        low_gain_db: Gain for low frequencies (20-250 Hz) in dB
        mid_gain_db: Gain for mid frequencies (250-4000 Hz) in dB
        high_gain_db: Gain for high frequencies (4000+ Hz) in dB
    
    Returns:
        EQ'd audio signal
    """
    if low_gain_db == 0 and mid_gain_db == 0 and high_gain_db == 0:
        return y
    
    # Design filters
    # Low shelf filter
    if low_gain_db != 0:
        low_shelf = signal.iirfilter(
            2, 250 / (sr / 2), btype='low', ftype='butter', output='sos'
        )
        y = signal.sosfiltfilt(low_shelf, y)
        y = y * (10 ** (low_gain_db / 20))
    
    # Mid band (bandpass + gain)
    if mid_gain_db != 0:
        mid_band = signal.iirfilter(
            4, [250 / (sr / 2), 4000 / (sr / 2)], btype='band', ftype='butter', output='sos'
        )
        y_mid = signal.sosfiltfilt(mid_band, y)
        y = y + y_mid * (10 ** (mid_gain_db / 20) - 1)
    
    # High shelf filter
    if high_gain_db != 0:
        high_shelf = signal.iirfilter(
            2, 4000 / (sr / 2), btype='high', ftype='butter', output='sos'
        )
        y_high = signal.sosfiltfilt(high_shelf, y)
        y = y + y_high * (10 ** (high_gain_db / 20) - 1)
    
    return y


def apply_reverb(y: np.ndarray, sr: int, amount: float) -> np.ndarray:
    """
    Apply simple reverb using convolution with impulse response.
    
    Args:
        y: Audio signal
        sr: Sample rate
        amount: Reverb amount (0..1)
    
    Returns:
        Audio with reverb
    """
    if amount == 0:
        return y
    
    # Create simple impulse response (exponential decay)
    ir_length = int(0.5 * sr)  # 0.5 second reverb
    t = np.arange(ir_length) / sr
    ir = np.exp(-t * 5) * np.sin(2 * np.pi * 1000 * t)  # Decaying sine
    ir = ir / np.max(np.abs(ir))
    
    # Convolve
    y_reverb = signal.convolve(y, ir * amount, mode='same')
    
    # Mix dry and wet
    output = y + y_reverb * amount
    return output / (1 + amount)  # Normalize


def normalize_lufs(y: np.ndarray, sr: int, target_lufs: float = -14.0) -> np.ndarray:
    """
    Normalize audio to target LUFS using pyloudnorm.
    Falls back to simple peak normalization if pyloudnorm fails.
    """
    try:
        import pyloudnorm as pyln
        meter = pyln.Meter(sr)
        loudness = meter.integrated_loudness(y)
        
        if not np.isnan(loudness):
            gain_db = target_lufs - loudness
            gain_linear = 10 ** (gain_db / 20)
            y_normalized = y * gain_linear
            return y_normalized
    except Exception as e:
        logger.warning(f"LUFS normalization failed: {e}. Using peak normalization.")
    
    # Fallback: peak normalization
    peak = np.max(np.abs(y))
    if peak > 0:
        target_peak = 0.95
        y_normalized = y * (target_peak / peak)
        return y_normalized
    
    return y


def apply_audio_processing(
    audio_path: str,
    stems: Optional[Dict[str, str]],
    params,
    output_audio_id: str
) -> str:
    """
    Apply audio processing: noise reduction, EQ, mixing, reverb, normalization.
    
    Args:
        audio_path: Path to original audio
        stems: Dict of stem paths (from separate_stems)
        params: AudioProcessingParams
        output_audio_id: ID for output processed audio file
    
    Returns:
        Path to processed audio file
    """
    logger.info(f"Processing audio with params: {params}")
    
    # Load original audio
    y_original, sr = librosa.load(audio_path, sr=None, mono=False)
    if y_original.ndim == 1:
        y_original = np.array([y_original, y_original])
    
    # Mix stems if available
    if stems and params.use_processed:
        y_processed = _mix_stems(stems, sr, params)
    else:
        # Use original audio
        y_processed = y_original[0] if y_original.ndim == 2 else y_original
    
    # Convert to mono for processing
    if y_processed.ndim > 1:
        y_processed = np.mean(y_processed, axis=0)
    
    # Noise reduction
    if params.noise_reduction_strength > 0:
        logger.info("Applying noise reduction...")
        y_processed = nr.reduce_noise(
            y=y_processed,
            sr=sr,
            stationary=False,
            prop_decrease=params.noise_reduction_strength
        )
    
    # EQ
    if params.low_gain_db != 0 or params.mid_gain_db != 0 or params.high_gain_db != 0:
        logger.info("Applying EQ...")
        y_processed = apply_eq(
            y_processed, sr,
            params.low_gain_db,
            params.mid_gain_db,
            params.high_gain_db
        )
    
    # Reverb
    if params.reverb_amount > 0:
        logger.info("Applying reverb...")
        y_processed = apply_reverb(y_processed, sr, params.reverb_amount)
    
    # Normalization
    if params.normalize_lufs is not None:
        logger.info("Normalizing loudness...")
        y_processed = normalize_lufs(y_processed, sr, params.normalize_lufs)
    
    # Save processed audio
    output_dir = PROCESSED_AUDIO_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{output_audio_id}.wav"
    
    sf.write(str(output_path), y_processed, sr)
    logger.info(f"Processed audio saved to {output_path}")
    
    return str(output_path)


def _mix_stems(stems: Dict[str, str], sr: int, params) -> np.ndarray:
    """
    Mix stems with gain settings.
    
    Returns:
        Mixed audio signal
    """
    mixed = None
    
    # Load and mix vocals
    if "vocals" in stems:
        y_vocals, _ = librosa.load(stems["vocals"], sr=sr, mono=True)
        gain_vocals = 10 ** (params.vocal_gain_db / 20)
        if mixed is None:
            mixed = y_vocals * gain_vocals
        else:
            # Align lengths
            min_len = min(len(mixed), len(y_vocals))
            mixed[:min_len] += y_vocals[:min_len] * gain_vocals
    
    # Load and mix background/other stems
    background_stems = ["bass", "drums", "other"]
    for stem_name in background_stems:
        if stem_name in stems:
            y_stem, _ = librosa.load(stems[stem_name], sr=sr, mono=True)
            gain_bg = 10 ** (params.background_gain_db / 20)
            if mixed is None:
                mixed = y_stem * gain_bg
            else:
                min_len = min(len(mixed), len(y_stem))
                mixed[:min_len] += y_stem[:min_len] * gain_bg
    
    if mixed is None:
        raise ValueError("No stems available for mixing")
    
    return mixed


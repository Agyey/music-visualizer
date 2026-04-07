import numpy as np
import subprocess
import shutil
from dataclasses import dataclass
from typing import Dict, Tuple, Optional
import math

from models import AudioAnalysisResponse, ExtendedAudioAnalysisResponse, RenderRequest
from config import FPS

# Locate FFmpeg once at import time
FFMPEG_BIN = shutil.which("ffmpeg")


@dataclass
class VisualStateAtTime:
    """Visual state at a specific time point."""
    time: float
    bass: float
    mid: float
    treble: float
    energy: float
    beat_pulse: float
    current_section: str = "intro"
    lyric_sentiment: float = 0.0
    lyric_energy: float = 0.0


def interpolate_features(analysis: AudioAnalysisResponse, t: float) -> Dict[str, float]:
    """Interpolate frame features at time t."""
    frames = analysis.frames
    if not frames:
        return {"bass": 0.0, "mid": 0.0, "treble": 0.0, "energy": 0.0}

    if t <= frames[0].time:
        f = frames[0]
        return {"bass": f.bass, "mid": f.mid, "treble": f.treble, "energy": f.energy}

    if t >= frames[-1].time:
        f = frames[-1]
        return {"bass": f.bass, "mid": f.mid, "treble": f.treble, "energy": f.energy}

    for i in range(len(frames) - 1):
        if frames[i].time <= t <= frames[i + 1].time:
            f0, f1 = frames[i], frames[i + 1]
            alpha = (t - f0.time) / (f1.time - f0.time) if f1.time > f0.time else 0.0
            return {
                "bass": f0.bass + alpha * (f1.bass - f0.bass),
                "mid": f0.mid + alpha * (f1.mid - f0.mid),
                "treble": f0.treble + alpha * (f1.treble - f0.treble),
                "energy": f0.energy + alpha * (f1.energy - f0.energy),
            }

    return {"bass": 0.0, "mid": 0.0, "treble": 0.0, "energy": 0.0}


def get_beat_pulse(analysis: AudioAnalysisResponse, t: float, window: float = 0.06) -> float:
    """Get beat pulse strength at time t (0..1), decays after beat."""
    pulse = 0.0
    for beat in analysis.beats:
        dt = abs(t - beat.time)
        if dt < window:
            strength = beat.strength * (1.0 - dt / window)
            pulse = max(pulse, strength)
    return pulse


def get_current_section(analysis: AudioAnalysisResponse, t: float) -> str:
    """Get current section type at time t."""
    if hasattr(analysis, 'sections') and analysis.sections:
        for section in analysis.sections:
            if hasattr(section, 'start') and hasattr(section, 'end'):
                if section.start <= t <= section.end:
                    return getattr(section, 'type', 'intro')
    return "intro"


def get_visual_state(analysis: AudioAnalysisResponse, t: float) -> VisualStateAtTime:
    """Get complete visual state at time t."""
    feat = interpolate_features(analysis, t)
    pulse = get_beat_pulse(analysis, t)
    section = get_current_section(analysis, t)

    sentiment = 0.0
    lyric_energy = feat["energy"]

    if isinstance(analysis, ExtendedAudioAnalysisResponse) and analysis.lyrics:
        for lyric in analysis.lyrics:
            if lyric.start <= t <= lyric.end:
                sentiment = lyric.sentiment
                lyric_energy = lyric.intensity
                break

    return VisualStateAtTime(
        time=t,
        bass=feat["bass"],
        mid=feat["mid"],
        treble=feat["treble"],
        energy=feat["energy"],
        beat_pulse=pulse,
        current_section=section,
        lyric_sentiment=sentiment,
        lyric_energy=lyric_energy
    )


def hsv_to_rgb(h: float, s: float, v: float) -> Tuple[int, int, int]:
    """Convert HSV to RGB (0-255). h in [0,360], s,v in [0,1]."""
    h = h % 360
    c = v * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = v - c

    if 0 <= h < 60:
        r, g, b = c, x, 0
    elif 60 <= h < 120:
        r, g, b = x, c, 0
    elif 120 <= h < 180:
        r, g, b = 0, c, x
    elif 180 <= h < 240:
        r, g, b = 0, x, c
    elif 240 <= h < 300:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x

    return (int((r + m) * 255), int((g + m) * 255), int((b + m) * 255))


# ── Vectorized frame generators (NumPy, no PIL pixel loops) ──

def draw_geometric_frame(
    state: VisualStateAtTime, width: int, height: int, t: float
) -> np.ndarray:
    """Draw geometric frame using NumPy operations."""
    frame = np.full((height, width, 3), [5, 6, 10], dtype=np.uint8)

    cx, cy = width / 2, height / 2
    min_dim = min(width, height)
    pulse_mult = 1.0 + state.beat_pulse * 0.3

    # Frequency bars (vectorized)
    bar_count = 64
    h_max = min_dim * 0.5 * pulse_mult
    bar_w = max(1, int(min_dim * 0.008))
    spacing = min_dim * 0.012

    indices = np.arange(bar_count)
    x_offsets = (indices - bar_count / 2 + 0.5) * (bar_w + spacing) + cx

    bass_c = np.where(indices < bar_count * 0.3, state.bass, state.bass * 0.3)
    mid_c = np.where((indices >= bar_count * 0.3) & (indices < bar_count * 0.7), state.mid, state.mid * 0.5)
    treble_c = np.where(indices >= bar_count * 0.7, state.treble, state.treble * 0.3)

    base_heights = h_max * (bass_c + mid_c + treble_c) / 3
    jitter = np.sin(indices * 0.8 + t * 3) * state.treble * 0.15
    bar_heights = base_heights * (1.0 + jitter)

    edge_factor = 1.0 - (np.abs(indices - bar_count / 2) / (bar_count / 2)) ** 1.8 * 0.5
    bar_heights *= edge_factor

    for i in range(bar_count):
        bh = int(bar_heights[i])
        if bh < 1:
            continue
        x_left = int(x_offsets[i] - bar_w / 2)
        x_right = x_left + bar_w
        if x_left < 0 or x_right >= width:
            continue

        y_top = max(0, int(cy - bh / 2))
        y_bot = min(height, int(cy + bh / 2))

        hue = (20 + (i / bar_count) * 60 + state.treble * 40) % 360
        color = hsv_to_rgb(hue, 0.85 + state.lyric_energy * 0.15, 0.6 + state.energy * 0.35)
        frame[y_top:y_bot, x_left:x_right] = color

    # Concentric rings
    y_grid, x_grid = np.ogrid[:height, :width]
    dx = x_grid - cx
    dy = y_grid - cy
    dist = np.sqrt(dx * dx + dy * dy)

    for layer in range(6):
        layer_scale = 0.7 + (layer / 6) * 0.6
        radius = min_dim * (0.15 + 0.2 * state.bass) * pulse_mult * layer_scale
        ring_mask = np.abs(dist - radius) < 1.5

        hue = (30 + state.lyric_sentiment * 60 + layer * 15 + state.treble * 50) % 360
        color = hsv_to_rgb(hue, 0.9, 0.65 + state.bass * 0.3)
        frame[ring_mask] = color

    return frame


def draw_psychedelic_frame(
    state: VisualStateAtTime, width: int, height: int, t: float
) -> np.ndarray:
    """Draw psychedelic frame using fully vectorized NumPy (no pixel loops)."""
    cx, cy = width / 2, height / 2
    min_dim = min(width, height)

    y_grid, x_grid = np.mgrid[:height, :width]
    dx = (x_grid - cx).astype(np.float32)
    dy = (y_grid - cy).astype(np.float32)
    dist = np.sqrt(dx * dx + dy * dy) / (min_dim / 2)
    angle = np.arctan2(dy, dx)

    # Swirling distortion
    swirl = state.mid * 2
    angle_mod = angle + swirl * dist + t * 0.5

    # HSV computation (vectorized)
    hue = (angle_mod * (180 / np.pi) + t * 50 + state.lyric_sentiment * 60) % 360
    hue = (hue + state.treble * 40) % 360
    sat = np.full_like(dist, 0.9 + state.energy * 0.1)
    val = np.clip(0.4 + dist * 0.4 + state.bass * 0.3 + state.beat_pulse * 0.3, 0, 1)

    # Mask outside unit circle to dark
    outside = dist > 1.0
    val[outside] = 0.02

    # Vectorized HSV->RGB
    h_sector = (hue / 60.0).astype(np.float32) % 6
    c = val * sat
    x_col = c * (1 - np.abs(h_sector % 2 - 1))
    m = val - c

    sector = h_sector.astype(np.int32) % 6
    r = np.where(sector == 0, c, np.where(sector == 1, x_col, np.where(sector == 2, 0,
        np.where(sector == 3, 0, np.where(sector == 4, x_col, c)))))
    g = np.where(sector == 0, x_col, np.where(sector == 1, c, np.where(sector == 2, c,
        np.where(sector == 3, x_col, np.where(sector == 4, 0, 0)))))
    b = np.where(sector == 0, 0, np.where(sector == 1, 0, np.where(sector == 2, x_col,
        np.where(sector == 3, c, np.where(sector == 4, c, x_col)))))

    frame = np.stack([
        np.clip((r + m) * 255, 0, 255).astype(np.uint8),
        np.clip((g + m) * 255, 0, 255).astype(np.uint8),
        np.clip((b + m) * 255, 0, 255).astype(np.uint8),
    ], axis=-1)

    # Add concentric distorted rings
    for i in range(8):
        ring_r = 0.1 * (i + 1) * (1.0 + state.bass * 0.5 + state.beat_pulse * 0.2)
        distortion = np.sin(angle * 5 + t * 2) * state.treble * ring_r * 0.1
        ring_mask = np.abs(dist - ring_r - distortion / (min_dim / 2)) < 0.008
        ring_hue = (30 + i * 30 + state.lyric_sentiment * 60 + t * 20) % 360
        ring_color = hsv_to_rgb(ring_hue, 0.9, 0.7)
        frame[ring_mask] = ring_color

    return frame


def draw_particle_frame(
    state: VisualStateAtTime, width: int, height: int,
    positions: np.ndarray, velocities: np.ndarray, lives: np.ndarray,
    sizes: np.ndarray, t: float
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Draw particle frame using vectorized NumPy. Returns (frame, positions, velocities, lives, sizes)."""
    frame = np.full((height, width, 3), [5, 6, 10], dtype=np.uint8)
    n = positions.shape[0]
    cx, cy = width / 2, height / 2

    # Vectorized physics
    dx = positions[:, 0] - cx
    dy = positions[:, 1] - cy
    dist = np.sqrt(dx * dx + dy * dy)
    dist = np.maximum(dist, 1.0)

    # Bass pushes outward
    force = state.bass * 0.08
    velocities[:, 0] += (dx / dist) * force
    velocities[:, 1] += (dy / dist) * force

    # Treble jitter
    jitter = state.treble * 0.5
    velocities += (np.random.random((n, 2)).astype(np.float32) - 0.5) * jitter

    # Mid swirl
    swirl = state.mid * 0.03
    cos_s, sin_s = math.cos(swirl), math.sin(swirl)
    vx_old = velocities[:, 0].copy()
    velocities[:, 0] = vx_old * cos_s - velocities[:, 1] * sin_s
    velocities[:, 1] = vx_old * sin_s + velocities[:, 1] * cos_s

    # Damping + update
    velocities *= 0.98
    positions += velocities * (60.0 / FPS)

    # Wrap boundaries
    positions[:, 0] = positions[:, 0] % width
    positions[:, 1] = positions[:, 1] % height

    # Life decay + respawn
    lives -= 0.002
    dead = lives <= 0
    lives[dead] = 1.0
    positions[dead, 0] = np.random.random(dead.sum()).astype(np.float32) * width
    positions[dead, 1] = np.random.random(dead.sum()).astype(np.float32) * height

    # Draw particles (scatter into frame)
    hue_base = state.energy * 20 + t * 5
    color = hsv_to_rgb(
        (hue_base + 200) % 360,
        0.85 + state.lyric_energy * 0.15,
        0.65 + state.energy * 0.25 + state.beat_pulse * 0.2
    )

    px = np.clip(positions[:, 0].astype(np.int32), 0, width - 1)
    py = np.clip(positions[:, 1].astype(np.int32), 0, height - 1)

    # Scale brightness by life
    bright = (lives * 255).astype(np.uint8)
    scaled_color = np.stack([
        (bright * color[0] // 255),
        (bright * color[1] // 255),
        (bright * color[2] // 255),
    ], axis=-1).astype(np.uint8)

    # Use maximum blend to avoid overwrite artifacts
    for i in range(n):
        frame[py[i], px[i]] = np.maximum(frame[py[i], px[i]], scaled_color[i])

    return frame, positions, velocities, lives, sizes


# ── FFmpeg pipe renderer ──

class FFmpegPipeRenderer:
    """Pipes raw RGB frames to FFmpeg for encoding. No moviepy dependency."""

    def __init__(self, output_path: str, width: int, height: int, fps: int,
                 audio_path: str, crf: int = 20):
        if not FFMPEG_BIN:
            raise RuntimeError("FFmpeg not found. Install FFmpeg to render video.")

        self.width = width
        self.height = height
        self.process: Optional[subprocess.Popen] = None

        cmd = [
            FFMPEG_BIN, "-y",
            # Video input: raw RGB frames from stdin
            "-f", "rawvideo",
            "-pix_fmt", "rgb24",
            "-s", f"{width}x{height}",
            "-r", str(fps),
            "-i", "pipe:0",
            # Audio input
            "-i", audio_path,
            # Map streams
            "-map", "0:v", "-map", "1:a",
            # Video encoding
            "-vcodec", "libx264",
            "-pix_fmt", "yuv420p",
            "-crf", str(crf),
            "-preset", "medium",
            # Audio encoding
            "-acodec", "aac",
            "-b:a", "192k",
            # Shortest stream determines length
            "-shortest",
            output_path,
        ]

        self.process = subprocess.Popen(
            cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE
        )

    def write_frame(self, frame: np.ndarray) -> None:
        """Write a single RGB frame (H, W, 3) uint8 to the pipe."""
        if self.process and self.process.stdin:
            self.process.stdin.write(frame.tobytes())

    def close(self) -> str:
        """Close pipe and wait for FFmpeg to finish. Returns stderr output."""
        stderr_output = b""
        if self.process:
            if self.process.stdin:
                self.process.stdin.close()
            stderr_output = self.process.stderr.read() if self.process.stderr else b""
            self.process.wait()
            if self.process.returncode != 0:
                raise RuntimeError(
                    f"FFmpeg exited with code {self.process.returncode}: "
                    f"{stderr_output.decode('utf-8', errors='replace')[-500:]}"
                )
        return stderr_output.decode("utf-8", errors="replace")


def render_visual_clip(
    analysis: AudioAnalysisResponse,
    audio_path: str,
    width: int,
    height: int,
    render_req: RenderRequest,
    output_path: str
) -> None:
    """Render an MP4 video by piping frames to FFmpeg."""
    width = width if width % 2 == 0 else width - 1
    height = height if height % 2 == 0 else height - 1

    crf = 18 if render_req.resolution_preset == "4K" else 20

    renderer = FFmpegPipeRenderer(
        output_path=output_path,
        width=width,
        height=height,
        fps=FPS,
        audio_path=audio_path,
        crf=crf,
    )

    mode = render_req.visual_mode
    total_frames = int(analysis.duration * FPS)

    # Initialize particle state if needed
    particle_count = 5000
    positions = velocities = lives = part_sizes = None
    if mode == "particles":
        positions = np.random.random((particle_count, 2)).astype(np.float32)
        positions[:, 0] *= width
        positions[:, 1] *= height
        angles = np.random.random(particle_count).astype(np.float32) * 2 * np.pi
        speeds = np.random.random(particle_count).astype(np.float32) * 2 + 0.5
        velocities = np.stack([np.cos(angles) * speeds, np.sin(angles) * speeds], axis=-1)
        lives = np.random.random(particle_count).astype(np.float32)
        part_sizes = np.random.random(particle_count).astype(np.float32) * 3 + 1

    try:
        for frame_idx in range(total_frames):
            t = frame_idx / FPS
            state = get_visual_state(analysis, t)

            if mode == "geometric":
                frame = draw_geometric_frame(state, width, height, t)
            elif mode == "psychedelic":
                frame = draw_psychedelic_frame(state, width, height, t)
            elif mode == "particles":
                frame, positions, velocities, lives, part_sizes = draw_particle_frame(
                    state, width, height, positions, velocities, lives, part_sizes, t
                )
            else:
                frame = draw_geometric_frame(state, width, height, t)

            renderer.write_frame(frame)
    finally:
        renderer.close()

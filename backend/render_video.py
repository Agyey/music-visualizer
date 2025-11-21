import numpy as np
from PIL import Image, ImageDraw
from moviepy.editor import AudioFileClip, VideoClip
from models import AudioAnalysisResponse, RenderRequest
from config import FPS
from storage import get_audio_path, video_output_path


def interpolate_features(analysis: AudioAnalysisResponse, t: float) -> dict:
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
    
    # Find neighboring frames
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
    """Get beat pulse strength at time t (0..1)."""
    pulse = 0.0
    for beat in analysis.beats:
        dt = abs(t - beat.time)
        if dt < window:
            # Decay pulse strength based on distance from beat
            strength = beat.strength * (1.0 - dt / window)
            pulse = max(pulse, strength)
    return pulse


def draw_geometric_frame(
    t: float,
    analysis: AudioAnalysisResponse,
    width: int,
    height: int,
    render_req: RenderRequest
) -> np.ndarray:
    """Draw a single frame of the geometric visualizer."""
    # Interpolate features
    feat = interpolate_features(analysis, t)
    pulse = get_beat_pulse(analysis, t)
    
    # Configuration
    bar_count = render_req.bar_count or 24
    line_thickness = render_req.line_thickness or 2.0
    glow_strength = render_req.glow_strength or 1.0
    color_mode = render_req.color_mode or "default"
    
    # Create image
    img = Image.new("RGB", (width, height), (5, 6, 10))
    draw = ImageDraw.Draw(img)
    
    cx, cy = width / 2, height / 2
    min_dim = min(width, height)
    
    # Beat pulse multiplier
    pulse_mult = 1.0 + 0.15 * pulse
    
    # Concentric circles
    outer_radius = min_dim * (0.30 + 0.10 * feat["bass"]) * pulse_mult
    inner_radius = 0.6 * outer_radius
    
    # Draw 2-3 circles
    num_circles = 3
    for i in range(num_circles):
        r = inner_radius + (outer_radius - inner_radius) * (i / (num_circles - 1)) if num_circles > 1 else outer_radius
        thickness = int(line_thickness * (1.0 + feat["energy"] * 0.5))
        
        # Color based on mode
        if color_mode == "default":
            # Orange-gold gradient
            intensity = int(200 + 55 * feat["bass"])
            color = (intensity, int(intensity * 0.7), int(intensity * 0.3))
        else:
            color = (255, 200, 100)  # fallback
        
        # Draw circle outline (simulate by drawing multiple circles)
        for offset in range(-thickness // 2, thickness // 2 + 1):
            draw.ellipse(
                [cx - r - offset, cy - r - offset, cx + r + offset, cy + r + offset],
                outline=color,
                width=1
            )
    
    # Vertical bar cluster
    h_max = min_dim * 0.35 * pulse_mult
    bar_width = min_dim * 0.015
    spacing = min_dim * 0.02
    
    for i in range(bar_count):
        # Position
        x_offset = (i - bar_count / 2 + 0.5) * (bar_width + spacing)
        x = cx + x_offset
        
        # Height with jitter
        base_height = h_max * (0.3 + 0.7 * feat["mid"])
        jitter = np.sin(i * 0.5 + t * 2) * feat["treble"] * 0.1
        bar_h = base_height * (1.0 + jitter)
        
        # Taper near edges (diamond shape)
        edge_factor = 1.0 - abs(i - bar_count / 2) / (bar_count / 2) * 0.3
        bar_h *= edge_factor
        
        # Color gradient
        if color_mode == "default":
            tip_intensity = int(255 * (0.7 + 0.3 * feat["treble"]))
            base_intensity = int(200 * (0.5 + 0.5 * feat["mid"]))
            color = (tip_intensity, int(base_intensity * 0.8), int(base_intensity * 0.4))
        else:
            color = (255, 150, 50)
        
        # Draw bar
        y_top = cy - bar_h / 2
        y_bottom = cy + bar_h / 2
        draw.rectangle(
            [x - bar_width / 2, y_top, x + bar_width / 2, y_bottom],
            fill=color
        )
    
    # HUD lines & crosshair
    hud_color = (0, 200, 255) if color_mode == "default" else (100, 200, 255)
    rotation_angle = 0.4 * t + feat["treble"] * 0.2
    
    # Rotate endpoints
    line_length = min_dim * 0.4
    cos_a, sin_a = np.cos(rotation_angle), np.sin(rotation_angle)
    
    # Horizontal line
    hx1 = cx - line_length * cos_a
    hy1 = cy - line_length * sin_a
    hx2 = cx + line_length * cos_a
    hy2 = cy + line_length * sin_a
    draw.line([hx1, hy1, hx2, hy2], fill=hud_color, width=int(line_thickness))
    
    # Vertical line
    vx1 = cx + line_length * sin_a
    vy1 = cy - line_length * cos_a
    vx2 = cx - line_length * sin_a
    vy2 = cy + line_length * cos_a
    draw.line([vx1, vy1, vx2, vy2], fill=hud_color, width=int(line_thickness))
    
    # Convert to numpy array
    return np.array(img)


def render_visual_clip(
    analysis: AudioAnalysisResponse,
    audio_path: str,
    width: int,
    height: int,
    render_req: RenderRequest,
    output_path: str
) -> None:
    """Render an MP4 video matching the geometric visualizer style using moviepy."""
    # Ensure even dimensions
    width = width if width % 2 == 0 else width + 1
    height = height if height % 2 == 0 else height + 1
    
    # Load audio
    audio_clip = AudioFileClip(str(audio_path))
    
    # Create video clip
    def make_frame(t: float) -> np.ndarray:
        return draw_geometric_frame(t, analysis, width, height, render_req)
    
    video_clip = VideoClip(make_frame, duration=analysis.duration)
    video_clip = video_clip.set_audio(audio_clip)
    video_clip = video_clip.set_fps(FPS)
    
    # Write video
    video_clip.write_videofile(
        str(output_path),
        codec="libx264",
        audio_codec="aac",
        fps=FPS,
        preset="medium",
        threads=4
    )
    
    # Cleanup
    audio_clip.close()
    video_clip.close()


import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from moviepy.editor import AudioFileClip, VideoClip
from dataclasses import dataclass
from typing import Dict, List, Tuple
import math

from models import AudioAnalysisResponse, ExtendedAudioAnalysisResponse, RenderRequest
from config import FPS
from storage import get_audio_path, video_output_path


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
            elif hasattr(section, 'start') and hasattr(section, 'end'):
                if section.start <= t <= section.end:
                    return getattr(section, 'type', 'intro')
    return "intro"


def get_visual_state(analysis: AudioAnalysisResponse, t: float) -> VisualStateAtTime:
    """Get complete visual state at time t."""
    feat = interpolate_features(analysis, t)
    pulse = get_beat_pulse(analysis, t)
    section = get_current_section(analysis, t)
    
    # Get sentiment/energy from extended analysis if available
    sentiment = 0.0
    lyric_energy = feat["energy"]
    
    if isinstance(analysis, ExtendedAudioAnalysisResponse) and analysis.lyrics:
        # Find current lyric segment
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
    """Convert HSV to RGB (0-255)."""
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


def draw_geometric_frame(
    state: VisualStateAtTime,
    width: int,
    height: int,
    t: float
) -> np.ndarray:
    """Draw enhanced geometric frame matching frontend visuals."""
    img = Image.new("RGB", (width, height), (5, 6, 10))
    draw = ImageDraw.Draw(img)
    
    cx, cy = width / 2, height / 2
    min_dim = min(width, height)
    
    # Shape morphing based on section
    shape_phase = t * 0.5
    morph = math.sin(shape_phase) * 0.5 + 0.5
    pulse_mult = 1.0 + state.beat_pulse * 0.3
    
    # Determine shape type
    shape_type = state.current_section
    if shape_type not in ["intro", "verse", "chorus", "drop", "bridge"]:
        shape_type = "intro"
    
    # Draw multiple layers for depth
    num_layers = 6
    for layer in range(num_layers):
        layer_scale = 0.7 + (layer / num_layers) * 0.6
        outer_radius = min_dim * (0.15 + 0.2 * state.bass) * pulse_mult * layer_scale
        inner_radius = outer_radius * (0.3 + state.mid * 0.4)
        thickness = int(2 + state.energy * 6 + layer * 0.5)
        
        # Enhanced neon color
        base_hue = 30 + state.lyric_sentiment * 60 + layer * 15
        hue = (base_hue + state.treble * 50 + math.sin(t * 0.4 + layer) * 15) % 360
        saturation = 0.9 + state.lyric_energy * 0.1
        lightness = 0.65 + state.bass * 0.3
        
        color = hsv_to_rgb(hue, saturation, lightness)
        
        # Draw shape based on type
        if shape_type == "intro" or (shape_type == "verse" and morph < 0.3):
            # Circle
            for offset in range(-thickness // 2, thickness // 2 + 1):
                draw.ellipse(
                    [cx - outer_radius - offset, cy - outer_radius - offset,
                     cx + outer_radius + offset, cy + outer_radius + offset],
                    outline=color, width=1
                )
        elif shape_type == "verse" or shape_type == "chorus":
            # Polygon
            sides = int(3 + 6 * (0.5 + morph * 0.5))
            angle_step = 2 * math.pi / sides
            rotation = t * 0.3 + state.treble * 0.2
            points = []
            for i in range(sides + 1):
                angle = rotation + i * angle_step
                r = outer_radius if i % 2 == 0 else inner_radius
                x = cx + math.cos(angle) * r
                y = cy + math.sin(angle) * r
                points.append((x, y))
            if len(points) > 2:
                draw.polygon(points, outline=color, width=thickness)
        elif shape_type == "drop":
            # Mandala/star
            segments = 8 + layer * 2
            segment_angle = 2 * math.pi / segments
            for seg in range(segments):
                base_angle = t * 0.3 + seg * segment_angle
                local_radius = outer_radius * (0.4 + state.energy * 0.6)
                petal_points = []
                for i in range(21):
                    t_petal = i / 20
                    angle = base_angle + t_petal * segment_angle * 0.8
                    r = local_radius * math.sin(t_petal * math.pi)
                    x = cx + math.cos(angle) * r
                    y = cy + math.sin(angle) * r
                    petal_points.append((x, y))
                if len(petal_points) > 2:
                    draw.polygon(petal_points, outline=color, width=thickness)
    
    # Enhanced frequency bars
    bar_count = 64
    h_max = min_dim * 0.5 * pulse_mult
    bar_width = min_dim * 0.008
    spacing = min_dim * 0.012
    
    for i in range(bar_count):
        x_offset = (i - bar_count / 2 + 0.5) * (bar_width + spacing)
        x = cx + x_offset
        
        bass_contrib = state.bass * (1 if i < bar_count * 0.3 else 0.3)
        mid_contrib = state.mid * (1 if bar_count * 0.3 <= i < bar_count * 0.7 else 0.5)
        treble_contrib = state.treble * (1 if i >= bar_count * 0.7 else 0.3)
        
        base_height = h_max * (bass_contrib + mid_contrib + treble_contrib) / 3
        jitter = math.sin(i * 0.8 + t * 3) * state.treble * 0.15
        bar_h = base_height * (1.0 + jitter)
        
        edge_factor = 1.0 - (abs(i - bar_count / 2) / (bar_count / 2)) ** 1.8 * 0.5
        bar_h *= edge_factor
        
        hue = (20 + (i / bar_count) * 60 + state.treble * 40) % 360
        saturation = 0.85 + state.lyric_energy * 0.15
        lightness = 0.6 + state.energy * 0.35
        
        color = hsv_to_rgb(hue, saturation, lightness)
        
        y_top = cy - bar_h / 2
        y_bottom = cy + bar_h / 2
        draw.rectangle(
            [x - bar_width / 2, y_top, x + bar_width / 2, y_bottom],
            fill=color
        )
    
    return np.array(img)


class ParticleSystem:
    """Simple particle system for rendering."""
    def __init__(self, width: int, height: int, count: int = 5000):
        self.width = width
        self.height = height
        self.count = count
        self.particles = []
        self.init_particles()
    
    def init_particles(self):
        """Initialize particles."""
        for _ in range(self.count):
            angle = np.random.random() * 2 * math.pi
            speed = np.random.random() * 2 + 0.5
            self.particles.append({
                'x': np.random.random() * self.width,
                'y': np.random.random() * self.height,
                'vx': math.cos(angle) * speed,
                'vy': math.sin(angle) * speed,
                'life': np.random.random(),
                'size': np.random.random() * 3 + 1,
                'hue': np.random.random()
            })
    
    def update(self, state: VisualStateAtTime, dt: float):
        """Update particle positions."""
        center_x, center_y = self.width / 2, self.height / 2
        
        for p in self.particles:
            # Bass pushes outward
            dx = p['x'] - center_x
            dy = p['y'] - center_y
            dist = math.sqrt(dx * dx + dy * dy) if (dx != 0 or dy != 0) else 1
            if dist > 0:
                force = state.bass * 0.08
                p['vx'] += (dx / dist) * force
                p['vy'] += (dy / dist) * force
            
            # Treble jitter
            jitter = state.treble * 0.5
            p['vx'] += (np.random.random() - 0.5) * jitter
            p['vy'] += (np.random.random() - 0.5) * jitter
            
            # Mid swirling
            swirl = state.mid * 0.03
            vx_old = p['vx']
            p['vx'] = p['vx'] * math.cos(swirl) - p['vy'] * math.sin(swirl)
            p['vy'] = vx_old * math.sin(swirl) + p['vy'] * math.cos(swirl)
            
            # Damping
            p['vx'] *= 0.98
            p['vy'] *= 0.98
            
            # Update position
            p['x'] += p['vx'] * dt * 60  # Scale for FPS
            p['y'] += p['vy'] * dt * 60
            
            # Wrap boundaries
            if p['x'] < 0:
                p['x'] = self.width
            if p['x'] > self.width:
                p['x'] = 0
            if p['y'] < 0:
                p['y'] = self.height
            if p['y'] > self.height:
                p['y'] = 0
            
            # Update life
            p['life'] -= 0.002
            if p['life'] <= 0:
                p['life'] = 1.0
                p['x'] = np.random.random() * self.width
                p['y'] = np.random.random() * self.height


def draw_particle_frame(
    state: VisualStateAtTime,
    width: int,
    height: int,
    particle_system: ParticleSystem,
    t: float
) -> np.ndarray:
    """Draw particle frame with theme-based colors."""
    img = Image.new("RGB", (width, height), (5, 6, 10))
    draw = ImageDraw.Draw(img)
    
    # Update particles
    dt = 1.0 / FPS
    particle_system.update(state, dt)
    
    # Theme-based color palette
    theme_hue = 0
    if state.current_section == "intro":
        theme_hue = 200 + state.lyric_sentiment * 40
    elif state.current_section == "verse":
        theme_hue = 30 + state.lyric_sentiment * 60
    elif state.current_section == "chorus":
        theme_hue = 300 + state.lyric_sentiment * 40
    elif state.current_section == "drop":
        theme_hue = 0 + state.energy * 60
    elif state.current_section == "bridge":
        theme_hue = 180 + state.lyric_sentiment * 30
    else:
        theme_hue = 240 + state.energy * 60
    
    # Draw particles with trails
    for p in particle_system.particles:
        alpha = p['life']
        energy_variation = (state.energy * 20 + t * 5) % 360
        hue = (theme_hue + energy_variation * 0.2) % 360
        saturation = 0.85 + state.lyric_energy * 0.15
        lightness = 0.65 + state.energy * 0.25 + state.beat_pulse * 0.2
        
        color = hsv_to_rgb(hue, saturation, lightness)
        
        # Draw particle with glow
        size = int(p['size'] * (1.0 + state.energy * 0.5))
        for i in range(size):
            glow_alpha = alpha * (1.0 - i / size)
            glow_color = tuple(int(c * glow_alpha) for c in color)
            draw.ellipse(
                [p['x'] - size + i, p['y'] - size + i,
                 p['x'] + size - i, p['y'] + size - i],
                fill=glow_color
            )
    
    return np.array(img)


def draw_psychedelic_frame(
    state: VisualStateAtTime,
    width: int,
    height: int,
    t: float
) -> np.ndarray:
    """Draw psychedelic frame with fractal-like patterns."""
    img = Image.new("RGB", (width, height), (5, 6, 10))
    draw = ImageDraw.Draw(img)
    
    cx, cy = width / 2, height / 2
    min_dim = min(width, height)
    
    # Create radial gradient base
    for y in range(0, height, 2):  # Step for performance
        for x in range(0, width, 2):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy) / (min_dim / 2)
            
            if dist > 1.0:
                continue
            
            # Fractal-like pattern
            angle = math.atan2(dy, dx)
            radius = dist * min_dim / 2
            
            # Swirling distortion
            swirl = state.mid * 2
            angle += swirl * (radius / min_dim) + t * 0.5
            
            # Color based on position and audio
            base_hue = (angle * 180 / math.pi + t * 50 + state.lyric_sentiment * 60) % 360
            hue = base_hue + state.treble * 40
            saturation = 0.9 + state.energy * 0.1
            lightness = 0.4 + dist * 0.4 + state.bass * 0.3 + state.beat_pulse * 0.3
            
            color = hsv_to_rgb(hue, saturation, lightness)
            
            # Draw pixel
            draw.rectangle([x, y, x + 2, y + 2], fill=color)
    
    # Add concentric circles with distortion
    num_rings = 8
    for i in range(num_rings):
        r = min_dim * 0.1 * (i + 1) * (1.0 + state.bass * 0.5 + state.beat_pulse * 0.2)
        
        # Distorted circle
        points = []
        num_points = 100
        for j in range(num_points + 1):
            angle = j * 2 * math.pi / num_points
            distortion = math.sin(angle * 5 + t * 2) * state.treble * r * 0.1
            x = cx + math.cos(angle) * (r + distortion)
            y = cy + math.sin(angle) * (r + distortion)
            points.append((x, y))
        
        hue = (30 + i * 30 + state.lyric_sentiment * 60 + t * 20) % 360
        color = hsv_to_rgb(hue, 0.9, 0.7)
        draw.polygon(points, outline=color, width=2)
    
    return np.array(img)


def make_frame_factory(
    analysis: AudioAnalysisResponse,
    width: int,
    height: int,
    mode: str
):
    """Create frame factory function for VideoClip."""
    particle_system = None
    if mode == "particles":
        particle_system = ParticleSystem(width, height, count=5000)
    
    def make_frame(t: float) -> np.ndarray:
        state = get_visual_state(analysis, t)
        
        if mode == "geometric":
            return draw_geometric_frame(state, width, height, t)
        elif mode == "particles":
            return draw_particle_frame(state, width, height, particle_system, t)
        elif mode == "psychedelic":
            return draw_psychedelic_frame(state, width, height, t)
        else:
            # Fallback to geometric
            return draw_geometric_frame(state, width, height, t)
    
    return make_frame


def render_visual_clip(
    analysis: AudioAnalysisResponse,
    audio_path: str,
    width: int,
    height: int,
    render_req: RenderRequest,
    output_path: str
) -> None:
    """Render an MP4 video matching the visualizer style."""
    # Ensure even dimensions
    width = width if width % 2 == 0 else width - 1
    height = height if height % 2 == 0 else height - 1
    
    # Load audio
    audio_clip = AudioFileClip(str(audio_path))
    
    # Create frame factory
    make_frame = make_frame_factory(analysis, width, height, render_req.visual_mode)
    
    # Create video clip
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
        threads=4,
        bitrate="8000k" if render_req.resolution_preset == "4K" else "5000k"
    )
    
    # Cleanup
    audio_clip.close()
    video_clip.close()

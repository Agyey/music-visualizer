import { ExtendedAudioAnalysisResponse } from '../types/timeline';

interface Features {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  beatPulse: number;
  lyricIntensity: number;
  lyricSentiment: number;
  lyricEnergy: number;
  currentSection: string;
}

interface FloatingParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  alpha: number;
  life: number;
}

/**
 * Premium Geometric Renderer — Neon Sacred Geometry
 *
 * Features:
 * - Deep space gradient backgrounds with reactive nebula tints
 * - Multi-layer sacred geometry with parallax depth
 * - Floating accent particles with trails
 * - Pulsing energy rings synchronized to beats
 * - Smooth shape morphing with bezier interpolation
 * - Chromatic bloom and advanced glow compositing
 * - Section-aware color palettes
 */
export class GeometricRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentTime: number = 0;
  private features: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro"
  };

  // Parameters
  public shapeMorphSpeed: number = 0.5;
  public polygonComplexity: number = 6;
  public rotationSpeed: number = 1.0;

  // Internal state
  private shapePhase: number = 0;
  private rotationAngle: number = 0;
  private cameraShake: { x: number; y: number } = { x: 0, y: 0 };
  private beatFlash: number = 0;
  private prevBeatPulse: number = 0;

  // Smoothed features for fluid animation
  private smoothedFeatures: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro"
  };

  private smoothingFactor: number = 0.12;

  // Floating particles for ambient depth
  private particles: FloatingParticle[] = [];
  private maxParticles = 80;

  // Color palette state — smoothly shifting
  private paletteHue: number = 0;
  private targetPaletteHue: number = 0;

  // Beat ring effects
  private beatRings: Array<{ radius: number; alpha: number; hue: number }> = [];

  constructor(canvas: HTMLCanvasElement, _analysis: ExtendedAudioAnalysisResponse | null) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.initParticles();
  }

  private initParticles() {
    this.particles = [];
    const w = this.canvas.width || 1920;
    const h = this.canvas.height || 1080;
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(this.createParticle(w, h));
    }
  }

  private createParticle(w: number, h: number): FloatingParticle {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 2.5 + 0.5,
      hue: Math.random() * 360,
      alpha: Math.random() * 0.5 + 0.2,
      life: Math.random(),
    };
  }

  updateAnalysis(_analysis: ExtendedAudioAnalysisResponse | null) {
    // Analysis stored in engine, not needed here
  }

  updateFeatures(time: number, features: Features) {
    this.currentTime = time;

    // Smooth interpolation of features for fluid motion
    this.smoothedFeatures.bass = this.lerp(this.smoothedFeatures.bass, features.bass, this.smoothingFactor);
    this.smoothedFeatures.mid = this.lerp(this.smoothedFeatures.mid, features.mid, this.smoothingFactor);
    this.smoothedFeatures.treble = this.lerp(this.smoothedFeatures.treble, features.treble, this.smoothingFactor);
    this.smoothedFeatures.energy = this.lerp(this.smoothedFeatures.energy, features.energy, this.smoothingFactor);
    this.smoothedFeatures.beatPulse = this.lerp(this.smoothedFeatures.beatPulse, features.beatPulse, 0.25);
    this.smoothedFeatures.lyricIntensity = this.lerp(this.smoothedFeatures.lyricIntensity, features.lyricIntensity, this.smoothingFactor);
    this.smoothedFeatures.lyricSentiment = this.lerp(this.smoothedFeatures.lyricSentiment, features.lyricSentiment, this.smoothingFactor);
    this.smoothedFeatures.lyricEnergy = this.lerp(this.smoothedFeatures.lyricEnergy, features.lyricEnergy, this.smoothingFactor);
    this.smoothedFeatures.currentSection = features.currentSection;

    // Ensure minimum baseline so visuals are always alive even with no audio
    const idlePulse = Math.sin(time * 0.8) * 0.5 + 0.5; // 0 → 1 slow pulse
    this.smoothedFeatures.bass = Math.max(this.smoothedFeatures.bass, 0.15 + idlePulse * 0.15);
    this.smoothedFeatures.mid = Math.max(this.smoothedFeatures.mid, 0.2 + idlePulse * 0.1);
    this.smoothedFeatures.treble = Math.max(this.smoothedFeatures.treble, 0.12 + Math.sin(time * 1.2) * 0.08);
    this.smoothedFeatures.energy = Math.max(this.smoothedFeatures.energy, 0.2 + idlePulse * 0.15);

    this.features = this.smoothedFeatures;

    // Smooth phase updates — always animate
    const phaseSpeed = 0.008 + this.features.energy * 0.015;
    this.shapePhase += this.shapeMorphSpeed * phaseSpeed;

    // Smooth rotation — always rotate
    const rotSpeed = 0.015 + this.features.treble * 0.025;
    this.rotationAngle += this.rotationSpeed * rotSpeed;

    // Smooth camera shake
    const targetShake = this.features.beatPulse * 4;
    this.cameraShake.x = this.lerp(this.cameraShake.x, (Math.random() - 0.5) * targetShake, 0.15);
    this.cameraShake.y = this.lerp(this.cameraShake.y, (Math.random() - 0.5) * targetShake, 0.15);

    // Beat flash detection
    if (features.beatPulse > 0.5 && this.prevBeatPulse < 0.5) {
      this.beatFlash = 1.0;
      // Spawn a beat ring
      this.beatRings.push({
        radius: 10,
        alpha: 1.0,
        hue: this.paletteHue + Math.random() * 60,
      });
    }
    this.prevBeatPulse = features.beatPulse;
    this.beatFlash *= 0.92;

    // Section-aware color palette
    this.updatePalette();
    this.paletteHue = this.lerp(this.paletteHue, this.targetPaletteHue, 0.02);
  }

  private updatePalette() {
    switch (this.features.currentSection) {
      case "intro":
        this.targetPaletteHue = 220; // Cool blue
        break;
      case "verse":
        this.targetPaletteHue = 280; // Purple
        break;
      case "chorus":
        this.targetPaletteHue = 330; // Magenta/Pink
        break;
      case "drop":
        this.targetPaletteHue = 15; // Fiery orange-red
        break;
      case "bridge":
        this.targetPaletteHue = 170; // Teal/Cyan
        break;
      case "live":
        this.targetPaletteHue = 260 + Math.sin(this.currentTime * 0.3) * 60; // Animated purple→blue→teal
        break;
      default:
        this.targetPaletteHue = 260; // Default purple
    }
    // Add energy-based hue drift
    this.targetPaletteHue += this.features.energy * 20;
  }

  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.initParticles();
  }

  render(_time: number) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const cx = width / 2 + this.cameraShake.x;
    const cy = height / 2 + this.cameraShake.y;
    const minDim = Math.min(width, height);

    // ═══════════════════════════════════════
    // 1. DEEP SPACE GRADIENT BACKGROUND
    // ═══════════════════════════════════════
    this.drawBackground(width, height, cx, cy, minDim);

    // ═══════════════════════════════════════
    // 2. FLOATING AMBIENT PARTICLES
    // ═══════════════════════════════════════
    this.updateAndDrawParticles(width, height);

    // ═══════════════════════════════════════
    // 3. BEAT EXPANDING RINGS
    // ═══════════════════════════════════════
    this.drawBeatRings(cx, cy);

    // ═══════════════════════════════════════
    // 4. SACRED GEOMETRY — MULTI-LAYER
    // ═══════════════════════════════════════
    const pulseMult = 1.0 + this.features.beatPulse * 0.3;

    // Determine shape type based on section
    let shapeType: 'circle' | 'polygon' | 'spiral' | 'wave' | 'star' | 'mandala' = 'circle';
    switch (this.features.currentSection) {
      case "intro": shapeType = 'circle'; break;
      case "verse": shapeType = 'polygon'; break;
      case "chorus": shapeType = 'spiral'; break;
      case "drop": shapeType = 'mandala'; break;
      case "bridge": shapeType = 'wave'; break;
      default: shapeType = 'star';
    }

    // Draw multiple layers for depth (outer → inner)
    const numLayers = 7;
    for (let layer = 0; layer < numLayers; layer++) {
      const layerOffset = (layer / numLayers) * Math.PI * 2;
      const layerMorph = Math.sin(this.shapePhase + layerOffset) * 0.5 + 0.5;
      this.drawComplexShape(cx, cy, minDim, shapeType, layerMorph, pulseMult, layer, numLayers);
    }

    // ═══════════════════════════════════════
    // 5. FREQUENCY BARS (Spectral)
    // ═══════════════════════════════════════
    this.drawEnhancedBars(cx, cy, minDim, pulseMult);

    // ═══════════════════════════════════════
    // 6. HUD SCANLINE GRID
    // ═══════════════════════════════════════
    this.drawHUDGrid(cx, cy, minDim);

    // ═══════════════════════════════════════
    // 7. ADVANCED BLOOM & POST-FX
    // ═══════════════════════════════════════
    this.addAdvancedGlow(width, height, cx, cy);

    // ═══════════════════════════════════════
    // 8. BEAT FLASH OVERLAY
    // ═══════════════════════════════════════
    if (this.beatFlash > 0.01) {
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.fillStyle = `hsla(${this.paletteHue}, 100%, 90%, ${this.beatFlash * 0.15})`;
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.restore();
    }

    // ═══════════════════════════════════════
    // 9. VIGNETTE
    // ═══════════════════════════════════════
    this.drawVignette(width, height);
  }

  // ─────────────────────────────────────────
  // BACKGROUND: Deep space nebula gradient
  // ─────────────────────────────────────────
  private drawBackground(width: number, height: number, cx: number, cy: number, minDim: number) {
    // Base dark gradient
    const bgGrad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, minDim * 0.9);
    const h = this.paletteHue;
    bgGrad.addColorStop(0, `hsl(${(h + 30) % 360}, 25%, 8%)`);
    bgGrad.addColorStop(0.5, `hsl(${(h + 10) % 360}, 20%, 4%)`);
    bgGrad.addColorStop(1, `hsl(${h % 360}, 15%, 2%)`);
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, 0, width, height);

    // Nebula cloud layers (energy-reactive)
    if (this.features.energy > 0.15) {
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';

      // Primary nebula
      const neb1 = this.ctx.createRadialGradient(
        cx + Math.sin(this.currentTime * 0.2) * minDim * 0.15,
        cy + Math.cos(this.currentTime * 0.15) * minDim * 0.1,
        0,
        cx, cy, minDim * 0.7
      );
      const intensity1 = this.features.energy * 0.08;
      neb1.addColorStop(0, `hsla(${(h + 40) % 360}, 80%, 50%, ${intensity1})`);
      neb1.addColorStop(0.4, `hsla(${(h + 60) % 360}, 60%, 40%, ${intensity1 * 0.5})`);
      neb1.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      this.ctx.fillStyle = neb1;
      this.ctx.fillRect(0, 0, width, height);

      // Secondary nebula — complementary color
      const neb2 = this.ctx.createRadialGradient(
        cx + Math.cos(this.currentTime * 0.18) * minDim * 0.2,
        cy + Math.sin(this.currentTime * 0.22) * minDim * 0.15,
        0,
        cx, cy, minDim * 0.5
      );
      const intensity2 = this.features.bass * 0.06;
      neb2.addColorStop(0, `hsla(${(h + 180) % 360}, 70%, 45%, ${intensity2})`);
      neb2.addColorStop(0.5, `hsla(${(h + 200) % 360}, 50%, 35%, ${intensity2 * 0.4})`);
      neb2.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      this.ctx.fillStyle = neb2;
      this.ctx.fillRect(0, 0, width, height);

      this.ctx.restore();
    }
  }

  // ─────────────────────────────────────────
  // FLOATING PARTICLES
  // ─────────────────────────────────────────
  private updateAndDrawParticles(width: number, height: number) {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';

    for (const p of this.particles) {
      // Update position
      p.x += p.vx + this.features.treble * (Math.random() - 0.5) * 0.8;
      p.y += p.vy + this.features.bass * (Math.random() - 0.5) * 0.5;

      // Wrap
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      // Pulsate with energy
      const pSize = p.size * (1 + this.features.energy * 0.6 + this.features.beatPulse * 0.3);
      const pAlpha = p.alpha * (0.6 + this.features.energy * 0.6);

      // Draw with glow
      const grad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pSize * 3);
      grad.addColorStop(0, `hsla(${(this.paletteHue + p.hue * 0.3) % 360}, 80%, 75%, ${pAlpha})`);
      grad.addColorStop(0.4, `hsla(${(this.paletteHue + p.hue * 0.3 + 20) % 360}, 60%, 60%, ${pAlpha * 0.5})`);
      grad.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, pSize * 3, 0, Math.PI * 2);
      this.ctx.fill();

      // Bright core
      this.ctx.fillStyle = `hsla(${(this.paletteHue + p.hue * 0.3) % 360}, 100%, 90%, ${pAlpha * 0.8})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, pSize * 0.5, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  // ─────────────────────────────────────────
  // BEAT RINGS — expanding shockwaves
  // ─────────────────────────────────────────
  private drawBeatRings(cx: number, cy: number) {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';

    for (let i = this.beatRings.length - 1; i >= 0; i--) {
      const ring = this.beatRings[i];
      ring.radius += 4 + this.features.energy * 3;
      ring.alpha *= 0.97;

      if (ring.alpha < 0.01) {
        this.beatRings.splice(i, 1);
        continue;
      }

      const grad = this.ctx.createRadialGradient(cx, cy, ring.radius - 3, cx, cy, ring.radius + 3);
      grad.addColorStop(0, `hsla(${ring.hue % 360}, 100%, 70%, 0)`);
      grad.addColorStop(0.5, `hsla(${ring.hue % 360}, 100%, 80%, ${ring.alpha * 0.6})`);
      grad.addColorStop(1, `hsla(${ring.hue % 360}, 100%, 70%, 0)`);

      this.ctx.strokeStyle = `hsla(${ring.hue % 360}, 100%, 80%, ${ring.alpha})`;
      this.ctx.lineWidth = 2 + ring.alpha * 3;
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = `hsla(${ring.hue % 360}, 100%, 70%, ${ring.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Cap ring count
    if (this.beatRings.length > 15) {
      this.beatRings.splice(0, this.beatRings.length - 15);
    }

    this.ctx.restore();
  }

  // ─────────────────────────────────────────
  // SACRED GEOMETRY SHAPES
  // ─────────────────────────────────────────
  private drawComplexShape(
    cx: number, cy: number, minDim: number,
    shapeType: string, morph: number, pulseMult: number,
    layer: number, totalLayers: number
  ) {
    const layerScale = 0.7 + (layer / totalLayers) * 0.6;
    const outerRadius = minDim * (0.15 + 0.2 * this.features.bass) * pulseMult * layerScale;
    const innerRadius = outerRadius * (0.3 + this.features.mid * 0.4);
    const thickness = 1.5 + this.features.energy * 5 + layer * 0.3;

    // Multi-color neon with per-layer hue offset
    const baseHue = this.paletteHue + layer * 18;
    const hue = baseHue + this.features.treble * 40 + Math.sin(this.currentTime * 0.4 + layer) * 10;
    const saturation = 85 + this.features.lyricEnergy * 15;
    const lightness = 60 + this.features.bass * 25 + layer * 3;

    // Layer opacity fades for outer layers
    const layerAlpha = 0.4 + (1 - layer / totalLayers) * 0.6;

    this.ctx.save();
    this.ctx.globalAlpha = layerAlpha;

    // Neon glow effect
    this.ctx.strokeStyle = `hsl(${hue % 360}, ${saturation}%, ${lightness}%)`;
    this.ctx.lineWidth = thickness;
    this.ctx.shadowBlur = 25 + this.features.energy * 40 + layer * 3;
    this.ctx.shadowColor = `hsl(${hue % 360}, ${saturation}%, ${Math.min(100, lightness + 25)}%)`;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Draw shape based on type
    if (shapeType === 'circle' || (shapeType === 'polygon' && morph < 0.3)) {
      this.drawCircle(cx, cy, outerRadius);
    } else if (shapeType === 'polygon' || (shapeType === 'star' && morph > 0.5)) {
      const sides = Math.floor(3 + this.polygonComplexity * (0.5 + morph * 0.5));
      this.drawPolygon(cx, cy, outerRadius, sides);
    } else if (shapeType === 'star') {
      const points = 5 + Math.floor(this.polygonComplexity * 0.5);
      this.drawStar(cx, cy, outerRadius, innerRadius, points);
    } else if (shapeType === 'spiral') {
      this.drawSpiral(cx, cy, outerRadius, layer);
    } else if (shapeType === 'wave') {
      this.drawWave(cx, cy, outerRadius, layer);
    } else if (shapeType === 'mandala') {
      this.drawMandala(cx, cy, outerRadius, layer);
    }

    this.ctx.restore();
    this.ctx.shadowBlur = 0;
  }

  private drawCircle(cx: number, cy: number, radius: number) {
    // Outer ring
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.stroke();

    // Inner ring with different rotation
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    this.ctx.stroke();

    // Cross-hair accent
    for (let i = 0; i < 4; i++) {
      const angle = this.rotationAngle * 0.5 + (i * Math.PI / 2);
      const innerR = radius * 0.6;
      const outerR = radius * 0.9;
      this.ctx.beginPath();
      this.ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
      this.ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
      this.ctx.stroke();
    }
  }

  private drawPolygon(cx: number, cy: number, radius: number, sides: number) {
    this.ctx.beginPath();
    const angleStep = (Math.PI * 2) / sides;
    for (let i = 0; i <= sides; i++) {
      const angle = this.rotationAngle + i * angleStep;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // Inner polygon (rotated)
    if (sides > 3) {
      this.ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const angle = -this.rotationAngle * 0.7 + i * angleStep;
        const r = radius * 0.5;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();

      // Connecting lines (sacred geometry style)
      this.ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const outerAngle = this.rotationAngle + i * angleStep;
        const innerAngle = -this.rotationAngle * 0.7 + ((i + 1) % sides) * angleStep;
        this.ctx.moveTo(cx + Math.cos(outerAngle) * radius, cy + Math.sin(outerAngle) * radius);
        this.ctx.lineTo(cx + Math.cos(innerAngle) * radius * 0.5, cy + Math.sin(innerAngle) * radius * 0.5);
      }
      this.ctx.stroke();
    }
  }

  private drawStar(cx: number, cy: number, outerRadius: number, innerRadius: number, points: number) {
    this.ctx.beginPath();
    const angleStep = (Math.PI * 2) / points;
    for (let i = 0; i <= points * 2; i++) {
      const angle = this.rotationAngle + i * angleStep * 0.5;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();
  }

  private drawSpiral(cx: number, cy: number, radius: number, layer: number) {
    const turns = 4 + this.features.mid * 3 + layer * 0.5;
    const points = 150;

    // Double helix spiral
    for (let helix = 0; helix < 2; helix++) {
      this.ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const t = i / points;
        const angle = this.rotationAngle + helix * Math.PI + t * turns * Math.PI * 2;
        const r = radius * t * (0.3 + this.features.bass * 0.7);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();
    }
  }

  private drawWave(cx: number, cy: number, radius: number, layer: number) {
    this.ctx.beginPath();
    const waves = 6 + this.features.treble * 10 + layer;
    const points = 300;
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const angle = t * Math.PI * 2;
      const waveOffset = Math.sin(angle * waves + this.currentTime * 3 + layer) * radius * (0.15 + this.features.mid * 0.25);
      const r = radius + waveOffset;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();
  }

  private drawMandala(cx: number, cy: number, radius: number, layer: number) {
    const segments = 8 + layer * 2;
    const segmentAngle = (Math.PI * 2) / segments;

    for (let seg = 0; seg < segments; seg++) {
      const baseAngle = this.rotationAngle + seg * segmentAngle;
      const localRadius = radius * (0.4 + this.features.energy * 0.6);

      // Petal-like shape
      this.ctx.beginPath();
      const petalPoints = 20;
      for (let i = 0; i <= petalPoints; i++) {
        const t = i / petalPoints;
        const angle = baseAngle + t * segmentAngle * 0.8;
        const r = localRadius * Math.sin(t * Math.PI);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();
    }
  }

  // ─────────────────────────────────────────
  // FREQUENCY BARS — Spectral Display
  // ─────────────────────────────────────────
  private drawEnhancedBars(cx: number, cy: number, minDim: number, pulseMult: number) {
    const barCount = 64;
    const hMax = minDim * 0.5 * pulseMult;
    const barWidth = minDim * 0.007;
    const spacing = minDim * 0.011;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < barCount; i++) {
      const xOffset = (i - barCount / 2 + 0.5) * (barWidth + spacing);
      const x = cx + xOffset;

      // Multi-frequency contribution
      const bassContribution = this.features.bass * (i < barCount * 0.3 ? 1 : 0.3);
      const midContribution = this.features.mid * (i >= barCount * 0.3 && i < barCount * 0.7 ? 1 : 0.5);
      const trebleContribution = this.features.treble * (i >= barCount * 0.7 ? 1 : 0.3);

      const baseHeight = hMax * (bassContribution + midContribution + trebleContribution) / 3;
      const jitter = Math.sin(i * 0.8 + this.currentTime * 3) * this.features.treble * 0.15;
      let barH = baseHeight * (1.0 + jitter);

      // Edge tapering
      const edgeFactor = 1.0 - Math.pow(Math.abs(i - barCount / 2) / (barCount / 2), 1.8) * 0.5;
      barH *= edgeFactor;

      // Palette-coherent gradient
      const hue = this.paletteHue + (i / barCount) * 50;
      const saturation = 85 + this.features.lyricIntensity * 15;
      const lightness = 55 + this.features.energy * 30;

      // Gradient fill
      const yTop = cy - barH / 2;
      const yBottom = cy + barH / 2;
      const gradient = this.ctx.createLinearGradient(x - barWidth / 2, yTop, x - barWidth / 2, yBottom);
      gradient.addColorStop(0, `hsla(${hue % 360}, ${saturation}%, ${lightness + 20}%, 0.9)`);
      gradient.addColorStop(0.5, `hsla(${hue % 360}, ${saturation}%, ${lightness}%, 0.8)`);
      gradient.addColorStop(1, `hsla(${(hue + 30) % 360}, ${saturation}%, ${lightness - 15}%, 0.7)`);

      this.ctx.fillStyle = gradient;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = `hsla(${hue % 360}, ${saturation}%, ${lightness}%, 0.6)`;

      // Rounded bar caps
      const radius = barWidth / 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x - barWidth / 2 + radius, yTop);
      this.ctx.lineTo(x + barWidth / 2 - radius, yTop);
      this.ctx.quadraticCurveTo(x + barWidth / 2, yTop, x + barWidth / 2, yTop + radius);
      this.ctx.lineTo(x + barWidth / 2, yBottom - radius);
      this.ctx.quadraticCurveTo(x + barWidth / 2, yBottom, x + barWidth / 2 - radius, yBottom);
      this.ctx.lineTo(x - barWidth / 2 + radius, yBottom);
      this.ctx.quadraticCurveTo(x - barWidth / 2, yBottom, x - barWidth / 2, yBottom - radius);
      this.ctx.lineTo(x - barWidth / 2, yTop + radius);
      this.ctx.quadraticCurveTo(x - barWidth / 2, yTop, x - barWidth / 2 + radius, yTop);
      this.ctx.fill();
    }

    this.ctx.restore();
    this.ctx.shadowBlur = 0;
  }

  // ─────────────────────────────────────────
  // HUD SCANLINE GRID
  // ─────────────────────────────────────────
  private drawHUDGrid(cx: number, cy: number, minDim: number) {
    const rotAngle = this.rotationAngle * 0.3 + this.features.treble * 0.2;
    const lineLength = minDim * 0.55;
    const gridSize = 8;

    this.ctx.save();
    this.ctx.strokeStyle = `hsla(${(this.paletteHue + 120) % 360}, 60%, 55%, 0.12)`;
    this.ctx.lineWidth = 0.5;

    // Grid lines with palette-tinted color
    for (let i = -gridSize; i <= gridSize; i++) {
      const offset = (i / gridSize) * lineLength;
      const cosA = Math.cos(rotAngle);
      const sinA = Math.sin(rotAngle);

      // Horizontal
      this.ctx.beginPath();
      this.ctx.moveTo(cx - lineLength * cosA + offset * sinA, cy - lineLength * sinA - offset * cosA);
      this.ctx.lineTo(cx + lineLength * cosA + offset * sinA, cy + lineLength * sinA - offset * cosA);
      this.ctx.stroke();

      // Vertical
      this.ctx.beginPath();
      this.ctx.moveTo(cx + lineLength * sinA + offset * cosA, cy - lineLength * cosA + offset * sinA);
      this.ctx.lineTo(cx - lineLength * sinA + offset * cosA, cy + lineLength * cosA + offset * sinA);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  // ─────────────────────────────────────────
  // ADVANCED BLOOM + POST-FX
  // ─────────────────────────────────────────
  private addAdvancedGlow(width: number, height: number, cx: number, cy: number) {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';

    const h = this.paletteHue;
    const glowIntensity = 0.15 + this.features.energy * 0.25;

    // Primary glow — palette hue
    const gradient1 = this.ctx.createRadialGradient(
      cx, cy, 0,
      cx, cy, Math.min(width, height) * 0.6
    );
    gradient1.addColorStop(0, `hsla(${h % 360}, 100%, 75%, ${glowIntensity})`);
    gradient1.addColorStop(0.3, `hsla(${(h + 30) % 360}, 90%, 65%, ${glowIntensity * 0.6})`);
    gradient1.addColorStop(0.6, `hsla(${(h + 60) % 360}, 80%, 55%, ${glowIntensity * 0.3})`);
    gradient1.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
    this.ctx.fillStyle = gradient1;
    this.ctx.fillRect(0, 0, width, height);

    // Secondary glow — complementary accent
    const gradient2 = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) * 0.35);
    gradient2.addColorStop(0, `hsla(${(h + 150) % 360}, 100%, 70%, ${glowIntensity * 0.4})`);
    gradient2.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
    this.ctx.fillStyle = gradient2;
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.restore();

    // Chromatic aberration (treble-driven)
    if (this.features.treble > 0.3) {
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.globalAlpha = this.features.treble * 0.06;
      this.ctx.fillStyle = `hsla(${h % 360}, 100%, 50%, 0.5)`;
      this.ctx.fillRect(2, 0, width, height);
      this.ctx.fillStyle = `hsla(${(h + 180) % 360}, 100%, 50%, 0.5)`;
      this.ctx.fillRect(-2, 0, width, height);
      this.ctx.restore();
    }

    // Bloom overlay on high energy
    if (this.features.energy > 0.55) {
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.globalAlpha = (this.features.energy - 0.55) * 0.2;
      const bloomGrad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) * 0.8);
      bloomGrad.addColorStop(0, `hsla(${h % 360}, 100%, 85%, 1)`);
      bloomGrad.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      this.ctx.fillStyle = bloomGrad;
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.restore();
    }
  }

  // ─────────────────────────────────────────
  // CINEMATIC VIGNETTE
  // ─────────────────────────────────────────
  private drawVignette(width: number, height: number) {
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);

    const grad = this.ctx.createRadialGradient(cx, cy, maxR * 0.35, cx, cy, maxR);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');

    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, width, height);
  }
}

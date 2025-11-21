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
  
  // Smoothed features for fluid animation
  private smoothedFeatures: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro"
  };
  
  private smoothingFactor: number = 0.12;

  constructor(canvas: HTMLCanvasElement, _analysis: ExtendedAudioAnalysisResponse | null) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
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
    
    this.features = this.smoothedFeatures;
    
    // Smooth phase updates
    const phaseSpeed = 0.008 + this.features.energy * 0.015;
    this.shapePhase += this.shapeMorphSpeed * phaseSpeed;
    
    // Smooth rotation
    const rotationSpeed = 0.015 + this.features.treble * 0.025;
    this.rotationAngle += this.rotationSpeed * rotationSpeed;
    
    // Smooth camera shake
    const targetShake = this.features.beatPulse * 4;
    this.cameraShake.x = this.lerp(this.cameraShake.x, (Math.random() - 0.5) * targetShake, 0.15);
    this.cameraShake.y = this.lerp(this.cameraShake.y, (Math.random() - 0.5) * targetShake, 0.15);
  }
  
  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  render(_time: number) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const cx = width / 2 + this.cameraShake.x;
    const cy = height / 2 + this.cameraShake.y;
    const minDim = Math.min(width, height);

    // Clear with dark background
    this.ctx.fillStyle = 'rgb(5, 6, 10)';
    this.ctx.fillRect(0, 0, width, height);

    // Determine shape type based on section with smooth transitions
    let shapeType: 'circle' | 'polygon' | 'spiral' | 'wave' | 'star' | 'mandala' = 'circle';

    switch (this.features.currentSection) {
      case "intro":
        shapeType = 'circle';
        break;
      case "verse":
        shapeType = 'polygon';
        break;
      case "chorus":
        shapeType = 'spiral';
        break;
      case "drop":
        shapeType = 'mandala';
        break;
      case "bridge":
        shapeType = 'wave';
        break;
      default:
        shapeType = 'star';
    }

    // Morph between shapes with multiple layers
    const pulseMult = 1.0 + this.features.beatPulse * 0.3;

    // Draw multiple layers for depth
    const numLayers = 6;
    for (let layer = 0; layer < numLayers; layer++) {
      const layerOffset = (layer / numLayers) * Math.PI * 2;
      const layerMorph = Math.sin(this.shapePhase + layerOffset) * 0.5 + 0.5;
      this.drawComplexShape(cx, cy, minDim, shapeType, layerMorph, pulseMult, layer, numLayers);
    }

    // Draw frequency bars with enhanced visuals
    this.drawEnhancedBars(cx, cy, minDim, pulseMult);

    // Draw HUD grid overlay
    this.drawHUDGrid(cx, cy, minDim);

    // Add advanced glow and bloom effects
    this.addAdvancedGlow();
  }

  private drawComplexShape(
    cx: number, cy: number, minDim: number,
    shapeType: string, morph: number, pulseMult: number,
    layer: number, totalLayers: number
  ) {
    const layerScale = 0.7 + (layer / totalLayers) * 0.6;
    const outerRadius = minDim * (0.15 + 0.2 * this.features.bass) * pulseMult * layerScale;
    const innerRadius = outerRadius * (0.3 + this.features.mid * 0.4);
    const thickness = 2 + this.features.energy * 6 + layer * 0.5;

    // Enhanced neon color with smooth transitions
    const baseHue = 30 + this.features.lyricSentiment * 60 + layer * 15;
    const hue = baseHue + this.features.treble * 50 + Math.sin(this.currentTime * 0.4 + layer) * 15;
    const saturation = 90 + this.features.lyricEnergy * 10;
    const lightness = 65 + this.features.bass * 30;
    
    // Neon glow effect
    this.ctx.strokeStyle = `hsl(${hue % 360}, ${saturation}%, ${lightness}%)`;
    this.ctx.lineWidth = thickness;
    this.ctx.shadowBlur = 30 + this.features.energy * 50 + layer * 5;
    this.ctx.shadowColor = `hsl(${hue % 360}, ${saturation}%, ${Math.min(100, lightness + 30)}%)`;
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

    this.ctx.shadowBlur = 0;
  }

  private drawCircle(cx: number, cy: number, radius: number) {
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Add inner ring
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawPolygon(cx: number, cy: number, radius: number, sides: number) {
    this.ctx.beginPath();
    const angleStep = (Math.PI * 2) / sides;
    for (let i = 0; i <= sides; i++) {
      const angle = this.rotationAngle + i * angleStep;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();
    
    // Add connecting lines for complexity
    if (sides > 3) {
      this.ctx.beginPath();
      for (let i = 0; i < sides; i += 2) {
        const angle1 = this.rotationAngle + i * angleStep;
        const angle2 = this.rotationAngle + ((i + 2) % sides) * angleStep;
        this.ctx.moveTo(cx + Math.cos(angle1) * radius, cy + Math.sin(angle1) * radius);
        this.ctx.lineTo(cx + Math.cos(angle2) * radius, cy + Math.sin(angle2) * radius);
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
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();
  }

  private drawSpiral(cx: number, cy: number, radius: number, layer: number) {
    this.ctx.beginPath();
    const turns = 4 + this.features.mid * 3 + layer * 0.5;
    const points = 150;
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const angle = this.rotationAngle + t * turns * Math.PI * 2;
      const r = radius * t * (0.3 + this.features.bass * 0.7);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();
    
    // Add secondary spiral
    this.ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const angle = this.rotationAngle + Math.PI + t * turns * Math.PI * 2;
      const r = radius * t * (0.3 + this.features.bass * 0.7);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();
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
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();
  }

  private drawMandala(cx: number, cy: number, radius: number, layer: number) {
    const segments = 8 + layer * 2;
    const segmentAngle = (Math.PI * 2) / segments;
    
    for (let seg = 0; seg < segments; seg++) {
      const baseAngle = this.rotationAngle + seg * segmentAngle;
      const localRadius = radius * (0.4 + this.features.energy * 0.6);
      
      // Draw petal-like shape
      this.ctx.beginPath();
      const petalPoints = 20;
      for (let i = 0; i <= petalPoints; i++) {
        const t = i / petalPoints;
        const angle = baseAngle + t * segmentAngle * 0.8;
        const r = localRadius * Math.sin(t * Math.PI);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      this.ctx.stroke();
    }
  }

  private drawEnhancedBars(cx: number, cy: number, minDim: number, pulseMult: number) {
    const barCount = 64;
    const hMax = minDim * 0.5 * pulseMult;
    const barWidth = minDim * 0.008;
    const spacing = minDim * 0.012;

    for (let i = 0; i < barCount; i++) {
      const xOffset = (i - barCount / 2 + 0.5) * (barWidth + spacing);
      const x = cx + xOffset;

      // Multi-frequency analysis
      const bassContribution = this.features.bass * (i < barCount * 0.3 ? 1 : 0.3);
      const midContribution = this.features.mid * (i >= barCount * 0.3 && i < barCount * 0.7 ? 1 : 0.5);
      const trebleContribution = this.features.treble * (i >= barCount * 0.7 ? 1 : 0.3);
      
      const baseHeight = hMax * (bassContribution + midContribution + trebleContribution) / 3;
      const jitter = Math.sin(i * 0.8 + this.currentTime * 3) * this.features.treble * 0.15;
      let barH = baseHeight * (1.0 + jitter);

      // Edge tapering
      const edgeFactor = 1.0 - Math.pow(Math.abs(i - barCount / 2) / (barCount / 2), 1.8) * 0.5;
      barH *= edgeFactor;

      // Rich color gradient
      const hue = 20 + (i / barCount) * 60 + this.features.treble * 40;
      const saturation = 85 + this.features.lyricIntensity * 15;
      const lightness = 60 + this.features.energy * 35;
      
      // Gradient fill
      const gradient = this.ctx.createLinearGradient(x - barWidth / 2, cy - barH / 2, x - barWidth / 2, cy + barH / 2);
      gradient.addColorStop(0, `hsl(${hue}, ${saturation}%, ${lightness + 20}%)`);
      gradient.addColorStop(0.5, `hsl(${hue}, ${saturation}%, ${lightness}%)`);
      gradient.addColorStop(1, `hsl(${hue + 20}, ${saturation}%, ${lightness - 20}%)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

      const yTop = cy - barH / 2;
      const yBottom = cy + barH / 2;
      this.ctx.fillRect(x - barWidth / 2, yTop, barWidth, yBottom - yTop);
    }

    this.ctx.shadowBlur = 0;
  }

  private drawHUDGrid(cx: number, cy: number, minDim: number) {
    const hudColor = 'hsl(180, 70%, 60%)';
    const rotationAngle = this.rotationAngle * 0.3 + this.features.treble * 0.2;
    const lineLength = minDim * 0.5;
    const gridSize = 8;
    
    this.ctx.strokeStyle = hudColor;
    this.ctx.lineWidth = 1;
    this.ctx.globalAlpha = 0.4;

    // Grid lines
    for (let i = -gridSize; i <= gridSize; i++) {
      const offset = (i / gridSize) * lineLength;
      const cosA = Math.cos(rotationAngle);
      const sinA = Math.sin(rotationAngle);
      
      // Horizontal lines
      this.ctx.beginPath();
      this.ctx.moveTo(cx - lineLength * cosA + offset * sinA, cy - lineLength * sinA - offset * cosA);
      this.ctx.lineTo(cx + lineLength * cosA + offset * sinA, cy + lineLength * sinA - offset * cosA);
      this.ctx.stroke();
      
      // Vertical lines
      this.ctx.beginPath();
      this.ctx.moveTo(cx + lineLength * sinA + offset * cosA, cy - lineLength * cosA + offset * sinA);
      this.ctx.lineTo(cx - lineLength * sinA + offset * cosA, cy + lineLength * cosA + offset * sinA);
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1.0;
  }

  private addAdvancedGlow() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    
    // Multi-layer radial glow
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';
    
    const baseHue = 30 + this.features.lyricSentiment * 60;
    const glowIntensity = 0.2 + this.features.energy * 0.3;
    
    // Primary glow
    const gradient1 = this.ctx.createRadialGradient(
      cx, cy, 0,
      cx, cy, Math.min(width, height) * 0.6
    );
    gradient1.addColorStop(0, `hsla(${baseHue}, 100%, 75%, ${glowIntensity})`);
    gradient1.addColorStop(0.4, `hsla(${baseHue + 30}, 90%, 65%, ${glowIntensity * 0.7})`);
    gradient1.addColorStop(0.7, `hsla(${baseHue + 60}, 80%, 55%, ${glowIntensity * 0.4})`);
    gradient1.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
    
    this.ctx.fillStyle = gradient1;
    this.ctx.fillRect(0, 0, width, height);
    
    // Secondary glow for depth
    const gradient2 = this.ctx.createRadialGradient(
      cx, cy, 0,
      cx, cy, Math.min(width, height) * 0.4
    );
    gradient2.addColorStop(0, `hsla(${baseHue + 120}, 100%, 70%, ${glowIntensity * 0.6})`);
    gradient2.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
    
    this.ctx.fillStyle = gradient2;
    this.ctx.fillRect(0, 0, width, height);
    
    this.ctx.restore();
    
    // Chromatic aberration for depth
    if (this.features.treble > 0.3) {
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.globalAlpha = this.features.treble * 0.1;
      
      // Red channel offset
      this.ctx.fillStyle = `hsla(${baseHue}, 100%, 50%, 0.5)`;
      this.ctx.fillRect(2, 0, width, height);
      
      // Blue channel offset
      this.ctx.fillStyle = `hsla(${baseHue + 180}, 100%, 50%, 0.5)`;
      this.ctx.fillRect(-2, 0, width, height);
      
      this.ctx.restore();
    }
    
    // Bloom effect overlay
    if (this.features.energy > 0.6) {
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.globalAlpha = (this.features.energy - 0.6) * 0.3;
      
      const bloomGradient = this.ctx.createRadialGradient(
        cx, cy, 0,
        cx, cy, Math.min(width, height) * 0.8
      );
      bloomGradient.addColorStop(0, `hsla(${baseHue}, 100%, 80%, 1)`);
      bloomGradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      
      this.ctx.fillStyle = bloomGradient;
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.restore();
    }
  }
}

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
  
  private smoothingFactor: number = 0.15; // Lower = smoother but slower response

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
    this.smoothedFeatures.beatPulse = this.lerp(this.smoothedFeatures.beatPulse, features.beatPulse, 0.3); // Faster response for beats
    this.smoothedFeatures.lyricIntensity = this.lerp(this.smoothedFeatures.lyricIntensity, features.lyricIntensity, this.smoothingFactor);
    this.smoothedFeatures.lyricSentiment = this.lerp(this.smoothedFeatures.lyricSentiment, features.lyricSentiment, this.smoothingFactor);
    this.smoothedFeatures.lyricEnergy = this.lerp(this.smoothedFeatures.lyricEnergy, features.lyricEnergy, this.smoothingFactor);
    this.smoothedFeatures.currentSection = features.currentSection;
    
    this.features = this.smoothedFeatures;
    
    // Smooth phase updates
    const phaseSpeed = 0.005 + this.features.energy * 0.01;
    this.shapePhase += this.shapeMorphSpeed * phaseSpeed;
    
    // Smooth rotation
    const rotationSpeed = 0.01 + this.features.treble * 0.02;
    this.rotationAngle += this.rotationSpeed * rotationSpeed;
    
    // Smooth camera shake
    const targetShake = this.features.beatPulse * 3;
    this.cameraShake.x = this.lerp(this.cameraShake.x, (Math.random() - 0.5) * targetShake, 0.2);
    this.cameraShake.y = this.lerp(this.cameraShake.y, (Math.random() - 0.5) * targetShake, 0.2);
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

    // Determine shape type based on section
    let shapeType: 'circle' | 'polygon' | 'spiral' | 'wave' = 'circle';

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
        shapeType = 'wave';
        break;
    }

    // Morph between shapes
    const morph = Math.sin(this.shapePhase) * 0.5 + 0.5;
    const pulseMult = 1.0 + this.features.beatPulse * 0.2;

    // Draw main shape
    this.drawMorphingShape(cx, cy, minDim, shapeType, morph, pulseMult);

    // Draw bars
    this.drawBars(cx, cy, minDim, pulseMult);

    // Draw HUD lines
    this.drawHUDLines(cx, cy, minDim);

    // Add glow effect
    this.addGlowEffect();
  }

  private drawMorphingShape(
    cx: number, cy: number, minDim: number,
    shapeType: string, morph: number, pulseMult: number
  ) {
    const outerRadius = minDim * (0.25 + 0.15 * this.features.bass) * pulseMult;
    const innerRadius = 0.5 * outerRadius;
    const numLayers = 4;

    for (let layer = 0; layer < numLayers; layer++) {
      const layerProgress = layer / (numLayers - 1);
      const radius = innerRadius + (outerRadius - innerRadius) * layerProgress;
      const thickness = 2 + this.features.energy * 4;

      // Enhanced neon color with smooth transitions and animation
      const baseHue = 30 + this.features.lyricSentiment * 60;
      const hue = baseHue + this.features.treble * 40 + Math.sin(this.currentTime * 0.5 + layerProgress) * 10;
      const saturation = 85 + this.features.lyricEnergy * 15;
      const lightness = 60 + this.features.bass * 35;
      const currentEnergy = this.features.energy;
      
      // Neon glow effect with stronger shadow
      this.ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      this.ctx.lineWidth = thickness;
      this.ctx.shadowBlur = 25 + currentEnergy * 40;
      this.ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${Math.min(100, lightness + 25)}%)`;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;

      // Morph between shapes
      if (shapeType === 'circle' || (shapeType === 'polygon' && morph < 0.3)) {
        this.drawCircle(cx, cy, radius);
      } else if (shapeType === 'polygon' || (shapeType === 'circle' && morph > 0.7)) {
        const sides = Math.floor(3 + this.polygonComplexity * morph);
        this.drawPolygon(cx, cy, radius, sides);
      } else if (shapeType === 'spiral') {
        this.drawSpiral(cx, cy, radius, layer);
      } else if (shapeType === 'wave') {
        this.drawWave(cx, cy, radius, layer);
      }
    }

    this.ctx.shadowBlur = 0;
  }

  private drawCircle(cx: number, cy: number, radius: number) {
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
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
  }

  private drawSpiral(cx: number, cy: number, radius: number, _layer: number) {
    this.ctx.beginPath();
    const turns = 3 + this.features.mid * 2;
    const points = 100;
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const angle = this.rotationAngle + t * turns * Math.PI * 2;
      const r = radius * t;
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

  private drawWave(cx: number, cy: number, radius: number, _layer: number) {
    this.ctx.beginPath();
    const waves = 8 + this.features.treble * 8;
    const points = 200;
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const angle = t * Math.PI * 2;
      const waveOffset = Math.sin(angle * waves + this.currentTime * 2) * radius * 0.2;
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

  private drawBars(cx: number, cy: number, minDim: number, pulseMult: number) {
    const barCount = 32;
    const hMax = minDim * 0.4 * pulseMult;
    const barWidth = minDim * 0.012;
    const spacing = minDim * 0.018;

    // Smooth bar heights with previous frame
    const mid = this.features.mid;
    const treble = this.features.treble;
    const energy = this.features.energy;

    for (let i = 0; i < barCount; i++) {
      const xOffset = (i - barCount / 2 + 0.5) * (barWidth + spacing);
      const x = cx + xOffset;

      // Smoother height calculation
      const baseHeight = hMax * (0.2 + 0.8 * mid);
      // Use smoother wave function
      const jitter = Math.sin(i * 0.7 + this.currentTime * 2.5) * treble * 0.12;
      let barH = baseHeight * (1.0 + jitter);

      // Smoother edge tapering
      const edgeFactor = 1.0 - Math.pow(Math.abs(i - barCount / 2) / (barCount / 2), 1.5) * 0.4;
      barH *= edgeFactor;

      // Smooth color transitions
      const hue = 20 + treble * 40;
      const saturation = 80 + this.features.lyricIntensity * 20;
      const lightness = 60 + energy * 30;
      this.ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

      const yTop = cy - barH / 2;
      const yBottom = cy + barH / 2;
      this.ctx.fillRect(x - barWidth / 2, yTop, barWidth, yBottom - yTop);
    }

    this.ctx.shadowBlur = 0;
  }

  private drawHUDLines(cx: number, cy: number, minDim: number) {
    const hudColor = 'hsl(180, 70%, 60%)';
    const rotationAngle = this.rotationAngle * 0.5 + this.features.treble * 0.3;
    const lineLength = minDim * 0.45;
    const cosA = Math.cos(rotationAngle);
    const sinA = Math.sin(rotationAngle);

    this.ctx.strokeStyle = hudColor;
    this.ctx.lineWidth = 2;
    this.ctx.globalAlpha = 0.6;

    // Horizontal line
    this.ctx.beginPath();
    this.ctx.moveTo(cx - lineLength * cosA, cy - lineLength * sinA);
    this.ctx.lineTo(cx + lineLength * cosA, cy + lineLength * sinA);
    this.ctx.stroke();

    // Vertical line
    this.ctx.beginPath();
    this.ctx.moveTo(cx + lineLength * sinA, cy - lineLength * cosA);
    this.ctx.lineTo(cx - lineLength * sinA, cy + lineLength * cosA);
    this.ctx.stroke();

    this.ctx.globalAlpha = 1.0;
  }

  private addGlowEffect() {
    // Enhanced neon glow effect with radial gradient
    const width = this.canvas.width;
    const height = this.canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    
    // Create radial glow overlay
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';
    
    const baseHue = 30 + this.features.lyricSentiment * 60;
    const glowIntensity = 0.15 + this.features.energy * 0.25;
    
    const gradient = this.ctx.createRadialGradient(
      cx, cy, 0,
      cx, cy, Math.min(width, height) * 0.7
    );
    gradient.addColorStop(0, `hsla(${baseHue}, 100%, 70%, ${glowIntensity})`);
    gradient.addColorStop(0.5, `hsla(${baseHue + 30}, 80%, 60%, ${glowIntensity * 0.6})`);
    gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.restore();
    
    // Add subtle chromatic aberration for depth
    if (this.features.treble > 0.3) {
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.globalAlpha = this.features.treble * 0.08;
      
      // Red channel slight offset
      this.ctx.fillStyle = `hsla(${baseHue}, 100%, 50%, 0.4)`;
      this.ctx.fillRect(1, 0, width, height);
      
      // Blue channel slight offset
      this.ctx.fillStyle = `hsla(${baseHue + 180}, 100%, 50%, 0.4)`;
      this.ctx.fillRect(-1, 0, width, height);
      this.ctx.restore();
    }
  }
}


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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: { r: number; g: number; b: number };
  trail: Array<{ x: number; y: number; life: number }>;
}

export class ParticleRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentTime: number = 0;
  private features: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro"
  };
  
  // Smoothed features for fluid animation
  private smoothedFeatures: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro"
  };
  
  private smoothingFactor: number = 0.18;

  private particles: Particle[] = [];
  private particleMode: number = 0; // 0=nebula, 1=fireworks, 2=vortex, 3=liquid
  private particleCount: number = 10000;
  private turbulence: number = 0.5;
  private gravity: number = 0.0;

  private vortexCenter: { x: number; y: number } = { x: 0, y: 0 };
  private lastBeatTime: number = 0;

  constructor(canvas: HTMLCanvasElement, _analysis: ExtendedAudioAnalysisResponse | null) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.initParticles();
  }

  setParticleMode(mode: number) {
    this.particleMode = mode;
    this.initParticles();
  }

  setParticleCount(count: number) {
    this.particleCount = count;
    this.initParticles();
  }

  setTurbulence(amount: number) {
    this.turbulence = amount;
  }

  setGravity(strength: number) {
    this.gravity = strength;
  }

  private initParticles() {
    this.particles = [];
    const width = this.canvas.width || 1920;
    const height = this.canvas.height || 1080;
    
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(this.createParticle(width, height));
    }
  }

  private createParticle(width: number, height: number): Particle {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 0.5;
    
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      maxLife: 1.0,
      size: Math.random() * 2 + 1,
      color: { r: 255, g: 200, b: 100 },
      trail: []
    };
  }

  updateAnalysis(_analysis: ExtendedAudioAnalysisResponse | null) {
    // Analysis stored in engine, not needed here
  }

  updateFeatures(time: number, features: Features) {
    this.currentTime = time;
    
    // Smooth interpolation for fluid motion
    this.smoothedFeatures.bass = this.lerp(this.smoothedFeatures.bass, features.bass, this.smoothingFactor);
    this.smoothedFeatures.mid = this.lerp(this.smoothedFeatures.mid, features.mid, this.smoothingFactor);
    this.smoothedFeatures.treble = this.lerp(this.smoothedFeatures.treble, features.treble, this.smoothingFactor);
    this.smoothedFeatures.energy = this.lerp(this.smoothedFeatures.energy, features.energy, this.smoothingFactor);
    this.smoothedFeatures.beatPulse = this.lerp(this.smoothedFeatures.beatPulse, features.beatPulse, 0.35);
    this.smoothedFeatures.lyricIntensity = this.lerp(this.smoothedFeatures.lyricIntensity, features.lyricIntensity, this.smoothingFactor);
    this.smoothedFeatures.lyricSentiment = features.lyricSentiment;
    this.smoothedFeatures.lyricEnergy = features.lyricEnergy;
    this.smoothedFeatures.currentSection = features.currentSection;
    
    this.features = this.smoothedFeatures;
    
    // Check for beat to trigger explosions (use original features for beat detection)
    if (features.beatPulse > 0.5 && time - this.lastBeatTime > 0.1) {
      this.lastBeatTime = time;
      this.triggerBeatExplosion();
    }
  }
  
  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  private triggerBeatExplosion() {
    const width = this.canvas.width || 1920;
    const height = this.canvas.height || 1080;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Spawn particles from center
    const explosionCount = Math.floor(this.features.beatPulse * 50);
    for (let i = 0; i < explosionCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 10 + 5;
      
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        maxLife: 1.0,
        size: Math.random() * 3 + 2,
        color: {
          r: 255,
          g: Math.random() * 100 + 150,
          b: Math.random() * 50
        },
        trail: []
      });
    }
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.vortexCenter = { x: width / 2, y: height / 2 };
    this.initParticles();
  }

  render(_time: number) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Clear with fade for trails - adjust fade based on mode
    const fadeAlpha = this.particleMode === 3 ? 0.05 : 0.08; // Liquid mode needs more persistence
    this.ctx.fillStyle = `rgba(5, 6, 10, ${fadeAlpha})`;
    this.ctx.fillRect(0, 0, width, height);

    // Update and render particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Update based on mode
      this.updateParticle(p, width, height);
      
      // Render particle
      this.renderParticle(p);
      
      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        // Spawn new particle
        this.particles.push(this.createParticle(width, height));
      }
    }
  }

  private updateParticle(p: Particle, width: number, height: number) {
    // Update based on mode
    switch (this.particleMode) {
      case 0: // Energy nebula
        this.updateNebula(p, width, height);
        break;
      case 1: // Beat-explosion fireworks
        this.updateFireworks(p, width, height);
        break;
      case 2: // Vortex swarm
        this.updateVortex(p, width, height);
        break;
      case 3: // Flowing liquid
        this.updateLiquid(p, width, height);
        break;
    }
    
    // Update position
    p.x += p.vx;
    p.y += p.vy;
    
    // Boundary wrapping
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;
    
    // Update life
    p.life -= 0.002;
    
    // Update trail
    p.trail.push({ x: p.x, y: p.y, life: 1.0 });
    if (p.trail.length > 5) {
      p.trail.shift();
    }
    p.trail.forEach(t => t.life -= 0.2);
  }

  private updateNebula(p: Particle, width: number, height: number) {
    // Bass pushes outward smoothly
    const centerX = width / 2;
    const centerY = height / 2;
    const dx = p.x - centerX;
    const dy = p.y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 0) {
      const force = this.features.bass * 0.08;
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;
    }
    
    // Treble adds smooth jitter
    const jitterAmount = this.features.treble * this.turbulence * 0.5;
    p.vx += (Math.random() - 0.5) * jitterAmount;
    p.vy += (Math.random() - 0.5) * jitterAmount;
    
    // Mid creates smooth swirling
    const swirl = this.features.mid * 0.03;
    const tempVx = p.vx;
    p.vx = p.vx * Math.cos(swirl) - p.vy * Math.sin(swirl);
    p.vy = tempVx * Math.sin(swirl) + p.vy * Math.cos(swirl);
    
    // Damping for smoothness
    p.vx *= 0.98;
    p.vy *= 0.98;
  }

  private updateFireworks(p: Particle, width: number, height: number) {
    // Gravity
    p.vy += this.gravity;
    
    // Friction
    p.vx *= 0.98;
    p.vy *= 0.98;
    
    // Beat pulse adds velocity
    if (this.features.beatPulse > 0.3) {
      const angle = Math.atan2(p.y - height / 2, p.x - width / 2);
      p.vx += Math.cos(angle) * this.features.beatPulse * 2;
      p.vy += Math.sin(angle) * this.features.beatPulse * 2;
    }
  }

  private updateVortex(p: Particle, _width: number, _height: number) {
    const dx = p.x - this.vortexCenter.x;
    const dy = p.y - this.vortexCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 0) {
      // Angular velocity
      const angle = Math.atan2(dy, dx);
      const angularVel = 0.1 + this.features.mid * 0.1;
      const newAngle = angle + angularVel;
      
      // Radial force (inward for drops, outward otherwise)
      let radialForce = -0.02;
      if (this.features.currentSection === "drop") {
        radialForce = 0.05 * this.features.energy;
      }
      
      p.vx = Math.cos(newAngle) * dist * angularVel + (dx / dist) * radialForce;
      p.vy = Math.sin(newAngle) * dist * angularVel + (dy / dist) * radialForce;
    }
  }

  private updateLiquid(p: Particle, _width: number, _height: number) {
    // Flow field based on noise
    const noiseX = Math.sin(p.x * 0.01 + this.currentTime) * this.turbulence;
    const noiseY = Math.cos(p.y * 0.01 + this.currentTime) * this.turbulence;
    
    p.vx += noiseX * this.features.mid;
    p.vy += noiseY * this.features.mid;
    
    // Viscosity
    p.vx *= 0.95;
    p.vy *= 0.95;
    
    // Bass creates waves
    const wave = Math.sin(p.x * 0.02 + this.currentTime * 2) * this.features.bass;
    p.vy += wave * 0.5;
  }

  private renderParticle(p: Particle) {
    const alpha = p.life;
    
    // Rich, vibrant color palette based on multiple factors
    // Base hue from sentiment, modulated by energy and position
    const baseHue = (30 + this.features.lyricSentiment * 60 + p.x * 0.1) % 360;
    const energyHue = (this.features.energy * 60 + p.y * 0.1) % 360;
    const beatHue = (this.features.beatPulse * 120) % 360;
    
    // Blend multiple hues for rich color variation
    const hue = (baseHue * 0.4 + energyHue * 0.3 + beatHue * 0.3) % 360;
    
    // High saturation for vibrant colors
    const saturation = 75 + this.features.lyricEnergy * 25 + this.features.energy * 20;
    
    // Bright, glowing lightness
    const lightness = 55 + this.features.energy * 35 + this.features.beatPulse * 20;
    
    // Render trail with vibrant gradient colors
    for (let i = 0; i < p.trail.length; i++) {
      const t = p.trail[i];
      const trailProgress = i / p.trail.length;
      const trailAlpha = alpha * t.life * 0.5 * trailProgress;
      
      // Color shifts along trail for rainbow effect
      const trailHue = (hue + trailProgress * 30) % 360;
      const trailSaturation = saturation * (0.8 + trailProgress * 0.2);
      const trailLightness = lightness * (0.7 + trailProgress * 0.3);
      
      this.ctx.fillStyle = `hsla(${trailHue}, ${trailSaturation}%, ${trailLightness}%, ${trailAlpha})`;
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, p.size * 0.6 * trailProgress, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // Multi-color radial gradient for rich glow
    const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
    
    // Center: bright, saturated
    const centerHue = hue;
    gradient.addColorStop(0, `hsla(${centerHue}, ${saturation}%, ${lightness + 20}%, ${alpha})`);
    
    // Mid: slightly shifted hue
    const midHue = (hue + 20) % 360;
    gradient.addColorStop(0.4, `hsla(${midHue}, ${saturation * 0.9}%, ${lightness}%, ${alpha * 0.7})`);
    
    // Outer: complementary hue
    const outerHue = (hue + 60) % 360;
    gradient.addColorStop(0.7, `hsla(${outerHue}, ${saturation * 0.7}%, ${lightness * 0.8}%, ${alpha * 0.4})`);
    gradient.addColorStop(1, `hsla(${outerHue}, ${saturation * 0.5}%, ${lightness * 0.6}%, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Core particle - bright and vibrant
    const coreHue = (hue + 10) % 360;
    this.ctx.fillStyle = `hsla(${coreHue}, ${Math.min(100, saturation + 10)}%, ${Math.min(100, lightness + 25)}%, ${alpha})`;
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = `hsla(${coreHue}, ${saturation}%, ${lightness}%, ${alpha * 0.8})`;
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add sparkle for high energy
    if (this.features.energy > 0.7 || this.features.treble > 0.6) {
      const sparkleHue = (hue + 180) % 360; // Complementary
      this.ctx.fillStyle = `hsla(${sparkleHue}, 100%, 90%, ${alpha * 0.6})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * 0.3, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    this.ctx.shadowBlur = 0;
  }
}


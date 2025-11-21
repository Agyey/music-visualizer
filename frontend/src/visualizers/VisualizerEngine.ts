import { ExtendedAudioAnalysisResponse } from '../types/timeline';
import { GeometricRenderer } from './GeometricRenderer';
import { PsychedelicRenderer } from './PsychedelicRenderer';
import { ParticleRenderer } from './ParticleRenderer';
import { ParticleRendererWebGL } from './ParticleRendererWebGL';
import { ThreeDRenderer } from './ThreeDRenderer';
import { VisualizerMode } from '../types/timeline';

export class VisualizerEngine {
  private mode: VisualizerMode = "geometric";
  private geometricRenderer: GeometricRenderer;
  private shaderRenderer: PsychedelicRenderer;
  private particleRenderer: ParticleRenderer | ParticleRendererWebGL;
  private threeDRenderer: ThreeDRenderer;
  private canvas: HTMLCanvasElement;
  private transitionProgress: number = 1.0;
  private transitionTarget: VisualizerMode | null = null;
  private transitionStartTime: number = 0;
  private transitionDuration: number = 1000; // 1 second
  private useWebGLParticles: boolean = true;

  constructor(canvas: HTMLCanvasElement, analysis: ExtendedAudioAnalysisResponse | null) {
    this.canvas = canvas;
    this.geometricRenderer = new GeometricRenderer(canvas, analysis);
    this.shaderRenderer = new PsychedelicRenderer(canvas, analysis);
    
    // Try WebGL particles first, fallback to canvas
    try {
      this.particleRenderer = new ParticleRendererWebGL(canvas, analysis);
      this.useWebGLParticles = true;
    } catch (e) {
      console.warn('WebGL particles not available, using canvas fallback');
      this.particleRenderer = new ParticleRenderer(canvas, analysis);
      this.useWebGLParticles = false;
    }
    
    this.threeDRenderer = new ThreeDRenderer(canvas, analysis);
  }

  setMode(mode: VisualizerMode) {
    if (this.mode === mode) return;
    
    this.transitionTarget = mode;
    this.transitionStartTime = performance.now();
    this.transitionProgress = 0.0;
    
    // Complete transition after duration
    setTimeout(() => {
      this.mode = mode;
      this.transitionTarget = null;
      this.transitionProgress = 1.0;
    }, this.transitionDuration);
  }

  getMode(): VisualizerMode {
    return this.mode;
  }

  updateAnalysis(analysis: ExtendedAudioAnalysisResponse | null) {
    this.geometricRenderer.updateAnalysis(analysis);
    this.shaderRenderer.updateAnalysis(analysis);
    this.particleRenderer.updateAnalysis(analysis);
    this.threeDRenderer.updateAnalysis(analysis);
  }

  updateFeatures(time: number, features: {
    bass: number;
    mid: number;
    treble: number;
    energy: number;
    beatPulse: number;
    lyricIntensity: number;
    lyricSentiment: number;
    lyricEnergy: number;
    currentSection: string;
    emotion?: string;
  }) {
    this.geometricRenderer.updateFeatures(time, features);
    this.shaderRenderer.updateFeatures(time, features);
    this.particleRenderer.updateFeatures(time, features);
    this.threeDRenderer.updateFeatures(time, features);
  }

  render(time: number) {
    const now = performance.now();
    
    // Update transition progress
    if (this.transitionTarget) {
      this.transitionProgress = Math.min(
        (now - this.transitionStartTime) / this.transitionDuration,
        1.0
      );
    }

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = 'rgb(5, 6, 10)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render based on mode and transition
    if (this.transitionTarget && this.transitionProgress < 1.0) {
      // Crossfade between modes
      const oldOpacity = 1.0 - this.transitionProgress;
      const newOpacity = this.transitionProgress;

      // Save context for opacity
      ctx.save();
      ctx.globalAlpha = oldOpacity;
      this.renderMode(this.mode, time);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = newOpacity;
      this.renderMode(this.transitionTarget, time);
      ctx.restore();
    } else {
      this.renderMode(this.mode, time);
    }
  }

  private renderMode(mode: VisualizerMode, time: number) {
    switch (mode) {
      case "geometric":
        this.geometricRenderer.render(time);
        break;
      case "psychedelic":
        this.shaderRenderer.render(time);
        break;
      case "particles":
        this.particleRenderer.render(time);
        break;
      case "threeD":
        this.threeDRenderer.render(time);
        break;
    }
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.geometricRenderer.resize(width, height);
    this.shaderRenderer.resize(width, height);
    this.particleRenderer.resize(width, height);
    this.threeDRenderer.resize(width, height);
  }

  // Get renderer for UI controls
  getGeometricRenderer() { return this.geometricRenderer; }
  getShaderRenderer() { return this.shaderRenderer; }
  getParticleRenderer() { return this.particleRenderer; }
  getThreeDRenderer() { return this.threeDRenderer; }
  
  // Set particle variant (works for both WebGL and canvas)
  setParticleVariant(variant: "nebula" | "vortex_swarm" | "beat_fireworks" | "liquid_flow") {
    if (this.useWebGLParticles && this.particleRenderer instanceof ParticleRendererWebGL) {
      this.particleRenderer.setVariant(variant);
    } else if (this.particleRenderer instanceof ParticleRenderer) {
      // Map to old variant system if needed
      const variantMap: Record<string, number> = {
        "nebula": 0, "vortex_swarm": 2, "beat_fireworks": 1, "liquid_flow": 3
      };
      this.particleRenderer.setParticleMode(variantMap[variant] || 0);
    }
  }

  // Set shader variant
  setShaderVariant(variant: string) {
    this.shaderRenderer.setShaderVariant(variant);
  }

  // Set 3D config
  setThreeDConfig(config: {
    shape_family?: string;
    morph_speed?: number;
    camera_fly_through_speed?: number;
    orbit_radius?: number;
    field_of_view?: number;
    depth_distortion?: number;
  }) {
    this.threeDRenderer.setThreeDConfig(config);
  }
}


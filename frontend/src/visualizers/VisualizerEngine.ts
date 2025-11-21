import { ExtendedAudioAnalysisResponse } from '../types/timeline';
import { GeometricRenderer } from './GeometricRenderer';
import { PsychedelicRenderer } from './PsychedelicRenderer';
import { ParticleRenderer } from './ParticleRenderer';
import { ParticleRendererWebGL } from './ParticleRendererWebGL';
import { ThreeDRenderer } from './ThreeDRenderer';
import { VisualizerMode } from '../types/timeline';
import { VisualizerQualityManager, QualityProfile } from './VisualizerQualityManager';

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
  private qualityManager: VisualizerQualityManager;
  private currentQualityProfile: QualityProfile;

  constructor(canvas: HTMLCanvasElement, analysis: ExtendedAudioAnalysisResponse | null) {
    this.canvas = canvas;
    this.qualityManager = new VisualizerQualityManager();
    this.currentQualityProfile = this.qualityManager.getProfile();
    
    // Listen for quality changes
    this.qualityManager.onQualityChange((profile) => {
      this.currentQualityProfile = profile;
      this.updateRenderersQuality(profile);
    });
    
    this.geometricRenderer = new GeometricRenderer(canvas, analysis);
    this.shaderRenderer = new PsychedelicRenderer(canvas, analysis);
    
    // Try WebGL particles first, fallback to canvas based on quality
    if (this.currentQualityProfile.allowWebGL) {
      try {
        this.particleRenderer = new ParticleRendererWebGL(canvas, analysis);
        this.particleRenderer.setQualityProfile(this.currentQualityProfile);
        this.useWebGLParticles = true;
      } catch (e) {
        console.warn('WebGL particles not available, using canvas fallback');
        this.particleRenderer = new ParticleRenderer(canvas, analysis);
        this.particleRenderer.setQualityProfile(this.currentQualityProfile);
        this.useWebGLParticles = false;
      }
    } else {
      this.particleRenderer = new ParticleRenderer(canvas, analysis);
      this.particleRenderer.setQualityProfile(this.currentQualityProfile);
      this.useWebGLParticles = false;
    }
    
    this.threeDRenderer = new ThreeDRenderer(canvas, analysis);
    this.threeDRenderer.setQualityProfile(this.currentQualityProfile);
    
    // Set initial quality on all renderers
    this.shaderRenderer.setQualityProfile(this.currentQualityProfile);
  }
  
  private updateRenderersQuality(profile: QualityProfile) {
    if (this.particleRenderer instanceof ParticleRendererWebGL) {
      this.particleRenderer.setQualityProfile(profile);
    } else if (this.particleRenderer instanceof ParticleRenderer) {
      this.particleRenderer.setQualityProfile(profile);
    }
    this.shaderRenderer.setQualityProfile(profile);
    this.threeDRenderer.setQualityProfile(profile);
  }
  
  getQualityManager(): VisualizerQualityManager {
    return this.qualityManager;
  }
  
  getQualityProfile(): QualityProfile {
    return this.currentQualityProfile;
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
    
    // Register frame for FPS tracking and quality adjustment
    this.qualityManager.registerFrame(now);
    
    // Update transition progress
    if (this.transitionTarget) {
      this.transitionProgress = Math.min(
        (now - this.transitionStartTime) / this.transitionDuration,
        1.0
      );
    }

    // For WebGL modes (psychedelic, 3D), don't clear with 2D context
    // They handle their own clearing
    const isWebGLMode = this.mode === 'psychedelic' || this.mode === 'threeD';
    const isTransitioningToWebGL = this.transitionTarget === 'psychedelic' || this.transitionTarget === 'threeD';
    
    if (!isWebGLMode && !isTransitioningToWebGL) {
      // Only clear with 2D context for non-WebGL modes
      const ctx = this.canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgb(5, 6, 10)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    // Render based on mode and transition
    if (this.transitionTarget && this.transitionProgress < 1.0) {
      // For WebGL modes, just switch directly (WebGL doesn't support opacity blending easily)
      if (isWebGLMode || isTransitioningToWebGL) {
        // Render new mode if transition is mostly complete
        if (this.transitionProgress > 0.5) {
          this.renderMode(this.transitionTarget, time);
        } else {
          this.renderMode(this.mode, time);
        }
      } else {
        // Crossfade for 2D modes
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          const oldOpacity = 1.0 - this.transitionProgress;
          const newOpacity = this.transitionProgress;

          ctx.save();
          ctx.globalAlpha = oldOpacity;
          this.renderMode(this.mode, time);
          ctx.restore();

          ctx.save();
          ctx.globalAlpha = newOpacity;
          this.renderMode(this.transitionTarget, time);
          ctx.restore();
        }
      }
    } else {
      this.renderMode(this.mode, time);
    }
  }

  private renderMode(mode: VisualizerMode, time: number) {
    try {
      switch (mode) {
        case "geometric":
          this.geometricRenderer.render(time);
          break;
        case "psychedelic":
          // Ensure canvas is ready for WebGL
          if (this.canvas.width === 0 || this.canvas.height === 0) {
            const rect = this.canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              this.canvas.width = rect.width;
              this.canvas.height = rect.height;
            }
          }
          this.shaderRenderer.render(time);
          break;
        case "particles":
          // Ensure canvas is ready
          if (this.canvas.width === 0 || this.canvas.height === 0) {
            const rect = this.canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              this.canvas.width = rect.width;
              this.canvas.height = rect.height;
            }
          }
          this.particleRenderer.render(time);
          break;
        case "threeD":
          // Ensure canvas is ready for Three.js
          if (this.canvas.width === 0 || this.canvas.height === 0) {
            const rect = this.canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              this.canvas.width = rect.width;
              this.canvas.height = rect.height;
            }
          }
          this.threeDRenderer.render(time);
          break;
      }
    } catch (error) {
      console.error(`Error rendering ${mode} mode:`, error);
      // Fallback: clear canvas and show error
      const ctx = this.canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgb(5, 6, 10)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Error rendering ${mode} mode`, this.canvas.width / 2, this.canvas.height / 2);
      }
    }
  }

  resize(width: number, height: number) {
    const profile = this.currentQualityProfile;
    const scale = profile.internalResolutionScale;
    const renderWidth = Math.floor(width * scale);
    const renderHeight = Math.floor(height * scale);
    
    this.canvas.width = renderWidth;
    this.canvas.height = renderHeight;
    
    // Set canvas display size to full resolution
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    
    this.geometricRenderer.resize(renderWidth, renderHeight);
    this.shaderRenderer.resize(renderWidth, renderHeight, profile);
    this.particleRenderer.resize(renderWidth, renderHeight);
    this.threeDRenderer.resize(renderWidth, renderHeight, profile);
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
  
  // Set particle parameters
  setParticleCount(count: number) {
    if (this.useWebGLParticles && this.particleRenderer instanceof ParticleRendererWebGL) {
      this.particleRenderer.setParticleCount(count);
    }
  }
  
  setParticleTurbulence(turbulence: number) {
    if (this.useWebGLParticles && this.particleRenderer instanceof ParticleRendererWebGL) {
      this.particleRenderer.setTurbulence(turbulence);
    }
  }
  
  setParticleGravity(gravity: number) {
    if (this.useWebGLParticles && this.particleRenderer instanceof ParticleRendererWebGL) {
      this.particleRenderer.setGravity(gravity);
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


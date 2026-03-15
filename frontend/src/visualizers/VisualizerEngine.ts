import { ExtendedAudioAnalysisResponse } from '../types/timeline';
import { GeometricRenderer } from './GeometricRenderer';
import { PsychedelicRenderer } from './PsychedelicRenderer';
import { ParticleRenderer } from './ParticleRenderer';
import { ParticleRendererWebGL } from './ParticleRendererWebGL';
import { ThreeDRenderer } from './ThreeDRenderer';
import { VisualizerMode } from '../types/timeline';
import { VisualizerQualityManager, QualityProfile } from './VisualizerQualityManager';

/**
 * VisualizerEngine manages multiple renderer backends with separate canvases.
 * 
 * A single HTML canvas can only have ONE context type (2d OR webgl).
 * To support both 2D and WebGL renderers, each renderer gets its own canvas.
 * Only the active mode's canvas is visible.
 */
export class VisualizerEngine {
  private mode: VisualizerMode = "geometric";
  private geometricRenderer: GeometricRenderer;
  private shaderRenderer: PsychedelicRenderer;
  private particleRenderer: ParticleRenderer | ParticleRendererWebGL;
  private threeDRenderer: ThreeDRenderer;
  
  // Each renderer gets its own canvas to avoid context conflicts
  private canvases: Map<string, HTMLCanvasElement> = new Map();
  private container: HTMLElement;
  
  private transitionDuration: number = 1000; // 1 second
  private useWebGLParticles: boolean = true;
  private qualityManager: VisualizerQualityManager;
  private currentQualityProfile: QualityProfile;

  constructor(container: HTMLElement, analysis: ExtendedAudioAnalysisResponse | null) {
    this.container = container;
    this.qualityManager = new VisualizerQualityManager();
    this.currentQualityProfile = this.qualityManager.getProfile();
    
    // Listen for quality changes
    this.qualityManager.onQualityChange((profile) => {
      this.currentQualityProfile = profile;
      this.updateRenderersQuality(profile);
    });

    // Create separate canvases for each renderer type
    const geometricCanvas = this.createCanvas('geometric');
    const psychedelicCanvas = this.createCanvas('psychedelic');
    const particlesCanvas = this.createCanvas('particles');
    const threeDCanvas = this.createCanvas('threeD');
    
    this.geometricRenderer = new GeometricRenderer(geometricCanvas, analysis);
    this.shaderRenderer = new PsychedelicRenderer(psychedelicCanvas, analysis);
    
    // Try WebGL particles first, fallback to canvas based on quality
    if (this.currentQualityProfile.allowWebGL) {
      try {
        this.particleRenderer = new ParticleRendererWebGL(particlesCanvas, analysis);
        this.particleRenderer.setQualityProfile(this.currentQualityProfile);
        this.useWebGLParticles = true;
      } catch (e) {
        console.warn('WebGL particles not available, using canvas fallback');
        this.particleRenderer = new ParticleRenderer(particlesCanvas, analysis);
        this.particleRenderer.setQualityProfile(this.currentQualityProfile);
        this.useWebGLParticles = false;
      }
    } else {
      this.particleRenderer = new ParticleRenderer(particlesCanvas, analysis);
      this.particleRenderer.setQualityProfile(this.currentQualityProfile);
      this.useWebGLParticles = false;
    }
    
    this.threeDRenderer = new ThreeDRenderer(threeDCanvas, analysis);
    this.threeDRenderer.setQualityProfile(this.currentQualityProfile);
    
    // Set initial quality on all renderers
    this.shaderRenderer.setQualityProfile(this.currentQualityProfile);
    
    // Show only the active mode's canvas
    this.updateCanvasVisibility();
  }
  
  /**
   * Create a canvas element for a specific renderer mode.
   * Each canvas is absolutely positioned within the container.
   */
  private createCanvas(mode: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'none'; // Hidden by default
    canvas.dataset.mode = mode;
    this.container.appendChild(canvas);
    this.canvases.set(mode, canvas);
    return canvas;
  }
  
  /**
   * Show/hide canvases based on the active mode.
   */
  private updateCanvasVisibility() {
    this.canvases.forEach((canvas, mode) => {
      canvas.style.display = mode === this.mode ? 'block' : 'none';
    });
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
    
    // Switch mode and swap canvas visibility
    // Use a short delay for a smoother visual transition
    setTimeout(() => {
      this.mode = mode;
      this.updateCanvasVisibility();
    }, this.transitionDuration / 2);
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
    // Only update the active renderer's features for performance
    this.getActiveRenderer().updateFeatures(time, features);
  }
  
  private getActiveRenderer(): { updateFeatures: (time: number, features: any) => void; render: (time: number) => void } {
    switch (this.mode) {
      case "geometric": return this.geometricRenderer;
      case "psychedelic": return this.shaderRenderer;
      case "particles": return this.particleRenderer;
      case "threeD": return this.threeDRenderer;
      default: return this.geometricRenderer;
    }
  }

  render(time: number) {
    const now = performance.now();
    
    // Register frame for FPS tracking and quality adjustment
    this.qualityManager.registerFrame(now);

    // Render the active mode
    this.renderMode(this.mode, time);
  }

  private renderMode(mode: VisualizerMode, time: number) {
    try {
      switch (mode) {
        case "geometric":
          this.geometricRenderer.render(time);
          break;
        case "psychedelic": {
          const canvas = this.canvases.get('psychedelic');
          if (canvas && (canvas.width === 0 || canvas.height === 0)) {
            const rect = canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              canvas.width = rect.width;
              canvas.height = rect.height;
            }
          }
          this.shaderRenderer.render(time);
          break;
        }
        case "particles": {
          const canvas = this.canvases.get('particles');
          if (canvas && (canvas.width === 0 || canvas.height === 0)) {
            const rect = canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              canvas.width = rect.width;
              canvas.height = rect.height;
            }
          }
          this.particleRenderer.render(time);
          break;
        }
        case "threeD": {
          const canvas = this.canvases.get('threeD');
          if (canvas && (canvas.width === 0 || canvas.height === 0)) {
            const rect = canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              canvas.width = rect.width;
              canvas.height = rect.height;
            }
          }
          this.threeDRenderer.render(time);
          break;
        }
      }
    } catch (error) {
      console.error(`Error rendering ${mode} mode:`, error);
      // Fallback: show error on the geometric (2D) canvas
      const canvas = this.canvases.get('geometric');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgb(5, 6, 10)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#fff';
          ctx.font = '20px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`Error rendering ${mode} mode`, canvas.width / 2, canvas.height / 2);
        }
      }
    }
  }

  resize(width: number, height: number) {
    const profile = this.currentQualityProfile;
    const scale = profile.internalResolutionScale;
    const renderWidth = Math.floor(width * scale);
    const renderHeight = Math.floor(height * scale);
    
    // Resize all canvases
    this.canvases.forEach((canvas) => {
      canvas.width = renderWidth;
      canvas.height = renderHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    });
    
    this.geometricRenderer.resize(renderWidth, renderHeight);
    this.shaderRenderer.resize(renderWidth, renderHeight, profile);
    this.particleRenderer.resize(renderWidth, renderHeight);
    this.threeDRenderer.resize(renderWidth, renderHeight, profile);
  }

  // Cleanup: remove canvases from DOM
  destroy() {
    this.canvases.forEach((canvas) => {
      canvas.remove();
    });
    this.canvases.clear();
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

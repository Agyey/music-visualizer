/**
 * Premium 3D Visualizer — Neon Cosmos
 * 
 * Features:
 * - Dynamic starfield background
 * - Morphing emissive shapes with iridescent materials
 * - Wireframe overlay with energy-reactive opacity
 * - Orbiting particle constellation
 * - Audio-reactive fog, lights, and camera
 * - Beat-triggered shockwave scaling
 * - Section-aware color palettes
 */
import * as THREE from 'three';
import { ExtendedAudioAnalysisResponse } from '../types/timeline';
import { QualityProfile } from './VisualizerQualityManager';

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
  emotion?: string;
}

export class ThreeDRenderer {
  private canvas: HTMLCanvasElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private mainObject: THREE.Mesh | null = null;
  private wireframeObject: THREE.Mesh | null = null;
  private orbitObjects: THREE.Mesh[] = [];
  private starField: THREE.Points | null = null;
  private innerGlow: THREE.Mesh | null = null;

  private features: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro"
  };

  private smoothedFeatures: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro"
  };

  private config = {
    morphSpeed: 0.02,
    cameraSpeed: 0.5,
    orbitRadius: 5.0,
    fov: 75,
    shapeFamily: "sphere" as "sphere" | "torus" | "cube" | "polyhedra" | "knot"
  };

  private rendererInitialized: boolean = false;
  private cameraAngle: number = 0;
  private morphProgress: number = 0;
  private shapes: string[] = ["sphere", "torus", "knot", "polyhedra", "cube"];
  private qualityProfile: QualityProfile | null = null;

  // Color state
  private paletteHue: number = 260;
  private targetPaletteHue: number = 260;
  private prevBeatPulse: number = 0;

  // Lights for dynamic color
  private mainLight: THREE.PointLight | null = null;
  private accentLight: THREE.PointLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;

  constructor(canvas: HTMLCanvasElement, _analysis: ExtendedAudioAnalysisResponse | null) {
    this.canvas = canvas;
  }

  setQualityProfile(profile: QualityProfile) {
    this.qualityProfile = profile;
  }

  private initThreeJS() {
    if (this.rendererInitialized) return;

    if (this.canvas.width === 0 || this.canvas.height === 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width || window.innerWidth;
      this.canvas.height = rect.height || window.innerHeight;
    }

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020208);
    this.scene.fog = new THREE.FogExp2(0x020208, 0.08);

    // Camera
    const aspect = this.canvas.width > 0 && this.canvas.height > 0
      ? this.canvas.width / this.canvas.height
      : window.innerWidth / window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(this.config.fov, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 8);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        preserveDrawingBuffer: false,
        alpha: false,
        powerPreference: "high-performance"
      });
      if (!this.renderer) return;

      this.renderer.setSize(this.canvas.width, this.canvas.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setClearColor(0x020208, 1);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;
    } catch (e) {
      console.error('Three.js renderer creation failed:', e);
      return;
    }

    // ── Lighting ──
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.4);
    this.scene.add(ambientLight);

    this.mainLight = new THREE.PointLight(0xff6b9d, 2.5, 50);
    this.mainLight.position.set(5, 5, 5);
    this.mainLight.castShadow = true;
    this.scene.add(this.mainLight);

    this.accentLight = new THREE.PointLight(0x4ecdc4, 2.0, 50);
    this.accentLight.position.set(-5, -5, 5);
    this.scene.add(this.accentLight);

    this.rimLight = new THREE.DirectionalLight(0x7b68ee, 1.5);
    this.rimLight.position.set(0, 10, -10);
    this.scene.add(this.rimLight);

    // Fill light from below
    const fillLight = new THREE.PointLight(0x6366f1, 1.0, 30);
    fillLight.position.set(0, -5, 3);
    this.scene.add(fillLight);

    // ── Create Objects ──
    this.createStarField();
    this.createMainObject();
    this.createOrbitObjects();
    this.createInnerGlow();

    this.rendererInitialized = true;
  }

  // ── STARFIELD ──
  private createStarField() {
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      // Distribute in a large sphere
      const radius = 30 + Math.random() * 70;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      // Varied star colors (whites, light blues, light yellows)
      const colorChoice = Math.random();
      if (colorChoice < 0.6) {
        colors[i3] = 0.9; colors[i3 + 1] = 0.92; colors[i3 + 2] = 1.0; // White-blue
      } else if (colorChoice < 0.85) {
        colors[i3] = 1.0; colors[i3 + 1] = 0.95; colors[i3 + 2] = 0.85; // Warm white
      } else {
        colors[i3] = 0.7; colors[i3 + 1] = 0.8; colors[i3 + 2] = 1.0; // Blue
      }

      sizes[i] = Math.random() * 2.5 + 0.5;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });

    this.starField = new THREE.Points(geometry, material);
    this.scene.add(this.starField);
  }

  // ── MAIN OBJECT ──
  private createMainObject() {
    if (!this.scene) return;

    if (this.mainObject) {
      this.scene.remove(this.mainObject);
      this.mainObject.geometry.dispose();
      if (this.mainObject.material instanceof THREE.Material) this.mainObject.material.dispose();
    }
    if (this.wireframeObject) {
      this.scene.remove(this.wireframeObject);
      this.wireframeObject.geometry.dispose();
      if (this.wireframeObject.material instanceof THREE.Material) this.wireframeObject.material.dispose();
    }

    const geometry = this.createGeometry(this.config.shapeFamily);

    // Premium emissive material
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(this.paletteHue / 360, 0.8, 0.5),
      emissive: new THREE.Color().setHSL(this.paletteHue / 360, 0.9, 0.3),
      emissiveIntensity: 1.2,
      metalness: 0.3,
      roughness: 0.2,
    });

    this.mainObject = new THREE.Mesh(geometry, material);
    this.mainObject.castShadow = true;
    this.mainObject.receiveShadow = true;
    this.scene.add(this.mainObject);

    // Wireframe overlay — cyan accent
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    this.wireframeObject = new THREE.Mesh(geometry.clone(), wireframeMaterial);
    this.scene.add(this.wireframeObject);
  }

  private createGeometry(shapeType: string): THREE.BufferGeometry {
    switch (shapeType) {
      case "sphere": return new THREE.SphereGeometry(1.2, 64, 64);
      case "torus": return new THREE.TorusGeometry(1, 0.4, 32, 100);
      case "cube": return new THREE.BoxGeometry(1.6, 1.6, 1.6, 10, 10, 10);
      case "polyhedra": return new THREE.IcosahedronGeometry(1.2, 2);
      case "knot": return new THREE.TorusKnotGeometry(0.9, 0.35, 128, 32);
      default: return new THREE.SphereGeometry(1.2, 64, 64);
    }
  }

  // ── INNER GLOW (billboard sprite) ──
  private createInnerGlow() {
    if (!this.scene) return;

    // Create a simple plane with additive blending for a glow halo
    const glowGeometry = new THREE.PlaneGeometry(8, 8);
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 256;
    glowCanvas.height = 256;
    const glowCtx = glowCanvas.getContext('2d');
    if (glowCtx) {
      const grad = glowCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(120, 100, 255, 0.5)');
      grad.addColorStop(0.3, 'rgba(80, 60, 200, 0.2)');
      grad.addColorStop(0.6, 'rgba(40, 30, 150, 0.05)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      glowCtx.fillStyle = grad;
      glowCtx.fillRect(0, 0, 256, 256);
    }

    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    const glowMaterial = new THREE.MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.innerGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.scene.add(this.innerGlow);
  }

  // ── ORBIT OBJECTS ──
  private createOrbitObjects() {
    this.orbitObjects.forEach(obj => {
      this.scene.remove(obj);
      obj.geometry.dispose();
      if (obj.material instanceof THREE.Material) obj.material.dispose();
    });
    this.orbitObjects = [];

    const count = 40;
    for (let i = 0; i < count; i++) {
      const size = 0.04 + Math.random() * 0.08;
      const geometry = new THREE.SphereGeometry(size, 8, 8);
      const hue = i / count;
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(hue, 0.9, 0.65),
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geometry, material);
      this.orbitObjects.push(mesh);
      this.scene.add(mesh);
    }
  }

  updateAnalysis(_analysis: ExtendedAudioAnalysisResponse | null) {}

  updateFeatures(_time: number, features: Features) {
    // Smooth features
    const sf = 0.12;
    this.smoothedFeatures.bass = this.lerp(this.smoothedFeatures.bass, features.bass, sf);
    this.smoothedFeatures.mid = this.lerp(this.smoothedFeatures.mid, features.mid, sf);
    this.smoothedFeatures.treble = this.lerp(this.smoothedFeatures.treble, features.treble, sf);
    this.smoothedFeatures.energy = this.lerp(this.smoothedFeatures.energy, features.energy, sf);
    this.smoothedFeatures.beatPulse = this.lerp(this.smoothedFeatures.beatPulse, features.beatPulse, 0.25);
    this.smoothedFeatures.lyricIntensity = features.lyricIntensity;
    this.smoothedFeatures.lyricSentiment = features.lyricSentiment;
    this.smoothedFeatures.lyricEnergy = features.lyricEnergy;
    this.smoothedFeatures.currentSection = features.currentSection;
    this.smoothedFeatures.emotion = features.emotion;

    // Ensure minimum baseline so 3D scene is always alive
    const idlePulse = Math.sin(performance.now() / 1000 * 0.8) * 0.5 + 0.5;
    this.smoothedFeatures.bass = Math.max(this.smoothedFeatures.bass, 0.15 + idlePulse * 0.15);
    this.smoothedFeatures.mid = Math.max(this.smoothedFeatures.mid, 0.2 + idlePulse * 0.1);
    this.smoothedFeatures.treble = Math.max(this.smoothedFeatures.treble, 0.12 + Math.sin(performance.now() / 1000 * 1.2) * 0.08);
    this.smoothedFeatures.energy = Math.max(this.smoothedFeatures.energy, 0.25 + idlePulse * 0.15);

    this.features = this.smoothedFeatures;

    // Morph progress
    this.morphProgress += this.config.morphSpeed * (1 + this.features.mid * 0.5);
    if (this.morphProgress >= 1.0) {
      this.morphProgress = 0;
      const currentIdx = this.shapes.indexOf(this.config.shapeFamily);
      this.config.shapeFamily = this.shapes[(currentIdx + 1) % this.shapes.length] as any;
      this.createMainObject();
    }

    // Beat detection for flash
    if (features.beatPulse > 0.5 && this.prevBeatPulse < 0.5) {
      // Beat hit
    }
    this.prevBeatPulse = features.beatPulse;

    // Section-aware palette
    this.updatePalette();
    this.paletteHue = this.lerp(this.paletteHue, this.targetPaletteHue, 0.02);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private updatePalette() {
    switch (this.features.currentSection) {
      case "intro": this.targetPaletteHue = 240; break;
      case "verse": this.targetPaletteHue = 280; break;
      case "chorus": this.targetPaletteHue = 320; break;
      case "drop": this.targetPaletteHue = 10; break;
      case "bridge": this.targetPaletteHue = 170; break;
      case "live": this.targetPaletteHue = 260 + Math.sin(performance.now() / 1000 * 0.3) * 50; break;
      default: this.targetPaletteHue = 260;
    }
    this.targetPaletteHue += this.features.energy * 15;
  }

  setThreeDConfig(config: {
    shape_family?: string;
    morph_speed?: number;
    camera_fly_through_speed?: number;
    orbit_radius?: number;
    field_of_view?: number;
    depth_distortion?: number;
  }) {
    if (config.shape_family && config.shape_family !== this.config.shapeFamily) {
      this.config.shapeFamily = config.shape_family as any;
      if (this.rendererInitialized) this.createMainObject();
    }
    if (config.morph_speed !== undefined) this.config.morphSpeed = config.morph_speed;
    if (config.camera_fly_through_speed !== undefined) this.config.cameraSpeed = config.camera_fly_through_speed;
    if (config.orbit_radius !== undefined) this.config.orbitRadius = config.orbit_radius;
    if (config.field_of_view !== undefined && this.camera) {
      this.config.fov = config.field_of_view;
      this.camera.fov = config.field_of_view;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(width: number, height: number, profile?: QualityProfile) {
    if (profile) this.qualityProfile = profile;

    this.canvas.width = width;
    this.canvas.height = height;

    if (this.rendererInitialized && this.camera && this.renderer) {
      const aspect = width > 0 && height > 0 ? width / height : 1;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      if (this.qualityProfile) {
        const pr = this.qualityProfile.level === "high"
          ? Math.min(window.devicePixelRatio, 2)
          : this.qualityProfile.level === "medium" ? Math.min(window.devicePixelRatio, 1.5) : 1;
        this.renderer.setPixelRatio(pr);
      }
    } else if (!this.rendererInitialized && width > 0 && height > 0) {
      if (!this.qualityProfile || this.qualityProfile.use3D) this.initThreeJS();
    }
  }

  render(time: number) {
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
      } else return;
    }

    if (!this.rendererInitialized) {
      this.initThreeJS();
      if (!this.rendererInitialized || !this.renderer || !this.camera || !this.scene) {
        this.drawFallback(time);
        return;
      }
    }

    if (!this.renderer || !this.camera || !this.scene || !this.mainObject) {
      if (!this.mainObject && this.scene) this.createMainObject();
      return;
    }

    const hueNorm = (this.paletteHue % 360) / 360;

    // ── UPDATE MAIN OBJECT ──
    const bassScale = 1.0 + this.features.bass * 0.35 + this.features.beatPulse * 0.25;
    this.mainObject.scale.set(bassScale, bassScale, bassScale);
    if (this.wireframeObject) {
      this.wireframeObject.scale.set(bassScale * 1.02, bassScale * 1.02, bassScale * 1.02);
    }

    // Rotation
    const rotSpeed = 0.01 + this.features.mid * 0.02;
    this.mainObject.rotation.x += rotSpeed;
    this.mainObject.rotation.y += rotSpeed * 1.3;
    this.mainObject.rotation.z += rotSpeed * 0.5;
    if (this.wireframeObject) this.wireframeObject.rotation.copy(this.mainObject.rotation);

    // Material color update
    if (this.mainObject.material instanceof THREE.MeshStandardMaterial) {
      const mat = this.mainObject.material;
      mat.emissiveIntensity = 0.8 + this.features.treble * 0.5 + this.features.energy * 0.4;
      const color = new THREE.Color().setHSL(hueNorm, 0.85, 0.5);
      const emissive = new THREE.Color().setHSL(hueNorm, 0.9, 0.35 + this.features.energy * 0.15);
      mat.color = color;
      mat.emissive = emissive;
    }

    // Wireframe — energy-reactive opacity
    if (this.wireframeObject?.material instanceof THREE.MeshBasicMaterial) {
      this.wireframeObject.material.opacity = 0.08 + this.features.energy * 0.2;
      const wfColor = new THREE.Color().setHSL((hueNorm + 0.4) % 1, 0.8, 0.6);
      this.wireframeObject.material.color = wfColor;
    }

    // ── UPDATE LIGHTS ──
    if (this.mainLight) {
      this.mainLight.color.setHSL(hueNorm, 0.9, 0.6);
      this.mainLight.intensity = 2.0 + this.features.energy * 2.0;
      this.mainLight.position.set(
        5 + Math.sin(time * 0.5) * 2,
        5 + Math.cos(time * 0.3) * 2,
        5
      );
    }
    if (this.accentLight) {
      this.accentLight.color.setHSL((hueNorm + 0.3) % 1, 0.8, 0.5);
      this.accentLight.intensity = 1.5 + this.features.bass * 1.5;
    }
    if (this.rimLight) {
      this.rimLight.color.setHSL((hueNorm + 0.6) % 1, 0.7, 0.5);
    }

    // ── INNER GLOW (billboard facing camera) ──
    if (this.innerGlow) {
      this.innerGlow.lookAt(this.camera.position);
      const glowScale = 1.0 + this.features.energy * 0.5 + this.features.beatPulse * 0.3;
      this.innerGlow.scale.set(glowScale, glowScale, 1);
      if (this.innerGlow.material instanceof THREE.MeshBasicMaterial) {
        this.innerGlow.material.opacity = 0.3 + this.features.energy * 0.4;
      }
    }

    // ── STARFIELD rotation (slow) ──
    if (this.starField) {
      this.starField.rotation.y += 0.0003 + this.features.energy * 0.001;
      this.starField.rotation.x += 0.0001;
      if (this.starField.material instanceof THREE.PointsMaterial) {
        this.starField.material.opacity = 0.6 + this.features.energy * 0.4;
      }
    }

    // ── CAMERA ──
    this.cameraAngle += this.config.cameraSpeed * (1 + this.features.mid * 0.5);
    const camRadius = this.config.orbitRadius + Math.sin(time * 0.5) * 1.0;
    const cameraX = Math.cos(this.cameraAngle) * camRadius;
    const cameraY = Math.sin(this.cameraAngle * 0.7) * 2.0;
    const cameraZ = Math.sin(this.cameraAngle) * camRadius;
    this.camera.position.set(cameraX, cameraY, cameraZ);
    this.camera.lookAt(0, 0, 0);

    // ── FOG color updates ──
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = 0.06 + this.features.energy * 0.04;
      const fogColor = new THREE.Color().setHSL(hueNorm, 0.2, 0.02 + this.features.energy * 0.02);
      this.scene.fog.color = fogColor;
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background = fogColor;
      }
    }

    // ── ORBIT PARTICLES ──
    this.orbitObjects.forEach((obj, i) => {
      const angle = (i / this.orbitObjects.length) * Math.PI * 2 + time * 0.5;
      const orbitR = 2.5 + this.features.bass * 1.5 + Math.sin(time * 0.3 + i) * 0.5;
      const heightOffset = Math.sin(angle * 2 + i * 0.3) * 1.5;

      obj.position.set(
        Math.cos(angle) * orbitR,
        heightOffset,
        Math.sin(angle) * orbitR
      );

      const scale = 1.0 + this.features.beatPulse * 0.5;
      obj.scale.set(scale, scale, scale);

      // Color cycle
      if (obj.material instanceof THREE.MeshBasicMaterial) {
        obj.material.color.setHSL((hueNorm + i / this.orbitObjects.length) % 1, 0.9, 0.6 + this.features.energy * 0.2);
      }
    });

    // Beat impact scale flash
    if (this.features.beatPulse > 0.5) {
      const beatScale = 1.0 + this.features.beatPulse * 0.5;
      this.mainObject.scale.set(beatScale, beatScale, beatScale);
      if (this.wireframeObject) {
        this.wireframeObject.scale.set(beatScale * 1.02, beatScale * 1.02, beatScale * 1.02);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  private drawFallback(time: number) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgb(2, 2, 8)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const size = Math.min(this.canvas.width, this.canvas.height) / 4;
    const scale = 1 + this.features.bass * 0.3;

    ctx.strokeStyle = `hsl(${(time * 30 + this.paletteHue) % 360}, 100%, 70%)`;
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(time * 0.5);
    ctx.scale(scale, scale);

    const points = [[-size, -size], [size, -size], [size, size], [-size, size]];
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = `hsl(${(time * 30 + this.paletteHue + 180) % 360}, 100%, 70%)`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

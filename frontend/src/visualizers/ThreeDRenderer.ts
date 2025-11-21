/**
 * Advanced 3D Visualizer using Three.js
 * Features: morphing shapes, emissive neon materials, wireframe overlay, depth fog, audio-reactive animation
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
  
  private features: Features = {
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

  constructor(canvas: HTMLCanvasElement, _analysis: ExtendedAudioAnalysisResponse | null) {
    this.canvas = canvas;
  }
  
  setQualityProfile(profile: QualityProfile) {
    this.qualityProfile = profile;
    // Disable 3D if quality doesn't allow it
    if (!profile.use3D && this.rendererInitialized) {
      // Could hide or simplify scene here
    }
  }

  private initThreeJS() {
    if (this.rendererInitialized) return;
    
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width || window.innerWidth;
      this.canvas.height = rect.height || window.innerHeight;
    }
    
    console.log('Initializing Three.js renderer with canvas size:', this.canvas.width, 'x', this.canvas.height);
    
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    
    // Add fog for depth
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.15);
    
    // Camera
    const aspect = this.canvas.width > 0 && this.canvas.height > 0
      ? this.canvas.width / this.canvas.height
      : window.innerWidth / window.innerHeight;
    
    this.camera = new THREE.PerspectiveCamera(
      this.config.fov,
      aspect,
      0.1,
      1000
    );
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
      
      if (!this.renderer) {
        console.error('Three.js renderer creation returned null');
        return;
      }
      
      this.renderer.setSize(this.canvas.width, this.canvas.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setClearColor(0x05060a, 1);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      console.log('Three.js renderer created successfully');
    } catch (e) {
      console.error('Three.js WebGL renderer could not be created:', e);
      return;
    }
    
    // Lighting - strong backlight and rim light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);
    
    // Strong backlight (emissive glow source)
    const backLight = new THREE.DirectionalLight(0xff6b6b, 2.0);
    backLight.position.set(-5, 5, -10);
    backLight.castShadow = true;
    this.scene.add(backLight);
    
    // Rim light
    const rimLight = new THREE.DirectionalLight(0x4ecdc4, 1.5);
    rimLight.position.set(5, -5, 5);
    this.scene.add(rimLight);
    
    // Point lights for extra glow
    const pointLight1 = new THREE.PointLight(0xff6b6b, 1.5, 100);
    pointLight1.position.set(5, 5, 5);
    this.scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0x4ecdc4, 1.5, 100);
    pointLight2.position.set(-5, -5, 5);
    this.scene.add(pointLight2);
    
    // Create main morphing object
    this.createMainObject();
    
    // Create orbiting particles
    this.createOrbitObjects();
    
    this.rendererInitialized = true;
    console.log('Three.js renderer initialized successfully');
  }

  private createMainObject() {
    if (!this.scene) return;
    
    // Remove existing objects
    if (this.mainObject) {
      this.scene.remove(this.mainObject);
      this.mainObject.geometry.dispose();
      if (this.mainObject.material instanceof THREE.Material) {
        this.mainObject.material.dispose();
      }
    }
    if (this.wireframeObject) {
      this.scene.remove(this.wireframeObject);
      this.wireframeObject.geometry.dispose();
      if (this.wireframeObject.material instanceof THREE.Material) {
        this.wireframeObject.material.dispose();
      }
    }
    
    // Create geometry based on current shape
    const geometry = this.createGeometry(this.config.shapeFamily);
    
    // Emissive neon material with glow
    const material = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      emissive: 0xff3366,
      emissiveIntensity: 0.8 + this.features.energy * 0.2,
      metalness: 0.1,
      roughness: 0.1,
    });
    
    this.mainObject = new THREE.Mesh(geometry, material);
    this.mainObject.castShadow = true;
    this.mainObject.receiveShadow = true;
    this.scene.add(this.mainObject);
    
    // Wireframe overlay
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    
    this.wireframeObject = new THREE.Mesh(geometry.clone(), wireframeMaterial);
    this.scene.add(this.wireframeObject);
    
    console.log('Main 3D object created:', this.config.shapeFamily);
  }

  private createGeometry(shapeType: string): THREE.BufferGeometry {
    switch (shapeType) {
      case "sphere":
        return new THREE.SphereGeometry(1, 64, 64);
      case "torus":
        return new THREE.TorusGeometry(1, 0.4, 32, 100);
      case "cube":
        return new THREE.BoxGeometry(1.5, 1.5, 1.5, 8, 8, 8);
      case "polyhedra":
        return new THREE.OctahedronGeometry(1, 2);
      case "knot":
        return new THREE.TorusKnotGeometry(0.8, 0.3, 100, 32);
      default:
        return new THREE.SphereGeometry(1, 64, 64);
    }
  }

  private createOrbitObjects() {
    // Clear existing
    this.orbitObjects.forEach(obj => {
      this.scene.remove(obj);
      obj.geometry.dispose();
      if (obj.material instanceof THREE.Material) {
        obj.material.dispose();
      }
    });
    this.orbitObjects = [];
    
    const count = 30;
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.SphereGeometry(0.08, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(i / count, 1, 0.6),
        transparent: true,
        opacity: 0.9
      });
      const mesh = new THREE.Mesh(geometry, material);
      this.orbitObjects.push(mesh);
      this.scene.add(mesh);
    }
  }

  updateAnalysis(_analysis: ExtendedAudioAnalysisResponse | null) {
    // Analysis stored in engine
  }

  updateFeatures(_time: number, features: Features) {
    this.features = features;
    
    // Update morph progress
    this.morphProgress += this.config.morphSpeed * (1 + this.features.mid * 0.5);
    if (this.morphProgress >= 1.0) {
      this.morphProgress = 0;
      // Switch to next shape
      const currentIdx = this.shapes.indexOf(this.config.shapeFamily);
      this.config.shapeFamily = this.shapes[(currentIdx + 1) % this.shapes.length] as any;
      this.createMainObject();
    }
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
      if (this.rendererInitialized) {
        this.createMainObject();
      }
    }
    if (config.morph_speed !== undefined) {
      this.config.morphSpeed = config.morph_speed;
    }
    if (config.camera_fly_through_speed !== undefined) {
      this.config.cameraSpeed = config.camera_fly_through_speed;
    }
    if (config.orbit_radius !== undefined) {
      this.config.orbitRadius = config.orbit_radius;
    }
    if (config.field_of_view !== undefined && this.camera) {
      this.config.fov = config.field_of_view;
      this.camera.fov = config.field_of_view;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(width: number, height: number, profile?: QualityProfile) {
    if (profile) {
      this.qualityProfile = profile;
      if (!profile.use3D && this.rendererInitialized) {
        // Could simplify or hide scene
      }
    }
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    if (this.rendererInitialized && this.camera && this.renderer) {
      const aspect = width > 0 && height > 0 ? width / height : 1;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      // Adjust pixel ratio based on quality
      if (this.qualityProfile) {
        const pixelRatio = this.qualityProfile.level === "high" 
          ? Math.min(window.devicePixelRatio, 2)
          : this.qualityProfile.level === "medium"
          ? Math.min(window.devicePixelRatio, 1.5)
          : 1;
        this.renderer.setPixelRatio(pixelRatio);
      }
    } else if (!this.rendererInitialized && width > 0 && height > 0) {
      // Only initialize if quality allows 3D
      if (!this.qualityProfile || this.qualityProfile.use3D) {
        this.initThreeJS();
      }
    }
  }

  render(time: number) {
    if (!this.rendererInitialized) {
      this.initThreeJS();
      if (!this.rendererInitialized || !this.renderer || !this.camera || !this.scene) {
        return;
      }
    }
    
    if (!this.renderer || !this.camera || !this.scene) {
      return;
    }
    if (!this.mainObject) {
      this.createMainObject();
      if (!this.mainObject) {
        return;
      }
    }
    
    // Ensure object is in scene
    if (!this.scene.children.includes(this.mainObject)) {
      this.scene.add(this.mainObject);
    }
    if (this.wireframeObject && !this.scene.children.includes(this.wireframeObject)) {
      this.scene.add(this.wireframeObject);
    }
    
    // Audio-driven animation
    
    // Bass → scale pulses
    const bassScale = 1.0 + this.features.bass * 0.3 + this.features.beatPulse * 0.2;
    this.mainObject.scale.set(bassScale, bassScale, bassScale);
    if (this.wireframeObject) {
      this.wireframeObject.scale.set(bassScale, bassScale, bassScale);
    }
    
    // Mid → rotation speed
    const rotationSpeed = 0.01 + this.features.mid * 0.02;
    this.mainObject.rotation.x += rotationSpeed;
    this.mainObject.rotation.y += rotationSpeed * 1.3;
    this.mainObject.rotation.z += rotationSpeed * 0.7;
    if (this.wireframeObject) {
      this.wireframeObject.rotation.copy(this.mainObject.rotation);
    }
    
    // Treble → polygon displacement (via material emissive intensity)
    if (this.mainObject.material instanceof THREE.MeshStandardMaterial) {
      this.mainObject.material.emissiveIntensity = 0.8 + this.features.treble * 0.4 + this.features.energy * 0.3;
      
      // Color shift based on sentiment and energy
      const hue = (this.features.lyricSentiment * 0.3 + this.features.energy * 0.2 + time * 0.1) % 1.0;
      const color = new THREE.Color().setHSL(hue, 0.9, 0.6);
      this.mainObject.material.emissive = color;
      this.mainObject.material.color = color;
    }
    
    // Beat → shockwave (quick scale flash)
    if (this.features.beatPulse > 0.5) {
      const beatScale = 1.0 + this.features.beatPulse * 0.5;
      this.mainObject.scale.set(beatScale, beatScale, beatScale);
      if (this.wireframeObject) {
        this.wireframeObject.scale.set(beatScale, beatScale, beatScale);
      }
    }
    
    // Camera rotation and zoom
    this.cameraAngle += this.config.cameraSpeed * (1 + this.features.mid * 0.5);
    const radius = this.config.orbitRadius + Math.sin(time * 0.5) * 1.0;
    const cameraX = Math.cos(this.cameraAngle) * radius;
    const cameraY = Math.sin(this.cameraAngle * 0.7) * 2.0;
    const cameraZ = Math.sin(this.cameraAngle) * radius;
    
    this.camera.position.set(cameraX, cameraY, cameraZ);
    this.camera.lookAt(0, 0, 0);
    
    // Update orbiting particles
    this.orbitObjects.forEach((obj, i) => {
      const angle = (i / this.orbitObjects.length) * Math.PI * 2 + time * 0.5;
      const orbitRadius = 3.0 + this.features.bass * 1.0;
      obj.position.set(
        Math.cos(angle) * orbitRadius,
        Math.sin(angle * 2) * 1.5,
        Math.sin(angle) * orbitRadius
      );
      
      // Pulse with beat
      const scale = 1.0 + this.features.beatPulse * 0.5;
      obj.scale.set(scale, scale, scale);
    });
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
}

/**
 * 3D Visualizer using Three.js
 * Features: morphing shapes, camera fly-through, audio-reactive visuals
 */
import * as THREE from 'three';
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
  emotion?: string;
}

export class ThreeDRenderer {
  private canvas: HTMLCanvasElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private mainObject: THREE.Mesh | null = null;
  private orbitObjects: THREE.Mesh[] = [];
  private currentShape: string = "sphere";
  private morphTarget: string = "torus";
  private morphProgress: number = 0;
  private cameraPath: THREE.Vector3[] = [];
  private cameraPathIndex: number = 0;
  private currentTime: number = 0;
  
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

  constructor(canvas: HTMLCanvasElement, _analysis: ExtendedAudioAnalysisResponse | null) {
    this.canvas = canvas;
    // Don't initialize Three.js renderer in constructor - do it lazily when rendering
  }

  private initThreeJS() {
    if (this.rendererInitialized) return;
    
    // Ensure canvas has valid dimensions
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width || window.innerWidth;
      this.canvas.height = rect.height || window.innerHeight;
    }
    
    console.log('Initializing Three.js renderer with canvas size:', this.canvas.width, 'x', this.canvas.height);
    
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    
    // Camera - use safe aspect ratio calculation
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
    
    // Renderer - create with explicit context options
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
      console.log('Three.js renderer created successfully');
    } catch (e) {
      console.error('Three.js WebGL renderer could not be created:', e);
      return;
    }
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
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
    
    // Generate camera path
    this.generateCameraPath();
    
    this.rendererInitialized = true;
    console.log('Three.js renderer initialized successfully');
  }

  private createMainObject() {
    if (!this.scene) return;
    
    // Remove existing object if any
    if (this.mainObject) {
      this.scene.remove(this.mainObject);
      this.mainObject.geometry.dispose();
      if (this.mainObject.material instanceof THREE.Material) {
        this.mainObject.material.dispose();
      }
    }
    
    // Create geometry based on current shape
    const geometry = this.createGeometry(this.config.shapeFamily);
    
    // Material with emission for glow
    const material = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      emissive: 0x331122,
      emissiveIntensity: 0.4,
      metalness: 0.8,
      roughness: 0.2,
    });
    
    this.mainObject = new THREE.Mesh(geometry, material);
    this.scene.add(this.mainObject);
    console.log('Main 3D object created:', this.config.shapeFamily);
  }

  private createGeometry(shapeType: string): THREE.BufferGeometry {
    switch (shapeType) {
      case "sphere":
        return new THREE.SphereGeometry(1, 32, 32);
      case "torus":
        return new THREE.TorusGeometry(1, 0.4, 16, 100);
      case "cube":
        return new THREE.BoxGeometry(1.5, 1.5, 1.5);
      case "polyhedra":
        return new THREE.OctahedronGeometry(1, 1);
      case "knot":
        return new THREE.TorusKnotGeometry(0.8, 0.3, 100, 16);
      default:
        return new THREE.SphereGeometry(1, 32, 32);
    }
  }

  private createOrbitObjects() {
    const count = 20;
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.SphereGeometry(0.1, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(i / count, 1, 0.5),
        transparent: true,
        opacity: 0.8
      });
      const mesh = new THREE.Mesh(geometry, material);
      this.orbitObjects.push(mesh);
      this.scene.add(mesh);
    }
  }

  private generateCameraPath() {
    // Generate a smooth path around/through the object
    const segments = 50;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const radius = 6 + Math.sin(t * 2) * 2;
      const x = Math.cos(t) * radius;
      const y = Math.sin(t * 0.5) * 3;
      const z = Math.sin(t) * radius;
      this.cameraPath.push(new THREE.Vector3(x, y, z));
    }
  }

  updateAnalysis(_analysis: ExtendedAudioAnalysisResponse | null) {
    // Analysis stored in engine
  }

  updateFeatures(time: number, features: Features) {
    this.currentTime = time;
    this.features = features;
    
    // Update morph progress
    this.morphProgress += this.config.morphSpeed * (1 + this.features.mid * 0.5);
    if (this.morphProgress >= 1.0) {
      this.morphProgress = 0;
      // Switch to next shape
      const shapes: string[] = ["sphere", "torus", "cube", "polyhedra", "knot"];
      const currentIdx = shapes.indexOf(this.currentShape);
      this.morphTarget = shapes[(currentIdx + 1) % shapes.length];
      this.currentShape = this.morphTarget;
    }
    
    // Update camera based on section
    this.updateCameraPath();
  }

  private updateCameraPath() {
    const section = this.features.currentSection;
    
    // Different camera behaviors per section
    switch (section) {
      case "intro":
        this.config.cameraSpeed = 0.3;
        this.config.orbitRadius = 7;
        break;
      case "verse":
        this.config.cameraSpeed = 0.4;
        this.config.orbitRadius = 6;
        break;
      case "chorus":
        this.config.cameraSpeed = 0.6;
        this.config.orbitRadius = 5;
        break;
      case "drop":
        this.config.cameraSpeed = 1.0;
        this.config.orbitRadius = 4;
        break;
      default:
        this.config.cameraSpeed = 0.5;
        this.config.orbitRadius = 5;
    }
  }

  setShapeFamily(family: "sphere" | "torus" | "cube" | "polyhedra" | "knot") {
    this.config.shapeFamily = family;
    if (this.mainObject) {
      const newGeometry = this.createGeometry(family);
      this.mainObject.geometry.dispose();
      this.mainObject.geometry = newGeometry;
    }
  }

  setMorphSpeed(speed: number) {
    this.config.morphSpeed = speed;
  }

  setCameraSpeed(speed: number) {
    this.config.cameraSpeed = speed;
  }

  setOrbitRadius(radius: number) {
    this.config.orbitRadius = radius;
  }

  setFOV(fov: number) {
    this.config.fov = fov;
    if (this.rendererInitialized && this.camera) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Only resize if Three.js is initialized
    if (this.rendererInitialized && this.camera && this.renderer) {
      const aspect = width > 0 && height > 0 ? width / height : 1;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    } else if (!this.rendererInitialized && width > 0 && height > 0) {
      // If not initialized yet but we have dimensions, try to initialize
      // This will be called on first render anyway, but this ensures dimensions are set
    }
  }

  render(time: number) {
    // Lazy initialization of Three.js
    if (!this.rendererInitialized) {
      this.initThreeJS();
      if (!this.rendererInitialized || !this.renderer || !this.camera || !this.scene) {
        console.warn('Three.js initialization failed, using fallback');
        // Fallback rendering
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgb(5, 6, 10)';
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          ctx.fillStyle = 'rgba(0, 170, 255, 0.5)';
          ctx.font = '24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('3D Mode: Initializing...', this.canvas.width / 2, this.canvas.height / 2);
        }
        return;
      }
      
      // Update camera aspect after initialization
      if (this.canvas.width > 0 && this.canvas.height > 0) {
        this.camera.aspect = this.canvas.width / this.canvas.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.canvas.width, this.canvas.height);
      }
    }
    
    // Safety check before rendering
    if (!this.renderer || !this.camera || !this.scene) {
      return;
    }
    if (!this.mainObject) {
      // Try to create main object if it doesn't exist
      this.createMainObject();
      if (!this.mainObject) {
        return;
      }
    }
    
    // Update main object
    const bass = this.features.bass;
    const mid = this.features.mid;
    const treble = this.features.treble;
    const energy = this.features.energy;
    const beatPulse = this.features.beatPulse;
    
    // Scale based on bass
    const scale = 1.0 + bass * 0.5 + beatPulse * 0.3;
    this.mainObject.scale.set(scale, scale, scale);
    
    // Rotation based on mid
    this.mainObject.rotation.x += mid * 0.02;
    this.mainObject.rotation.y += mid * 0.03;
    this.mainObject.rotation.z += treble * 0.01;
    
    // Displacement/noise on vertices based on treble (simplified to avoid performance issues)
    // Instead of modifying geometry, we'll use scale variation
    if (treble > 0.3) {
      const noiseScale = 1.0 + treble * 0.1 * Math.sin(time * 3);
      this.mainObject.scale.multiplyScalar(noiseScale / this.mainObject.scale.x);
    }
    
    // Update material color based on emotion and sentiment
    if (this.mainObject.material instanceof THREE.MeshStandardMaterial) {
      const sentiment = this.features.lyricSentiment;
      const emotion = this.features.emotion || "neutral";
      
      // Color mapping
      let hue = 0;
      if (emotion === "happy") hue = 0.15; // Yellow
      else if (emotion === "sad") hue = 0.6; // Blue
      else if (emotion === "angry") hue = 0.0; // Red
      else if (emotion === "chill") hue = 0.5; // Cyan
      else hue = 0.3; // Green
      
      hue += sentiment * 0.1;
      
      const color = new THREE.Color().setHSL(hue, 0.8, 0.5);
      this.mainObject.material.color = color;
      this.mainObject.material.emissive = color.clone().multiplyScalar(0.3);
      this.mainObject.material.emissiveIntensity = 0.3 + this.features.lyricIntensity * 0.5;
    }
    
    // Update FOV based on bass (with limits)
    const targetFOV = this.config.fov + bass * 10;
    this.camera.fov = Math.max(50, Math.min(100, targetFOV));
    this.camera.updateProjectionMatrix();
    
    // Camera movement along path
    if (this.cameraPath.length > 0) {
      this.cameraPathIndex = (this.cameraPathIndex + this.config.cameraSpeed * 0.01) % this.cameraPath.length;
      const currentIdx = Math.floor(this.cameraPathIndex) % this.cameraPath.length;
      const nextIdx = (currentIdx + 1) % this.cameraPath.length;
      const alpha = this.cameraPathIndex % 1;
      
      const currentPos = this.cameraPath[currentIdx];
      const nextPos = this.cameraPath[nextIdx];
      
      this.camera.position.lerpVectors(currentPos, nextPos, alpha);
      this.camera.lookAt(0, 0, 0);
      
      // Beat pulse camera kick
      if (beatPulse > 0.3) {
        const direction = this.camera.position.clone().normalize();
        this.camera.position.addScaledVector(direction, beatPulse * 0.3);
      }
    }
    
    // Update orbit objects
    for (let i = 0; i < this.orbitObjects.length; i++) {
      const obj = this.orbitObjects[i];
      const angle = (this.currentTime * 0.5 + (i / this.orbitObjects.length) * Math.PI * 2);
      const radius = this.config.orbitRadius + energy * 2;
      obj.position.x = Math.cos(angle) * radius;
      obj.position.y = Math.sin(angle * 0.7) * radius * 0.5;
      obj.position.z = Math.sin(angle) * radius;
      
      // Scale with treble
      const objScale = 0.1 + treble * 0.2;
      obj.scale.set(objScale, objScale, objScale);
    }
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }

  setThreeDConfig(config: {
    shape_family?: string;
    morph_speed?: number;
    camera_fly_through_speed?: number;
    orbit_radius?: number;
    field_of_view?: number;
    depth_distortion?: number;
  }) {
    if (config.shape_family) {
      this.config.shapeFamily = config.shape_family as any;
      if (this.rendererInitialized && this.mainObject) {
        const newGeometry = this.createGeometry(config.shape_family);
        this.mainObject.geometry.dispose();
        this.mainObject.geometry = newGeometry;
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
    if (config.field_of_view !== undefined) {
      this.config.fov = config.field_of_view;
      if (this.rendererInitialized && this.camera) {
        this.camera.fov = config.field_of_view;
        this.camera.updateProjectionMatrix();
      }
    }
  }
}


import { ExtendedAudioAnalysisResponse } from '../types/timeline';
import { fractalComplexShader } from '../shaders/fractalComplex';
import { kaleidoscopeComplexShader } from '../shaders/kaleidoscopeComplex';
import { vortexComplexShader } from '../shaders/vortexComplex';
import { plasmaComplexShader } from '../shaders/plasmaComplex';

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

export class PsychedelicRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private features: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro",
    emotion: "chill"
  };

  private program: WebGLProgram | null = null;
  private prevProgram: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private startTime: number = performance.now() / 1000;
  private transitionProgress: number = 1.0;
  private transitionStartTime: number = 0;
  private transitionDuration: number = 800; // 0.8 seconds
  
  // Smoothed features
  private smoothedFeatures: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro",
    emotion: "chill"
  };
  private smoothingFactor: number = 0.2;
  
  // Shader programs cache
  private shaderPrograms: Map<number, WebGLProgram> = new Map();

  constructor(canvas: HTMLCanvasElement, _analysis: ExtendedAudioAnalysisResponse | null) {
    this.canvas = canvas;
    // Don't initialize WebGL in constructor - do it lazily when rendering
  }

  private initWebGL() {
    if (this.gl) return; // Already initialized
    
    // Try to get existing WebGL context or create new one
    const gl = this.canvas.getContext('webgl', {
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      antialias: true
    }) || this.canvas.getContext('experimental-webgl', {
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      antialias: true
    });
    
    if (!gl || !(gl instanceof WebGLRenderingContext)) {
      console.error('WebGL not supported, psychedelic mode will use fallback rendering');
      console.error('Canvas context:', this.canvas.getContext('2d') ? '2D available' : 'No context');
      return;
    }
    this.gl = gl;
    
    // Enable depth testing and blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Create position buffer once
    this.positionBuffer = gl.createBuffer();
    if (!this.positionBuffer) {
      console.error('Failed to create position buffer');
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]), gl.STATIC_DRAW);
    
    // Load default shader (fractal zoom)
    this.loadShader(0);
    
    // Verify shader loaded
    if (!this.program) {
      console.error('Failed to load default shader');
    } else {
      console.log('Psychedelic renderer initialized with WebGL');
    }
  }
  
  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  setShaderVariant(variant: string | number) {
    // Map string variants to numbers
    const variantMap: Record<string, number> = {
      "fractal_zoom": 0,
      "kaleidoscope": 1,
      "vortex_tunnel": 2,
      "plasma": 3,
    };
    const variantNum = typeof variant === 'string' ? (variantMap[variant] ?? 0) : variant;
    this.loadShader(variantNum);
  }

  setIntensity(_intensity: number) {
    // Intensity can be used in shader uniforms if needed
  }

  private loadShader(variant: number) {
    if (!this.gl) {
      console.error('Cannot load shader: WebGL context not initialized');
      return;
    }
    
    // Check cache first
    if (this.shaderPrograms.has(variant)) {
      this.prevProgram = this.program;
      this.program = this.shaderPrograms.get(variant)!;
      this.transitionStartTime = performance.now();
      this.transitionProgress = 0.0;
      return;
    }

    let fragmentShaderSource: string;
    const variantNames = ['fractal_zoom', 'kaleidoscope', 'vortex_tunnel', 'plasma'];
    switch (variant) {
      case 0:
        fragmentShaderSource = fractalComplexShader;
        break;
      case 1:
        fragmentShaderSource = kaleidoscopeComplexShader;
        break;
      case 2:
        fragmentShaderSource = vortexComplexShader;
        break;
      case 3:
        fragmentShaderSource = plasmaComplexShader;
        break;
      default:
        fragmentShaderSource = fractalComplexShader;
    }

    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader) {
      console.error(`Failed to compile vertex shader for variant ${variant}`);
      return;
    }
    if (!fragmentShader) {
      console.error(`Failed to compile fragment shader for variant ${variant} (${variantNames[variant] || 'unknown'})`);
      return;
    }

    const program = this.gl.createProgram();
    if (!program) {
      console.error('Failed to create shader program');
      return;
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program);
      console.error(`Shader program link error for variant ${variant}:`, error);
      this.gl.deleteProgram(program);
      return;
    }

    // Clean up shaders after linking
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    this.prevProgram = this.program;
    this.program = program;
    this.shaderPrograms.set(variant, program);
    
    console.log(`Loaded shader variant ${variant}: ${variantNames[variant] || 'unknown'}`);
    
    // Start transition
    this.transitionStartTime = performance.now();
    this.transitionProgress = 0.0;
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  updateAnalysis(_analysis: ExtendedAudioAnalysisResponse | null) {
    // Analysis stored in engine, not needed here
  }

  updateFeatures(_time: number, features: Features) {
    // Smooth interpolation for fluid visuals
    this.smoothedFeatures.bass = this.lerp(this.smoothedFeatures.bass, features.bass, this.smoothingFactor);
    this.smoothedFeatures.mid = this.lerp(this.smoothedFeatures.mid, features.mid, this.smoothingFactor);
    this.smoothedFeatures.treble = this.lerp(this.smoothedFeatures.treble, features.treble, this.smoothingFactor);
    this.smoothedFeatures.energy = this.lerp(this.smoothedFeatures.energy, features.energy, this.smoothingFactor);
    this.smoothedFeatures.beatPulse = this.lerp(this.smoothedFeatures.beatPulse, features.beatPulse, 0.4);
    this.smoothedFeatures.lyricIntensity = this.lerp(this.smoothedFeatures.lyricIntensity, features.lyricIntensity, this.smoothingFactor);
    this.smoothedFeatures.lyricSentiment = features.lyricSentiment;
    this.smoothedFeatures.lyricEnergy = features.lyricEnergy;
    this.smoothedFeatures.currentSection = features.currentSection;
    this.smoothedFeatures.emotion = features.emotion || "chill";
    
    this.features = this.smoothedFeatures;
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
      // Reset start time on resize to prevent jump
      this.startTime = performance.now() / 1000;
    }
  }

  render(time: number) {
    // Lazy initialization of WebGL
    if (!this.gl) {
      this.initWebGL();
      if (!this.gl || !this.program) {
        // Fallback: draw a simple pattern if WebGL not available
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgb(5, 6, 10)';
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          
          // Draw a simple animated pattern
          const centerX = this.canvas.width / 2;
          const centerY = this.canvas.height / 2;
          const radius = 50 + Math.sin(time * 2) * 30;
          ctx.fillStyle = `hsl(${time * 50 % 360}, 70%, 50%)`;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }
    }
    
    if (!this.program || !this.positionBuffer) {
      console.warn('Psychedelic renderer: program or buffer not ready');
      return;
    }

    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas
    gl.clearColor(0.02, 0.024, 0.04, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    // Set attributes using pre-created buffer
    const positionLocation = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set uniforms - use continuous time for smooth animation
    // Update transition progress
    const now = performance.now();
    if (this.transitionProgress < 1.0) {
      this.transitionProgress = Math.min(
        (now - this.transitionStartTime) / this.transitionDuration,
        1.0
      );
    }
    
    const shaderTime = (performance.now() / 1000) - this.startTime;
    
    // Render with crossfade if transitioning
    if (this.prevProgram && this.transitionProgress < 1.0) {
      // Render previous shader
      gl.useProgram(this.prevProgram);
      this.setUniforms(gl, this.prevProgram, shaderTime, width, height, 1.0 - this.transitionProgress);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      
      // Render new shader with blend
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.program);
      this.setUniforms(gl, this.program, shaderTime, width, height, this.transitionProgress);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disable(gl.BLEND);
    } else {
      // Normal render
      gl.useProgram(this.program);
      this.setUniforms(gl, this.program, shaderTime, width, height, 1.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
  
  private setUniforms(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    shaderTime: number,
    width: number,
    height: number,
    _alpha: number
  ) {
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const bassLocation = gl.getUniformLocation(program, 'u_bass');
    const midLocation = gl.getUniformLocation(program, 'u_mid');
    const trebleLocation = gl.getUniformLocation(program, 'u_treble');
    const energyLocation = gl.getUniformLocation(program, 'u_energy');
    const beatPulseLocation = gl.getUniformLocation(program, 'u_beat_pulse');
    const lyricIntensityLocation = gl.getUniformLocation(program, 'u_lyric_intensity');
    const sentimentLocation = gl.getUniformLocation(program, 'u_sentiment');
    const sectionTypeLocation = gl.getUniformLocation(program, 'u_section_type');
    const emotionCodeLocation = gl.getUniformLocation(program, 'u_emotion_code');

    if (timeLocation) gl.uniform1f(timeLocation, shaderTime);
    if (resolutionLocation) gl.uniform2f(resolutionLocation, width, height);
    if (bassLocation) gl.uniform1f(bassLocation, this.features.bass);
    if (midLocation) gl.uniform1f(midLocation, this.features.mid);
    if (trebleLocation) gl.uniform1f(trebleLocation, this.features.treble);
    if (energyLocation) gl.uniform1f(energyLocation, this.features.energy);
    if (beatPulseLocation) gl.uniform1f(beatPulseLocation, this.features.beatPulse);
    if (lyricIntensityLocation) gl.uniform1f(lyricIntensityLocation, this.features.lyricIntensity);
    if (sentimentLocation) gl.uniform1f(sentimentLocation, this.features.lyricSentiment);
    
    // Section type mapping
    const sectionMap: Record<string, number> = {
      "intro": 0, "verse": 1, "chorus": 2, "drop": 3, "bridge": 4, "outro": 5
    };
    if (sectionTypeLocation) {
      gl.uniform1i(sectionTypeLocation, sectionMap[this.features.currentSection] || 0);
    }
    
    // Emotion code (simple hash)
    const emotionMap: Record<string, number> = {
      "happy": 0.2, "sad": 0.4, "angry": 0.6, "chill": 0.8, "hopeful": 0.1
    };
    if (emotionCodeLocation) {
      const emotion = this.features.emotion || "chill";
      gl.uniform1f(emotionCodeLocation, emotionMap[emotion] || 0.5);
    }
  }
}


/**
 * Advanced psychedelic renderer with complex GLSL shaders
 * Features: fractals, kaleidoscope, vortex distortion, chromatic aberration, bloom
 */
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

export class PsychedelicRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private qualityLevelValue: number = 2;
  private features: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro",
    emotion: "chill"
  };

  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private startTime: number = performance.now() / 1000;
  
  // Smoothed features
  private smoothedFeatures: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro",
    emotion: "chill"
  };
  private smoothingFactor: number = 0.15;

  constructor(canvas: HTMLCanvasElement, _analysis: ExtendedAudioAnalysisResponse | null) {
    this.canvas = canvas;
  }

  setQualityProfile(profile: QualityProfile) {
    this.qualityLevelValue = profile.level === "high" ? 2 : profile.level === "medium" ? 1 : 0;
  }

  private initWebGL() {
    if (this.gl) return;
    
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width || window.innerWidth;
      this.canvas.height = rect.height || window.innerHeight;
    }
    
    let gl: WebGLRenderingContext | null = null;
    
    try {
      gl = this.canvas.getContext('webgl', {
        alpha: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        antialias: true,
        depth: false,
        stencil: false
      }) as WebGLRenderingContext | null;
    } catch (e) {
      console.warn('Standard WebGL failed:', e);
    }
    
    if (!gl || !(gl instanceof WebGLRenderingContext)) {
      console.error('WebGL not supported');
      return;
    }
    
    this.gl = gl;
    
    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Create position buffer
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
    
    // Create shader program
    this.program = this.createPsychedelicProgram(gl);
    
    if (!this.program) {
      console.error('Failed to create psychedelic shader program');
    } else {
      console.log('Psychedelic renderer initialized with advanced shader');
    }
  }
  
  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  setShaderVariant(_variant: string | number) {
    // Variant switching can be implemented if needed
  }

  setIntensity(_intensity: number) {
    // Intensity handled via uniforms
  }

  private createPsychedelicProgram(gl: WebGLRenderingContext): WebGLProgram {
    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    
    const fragmentShaderSource = `
      precision highp float;
      
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_quality;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_energy;
      uniform float u_beat_pulse;
      uniform float u_lyric_intensity;
      uniform float u_sentiment;
      uniform int u_section_type;
      uniform float u_emotion_code;
      
      // Simplex noise
      vec3 mod289(vec3 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }
      
      vec4 mod289(vec4 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }
      
      vec4 permute(vec4 x) {
        return mod289(((x*34.0)+1.0)*x);
      }
      
      vec4 taylorInvSqrt(vec4 r) {
        return 1.79284291400159 - 0.85373472095314 * r;
      }
      
      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        
        i = mod289(i);
        vec4 p = permute(permute(permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }
      
      // Fractal Brownian Motion
      float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        float octaveCount = mix(2.0, 5.0, clamp(u_quality / 2.0, 0.0, 1.0));
        for (int i = 0; i < 5; i++) {
          if (float(i) >= octaveCount) break;
          value += amplitude * snoise(p * frequency);
          frequency *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }
      
      // Ridged noise
      float ridgedNoise(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        float octaveCount = mix(1.0, 4.0, clamp(u_quality / 2.0, 0.0, 1.0));
        for (int i = 0; i < 4; i++) {
          if (float(i) >= octaveCount) break;
          float n = abs(snoise(p * frequency));
          value += amplitude * (1.0 - n);
          frequency *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }
      
      // HSV to RGB
      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }
      
      // Kaleidoscope function
      vec2 kaleidoscope(vec2 uv, float segments) {
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        
        angle = mod(angle, 2.0 * 3.14159 / segments) * 2.0;
        if (angle > 3.14159 / segments) {
          angle = 2.0 * 3.14159 / segments - angle;
        }
        
        return vec2(cos(angle), sin(angle)) * radius;
      }
      
      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        vec2 center = vec2(0.0);
        
        // Dynamic zoom with bass modulation
        float baseZoom = 1.2 + u_time * 0.06;
        float zoom = baseZoom + u_bass * 5.0;
        float rotation = u_time * 0.2 + u_mid * 0.5;
        
        // Rotate and scale
        vec2 p = uv * zoom;
        float c = cos(rotation);
        float s = sin(rotation);
        p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
        
        // Energy-based offset for swirling
        p += vec2(
          sin(u_time * 0.3 + p.x * 0.5) * u_energy * 0.4,
          cos(u_time * 0.4 + p.y * 0.5) * u_energy * 0.4
        );
        
        // Beat pulse creates "breathing" effect
        float pulse = 1.0 + u_beat_pulse * 0.3;
        p *= pulse;
        
        // Kaleidoscope effect (modulated by mid)
        float segments = 6.0 + u_mid * 6.0;
        vec2 kaleid = kaleidoscope(p, segments);
        
        // Vortex distortion
        float angle = atan(kaleid.y, kaleid.x);
        float radius = length(kaleid);
        float vortex = u_mid * 2.0;
        angle += vortex * radius + u_time * 0.5;
        vec2 vortexP = vec2(cos(angle), sin(angle)) * radius;
        
        // Fractal noise fields
        vec3 noiseCoord = vec3(vortexP * 2.0, u_time * 0.1);
        float fbmValue = fbm(noiseCoord);
        float ridgedValue = ridgedNoise(noiseCoord * 1.5);
        
        // Combine noise patterns
        float pattern = fbmValue * 0.6 + ridgedValue * 0.4;
        pattern += sin(vortexP.x * 5.0 + u_time) * 0.1;
        pattern += sin(vortexP.y * 5.0 + u_time * 1.1) * 0.1;
        
        // Treble adds high-frequency shimmer
        float shimmer = sin(vortexP.x * 20.0 + u_time * 3.0) * sin(vortexP.y * 20.0 + u_time * 3.2);
        pattern += shimmer * u_treble * 0.2;
        
        // Color palette - neon gradients
        float hue1 = fract(pattern * 0.7 + u_time * 0.08 + u_lyric_intensity * 0.6);
        float hue2 = fract(pattern * 0.5 + u_time * 0.12 + u_bass * 0.4);
        float hue = mix(hue1, hue2, sin(u_time * 0.6) * 0.5 + 0.5);
        
        // Sentiment affects base hue (warm vs cool)
        hue += u_sentiment * 0.15;
        hue = fract(hue);
        
        // High saturation for vibrant neon colors
        float saturation = 0.9 + u_energy * 0.1;
        
        // Bright, glowing values
        float value = 0.4 + pattern * 0.6 + u_beat_pulse * 0.6;
        
        vec3 color = hsv2rgb(vec3(hue, saturation, value));
        
        // Radial glow from center
        float distFromCenter = length(uv);
        float centerGlow = 1.0 - smoothstep(0.0, 0.9, distFromCenter);
        color += centerGlow * 0.4 * vec3(1.0, 0.9, 0.7) * u_energy;
        
        // Beat pulse creates expanding waves
        float pulseWave = sin((distFromCenter - u_beat_pulse * 3.0) * 25.0) * 0.5 + 0.5;
        color *= 1.0 + pulseWave * u_beat_pulse * 0.9;
        
        // Energy-based intensity
        color *= 0.85 + u_energy * 0.7;
        
        // Chromatic aberration for depth (treble-driven)
        float aberration = u_treble * 0.04;
        vec3 colorR = hsv2rgb(vec3(hue + aberration, saturation, value));
        vec3 colorB = hsv2rgb(vec3(hue - aberration, saturation, value));
        color = vec3(colorR.r, color.g, colorB.b);
        
        // Sparkle from treble
        float sparkle = sin(uv.x * 60.0 + u_time * 3.0) * sin(uv.y * 60.0 + u_time * 3.2);
        color += sparkle * u_treble * 0.2;
        
        // Bloom effect from beat
        float bloom = u_beat_pulse * 0.5;
        color += vec3(bloom);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    return this.createShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
  }

  private createShaderProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    
    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to compile shaders');
    }
    
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create program');
    }
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error('Failed to link program: ' + info);
    }
    
    return program;
  }

  private compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      console.error('Shader compile error:', info);
      return null;
    }
    
    return shader;
  }

  updateAnalysis(_analysis: ExtendedAudioAnalysisResponse | null) {
    // Analysis stored in engine
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

  resize(width: number, height: number, profile?: QualityProfile) {
    if (profile) {
      this.qualityLevelValue = profile.level === "high" ? 2 : profile.level === "medium" ? 1 : 0;
      // Quality fallback handled by allowWebGL check in initWebGL
    }
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
      this.startTime = performance.now() / 1000;
    }
  }

  render(_time: number) {
    if (!this.gl || !this.program) {
      this.initWebGL();
      if (!this.gl || !this.program || !this.positionBuffer) {
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgb(5, 6, 10)';
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        return;
      }
    }
    
    if (!this.program || !this.positionBuffer) {
      return;
    }

    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas
    gl.clearColor(0.02, 0.024, 0.04, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    // Set attributes
    const positionLocation = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set uniforms
    const shaderTime = (performance.now() / 1000) - this.startTime;
    
    const timeLocation = gl.getUniformLocation(this.program, 'u_time');
    const qualityLocation = gl.getUniformLocation(this.program, 'u_quality');
    const resolutionLocation = gl.getUniformLocation(this.program, 'u_resolution');
    const bassLocation = gl.getUniformLocation(this.program, 'u_bass');
    const midLocation = gl.getUniformLocation(this.program, 'u_mid');
    const trebleLocation = gl.getUniformLocation(this.program, 'u_treble');
    const energyLocation = gl.getUniformLocation(this.program, 'u_energy');
    const beatPulseLocation = gl.getUniformLocation(this.program, 'u_beat_pulse');
    const lyricIntensityLocation = gl.getUniformLocation(this.program, 'u_lyric_intensity');
    const sentimentLocation = gl.getUniformLocation(this.program, 'u_sentiment');
    const sectionTypeLocation = gl.getUniformLocation(this.program, 'u_section_type');
    const emotionCodeLocation = gl.getUniformLocation(this.program, 'u_emotion_code');

    if (timeLocation) gl.uniform1f(timeLocation, shaderTime);
    if (qualityLocation) gl.uniform1f(qualityLocation, this.qualityLevelValue);
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
      "happy": 0.8, "sad": 0.2, "angry": 0.5, "chill": 0.6, "energetic": 0.9
    };
    if (emotionCodeLocation) {
      gl.uniform1f(emotionCodeLocation, emotionMap[this.features.emotion || "chill"] || 0.5);
    }

    // Draw full-screen quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

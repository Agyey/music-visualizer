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
    
    // Check if canvas already has a WebGL context
    let gl: WebGLRenderingContext | null = null;
    
    try {
      // Try to get existing context first
      gl = this.canvas.getContext('webgl') as WebGLRenderingContext | null;
      if (!gl) {
        // Create new context
        gl = this.canvas.getContext('webgl', {
          alpha: false,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
          antialias: true,
          depth: false,
          stencil: false
        }) as WebGLRenderingContext | null;
      }
    } catch (e) {
      console.warn('WebGL context creation failed:', e);
    }
    
    if (!gl || !(gl instanceof WebGLRenderingContext)) {
      console.warn('WebGL not available for psychedelic renderer, using fallback');
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
      console.error('Failed to create psychedelic shader program, will use fallback rendering');
      this.gl = null; // Mark as failed so fallback is used
    } else {
      console.log('Psychedelic renderer initialized with advanced shader');
    }
  }
  
  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  private patternType: number = 0; // 0=auto, 1=mandelbrot, 2=julia, 3=burning_ship, 4=spiral, 5=lissajous, 6=rose
  
  setShaderVariant(variant: string | number) {
    if (typeof variant === "number") {
      // Direct number mapping: 0=fractal_zoom, 1=kaleidoscope, 2=vortex_tunnel, 3=plasma
      const variantMap: Record<number, number> = {
        0: 1, // fractal_zoom -> mandelbrot
        1: 2, // kaleidoscope -> julia
        2: 3, // vortex_tunnel -> burning_ship
        3: 4, // plasma -> spiral
      };
      this.patternType = variantMap[variant] || 0;
    } else {
      // Map string names to pattern type numbers
      const variantMap: Record<string, number> = {
        "fractal_zoom": 1,    // mandelbrot
        "kaleidoscope": 2,    // julia
        "vortex_tunnel": 3,   // burning_ship
        "plasma": 4,          // spiral
        "mandelbrot": 1,
        "julia": 2,
        "burning_ship": 3,
        "spiral": 4,
        "lissajous": 5,
        "rose": 6,
        "auto": 0,
      };
      this.patternType = variantMap[variant.toLowerCase()] || 0;
    }
  }

  setIntensity(_intensity: number) {
    // Intensity handled via uniforms
  }

  private createPsychedelicProgram(gl: WebGLRenderingContext): WebGLProgram | null {
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
      uniform int u_pattern_type; // 0=auto, 1=mandelbrot, 2=julia, 3=burning_ship, 4=spiral, 5=lissajous, 6=rose
      
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
      
      // Mandelbrot set fractal
      float mandelbrot(vec2 c, int maxIter) {
        vec2 z = vec2(0.0);
        for (int i = 0; i < 100; i++) {
          if (i >= maxIter) break;
          if (dot(z, z) > 4.0) {
            return float(i) / float(maxIter);
          }
          z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        }
        return 0.0;
      }
      
      // Julia set fractal
      float julia(vec2 z, vec2 c, int maxIter) {
        for (int i = 0; i < 100; i++) {
          if (i >= maxIter) break;
          if (dot(z, z) > 4.0) {
            return float(i) / float(maxIter);
          }
          z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        }
        return 0.0;
      }
      
      // Burning Ship fractal
      float burningShip(vec2 c, int maxIter) {
        vec2 z = vec2(0.0);
        for (int i = 0; i < 100; i++) {
          if (i >= maxIter) break;
          if (dot(z, z) > 4.0) {
            return float(i) / float(maxIter);
          }
          z = vec2(z.x * z.x - z.y * z.y, abs(2.0 * z.x * z.y)) + c;
        }
        return 0.0;
      }
      
      // Spiral pattern
      float spiralPattern(vec2 p, float arms, float tightness) {
        float angle = atan(p.y, p.x);
        float radius = length(p);
        float spiral = sin(angle * arms + radius * tightness);
        return spiral * 0.5 + 0.5;
      }
      
      // Lissajous curve pattern
      float lissajous(vec2 p, float a, float b, float delta) {
        float t = atan(p.y, p.x) + u_time;
        float x = sin(a * t + delta);
        float y = sin(b * t);
        vec2 curve = vec2(x, y);
        float dist = length(p - curve * 0.3);
        return 1.0 - smoothstep(0.0, 0.2, dist);
      }
      
      // Rose curve pattern
      float roseCurve(vec2 p, float k) {
        float angle = atan(p.y, p.x);
        float radius = length(p);
        float rose = sin(k * angle);
        float dist = abs(radius - rose * 0.2);
        return 1.0 - smoothstep(0.0, 0.15, dist);
      }
      
      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        
        // Dynamic zoom with bass modulation
        float baseZoom = 1.0 + u_time * 0.05;
        float zoom = baseZoom + u_bass * 4.0;
        float rotation = u_time * 0.15 + u_mid * 0.4;
        
        // Rotate and scale
        vec2 p = uv * zoom;
        float c = cos(rotation);
        float s = sin(rotation);
        p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
        
        // Energy-based offset for swirling
        p += vec2(
          sin(u_time * 0.3 + p.x * 0.5) * u_energy * 0.3,
          cos(u_time * 0.4 + p.y * 0.5) * u_energy * 0.3
        );
        
        // Beat pulse creates "breathing" effect
        float pulse = 1.0 + u_beat_pulse * 0.25;
        p *= pulse;
        
        // Select fractal/pattern type - use uniform if set, otherwise auto-cycle
        float patternType;
        if (u_pattern_type == 0) {
          // Auto-cycle through patterns
          patternType = mod(u_time * 0.1 + u_energy * 2.0, 6.0);
        } else {
          // Use selected pattern (1-6 map to 0-5)
          patternType = float(u_pattern_type - 1);
        }
        float fractalValue = 0.0;
        float patternValue = 0.0;
        
        // Mandelbrot set (audio-reactive zoom and position)
        if (patternType < 1.0) {
          vec2 mandelbrotCenter = vec2(
            -0.5 + sin(u_time * 0.2) * 0.3 + u_bass * 0.2,
            0.0 + cos(u_time * 0.15) * 0.2 + u_mid * 0.15
          );
          float mandelbrotZoom = 2.0 + u_bass * 3.0;
          vec2 mandelbrotC = (p * 0.4 + mandelbrotCenter) * mandelbrotZoom;
          int maxIter = int(mix(30.0, 100.0, clamp(u_quality / 2.0, 0.0, 1.0)));
          fractalValue = mandelbrot(mandelbrotC, maxIter);
          // Make fractal more visible with better coloring
          fractalValue = pow(fractalValue, 0.7);
        }
        // Julia set (audio-reactive constant)
        else if (patternType < 2.0) {
          vec2 juliaC = vec2(
            sin(u_time * 0.3 + u_bass * 2.0) * 0.7885,
            cos(u_time * 0.25 + u_mid * 1.5) * 0.7885
          );
          float juliaZoom = 1.5 + u_treble * 2.0;
          vec2 juliaZ = p * 0.4 * juliaZoom;
          int maxIter = int(mix(30.0, 90.0, clamp(u_quality / 2.0, 0.0, 1.0)));
          fractalValue = julia(juliaZ, juliaC, maxIter);
          // Make fractal more visible
          fractalValue = pow(fractalValue, 0.7);
        }
        // Burning Ship fractal
        else if (patternType < 3.0) {
          vec2 shipCenter = vec2(
            -0.5 + sin(u_time * 0.18) * 0.2,
            -0.5 + cos(u_time * 0.22) * 0.2
          );
          float shipZoom = 2.2 + u_energy * 3.0;
          vec2 shipC = (p * 0.4 + shipCenter) * shipZoom;
          int maxIter = int(mix(30.0, 85.0, clamp(u_quality / 2.0, 0.0, 1.0)));
          fractalValue = burningShip(shipC, maxIter);
          // Make fractal more visible
          fractalValue = pow(fractalValue, 0.7);
        }
        // Spiral patterns
        else if (patternType < 4.0) {
          float arms = 3.0 + u_mid * 5.0;
          float tightness = 8.0 + u_bass * 10.0;
          patternValue = spiralPattern(p, arms, tightness);
        }
        // Lissajous curves
        else if (patternType < 5.0) {
          float a = 3.0 + u_bass * 3.0;
          float b = 2.0 + u_mid * 2.0;
          float delta = u_time * 0.5;
          patternValue = lissajous(p, a, b, delta);
        }
        // Rose curves
        else {
          float k = 2.0 + u_treble * 4.0;
          patternValue = roseCurve(p, k);
        }
        
        // Kaleidoscope effect (modulated by mid)
        float segments = 6.0 + u_mid * 8.0;
        vec2 kaleid = kaleidoscope(p, segments);
        
        // Vortex distortion
        float angle = atan(kaleid.y, kaleid.x);
        float radius = length(kaleid);
        float vortex = u_mid * 1.5;
        angle += vortex * radius + u_time * 0.4;
        vec2 vortexP = vec2(cos(angle), sin(angle)) * radius;
        
        // Fractal noise fields
        vec3 noiseCoord = vec3(vortexP * 2.0, u_time * 0.1);
        float fbmValue = fbm(noiseCoord);
        float ridgedValue = ridgedNoise(noiseCoord * 1.5);
        
        // Combine fractal, pattern, and noise
        float combinedPattern = 0.0;
        if (patternType < 3.0) {
          // Use fractal value - make it dominant and visible
          combinedPattern = fractalValue * 0.9;
          // Add subtle noise only for texture, not to obscure fractal
          combinedPattern += fbmValue * 0.05;
          combinedPattern += ridgedValue * 0.05;
        } else {
          // Use mathematical pattern
          combinedPattern = patternValue * 0.6 + fbmValue * 0.25 + ridgedValue * 0.15;
        }
        
        // Add subtle sinusoidal patterns only if not showing fractals
        if (patternType >= 3.0) {
          combinedPattern += sin(vortexP.x * 4.0 + u_time) * 0.08;
          combinedPattern += sin(vortexP.y * 4.0 + u_time * 1.1) * 0.08;
        }
        
        // Treble adds high-frequency shimmer
        float shimmer = sin(vortexP.x * 25.0 + u_time * 3.0) * sin(vortexP.y * 25.0 + u_time * 3.2);
        combinedPattern += shimmer * u_treble * 0.1;
        
        // Color palette - neon gradients with fractal coloring
        float hue1 = fract(combinedPattern * 0.8 + u_time * 0.1 + u_lyric_intensity * 0.5);
        float hue2 = fract(combinedPattern * 0.6 + u_time * 0.15 + u_bass * 0.3);
        float hue = mix(hue1, hue2, sin(u_time * 0.5) * 0.5 + 0.5);
        
        // For fractals, add more color variation based on iteration count
        if (patternType < 3.0 && fractalValue > 0.0) {
          hue += fractalValue * 0.3;
        }
        
        // Sentiment affects base hue (warm vs cool)
        hue += u_sentiment * 0.12;
        hue = fract(hue);
        
        // High saturation for vibrant neon colors
        float saturation = 0.85 + u_energy * 0.15;
        
        // Bright, glowing values with fractal enhancement
        float value = 0.2 + combinedPattern * 0.8 + u_beat_pulse * 0.4;
        if (patternType < 3.0 && fractalValue > 0.0) {
          // Make fractals much brighter and more visible
          value = 0.3 + fractalValue * 1.2 + u_beat_pulse * 0.5;
          // Add edge highlighting for fractals
          if (fractalValue > 0.0 && fractalValue < 0.15) {
            value += (1.0 - fractalValue / 0.15) * 0.8;
          }
        }
        
        vec3 color = hsv2rgb(vec3(hue, saturation, value));
        
        // Radial glow from center
        float distFromCenter = length(uv);
        float centerGlow = 1.0 - smoothstep(0.0, 0.85, distFromCenter);
        color += centerGlow * 0.3 * vec3(1.0, 0.9, 0.7) * u_energy;
        
        // Beat pulse creates expanding waves
        float pulseWave = sin((distFromCenter - u_beat_pulse * 2.5) * 20.0) * 0.5 + 0.5;
        color *= 1.0 + pulseWave * u_beat_pulse * 0.8;
        
        // Energy-based intensity
        color *= 0.8 + u_energy * 0.8;
        
        // Chromatic aberration for depth (treble-driven)
        float aberration = u_treble * 0.03;
        vec3 colorR = hsv2rgb(vec3(hue + aberration, saturation, value));
        vec3 colorB = hsv2rgb(vec3(hue - aberration, saturation, value));
        color = vec3(colorR.r, color.g, colorB.b);
        
        // Sparkle from treble
        float sparkle = sin(uv.x * 50.0 + u_time * 2.5) * sin(uv.y * 50.0 + u_time * 2.7);
        color += sparkle * u_treble * 0.15;
        
        // Bloom effect from beat
        float bloom = u_beat_pulse * 0.4;
        color += vec3(bloom);
        
        // Add fractal edge glow
        if (patternType < 3.0 && fractalValue > 0.0 && fractalValue < 0.1) {
          float edgeGlow = 1.0 - smoothstep(0.0, 0.1, fractalValue);
          color += edgeGlow * 0.5 * vec3(1.0, 1.0, 1.0);
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    return this.createShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
  }

  private createShaderProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    
    if (!vertexShader || !fragmentShader) {
      console.error('Failed to compile shaders for psychedelic renderer');
      return null;
    }
    
    const program = gl.createProgram();
    if (!program) {
      console.error('Failed to create WebGL program');
      return null;
    }
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      console.error('Failed to link psychedelic shader program:', info);
      gl.deleteProgram(program);
      return null;
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
    // Ensure canvas has dimensions
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
      } else {
        return; // Can't render without dimensions
      }
    }
    
    if (!this.gl || !this.program) {
      this.initWebGL();
      if (!this.gl || !this.program || !this.positionBuffer) {
        // Fallback to 2D canvas rendering
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgb(5, 6, 10)';
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          
          // Draw a simple psychedelic pattern as fallback
          const centerX = this.canvas.width / 2;
          const centerY = this.canvas.height / 2;
          const maxRadius = Math.min(this.canvas.width, this.canvas.height) / 2;
          
          const time = (performance.now() / 1000) - this.startTime;
          const bass = this.features.bass;
          const energy = this.features.energy;
          
          // Draw concentric circles with audio reactivity
          for (let i = 0; i < 10; i++) {
            const radius = (maxRadius * (i + 1) / 10) * (1 + bass * 0.3);
            const hue = (time * 20 + i * 30) % 360;
            ctx.strokeStyle = `hsl(${hue}, 100%, ${50 + energy * 50}%)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          // Draw rotating lines
          for (let i = 0; i < 8; i++) {
            const angle = (time * 0.5 + i * Math.PI / 4) % (Math.PI * 2);
            const length = maxRadius * (0.5 + energy * 0.5);
            ctx.strokeStyle = `hsl(${(time * 30 + i * 45) % 360}, 100%, 70%)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
              centerX + Math.cos(angle) * length,
              centerY + Math.sin(angle) * length
            );
            ctx.stroke();
          }
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

    // Set viewport
    gl.viewport(0, 0, width, height);

    // Clear canvas
    gl.clearColor(0.02, 0.024, 0.04, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    
    // Check for WebGL errors
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      console.warn('WebGL error before rendering:', error);
    }

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
    const patternTypeLocation = gl.getUniformLocation(this.program, 'u_pattern_type');

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
    
    // Pattern type (controls which fractal/pattern to show)
    if (patternTypeLocation) {
      gl.uniform1i(patternTypeLocation, this.patternType);
    }
    
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

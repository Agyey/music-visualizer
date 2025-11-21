/**
 * Adaptive GPU particle renderer with quality-aware settings.
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

const DEFAULT_PROFILE: QualityProfile = {
  level: "high",
  maxParticles: 15000,
  use3D: true,
  useHeavyShaders: true,
  internalResolutionScale: 1.0,
  postProcessingEnabled: true,
  allowWebGL: true,
};

export class ParticleRendererWebGL {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private particles: Float32Array = new Float32Array(0);
  private stride: number = 10;
  private particleCount: number = DEFAULT_PROFILE.maxParticles;
  private variant: "nebula" | "vortex_swarm" | "beat_fireworks" | "liquid_flow" = "nebula";
  private qualityLevelValue: number = 2;
  private turbulence: number = 0.5;
  private gravity: number = 0.0;

  private features: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro"
  };

  constructor(canvas: HTMLCanvasElement, _analysis: ExtendedAudioAnalysisResponse | null) {
    this.canvas = canvas;
  }

  setQualityProfile(profile: QualityProfile) {
    this.qualityLevelValue = profile.level === "high" ? 2 : profile.level === "medium" ? 1 : 0;
    const targetParticles = Math.max(500, Math.floor(profile.maxParticles));
    this.setParticleCount(targetParticles);
  }

  setParticleCount(count: number) {
    const clamped = Math.max(500, Math.min(count, 20000));
    if (this.particleCount === clamped) return;
    this.particleCount = clamped;
    if (this.gl) {
      this.initParticles();
    }
  }

  private initWebGL() {
    if (this.gl) return;
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width || window.innerWidth;
      this.canvas.height = rect.height || window.innerHeight;
    }

    // Try to get existing context or create new one
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = this.canvas.getContext('webgl') as WebGLRenderingContext | null;
      if (!gl) {
        gl = this.canvas.getContext('webgl', {
          alpha: false,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
          antialias: true
        }) as WebGLRenderingContext | null;
      }
    } catch (e) {
      console.warn('WebGL context creation failed:', e);
    }

    if (!gl) {
      console.warn('WebGL not available for particle renderer, using fallback');
      return;
    }

    this.gl = gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    this.program = this.createParticleProgram(gl);
    if (!this.program) {
      console.error('Failed to create particle shader program, will use fallback rendering');
      this.gl = null; // Mark as failed so fallback is used
      return;
    }

    this.positionBuffer = gl.createBuffer();
    if (!this.positionBuffer) {
      console.error('Failed to create buffer');
      return;
    }

    this.initParticles();
  }

  private createParticleProgram(gl: WebGLRenderingContext): WebGLProgram | null {
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute float a_size;
      attribute float a_life;
      attribute vec3 a_color;
      attribute vec2 a_velocity;
      
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
      uniform int u_variant;
      uniform float u_turbulence;
      uniform float u_gravity;
      
      varying vec4 v_color;
      varying float v_life;
      varying float v_size;
      
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
      
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
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }
      
      vec2 curlNoise(vec2 p) {
        float e = 0.1;
        float dx1 = snoise(vec3(p + vec2(e, 0.0), u_time * 0.1));
        float dx2 = snoise(vec3(p - vec2(e, 0.0), u_time * 0.1));
        float dy1 = snoise(vec3(p + vec2(0.0, e), u_time * 0.1));
        float dy2 = snoise(vec3(p - vec2(0.0, e), u_time * 0.1));
        float x = (dy1 - dy2) / (2.0 * e);
        float y = -(dx1 - dx2) / (2.0 * e);
        return vec2(x, y);
      }
      
      void main() {
        vec2 pos = a_position / u_resolution; // Normalize to 0-1
        vec2 center = vec2(0.5, 0.5);
        vec2 dir = pos - center;
        float dist = length(dir);
        float angle = atan(dir.y, dir.x);
        
        float qualityScale = mix(0.4, 1.0, clamp(u_quality / 2.0, 0.0, 1.0));
        vec2 flow = vec2(0.0);
        vec2 velocity = a_velocity;
        
        // Variant-specific flow fields for fluid motion
        if (u_variant == 0) {
          // Nebula: Multiple curl noise layers for organic flow
          vec2 flow1 = curlNoise(pos * 0.008 + vec2(u_time * 0.05)) * u_mid * 0.8;
          vec2 flow2 = curlNoise(pos * 0.015 + vec2(u_time * 0.08, u_time * 0.12)) * u_treble * 0.6;
          vec2 flow3 = curlNoise(pos * 0.003 + vec2(u_time * 0.03)) * u_bass * 0.4;
          flow = flow1 + flow2 + flow3;
          
          // Radial expansion with bass
          vec2 radial = dist > 0.0 ? normalize(dir) * u_bass * 0.4 : vec2(0.0);
          flow += radial;
          
          // Swirling motion
          float swirlStrength = u_mid * 0.15;
          float newAngle = angle + swirlStrength + u_time * 0.2;
          vec2 swirl = vec2(cos(newAngle), sin(newAngle)) * dist * 0.3;
          flow += (swirl - dir * dist) * 0.5;
        } else if (u_variant == 1) {
          // Vortex swarm: Strong rotational flow
          float vortexStrength = u_mid * 0.25;
          float vortexAngle = angle + dist * 2.0 + u_time * 0.3;
          vec2 vortex = vec2(cos(vortexAngle), sin(vortexAngle)) * dist * vortexStrength;
          flow = vortex;
          
          // Add outward push with bass
          vec2 outward = dist > 0.0 ? normalize(dir) * u_bass * 0.5 : vec2(0.0);
          flow += outward;
        } else if (u_variant == 2) {
          // Beat fireworks: Explosive bursts
          if (u_beat_pulse > 0.2) {
            vec2 burst = dist > 0.0 ? normalize(dir) * u_beat_pulse * 3.0 : vec2(0.0);
            flow = burst;
            
            // Add radial waves
            float wave = sin(dist * 20.0 - u_time * 5.0) * u_beat_pulse * 0.3;
            flow += normalize(dir) * wave;
          } else {
            // Gentle inward flow when no beat
            flow = -normalize(dir) * 0.1;
          }
        } else {
          // Liquid flow: Smooth, continuous motion
          vec2 flow1 = curlNoise(pos * 0.01 + vec2(u_time * 0.1)) * u_mid * 0.6;
          vec2 flow2 = curlNoise(pos * 0.005 + vec2(u_time * 0.15)) * u_bass * 0.4;
          flow = flow1 + flow2;
          
          // Gravity effect
          flow += vec2(0.0, u_gravity * 0.3);
          
          // Smooth directional flow
          float flowAngle = u_time * 0.1 + u_energy * 2.0;
          vec2 directional = vec2(cos(flowAngle), sin(flowAngle)) * u_energy * 0.2;
          flow += directional;
        }
        
        // Apply turbulence (adds randomness to flow)
        vec2 turbulenceNoise = vec2(
          snoise(vec3(pos * 15.0 + vec2(u_time * 3.0), u_time * 0.5)),
          snoise(vec3(pos * 15.0 + vec2(u_time * 3.2), u_time * 0.6))
        ) * u_turbulence * 0.15;
        flow += turbulenceNoise;
        
        // Treble adds high-frequency jitter
        vec2 jitter = vec2(
          snoise(vec3(pos * 25.0, u_time * 4.0)),
          snoise(vec3(pos * 25.0, u_time * 4.0 + 50.0))
        ) * u_treble * mix(0.03, 0.08, qualityScale);
        flow += jitter;
        
        // Update velocity with flow field
        velocity += flow * 0.05;
        
        // Apply damping
        velocity *= 0.95;
        
        // Update position
        pos += velocity * 0.02;
        
        // Wrap around edges
        pos = mod(pos + vec2(1.0), vec2(1.0));
        
        // Convert back to pixel coordinates
        vec2 pixelPos = pos * u_resolution;
        vec2 clipPos = ((pixelPos / u_resolution) * 2.0 - 1.0) * vec2(1.0, -1.0);
        
        // Size based on life and audio
        float size = a_size * (0.5 + a_life * 0.5) * (1.0 + u_beat_pulse * 0.4 + u_energy * 0.2);
        v_size = size;
        gl_Position = vec4(clipPos, 0.0, 1.0);
        gl_PointSize = size;
        
        // Color with audio reactivity
        float hue = a_color.x + u_sentiment * 0.15 + u_time * 0.05;
        float sat = a_color.y + u_lyric_intensity * 0.25;
        float bright = a_color.z * (0.7 + a_life * 0.3) * (1.0 + u_beat_pulse * 0.5 + u_energy * 0.3);
        vec3 rgb = vec3(fract(hue), sat, bright);
        v_color = vec4(rgb, a_life);
        v_life = a_life;
      }
    `;

    const fragmentShaderSource = `
      precision highp float;
      varying vec4 v_color;
      varying float v_life;
      varying float v_size;
      uniform float u_beat_pulse;
      uniform float u_energy;
      
      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }
      
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        alpha *= v_life;
        float core = 1.0 - smoothstep(0.0, 0.2, dist);
        float glow = 1.0 - smoothstep(0.0, 0.7, dist);
        alpha += core * 0.4 + glow * 0.4 * (1.0 + u_beat_pulse);
        vec3 rgb = hsv2rgb(v_color.rgb);
        rgb *= (1.0 + u_energy * 0.4 + u_beat_pulse * 0.3);
        gl_FragColor = vec4(rgb, alpha);
      }
    `;

    const program = this.createShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
    return program;
  }

  private createShaderProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) {
      console.error('Failed to compile particle shaders');
      return null;
    }
    const program = gl.createProgram();
    if (!program) {
      console.error('Failed to create WebGL program for particles');
      return null;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      console.error('Failed to link particle shader program:', info);
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

  private initParticles() {
    const width = this.canvas.width || 1920;
    const height = this.canvas.height || 1080;
    this.particles = new Float32Array(this.particleCount * this.stride);
    const hues = [0.0, 0.1, 0.17, 0.55, 0.65, 0.8, 0.92];
    const centerX = width / 2;
    const centerY = height / 2;
    
    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * this.stride;
      
      // Distribute particles more evenly across the canvas, not just in a ring
      const distribution = Math.random();
      let x, y;
      
      if (distribution < 0.3) {
        // Some particles near center
        const radius = Math.random() * Math.min(width, height) * 0.2;
        const angle = Math.random() * Math.PI * 2;
        x = centerX + Math.cos(angle) * radius;
        y = centerY + Math.sin(angle) * radius;
      } else if (distribution < 0.7) {
        // Most particles in a wider area
        const radius = Math.random() * Math.min(width, height) * 0.4;
        const angle = Math.random() * Math.PI * 2;
        x = centerX + Math.cos(angle) * radius;
        y = centerY + Math.sin(angle) * radius;
      } else {
        // Some particles scattered randomly
        x = Math.random() * width;
        y = Math.random() * height;
      }
      
      this.particles[idx + 0] = x;
      this.particles[idx + 1] = y;
      
      // Initial velocity based on position for fluid motion
      const angle = Math.atan2(y - centerY, x - centerX);
      const speed = Math.random() * 0.3 + 0.1;
      // Add some tangential velocity for swirling
      const tangentialAngle = angle + Math.PI / 2;
      this.particles[idx + 2] = Math.cos(tangentialAngle) * speed;
      this.particles[idx + 3] = Math.sin(tangentialAngle) * speed;
      
      this.particles[idx + 4] = Math.random(); // life
      this.particles[idx + 5] = 1.0; // max life
      this.particles[idx + 6] = 2 + Math.random() * 4; // size
      const hue = hues[Math.floor(Math.random() * hues.length)];
      this.particles[idx + 7] = hue + (Math.random() - 0.5) * 0.05;
      this.particles[idx + 8] = 0.8 + Math.random() * 0.2; // saturation
      this.particles[idx + 9] = 0.7 + Math.random() * 0.3; // brightness
    }
  }

  updateAnalysis(_analysis: ExtendedAudioAnalysisResponse | null) {
    // Analysis stored in engine
  }

  updateFeatures(_time: number, features: Features) {
    this.features = features;
    this.updateParticlePhysics();
  }

  private updateParticlePhysics() {
    if (!this.particles.length) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const dt = 1 / 60;

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * this.stride;
      let x = this.particles[idx + 0];
      let y = this.particles[idx + 1];
      let vx = this.particles[idx + 2];
      let vy = this.particles[idx + 3];
      let life = this.particles[idx + 4];

      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const bassForce = this.features.bass * 0.08;
      vx += (dx / dist) * bassForce;
      vy += (dy / dist) * bassForce;

      const swirl = this.features.mid * 0.03;
      const tempVx = vx;
      vx = vx * Math.cos(swirl) - vy * Math.sin(swirl);
      vy = tempVx * Math.sin(swirl) + vy * Math.cos(swirl);

      const jitter = this.features.treble * 0.5;
      vx += (Math.random() - 0.5) * jitter;
      vy += (Math.random() - 0.5) * jitter;

      if (this.features.beatPulse > 0.3) {
        vx += (dx / dist) * this.features.beatPulse * 2.0;
        vy += (dy / dist) * this.features.beatPulse * 2.0;
      }

      vx *= 0.98;
      vy *= 0.98;

      x += vx * dt * 60;
      y += vy * dt * 60;

      if (x < 0) x = width;
      if (x > width) x = 0;
      if (y < 0) y = height;
      if (y > height) y = 0;

      life -= 0.002;
      if (life <= 0) {
        life = 1.0;
        x = centerX + (Math.random() - 0.5) * 200;
        y = centerY + (Math.random() - 0.5) * 200;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }

      this.particles[idx + 0] = x;
      this.particles[idx + 1] = y;
      this.particles[idx + 2] = vx;
      this.particles[idx + 3] = vy;
      this.particles[idx + 4] = life;
    }
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
    this.initParticles();
  }

  render(time: number) {
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
    
    if (!this.gl || !this.program || !this.positionBuffer) {
      this.initWebGL();
      if (!this.gl || !this.program || !this.positionBuffer) {
        // Fallback to 2D canvas rendering
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgb(5, 6, 10)';
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          
          // Draw simple particles as fallback
          const centerX = this.canvas.width / 2;
          const centerY = this.canvas.height / 2;
          const particleCount = Math.min(this.particleCount, 500);
          
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < particleCount; i++) {
            const angle = (time * 0.5 + i * Math.PI * 2 / particleCount) % (Math.PI * 2);
            const radius = (this.canvas.width / 4) * (1 + this.features.bass * 0.5);
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            const hue = (time * 50 + i * 2) % 360;
            const alpha = 0.5 + this.features.energy * 0.5;
            ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, 2 + this.features.treble * 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
        return;
      }
    }

    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Set viewport
    gl.viewport(0, 0, width, height);

    gl.clearColor(0.02, 0.024, 0.04, 0.1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    
    // Check for WebGL errors
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      console.warn('WebGL error before rendering particles:', error);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.particles, gl.DYNAMIC_DRAW);

    const positionLoc = gl.getAttribLocation(this.program, 'a_position');
    const sizeLoc = gl.getAttribLocation(this.program, 'a_size');
    const lifeLoc = gl.getAttribLocation(this.program, 'a_life');
    const colorLoc = gl.getAttribLocation(this.program, 'a_color');
    const velocityLoc = gl.getAttribLocation(this.program, 'a_velocity');

    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, this.stride * 4, 0);

    gl.enableVertexAttribArray(sizeLoc);
    gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, this.stride * 4, 8);

    gl.enableVertexAttribArray(lifeLoc);
    gl.vertexAttribPointer(lifeLoc, 1, gl.FLOAT, false, this.stride * 4, 12);

    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, this.stride * 4, 16);

    gl.enableVertexAttribArray(velocityLoc);
    gl.vertexAttribPointer(velocityLoc, 2, gl.FLOAT, false, this.stride * 4, 28);

    const resolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(this.program, 'u_time');
    const qualityLoc = gl.getUniformLocation(this.program, 'u_quality');
    const bassLoc = gl.getUniformLocation(this.program, 'u_bass');
    const midLoc = gl.getUniformLocation(this.program, 'u_mid');
    const trebleLoc = gl.getUniformLocation(this.program, 'u_treble');
    const energyLoc = gl.getUniformLocation(this.program, 'u_energy');
    const beatLoc = gl.getUniformLocation(this.program, 'u_beat_pulse');
    const lyricLoc = gl.getUniformLocation(this.program, 'u_lyric_intensity');
    const sentimentLoc = gl.getUniformLocation(this.program, 'u_sentiment');
    const variantLoc = gl.getUniformLocation(this.program, 'u_variant');
    const turbulenceLoc = gl.getUniformLocation(this.program, 'u_turbulence');
    const gravityLoc = gl.getUniformLocation(this.program, 'u_gravity');

    if (resolutionLoc) gl.uniform2f(resolutionLoc, width, height);
    if (timeLoc) gl.uniform1f(timeLoc, time);
    if (qualityLoc) gl.uniform1f(qualityLoc, this.qualityLevelValue);
    if (bassLoc) gl.uniform1f(bassLoc, this.features.bass);
    if (midLoc) gl.uniform1f(midLoc, this.features.mid);
    if (trebleLoc) gl.uniform1f(trebleLoc, this.features.treble);
    if (energyLoc) gl.uniform1f(energyLoc, this.features.energy);
    if (beatLoc) gl.uniform1f(beatLoc, this.features.beatPulse);
    if (lyricLoc) gl.uniform1f(lyricLoc, this.features.lyricIntensity);
    if (sentimentLoc) gl.uniform1f(sentimentLoc, this.features.lyricSentiment);
    if (turbulenceLoc) gl.uniform1f(turbulenceLoc, this.turbulence);
    if (gravityLoc) gl.uniform1f(gravityLoc, this.gravity);
    if (variantLoc) {
      const variantIndex = this.variant === "nebula" ? 0 :
        this.variant === "vortex_swarm" ? 1 :
        this.variant === "beat_fireworks" ? 2 : 3;
      gl.uniform1i(variantLoc, variantIndex);
    }

    gl.drawArrays(gl.POINTS, 0, this.particleCount);
  }
  
  setVariant(variant: "nebula" | "vortex_swarm" | "beat_fireworks" | "liquid_flow") {
    this.variant = variant;
  }
  
  setTurbulence(turbulence: number) {
    this.turbulence = turbulence;
  }
  
  setGravity(gravity: number) {
    this.gravity = gravity;
  }
}


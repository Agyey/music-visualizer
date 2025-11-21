/**
 * High-quality GPU-accelerated particle system using WebGL instanced rendering.
 * Features: additive blending, bloom, flow fields, beat-driven explosions.
 */
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

// Particle interface for reference (not used directly, data stored in Float32Array)
// interface Particle {
//   x: number;
//   y: number;
//   vx: number;
//   vy: number;
//   life: number;
//   maxLife: number;
//   size: number;
//   hue: number;
//   saturation: number;
//   brightness: number;
// }

export class ParticleRendererWebGL {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private particles: Float32Array = new Float32Array(0);
  private particleCount: number = 20000;
  private currentTime: number = 0;
  private variant: "nebula" | "vortex_swarm" | "beat_fireworks" | "liquid_flow" = "nebula";
  
  private features: Features = {
    bass: 0, mid: 0, treble: 0, energy: 0,
    beatPulse: 0, lyricIntensity: 0, lyricSentiment: 0, lyricEnergy: 0,
    currentSection: "intro"
  };

  constructor(canvas: HTMLCanvasElement, _analysis: ExtendedAudioAnalysisResponse | null) {
    this.canvas = canvas;
    // WebGL initialization is now lazy - particles will be initialized when WebGL is ready
  }

  private initWebGL() {
    if (this.gl) return; // Already initialized
    
    // Ensure canvas has dimensions
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width || window.innerWidth;
      this.canvas.height = rect.height || window.innerHeight;
    }
    
    // Try to get WebGL context
    let gl: WebGLRenderingContext | null = null;
    
    try {
      gl = this.canvas.getContext('webgl', {
        alpha: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        antialias: true
      }) as WebGLRenderingContext | null;
    } catch (e) {
      console.warn('WebGL context creation failed:', e);
    }
    
    if (!gl) {
      console.warn('WebGL not available for particles, will use fallback');
      return;
    }
    
    this.gl = gl;
    
    // Enable additive blending for particle glow
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive blending
    
    // Create main particle shader program
    this.program = this.createParticleProgram(gl);
    
    if (!this.program) {
      console.error('Failed to create particle shader program');
      return;
    }
    
    // Initialize particles after WebGL is ready
    this.initParticles();
    console.log('Particle WebGL renderer initialized');
  }

  private createParticleProgram(gl: WebGLRenderingContext): WebGLProgram {
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute float a_size;
      attribute float a_life;
      attribute vec3 a_color;
      
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;
      uniform float u_energy;
      uniform float u_beat_pulse;
      uniform float u_lyric_intensity;
      uniform float u_sentiment;
      uniform int u_variant;
      
      varying vec4 v_color;
      varying float v_life;
      
      // Simplex noise for flow fields
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
      
      // Curl noise for flow fields
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
        vec2 pos = a_position;
        
        // Flow field based on variant
        vec2 flow = vec2(0.0);
        if (u_variant == 0) { // nebula
          flow = curlNoise(pos * 0.01) * u_mid * 0.5;
        } else if (u_variant == 1) { // vortex_swarm
          vec2 center = vec2(0.5, 0.5);
          vec2 dir = pos - center;
          float angle = atan(dir.y, dir.x);
          flow = vec2(-dir.y, dir.x) * 0.1 * u_mid;
        } else if (u_variant == 2) { // beat_fireworks
          if (u_beat_pulse > 0.3) {
            vec2 center = vec2(0.5, 0.5);
            vec2 dir = normalize(pos - center);
            flow = dir * u_beat_pulse * 2.0;
          }
        } else if (u_variant == 3) { // liquid_flow
          flow = curlNoise(pos * 0.02 + vec2(u_time * 0.1)) * u_mid * 0.3;
        }
        
        // Bass outward force
        vec2 center = vec2(0.5, 0.5);
        vec2 outward = normalize(pos - center) * u_bass * 0.3;
        
        // Treble jitter
        vec2 jitter = vec2(
          snoise(vec3(pos * 10.0, u_time * 2.0)),
          snoise(vec3(pos * 10.0, u_time * 2.0 + 100.0))
        ) * u_treble * 0.05;
        
        pos += flow + outward + jitter;
        
        // Convert to clip space
        vec2 clipPos = ((pos / u_resolution) * 2.0 - 1.0) * vec2(1.0, -1.0);
        
        // Size with life attenuation
        float size = a_size * (0.5 + a_life * 0.5);
        
        gl_Position = vec4(clipPos, 0.0, 1.0);
        gl_PointSize = size;
        
        // Color with life and sentiment
        float hue = a_color.x + u_sentiment * 0.1;
        float sat = a_color.y + u_lyric_intensity * 0.3;
        float bright = a_color.z * (0.7 + a_life * 0.3) * (1.0 + u_beat_pulse * 0.5);
        
        v_color = vec4(hue, sat, bright, a_life);
        v_life = a_life;
      }
    `;
    
    const fragmentShaderSource = `
      precision highp float;
      
      varying vec4 v_color;
      varying float v_life;
      
      uniform float u_energy;
      uniform float u_beat_pulse;
      
      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }
      
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        
        // Soft circular particle with smooth falloff
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        alpha *= v_life;
        
        // Add glow
        float glow = 1.0 - smoothstep(0.0, 0.7, dist);
        alpha += glow * 0.3 * (1.0 + u_beat_pulse);
        
        vec3 rgb = hsv2rgb(v_color.xyz);
        
        // Additive blending (brightness boost)
        rgb *= (1.0 + u_energy * 0.5);
        
        gl_FragColor = vec4(rgb, alpha);
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

  private initParticles() {
    // Initialize particle data (x, y, vx, vy, life, maxLife, size, hue, sat, bright)
    const stride = 10;
    const width = this.canvas.width || 1920;
    const height = this.canvas.height || 1080;
    this.particles = new Float32Array(this.particleCount * stride);
    
    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * stride;
      
      // Position (random across canvas)
      this.particles[idx + 0] = Math.random() * width;
      this.particles[idx + 1] = Math.random() * height;
      
      // Velocity (random)
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2;
      this.particles[idx + 2] = Math.cos(angle) * speed;
      this.particles[idx + 3] = Math.sin(angle) * speed;
      
      // Life
      this.particles[idx + 4] = Math.random();
      this.particles[idx + 5] = 1.0;
      
      // Size
      this.particles[idx + 6] = 2 + Math.random() * 4;
      
      // Color (HSV)
      this.particles[idx + 7] = Math.random(); // hue
      this.particles[idx + 8] = 0.7 + Math.random() * 0.3; // saturation
      this.particles[idx + 9] = 0.6 + Math.random() * 0.4; // brightness
    }
  }

  updateAnalysis(_analysis: ExtendedAudioAnalysisResponse | null) {
    // Analysis stored in engine
  }

  updateFeatures(time: number, features: Features) {
    this.currentTime = time;
    this.features = features;
    
    // Update particles based on variant and features
    this.updateParticlePhysics();
  }

  private updateParticlePhysics() {
    const stride = 10;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * stride;
      
      let x = this.particles[idx + 0];
      let y = this.particles[idx + 1];
      let vx = this.particles[idx + 2];
      let vy = this.particles[idx + 3];
      let life = this.particles[idx + 4];
      
      // Apply forces based on variant
      switch (this.variant) {
        case "nebula":
          // Slow drift with flow field
          const flowAngle = Math.atan2(y - centerY, x - centerX);
          vx += Math.cos(flowAngle) * this.features.mid * 0.1;
          vy += Math.sin(flowAngle) * this.features.mid * 0.1;
          break;
          
        case "vortex_swarm":
          // Spiral motion
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const angle = Math.atan2(dy, dx);
            const angularVel = 0.05 + this.features.mid * 0.05;
            vx = Math.cos(angle + angularVel) * dist * angularVel;
            vy = Math.sin(angle + angularVel) * dist * angularVel;
          }
          break;
          
        case "beat_fireworks":
          // Explosions on beats
          if (this.features.beatPulse > 0.5) {
            const angle = Math.random() * Math.PI * 2;
            const force = this.features.beatPulse * 5;
            vx += Math.cos(angle) * force;
            vy += Math.sin(angle) * force;
          }
          // Gravity
          vy += 0.1;
          break;
          
        case "liquid_flow":
          // Smooth flow with turbulence
          const noiseX = Math.sin(x * 0.01 + this.currentTime) * this.features.mid;
          const noiseY = Math.cos(y * 0.01 + this.currentTime) * this.features.mid;
          vx += noiseX * 0.2;
          vy += noiseY * 0.2;
          break;
      }
      
      // Bass outward force
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        vx += (dx / dist) * this.features.bass * 0.2;
        vy += (dy / dist) * this.features.bass * 0.2;
      }
      
      // Treble jitter
      vx += (Math.random() - 0.5) * this.features.treble * 0.5;
      vy += (Math.random() - 0.5) * this.features.treble * 0.5;
      
      // Damping
      vx *= 0.98;
      vy *= 0.98;
      
      // Update position
      x += vx;
      y += vy;
      
      // Boundary wrapping
      if (x < 0) x = width;
      if (x > width) x = 0;
      if (y < 0) y = height;
      if (y > height) y = 0;
      
      // Update life
      life -= 0.001;
      if (life <= 0) {
        // Respawn
        x = centerX;
        y = centerY;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
        life = 1.0;
      }
      
      // Update particle data
      this.particles[idx + 0] = x;
      this.particles[idx + 1] = y;
      this.particles[idx + 2] = vx;
      this.particles[idx + 3] = vy;
      this.particles[idx + 4] = life;
    }
  }

  setVariant(variant: "nebula" | "vortex_swarm" | "beat_fireworks" | "liquid_flow") {
    this.variant = variant;
  }

  setParticleCount(count: number) {
    this.particleCount = Math.min(50000, Math.max(5000, count));
    this.initParticles();
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
  }

  render(_time: number) {
    // Lazy initialization of WebGL
    if (!this.gl) {
      this.initWebGL();
      if (!this.gl) {
        this.renderFallback(_time);
        return;
      }
    }
    if (!this.gl || !this.program) {
      // Fallback to canvas 2D if WebGL not available
      this.renderFallback(_time);
      return;
    }
    
    const gl = this.gl;
    
    // Clear with dark background
    gl.clearColor(0.02, 0.024, 0.04, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Use particle program
    gl.useProgram(this.program);
    
    // Set up attributes
    const positionLoc = gl.getAttribLocation(this.program, 'a_position');
    const sizeLoc = gl.getAttribLocation(this.program, 'a_size');
    const lifeLoc = gl.getAttribLocation(this.program, 'a_life');
    const colorLoc = gl.getAttribLocation(this.program, 'a_color');
    
    // Create buffer
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.particles, gl.DYNAMIC_DRAW);
    
    // Set attributes
    const stride = 10 * 4; // 10 floats * 4 bytes
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(sizeLoc);
    gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, stride, 6 * 4);
    gl.enableVertexAttribArray(lifeLoc);
    gl.vertexAttribPointer(lifeLoc, 1, gl.FLOAT, false, stride, 4 * 4);
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, stride, 7 * 4);
    
    // Set uniforms
    const resolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(this.program, 'u_time');
    const bassLoc = gl.getUniformLocation(this.program, 'u_bass');
    const midLoc = gl.getUniformLocation(this.program, 'u_mid');
    const trebleLoc = gl.getUniformLocation(this.program, 'u_treble');
    const energyLoc = gl.getUniformLocation(this.program, 'u_energy');
    const beatPulseLoc = gl.getUniformLocation(this.program, 'u_beat_pulse');
    const lyricIntensityLoc = gl.getUniformLocation(this.program, 'u_lyric_intensity');
    const sentimentLoc = gl.getUniformLocation(this.program, 'u_sentiment');
    const variantLoc = gl.getUniformLocation(this.program, 'u_variant');
    
    const variantMap = { "nebula": 0, "vortex_swarm": 1, "beat_fireworks": 2, "liquid_flow": 3 };
    
    if (resolutionLoc) gl.uniform2f(resolutionLoc, this.canvas.width, this.canvas.height);
    if (timeLoc) gl.uniform1f(timeLoc, this.currentTime);
    if (bassLoc) gl.uniform1f(bassLoc, this.features.bass);
    if (midLoc) gl.uniform1f(midLoc, this.features.mid);
    if (trebleLoc) gl.uniform1f(trebleLoc, this.features.treble);
    if (energyLoc) gl.uniform1f(energyLoc, this.features.energy);
    if (beatPulseLoc) gl.uniform1f(beatPulseLoc, this.features.beatPulse);
    if (lyricIntensityLoc) gl.uniform1f(lyricIntensityLoc, this.features.lyricIntensity);
    if (sentimentLoc) gl.uniform1f(sentimentLoc, this.features.lyricSentiment);
    if (variantLoc) gl.uniform1i(variantLoc, variantMap[this.variant] || 0);
    
    // Draw particles
    gl.drawArrays(gl.POINTS, 0, this.particleCount);
  }

  private renderFallback(_time: number) {
    // Fallback canvas 2D rendering (simplified)
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = 'rgba(5, 6, 10, 0.1)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    const stride = 10;
    for (let i = 0; i < Math.min(this.particleCount, 5000); i++) {
      const idx = i * stride;
      const x = this.particles[idx + 0];
      const y = this.particles[idx + 1];
      const life = this.particles[idx + 4];
      const hue = this.particles[idx + 7] * 360;
      const sat = this.particles[idx + 8] * 100;
      const bright = this.particles[idx + 9] * 100;
      
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${bright}%, ${life * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}


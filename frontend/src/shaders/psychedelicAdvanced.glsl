// Advanced psychedelic shader with fractals, kaleidoscope, vortex, and chromatic aberration
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
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
  
  for (int i = 0; i < 5; i++) {
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
  
  for (int i = 0; i < 4; i++) {
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


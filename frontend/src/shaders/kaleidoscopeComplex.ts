/**
 * Complex kaleidoscope shader with mirror tiling and fractal patterns
 * Features: dynamic segments, swirling patterns, radial symmetry
 */
export const kaleidoscopeComplexShader = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_beat_pulse;
uniform float u_lyric_intensity;
uniform float u_sentiment;
uniform int u_section_type;
uniform float u_emotion_code;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

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

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  
  // Dynamic segment count based on mid frequencies
  float segments = 6.0 + floor(u_mid * 10.0);
  float angle = atan(uv.y, uv.x);
  float radius = length(uv);
  
  // Kaleidoscope mirroring - create perfect symmetry
  float segmentAngle = 2.0 * 3.14159 / segments;
  angle = mod(angle, segmentAngle);
  angle = min(angle, segmentAngle - angle);
  
  // Rotate with energy
  angle += u_time * 0.3 + u_bass * 0.6;
  
  // Create radial pattern
  vec2 p = vec2(cos(angle), sin(angle)) * radius;
  
  // Multiple wave distortions for fractal-like complexity
  float wave1 = sin(radius * 12.0 - u_time * 3.0) * 0.2;
  float wave2 = sin(radius * 8.0 + angle * 4.0 - u_time * 2.2) * 0.15;
  float wave3 = sin(radius * 18.0 + u_time * 4.0) * 0.1;
  float wave4 = sin(angle * 6.0 + radius * 10.0 - u_time * 2.8) * 0.12;
  
  p *= 1.0 + (wave1 + wave2 + wave3 + wave4) * u_energy;
  
  // Complex fractal-like pattern with multiple layers
  float pattern1 = sin(p.x * 18.0 + u_time) * sin(p.y * 18.0 + u_time * 1.4);
  float pattern2 = sin(length(p) * 10.0 - u_time * 2.5) * 0.7;
  float pattern3 = sin(p.x * 25.0 + p.y * 25.0 + u_time * 2.0) * 0.5;
  float pattern4 = sin(atan(p.y, p.x) * 8.0 + radius * 15.0 - u_time * 3.0) * 0.4;
  
  // Add noise for texture
  float noise = snoise(vec3(p * 3.0, u_time * 0.5)) * 0.3;
  
  float pattern = (pattern1 * 0.35 + pattern2 * 0.25 + pattern3 * 0.2 + pattern4 * 0.15 + noise * 0.05) * u_treble;
  
  // Add fractal detail
  float detail = sin(p.x * 35.0) * sin(p.y * 35.0) * 0.15;
  pattern += detail * u_energy;
  
  // Rich, vibrant color palette
  float hue1 = fract(angle / (2.0 * 3.14159) + u_time * 0.12 + u_lyric_intensity * 0.5);
  float hue2 = fract(radius * 0.6 + u_time * 0.18 + u_bass * 0.4);
  float hue = mix(hue1, hue2, sin(u_time * 1.0) * 0.5 + 0.5);
  
  // Sentiment affects hue
  hue += u_sentiment * 0.12;
  hue = fract(hue);
  
  // High saturation
  float saturation = 0.95 + u_energy * 0.05;
  
  // Bright values
  float value = 0.5 + pattern * 0.6 + u_beat_pulse * 0.7 + detail * 0.25;
  
  vec3 color = hsv2rgb(vec3(hue, saturation, value));
  
  // Beat pulse creates expanding rings
  float pulseRing = sin((radius - u_beat_pulse * 4.0) * 30.0) * 0.5 + 0.5;
  color *= 1.0 + pulseRing * u_beat_pulse * 0.9;
  
  // Radial fade with glow
  float radialFade = 1.0 - smoothstep(0.15, 1.4, radius);
  color *= radialFade;
  
  // Center glow
  float centerGlow = 1.0 - smoothstep(0.0, 0.5, radius);
  color += centerGlow * 0.5 * vec3(1.0, 0.95, 0.8) * u_energy;
  
  // Energy boost
  color *= 0.9 + u_energy * 0.6;
  
  // Sparkle from treble
  float sparkle = sin(uv.x * 70.0 + u_time * 3.5) * sin(uv.y * 70.0 + u_time * 3.7);
  color += sparkle * u_treble * 0.25;
  
  gl_FragColor = vec4(color, 1.0);
}
`;


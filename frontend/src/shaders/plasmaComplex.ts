/**
 * Complex plasma shader with multi-octave noise and swirling patterns
 * Features: animated noise fields, color modulation, smooth transitions
 */
export const plasmaComplexShader = `
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

// Simplex noise (same as kaleidoscope)
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
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 centered = uv - 0.5;
  
  // Multiple plasma waves with different frequencies
  float x = centered.x * 20.0;
  float y = centered.y * 20.0;
  
  float value = 0.0;
  
  // Horizontal wave
  value += sin(x + u_time * 1.0 + u_bass * 4.0) * 0.25;
  
  // Vertical wave
  value += sin(y + u_time * 0.8 + u_mid * 3.5) * 0.25;
  
  // Diagonal wave
  value += sin((x + y) * 0.8 + u_time * 0.6) * 0.2;
  
  // Radial wave
  float dist = length(centered);
  value += sin(dist * 10.0 - u_time * 0.9 + u_treble * 4.0) * 0.2;
  
  // Swirling effect
  float angle = atan(centered.y, centered.x);
  value += sin(angle * 5.0 + dist * 12.0 - u_time * 1.1) * 0.15;
  
  // Multi-octave noise for texture
  float noise1 = snoise(vec3(centered * 8.0, u_time * 0.5)) * 0.15;
  float noise2 = snoise(vec3(centered * 16.0, u_time * 0.7)) * 0.1;
  float noise3 = snoise(vec3(centered * 32.0, u_time * 0.9)) * 0.05;
  
  value += (noise1 + noise2 + noise3) * u_energy;
  
  // Add noise texture
  value += sin(x * 4.0 + u_time) * sin(y * 4.0 + u_time * 1.4) * 0.12 * u_energy;
  
  // Normalize
  value = value * 0.5 + 0.5;
  
  // Dynamic color mapping
  float hue1 = fract(value * 0.8 + u_time * 0.08 + u_lyric_intensity * 0.5);
  float hue2 = fract(value * 0.6 + u_time * 0.12 + u_bass * 0.3);
  float hue = mix(hue1, hue2, sin(u_time * 0.7) * 0.5 + 0.5);
  
  // Sentiment affects base hue
  hue += u_sentiment * 0.15;
  hue = fract(hue);
  
  // High saturation
  float saturation = 0.9 + u_energy * 0.1;
  
  // Bright values
  float brightness = 0.5 + value * 0.5 + u_beat_pulse * 0.6;
  
  vec3 color = hsv2rgb(vec3(hue, saturation, brightness));
  
  // Beat pulse creates expanding ripples
  float ripple = sin((dist - u_beat_pulse * 3.0) * 30.0) * 0.5 + 0.5;
  color *= 1.0 + ripple * u_beat_pulse * 0.8;
  
  // Energy boost
  color *= 0.8 + u_energy * 0.6;
  
  // Vignette effect
  float vignette = 1.0 - smoothstep(0.25, 0.85, dist);
  color *= vignette;
  
  // Center glow
  float centerGlow = 1.0 - smoothstep(0.0, 0.4, dist);
  color += centerGlow * 0.3 * vec3(1.0, 0.9, 0.7) * u_energy;
  
  gl_FragColor = vec4(color, 1.0);
}
`;


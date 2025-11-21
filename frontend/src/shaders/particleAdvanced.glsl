// Advanced particle shader with glow, trails, and flow fields
precision highp float;

attribute vec2 a_position;
attribute float a_size;
attribute float a_life;
attribute vec3 a_color; // hue, saturation, brightness
attribute vec2 a_velocity;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_beat_pulse;
uniform float u_lyric_intensity;
uniform float u_sentiment;

varying vec4 v_color;
varying float v_life;
varying float v_size;

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

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 pos = a_position;
  
  // Flow field based on curl noise
  vec2 flow = curlNoise(pos * 0.01) * u_mid * 0.5;
  
  // Bass outward force
  vec2 center = vec2(0.5, 0.5);
  vec2 outward = normalize(pos - center) * u_bass * 0.3;
  
  // Treble jitter
  vec2 jitter = vec2(
    snoise(vec3(pos * 10.0, u_time * 2.0)),
    snoise(vec3(pos * 10.0, u_time * 2.0 + 100.0))
  ) * u_treble * 0.05;
  
  // Swirling torque from mid
  vec2 dir = pos - center;
  float angle = atan(dir.y, dir.x);
  float swirl = u_mid * 0.1;
  float newAngle = angle + swirl;
  float dist = length(dir);
  vec2 swirled = center + vec2(cos(newAngle), sin(newAngle)) * dist;
  
  pos += flow + outward * 0.5 + jitter + (swirled - pos) * 0.3;
  
  // Convert to clip space
  vec2 clipPos = ((pos / u_resolution) * 2.0 - 1.0) * vec2(1.0, -1.0);
  
  // Size with life and beat pulse
  float size = a_size * (0.5 + a_life * 0.5) * (1.0 + u_beat_pulse * 0.5);
  v_size = size;
  
  gl_Position = vec4(clipPos, 0.0, 1.0);
  gl_PointSize = size;
  
  // Color with life, sentiment, and beat pulse
  float hue = a_color.x + u_sentiment * 0.1 + u_time * 0.05;
  float sat = a_color.y + u_lyric_intensity * 0.3;
  float bright = a_color.z * (0.7 + a_life * 0.3) * (1.0 + u_beat_pulse * 0.8);
  
  vec3 rgb = hsv2rgb(vec3(fract(hue), sat, bright));
  
  // Additive brightness boost
  rgb *= (1.0 + u_energy * 0.5);
  
  v_color = vec4(rgb, a_life);
  v_life = a_life;
}


/**
 * Complex fractal zoom shader with Julia/Mandelbrot variants
 * Features: smooth coloring, zoom depth, beat-driven breathing
 */
export const fractalComplexShader = `
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

// Complex number operations
vec2 cMul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 cPow(vec2 z, float power) {
  float r = length(z);
  float theta = atan(z.y, z.x);
  r = pow(r, power);
  theta *= power;
  return vec2(r * cos(theta), r * sin(theta));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  
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
  
  // Fractal iteration (Mandelbrot + Julia hybrid)
  vec2 z = vec2(0.0);
  vec2 c_julia = vec2(
    0.285 + sin(u_time * 0.1) * 0.1 + u_sentiment * 0.05,
    0.01 + cos(u_time * 0.15) * 0.1
  );
  
  float iterations = 0.0;
  float maxIter = 60.0 + u_treble * 80.0;
  float escapeRadius = 4.0;
  
  // Multi-layer fractal computation
  for (float i = 0.0; i < 200.0; i++) {
    if (iterations >= maxIter) break;
    if (dot(z, z) > escapeRadius) break;
    
    // Mandelbrot: z = z^2 + c
    z = cMul(z, z) + p;
    
    // Julia component for complexity
    if (mod(i, 3.0) < 1.0) {
      z = cMul(z, z) + c_julia;
    }
    
    iterations += 1.0;
  }
  
  // Smooth coloring with multiple techniques
  float dist = length(z);
  float smoothIter = iterations + 1.0 - log2(log2(max(dist, 1.0)));
  float t = smoothIter / maxIter;
  
  // Add detail texture
  float detail = sin(t * 20.0 + u_time) * 0.1;
  t += detail * u_treble;
  
  // Rich color palette
  float hue1 = fract(t * 0.7 + u_time * 0.08 + u_lyric_intensity * 0.6);
  float hue2 = fract(t * 0.5 + u_time * 0.12 + u_bass * 0.4);
  float hue = mix(hue1, hue2, sin(u_time * 0.6) * 0.5 + 0.5);
  
  // Sentiment affects base hue (warm vs cool)
  hue += u_sentiment * 0.15;
  hue = fract(hue);
  
  // High saturation for vibrant colors
  float saturation = 0.9 + u_energy * 0.1;
  
  // Bright, glowing values
  float value = 0.4 + t * 0.6 + u_beat_pulse * 0.6 + detail * 0.3;
  
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
  
  // Chromatic aberration for depth
  float aberration = u_treble * 0.04;
  color.r = min(1.0, color.r * (1.0 + aberration));
  color.g = min(1.0, color.g * (1.0 + aberration * 0.5));
  color.b = max(0.0, color.b * (1.0 - aberration));
  
  // Sparkle from treble
  float sparkle = sin(uv.x * 60.0 + u_time * 3.0) * sin(uv.y * 60.0 + u_time * 3.2);
  color += sparkle * u_treble * 0.2;
  
  gl_FragColor = vec4(color, 1.0);
}
`;


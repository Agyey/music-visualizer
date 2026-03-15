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
  
  // Warm, inviting color palette - oranges, reds, yellows, warm pinks
  float warmHueBase = 0.05; // Start with orange-red
  float warmHueRange = 0.25; // Range from red through orange to yellow
  
  // Create warm color variation
  float hue1 = warmHueBase + fract(t * 0.7 + u_time * 0.08 + u_lyric_intensity * 0.5) * warmHueRange;
  float hue2 = warmHueBase + fract(t * 0.5 + u_time * 0.12 + u_bass * 0.3) * warmHueRange;
  
  // Occasionally shift to warm pink/magenta range (0.85-0.95)
  float pinkHue = 0.9 + fract(t * 0.4 + u_time * 0.15) * 0.1;
  float usePink = sin(u_time * 0.3 + u_energy * 2.0) * 0.5 + 0.5;
  usePink = pow(usePink, 3.0); // Make it less frequent
  
  float hue = mix(mix(hue1, hue2, sin(u_time * 0.6) * 0.5 + 0.5), pinkHue, usePink * 0.3);
  
  // Sentiment shifts between warm orange (positive) and warm red (intense)
  hue += u_sentiment * 0.1;
  hue = fract(hue);
  
  // Warm, inviting saturation - rich but not neon
  float saturation = 0.75 + u_energy * 0.2 + u_beat_pulse * 0.1;
  saturation = clamp(saturation, 0.6, 0.95);
  
  // Bright, warm, glowing values
  float value = 0.4 + t * 0.6 + u_beat_pulse * 0.5 + detail * 0.3;
  value = clamp(value, 0.35, 1.0);
  
  vec3 color = hsv2rgb(vec3(hue, saturation, value));
  
  // Warm radial glow from center - soft and inviting
  float distFromCenter = length(uv);
  float centerGlow = 1.0 - smoothstep(0.0, 0.9, distFromCenter);
  // Warm golden-orange glow
  vec3 warmGlow = vec3(1.0, 0.75, 0.5) * 0.4 + vec3(1.0, 0.5, 0.3) * 0.3;
  color += centerGlow * warmGlow * u_energy * 0.5;
  
  // Soft beat pulse creates gentle expanding waves
  float pulseWave = sin((distFromCenter - u_beat_pulse * 2.5) * 22.0) * 0.5 + 0.5;
  color *= 1.0 + pulseWave * u_beat_pulse * 0.5;
  
  // Warm energy-based intensity boost
  color *= 0.85 + u_energy * 0.6;
  
  // Subtle chromatic aberration for depth (warm tones)
  float aberration = u_treble * 0.025;
  vec3 colorR = hsv2rgb(vec3(hue + aberration * 0.5, saturation, value));
  vec3 colorB = hsv2rgb(vec3(hue - aberration * 0.5, saturation, value));
  color = mix(color, vec3(colorR.r, color.g, colorB.b), 0.3);
  
  // Warm sparkle from treble - golden highlights
  float sparkle = sin(uv.x * 60.0 + u_time * 3.0) * sin(uv.y * 60.0 + u_time * 3.2);
  vec3 warmSparkle = vec3(1.0, 0.9, 0.7);
  color += sparkle * u_treble * 0.15 * warmSparkle;
  
  // Warm bloom effect - soft golden glow
  float bloom = u_beat_pulse * 0.3;
  vec3 warmBloom = vec3(1.0, 0.7, 0.4);
  color += bloom * warmBloom;
  
  // Additional warm ambient light
  color += vec3(0.05, 0.03, 0.01) * (1.0 + u_energy * 0.3);
  
  gl_FragColor = vec4(color, 1.0);
}
`;


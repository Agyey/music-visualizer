export const kaleidoscopeShader = `
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_beat_pulse;
uniform float u_lyric_intensity;
uniform vec2 u_mouse;
uniform int u_mode_variant;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  
  // Dynamic segment count with more variation
  float segments = 6.0 + floor(u_mid * 8.0);
  float angle = atan(uv.y, uv.x);
  float radius = length(uv);
  
  // Kaleidoscope mirroring - create symmetric pattern
  float segmentAngle = 2.0 * 3.14159 / segments;
  angle = mod(angle, segmentAngle);
  angle = min(angle, segmentAngle - angle);
  
  // Rotate the pattern with more dynamics
  angle += u_time * 0.25 + u_bass * 0.5;
  
  // Create radial pattern with fractal-like complexity
  vec2 p = vec2(cos(angle), sin(angle)) * radius;
  
  // Multiple wave distortions for fractal effect
  float wave1 = sin(radius * 10.0 - u_time * 2.5) * 0.15;
  float wave2 = sin(radius * 6.0 + angle * 3.0 - u_time * 1.8) * 0.1;
  float wave3 = sin(radius * 15.0 + u_time * 3.5) * 0.08;
  p *= 1.0 + (wave1 + wave2 + wave3) * u_energy;
  
  // Complex fractal-like pattern with multiple layers
  float pattern1 = sin(p.x * 15.0 + u_time) * sin(p.y * 15.0 + u_time * 1.3);
  float pattern2 = sin(length(p) * 8.0 - u_time * 2.0) * 0.6;
  float pattern3 = sin(p.x * 20.0 + p.y * 20.0 + u_time * 1.5) * 0.4;
  float pattern4 = sin(atan(p.y, p.x) * 5.0 + radius * 12.0 - u_time * 2.2) * 0.3;
  
  float pattern = (pattern1 * 0.4 + pattern2 * 0.3 + pattern3 * 0.2 + pattern4 * 0.1) * u_treble;
  
  // Add fractal detail texture
  float detail = sin(p.x * 30.0) * sin(p.y * 30.0) * 0.1;
  pattern += detail * u_energy;
  
  // Rich, vibrant color palette
  float hue1 = fract(angle / (2.0 * 3.14159) + u_time * 0.1 + u_lyric_intensity * 0.4);
  float hue2 = fract(radius * 0.5 + u_time * 0.15 + u_bass * 0.3);
  float hue = mix(hue1, hue2, sin(u_time * 0.8) * 0.5 + 0.5);
  
  // High saturation for vibrant colors
  float saturation = 0.9 + u_energy * 0.1;
  
  // Bright, glowing values
  float value = 0.5 + pattern * 0.5 + u_beat_pulse * 0.6 + detail * 0.2;
  
  vec3 color = hsv2rgb(vec3(hue, saturation, value));
  
  // Beat pulse creates expanding fractal rings
  float pulseRing = sin((radius - u_beat_pulse * 3.5) * 25.0) * 0.5 + 0.5;
  color *= 1.0 + pulseRing * u_beat_pulse * 0.8;
  
  // Radial fade with glow
  float radialFade = 1.0 - smoothstep(0.2, 1.3, radius);
  color *= radialFade;
  
  // Center glow
  float centerGlow = 1.0 - smoothstep(0.0, 0.4, radius);
  color += centerGlow * 0.4 * vec3(1.0, 0.9, 0.7) * u_energy;
  
  // Energy boost
  color *= 0.85 + u_energy * 0.5;
  
  // Add sparkle from treble
  float sparkle = sin(uv.x * 60.0 + u_time * 3.0) * sin(uv.y * 60.0 + u_time * 3.2);
  color += sparkle * u_treble * 0.2;
  
  gl_FragColor = vec4(color, 1.0);
}
`;


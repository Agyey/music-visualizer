export const plasmaShader = `
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
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 centered = uv - 0.5;
  
  // Multiple plasma waves
  float x = centered.x * 15.0;
  float y = centered.y * 15.0;
  
  float value = 0.0;
  // Horizontal wave
  value += sin(x + u_time * 0.8 + u_bass * 3.0) * 0.3;
  // Vertical wave
  value += sin(y + u_time * 0.6 + u_mid * 2.5) * 0.3;
  // Diagonal wave
  value += sin((x + y) * 0.7 + u_time * 0.5) * 0.2;
  // Radial wave
  float dist = length(centered);
  value += sin(dist * 8.0 - u_time * 0.7 + u_treble * 3.0) * 0.2;
  
  // Swirling effect
  float angle = atan(centered.y, centered.x);
  value += sin(angle * 4.0 + dist * 10.0 - u_time * 0.9) * 0.15;
  
  // Add noise texture
  value += sin(x * 3.0 + u_time) * sin(y * 3.0 + u_time * 1.3) * 0.1 * u_energy;
  
  // Normalize
  value = value * 0.5 + 0.5;
  
  // Dynamic color mapping
  float hue = fract(value * 0.7 + u_time * 0.05 + u_lyric_intensity * 0.4);
  float saturation = 0.85 + u_energy * 0.15;
  float brightness = 0.5 + value * 0.5 + u_beat_pulse * 0.5;
  
  vec3 color = hsv2rgb(vec3(hue, saturation, brightness));
  
  // Beat pulse creates expanding ripples
  float ripple = sin((dist - u_beat_pulse * 2.5) * 25.0) * 0.5 + 0.5;
  color *= 1.0 + ripple * u_beat_pulse * 0.7;
  
  // Energy boost
  color *= 0.75 + u_energy * 0.5;
  
  // Vignette effect
  float vignette = 1.0 - smoothstep(0.3, 0.8, dist);
  color *= vignette;
  
  gl_FragColor = vec4(color, 1.0);
}
`;


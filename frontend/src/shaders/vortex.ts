export const vortexShader = `
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
  
  float radius = length(uv);
  float angle = atan(uv.y, uv.x);
  
  // Strong vortex distortion
  float vortexStrength = 3.0 + u_bass * 4.0;
  angle += radius * vortexStrength - u_time * 0.4;
  
  // Tunnel depth effect
  float tunnelSpeed = 0.2 + u_mid * 0.3;
  float tunnelDepth = u_time * tunnelSpeed;
  radius = mod(radius + tunnelDepth * 0.5, 1.0);
  
  // Create spiral tunnel pattern
  float spiral = sin(radius * 25.0 - angle * 3.0 + u_time * 2.5);
  spiral += cos(radius * 15.0 + angle * 2.0 - u_time * 1.8) * 0.5;
  spiral *= u_treble;
  
  // Radial rings
  float rings = sin(radius * 30.0 - u_time * 3.0);
  rings *= 0.5 + u_energy * 0.5;
  
  // Combine patterns
  float pattern = spiral * 0.6 + rings * 0.4;
  
  // Color based on spiral position
  float hue = fract(angle / (2.0 * 3.14159) + radius * 0.5 + u_time * 0.08);
  float saturation = 0.75 + u_energy * 0.25;
  float value = 0.4 + pattern * 0.5 + (1.0 - radius) * 0.3 + u_beat_pulse * 0.6;
  
  vec3 color = hsv2rgb(vec3(hue, saturation, value));
  
  // Beat pulse creates expanding waves
  float pulseWave = sin((radius - u_beat_pulse * 2.5) * 35.0) * 0.5 + 0.5;
  color *= 1.0 + pulseWave * u_beat_pulse * 0.8;
  
  // Lyric-reactive color shift
  color.r = min(1.0, color.r + u_lyric_intensity * 0.25);
  color.g = min(1.0, color.g + u_lyric_intensity * 0.15);
  
  // Center brightness
  float centerGlow = 1.0 - smoothstep(0.0, 0.4, radius);
  color += centerGlow * 0.3 * u_energy;
  
  gl_FragColor = vec4(color, 1.0);
}
`;


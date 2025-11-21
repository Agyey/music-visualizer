/**
 * Complex vortex tunnel shader with radial distortion and swirling patterns
 * Features: tunnel depth, spiral patterns, radial rings
 */
export const vortexComplexShader = `
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

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  
  float radius = length(uv);
  float angle = atan(uv.y, uv.x);
  
  // Strong vortex distortion
  float vortexStrength = 4.0 + u_bass * 6.0;
  angle += radius * vortexStrength - u_time * 0.5;
  
  // Tunnel depth effect
  float tunnelSpeed = 0.25 + u_mid * 0.4;
  float tunnelDepth = u_time * tunnelSpeed;
  radius = mod(radius + tunnelDepth * 0.6, 1.0);
  
  // Create complex spiral tunnel pattern
  float spiral1 = sin(radius * 30.0 - angle * 4.0 + u_time * 3.0);
  float spiral2 = cos(radius * 20.0 + angle * 3.0 - u_time * 2.5) * 0.6;
  float spiral3 = sin(radius * 40.0 - angle * 5.0 + u_time * 3.5) * 0.4;
  
  float spiral = (spiral1 * 0.5 + spiral2 * 0.3 + spiral3 * 0.2) * u_treble;
  
  // Radial rings
  float rings1 = sin(radius * 35.0 - u_time * 3.5);
  float rings2 = sin(radius * 50.0 - u_time * 4.0) * 0.6;
  
  float rings = (rings1 * 0.6 + rings2 * 0.4) * (0.6 + u_energy * 0.4);
  
  // Combine patterns
  float pattern = spiral * 0.6 + rings * 0.4;
  
  // Add detail texture
  float detail = sin(angle * 8.0 + radius * 25.0 - u_time * 2.0) * 0.2;
  pattern += detail * u_energy;
  
  // Color based on spiral position
  float hue1 = fract(angle / (2.0 * 3.14159) + radius * 0.6 + u_time * 0.1);
  float hue2 = fract(radius * 0.8 + u_time * 0.12 + u_bass * 0.4);
  float hue = mix(hue1, hue2, sin(u_time * 0.8) * 0.5 + 0.5);
  
  // Sentiment affects hue
  hue += u_sentiment * 0.12;
  hue = fract(hue);
  
  // High saturation
  float saturation = 0.85 + u_energy * 0.15;
  
  // Bright values
  float value = 0.4 + pattern * 0.6 + (1.0 - radius) * 0.3 + u_beat_pulse * 0.7;
  
  vec3 color = hsv2rgb(vec3(hue, saturation, value));
  
  // Beat pulse creates expanding waves
  float pulseWave = sin((radius - u_beat_pulse * 3.0) * 40.0) * 0.5 + 0.5;
  color *= 1.0 + pulseWave * u_beat_pulse * 0.9;
  
  // Lyric-reactive color shift
  color.r = min(1.0, color.r + u_lyric_intensity * 0.3);
  color.g = min(1.0, color.g + u_lyric_intensity * 0.2);
  
  // Center brightness
  float centerGlow = 1.0 - smoothstep(0.0, 0.5, radius);
  color += centerGlow * 0.4 * u_energy;
  
  // Energy boost
  color *= 0.85 + u_energy * 0.7;
  
  // Chromatic aberration
  float aberration = u_treble * 0.03;
  color.r = min(1.0, color.r * (1.0 + aberration));
  color.b = max(0.0, color.b * (1.0 - aberration));
  
  gl_FragColor = vec4(color, 1.0);
}
`;


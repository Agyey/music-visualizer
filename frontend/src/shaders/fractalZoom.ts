export const fractalZoomShader = `
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
  
  // Dynamic zoom based on bass and time - more dramatic
  float baseZoom = 1.5 + u_time * 0.08;
  float zoom = baseZoom + u_bass * 4.0;
  float rotation = u_time * 0.2 + u_mid * 0.4;
  
  // Rotate and scale with multiple layers
  vec2 p = uv * zoom;
  float c = cos(rotation);
  float s = sin(rotation);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  
  // Offset based on energy - creates swirling motion
  p += vec2(sin(u_time * 0.3 + p.x) * u_energy * 0.4, cos(u_time * 0.4 + p.y) * u_energy * 0.4);
  
  // Complex fractal with multiple iterations and variations
  vec2 z = vec2(0.0);
  float iterations = 0.0;
  float maxIter = 50.0 + u_treble * 60.0;
  
  // Multi-layer fractal computation
  float fractalValue = 0.0;
  vec2 z1 = vec2(0.0);
  vec2 z2 = vec2(0.0);
  
  for (float i = 0.0; i < 150.0; i++) {
    if (iterations >= maxIter) break;
    if (dot(z1, z1) > 4.0 && dot(z2, z2) > 4.0) break;
    
    // Primary Mandelbrot
    float x1 = (z1.x * z1.x - z1.y * z1.y) + p.x;
    float y1 = (z1.x * z1.y * 2.0) + p.y;
    z1 = vec2(x1, y1);
    
    // Secondary Julia set for complexity
    vec2 c_julia = vec2(0.285 + sin(u_time * 0.1) * 0.1, 0.01 + cos(u_time * 0.15) * 0.1);
    float x2 = (z2.x * z2.x - z2.y * z2.y) + c_julia.x;
    float y2 = (z2.x * z2.y * 2.0) + c_julia.y;
    z2 = vec2(x2, y2);
    
    iterations += 1.0;
    fractalValue += exp(-dot(z1, z1)) + exp(-dot(z2, z2) * 0.5);
  }
  
  // Smooth coloring with multiple techniques
  float t = iterations / maxIter;
  float smoothIter1 = iterations + 1.0 - log2(log2(max(dot(z1, z1), 1.0)));
  float smoothIter2 = iterations + 1.0 - log2(log2(max(dot(z2, z2), 1.0)));
  t = (smoothIter1 * 0.6 + smoothIter2 * 0.4) / maxIter;
  
  // Add fractal detail texture
  float detail = fractalValue * 0.1;
  t += detail;
  
  // Warm, inviting color palette - oranges, reds, yellows, warm pinks
  float warmHueBase = 0.05; // Start with orange-red
  float warmHueRange = 0.25; // Range from red through orange to yellow
  
  // Create warm color variation
  float hue1 = warmHueBase + fract(t * 0.6 + u_time * 0.08 + u_lyric_intensity * 0.4) * warmHueRange;
  float hue2 = warmHueBase + fract(t * 0.5 + u_time * 0.12 + u_bass * 0.25) * warmHueRange;
  
  // Occasionally shift to warm pink/magenta range (0.85-0.95)
  float pinkHue = 0.9 + fract(t * 0.4 + u_time * 0.15) * 0.1;
  float usePink = sin(u_time * 0.3 + u_energy * 2.0) * 0.5 + 0.5;
  usePink = pow(usePink, 3.0); // Make it less frequent
  
  float hue = mix(mix(hue1, hue2, sin(u_time * 0.5) * 0.5 + 0.5), pinkHue, usePink * 0.3);
  hue = fract(hue);
  
  // Warm, inviting saturation - rich but not neon
  float saturation = 0.75 + u_energy * 0.2 + u_beat_pulse * 0.1;
  saturation = clamp(saturation, 0.6, 0.95);
  
  // Bright, warm, glowing values
  float value = 0.4 + t * 0.6 + u_beat_pulse * 0.4 + detail * 0.3;
  value = clamp(value, 0.35, 1.0);
  
  vec3 color = hsv2rgb(vec3(hue, saturation, value));
  
  // Warm radial glow from center - soft and inviting
  float dist = length(uv);
  float centerGlow = 1.0 - smoothstep(0.0, 0.85, dist);
  // Warm golden-orange glow
  vec3 warmGlow = vec3(1.0, 0.75, 0.5) * 0.4 + vec3(1.0, 0.5, 0.3) * 0.3;
  color += centerGlow * warmGlow * u_energy * 0.5;
  
  // Soft beat pulse creates gentle expanding waves
  float pulseWave = sin((dist - u_beat_pulse * 2.0) * 18.0) * 0.5 + 0.5;
  color *= 1.0 + pulseWave * u_beat_pulse * 0.4;
  
  // Warm energy-based intensity boost
  color *= 0.85 + u_energy * 0.5;
  
  // Subtle chromatic aberration for depth (warm tones)
  float aberration = u_treble * 0.02;
  vec3 colorR = hsv2rgb(vec3(hue + aberration * 0.5, saturation, value));
  vec3 colorB = hsv2rgb(vec3(hue - aberration * 0.5, saturation, value));
  color = mix(color, vec3(colorR.r, color.g, colorB.b), 0.3);
  
  // Warm sparkle from treble - golden highlights
  float sparkle = sin(uv.x * 50.0 + u_time * 2.0) * sin(uv.y * 50.0 + u_time * 2.3);
  vec3 warmSparkle = vec3(1.0, 0.9, 0.7);
  color += sparkle * u_treble * 0.12 * warmSparkle;
  
  // Warm bloom effect - soft golden glow
  float bloom = u_beat_pulse * 0.3;
  vec3 warmBloom = vec3(1.0, 0.7, 0.4);
  color += bloom * warmBloom;
  
  // Additional warm ambient light
  color += vec3(0.05, 0.03, 0.01) * (1.0 + u_energy * 0.3);
  
  gl_FragColor = vec4(color, 1.0);
}
`;


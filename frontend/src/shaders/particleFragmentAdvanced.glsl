// Advanced particle fragment shader with glow and bloom
precision highp float;

varying vec4 v_color;
varying float v_life;
varying float v_size;

uniform float u_beat_pulse;
uniform float u_energy;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  
  // Soft circular particle with smooth falloff
  float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
  alpha *= v_life;
  
  // Inner bright core
  float core = 1.0 - smoothstep(0.0, 0.2, dist);
  alpha += core * 0.5;
  
  // Outer glow halo
  float glow = 1.0 - smoothstep(0.0, 0.7, dist);
  alpha += glow * 0.4 * (1.0 + u_beat_pulse);
  
  // Brightness boost from energy
  vec3 rgb = v_color.rgb * (1.0 + u_energy * 0.3);
  
  // Additive blending (brightness boost)
  rgb *= (1.0 + u_beat_pulse * 0.5);
  
  gl_FragColor = vec4(rgb, alpha);
}


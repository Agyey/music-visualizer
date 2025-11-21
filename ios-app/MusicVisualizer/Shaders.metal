//
//  Shaders.metal
//  MusicVisualizer
//

#include <metal_stdlib>
using namespace metal;

struct Particle {
    float2 position;
    float2 velocity;
    float life;
    float3 color;
};

struct ParticleUniforms {
    float time;
    float bass;
    float mid;
    float treble;
    float energy;
    float beatPulse;
};

struct VertexOut {
    float4 position [[position]];
    float3 color;
    float life;
    float pointSize [[point_size]];
};

// Particle compute shader
kernel void particle_compute(
    device Particle *particles [[buffer(0)]],
    constant ParticleUniforms &uniforms [[buffer(1)]],
    uint id [[thread_position_in_grid]]
) {
    Particle p = particles[id];
    
    // Update position
    p.position += p.velocity;
    
    // Flow field based on audio
    float2 center = float2(0.5, 0.5);
    float2 dir = p.position - center;
    float dist = length(dir);
    
    // Bass: radial expansion
    float2 radial = normalize(dir) * uniforms.bass * 0.1;
    p.velocity += radial;
    
    // Mid: swirling motion
    float angle = atan2(dir.y, dir.x);
    float newAngle = angle + uniforms.mid * 0.05;
    float2 swirl = float2(cos(newAngle), sin(newAngle)) * dist * 0.02;
    p.velocity += swirl;
    
    // Treble: high-frequency jitter
    float2 jitter = float2(
        sin(uniforms.time * 10.0 + p.position.x * 100.0) * uniforms.treble * 0.01,
        cos(uniforms.time * 10.0 + p.position.y * 100.0) * uniforms.treble * 0.01
    );
    p.velocity += jitter;
    
    // Beat pulse: explosive burst
    if (uniforms.beatPulse > 0.3) {
        p.velocity += normalize(dir) * uniforms.beatPulse * 0.2;
    }
    
    // Damping
    p.velocity *= 0.98;
    
    // Wrap around edges
    if (p.position.x < 0.0) p.position.x = 1.0;
    if (p.position.x > 1.0) p.position.x = 0.0;
    if (p.position.y < 0.0) p.position.y = 1.0;
    if (p.position.y > 1.0) p.position.y = 0.0;
    
    // Update life
    p.life -= 0.01;
    if (p.life <= 0.0) {
        p.life = 1.0;
        p.position = float2(
            (float(id % 1000) / 1000.0),
            (float(id / 1000) / 1000.0)
        );
        float angle = (float(id) / 10000.0) * 6.28;
        p.velocity = float2(cos(angle), sin(angle)) * 0.01;
    }
    
    // Color based on audio
    p.color = float3(
        0.5 + uniforms.bass * 0.5,
        0.5 + uniforms.mid * 0.5,
        0.5 + uniforms.treble * 0.5
    );
    
    particles[id] = p;
}

// Vertex shader for particles
vertex VertexOut vertex_main(
    device Particle *particles [[buffer(0)]],
    uint vid [[vertex_id]]
) {
    Particle p = particles[vid];
    
    VertexOut out;
    out.position = float4(p.position * 2.0 - 1.0, 0.0, 1.0);
    out.position.y = -out.position.y; // Flip Y for Metal coordinate system
    out.color = p.color;
    out.life = p.life;
    out.pointSize = 4.0 + p.life * 4.0;
    
    return out;
}

// Fragment shader for particles
fragment float4 fragment_main(
    VertexOut in [[stage_in]],
    float2 pointCoord [[point_coord]]
) {
    float dist = length(pointCoord - float2(0.5));
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    alpha *= in.life;
    
    // Glow effect
    float glow = 1.0 - smoothstep(0.0, 0.7, dist);
    alpha += glow * 0.3;
    
    return float4(in.color, alpha);
}

// Fractal compute shader
kernel void fractal_compute(
    texture2d<float, access::write> output [[texture(0)]],
    constant ParticleUniforms &uniforms [[buffer(0)]],
    uint2 gid [[thread_position_in_grid]]
) {
    float2 uv = float2(gid) / float2(output.get_width(), output.get_height());
    uv = uv * 2.0 - 1.0;
    uv.x *= float(output.get_width()) / float(output.get_height());
    
    // Mandelbrot set
    float2 c = uv * 2.0 - float2(0.5, 0.0);
    c *= (1.0 + uniforms.bass * 2.0);
    
    float2 z = float2(0.0);
    float iterations = 0.0;
    float maxIter = 50.0 + uniforms.energy * 50.0;
    
    for (float i = 0.0; i < maxIter; i++) {
        if (length(z) > 2.0) break;
        z = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        iterations = i;
    }
    
    float value = iterations / maxIter;
    
    // Color mapping
    float3 color = float3(
        0.5 + sin(value * 10.0 + uniforms.time) * 0.5,
        0.5 + cos(value * 8.0 + uniforms.time) * 0.5,
        0.5 + sin(value * 12.0 + uniforms.time * 1.5) * 0.5
    );
    
    color *= (1.0 + uniforms.beatPulse * 0.5);
    
    output.write(float4(color, 1.0), gid);
}


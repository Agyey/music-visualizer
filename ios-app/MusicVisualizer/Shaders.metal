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
    constant float2 &resolution [[buffer(1)]],
    constant ParticleUniforms &uniforms [[buffer(2)]],
    uint id [[thread_position_in_grid]]
) {
    Particle p = particles[id];
    
    // Update position
    p.position += p.velocity;
    
    // Flow field based on audio
    float2 center = float2(0.5, 0.5);
    float2 dir = p.position - center;
    float dist = length(dir);
    
    // Bass: subtle radial expansion
    if (dist > 0.001) {
        float2 radial = normalize(dir) * uniforms.bass * 0.03;
        p.velocity += radial;
    }
    
    // Mid: gentle swirling motion
    float angle = atan2(dir.y, dir.x);
    float newAngle = angle + uniforms.mid * 0.02;
    float2 swirl = float2(cos(newAngle), sin(newAngle)) * dist * 0.01;
    p.velocity += swirl;
    
    // Treble: subtle high-frequency jitter
    float2 jitter = float2(
        sin(uniforms.time * 5.0 + p.position.x * 50.0) * uniforms.treble * 0.005,
        cos(uniforms.time * 5.0 + p.position.y * 50.0) * uniforms.treble * 0.005
    );
    p.velocity += jitter;
    
    // Beat pulse: gentle pulse
    if (uniforms.beatPulse > 0.3 && dist > 0.001) {
        p.velocity += normalize(dir) * uniforms.beatPulse * 0.05;
    }
    
    // Damping - stronger to keep particles centered
    p.velocity *= 0.95;
    
    // Gentle centering force to prevent particles from clustering at edges
    float2 centerForce = (center - p.position) * 0.001;
    p.velocity += centerForce;
    
    // Wrap around edges (position is in 0-1 space)
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
    constant float2 &resolution [[buffer(1)]],
    uint vid [[vertex_id]]
) {
    Particle p = particles[vid];
    
    VertexOut out;
    // Convert from 0-1 space to NDC (-1 to 1)
    // Metal coordinate system: origin at top-left, Y down
    float2 screenPos = p.position * resolution;
    out.position = float4(
        (screenPos.x / resolution.x) * 2.0 - 1.0,
        1.0 - (screenPos.y / resolution.y) * 2.0, // Flip Y
        0.0,
        1.0
    );
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
    if (gid.x >= output.get_width() || gid.y >= output.get_height()) {
        return;
    }
    
    float2 uv = float2(gid) / float2(output.get_width(), output.get_height());
    uv = uv * 2.0 - 1.0;
    float aspect = float(output.get_width()) / float(output.get_height());
    uv.x *= aspect;
    
    // Infinite zoom: base zoom increases exponentially over time
    // Beat pulse affects zoom rate (speed of zooming)
    float baseZoomRate = 0.15; // Base zoom rate per second
    float zoomRateMultiplier = 1.0 + uniforms.beatPulse * 2.5; // Beat makes zoom faster
    float accumulatedZoom = uniforms.time * baseZoomRate * zoomRateMultiplier;
    
    // Exponential zoom: zoom = 2^accumulatedZoom
    float baseZoom = 0.3;
    float zoom = baseZoom * pow(2.0, accumulatedZoom);
    
    // Follow a zoom path that explores the fractal's self-similar structure
    // As we zoom, we move along interesting paths in the Mandelbrot set
    // This creates the repeating pattern effect
    
    // Calculate which "level" of zoom we're at (for path selection)
    float zoomLevel = floor(accumulatedZoom / 3.0); // Change path every 3 zoom units
    float zoomPhase = fmod(accumulatedZoom, 3.0); // Phase within current level
    
    // Define interesting zoom paths that follow the fractal structure
    // Each path leads to a mini-Mandelbrot or interesting feature
    float2 center;
    
    // Path 1: Classic edge exploration
    float pathIndex = fmod(zoomLevel, 4.0);
    if (pathIndex < 1.0) {
        float angle = zoomPhase * 2.0 * 3.14159;
        float radius = 0.25;
        center = float2(-0.5 + cos(angle) * radius, sin(angle) * radius);
    }
    // Path 2: Mini-Mandelbrot at (-0.75, 0.1)
    else if (pathIndex < 2.0) {
        float2 target = float2(-0.75, 0.1);
        float2 start = float2(-0.5, 0.0);
        center = mix(start, target, smoothstep(0.0, 1.0, zoomPhase / 3.0));
    }
    // Path 3: Spiral into another mini-set
    else if (pathIndex < 3.0) {
        float angle = zoomPhase * 4.0 * 3.14159;
        float radius = 0.15 * (1.0 - zoomPhase / 3.0);
        center = float2(-0.5 + cos(angle) * radius, 0.0 + sin(angle) * radius);
    }
    // Path 4: Edge of main bulb
    else {
        float angle = zoomPhase * 1.5 * 3.14159;
        float radius = 0.3;
        center = float2(-0.5 + cos(angle) * radius, sin(angle) * radius * 0.5);
    }
    
    // Add subtle audio-reactive variation to the path
    center += float2(
        sin(uniforms.time * 0.1 + uniforms.bass * 0.5) * 0.02,
        cos(uniforms.time * 0.12 + uniforms.mid * 0.5) * 0.02
    );
    
    // Calculate complex plane coordinates with infinite zoom
    float2 c = center + uv / zoom;
    
    float2 z = float2(0.0);
    float iterations = 0.0;
    float maxIter = 50.0 + uniforms.energy * 30.0;
    
    for (float i = 0.0; i < maxIter; i++) {
        if (length(z) > 2.0) break;
        z = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        iterations = i;
    }
    
    float value = iterations / maxIter;
    
    // Color changes based on audio and zoom level
    float colorPhase = zoomLevel * 0.5 + uniforms.time * 0.1;
    float3 color = float3(
        0.3 + sin(value * 10.0 + colorPhase + uniforms.bass * 3.0) * 0.4,
        0.3 + cos(value * 8.0 + colorPhase * 1.2 + uniforms.mid * 3.0) * 0.4,
        0.3 + sin(value * 12.0 + colorPhase * 1.5 + uniforms.treble * 3.0) * 0.4
    );
    
    // Brightness varies with energy and beat
    color *= (0.8 + uniforms.energy * 0.2 + uniforms.beatPulse * 0.1);
    color = saturate(color);
    
    output.write(float4(color, 1.0), gid);
}

// Diffusion/Procedural compute shader (smoother, more organic)
kernel void diffusion_compute(
    texture2d<float, access::write> output [[texture(0)]],
    constant ParticleUniforms &uniforms [[buffer(0)]],
    uint2 gid [[thread_position_in_grid]]
) {
    if (gid.x >= output.get_width() || gid.y >= output.get_height()) {
        return;
    }
    
    float2 uv = float2(gid) / float2(output.get_width(), output.get_height());
    
    // Create smooth, flowing patterns with noise-like appearance
    float time = uniforms.time * 0.2; // Slower movement
    
    // Multiple layers of smooth sine waves for organic flow
    float pattern1 = sin(uv.x * 8.0 + time + uniforms.bass * 0.5) * 
                     cos(uv.y * 6.0 + time * 1.1 + uniforms.mid * 0.5);
    float pattern2 = sin(uv.x * 12.0 + time * 1.3 + uniforms.treble * 0.3) * 
                     cos(uv.y * 10.0 + time * 0.9);
    float pattern3 = sin((uv.x + uv.y) * 5.0 + time * 0.7);
    
    float combined = (pattern1 + pattern2 * 0.5 + pattern3 * 0.3) / 1.8;
    
    // Radial gradient from center
    float2 center = float2(0.5, 0.5);
    float dist = length(uv - center);
    float radial = 1.0 - smoothstep(0.0, 0.7, dist);
    
    // Color based on patterns with subtle audio reactivity
    float3 color = float3(
        0.2 + combined * 0.3 + sin(time + uniforms.bass * 0.2) * 0.1,
        0.2 + combined * 0.3 + cos(time * 1.2 + uniforms.mid * 0.2) * 0.1,
        0.3 + combined * 0.4 + sin(time * 1.5 + uniforms.treble * 0.2) * 0.1
    );
    
    // Apply radial fade and subtle brightness
    color *= radial * (0.8 + uniforms.energy * 0.15 + uniforms.beatPulse * 0.05);
    color = saturate(color);
    
    output.write(float4(color, 1.0), gid);
}

// Fullscreen vertex shader
vertex float4 fullscreen_vertex(uint vid [[vertex_id]]) {
    float2 positions[4] = {
        float2(-1.0, -1.0),
        float2( 1.0, -1.0),
        float2(-1.0,  1.0),
        float2( 1.0,  1.0)
    };
    return float4(positions[vid], 0.0, 1.0);
}

// Fullscreen fragment shader
fragment float4 fullscreen_fragment(
    float4 position [[position]],
    texture2d<float> tex [[texture(0)]]
) {
    constexpr sampler s(min_filter::linear, mag_filter::linear);
    return tex.sample(s, position.xy / float2(tex.get_width(), tex.get_height()));
}


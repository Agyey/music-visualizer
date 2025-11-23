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
    
    // Smooth audio-controlled zoom speed
    // Base zoom rate, smoothly modulated by audio
    float baseZoomRate = 0.4; // Base zoom rate per second (increased for faster zoom)
    
    // Smooth zoom speed control: energy and beat pulse affect zoom speed smoothly
    // Use smoothstep for smooth transitions
    float zoomSpeedMultiplier = 0.5 + uniforms.energy * 1.5 + uniforms.beatPulse * 1.0;
    zoomSpeedMultiplier = smoothstep(0.3, 1.0, zoomSpeedMultiplier); // Smooth the transitions
    
    // Accumulate zoom smoothly (integrate zoom speed over time)
    // We'll track this as a running total that increases smoothly
    float zoomSpeed = baseZoomRate * zoomSpeedMultiplier;
    float accumulatedZoom = uniforms.time * zoomSpeed;
    
    // Exponential zoom: zoom = 2^accumulatedZoom
    // Start at a reasonable zoom level and zoom in infinitely
    float baseZoom = 0.4;
    float zoom = baseZoom * pow(2.0, accumulatedZoom);
    
    // Use a well-known coordinate for infinite zoom that maintains fractal patterns
    // This coordinate is on the boundary and has proven self-similarity
    // Classic "Seahorse Valley" area with infinite detail
    float2 center = float2(-0.743643887037151, 0.131825904205330);
    
    // No adjustments needed - this coordinate maintains patterns at all zoom levels
    
    // Calculate complex plane coordinates with infinite zoom
    float2 c = center + uv / zoom;
    
    float2 z = float2(0.0);
    float iterations = 0.0;
    
    // Line width/detail controlled by audio: more iterations = finer detail
    // Energy and treble affect detail level (line width)
    // Increase base iterations to see more detail at deeper zooms
    float baseIterations = 80.0;
    float detailBoost = uniforms.energy * 50.0 + uniforms.treble * 40.0;
    // Scale iterations with zoom depth to maintain detail
    float zoomDepth = log2(max(zoom / baseZoom, 1.0));
    float zoomIterations = zoomDepth * 10.0; // Add iterations as we zoom deeper
    float maxIter = baseIterations + detailBoost + zoomIterations;
    
    for (float i = 0.0; i < maxIter; i++) {
        if (length(z) > 2.0) break;
        z = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        iterations = i;
    }
    
    float value = iterations / maxIter;
    
    // Enhanced gradient color mapping with smooth transitions
    // Use smoothstep for gradient-like color bands
    float colorShift = uniforms.time * 0.01; // Very slow, smooth color rotation (reduced from 0.05)
    
    // Create gradient bands using smoothstep
    float band1 = smoothstep(0.0, 0.3, value) * (1.0 - smoothstep(0.3, 0.6, value));
    float band2 = smoothstep(0.3, 0.6, value) * (1.0 - smoothstep(0.6, 0.9, value));
    float band3 = smoothstep(0.6, 1.0, value);
    
    // Gradient color stops with audio reactivity
    float3 color1 = float3(
        0.1 + sin(colorShift + uniforms.bass * 2.0) * 0.2,
        0.2 + cos(colorShift * 1.2 + uniforms.mid * 2.0) * 0.3,
        0.4 + sin(colorShift * 1.5 + uniforms.treble * 2.0) * 0.3
    );
    
    float3 color2 = float3(
        0.3 + sin(colorShift * 1.1 + uniforms.bass * 2.5) * 0.4,
        0.1 + cos(colorShift * 1.3 + uniforms.mid * 2.5) * 0.2,
        0.5 + sin(colorShift * 1.6 + uniforms.treble * 2.5) * 0.4
    );
    
    float3 color3 = float3(
        0.5 + sin(colorShift * 1.2 + uniforms.bass * 3.0) * 0.4,
        0.4 + cos(colorShift * 1.4 + uniforms.mid * 3.0) * 0.4,
        0.2 + sin(colorShift * 1.7 + uniforms.treble * 3.0) * 0.3
    );
    
    // Blend gradient colors
    float3 color = color1 * band1 + color2 * band2 + color3 * band3;
    
    // Add smooth iteration-based gradient overlay
    float iterGradient = smoothstep(0.0, 1.0, value);
    float3 gradientOverlay = float3(
        0.2 + sin(value * 15.0 + colorShift) * 0.15,
        0.2 + cos(value * 12.0 + colorShift * 1.1) * 0.15,
        0.3 + sin(value * 18.0 + colorShift * 1.2) * 0.15
    );
    color = mix(color, gradientOverlay, 0.3);
    
    // Smooth brightness variation with energy and beat
    float brightness = 0.8 + uniforms.energy * 0.25 + uniforms.beatPulse * 0.2;
    color *= brightness;
    
    // Enhance contrast for richer gradients
    color = pow(color, 0.9); // Slight gamma correction for richer colors
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


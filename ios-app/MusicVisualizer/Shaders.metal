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
    float baseZoomRate = 4; // Base zoom rate per second (increased for faster zoom)
    
    // Smooth zoom speed control: energy and beat pulse affect zoom speed smoothly
    // Use smoothstep for smooth transitions
    float zoomSpeedMultiplier = 5 + uniforms.energy * 1.5 + uniforms.beatPulse * 1.0;
    zoomSpeedMultiplier = smoothstep(0.3, 1.0, zoomSpeedMultiplier); // Smooth the transitions
    
    // Accumulate zoom smoothly (integrate zoom speed over time)
    // We'll track this as a running total that increases smoothly
    float zoomSpeed = baseZoomRate * zoomSpeedMultiplier;
    float accumulatedZoom = uniforms.time * zoomSpeed;
    
    // Exponential zoom: zoom = 2^accumulatedZoom
    // Start at a reasonable zoom level and zoom in infinitely
    float baseZoom = 0.4;
    float zoom = baseZoom * pow(2.0, accumulatedZoom);
    
    // Calculate zoom depth to track how deep we've zoomed
    float zoomDepth = log2(max(zoom / baseZoom, 1.0));
    
    // Use a proven coordinate for infinite zoom
    // This coordinate is on a mini-Mandelbrot and maintains patterns at all depths
    // Coordinate: (-0.77568377, 0.13646737) - proven for deep zooms
    float2 center = float2(-0.77568377, 0.13646737);
    
    // As we zoom deeper, we need to be more precise
    // At very deep zooms, even tiny offsets matter
    // Use a logarithmic spiral that follows the fractal's self-similar structure
    if (zoomDepth > 5.0) {
        // After zooming past level 5, add tiny adjustments to follow mini-copies
        float deepZoomPhase = fmod(zoomDepth - 5.0, 6.0) / 6.0;
        float adjustmentScale = pow(0.1, zoomDepth / 10.0); // Exponentially smaller adjustments
        
        // Follow a gentle spiral that keeps us in fractal regions
        float spiralAngle = (zoomDepth - 5.0) * 0.3;
        float spiralRadius = 0.0001 * adjustmentScale;
        
        center += float2(
            cos(spiralAngle) * spiralRadius,
            sin(spiralAngle) * spiralRadius
        );
    }
    
    // Calculate complex plane coordinates with infinite zoom
    // Use high precision by keeping calculations in normalized space longer
    float2 c = center + uv / zoom;
    
    // For very deep zooms, use perturbation theory to maintain precision
    // This prevents pixelation by using relative coordinates
    float2 z = float2(0.0);
    float iterations = 0.0;
    
    // Line width/detail controlled by audio: more iterations = finer detail
    // Scale iterations much more aggressively with zoom depth to prevent pixelation
    float baseIterations = 150.0; // Increased base for better detail
    float detailBoost = uniforms.energy * 100.0 + uniforms.treble * 80.0;
    
    // Scale iterations exponentially with zoom depth to maintain infinite detail
    // Need more iterations as zoom increases to resolve finer detail
    // Formula: base + zoomDepth^1.8 * scaleFactor (steeper curve)
    float zoomIterations = pow(max(zoomDepth, 1.0), 1.8) * 25.0;
    float maxIter = baseIterations + detailBoost + zoomIterations;
    
    // Much higher cap for very deep zooms to prevent pixelation
    maxIter = min(maxIter, 800.0);
    
    // Use optimized iteration with early bailout and better precision
    // For deep zooms, we need high precision calculations
    float2 z_prev = float2(0.0);
    float2 z_prev2 = float2(0.0);
    float bailout = 4.0; // Escape radius squared
    
    for (float i = 0.0; i < maxIter; i++) {
        // Check for escape (using squared magnitude for efficiency)
        float z_mag2 = z.x * z.x + z.y * z.y;
        if (z_mag2 > bailout) {
            // Calculate smooth iteration count for anti-aliasing
            float z_mag = sqrt(z_mag2);
            iterations = i;
            break;
        }
        
        // Periodicity check for better precision (helps at deep zooms)
        // Check every 5 iterations to detect cycles
        if (i > 20.0 && fmod(i, 5.0) < 0.5) {
            float dist1 = length(z - z_prev);
            float dist2 = length(z - z_prev2);
            if (dist1 < 0.00001 && dist2 < 0.00001) {
                iterations = maxIter; // Inside set (periodic)
                break;
            }
            z_prev2 = z_prev;
            z_prev = z;
        } else if (i > 20.0 && fmod(i, 5.0) < 1.0) {
            z_prev = z;
        }
        
        // Optimized Mandelbrot iteration with better numerical stability
        float zx2 = z.x * z.x;
        float zy2 = z.y * z.y;
        
        // Check for overflow before computing
        if (zx2 + zy2 > 1e10) {
            iterations = i;
            break;
        }
        
        float zxy = z.x * z.y;
        z = float2(zx2 - zy2 + c.x, 2.0 * zxy + c.y);
        iterations = i;
    }
    
    // SVG-like smooth rendering with distance field approach
    // Calculate smooth escape time for crisp, vector-like edges
    float value = 0.0;
    float smoothValue = 0.0;
    
    if (iterations < maxIter) {
        // Enhanced smooth escape time calculation for better anti-aliasing
        // This prevents pixelation by providing continuous color values
        float z_mag = length(z);
        if (z_mag > 1.0) {
            float log_zn = log(z_mag) / log(2.0);
            float nu = log(log_zn) / log(2.0);
            smoothValue = iterations + 1.0 - nu;
        } else {
            smoothValue = iterations;
        }
        value = smoothValue / maxIter;
        
        // Clamp to prevent artifacts
        value = clamp(value, 0.0, 1.0);
    } else {
        // Inside the set - use periodicity or max iterations
        value = 1.0;
        smoothValue = maxIter;
    }
    
    // Create SVG-like crisp edges using smoothstep
    // This creates vector-like sharp boundaries
    float edgeSharpness = 0.02; // How sharp the edges are (smaller = sharper)
    float fractalEdge = smoothstep(0.0, edgeSharpness, 1.0 - value);
    
    // For SVG-like appearance, we want crisp lines with smooth gradients
    // Use the smooth value to create gradient bands
    float bandedValue = fract(smoothValue * 0.1); // Create bands
    float bandEdge = smoothstep(0.0, 0.1, bandedValue) * (1.0 - smoothstep(0.9, 1.0, bandedValue));
    
    // Combine for SVG-like appearance
    value = mix(fractalEdge, bandEdge, 0.3);
    
    // Rich color palette with very slow hue shift
    // Hue shifts gradually as the song progresses
    float hueShift = uniforms.time * 0.0002; // Very slow hue rotation (full cycle takes ~1.4 hours)
    
    // Convert to HSV for smooth hue rotation
    // Use the iteration value to create color variation across the fractal
    float hue = fmod(value * 0.3 + hueShift, 1.0); // Map value to hue range, add slow shift
    float saturation = 0.7 + uniforms.energy * 0.2; // Rich saturation
    float brightness = 0.6 + uniforms.beatPulse * 0.2;
    
    // HSV to RGB conversion for smooth color transitions
    float3 baseColor;
    float chroma = brightness * saturation;
    float x = chroma * (1.0 - abs(fmod(hue * 6.0, 2.0) - 1.0));
    float m = brightness - chroma;
    
    if (hue < 0.166) {
        baseColor = float3(chroma, x, 0.0) + m; // Red to Yellow
    } else if (hue < 0.333) {
        baseColor = float3(x, chroma, 0.0) + m; // Yellow to Green
    } else if (hue < 0.5) {
        baseColor = float3(0.0, chroma, x) + m; // Green to Cyan
    } else if (hue < 0.666) {
        baseColor = float3(0.0, x, chroma) + m; // Cyan to Blue
    } else if (hue < 0.833) {
        baseColor = float3(x, 0.0, chroma) + m; // Blue to Magenta
    } else {
        baseColor = float3(chroma, 0.0, x) + m; // Magenta to Red
    }
    
    // Add variation based on iteration bands for richer palette
    float bandHue = fmod(smoothValue * 0.05 + hueShift * 2.0, 1.0);
    float3 bandColor;
    float bandChroma = brightness * saturation * 0.8;
    float bandX = bandChroma * (1.0 - abs(fmod(bandHue * 6.0, 2.0) - 1.0));
    float bandM = brightness - bandChroma;
    
    if (bandHue < 0.166) {
        bandColor = float3(bandChroma, bandX, 0.0) + bandM;
    } else if (bandHue < 0.333) {
        bandColor = float3(bandX, bandChroma, 0.0) + bandM;
    } else if (bandHue < 0.5) {
        bandColor = float3(0.0, bandChroma, bandX) + bandM;
    } else if (bandHue < 0.666) {
        bandColor = float3(0.0, bandX, bandChroma) + bandM;
    } else if (bandHue < 0.833) {
        bandColor = float3(bandX, 0.0, bandChroma) + bandM;
    } else {
        bandColor = float3(bandChroma, 0.0, bandX) + bandM;
    }
    
    // SVG-like rendering: crisp edges with smooth color gradients
    // Create sharp boundaries like vector graphics
    float edgeThreshold = 0.5;
    float edgeWidth = 0.05; // Thin, crisp edges
    
    // Calculate distance from fractal boundary for smooth edges
    float distFromEdge = abs(value - edgeThreshold);
    float edgeFactor = 1.0 - smoothstep(0.0, edgeWidth, distFromEdge);
    
    // Create smooth color gradient based on iteration bands
    // Use the smooth value for gradient calculation
    float gradientPos = fract(smoothValue * 0.08); // Slower gradient for smoother transitions
    float gradientBand = smoothstep(0.0, 0.4, gradientPos) * (1.0 - smoothstep(0.6, 1.0, gradientPos));
    
    // Rich palette application with smooth gradients
    // Create depth with multiple color layers
    float3 insideColor = baseColor * 0.4; // Darker inside
    float3 outsideColor = baseColor; // Full color outside
    float3 bandLayer = bandColor * 0.8; // Band color layer
    
    // Smooth transition between inside and outside
    float3 color = mix(insideColor, outsideColor, smoothstep(0.3, 0.7, value));
    
    // Add band layer for richer palette
    color = mix(color, bandLayer, gradientBand * 0.5);
    
    // Add subtle audio-reactive color shifts (very subtle)
    float audioHueShift = (uniforms.bass * 0.05 + uniforms.mid * 0.03 + uniforms.treble * 0.02);
    float3 audioColor = baseColor;
    // Apply tiny hue shift based on audio
    float audioHue = fmod(hue + audioHueShift, 1.0);
    float audioChroma = brightness * saturation;
    float audioX = audioChroma * (1.0 - abs(fmod(audioHue * 6.0, 2.0) - 1.0));
    float audioM = brightness - audioChroma;
    
    if (audioHue < 0.166) {
        audioColor = float3(audioChroma, audioX, 0.0) + audioM;
    } else if (audioHue < 0.333) {
        audioColor = float3(audioX, audioChroma, 0.0) + audioM;
    } else if (audioHue < 0.5) {
        audioColor = float3(0.0, audioChroma, audioX) + audioM;
    } else if (audioHue < 0.666) {
        audioColor = float3(0.0, audioX, audioChroma) + audioM;
    } else if (audioHue < 0.833) {
        audioColor = float3(audioX, 0.0, audioChroma) + audioM;
    } else {
        audioColor = float3(audioChroma, 0.0, audioX) + audioM;
    }
    
    color = mix(color, audioColor, 0.15); // Very subtle audio color influence
    
    // Apply crisp edge (like SVG stroke) with palette color
    float edgeBrightness = 1.2;
    color = mix(color, baseColor * edgeBrightness, edgeFactor * 0.2);
    
    // Subtle brightness variation
    float finalBrightness = 0.9 + uniforms.energy * 0.1 + uniforms.beatPulse * 0.05;
    color *= finalBrightness;
    
    // Enhance colors for rich palette
    color = pow(color, 0.9);
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


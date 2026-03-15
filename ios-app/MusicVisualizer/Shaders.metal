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
    // Fractal control (manual mode)
    float2 fractalCenter;
    float fractalZoom;
    int fractalType; // 0=mandelbrot, 1=julia, 2=burning_ship, 3=tricorn, 4=multibrot3, 5=multibrot4, 6=newton, 7=phoenix
    float2 juliaC;
    int useManualControl; // 0=auto, 1=manual
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
    
    // Bass: very subtle mood-based radial expansion (10x slower)
    if (dist > 0.001) {
        float2 radial = normalize(dir) * uniforms.bass * 0.003; // 10x slower
        p.velocity += radial;
    }
    
    // Mid: very gentle mood-based swirling motion (10x slower)
    float angle = atan2(dir.y, dir.x);
    float newAngle = angle + uniforms.mid * 0.002; // 10x slower
    float2 swirl = float2(cos(newAngle), sin(newAngle)) * dist * 0.001; // 10x slower
    p.velocity += swirl;
    
    // Treble: very subtle mood-based jitter (10x slower)
    float2 jitter = float2(
        sin(uniforms.time * 0.5 + p.position.x * 5.0) * uniforms.treble * 0.0005, // 10x slower
        cos(uniforms.time * 0.5 + p.position.y * 5.0) * uniforms.treble * 0.0005 // 10x slower
    );
    p.velocity += jitter;
    
    // Beat pulse: very gentle mood-based pulse (removed aggressive threshold)
    if (uniforms.beatPulse > 0.5 && dist > 0.001) {
        p.velocity += normalize(dir) * uniforms.beatPulse * 0.005; // 10x slower
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
    
    // Color based on mood - very subtle audio influence
    p.color = float3(
        0.5 + uniforms.energy * 0.05, // Very subtle mood-based color
        0.5 + uniforms.energy * 0.05,
        0.5 + uniforms.energy * 0.05
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

// Perturbation Theory for infinite zoom without pixelation
// This is the standard technique used in professional fractal software like XaoS
// The key insight: calculate a reference point once, then compute deltas relative to it
// This maintains precision beyond single-float limits

struct PerturbationState {
    float2 z_total;    // Total z (reference + delta)
    float2 dz_total;   // Total derivative
    float iterations;
    float escaped;     // Use float instead of bool for Metal compatibility (0.0 = false, 1.0 = true)
};

// Perturbation theory implementation
// c_ref: reference point (center of view, calculated at high precision)
// dc: delta from reference (small, maintains precision)
PerturbationState calculate_perturbation(float2 c_ref, float2 dc, int max_iterations) {
    PerturbationState state;
    state.escaped = 0.0;  // false
    state.z_total = float2(0.0);
    state.dz_total = float2(0.0);
    state.iterations = 0.0;
    
    // Reference iteration: z_ref = z_ref^2 + c_ref
    float2 z_ref = float2(0.0);
    float2 dz_ref = float2(1.0, 0.0);
    
    // Perturbation: delta_z (small relative to z_ref)
    float2 delta_z = float2(0.0);
    float2 delta_dz = float2(0.0);
    
    for (int i = 0; i < max_iterations; i++) {
        // Update reference point
        float2 z_ref_new = float2(z_ref.x * z_ref.x - z_ref.y * z_ref.y, 
                                  2.0 * z_ref.x * z_ref.y) + c_ref;
        float2 dz_ref_new = 2.0 * float2(z_ref.x * dz_ref.x - z_ref.y * dz_ref.y,
                                         z_ref.x * dz_ref.y + z_ref.y * dz_ref.x) + float2(1.0, 0.0);
        
        // Perturbation update using series expansion:
        // z_total = (z_ref + delta_z)^2 + (c_ref + dc)
        //         = z_ref^2 + 2*z_ref*delta_z + delta_z^2 + c_ref + dc
        // delta_z_new = 2*z_ref*delta_z + delta_z^2 + dc
        
        float2 delta_z_sq = float2(delta_z.x * delta_z.x - delta_z.y * delta_z.y,
                                   2.0 * delta_z.x * delta_z.y);
        
        float2 delta_z_new = 2.0 * float2(z_ref.x * delta_z.x - z_ref.y * delta_z.y,
                                          z_ref.x * delta_z.y + z_ref.y * delta_z.x) + 
                            delta_z_sq + dc;
        
        // Update perturbation derivative
        // dz_total = 2*(z_ref + delta_z)*(dz_ref + delta_dz) + 1
        // delta_dz_new = 2*z_ref*delta_dz + 2*delta_z*dz_ref + 2*delta_z*delta_dz
        float2 cross_term = 2.0 * float2(delta_z.x * dz_ref.x - delta_z.y * dz_ref.y,
                                         delta_z.x * dz_ref.y + delta_z.y * dz_ref.x);
        float2 delta_dz_sq = 2.0 * float2(delta_z.x * delta_dz.x - delta_z.y * delta_dz.y,
                                         delta_z.x * delta_dz.y + delta_z.y * delta_dz.x);
        
        float2 delta_dz_new = 2.0 * float2(z_ref.x * delta_dz.x - z_ref.y * delta_dz.y,
                                           z_ref.x * delta_dz.y + z_ref.y * delta_dz.x) + 
                              cross_term + delta_dz_sq;
        
        // Update state
        z_ref = z_ref_new;
        dz_ref = dz_ref_new;
        delta_z = delta_z_new;
        delta_dz = delta_dz_new;
        
        // Check escape condition
        float2 z_total = z_ref + delta_z;
        float z_total_mag_sq = dot(z_total, z_total);
        
        if (z_total_mag_sq > 4.0) {
            state.escaped = 1.0;  // true
            state.iterations = float(i);
            state.z_total = z_total;
            state.dz_total = dz_ref + delta_dz;
            break;
        }
        
        state.iterations = float(i);
    }
    
    if (state.escaped < 0.5) {  // if not escaped
        state.z_total = z_ref + delta_z;
        state.dz_total = dz_ref + delta_dz;
    }
    
    return state;
}

// Mandelbrot distance estimate with perturbation theory
struct DistanceResult {
    float distance;
    float iterations;
    float2 z;
};

// Note: Perturbation theory currently supports Mandelbrot only for deep zooms
// Other fractal types use standard method (which is fine for most zooms)
DistanceResult mandelbrot_distance_estimate_perturbation(float2 c, float2 c_ref, int max_iterations) {
    // Calculate delta from reference (this is small, maintaining precision)
    float2 dc = c - c_ref;
    
    // Use perturbation theory: calculate relative to reference point
    PerturbationState state = calculate_perturbation(c_ref, dc, max_iterations);
    
    DistanceResult result;
    result.iterations = state.iterations;
    result.z = state.z_total;
    
    if (state.escaped < 0.5) {  // if not escaped
        result.distance = 0.0;
        return result;
    }
    
    // Distance estimate using perturbation result
    float z_mag = length(state.z_total);
    float dz_mag = length(state.dz_total);
    
    if (dz_mag < 1e-10) {
        result.distance = 0.0;
        return result;
    }
    
    float log_z = log(z_mag);
    result.distance = 0.5 * z_mag * log_z / dz_mag;
    result.distance = min(result.distance, 100.0);
    
    return result;
}

// Fractal compute shader with supersampling for SVG-like rendering
kernel void fractal_compute(
    texture2d<float, access::write> output [[texture(0)]],
    constant ParticleUniforms &uniforms [[buffer(0)]],
    uint2 gid [[thread_position_in_grid]]
) {
    if (gid.x >= output.get_width() || gid.y >= output.get_height()) {
        return;
    }
    
    // Optimized supersampling: reduced from 16 to 4 samples for better performance
    // Still provides good anti-aliasing with 2x2 grid
    const int samplesPerPixel = 4; // 2x2 grid - good balance of quality and performance
    float3 accumulatedColor = float3(0.0);
    
    float2 pixelSize = 1.0 / float2(output.get_width(), output.get_height());
    float aspect = float(output.get_width()) / float(output.get_height());
    
    // Use jittered sampling for better anti-aliasing
    for (int sy = 0; sy < 2; sy++) {
        for (int sx = 0; sx < 2; sx++) {
            // Jittered offset within pixel for better sampling
            float jitterX = (float(sx) + 0.5) / 2.0 - 0.5;
            float jitterY = (float(sy) + 0.5) / 2.0 - 0.5;
            float2 offset = float2(jitterX, jitterY) * pixelSize;
            float2 uv = (float2(gid) + offset) / float2(output.get_width(), output.get_height());
            uv = uv * 2.0 - 1.0;
            uv.x *= aspect;
    
    // Use manual control if enabled, otherwise auto-zoom
    float zoom;
    float2 center;
    float zoomDepth;
    
    if (uniforms.useManualControl > 0) {
        // Manual control mode (Fraksl-like)
        zoom = uniforms.fractalZoom;
        center = uniforms.fractalCenter;
        float baseZoom = 0.4;
        zoomDepth = log2(max(zoom / baseZoom, 1.0));
    } else {
        // Auto-zoom mode (audio-reactive)
        float baseZoomRate = 4;
        float zoomSpeedMultiplier = 1.0 + uniforms.energy * 0.1; // Very subtle mood-based zoom
        zoomSpeedMultiplier = smoothstep(0.3, 1.0, zoomSpeedMultiplier);
        float zoomSpeed = baseZoomRate * zoomSpeedMultiplier;
        float accumulatedZoom = uniforms.time * zoomSpeed;
        float baseZoom = 0.4;
        zoom = baseZoom * pow(2.0, accumulatedZoom);
        zoomDepth = log2(max(zoom / baseZoom, 1.0));
        center = float2(-0.77568377, 0.13646737);
    }
    
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
            float2 c = center + uv / zoom;
            
            // Scale iterations exponentially with zoom depth
            // Optimized for performance - reduced base and cap
            float baseIterations = 100.0; // Reduced from 200
            float detailBoost = uniforms.energy * 5.0; // Very minimal mood-based detail boost
            // Less aggressive curve for better performance
            float zoomIterations = pow(max(zoomDepth, 1.0), 1.5) * 20.0; // Reduced from 2.0 and 30.0
            int maxIter = int(min(baseIterations + detailBoost + zoomIterations, 400.0)); // Reduced cap from 1000
            
            // Use perturbation theory for infinite zoom without pixelation
            // For deep zooms (zoomDepth > 8), use perturbation theory
            DistanceResult distResult;
            float2 c_ref = center; // Reference point (center of view, calculated once)
            
            // Enable perturbation theory for deep zooms (Mandelbrot only for now)
            // For other fractal types, use standard method
            if (zoomDepth > 8.0 && uniforms.fractalType == 0) {
                // Use perturbation theory: calculate relative to reference point
                // This maintains precision beyond float limits
                distResult = mandelbrot_distance_estimate_perturbation(c, c_ref, maxIter);
            } else {
                // Standard method for shallow zooms (faster)
                float2 z = float2(0.0);
                float2 dz = float2(1.0, 0.0);
                float z_mag_sq = 0.0;
                float iterations = 0.0;
                
                // Get Julia constant if needed
                float2 juliaC = uniforms.juliaC;
                
                for (int i = 0; i < maxIter; i++) {
                    z_mag_sq = dot(z, z);
                    if (z_mag_sq > 4.0) break;
                    
                    // Calculate dz based on fractal type
                    if (uniforms.fractalType == 0) { // Mandelbrot
                        dz = 2.0 * float2(z.x * dz.x - z.y * dz.y, z.x * dz.y + z.y * dz.x) + float2(1.0, 0.0);
                        z = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
                    } else if (uniforms.fractalType == 1) { // Julia
                        dz = 2.0 * float2(z.x * dz.x - z.y * dz.y, z.x * dz.y + z.y * dz.x);
                        z = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + juliaC;
                    } else if (uniforms.fractalType == 2) { // Burning Ship
                        z = float2(abs(z.x), abs(z.y));
                        dz = 2.0 * float2(z.x * dz.x - z.y * dz.y, z.x * dz.y + z.y * dz.x) + float2(1.0, 0.0);
                        z = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
                    } else if (uniforms.fractalType == 3) { // Tricorn
                        dz = 2.0 * float2(z.x * dz.x - z.y * dz.y, z.x * dz.y + z.y * dz.x) + float2(1.0, 0.0);
                        z = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
                        z.y = -z.y; // Conjugate
                    } else if (uniforms.fractalType == 4) { // Multibrot z^3
                        float2 z2 = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
                        float2 z3 = float2(z2.x * z.x - z2.y * z.y, z2.x * z.y + z2.y * z.x);
                        dz = 3.0 * float2(z2.x * dz.x - z2.y * dz.y, z2.x * dz.y + z2.y * dz.x) + float2(1.0, 0.0);
                        z = z3 + c;
                    } else if (uniforms.fractalType == 5) { // Multibrot z^4
                        float2 z2 = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
                        float2 z4 = float2(z2.x * z2.x - z2.y * z2.y, 2.0 * z2.x * z2.y);
                        dz = 4.0 * float2(z2.x * z2.x * dz.x - z2.y * z2.y * dz.y, z2.x * z2.x * dz.y + z2.y * z2.y * dz.x) + float2(1.0, 0.0);
                        z = z4 + c;
                    } else if (uniforms.fractalType == 6) { // Newton
                        // Newton fractal: z = z - (z^3 - 1) / (3*z^2)
                        float2 z2 = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
                        float2 z3 = float2(z2.x * z.x - z2.y * z.y, z2.x * z.y + z2.y * z.x);
                        float2 numerator = z3 - float2(1.0, 0.0);
                        float2 denominator = 3.0 * z2;
                        float denom_mag_sq = dot(denominator, denominator);
                        if (denom_mag_sq > 1e-10) {
                            float2 fraction = float2(
                                (numerator.x * denominator.x + numerator.y * denominator.y) / denom_mag_sq,
                                (numerator.y * denominator.x - numerator.x * denominator.y) / denom_mag_sq
                            );
                            z = z - fraction;
                            dz = dz - (dz * 2.0 * z) / (3.0 * z2);
                        }
                    } else if (uniforms.fractalType == 7) { // Phoenix
                        // Phoenix: z = z^2 + c + real(z_prev) * juliaC
                        float2 z_prev = z;
                        z = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c + z_prev.x * juliaC;
                        dz = 2.0 * float2(z.x * dz.x - z.y * dz.y, z.x * dz.y + z.y * dz.x) + float2(1.0, 0.0) + juliaC;
                    } else { // Default to Mandelbrot
                        dz = 2.0 * float2(z.x * dz.x - z.y * dz.y, z.x * dz.y + z.y * dz.x) + float2(1.0, 0.0);
                        z = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
                    }
                    
                    iterations = float(i);
                }
                
                distResult.iterations = iterations;
                distResult.z = z;
                
                if (z_mag_sq <= 4.0) {
                    distResult.distance = 0.0;
                } else {
                    float z_mag = sqrt(z_mag_sq);
                    float dz_mag = length(dz);
                    if (dz_mag < 1e-10) {
                        distResult.distance = 0.0;
                    } else {
                        float log_z = log(z_mag);
                        distResult.distance = 0.5 * z_mag * log_z / dz_mag;
                        distResult.distance = min(distResult.distance, 100.0);
                    }
                }
            }
            
            float distance = distResult.distance;
            float iterations = distResult.iterations;
            float2 z_final = distResult.z;
            
            // Convert distance to smooth value for coloring
            // Distance is in complex plane units, scale it appropriately
            // Account for higher internal resolution (2x)
            float pixelSizeInComplexPlane = 1.0 / (zoom * 2.0); // 2x resolution factor
            float normalizedDistance = distance / max(pixelSizeInComplexPlane, 1e-6);
            
            // Smooth iteration count for color mapping
            float smoothValue = 0.0;
            if (iterations < float(maxIter)) {
                float z_mag = length(z_final);
                if (z_mag > 1.0) {
                    float log_zn = log(z_mag) / log(2.0);
                    float nu = log(log_zn) / log(2.0);
                    smoothValue = iterations + 1.0 - nu;
                } else {
                    smoothValue = iterations;
                }
            } else {
                smoothValue = float(maxIter);
            }
            
            float value = smoothValue / float(maxIter);
            value = clamp(value, 0.0, 1.0);
            
            // SVG-like rendering using distance estimation for crisp edges
            // Use distance to create smooth, anti-aliased boundaries
            // Adjust edge thickness based on zoom level for better quality at deep zooms
            float edgeThickness = 0.2 + 0.1 * smoothstep(0.0, 10.0, zoomDepth); // Thicker at deep zooms
            float edgeAlpha = 1.0 - smoothstep(0.0, edgeThickness, normalizedDistance);
            
            // Use a smoother falloff for better anti-aliasing
            edgeAlpha = smoothstep(0.0, edgeThickness * 2.0, normalizedDistance);
            edgeAlpha = 1.0 - edgeAlpha; // Invert for inside-outside
            
            // Rich color palette with extremely slow hue shift - gentle mood-based evolution
            // Very subtle audio influence - colors evolve slowly with song mood, not beats
            float hueShift = uniforms.time * 0.0000005 + uniforms.energy * 0.00001; // Very slow base + minimal mood influence
            float hue = fmod(value * 0.3 + hueShift, 1.0);
            float saturation = 0.7 + uniforms.energy * 0.02; // Very minimal energy influence (mood-based)
            float brightness = 0.6 + uniforms.energy * 0.03; // Very minimal brightness change (mood-based)
            
            // HSV to RGB conversion
            float3 sampleColor;
            float chroma = brightness * saturation;
            float x = chroma * (1.0 - abs(fmod(hue * 6.0, 2.0) - 1.0));
            float m = brightness - chroma;
            
            if (hue < 0.166) {
                sampleColor = float3(chroma, x, 0.0) + m;
            } else if (hue < 0.333) {
                sampleColor = float3(x, chroma, 0.0) + m;
            } else if (hue < 0.5) {
                sampleColor = float3(0.0, chroma, x) + m;
            } else if (hue < 0.666) {
                sampleColor = float3(0.0, x, chroma) + m;
            } else if (hue < 0.833) {
                sampleColor = float3(x, 0.0, chroma) + m;
            } else {
                sampleColor = float3(chroma, 0.0, x) + m;
            }
            
            // Apply edge alpha for SVG-like crisp boundaries
            sampleColor *= edgeAlpha;
            
            // Add gradient bands for depth - extremely slow evolution
            float bandHue = fmod(smoothValue * 0.05 + hueShift * 0.0005, 1.0); // Very slow band evolution
            float bandChroma = brightness * saturation * 0.8;
            float bandX = bandChroma * (1.0 - abs(fmod(bandHue * 6.0, 2.0) - 1.0));
            float bandM = brightness - bandChroma;
            float3 bandColor;
            
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
            
            float gradientPos = fract(smoothValue * 0.08);
            float gradientBand = smoothstep(0.0, 0.4, gradientPos) * (1.0 - smoothstep(0.6, 1.0, gradientPos));
            sampleColor = mix(sampleColor, bandColor * 0.8, gradientBand * 0.5);
            
            // Very subtle mood-based brightness - gentle evolution, not beat-reactive
            float finalBrightness = 0.9 + uniforms.energy * 0.02; // Minimal mood influence
            sampleColor *= finalBrightness;
            sampleColor = pow(sampleColor, 0.9);
            sampleColor = saturate(sampleColor);
            
            accumulatedColor += sampleColor;
        }
    }
    
    // Average the supersampled colors for smooth anti-aliasing
    float3 finalColor = accumulatedColor / float(samplesPerPixel);
    
    output.write(float4(finalColor, 1.0), gid);
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
    
    // Create smooth, flowing patterns with very slow, gentle movement
    float time = uniforms.time * 0.05; // Much slower movement (4x slower)
    
    // Multiple layers of smooth sine waves for organic flow - minimal audio influence
    float pattern1 = sin(uv.x * 8.0 + time + uniforms.energy * 0.05) * 
                     cos(uv.y * 6.0 + time * 1.1 + uniforms.energy * 0.05);
    float pattern2 = sin(uv.x * 12.0 + time * 1.3) * 
                     cos(uv.y * 10.0 + time * 0.9);
    float pattern3 = sin((uv.x + uv.y) * 5.0 + time * 0.7);
    
    float combined = (pattern1 + pattern2 * 0.5 + pattern3 * 0.3) / 1.8;
    
    // Radial gradient from center
    float2 center = float2(0.5, 0.5);
    float dist = length(uv - center);
    float radial = 1.0 - smoothstep(0.0, 0.7, dist);
    
    // Color based on patterns with very subtle mood-based reactivity
    float3 color = float3(
        0.2 + combined * 0.3 + uniforms.energy * 0.01,
        0.2 + combined * 0.3 + uniforms.energy * 0.01,
        0.3 + combined * 0.4 + uniforms.energy * 0.01
    );
    
    // Apply radial fade and very subtle mood-based brightness
    color *= radial * (0.8 + uniforms.energy * 0.05);
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


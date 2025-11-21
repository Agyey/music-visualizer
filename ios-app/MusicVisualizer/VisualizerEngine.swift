//
//  VisualizerEngine.swift
//  MusicVisualizer
//

import Metal
import MetalKit
import CoreML
import Combine

class VisualizerEngine: NSObject, ObservableObject {
    private var device: MTLDevice?
    private var commandQueue: MTLCommandQueue?
    private var renderPipelineState: MTLRenderPipelineState?
    private var computePipelineState: MTLComputePipelineState?
    
    private var audioManager: AudioManager?
    private var diffusionModel = DiffusionModel()
    private var currentMode: VisualMode = .diffusion
    
    private var frameCount: UInt64 = 0
    private var lastFrameTime: CFTimeInterval = 0
    
    // Particle system
    private var particleBuffer: MTLBuffer?
    private var particleCount: Int = 10000
    
    // Diffusion state
    private var currentDiffusionImage: CGImage?
    private var isGeneratingDiffusion = false
    
    func setupMetal(view: MTKView) {
        guard let device = MTLCreateSystemDefaultDevice() else {
            print("❌ Metal is not supported on this device")
            return
        }
        
        self.device = device
        view.device = device
        view.delegate = self
        
        commandQueue = device.makeCommandQueue()
        
        setupRenderPipeline()
        setupComputePipeline()
        setupParticles()
    }
    
    func setAudioManager(_ manager: AudioManager) {
        audioManager = manager
    }
    
    func setMode(_ mode: VisualMode) {
        currentMode = mode
    }
    
    private func setupRenderPipeline() {
        guard let device = device else { return }
        
        let library = device.makeDefaultLibrary()
        let vertexFunction = library?.makeFunction(name: "vertex_main")
        let fragmentFunction = library?.makeFunction(name: "fragment_main")
        
        let pipelineDescriptor = MTLRenderPipelineDescriptor()
        pipelineDescriptor.vertexFunction = vertexFunction
        pipelineDescriptor.fragmentFunction = fragmentFunction
        pipelineDescriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
        pipelineDescriptor.colorAttachments[0].isBlendingEnabled = true
        pipelineDescriptor.colorAttachments[0].rgbBlendOperation = .add
        pipelineDescriptor.colorAttachments[0].alphaBlendOperation = .add
        pipelineDescriptor.colorAttachments[0].sourceRGBBlendFactor = .sourceAlpha
        pipelineDescriptor.colorAttachments[0].sourceAlphaBlendFactor = .sourceAlpha
        pipelineDescriptor.colorAttachments[0].destinationRGBBlendFactor = .one
        pipelineDescriptor.colorAttachments[0].destinationAlphaBlendFactor = .one
        
        do {
            renderPipelineState = try device.makeRenderPipelineState(descriptor: pipelineDescriptor)
        } catch {
            print("❌ Failed to create render pipeline: \(error)")
        }
    }
    
    private func setupComputePipeline() {
        guard let device = device else { return }
        
        let library = device.makeDefaultLibrary()
        let computeFunction = library?.makeFunction(name: "particle_compute")
        
        do {
            computePipelineState = try device.makeComputePipelineState(function: computeFunction!)
        } catch {
            print("⚠️ Compute shader not found, using CPU fallback")
        }
    }
    
    private func setupParticles() {
        guard let device = device else { return }
        
        // Initialize particle buffer
        let particleSize = MemoryLayout<Particle>.size
        let bufferSize = particleCount * particleSize
        particleBuffer = device.makeBuffer(length: bufferSize, options: .storageModeShared)
        
        // Initialize particles with random positions
        if let buffer = particleBuffer {
            let particles = buffer.contents().bindMemory(to: Particle.self, capacity: particleCount)
            for i in 0..<particleCount {
                particles[i] = Particle(
                    position: SIMD2<Float>(
                        Float.random(in: 0...1),
                        Float.random(in: 0...1)
                    ),
                    velocity: SIMD2<Float>(
                        Float.random(in: -0.01...0.01),
                        Float.random(in: -0.01...0.01)
                    ),
                    life: Float.random(in: 0...1),
                    color: SIMD3<Float>(
                        Float.random(in: 0...1),
                        Float.random(in: 0.5...1),
                        Float.random(in: 0.7...1)
                    )
                )
            }
        }
    }
    
    private func updateDiffusionImage() async {
        guard !isGeneratingDiffusion, let audioManager = audioManager else { return }
        
        isGeneratingDiffusion = true
        defer { isGeneratingDiffusion = false }
        
        let features = audioManager.audioFeatures
        let prompt = generatePrompt(from: features)
        
        do {
            if let image = try await diffusionModel.generateImage(
                prompt: prompt,
                audioFeatures: features,
                steps: 15 // Faster generation
            ) {
                await MainActor.run {
                    self.currentDiffusionImage = image
                }
            }
        } catch {
            print("❌ Failed to generate diffusion image: \(error)")
        }
    }
    
    private func generatePrompt(from features: AudioManager.AudioFeatures) -> String {
        var prompt = "abstract music visualization, neon colors,"
        
        if features.bass > 0.7 {
            prompt += " deep bass, vibrant energy,"
        }
        if features.mid > 0.6 {
            prompt += " flowing patterns,"
        }
        if features.treble > 0.6 {
            prompt += " sparkling details,"
        }
        
        prompt += " psychedelic, cosmic, glowing particles, 4k, high quality"
        return prompt
    }
}

extension VisualizerEngine: MTKViewDelegate {
    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        // Handle resize
    }
    
    func draw(in view: MTKView) {
        guard let device = device,
              let commandQueue = commandQueue,
              let drawable = view.currentDrawable,
              let renderPassDescriptor = view.currentRenderPassDescriptor else {
            return
        }
        
        let commandBuffer = commandQueue.makeCommandBuffer()
        
        switch currentMode {
        case .diffusion:
            renderDiffusionMode(
                commandBuffer: commandBuffer!,
                renderPassDescriptor: renderPassDescriptor,
                drawable: drawable
            )
        case .particles:
            renderParticleMode(
                commandBuffer: commandBuffer!,
                renderPassDescriptor: renderPassDescriptor,
                drawable: drawable
            )
        case .fractals:
            renderFractalMode(
                commandBuffer: commandBuffer!,
                renderPassDescriptor: renderPassDescriptor,
                drawable: drawable
            )
        }
        
        commandBuffer?.present(drawable)
        commandBuffer?.commit()
        
        frameCount += 1
        
        // Update diffusion image periodically
        if frameCount % 60 == 0 && currentMode == .diffusion {
            Task {
                await updateDiffusionImage()
            }
        }
    }
    
    private func renderDiffusionMode(
        commandBuffer: MTLCommandBuffer,
        renderPassDescriptor: MTLRenderPassDescriptor,
        drawable: CAMetalDrawable
    ) {
        // Render diffusion-generated image
        // This would use a texture from the diffusion model output
        // For now, render a placeholder
        
        let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor)
        encoder?.endEncoding()
    }
    
    private func renderParticleMode(
        commandBuffer: MTLCommandBuffer,
        renderPassDescriptor: MTLRenderPassDescriptor,
        drawable: CAMetalDrawable
    ) {
        guard let renderPipelineState = renderPipelineState,
              let particleBuffer = particleBuffer else { return }
        
        // Update particles with compute shader if available
        if let computePipelineState = computePipelineState {
            updateParticlesWithCompute(commandBuffer: commandBuffer)
        } else {
            updateParticlesCPU()
        }
        
        let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor)
        encoder?.setRenderPipelineState(renderPipelineState)
        encoder?.setVertexBuffer(particleBuffer, offset: 0, index: 0)
        encoder?.drawPrimitives(type: .point, vertexStart: 0, vertexCount: particleCount)
        encoder?.endEncoding()
    }
    
    private func renderFractalMode(
        commandBuffer: MTLCommandBuffer,
        renderPassDescriptor: MTLRenderPassDescriptor,
        drawable: CAMetalDrawable
    ) {
        // Render fractals using Metal compute shader
        let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor)
        encoder?.endEncoding()
    }
    
    private func updateParticlesWithCompute(commandBuffer: MTLCommandBuffer) {
        guard let computePipelineState = computePipelineState,
              let particleBuffer = particleBuffer,
              let audioManager = audioManager else { return }
        
        let encoder = commandBuffer.makeComputeCommandEncoder()
        encoder?.setComputePipelineState(computePipelineState)
        encoder?.setBuffer(particleBuffer, offset: 0, index: 0)
        
        let features = audioManager.audioFeatures
        var uniforms = ParticleUniforms(
            time: Float(frameCount) / 60.0,
            bass: features.bass,
            mid: features.mid,
            treble: features.treble,
            energy: features.energy,
            beatPulse: features.beatPulse
        )
        
        let uniformsBuffer = device?.makeBuffer(bytes: &uniforms, length: MemoryLayout<ParticleUniforms>.size, options: [])
        encoder?.setBuffer(uniformsBuffer, offset: 0, index: 1)
        
        let threadgroupSize = MTLSize(width: 256, height: 1, depth: 1)
        let threadgroupCount = MTLSize(width: (particleCount + 255) / 256, height: 1, depth: 1)
        encoder?.dispatchThreadgroups(threadgroupCount, threadsPerThreadgroup: threadgroupSize)
        encoder?.endEncoding()
    }
    
    private func updateParticlesCPU() {
        guard let particleBuffer = particleBuffer,
              let audioManager = audioManager else { return }
        
        let particles = particleBuffer.contents().bindMemory(to: Particle.self, capacity: particleCount)
        let features = audioManager.audioFeatures
        let time = Float(frameCount) / 60.0
        
        for i in 0..<particleCount {
            var p = particles[i]
            
            // Update position
            p.position += p.velocity
            
            // Apply audio-reactive forces
            let angle = atan2(p.position.y - 0.5, p.position.x - 0.5)
            let dist = length(p.position - SIMD2<Float>(0.5, 0.5))
            
            // Bass: radial expansion
            let bassForce = features.bass * 0.1
            p.velocity += normalize(p.position - SIMD2<Float>(0.5, 0.5)) * bassForce
            
            // Mid: swirling
            let swirl = features.mid * 0.05
            let newAngle = angle + swirl
            p.velocity += SIMD2<Float>(cos(newAngle), sin(newAngle)) * 0.02
            
            // Treble: jitter
            p.velocity += SIMD2<Float>(
                Float.random(in: -1...1) * features.treble * 0.01,
                Float.random(in: -1...1) * features.treble * 0.01
            )
            
            // Beat pulse
            if features.beatPulse > 0.3 {
                p.velocity += normalize(p.position - SIMD2<Float>(0.5, 0.5)) * features.beatPulse * 0.2
            }
            
            // Damping
            p.velocity *= 0.98
            
            // Wrap around
            if p.position.x < 0 { p.position.x = 1 }
            if p.position.x > 1 { p.position.x = 0 }
            if p.position.y < 0 { p.position.y = 1 }
            if p.position.y > 1 { p.position.y = 0 }
            
            // Update life
            p.life -= 0.01
            if p.life <= 0 {
                p.life = 1.0
                p.position = SIMD2<Float>(Float.random(in: 0...1), Float.random(in: 0...1))
                p.velocity = SIMD2<Float>(Float.random(in: -0.01...0.01), Float.random(in: -0.01...0.01))
            }
            
            particles[i] = p
        }
    }
}

// Metal data structures
struct Particle {
    var position: SIMD2<Float>
    var velocity: SIMD2<Float>
    var life: Float
    var color: SIMD3<Float>
}

struct ParticleUniforms {
    var time: Float
    var bass: Float
    var mid: Float
    var treble: Float
    var energy: Float
    var beatPulse: Float
}


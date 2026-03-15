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
    private var fractalComputePipelineState: MTLComputePipelineState?
    private var diffusionComputePipelineState: MTLComputePipelineState?
    private var diffusionRenderPipelineState: MTLRenderPipelineState?
    
    private var audioManager: AudioManager?
    private var diffusionModel = DiffusionModel()
    private var currentMode: VisualMode = .diffusion
    
    private var frameCount: UInt64 = 0
    private var lastFrameTime: CFTimeInterval = 0
    private var viewSize: CGSize = .zero
    
    // Particle system
    private var particleBuffer: MTLBuffer?
    private var particleCount: Int = 5000 // Reduced from 10000 for better performance
    
    // Diffusion state
    private var currentDiffusionImage: CGImage?
    private var isGeneratingDiffusion = false
    private var diffusionTexture: MTLTexture?
    
    // Fractal state
    private var fractalTexture: MTLTexture?
    private var fractalController: FractalController?
    
    func setFractalController(_ controller: FractalController) {
        fractalController = controller
    }
    
    func setupMetal(view: MTKView) {
        guard let device = MTLCreateSystemDefaultDevice() else {
            print("❌ Metal is not supported on this device")
            return
        }
        
        self.device = device
        view.device = device
        view.delegate = self
        
        commandQueue = device.makeCommandQueue()
        
        // Setup pipelines (keep synchronous but optimized)
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
    
    func getMode() -> VisualMode {
        return currentMode
    }
    
    private func setupRenderPipeline() {
        guard let device = device else { return }
        
        let library = device.makeDefaultLibrary()
        
        // Particle pipeline
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
        
        // Diffusion/Fullscreen pipeline
        let fullscreenVertex = library?.makeFunction(name: "fullscreen_vertex")
        let fullscreenFragment = library?.makeFunction(name: "fullscreen_fragment")
        
        let fullscreenDescriptor = MTLRenderPipelineDescriptor()
        fullscreenDescriptor.vertexFunction = fullscreenVertex
        fullscreenDescriptor.fragmentFunction = fullscreenFragment
        fullscreenDescriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
        
        do {
            diffusionRenderPipelineState = try device.makeRenderPipelineState(descriptor: fullscreenDescriptor)
        } catch {
            print("⚠️ Fullscreen pipeline not available, using fallback")
        }
    }
    
    private func setupComputePipeline() {
        guard let device = device else { return }
        
        let library = device.makeDefaultLibrary()
        
        // Particle compute
        if let computeFunction = library?.makeFunction(name: "particle_compute") {
            do {
                computePipelineState = try device.makeComputePipelineState(function: computeFunction)
            } catch {
                print("⚠️ Particle compute shader not available")
            }
        }
        
        // Fractal compute
        if let fractalFunction = library?.makeFunction(name: "fractal_compute") {
            do {
                fractalComputePipelineState = try device.makeComputePipelineState(function: fractalFunction)
            } catch {
                print("⚠️ Fractal compute shader not available")
            }
        }
        
        // Diffusion compute
        if let diffusionFunction = library?.makeFunction(name: "diffusion_compute") {
            do {
                diffusionComputePipelineState = try device.makeComputePipelineState(function: diffusionFunction)
            } catch {
                print("⚠️ Diffusion compute shader not available")
            }
        }
    }
    
    private func setupFractalTexture(size: CGSize) {
        guard let device = device else { return }
        
        // Ensure valid size
        let width = max(1, Int(size.width))
        let height = max(1, Int(size.height))
        
        // Optimized: Use 1x resolution for better performance
        // Supersampling in shader provides sufficient quality
        let textureDescriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .bgra8Unorm,
            width: width,
            height: height,
            mipmapped: false
        )
        textureDescriptor.usage = [.shaderWrite, .shaderRead]
        textureDescriptor.storageMode = .private // Use private storage for better performance
        
        fractalTexture = device.makeTexture(descriptor: textureDescriptor)
        diffusionTexture = device.makeTexture(descriptor: textureDescriptor)
        
        if fractalTexture == nil || diffusionTexture == nil {
            print("⚠️ Failed to create fractal/diffusion texture")
        }
    }
    
    private func setupParticles() {
        guard let device = device else { return }
        
        // Initialize particle buffer
        let particleSize = MemoryLayout<Particle>.size
        let bufferSize = particleCount * particleSize
        particleBuffer = device.makeBuffer(length: bufferSize, options: .storageModeShared)
        
        // Initialize particles with random positions (optimized batch initialization)
        if let buffer = particleBuffer {
            let particles = buffer.contents().bindMemory(to: Particle.self, capacity: particleCount)
            
            // Use batch initialization for better performance
            let center = SIMD2<Float>(0.5, 0.5)
            for i in 0..<particleCount {
                // Distribute particles more evenly for better visual
                let angle = Float(i) / Float(particleCount) * Float.pi * 2.0
                let radius = Float.random(in: 0.1...0.4)
                
                particles[i] = Particle(
                    position: center + SIMD2<Float>(
                        cos(angle) * radius,
                        sin(angle) * radius
                    ),
                    velocity: SIMD2<Float>(
                        Float.random(in: -0.01...0.01),
                        Float.random(in: -0.01...0.01)
                    ),
                    life: Float.random(in: 0.5...1.0), // Start with higher life
                    color: SIMD3<Float>(
                        Float.random(in: 0.3...1.0),
                        Float.random(in: 0.5...1.0),
                        Float.random(in: 0.7...1.0)
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
        viewSize = size
        // Recreate fractal texture if needed
        if size.width > 0 && size.height > 0 {
            setupFractalTexture(size: size)
        }
    }
    
    func draw(in view: MTKView) {
        guard let device = device,
              let commandQueue = commandQueue,
              let drawable = view.currentDrawable,
              let renderPassDescriptor = view.currentRenderPassDescriptor else {
            return
        }
        
        if viewSize.width == 0 || viewSize.height == 0 {
            viewSize = view.drawableSize
        }
        
        // Ensure textures are set up
        if fractalTexture == nil && viewSize.width > 0 && viewSize.height > 0 {
            setupFractalTexture(size: viewSize)
        }
        
        guard let commandBuffer = commandQueue.makeCommandBuffer() else {
            print("⚠️ Failed to create command buffer")
            return
        }
        
        switch currentMode {
        case .diffusion:
            renderDiffusionMode(
                commandBuffer: commandBuffer,
                renderPassDescriptor: renderPassDescriptor,
                drawable: drawable
            )
        case .particles:
            renderParticleMode(
                commandBuffer: commandBuffer,
                renderPassDescriptor: renderPassDescriptor,
                drawable: drawable
            )
        case .fractals:
            renderFractalMode(
                commandBuffer: commandBuffer,
                renderPassDescriptor: renderPassDescriptor,
                drawable: drawable
            )
        }
        
        commandBuffer.present(drawable)
        commandBuffer.commit()
        
        frameCount += 1
        
        // Update diffusion image very slowly - gentle mood-based changes (10x slower)
        if frameCount % 600 == 0 && currentMode == .diffusion {
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
        // Use diffusion compute shader for smooth, organic patterns
        guard let diffusionTexture = diffusionTexture,
              let diffusionCompute = diffusionComputePipelineState else {
            // Clear screen if no texture
            if let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor) {
                encoder.endEncoding()
            }
            return
        }
        
        // Generate diffusion pattern
        guard let computeEncoder = commandBuffer.makeComputeCommandEncoder() else {
            if let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor) {
                encoder.endEncoding()
            }
            return
        }
        
        computeEncoder.setComputePipelineState(diffusionCompute)
        computeEncoder.setTexture(diffusionTexture, index: 0)
        
        let features = (audioManager != nil) ? audioManager!.audioFeatures : AudioManager.AudioFeatures(
            bass: 0.0, mid: 0.0, treble: 0.0, energy: 0.0, beatPulse: 0.0, rms: 0.0
        )
        let uniforms = ParticleUniforms(
            time: Float(frameCount) / 60.0,
            bass: features.bass,
            mid: features.mid,
            treble: features.treble,
            energy: features.energy,
            beatPulse: features.beatPulse,
            fractalCenter: SIMD2<Float>(0.0, 0.0),
            fractalZoom: 0.4,
            fractalType: 0,
            juliaC: SIMD2<Float>(0.0, 0.0),
            useManualControl: 0
        )
        
        // Pack to Metal-compatible byte array
        let metalBytes = uniforms.toMetalBytes()
        guard let device = device else {
            computeEncoder.endEncoding()
            if let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor) {
                encoder.endEncoding()
            }
            return
        }
        guard metalBytes.count == 56 else {
            print("⚠️ Invalid byte array size: \(metalBytes.count), expected 56")
            computeEncoder.endEncoding()
            if let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor) {
                encoder.endEncoding()
            }
            return
        }
        guard let uniformsBuffer = metalBytes.withUnsafeBytes({ bytes -> MTLBuffer? in
            guard let baseAddress = bytes.baseAddress, bytes.count == 56 else { return nil }
            return device.makeBuffer(bytes: baseAddress, length: 56, options: [])
        }) else {
            computeEncoder.endEncoding()
            if let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor) {
                encoder.endEncoding()
            }
            return
        }
        
        computeEncoder.setBuffer(uniformsBuffer, offset: 0, index: 0)
        
        let textureWidth = max(1, diffusionTexture.width)
        let textureHeight = max(1, diffusionTexture.height)
        let threadgroupSize = MTLSize(width: 16, height: 16, depth: 1)
        
        // Calculate threadgroup count with safety bounds
        let widthCount = max(1, min(16384, (textureWidth + threadgroupSize.width - 1) / threadgroupSize.width))
        let heightCount = max(1, min(16384, (textureHeight + threadgroupSize.height - 1) / threadgroupSize.height))
        
        let threadgroupCount = MTLSize(
            width: widthCount,
            height: heightCount,
            depth: 1
        )
        
        // Validate threadgroup parameters before dispatch
        guard threadgroupCount.width > 0 && threadgroupCount.height > 0,
              threadgroupSize.width > 0 && threadgroupSize.height > 0,
              textureWidth > 0 && textureHeight > 0 else {
            print("⚠️ Invalid threadgroup parameters for diffusion")
            computeEncoder.endEncoding()
            return
        }
        
        computeEncoder.dispatchThreadgroups(threadgroupCount, threadsPerThreadgroup: threadgroupSize)
        computeEncoder.endEncoding()
        
        // Render texture to screen
        guard let renderState = diffusionRenderPipelineState,
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor) else {
            return
        }
        
        encoder.setRenderPipelineState(renderState)
        encoder.setFragmentTexture(diffusionTexture, index: 0)
        encoder.drawPrimitives(type: .triangleStrip, vertexStart: 0, vertexCount: 4)
        encoder.endEncoding()
    }
    
    private func renderParticleMode(
        commandBuffer: MTLCommandBuffer,
        renderPassDescriptor: MTLRenderPassDescriptor,
        drawable: CAMetalDrawable
    ) {
        guard let pipelineState = renderPipelineState,
              let particleBuffer = particleBuffer else { return }
        
        // Update particles with compute shader if available
        if let computePipelineState = computePipelineState {
            updateParticlesWithCompute(commandBuffer: commandBuffer)
        } else {
            updateParticlesCPU()
        }
        
        guard let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor) else {
            return
        }
        
        encoder.setRenderPipelineState(pipelineState)
        
        // Pass resolution to vertex shader
        var resolution = SIMD2<Float>(Float(viewSize.width), Float(viewSize.height))
        if let resolutionBuffer = device?.makeBuffer(bytes: &resolution, length: MemoryLayout<SIMD2<Float>>.size, options: []) {
            encoder.setVertexBuffer(resolutionBuffer, offset: 0, index: 1)
        }
        
        encoder.setVertexBuffer(particleBuffer, offset: 0, index: 0)
        encoder.drawPrimitives(type: .point, vertexStart: 0, vertexCount: particleCount)
        encoder.endEncoding()
    }
    
    private func renderFractalMode(
        commandBuffer: MTLCommandBuffer,
        renderPassDescriptor: MTLRenderPassDescriptor,
        drawable: CAMetalDrawable
    ) {
        guard let fractalTexture = fractalTexture,
              let fractalCompute = fractalComputePipelineState,
              fractalTexture.width > 0,
              fractalTexture.height > 0 else {
            // Clear screen if setup incomplete
            let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor)
            encoder?.endEncoding()
            return
        }
        
        // Generate fractal pattern
        guard let computeEncoder = commandBuffer.makeComputeCommandEncoder() else {
            print("⚠️ Failed to create compute encoder")
            let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor)
            encoder?.endEncoding()
            return
        }
        
        computeEncoder.setComputePipelineState(fractalCompute)
        computeEncoder.setTexture(fractalTexture, index: 0)
        
        // Get audio features if available, otherwise use defaults
        let features = audioManager?.audioFeatures ?? AudioManager.AudioFeatures(
            bass: 0.0, mid: 0.0, treble: 0.0, energy: 0.0, beatPulse: 0.0, rms: 0.0
        )
        
        // Get fractal controller state if available
        let useManual = fractalController != nil
        let centerX = Float(fractalController?.centerX ?? -0.77568377)
        let centerY = Float(fractalController?.centerY ?? 0.13646737)
        let zoom = Float(fractalController?.zoom ?? 0.4)
        // Always read the current fractal type (don't cache)
        let currentFractalType = fractalController?.fractalType ?? .mandelbrot
        let fractalType = getFractalTypeIndex(currentFractalType)
        let juliaCX = Float(fractalController?.juliaCX ?? 0.285)
        let juliaCY = Float(fractalController?.juliaCY ?? 0.01)
        
        // Update audio reactive mode if enabled
        if let controller = fractalController, controller.audioReactive, let audioManager = audioManager {
            controller.updateAudioReactive(energy: audioManager.audioFeatures.energy, beatPulse: audioManager.audioFeatures.beatPulse)
        }
        
        let uniforms = ParticleUniforms(
            time: Float(frameCount) / 60.0,
            bass: features.bass,
            mid: features.mid,
            treble: features.treble,
            energy: features.energy,
            beatPulse: features.beatPulse,
            fractalCenter: SIMD2<Float>(centerX, centerY),
            fractalZoom: zoom,
            fractalType: Int32(fractalType),
            juliaC: SIMD2<Float>(juliaCX, juliaCY),
            useManualControl: useManual ? 1 : 0
        )
        
        // Pack to Metal-compatible byte array
        let metalBytes = uniforms.toMetalBytes()
        guard metalBytes.count == 56 else {
            print("⚠️ Invalid byte array size: \(metalBytes.count), expected 56")
            computeEncoder.endEncoding()
            let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor)
            encoder?.endEncoding()
            return
        }
        guard let device = device else {
            print("⚠️ Device not available")
            computeEncoder.endEncoding()
            let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor)
            encoder?.endEncoding()
            return
        }
        guard let uniformsBuffer = metalBytes.withUnsafeBytes({ bytes -> MTLBuffer? in
            guard let baseAddress = bytes.baseAddress, bytes.count == 56 else { return nil }
            return device.makeBuffer(bytes: baseAddress, length: 56, options: [])
        }) else {
            print("⚠️ Failed to create uniforms buffer")
            computeEncoder.endEncoding()
            let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor)
            encoder?.endEncoding()
            return
        }
        
        computeEncoder.setBuffer(uniformsBuffer, offset: 0, index: 0)
        
        // Ensure valid texture dimensions
        let textureWidth = max(1, fractalTexture.width)
        let textureHeight = max(1, fractalTexture.height)
        
        // Use safe threadgroup size (16x16 is standard for 2D compute shaders)
        let threadgroupSize = MTLSize(width: 16, height: 16, depth: 1)
        
        // Calculate threadgroup count with safety bounds
        let widthCount = max(1, min(16384, (textureWidth + threadgroupSize.width - 1) / threadgroupSize.width))
        let heightCount = max(1, min(16384, (textureHeight + threadgroupSize.height - 1) / threadgroupSize.height))
        
        let threadgroupCount = MTLSize(
            width: widthCount,
            height: heightCount,
            depth: 1
        )
        
        // Validate threadgroup parameters before dispatch
        guard threadgroupCount.width > 0 && threadgroupCount.height > 0,
              threadgroupSize.width > 0 && threadgroupSize.height > 0,
              textureWidth > 0 && textureHeight > 0 else {
            print("⚠️ Invalid threadgroup parameters: count=\(threadgroupCount), size=\(threadgroupSize), texture=\(textureWidth)x\(textureHeight)")
            computeEncoder.endEncoding()
            return
        }
        
        computeEncoder.dispatchThreadgroups(threadgroupCount, threadsPerThreadgroup: threadgroupSize)
        computeEncoder.endEncoding()
        
        // Render texture to screen
        guard let renderState = diffusionRenderPipelineState,
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor) else {
            print("⚠️ Failed to create render encoder or pipeline state")
            return
        }
        
        encoder.setRenderPipelineState(renderState)
        encoder.setFragmentTexture(fractalTexture, index: 0)
        encoder.drawPrimitives(type: .triangleStrip, vertexStart: 0, vertexCount: 4)
        encoder.endEncoding()
    }
    
    private func updateParticlesWithCompute(commandBuffer: MTLCommandBuffer) {
        guard let computePipelineState = computePipelineState,
              let particleBuffer = particleBuffer else { return }
        
        guard let encoder = commandBuffer.makeComputeCommandEncoder() else {
            return
        }
        
        encoder.setComputePipelineState(computePipelineState)
        encoder.setBuffer(particleBuffer, offset: 0, index: 0)
        
        let features = audioManager?.audioFeatures ?? AudioManager.AudioFeatures(
            bass: 0.0, mid: 0.0, treble: 0.0, energy: 0.0, beatPulse: 0.0, rms: 0.0
        )
        let uniforms = ParticleUniforms(
            time: Float(frameCount) / 60.0,
            bass: features.bass,
            mid: features.mid,
            treble: features.treble,
            energy: features.energy,
            beatPulse: features.beatPulse,
            fractalCenter: SIMD2<Float>(0.0, 0.0),
            fractalZoom: 0.4,
            fractalType: 0,
            juliaC: SIMD2<Float>(0.0, 0.0),
            useManualControl: 0
        )
        
        var resolution = SIMD2<Float>(Float(viewSize.width), Float(viewSize.height))
        if let resolutionBuffer = device?.makeBuffer(bytes: &resolution, length: MemoryLayout<SIMD2<Float>>.size, options: []) {
            encoder.setBuffer(resolutionBuffer, offset: 0, index: 1)
        }
        
        // Pack to Metal-compatible byte array
        let metalBytes = uniforms.toMetalBytes()
        guard let device = device else {
            encoder.endEncoding()
            return
        }
        guard metalBytes.count == 56 else {
            print("⚠️ Invalid byte array size: \(metalBytes.count), expected 56")
            encoder.endEncoding()
            return
        }
        guard let uniformsBuffer = metalBytes.withUnsafeBytes({ bytes -> MTLBuffer? in
            guard let baseAddress = bytes.baseAddress, bytes.count == 56 else { return nil }
            return device.makeBuffer(bytes: baseAddress, length: 56, options: [])
        }) else {
            encoder.endEncoding()
            return
        }
        
        encoder.setBuffer(uniformsBuffer, offset: 0, index: 2)
        
        let threadgroupSize = MTLSize(width: 256, height: 1, depth: 1)
        let widthCount = max(1, min(16384, (particleCount + threadgroupSize.width - 1) / threadgroupSize.width))
        let threadgroupCount = MTLSize(width: widthCount, height: 1, depth: 1)
        
        // Validate threadgroup parameters before dispatch
        guard threadgroupCount.width > 0 && threadgroupSize.width > 0,
              particleCount > 0 else {
            print("⚠️ Invalid threadgroup parameters for particles")
            encoder.endEncoding()
            return
        }
        
        encoder.dispatchThreadgroups(threadgroupCount, threadsPerThreadgroup: threadgroupSize)
        encoder.endEncoding()
    }
    
    private func updateParticlesCPU() {
        guard let particleBuffer = particleBuffer,
              let audioManager = audioManager else { return }
        
        let particles = particleBuffer.contents().bindMemory(to: Particle.self, capacity: particleCount)
        let features = audioManager.audioFeatures
        let time = Float(frameCount) / 60.0
        let center = SIMD2<Float>(0.5, 0.5)
        
        for i in 0..<particleCount {
            var p = particles[i]
            
            // Update position
            p.position += p.velocity
            
            // Apply subtle audio-reactive forces
            let dir = p.position - center
            let dist = length(dir)
            
            if dist > 0.001 {
                // Bass: very subtle mood-based radial expansion (10x slower)
                let bassForce = features.energy * 0.003
                p.velocity += normalize(dir) * bassForce
                
                // Mid: very gentle mood-based swirling (10x slower)
                let angle = atan2(dir.y, dir.x)
                let swirl = features.energy * 0.002
                let newAngle = angle + swirl
                p.velocity += SIMD2<Float>(cos(newAngle), sin(newAngle)) * dist * 0.001
            }
            
            // Treble: very subtle mood-based jitter (10x slower)
            p.velocity += SIMD2<Float>(
                Float.random(in: -1...1) * features.energy * 0.0005,
                Float.random(in: -1...1) * features.energy * 0.0005
            )
            
            // Damping - stronger to keep particles centered
            p.velocity *= 0.95
            
            // Gentle centering force
            let centerForce = (center - p.position) * 0.001
            p.velocity += centerForce
            
            // Wrap around
            if p.position.x < 0 { p.position.x = 1 }
            if p.position.x > 1 { p.position.x = 0 }
            if p.position.y < 0 { p.position.y = 1 }
            if p.position.y > 1 { p.position.y = 0 }
            
            // Update life
            p.life -= 0.01
            if p.life <= 0 {
                p.life = 1.0
                // Respawn near center
                p.position = center + SIMD2<Float>(
                    Float.random(in: -0.2...0.2),
                    Float.random(in: -0.2...0.2)
                )
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
    // Fractal control
    var fractalCenter: SIMD2<Float>
    var fractalZoom: Float
    var fractalType: Int32
    var juliaC: SIMD2<Float>
    var useManualControl: Int32
    
    // Metal struct size calculation:
    // 6 floats: 24 bytes (offset 0-23)
    // float2 fractalCenter: 8 bytes (offset 24-31, aligned to 8)
    // float fractalZoom: 4 bytes (offset 32-35)
    // int fractalType: 4 bytes (offset 36-39)
    // float2 juliaC: 8 bytes (offset 40-47, aligned to 8)
    // int useManualControl: 4 bytes (offset 48-51)
    // Padding: 4 bytes (offset 52-55) to align to 16-byte boundary
    // Total: 56 bytes (Metal aligns structs to 16 bytes)
    static var metalSize: Int {
        return 56
    }
    
    // Pack struct data into byte array matching Metal's exact layout
    func toMetalBytes() -> [UInt8] {
        var bytes = [UInt8](repeating: 0, count: 56) // 52 bytes data + 4 bytes padding
        var offset = 0
        
        // 6 floats: 24 bytes (offset 0-23)
        withUnsafeBytes(of: time) { buffer in
            guard buffer.count >= 4 else { return }
            let sourceBytes = Array(buffer[0..<4])
            bytes.replaceSubrange(offset..<offset+4, with: sourceBytes)
        }
        offset += 4
        withUnsafeBytes(of: bass) { buffer in
            guard buffer.count >= 4 else { return }
            let sourceBytes = Array(buffer[0..<4])
            bytes.replaceSubrange(offset..<offset+4, with: sourceBytes)
        }
        offset += 4
        withUnsafeBytes(of: mid) { buffer in
            guard buffer.count >= 4 else { return }
            let sourceBytes = Array(buffer[0..<4])
            bytes.replaceSubrange(offset..<offset+4, with: sourceBytes)
        }
        offset += 4
        withUnsafeBytes(of: treble) { buffer in
            guard buffer.count >= 4 else { return }
            let sourceBytes = Array(buffer[0..<4])
            bytes.replaceSubrange(offset..<offset+4, with: sourceBytes)
        }
        offset += 4
        withUnsafeBytes(of: energy) { buffer in
            guard buffer.count >= 4 else { return }
            let sourceBytes = Array(buffer[0..<4])
            bytes.replaceSubrange(offset..<offset+4, with: sourceBytes)
        }
        offset += 4
        withUnsafeBytes(of: beatPulse) { buffer in
            guard buffer.count >= 4 else { return }
            let sourceBytes = Array(buffer[0..<4])
            bytes.replaceSubrange(offset..<offset+4, with: sourceBytes)
        }
        offset += 4
        
        // float2 fractalCenter: 8 bytes (offset 24-31)
        withUnsafeBytes(of: fractalCenter) { buffer in
            guard buffer.count >= 8 else { return }
            let sourceBytes = Array(buffer[0..<8])
            bytes.replaceSubrange(offset..<offset+8, with: sourceBytes)
        }
        offset += 8
        
        // float fractalZoom: 4 bytes (offset 32-35)
        withUnsafeBytes(of: fractalZoom) { buffer in
            guard buffer.count >= 4 else { return }
            let sourceBytes = Array(buffer[0..<4])
            bytes.replaceSubrange(offset..<offset+4, with: sourceBytes)
        }
        offset += 4
        
        // int fractalType: 4 bytes (offset 36-39)
        withUnsafeBytes(of: fractalType) { buffer in
            guard buffer.count >= 4 else { return }
            let sourceBytes = Array(buffer[0..<4])
            bytes.replaceSubrange(offset..<offset+4, with: sourceBytes)
        }
        offset += 4
        
        // float2 juliaC: 8 bytes (offset 40-47)
        withUnsafeBytes(of: juliaC) { buffer in
            guard buffer.count >= 8 else { return }
            let sourceBytes = Array(buffer[0..<8])
            bytes.replaceSubrange(offset..<offset+8, with: sourceBytes)
        }
        offset += 8
        
        // int useManualControl: 4 bytes (offset 48-51)
        withUnsafeBytes(of: useManualControl) { buffer in
            guard buffer.count >= 4 else { return }
            let sourceBytes = Array(buffer[0..<4])
            bytes.replaceSubrange(offset..<offset+4, with: sourceBytes)
        }
        offset += 4
        
        // Padding: 4 bytes (offset 52-55) to align to 16-byte boundary
        // Bytes 52-55 remain as zeros (already initialized)
        
        return bytes
    }
}

extension VisualizerEngine {
    private func getFractalTypeIndex(_ type: FractalType) -> Int {
        switch type {
        case .mandelbrot: return 0
        case .julia: return 1
        case .burningShip: return 2
        case .tricorn: return 3
        case .multibrot3: return 4
        case .multibrot4: return 5
        case .newton: return 6
        case .phoenix: return 7
        }
    }
}


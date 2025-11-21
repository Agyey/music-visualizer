//
//  MetalVisualizerView.swift
//  MusicVisualizer
//

import SwiftUI
import MetalKit

struct MetalVisualizerView: UIViewRepresentable {
    let engine: VisualizerEngine
    
    func makeUIView(context: Context) -> MTKView {
        let mtkView = MTKView()
        mtkView.device = MTLCreateSystemDefaultDevice()
        mtkView.preferredFramesPerSecond = 60
        mtkView.enableSetNeedsDisplay = false
        mtkView.isPaused = false
        mtkView.framebufferOnly = false
        mtkView.clearColor = MTLClearColor(red: 0.02, green: 0.024, blue: 0.04, alpha: 1.0)
        
        engine.setupMetal(view: mtkView)
        
        return mtkView
    }
    
    func updateUIView(_ uiView: MTKView, context: Context) {
        // Updates handled by engine
    }
}


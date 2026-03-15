//
//  FrakslView.swift
//  MusicVisualizer
//
//  Fraksl-like fractal explorer view with minimal UI

import SwiftUI
import MetalKit
import UIKit

struct FrakslView: View {
    @StateObject private var fractalController = FractalController()
    @StateObject private var visualizer = VisualizerEngine()
    @ObservedObject var audioManager: AudioManager
    @State private var showControls = false
    @State private var showFractalTypePicker = false
    @State private var showModeSelector = false
    
    var body: some View {
        ZStack {
            // Fractal renderer
            FrakslMetalView(
                engine: visualizer,
                controller: fractalController
            )
            .ignoresSafeArea()
            .simultaneousGesture(
                // Pan gesture - only when UI is hidden
                DragGesture(minimumDistance: 10)
                    .onChanged { value in
                        guard !showControls && !showFractalTypePicker && !showModeSelector else { return }
                        let viewSize = UIScreen.main.bounds.size
                        fractalController.handlePan(
                            translation: value.translation,
                            viewSize: viewSize
                        )
                    }
                    .onEnded { _ in
                        // Reset pan translation tracking when gesture ends
                        fractalController.resetPanTracking()
                    }
            )
            .simultaneousGesture(
                // Pinch gesture - only when UI is hidden
                MagnificationGesture()
                    .onChanged { scale in
                        guard !showControls && !showFractalTypePicker && !showModeSelector else { return }
                        fractalController.handlePinch(scale: scale, state: .changed)
                    }
                    .onEnded { _ in
                        fractalController.handlePinch(scale: 1.0, state: .ended)
                    }
            )
            .onTapGesture(count: 2) { location in
                guard !showControls && !showFractalTypePicker && !showModeSelector else { return }
                fractalController.handleDoubleTap(at: location, viewSize: UIScreen.main.bounds.size)
            }
            .onLongPressGesture {
                guard !showControls && !showFractalTypePicker && !showModeSelector else { return }
                fractalController.handleLongPress(at: CGPoint(x: UIScreen.main.bounds.midX, y: UIScreen.main.bounds.midY), viewSize: UIScreen.main.bounds.size)
            }
            
            // Minimal UI overlay - separate layer for buttons
            VStack {
                // Top bar - minimal, auto-hide
                HStack {
                    // Menu button
                    Button(action: {
                        withAnimation {
                            showControls.toggle()
                        }
                    }) {
                        Image(systemName: showControls ? "xmark.circle.fill" : "slider.horizontal.3")
                            .font(.title2)
                            .foregroundColor(.white)
                            .padding(12)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .buttonStyle(PlainButtonStyle())
                    .allowsHitTesting(true)
                    .zIndex(100)
                    
                    Spacer()
                    
                    // Mode selector button
                    Button(action: {
                        withAnimation {
                            showModeSelector.toggle()
                        }
                    }) {
                        Image(systemName: "square.grid.2x2")
                            .font(.title2)
                            .foregroundColor(.white)
                            .padding(12)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .buttonStyle(PlainButtonStyle())
                    .allowsHitTesting(true)
                    .zIndex(100)
                    
                    // Fractal type button
                    Button(action: {
                        withAnimation {
                            showFractalTypePicker.toggle()
                        }
                    }) {
                        Text(fractalController.fractalType.rawValue)
                            .font(.caption)
                            .foregroundColor(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(.ultraThinMaterial)
                            .cornerRadius(8)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .allowsHitTesting(true)
                    .zIndex(100)
                    
                    // Save button
                    Button(action: {
                        saveFractal()
                    }) {
                        Image(systemName: "square.and.arrow.down")
                            .font(.title2)
                            .foregroundColor(.white)
                            .padding(12)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .buttonStyle(PlainButtonStyle())
                    .allowsHitTesting(true)
                    .zIndex(100)
                }
                .padding()
                .opacity(showControls ? 1.0 : 0.5)
                .allowsHitTesting(true)
                .contentShape(Rectangle())
                .zIndex(1000)
                
                Spacer()
                
                // Bottom controls - slide up when shown
                if showControls {
                    VStack(spacing: 16) {
                        // Audio controls
                        AudioControlsView(audioManager: audioManager)
                        
                        Divider()
                            .background(.white.opacity(0.3))
                        
                        // Fractal type picker
                        Picker("Fractal Type", selection: $fractalController.fractalType) {
                            ForEach(FractalType.allCases, id: \.self) { type in
                                Text(type.rawValue).tag(type)
                            }
                        }
                        .pickerStyle(.segmented)
                        
                        // Zoom info
                        HStack {
                            Text("Zoom: \(String(format: "%.2e", fractalController.zoom))")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.7))
                            
                            Spacer()
                            
                            Text("Center: (\(String(format: "%.6f", fractalController.centerX)), \(String(format: "%.6f", fractalController.centerY)))")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.7))
                        }
                        
                        // Reset button
                        Button(action: {
                            fractalController.resetToDefault()
                        }) {
                            Label("Reset View", systemImage: "arrow.counterclockwise")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(.ultraThinMaterial)
                                .cornerRadius(12)
                        }
                        .buttonStyle(PlainButtonStyle())
                        
                        // Audio reactive toggle
                        Toggle("Audio Reactive", isOn: $fractalController.audioReactive)
                            .padding()
                            .background(.ultraThinMaterial)
                            .cornerRadius(12)
                    }
                    .padding()
                    .background(.ultraThinMaterial)
                    .cornerRadius(20)
                    .padding()
                    .transition(.move(edge: .bottom))
                }
            }
            
            // Fractal type picker sheet
            if showFractalTypePicker {
                Color.black.opacity(0.5)
                    .ignoresSafeArea()
                    .onTapGesture {
                        withAnimation {
                            showFractalTypePicker = false
                        }
                    }
                
                VStack(spacing: 12) {
                    Text("Select Fractal Type")
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    ForEach(FractalType.allCases, id: \.self) { type in
                        Button(action: {
                            // Force update by setting the property
                            fractalController.fractalType = type
                            // Trigger objectWillChange to ensure UI updates
                            fractalController.objectWillChange.send()
                            withAnimation {
                                showFractalTypePicker = false
                            }
                        }) {
                            HStack {
                                Text(type.rawValue)
                                    .foregroundColor(.white)
                                Spacer()
                                if fractalController.fractalType == type {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.white)
                                }
                            }
                            .padding()
                            .background(fractalController.fractalType == type ? Color.blue : Color.white.opacity(0.1))
                            .cornerRadius(8)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
                .padding()
                .background(.ultraThinMaterial)
                .cornerRadius(20)
                .padding()
            }
            
            // Mode selector sheet
            if showModeSelector {
                Color.black.opacity(0.5)
                    .ignoresSafeArea()
                    .onTapGesture {
                        withAnimation {
                            showModeSelector = false
                        }
                    }
                
                VStack(spacing: 12) {
                    Text("Select Visualizer Mode")
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Button(action: {
                        visualizer.setMode(.fractals)
                        withAnimation {
                            showModeSelector = false
                        }
                    }) {
                        HStack {
                            Text("Fractals")
                                .foregroundColor(.white)
                            Spacer()
                            if visualizer.getMode() == .fractals {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.white)
                            }
                        }
                        .padding()
                        .background(visualizer.getMode() == .fractals ? Color.blue : Color.white.opacity(0.1))
                        .cornerRadius(8)
                    }
                    .buttonStyle(PlainButtonStyle())
                    
                    Button(action: {
                        visualizer.setMode(.particles)
                        withAnimation {
                            showModeSelector = false
                        }
                    }) {
                        HStack {
                            Text("Particles")
                                .foregroundColor(.white)
                            Spacer()
                            if visualizer.getMode() == .particles {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.white)
                            }
                        }
                        .padding()
                        .background(visualizer.getMode() == .particles ? Color.blue : Color.white.opacity(0.1))
                        .cornerRadius(8)
                    }
                    .buttonStyle(PlainButtonStyle())
                    
                    Button(action: {
                        visualizer.setMode(.diffusion)
                        withAnimation {
                            showModeSelector = false
                        }
                    }) {
                        HStack {
                            Text("Diffusion")
                                .foregroundColor(.white)
                            Spacer()
                            if visualizer.getMode() == .diffusion {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.white)
                            }
                        }
                        .padding()
                        .background(visualizer.getMode() == .diffusion ? Color.blue : Color.white.opacity(0.1))
                        .cornerRadius(8)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                .padding()
                .background(.ultraThinMaterial)
                .cornerRadius(20)
                .padding()
            }
        }
        .onAppear {
            // Set mode only once to avoid repeated setup
            if visualizer.getMode() != .fractals {
                visualizer.setMode(.fractals)
            }
            // Ensure audio manager is connected
            visualizer.setAudioManager(audioManager)
        }
    }
    
    private func saveFractal() {
        // Capture screenshot of the current fractal view
        // Note: This is a simplified version - in production you'd want to capture the Metal view
        let renderer = UIGraphicsImageRenderer(size: UIScreen.main.bounds.size)
        let image = renderer.image { context in
            // The actual fractal is rendered in Metal, so we'd need to capture from the MTKView
            // For now, we'll use a placeholder approach
        }
        
        // Share the fractal
        let activityVC = UIActivityViewController(
            activityItems: [image],
            applicationActivities: nil
        )
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootViewController = windowScene.windows.first?.rootViewController {
            rootViewController.present(activityVC, animated: true)
        }
    }
}

struct FrakslMetalView: UIViewRepresentable {
    let engine: VisualizerEngine
    @ObservedObject var controller: FractalController
    
    func makeUIView(context: Context) -> MTKView {
        let mtkView = MTKView()
        mtkView.device = MTLCreateSystemDefaultDevice()
        mtkView.preferredFramesPerSecond = 60
        mtkView.enableSetNeedsDisplay = false
        mtkView.isPaused = false
        mtkView.framebufferOnly = false
        mtkView.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1.0)
        
        engine.setupMetal(view: mtkView)
        engine.setFractalController(controller)
        
        return mtkView
    }
    
    func updateUIView(_ uiView: MTKView, context: Context) {
        // Updates handled by engine
    }
}


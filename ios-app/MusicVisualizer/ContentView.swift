//
//  ContentView.swift
//  MusicVisualizer
//

import SwiftUI
import AVFoundation

struct ContentView: View {
    @StateObject private var audioManager = AudioManager()
    @StateObject private var visualizer = VisualizerEngine()
    @State private var selectedMode: VisualMode = .fractals
    @State private var useFrakslMode = true
    @State private var isInitialized = false
    
    var body: some View {
        Group {
            if useFrakslMode && selectedMode == .fractals {
                // Fraksl-like fractal explorer
                FrakslView(audioManager: audioManager)
            } else {
                // Original multi-mode view
                ZStack {
                    // Metal renderer view
                    MetalVisualizerView(engine: visualizer)
                        .ignoresSafeArea()
                    
                    // Control overlay
                    VStack {
                        Spacer()
                        
                        // Mode selector
                        Picker("Mode", selection: $selectedMode) {
                            Text("Diffusion").tag(VisualMode.diffusion)
                            Text("Particles").tag(VisualMode.particles)
                            Text("Fractals").tag(VisualMode.fractals)
                        }
                        .pickerStyle(.segmented)
                        .padding()
                        .background(.ultraThinMaterial)
                        .cornerRadius(12)
                        .padding(.horizontal)
                        .onChange(of: selectedMode) { newMode in
                            visualizer.setMode(newMode)
                            useFrakslMode = (newMode == .fractals)
                        }
                        
                        // Audio controls
                        AudioControlsView(audioManager: audioManager)
                            .padding()
                            .background(.ultraThinMaterial)
                            .cornerRadius(12)
                            .padding(.horizontal)
                            .padding(.bottom)
                    }
        }
        .onAppear {
            // Initialize only once
            if !isInitialized {
                visualizer.setAudioManager(audioManager)
                isInitialized = true
            }
        }
            }
        }
    }
}

enum VisualMode {
    case diffusion
    case particles
    case fractals
}


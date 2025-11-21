//
//  ContentView.swift
//  MusicVisualizer
//
//  Created by AI Assistant
//

import SwiftUI
import AVFoundation

struct ContentView: View {
    @StateObject private var audioManager = AudioManager()
    @StateObject private var visualizer = VisualizerEngine()
    @State private var selectedMode: VisualMode = .diffusion
    
    var body: some View {
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
            visualizer.setAudioManager(audioManager)
        }
    }
}

enum VisualMode {
    case diffusion
    case particles
    case fractals
}


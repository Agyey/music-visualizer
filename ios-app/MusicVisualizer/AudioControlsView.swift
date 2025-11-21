//
//  AudioControlsView.swift
//  MusicVisualizer
//
//  Created by AI Assistant
//

import SwiftUI
import PhotosUI

struct AudioControlsView: View {
    @ObservedObject var audioManager: AudioManager
    @State private var showingFilePicker = false
    
    var body: some View {
        VStack(spacing: 12) {
            // Playback controls
            HStack(spacing: 20) {
                Button(action: {
                    if audioManager.isPlaying {
                        audioManager.pause()
                    } else {
                        audioManager.play()
                    }
                }) {
                    Image(systemName: audioManager.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 44))
                        .foregroundColor(.white)
                }
                
                Button(action: {
                    audioManager.stop()
                }) {
                    Image(systemName: "stop.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(.white.opacity(0.7))
                }
                
                Button(action: {
                    showingFilePicker = true
                }) {
                    Image(systemName: "music.note.list")
                        .font(.system(size: 32))
                        .foregroundColor(.white.opacity(0.7))
                }
            }
            
            // Time display
            HStack {
                Text(formatTime(audioManager.currentTime))
                    .font(.caption.monospacedDigit())
                    .foregroundColor(.white.opacity(0.8))
                
                Spacer()
                
                Text(formatTime(audioManager.duration))
                    .font(.caption.monospacedDigit())
                    .foregroundColor(.white.opacity(0.8))
            }
            
            // Audio features visualization
            HStack(spacing: 8) {
                FeatureBar(value: audioManager.audioFeatures.bass, color: .red)
                FeatureBar(value: audioManager.audioFeatures.mid, color: .green)
                FeatureBar(value: audioManager.audioFeatures.treble, color: .blue)
                FeatureBar(value: audioManager.audioFeatures.energy, color: .yellow)
            }
            .frame(height: 4)
        }
        .fileImporter(
            isPresented: $showingFilePicker,
            allowedContentTypes: [.audio],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first {
                    do {
                        try audioManager.loadAudioFile(url: url)
                    } catch {
                        print("Failed to load audio: \(error)")
                    }
                }
            case .failure(let error):
                print("File picker error: \(error)")
            }
        }
    }
    
    private func formatTime(_ time: TimeInterval) -> String {
        let minutes = Int(time) / 60
        let seconds = Int(time) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

struct FeatureBar: View {
    let value: Float
    let color: Color
    
    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(color.opacity(0.2))
                
                Rectangle()
                    .fill(color)
                    .frame(width: geometry.size.width * CGFloat(value))
            }
        }
    }
}


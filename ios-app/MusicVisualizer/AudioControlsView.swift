//
//  AudioControlsView.swift
//  MusicVisualizer
//

import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct AudioControlsView: View {
    @ObservedObject var audioManager: AudioManager
    @State private var showingFilePicker = false
    @State private var errorMessage: String?
    
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
            
            // Error message
            if let errorMessage = errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundColor(.red)
                    .padding(.top, 4)
            }
        }
        .fileImporter(
            isPresented: $showingFilePicker,
            allowedContentTypes: [
                .audio,
                .mp3,
                UTType(filenameExtension: "m4a") ?? .audio,
                UTType(filenameExtension: "wav") ?? .audio,
                UTType(filenameExtension: "aiff") ?? .audio
            ],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first {
                    // Access security-scoped resource
                    guard url.startAccessingSecurityScopedResource() else {
                        print("Failed to access security-scoped resource")
                        return
                    }
                    defer { url.stopAccessingSecurityScopedResource() }
                    
                    // Load audio file on main thread
                    DispatchQueue.main.async {
                        errorMessage = nil
                        do {
                            try audioManager.loadAudioFile(url: url)
                            print("✅ Audio file loaded successfully: \(url.lastPathComponent)")
                        } catch {
                            let errorMsg = "Failed to load: \(error.localizedDescription)"
                            errorMessage = errorMsg
                            print("❌ \(errorMsg)")
                        }
                    }
                }
            case .failure(let error):
                print("❌ File picker error: \(error.localizedDescription)")
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


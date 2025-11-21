//
//  AudioManager.swift
//  MusicVisualizer
//

import AVFoundation
import Accelerate
import Combine

class AudioManager: ObservableObject {
    @Published var isPlaying = false
    @Published var currentTime: TimeInterval = 0
    @Published var duration: TimeInterval = 0
    @Published var audioFeatures: AudioFeatures = AudioFeatures()
    
    private var audioEngine: AVAudioEngine?
    private var audioPlayer: AVAudioPlayerNode?
    private var audioFile: AVAudioFile?
    private var fftSetup: vDSP_DFT_Setup?
    private var tempFileURL: URL?
    
    private var timer: Timer?
    
    struct AudioFeatures {
        var bass: Float = 0.0
        var mid: Float = 0.0
        var treble: Float = 0.0
        var energy: Float = 0.0
        var beatPulse: Float = 0.0
        var rms: Float = 0.0
    }
    
    func loadAudioFile(url: URL) throws {
        // Stop any current playback
        stop()
        
        // Clean up existing engine
        audioEngine?.stop()
        audioEngine?.mainMixerNode.removeTap(onBus: 0)
        audioEngine = nil
        audioPlayer = nil
        
        // Clean up old temp file
        if let oldTempURL = tempFileURL {
            try? FileManager.default.removeItem(at: oldTempURL)
            tempFileURL = nil
        }
        
        // Copy file to temporary location for persistent access
        let tempDir = FileManager.default.temporaryDirectory
        let tempFileName = "\(UUID().uuidString)_\(url.lastPathComponent)"
        let tempFile = tempDir.appendingPathComponent(tempFileName)
        
        // Access security-scoped resource to copy
        guard url.startAccessingSecurityScopedResource() else {
            throw NSError(domain: "AudioManager", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to access security-scoped resource"])
        }
        defer { url.stopAccessingSecurityScopedResource() }
        
        // Copy file to temp location
        try FileManager.default.copyItem(at: url, to: tempFile)
        tempFileURL = tempFile
        
        print("📁 Copied audio file to temp location: \(tempFile.lastPathComponent)")
        
        // Load from temp location
        audioFile = try AVAudioFile(forReading: tempFile)
        guard let file = audioFile else {
            throw NSError(domain: "AudioManager", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create audio file"])
        }
        
        let sampleRate = file.fileFormat.sampleRate
        duration = Double(file.length) / sampleRate
        
        print("✅ Loaded audio file: \(url.lastPathComponent)")
        print("   Duration: \(duration)s, Sample Rate: \(sampleRate)Hz")
        
        setupAudioEngine()
    }
    
    private func setupAudioEngine() {
        guard let audioFile = audioFile else {
            print("⚠️ No audio file to set up")
            return
        }
        
        audioEngine = AVAudioEngine()
        audioPlayer = AVAudioPlayerNode()
        
        guard let engine = audioEngine, let player = audioPlayer else {
            print("⚠️ Failed to create audio engine or player")
            return
        }
        
        engine.attach(player)
        
        let format = audioFile.processingFormat
        engine.connect(player, to: engine.mainMixerNode, format: format)
        
        // Install tap on main mixer for analysis
        let bufferSize: AVAudioFrameCount = 4096
        engine.mainMixerNode.installTap(onBus: 0, bufferSize: bufferSize, format: format) { [weak self] buffer, _ in
            self?.analyzeAudio(buffer: buffer)
        }
        
        do {
            try engine.start()
            print("✅ Audio engine started successfully")
        } catch {
            print("❌ Failed to start audio engine: \(error.localizedDescription)")
        }
    }
    
    private func analyzeAudio(buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData else { return }
        let frameLength = Int(buffer.frameLength)
        let channelCount = Int(buffer.format.channelCount)
        
        // Calculate RMS for overall energy
        var rms: Float = 0.0
        vDSP_rmsqv(channelData[0], 1, &rms, vDSP_Length(frameLength))
        
        // FFT for frequency analysis
        let fftSize = 2048
        var realp = [Float](repeating: 0, count: fftSize)
        var imagp = [Float](repeating: 0, count: fftSize)
        
        // Copy audio data
        for i in 0..<min(frameLength, fftSize) {
            realp[i] = channelData[0][i]
        }
        
        // Perform FFT
        let log2n = vDSP_Length(log2(Double(fftSize)))
        guard let fft = vDSP_create_fftsetup(log2n, FFTRadix(kFFTRadix2)) else { return }
        defer { vDSP_destroy_fftsetup(fft) }
        
        var splitComplex = DSPSplitComplex(realp: &realp, imagp: &imagp)
        vDSP_fft_zrip(fft, &splitComplex, 1, log2n, FFTDirection(FFT_FORWARD))
        
        // Calculate magnitude
        var magnitudes = [Float](repeating: 0, count: fftSize / 2)
        vDSP_zvmags(&splitComplex, 1, &magnitudes, 1, vDSP_Length(fftSize / 2))
        
        // Extract frequency bands
        let sampleRate = Float(buffer.format.sampleRate)
        let nyquist = sampleRate / 2.0
        let binWidth = nyquist / Float(fftSize / 2)
        
        // Bass: 20-250 Hz
        let bassStart = Int(20.0 / binWidth)
        let bassEnd = min(Int(250.0 / binWidth), magnitudes.count)
        var bassSum: Float = 0.0
        var bassValue: Float = 0.0
        if bassEnd > bassStart {
            magnitudes.withUnsafeBufferPointer { buffer in
                vDSP_sve(buffer.baseAddress! + bassStart, 1, &bassSum, vDSP_Length(bassEnd - bassStart))
            }
            bassValue = sqrt(bassSum / Float(bassEnd - bassStart))
        }
        
        // Mid: 250-4000 Hz
        let midStart = Int(250.0 / binWidth)
        let midEnd = min(Int(4000.0 / binWidth), magnitudes.count)
        var midSum: Float = 0.0
        var midValue: Float = 0.0
        if midEnd > midStart {
            magnitudes.withUnsafeBufferPointer { buffer in
                vDSP_sve(buffer.baseAddress! + midStart, 1, &midSum, vDSP_Length(midEnd - midStart))
            }
            midValue = sqrt(midSum / Float(midEnd - midStart))
        }
        
        // Treble: 4000-20000 Hz
        let trebleStart = Int(4000.0 / binWidth)
        let trebleEnd = min(Int(20000.0 / binWidth), magnitudes.count)
        var trebleSum: Float = 0.0
        var trebleValue: Float = 0.0
        if trebleEnd > trebleStart {
            magnitudes.withUnsafeBufferPointer { buffer in
                vDSP_sve(buffer.baseAddress! + trebleStart, 1, &trebleSum, vDSP_Length(trebleEnd - trebleStart))
            }
            trebleValue = sqrt(trebleSum / Float(trebleEnd - trebleStart))
        }
        
        // Beat detection (simple peak detection)
        let peak = magnitudes.max() ?? 0.0
        let beatPulse = min(peak * 10.0, 1.0)
        
        // Update all @Published properties on main thread
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.audioFeatures.bass = bassValue
            self.audioFeatures.mid = midValue
            self.audioFeatures.treble = trebleValue
            self.audioFeatures.energy = rms
            self.audioFeatures.rms = rms
            self.audioFeatures.beatPulse = beatPulse
        }
    }
    
    func play() {
        guard let engine = audioEngine, let player = audioPlayer, let file = audioFile else { return }
        
        if !isPlaying {
            player.scheduleFile(file, at: nil) { [weak self] in
                DispatchQueue.main.async {
                    self?.isPlaying = false
                }
            }
            player.play()
            isPlaying = true
            
            // Start timer for current time tracking
            timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
                guard let self = self, let player = self.audioPlayer else { return }
                if let nodeTime = player.lastRenderTime, let playerTime = player.playerTime(forNodeTime: nodeTime) {
                    self.currentTime = Double(playerTime.sampleTime) / playerTime.sampleRate
                }
            }
        }
    }
    
    func pause() {
        audioPlayer?.pause()
        isPlaying = false
        timer?.invalidate()
    }
    
    func stop() {
        audioPlayer?.stop()
        isPlaying = false
        timer?.invalidate()
        currentTime = 0
    }
}


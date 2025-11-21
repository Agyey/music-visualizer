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
        audioFile = try AVAudioFile(forReading: url)
        duration = Double(audioFile?.length ?? 0) / (audioFile?.fileFormat.sampleRate ?? 44100)
        
        setupAudioEngine()
    }
    
    private func setupAudioEngine() {
        guard let audioFile = audioFile else { return }
        
        audioEngine = AVAudioEngine()
        audioPlayer = AVAudioPlayerNode()
        
        guard let engine = audioEngine, let player = audioPlayer else { return }
        
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
        } catch {
            print("Failed to start audio engine: \(error)")
        }
    }
    
    private func analyzeAudio(buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData else { return }
        let frameLength = Int(buffer.frameLength)
        let channelCount = Int(buffer.format.channelCount)
        
        // Calculate RMS for overall energy
        var rms: Float = 0.0
        vDSP_rmsqv(channelData[0], 1, &rms, vDSP_Length(frameLength))
        audioFeatures.rms = rms
        audioFeatures.energy = rms
        
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
        if bassEnd > bassStart {
            magnitudes.withUnsafeBufferPointer { buffer in
                vDSP_sve(buffer.baseAddress! + bassStart, 1, &bassSum, vDSP_Length(bassEnd - bassStart))
            }
            audioFeatures.bass = sqrt(bassSum / Float(bassEnd - bassStart))
        }
        
        // Mid: 250-4000 Hz
        let midStart = Int(250.0 / binWidth)
        let midEnd = min(Int(4000.0 / binWidth), magnitudes.count)
        var midSum: Float = 0.0
        if midEnd > midStart {
            magnitudes.withUnsafeBufferPointer { buffer in
                vDSP_sve(buffer.baseAddress! + midStart, 1, &midSum, vDSP_Length(midEnd - midStart))
            }
            audioFeatures.mid = sqrt(midSum / Float(midEnd - midStart))
        }
        
        // Treble: 4000-20000 Hz
        let trebleStart = Int(4000.0 / binWidth)
        let trebleEnd = min(Int(20000.0 / binWidth), magnitudes.count)
        var trebleSum: Float = 0.0
        if trebleEnd > trebleStart {
            magnitudes.withUnsafeBufferPointer { buffer in
                vDSP_sve(buffer.baseAddress! + trebleStart, 1, &trebleSum, vDSP_Length(trebleEnd - trebleStart))
            }
            audioFeatures.treble = sqrt(trebleSum / Float(trebleEnd - trebleStart))
        }
        
        // Beat detection (simple peak detection)
        let peak = magnitudes.max() ?? 0.0
        audioFeatures.beatPulse = min(peak * 10.0, 1.0)
        
        DispatchQueue.main.async {
            self.objectWillChange.send()
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


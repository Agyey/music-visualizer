//
//  FractalController.swift
//  MusicVisualizer
//
//  Fraksl-like fractal exploration controller with touch gestures

import Foundation
import SwiftUI
import Combine

// FractalType enum - accessible within the module
enum FractalType: String, CaseIterable {
    case mandelbrot = "Mandelbrot"
    case julia = "Julia"
    case burningShip = "Burning Ship"
    case tricorn = "Tricorn"
    case multibrot3 = "Multibrot z³"
    case multibrot4 = "Multibrot z⁴"
    case newton = "Newton"
    case phoenix = "Phoenix"
}

// FractalController class - accessible within the module
class FractalController: ObservableObject {
    // Fractal view state (complex plane coordinates)
    @Published var centerX: Double = -0.77568377
    @Published var centerY: Double = 0.13646737
    @Published var zoom: Double = 0.4
    @Published var fractalType: FractalType = .mandelbrot
    
    // Julia set constant (for Julia fractal type)
    @Published var juliaCX: Double = 0.285
    @Published var juliaCY: Double = 0.01
    
    // Touch gesture state
    private var lastPanTranslation: CGSize = .zero
    private var lastPinchScale: CGFloat = 1.0
    private var baseZoom: Double = 0.4
    
    // Animation state
    private var isAnimating: Bool = false
    private var animationTimer: Timer?
    
    // Audio-reactive mode
    @Published var audioReactive: Bool = false
    
    init() {
        resetToDefault()
    }
    
    func resetToDefault() {
        centerX = -0.77568377
        centerY = 0.13646737
        zoom = 0.4
        fractalType = .mandelbrot
        resetPanTracking()
    }
    
    func resetPanTracking() {
        lastPanTranslation = .zero
    }
    
    // MARK: - Touch Gestures
    
    func handlePan(translation: CGSize, viewSize: CGSize) {
        guard !isAnimating else { return }
        
        // Use delta translation (difference from last position) for smoother control
        let deltaX = translation.width - lastPanTranslation.width
        let deltaY = translation.height - lastPanTranslation.height
        lastPanTranslation = translation
        
        // Convert screen translation to complex plane movement
        // Reduce sensitivity significantly for better control
        let sensitivity: Double = 0.15 // Much lower sensitivity (15% of original)
        let scale = 1.0 / zoom
        let dx = Double(deltaX) / Double(viewSize.width) * scale * sensitivity
        let dy = Double(deltaY) / Double(viewSize.height) * scale * sensitivity
        
        // Update center (invert Y for complex plane)
        centerX -= dx
        centerY += dy
    }
    
    func handlePinch(scale: CGFloat, state: UIGestureRecognizer.State) {
        guard !isAnimating else { return }
        
        switch state {
        case .began:
            baseZoom = zoom
            lastPinchScale = scale
            
        case .changed:
            let scaleDelta = scale / lastPinchScale
            // Make pinch zoom more responsive (faster with exponential scaling)
            let zoomMultiplier = pow(scaleDelta, 2.0) // Exponential scaling for much faster zoom
            zoom = baseZoom / zoomMultiplier
            zoom = max(0.1, min(zoom, 1e10)) // Clamp zoom
            lastPinchScale = scale
            
        case .ended, .cancelled:
            break
            
        default:
            break
        }
    }
    
    func handleDoubleTap(at location: CGPoint, viewSize: CGSize) {
        guard !isAnimating else { return }
        
        // Convert tap location to complex plane coordinates
        let normalizedX = (Double(location.x) / Double(viewSize.width)) * 2.0 - 1.0
        let normalizedY = 1.0 - (Double(location.y) / Double(viewSize.height)) * 2.0
        
        let aspect = Double(viewSize.width) / Double(viewSize.height)
        let scale = 1.0 / zoom
        
        let newCenterX = centerX + normalizedX * scale * aspect
        let newCenterY = centerY + normalizedY * scale
        
        // Animate zoom and pan - much faster zoom (100x)
        animateTo(centerX: newCenterX, centerY: newCenterY, zoom: zoom * 100.0, duration: 0.3)
    }
    
    func handleLongPress(at location: CGPoint, viewSize: CGSize) {
        // Reset to default view
        animateTo(centerX: -0.77568377, centerY: 0.13646737, zoom: 0.4, duration: 0.5)
    }
    
    // MARK: - Animation
    
    private func animateTo(centerX: Double, centerY: Double, zoom: Double, duration: TimeInterval) {
        isAnimating = true
        
        let startCenterX = self.centerX
        let startCenterY = self.centerY
        let startZoom = self.zoom
        
        let endCenterX = centerX
        let endCenterY = centerY
        let endZoom = zoom
        
        let startTime = Date()
        
        animationTimer?.invalidate()
        animationTimer = Timer.scheduledTimer(withTimeInterval: 1.0/60.0, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }
            
            let elapsed = Date().timeIntervalSince(startTime)
            let progress = min(elapsed / duration, 1.0)
            
            // Smooth easing (ease in-out)
            let eased = progress < 0.5
                ? 2.0 * progress * progress
                : 1.0 - pow(-2.0 * progress + 2.0, 2.0) / 2.0
            
            self.centerX = startCenterX + (endCenterX - startCenterX) * eased
            self.centerY = startCenterY + (endCenterY - startCenterY) * eased
            self.zoom = startZoom + (endZoom - startZoom) * eased
            
            if progress >= 1.0 {
                timer.invalidate()
                self.isAnimating = false
            }
        }
    }
    
    // MARK: - Audio Reactive Mode
    
    func updateAudioReactive(energy: Float, beatPulse: Float) {
        guard audioReactive else { return }
        
        // Very subtle mood-based zoom speed (10x slower)
        let zoomSpeed = 1.0 + Double(energy) * 0.05
        zoom *= pow(1.0001, zoomSpeed / 60.0) // Very gentle zoom per frame
        
        // Clamp zoom
        zoom = max(0.1, min(zoom, 1e10))
    }
    
    deinit {
        animationTimer?.invalidate()
    }
}


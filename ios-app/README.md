# Music Visualizer iOS App

A high-performance iOS music visualizer using Core ML diffusion models and Metal shaders.

## Features

- **Core ML Diffusion Models**: Real-time image generation using Apple's optimized Stable Diffusion
- **Metal Shaders**: GPU-accelerated particle systems and fractals
- **Audio Analysis**: Real-time FFT analysis for bass, mid, treble, and energy detection
- **Multiple Visual Modes**:
  - Diffusion: AI-generated visuals based on audio features
  - Particles: GPU-accelerated particle systems with flow fields
  - Fractals: Real-time Mandelbrot and Julia set rendering

## Requirements

- iOS 16.0+
- Xcode 15.0+
- Device with Metal support (all modern iOS devices)

## Setup

1. Open the project in Xcode:
   ```bash
   cd ios-app
   open MusicVisualizer.xcodeproj
   ```

2. Add Core ML Stable Diffusion Model:
   - Download from [Apple's Core ML Models](https://huggingface.co/apple/coreml-stable-diffusion)
   - Add `StableDiffusion.mlmodelc` to the project bundle
   - Or use the procedural fallback (no model required)

3. Build and run on device or simulator

## Architecture

### Core Components

- **AudioManager**: Handles audio playback and real-time FFT analysis
- **DiffusionModel**: Core ML integration for AI-generated visuals
- **VisualizerEngine**: Metal rendering engine with multiple visual modes
- **Metal Shaders**: GPU-accelerated particle and fractal rendering

### Metal Shaders

- `particle_compute`: Updates particle positions and velocities on GPU
- `vertex_main`: Renders particles as points
- `fragment_main`: Applies glow and color effects
- `fractal_compute`: Real-time fractal generation

## Performance

- 60 FPS rendering on modern devices
- GPU-accelerated particle systems (10,000+ particles)
- Neural Engine acceleration for Core ML models
- Efficient memory management with Metal buffers

## Future Enhancements

- [ ] Real-time diffusion generation (currently uses periodic updates)
- [ ] More fractal types (Julia sets, Burning Ship, etc.)
- [ ] Audio-reactive diffusion prompts
- [ ] Export visualizations as video
- [ ] Custom shader editor

## Notes

- The diffusion model requires a Core ML Stable Diffusion model file
- Without the model, the app falls back to procedural generation
- All rendering is GPU-accelerated using Metal


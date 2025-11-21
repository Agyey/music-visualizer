# Music Visualizer 🎵✨

A powerful, real-time music visualizer with advanced audio analysis, multiple visualization modes, and comprehensive audio processing capabilities.

## Features

### 🎨 Visualization Modes
- **Geometric Mode**: Dynamic shape morphing with neon glows and motion blur
- **Psychedelic Shader Mode**: WebGL-powered fractal zooms, kaleidoscopes, and plasma effects
- **Particle Mode**: GPU-accelerated particle systems with flow fields and beat-reactive explosions
- **3D Mode**: Three.js-based 3D morphing shapes with camera fly-through

### 🎵 Audio Features
- **Multiple Input Sources**: Upload files, record audio, or use live microphone input
- **Advanced Audio Analysis**: BPM detection, beat tracking, frequency analysis
- **Lyric Analysis**: Automatic transcription with Whisper, sentiment analysis, emotion detection
- **Audio Processing**: Source separation (vocals/background), EQ, noise reduction, reverb
- **Section Detection**: Automatic detection of intro, verse, chorus, drop, bridge, outro

### 💾 User Features
- **Upload History**: View and manage all your previous uploads
- **Save & Export**: Save visualizations and export as images or videos
- **User Authentication**: Login/signup system (localStorage-based, extensible to backend)
- **Audio Processing Controls**: Real-time EQ, stem mixing, effects

### 📱 Responsive Design
- Fully mobile-compatible with touch-optimized UI
- Collapsible panels that don't obstruct visualization
- Scalable across all screen sizes

## Tech Stack

### Backend
- **FastAPI**: Python web framework
- **librosa**: Audio analysis and processing
- **faster-whisper**: Multilingual transcription
- **demucs**: Source separation
- **transformers**: NLP for sentiment/emotion analysis
- **moviepy**: Video rendering

### Frontend
- **React + TypeScript**: Modern UI framework
- **WebGL**: GPU-accelerated rendering
- **Three.js**: 3D visualization
- **HTML5 Canvas**: 2D rendering
- **Vite**: Build tool

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Git

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd Music-Visualizer
```

2. Start the services:
```bash
docker-compose up -d
```

3. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Development

#### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Usage

1. **Upload Audio**: Click "Audio Source" → Upload a file
2. **Record**: Use the Record tab to capture audio from your microphone
3. **Live Mode**: Enable live visualization with real-time microphone input
4. **Choose Visualizer**: Select from Geometric, Psychedelic, Particles, or 3D modes
5. **Adjust Settings**: Use the Visualizer Settings panel to customize parameters
6. **Process Audio**: Apply EQ, effects, and stem separation in Audio Processing
7. **Export**: Save your visualization or export as video/image

## Project Structure

```
Music-Visualizer/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── audio_analysis.py    # Audio feature extraction
│   ├── audio_processing.py  # Audio effects and processing
│   ├── transcription.py     # Whisper transcription
│   ├── nlp_analysis.py      # Sentiment/emotion analysis
│   ├── render_video.py      # Video rendering
│   └── models.py           # Pydantic models
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── visualizers/    # Visualization renderers
│   │   ├── shaders/         # GLSL shaders
│   │   └── types/           # TypeScript types
│   └── public/
└── docker-compose.yml       # Docker orchestration
```

## API Endpoints

- `POST /upload-audio` - Upload and analyze audio
- `POST /process-audio` - Apply audio processing
- `POST /render-video` - Render visualization video
- `GET /health` - Health check

See `/docs` for full API documentation.

## Configuration

### Environment Variables
- `ALLOWED_ORIGINS`: CORS allowed origins (default: localhost)
- `WHISPER_MODEL_SIZE`: Whisper model size (default: medium)
- `DEMUCS_MODEL`: Demucs model (default: htdemucs)

## License

MIT License

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## Acknowledgments

- Built with love for music and visual art
- Uses open-source libraries: librosa, Three.js, faster-whisper, demucs

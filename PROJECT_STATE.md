# Project State: Music Visualizer 🎵✨

## 🎯 North Star
A high-performance, cross-platform music visualization suite with deep audio analysis and AI-driven insights (lyrics, mood, stems), providing a premium experience for both real-time listening and cinematic rendering.

## 🏗️ Technical Stack
### Backend (Python Powerhouse)
- **Framework**: FastAPI 0.115.6
- **Validation**: Pydantic V2 (2.10.5)
- **Audio Processing**: librosa, demucs, faster-whisper, moviepy
- **NLP**: Transformers (Sentiment/Emotion)
- **Logging**: Standard Python `logging` (⚠️ Needs migration to `loguru`)
- **Persistence**: Local disk storage (⚠️ Violation of Stateless rule)

### Frontend (React Atomic)
- **Core**: React 18.3.1 + TypeScript 5.7.2 + Vite 5.4.21
- **Rendering**: WebGL, Three.js, HTML5 Canvas
- **Architecture**: Atomic components (⚠️ `App.tsx` needs decomposition)
- **Performance**: Standard hooks (⚠️ Missing `useMemo`/`useCallback` for heavy logic)

## 📍 Current Milestones
### Phase 1: Core Functionality (Completed)
- [x] Basic audio analysis (BPM, beats, frequency).
- [x] WebGL/Three.js renderers (Geometric, Psych, Particle, 3D).
- [x] Responsive React UI with collapsible panels.
- [x] File upload and audio recording integration.

### Phase 2: AI Enhancements (Completed)
- [x] Automatic transcription via Whisper.
- [x] Sentiment and emotion analysis for lyrics.
- [x] Audio source separation (Vocals/Stems).
- [x] Automated section detection.

### Phase 3: Rendering & Export (In Progress)
- [x] MoviePy integration for video rendering.
- [ ] Stabilize 4K rendering performance.
- [ ] Add cloud-based export storage.

## ⚠️ Technical Debt & Global Rules Gaps
1. **Logging**: Migrate to `loguru` with structured JSON for Railway observability.
2. **Statelessness**: Implement Redis/Postgres for state and S3/Cloud Storage for media files.
3. **Frontend Decomposition**: Decompose `App.tsx` (357 lines) into smaller sub-components.
4. **Binding**: Update `main.py` to bind to `$PORT`.
5. **Optimization**: Implement `useMemo` and `useCallback` in frontend for render-loop critical paths.
6. **Infrastructure**: Add `railway.json` and `nixpacks.toml` for standardized deployment.

## 🚀 Standards Alignment Roadmap
- [ ] **Task 1**: Migrate Backend to `loguru` and implement structured logging.
- [ ] **Task 2**: Refactor `App.tsx` into Atomic components (Header, CanvasContainer, ControlPanels).
- [ ] **Task 3**: Dynamic Port Binding in FastAPI.
- [ ] **Task 4**: Implement `useMemo`/`useCallback` across visualizers.
- [ ] **Task 5**: Add `railway.json` configuration.
- [ ] **Task 6**: Transition from local disk persistence to stateless architecture.

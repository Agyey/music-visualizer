# Project State: Music Visualizer 🎵✨

## 🎯 North Star
A high-performance, cross-platform music visualization suite with deep audio analysis and AI-driven insights (lyrics, mood, stems), providing a premium experience for both real-time listening and cinematic rendering.

## 🏗️ Technical Stack
### Backend (Python Powerhouse)
- **Framework**: FastAPI 0.115.6
- **Validation**: Pydantic V2 (2.10.5)
- **Audio Processing**: librosa, demucs, faster-whisper, moviepy
- **NLP**: Transformers (Sentiment/Emotion)
- **Logging**: `loguru` (Structured JSON ready)
- **Persistence**: Local disk storage (⚠️ Violation of Stateless rule - Migration pending)
- **Infrastructure**: Nixpacks (Railway Project: `music-visualizer-api`)
- **URL**: `https://music-visualizer-api-production.up.railway.app`

### Frontend (React Atomic)
- **Core**: React 18.3.1 + TypeScript 5.7.2 + Vite 5.4.21
- **Rendering**: WebGL, Three.js, HTML5 Canvas
- **Architecture**: Atomic components (Decomposed via `useAppHandlers`)
- **Infrastructure**: Nixpacks (Railway Project: `music-visualizer`)
- **URL**: `https://music-visualizer-production-01e4.up.railway.app` (Mapping to `musicvisualizer.agyeyarya.com` pending)

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

### Phase 3: Infrastructure & Standards (Completed)
- [x] Migrate to `loguru` for observability.
- [x] Standardize on `$PORT` binding.
- [x] Add `nixpacks.toml` for deployment.
- [x] Decompose `App.tsx` into atomic components.
- [x] Initial Deployment to Railway.

## ⚠️ Technical Debt & Global Rules Gaps
1. **Statelessness**: Implement Redis/Postgres for state and S3/Cloud Storage for media files.
2. **Persistence**: Currently using `/app/media` volume in backend; need to switch to object storage for full statelessness.
3. **Monorepo Structure**: Split into separate Railway projects due to CLI limitations; consider unifying with `railway.json` in the future.

## 🚀 Standards Alignment Roadmap
- [x] **Task 1**: Migrate Backend to `loguru`.
- [x] **Task 2**: Refactor `App.tsx` into Atomic components.
- [x] **Task 3**: Dynamic Port Binding in FastAPI.
- [x] **Task 4**: Implement `useMemo`/`useCallback` across core hooks.
- [x] **Task 5**: Add `nixpacks.toml` configuration.
- [x] **Task 6**: Deployment to Railway.
- [x] **Task 7**: Environment variable synchronization (CORS/API URL).
- [ ] **Task 8**: Transition from local disk persistence to stateless architecture.

# Project State: Music Visualizer 🎵✨

## 🎯 North Star
A high-performance, cross-platform music visualization suite with deep audio analysis and AI-driven insights (lyrics, mood, stems), providing a premium experience for both real-time listening and cinematic rendering.

## 🏗️ Technical Stack
### Unified Infrastructure (Railway)
- **Project ID**: `1ae6a45c-dafa-46d8-a80e-20c8d3f587eb`
- **Monorepo Strategy**: Single repository with per-service root directories.
- **Custom Domain**: `musicvisualizer.agyeyarya.com` (Main UI)

### Backend (Python Powerhouse)
- **Service**: `backend`
- **Root Directory**: `/backend`
- **Port**: `$PORT` (Defaults to 8000)
- **Dependencies**: Python 3.12, FFmpeg (via Nixpacks)
- **URL**: `https://backend-production-d5868.up.railway.app`
- **Validation**: Pydantic V2
- **Logging**: `loguru` (Structured JSON)

### Frontend (React Atomic)
- **Service**: `frontend`
- **Root Directory**: `/frontend`
- **Framework**: Vite + React + Three.js
- **URL**: `https://musicvisualizer.agyeyarya.com` 
- **API Target**: `https://backend-production-d5868.up.railway.app`

## 📍 Current Milestones
### Phase 1 & 2: Core & AI (Completed)
- [x] Basic audio analysis & WebGL renderers.
- [x] Transcription (Whisper) & Emotion Analysis.
- [x] Stem separation (Demucs).

### Phase 3: Infrastructure Unified (Completed)
- [x] Migrate to `loguru` and `$PORT` binding.
- [x] Unified monorepo on Railway with two services.
- [x] Configured Nixpacks for system dependencies (FFmpeg).
- [x] Synchronized CORS and API environment variables.

### Phase 4: Performance & Persistence (In Progress)
- [ ] **Next**: Implement `useMemo`/`useCallback` across all visualizer components.
- [ ] **Next**: Transition from local disk persistence to stateless architecture (Redis/Postgres).

## ⚠️ Technical Debt
1. **Statelessness**: Backend still relies on local `/app/media` volume.
2. **DNS**: Verify CNAME for `musicvisualizer.agyeyarya.com`.
3. **Optimizations**: Three.js render loops need tuning for lower-end devices.

## 🚀 Standards Alignment Roadmap
- [x] **Task 1**: Migrate Backend to `loguru`.
- [x] **Task 2**: Refactor `App.tsx` logic into hooks.
- [x] **Task 3**: Dynamic Port Binding.
- [x] **Task 4**: Unified Railway Project & Domain.
- [ ] **Task 5**: Advanced Frontend Performance Tuning.
- [ ] **Task 6**: Stateless storage integration.

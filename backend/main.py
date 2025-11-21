from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import json
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from config import ASPECT_RATIOS, RESOLUTION_PRESETS, MEDIA_DIR, VIDEO_DIR
from models import (
    AudioAnalysisResponse, ExtendedAudioAnalysisResponse,
    RenderRequest, RenderResponse,
    ProcessAudioRequest, ProcessAudioResponse
)
from storage import (
    save_audio_file, get_audio_path, video_output_path, generate_id,
    get_processed_audio_path, get_stems_dir, analysis_output_path
)
from audio_analysis import analyze_audio, analyze_audio_extended, load_analysis
from audio_processing import separate_stems, apply_audio_processing
from render_video import render_visual_clip

app = FastAPI(title="Music Visualizer API")

# CORS
import os
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost:80"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")


@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/test")
async def test():
    logger.info("Test endpoint called")
    return {"message": "Backend is working", "status": "ok"}


@app.post("/upload-audio", response_model=ExtendedAudioAnalysisResponse)
async def upload_audio(
    file: UploadFile = File(...),
    run_transcription: bool = False,
    run_stems: bool = False
):
    """
    Upload audio file and perform extended analysis.
    
    Args:
        file: Audio file to upload
        run_transcription: Whether to run Whisper transcription (default: False for speed)
        run_stems: Whether to run stem separation (can be slow, default: False)
    """
    import traceback
    
    try:
        logger.info(f"=== UPLOAD REQUEST RECEIVED ===")
        logger.info(f"Filename: {file.filename}, Content-Type: {file.content_type}")
        
        # Check content type (allow None for some clients)
        if file.content_type and not file.content_type.startswith("audio/"):
            logger.warning(f"Invalid content type: {file.content_type}")
            raise HTTPException(status_code=400, detail="File must be an audio file")
        
        logger.info("Step 1: Saving audio file...")
        audio_id, file_path = save_audio_file(file)
        logger.info(f"Step 1 complete: audio_id={audio_id}, path={file_path}")
        
        logger.info(f"Step 2: Starting analysis (transcription={run_transcription}, stems={run_stems})...")
        # Run extended analysis with transcription and optional stems
        analysis = analyze_audio_extended(
            str(file_path),
            audio_id,
            run_transcription=run_transcription,
            run_stems=run_stems
        )
        logger.info(f"Step 2 complete: Analysis done for audio_id={audio_id}")
        logger.info(f"=== UPLOAD REQUEST SUCCESS ===")
        return analysis
        
    except HTTPException as he:
        logger.error(f"HTTPException: {he.detail}")
        raise
    except Exception as e:
        logger.error(f"=== UPLOAD REQUEST FAILED ===")
        logger.error(f"Error: {str(e)}", exc_info=True)
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Full traceback:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/process-audio", response_model=ProcessAudioResponse)
async def process_audio(request: ProcessAudioRequest):
    """
    Apply audio processing (noise reduction, EQ, mixing, reverb, normalization).
    """
    try:
        # Get original audio path
        audio_path = get_audio_path(request.audio_id)
        
        # Check for existing stems
        stems_dir = get_stems_dir(request.audio_id)
        stems = None
        if stems_dir.exists():
            # Look for stem files
            stem_files = {}
            for stem_name in ["vocals", "bass", "drums", "other"]:
                stem_path = stems_dir / f"{stem_name}.wav"
                if stem_path.exists():
                    stem_files[stem_name] = str(stem_path)
            if stem_files:
                stems = stem_files
        
        # If stems needed but not found, try to separate
        if request.params.use_processed and not stems:
            try:
                stems = separate_stems(str(audio_path), request.audio_id)
            except Exception as e:
                # Continue without stems if separation fails
                pass
        
        # Generate processed audio ID
        processed_audio_id = generate_id()
        
        # Apply processing
        processed_path = apply_audio_processing(
            str(audio_path),
            stems,
            request.params,
            processed_audio_id
        )
        
        return ProcessAudioResponse(
            audio_id=request.audio_id,
            processed_audio_id=processed_audio_id
        )
    
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.post("/render-video", response_model=RenderResponse)
async def render_video(render_req: RenderRequest):
    """Render a video from analyzed audio."""
    # Validate aspect ratio and resolution
    if render_req.aspect_ratio not in ASPECT_RATIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid aspect_ratio. Must be one of: {list(ASPECT_RATIOS.keys())}"
        )
    
    if render_req.resolution_preset not in RESOLUTION_PRESETS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid resolution_preset. Must be one of: {list(RESOLUTION_PRESETS.keys())}"
        )
    
    # Get audio path (use processed if provided, else original)
    try:
        if render_req.processed_audio_id:
            audio_path = get_processed_audio_path(render_req.processed_audio_id)
        else:
            audio_path = get_audio_path(render_req.audio_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    # Load analysis (try extended first, fall back to basic)
    try:
        analysis_data = json.load(open(analysis_output_path(render_req.audio_id)))
        # Try to load as ExtendedAudioAnalysisResponse
        try:
            analysis = ExtendedAudioAnalysisResponse(**analysis_data)
        except:
            # Fall back to basic
            analysis = AudioAnalysisResponse(**analysis_data)
    except FileNotFoundError:
        # Re-analyze if not found
        analysis = analyze_audio_extended(str(audio_path), render_req.audio_id, run_transcription=True)
    
    # Compute dimensions
    ax, ay = ASPECT_RATIOS[render_req.aspect_ratio]
    h = RESOLUTION_PRESETS[render_req.resolution_preset]
    w = round(h * ax / ay)
    
    # Ensure even
    w = w if w % 2 == 0 else w + 1
    h = h if h % 2 == 0 else h + 1
    
    # Generate video ID and path
    video_id = generate_id()
    output_path = video_output_path(video_id)
    
    try:
        # Render video
        render_visual_clip(
            analysis,
            str(audio_path),
            w,
            h,
            render_req,
            str(output_path)
        )
        
        video_url = f"/media/video/{video_id}.mp4"
        return RenderResponse(video_id=video_id, video_url=video_url)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rendering failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


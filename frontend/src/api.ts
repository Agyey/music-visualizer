import axios from 'axios';
import { ExtendedAudioAnalysisResponse, RenderRequest, RenderResponse, ProcessAudioRequest, ProcessAudioResponse, AudioProcessingParams } from './types/timeline';

// Use environment variable or fallback to relative path (for nginx proxy) or localhost (for dev)
// In Docker/production, use /api proxy. In dev (Vite), use direct localhost:8000
const API_BASE = import.meta.env.VITE_API_BASE || 
  (window.location.port === '5173' ? 'http://localhost:8000' : '/api');

export async function uploadAudio(file: File, runTranscription: boolean = false): Promise<ExtendedAudioAnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await axios.post<ExtendedAudioAnalysisResponse>(
    `${API_BASE}/upload-audio?run_transcription=${runTranscription}&run_stems=false`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minute timeout for large files
    }
  );
  
  return response.data;
}

export async function processAudio(audioId: string, params: AudioProcessingParams): Promise<ProcessAudioResponse> {
  const response = await axios.post<ProcessAudioResponse>(
    `${API_BASE}/process-audio`,
    {
      audio_id: audioId,
      params,
    } as ProcessAudioRequest
  );
  
  return response.data;
}

export async function renderVideo(req: RenderRequest): Promise<RenderResponse> {
  const response = await axios.post<RenderResponse>(
    `${API_BASE}/render-video`,
    req
  );
  
  return response.data;
}


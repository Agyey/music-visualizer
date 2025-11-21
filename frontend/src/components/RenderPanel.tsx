import React, { useState } from 'react';
import { ExtendedAudioAnalysisResponse } from '../types/timeline';
import { renderVideo } from '../api';

const API_BASE = import.meta.env.VITE_API_BASE || 
  (window.location.port === '5173' ? 'http://localhost:8000' : '/api');

interface RenderPanelProps {
  analysis: ExtendedAudioAnalysisResponse | null;
  audioId: string | null;
}

export const RenderPanel: React.FC<RenderPanelProps> = ({ analysis, audioId }) => {
  const [visualMode, setVisualMode] = useState<"geometric" | "particles" | "psychedelic">("geometric");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [resolutionPreset, setResolutionPreset] = useState<"1080p" | "4K">("1080p");
  const [isRendering, setIsRendering] = useState(false);
  const [renderResult, setRenderResult] = useState<{ video_id: string; video_url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRender = async () => {
    if (!audioId || !analysis) {
      setError("Please upload and analyze audio first");
      return;
    }

    setIsRendering(true);
    setError(null);
    setRenderResult(null);

    try {
      const response = await renderVideo({
        audio_id: audioId,
        aspect_ratio: aspectRatio,
        resolution_preset: resolutionPreset,
        visual_mode: visualMode,
      });

      setRenderResult(response);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Rendering failed");
      console.error("Render error:", err);
    } finally {
      setIsRendering(false);
    }
  };

  if (!analysis || !audioId) {
    return (
      <div style={{
        padding: '20px',
        background: 'rgba(20, 20, 30, 0.95)',
        borderRadius: '8px',
        border: '1px solid rgba(100, 200, 255, 0.3)',
        color: '#aaa',
        textAlign: 'center'
      }}>
        Upload and analyze audio to enable video rendering
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      background: 'rgba(20, 20, 30, 0.95)',
      borderRadius: '8px',
      border: '1px solid rgba(100, 200, 255, 0.3)',
      color: '#fff'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: '600' }}>
        🎬 Render Video
      </h3>

      {/* Visual Mode Selection */}
      <div style={{ marginBottom: '18px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#ccc' }}>
          Visual Mode
        </label>
        <select
          value={visualMode}
          onChange={(e) => setVisualMode(e.target.value as any)}
          disabled={isRendering}
          style={{
            width: '100%',
            padding: '10px',
            background: 'rgba(30, 30, 40, 0.9)',
            color: '#fff',
            border: '1px solid rgba(100, 200, 255, 0.3)',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: isRendering ? 'not-allowed' : 'pointer',
          }}
        >
          <option value="geometric">Geometric</option>
          <option value="particles">Particles</option>
          <option value="psychedelic">Psychedelic</option>
        </select>
      </div>

      {/* Aspect Ratio Selection */}
      <div style={{ marginBottom: '18px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#ccc' }}>
          Aspect Ratio
        </label>
        <select
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value as any)}
          disabled={isRendering}
          style={{
            width: '100%',
            padding: '10px',
            background: 'rgba(30, 30, 40, 0.9)',
            color: '#fff',
            border: '1px solid rgba(100, 200, 255, 0.3)',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: isRendering ? 'not-allowed' : 'pointer',
          }}
        >
          <option value="16:9">16:9 (Landscape)</option>
          <option value="9:16">9:16 (Portrait)</option>
        </select>
      </div>

      {/* Resolution Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#ccc' }}>
          Resolution
        </label>
        <select
          value={resolutionPreset}
          onChange={(e) => setResolutionPreset(e.target.value as any)}
          disabled={isRendering}
          style={{
            width: '100%',
            padding: '10px',
            background: 'rgba(30, 30, 40, 0.9)',
            color: '#fff',
            border: '1px solid rgba(100, 200, 255, 0.3)',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: isRendering ? 'not-allowed' : 'pointer',
          }}
        >
          <option value="1080p">1080p (Full HD)</option>
          <option value="4K">4K (Ultra HD)</option>
        </select>
        <div style={{ marginTop: '6px', fontSize: '11px', color: '#888' }}>
          {resolutionPreset === "4K" && "⚠️ 4K rendering may take significantly longer"}
        </div>
      </div>

      {/* Render Button */}
      <button
        onClick={handleRender}
        disabled={isRendering}
        style={{
          width: '100%',
          padding: '12px',
          background: isRendering
            ? 'rgba(100, 100, 100, 0.5)'
            : 'linear-gradient(135deg, #0af, #f0a)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: isRendering ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          marginBottom: '15px',
        }}
      >
        {isRendering ? (
          <>
            <span style={{ display: 'inline-block', marginRight: '8px' }}>⏳</span>
            Rendering... This may take a while
          </>
        ) : (
          '🎬 Render Video'
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px',
          background: 'rgba(255, 50, 50, 0.2)',
          border: '1px solid rgba(255, 50, 50, 0.5)',
          borderRadius: '6px',
          color: '#ff6b6b',
          marginBottom: '15px',
          fontSize: '13px',
        }}>
          ❌ {error}
        </div>
      )}

      {/* Render Result */}
      {renderResult && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: 'rgba(0, 200, 100, 0.1)',
          border: '1px solid rgba(0, 200, 100, 0.3)',
          borderRadius: '6px',
        }}>
          <div style={{ marginBottom: '12px', fontSize: '14px', color: '#4ecdc4' }}>
            ✅ Video rendered successfully!
          </div>

          {/* Video Player */}
          <video
            controls
            src={`${API_BASE}${renderResult.video_url}`}
            style={{
              width: '100%',
              maxHeight: '400px',
              borderRadius: '6px',
              marginBottom: '12px',
              background: '#000',
            }}
          />

          {/* Download Button */}
          <a
            href={`${API_BASE}${renderResult.video_url}`}
            download
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              background: 'rgba(100, 200, 255, 0.2)',
              color: '#fff',
              border: '1px solid rgba(100, 200, 255, 0.5)',
              borderRadius: '6px',
              textAlign: 'center',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(100, 200, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(100, 200, 255, 0.2)';
            }}
          >
            📥 Download Video
          </a>
        </div>
      )}
    </div>
  );
};


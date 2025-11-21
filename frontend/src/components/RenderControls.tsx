import React, { useState } from 'react';
import { renderVideo } from '../api';
import {
  ExtendedAudioAnalysisResponse,
  RenderRequest,
  RenderResponse,
  AspectRatioPreset,
  ResolutionPreset,
} from '../types/timeline';

interface RenderControlsProps {
  analysis: ExtendedAudioAnalysisResponse | null;
  onRenderComplete: (resp: RenderResponse) => void;
}

export const RenderControls: React.FC<RenderControlsProps> = ({
  analysis,
  onRenderComplete,
}) => {
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>('16:9');
  const [resolution, setResolution] = useState<ResolutionPreset>('1080p');
  const [lineThickness, setLineThickness] = useState<number>(2);
  const [glowStrength, setGlowStrength] = useState<number>(1);
  const [barCount, setBarCount] = useState<number>(24);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRender, setLastRender] = useState<RenderResponse | null>(null);

  const handleRender = async () => {
    if (!analysis) return;

    setRendering(true);
    setError(null);

    try {
      const req: RenderRequest = {
        audio_id: analysis.audio_id,
        aspect_ratio: aspectRatio,
        resolution_preset: resolution,
        line_thickness: lineThickness,
        glow_strength: glowStrength,
        bar_count: barCount,
        color_mode: 'default',
      };

      const response = await renderVideo(req);
      setLastRender(response);
      onRenderComplete(response);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Render failed');
    } finally {
      setRendering(false);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        background: 'linear-gradient(135deg, rgba(10, 10, 20, 0.95), rgba(5, 5, 15, 0.95))',
        backdropFilter: 'blur(10px)',
        padding: '24px',
        borderRadius: '12px',
        minWidth: '320px',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid rgba(100, 200, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(100, 200, 255, 0.1)',
      }}
    >
      <h2 style={{ 
        marginBottom: '18px', 
        fontSize: '18px',
        fontWeight: '600',
        background: 'linear-gradient(90deg, #0af, #f0a)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        Render Video
      </h2>

      {!analysis ? (
        <div style={{ color: '#888', fontSize: '14px' }}>
          Upload and analyze audio first
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Aspect Ratio
            </label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as AspectRatioPreset)}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(20, 20, 30, 0.9)',
                color: '#fff',
                border: '1px solid rgba(100, 200, 255, 0.3)',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Resolution
            </label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as ResolutionPreset)}
              style={{
                width: '100%',
                padding: '8px',
                background: '#222',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
              }}
            >
              <option value="1080p">1080p</option>
              <option value="4K">4K</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Line Thickness: {lineThickness.toFixed(1)}
            </label>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={lineThickness}
              onChange={(e) => setLineThickness(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Glow Strength: {glowStrength.toFixed(1)}
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={glowStrength}
              onChange={(e) => setGlowStrength(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Bar Count: {barCount}
            </label>
            <input
              type="range"
              min="12"
              max="48"
              step="1"
              value={barCount}
              onChange={(e) => setBarCount(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <button
            onClick={handleRender}
            disabled={rendering}
            style={{
              width: '100%',
              padding: '12px',
              background: rendering 
                ? 'rgba(85, 85, 85, 0.6)' 
                : 'linear-gradient(135deg, #08a, #0a8)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: rendering ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '15px',
              boxShadow: rendering ? 'none' : '0 4px 12px rgba(0, 136, 170, 0.3)',
              transition: 'all 0.2s',
            }}
          >
            {rendering ? 'Rendering...' : 'Render Video'}
          </button>

          {error && (
            <div style={{ marginBottom: '15px', color: '#f44', fontSize: '12px' }}>
              {error}
            </div>
          )}

          {lastRender && (
            <div style={{ marginTop: '15px', padding: '10px', background: '#111', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', marginBottom: '8px', color: '#0a8' }}>
                Latest Render:
              </div>
              <a
                href={lastRender.video_url.startsWith('http') ? lastRender.video_url : (window.location.hostname === 'localhost' && window.location.port === '3000' ? `http://localhost:8000${lastRender.video_url}` : lastRender.video_url)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#0af',
                  textDecoration: 'underline',
                  fontSize: '14px',
                  wordBreak: 'break-all',
                }}
              >
                Download Video
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
};


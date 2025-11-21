import React, { useState } from 'react';
import { renderVideo } from '../api';
import { ExtendedAudioAnalysisResponse, VisualizerMode, RenderRequest } from '../types/timeline';

interface SaveExportPanelProps {
  analysis: ExtendedAudioAnalysisResponse | null;
  visualizerMode: VisualizerMode;
  onSave?: (name: string, data: any) => void;
}

export const SaveExportPanel: React.FC<SaveExportPanelProps> = ({
  analysis,
  visualizerMode,
  onSave,
}) => {
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = () => {
    if (!analysis || !saveName.trim()) {
      setError('Please enter a name for your visualization');
      return;
    }

    setSaving(true);
    setError(null);

    // Save to localStorage (can be extended to backend)
    const savedVisualizations = JSON.parse(localStorage.getItem('savedVisualizations') || '[]');
    const newSave = {
      id: Math.random().toString(36).substr(2, 9),
      name: saveName,
      analysisId: analysis.audio_id,
      mode: visualizerMode,
      timestamp: new Date().toISOString(),
    };
    savedVisualizations.push(newSave);
    localStorage.setItem('savedVisualizations', JSON.stringify(savedVisualizations));

    if (onSave) onSave(saveName, newSave);

    setSaving(false);
    setSuccess('Visualization saved!');
    setSaveName('');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleExport = async () => {
    if (!analysis) {
      setError('No audio loaded');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const renderReq: RenderRequest = {
        audio_id: analysis.audio_id,
        aspect_ratio: '16:9',
        resolution_preset: '1080p',
        visual_mode: visualizerMode,
        use_lyrics: true,
        use_emotion: true,
      };

      const response = await renderVideo(renderReq);
      setSuccess('Video exported! Download will start shortly...');
      
      // Trigger download
      window.open(response.video_url, '_blank');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportImage = () => {
    // Capture canvas as image
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      setError('No canvas found');
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        setError('Failed to capture image');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visualization-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('Image exported!');
      setTimeout(() => setSuccess(null), 3000);
    }, 'image/png');
  };

  return (
    <div>
      {!analysis ? (
        <div style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
          Load audio to save or export
        </div>
      ) : (
        <>
          {/* Save Section */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#aaa' }}>
              Save Visualization
            </div>
            <input
              type="text"
              placeholder="Visualization name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '8px',
                background: 'rgba(20, 20, 30, 0.9)',
                color: '#fff',
                border: '1px solid rgba(100, 200, 255, 0.3)',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            />
            <button
              onClick={handleSave}
              disabled={saving || !saveName.trim()}
              style={{
                width: '100%',
                padding: '10px',
                background: saving || !saveName.trim()
                  ? 'rgba(85, 85, 85, 0.6)'
                  : 'linear-gradient(135deg, #0a8, #08a)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: saving || !saveName.trim() ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              {saving ? 'Saving...' : '💾 Save'}
            </button>
          </div>

          {/* Export Section */}
          <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(100, 200, 255, 0.2)' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '12px', color: '#aaa' }}>
              Export
            </div>
            
            <button
              onClick={handleExportImage}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '8px',
                background: 'rgba(100, 200, 255, 0.2)',
                color: '#fff',
                border: '1px solid rgba(100, 200, 255, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              📸 Export Image (PNG)
            </button>

            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                width: '100%',
                padding: '10px',
                background: exporting
                  ? 'rgba(85, 85, 85, 0.6)'
                  : 'linear-gradient(135deg, #f0a, #a0f)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: exporting ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              {exporting ? 'Rendering...' : '🎬 Export Video (MP4)'}
            </button>
          </div>
        </>
      )}

      {error && (
        <div
          style={{
            marginTop: '12px',
            color: '#ff4444',
            fontSize: '12px',
            padding: '8px',
            background: 'rgba(255, 68, 68, 0.1)',
            borderRadius: '4px',
            border: '1px solid rgba(255, 68, 68, 0.3)',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            marginTop: '12px',
            color: '#0a8',
            fontSize: '12px',
            padding: '8px',
            background: 'rgba(0, 170, 136, 0.1)',
            borderRadius: '4px',
            border: '1px solid rgba(0, 170, 136, 0.3)',
          }}
        >
          {success}
        </div>
      )}
    </div>
  );
};


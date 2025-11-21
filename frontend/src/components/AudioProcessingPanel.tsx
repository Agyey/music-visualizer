import React, { useState } from 'react';
import { processAudio } from '../api';
import { ExtendedAudioAnalysisResponse, AudioProcessingParams } from '../types/timeline';

interface AudioProcessingPanelProps {
  analysis: ExtendedAudioAnalysisResponse | null;
  onProcessingComplete?: (processedAudioId: string) => void;
}

export const AudioProcessingPanel: React.FC<AudioProcessingPanelProps> = ({
  analysis,
  onProcessingComplete,
}) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<AudioProcessingParams>({
    use_processed: false,
    noise_reduction_strength: 0.0,
    low_gain_db: 0.0,
    mid_gain_db: 0.0,
    high_gain_db: 0.0,
    vocal_gain_db: 0.0,
    background_gain_db: 0.0,
    reverb_amount: 0.0,
    normalize_lufs: undefined,
  });
  const [separateStems, setSeparateStems] = useState(false);

  const handleProcess = async () => {
    if (!analysis) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await processAudio(analysis.audio_id, params);
      if (onProcessingComplete) {
        onProcessingComplete(response.processed_audio_id);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  if (!analysis) {
    return (
      <div style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
        Upload or record audio to enable processing
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={separateStems}
            onChange={(e) => setSeparateStems(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '13px', color: '#ccc' }}>Separate vocals & background</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={params.use_processed}
            onChange={(e) => setParams({ ...params, use_processed: e.target.checked })}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '13px', color: '#ccc' }}>Use processed audio for visualization</span>
        </label>
      </div>

      {/* EQ Controls */}
      <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(20, 20, 30, 0.5)', borderRadius: '6px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '12px', color: '#aaa' }}>
          Equalizer
        </div>
        
        {[
          { label: 'Bass', key: 'low_gain_db', range: [-20, 20] },
          { label: 'Mid', key: 'mid_gain_db', range: [-20, 20] },
          { label: 'Treble', key: 'high_gain_db', range: [-20, 20] },
        ].map(({ label, key, range }) => (
          <div key={key} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: '#ccc' }}>{label}</span>
              <span style={{ fontSize: '12px', color: '#888' }}>
                {params[key as keyof AudioProcessingParams] as number} dB
              </span>
            </div>
            <input
              type="range"
              min={range[0]}
              max={range[1]}
              value={params[key as keyof AudioProcessingParams] as number}
              onChange={(e) => setParams({ ...params, [key]: parseFloat(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>
        ))}
      </div>

      {/* Stem Mixing */}
      {separateStems && (
        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(20, 20, 30, 0.5)', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '12px', color: '#aaa' }}>
            Stem Mixing
          </div>
          
          {[
            { label: 'Vocals', key: 'vocal_gain_db' },
            { label: 'Background', key: 'background_gain_db' },
          ].map(({ label, key }) => (
            <div key={key} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#ccc' }}>{label}</span>
                <span style={{ fontSize: '12px', color: '#888' }}>
                  {params[key as keyof AudioProcessingParams] as number} dB
                </span>
              </div>
              <input
                type="range"
                min={-20}
                max={20}
                value={params[key as keyof AudioProcessingParams] as number}
                onChange={(e) => setParams({ ...params, [key]: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Effects */}
      <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(20, 20, 30, 0.5)', borderRadius: '6px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '12px', color: '#aaa' }}>
          Effects
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: '#ccc' }}>Noise Reduction</span>
            <span style={{ fontSize: '12px', color: '#888' }}>
              {Math.round(params.noise_reduction_strength * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={params.noise_reduction_strength}
            onChange={(e) => setParams({ ...params, noise_reduction_strength: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: '#ccc' }}>Reverb</span>
            <span style={{ fontSize: '12px', color: '#888' }}>
              {Math.round(params.reverb_amount * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={params.reverb_amount}
            onChange={(e) => setParams({ ...params, reverb_amount: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <button
        onClick={handleProcess}
        disabled={processing}
        style={{
          width: '100%',
          padding: '12px',
          background: processing
            ? 'rgba(85, 85, 85, 0.6)'
            : 'linear-gradient(135deg, #0a8, #08a)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: processing ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.2s',
        }}
      >
        {processing ? 'Processing...' : 'Apply Processing'}
      </button>

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
    </div>
  );
};


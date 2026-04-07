/**
 * FE-002: Hero CTA with drag-and-drop upload zone.
 * Shown when no audio has been loaded yet (replaces the empty black screen).
 */
import React, { useState, useRef, useCallback } from 'react';
import { uploadAudio } from '../api';
import { ExtendedAudioAnalysisResponse } from '../types/timeline';

interface HeroDropZoneProps {
  onAnalysisComplete: (
    analysis: ExtendedAudioAnalysisResponse,
    audioUrl: string,
    audioElement: HTMLAudioElement
  ) => void;
}

const ACCEPTED_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/flac',
  'audio/ogg', 'audio/opus',
]);

const ACCEPTED_EXT = /\.(mp3|wav|m4a|aac|flac|ogg|opus)$/i;

function isAudioFile(f: File): boolean {
  return ACCEPTED_TYPES.has(f.type) || ACCEPTED_EXT.test(f.name);
}

export const HeroDropZone: React.FC<HeroDropZoneProps> = ({ onAnalysisComplete }) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!isAudioFile(file)) {
      setError('Please drop an audio file (MP3, WAV, M4A, FLAC, OGG).');
      return;
    }

    setError(null);
    setUploading(true);
    setProgress('Uploading and analyzing…');

    try {
      const analysis = await uploadAudio(file);
      setProgress('Creating audio player…');
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      audio.addEventListener('canplaythrough', () => {
        onAnalysisComplete(analysis, audioUrl, audio);
      }, { once: true });
      audio.load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail ?? (err as { message?: string })?.message ?? 'Upload failed.';
      setError(msg);
    } finally {
      setUploading(false);
      setProgress('');
    }
  }, [onAnalysisComplete]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #050610 0%, #0a0a1a 60%, #060410 100%)',
        zIndex: 10,
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '40px', padding: '0 24px' }}>
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 52px)',
          fontWeight: 800,
          background: 'linear-gradient(90deg, #0af, #f0a, #0fa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 12px',
          letterSpacing: '-0.02em',
        }}>
          Music Visualizer
        </h1>
        <p style={{ color: '#888', fontSize: 'clamp(13px, 2vw, 16px)', margin: 0 }}>
          Drop a track, watch it come alive.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          width: 'min(480px, 90vw)',
          padding: '48px 32px',
          border: `2px dashed ${dragging ? '#0af' : 'rgba(255,255,255,0.15)'}`,
          borderRadius: '16px',
          background: dragging
            ? 'rgba(0, 170, 255, 0.06)'
            : 'rgba(255,255,255,0.03)',
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          transition: 'all 0.2s',
          userSelect: 'none',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          onChange={onFileInput}
          style={{ display: 'none' }}
        />

        {uploading ? (
          <>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
            </div>
            <p style={{ color: '#aaa', margin: 0, fontSize: '15px' }}>{progress}</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: dragging ? 1 : 0.7 }}>
              🎵
            </div>
            <p style={{ color: dragging ? '#0af' : '#ccc', fontSize: '16px', margin: '0 0 8px', fontWeight: 600 }}>
              {dragging ? 'Drop to analyze' : 'Drop your audio here'}
            </p>
            <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
              or click to browse — MP3, WAV, M4A, FLAC, OGG up to 50 MB
            </p>
          </>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: '20px',
          padding: '10px 20px',
          background: 'rgba(255,60,60,0.15)',
          border: '1px solid rgba(255,60,60,0.4)',
          borderRadius: '8px',
          color: '#ff7070',
          fontSize: '13px',
          maxWidth: '480px',
          width: '90vw',
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

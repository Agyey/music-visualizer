import React, { useState, useRef } from 'react';
import { uploadAudio } from '../api';
import { ExtendedAudioAnalysisResponse } from '../types/timeline';

interface AudioUploaderProps {
  onAnalysisComplete: (
    analysis: ExtendedAudioAnalysisResponse,
    audioUrl: string,
    audioElement: HTMLAudioElement
  ) => void;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onAnalysisComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith('audio/')) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please select an audio file');
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const analysis = await uploadAudio(file);
      const audioUrl = URL.createObjectURL(file);
      
      // Create audio element
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      
      audio.addEventListener('canplaythrough', () => {
        audioRef.current = audio;
        onAnalysisComplete(analysis, audioUrl, audio);
      });

      audio.load();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      zIndex: 1000,
      background: 'linear-gradient(135deg, rgba(10, 10, 20, 0.95), rgba(5, 5, 15, 0.95))',
      backdropFilter: 'blur(10px)',
      padding: '24px',
      borderRadius: '12px',
      minWidth: '320px',
      border: '1px solid rgba(100, 200, 255, 0.2)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(100, 200, 255, 0.1)',
    }}>
      <h2 style={{ 
        marginBottom: '18px', 
        fontSize: '18px',
        fontWeight: '600',
        background: 'linear-gradient(90deg, #0af, #f0a)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        Upload Audio
      </h2>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        style={{ 
          marginBottom: '12px', 
          width: '100%',
          padding: '8px',
          background: 'rgba(20, 20, 30, 0.9)',
          color: '#fff',
          border: '1px solid rgba(100, 200, 255, 0.3)',
          borderRadius: '6px',
          fontSize: '13px',
          cursor: 'pointer',
        }}
      />
      <button
        onClick={handleAnalyze}
        disabled={!file || uploading}
        style={{
          width: '100%',
          padding: '12px',
          background: uploading 
            ? 'rgba(85, 85, 85, 0.6)' 
            : 'linear-gradient(135deg, #0a8, #08a)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: uploading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          boxShadow: uploading ? 'none' : '0 4px 12px rgba(0, 170, 136, 0.3)',
          transition: 'all 0.2s',
        }}
      >
        {uploading ? 'Analyzing...' : 'Analyze & Preview'}
      </button>
      {error && (
        <div style={{ 
          marginTop: '12px', 
          color: '#ff4444', 
          fontSize: '12px',
          padding: '8px',
          background: 'rgba(255, 68, 68, 0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(255, 68, 68, 0.3)',
        }}>
          {error}
        </div>
      )}
    </div>
  );
};


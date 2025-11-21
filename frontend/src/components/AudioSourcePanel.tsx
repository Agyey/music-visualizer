import React, { useState, useRef, useEffect } from 'react';
import { uploadAudio } from '../api';
import { ExtendedAudioAnalysisResponse } from '../types/timeline';

interface AudioSourcePanelProps {
  onAnalysisComplete: (
    analysis: ExtendedAudioAnalysisResponse,
    audioUrl: string,
    audioElement: HTMLAudioElement,
    fileName?: string
  ) => void;
  onLiveAudioStart?: (stream: MediaStream) => void;
  onLiveAudioStop?: () => void;
}

export const AudioSourcePanel: React.FC<AudioSourcePanelProps> = ({
  onAnalysisComplete,
  onLiveAudioStart,
  onLiveAudioStop,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'record' | 'live'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [separateStems, setSeparateStems] = useState(false);

  useEffect(() => {
    if (recording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith('audio/')) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please select an audio file');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const analysis = await uploadAudio(file, false);
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';

      audio.addEventListener('canplaythrough', () => {
        onAnalysisComplete(analysis, audioUrl, audio, file.name);
      });

      audio.load();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });

        setUploading(true);
        try {
          const analysis = await uploadAudio(audioFile, false);
          const audio = new Audio(audioUrl);
          audio.preload = 'auto';

          audio.addEventListener('canplaythrough', () => {
            onAnalysisComplete(analysis, audioUrl, audio, `Recording ${new Date().toLocaleString()}`);
          });

          audio.load();
        } catch (err: any) {
          setError(err.response?.data?.detail || err.message || 'Recording upload failed');
        } finally {
          setUploading(false);
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
    } catch (err: any) {
      setError('Failed to access microphone: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startLiveMode = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setLiveMode(true);
      if (onLiveAudioStart) onLiveAudioStart(stream);
    } catch (err: any) {
      setError('Failed to access microphone: ' + err.message);
    }
  };

  const stopLiveMode = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setLiveMode(false);
    if (onLiveAudioStop) onLiveAudioStop();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(100, 200, 255, 0.2)' }}>
        {(['upload', 'record', 'live'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab !== 'live' && liveMode) stopLiveMode();
              if (tab !== 'record' && recording) stopRecording();
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: activeTab === tab ? 'rgba(100, 200, 255, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #0af' : '2px solid transparent',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'capitalize',
              transition: 'all 0.2s',
            }}
          >
            {tab === 'upload' ? '📁 Upload' : tab === 'record' ? '🎙️ Record' : '🔴 Live'}
          </button>
        ))}
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '12px',
              background: 'rgba(20, 20, 30, 0.9)',
              color: '#fff',
              border: '1px solid rgba(100, 200, 255, 0.3)',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          />
          <button
            onClick={handleUpload}
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
              transition: 'all 0.2s',
            }}
          >
            {uploading ? 'Analyzing...' : 'Analyze & Visualize'}
          </button>
        </div>
      )}

      {/* Record Tab */}
      {activeTab === 'record' && (
        <div>
          {!recording ? (
            <button
              onClick={startRecording}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #f44, #c44)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              🎙️ Start Recording
            </button>
          ) : (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '24px', fontWeight: 'bold', color: '#f44' }}>
                {formatTime(recordingTime)}
              </div>
              <button
                onClick={stopRecording}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #444, #222)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                ⏹️ Stop & Analyze
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live Tab */}
      {activeTab === 'live' && (
        <div>
          {!liveMode ? (
            <button
              onClick={startLiveMode}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #f44, #c44)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              🔴 Start Live Visualization
            </button>
          ) : (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '14px', color: '#f44', fontWeight: '600' }}>
                ● LIVE
              </div>
              <button
                onClick={stopLiveMode}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #444, #222)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                ⏹️ Stop Live Mode
              </button>
            </div>
          )}
        </div>
      )}

      {/* Audio Processing Options */}
      {(activeTab === 'upload' || (activeTab === 'record' && !recording)) && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(100, 200, 255, 0.2)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '12px', color: '#aaa' }}>
            Audio Processing
          </div>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={separateStems}
              onChange={(e) => setSeparateStems(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', color: '#ccc' }}>Separate vocals & background</span>
          </label>

          <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
            EQ & processing available after analysis
          </div>
        </div>
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
    </div>
  );
};


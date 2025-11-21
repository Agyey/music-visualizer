import React, { useState, useEffect } from 'react';
import { ExtendedAudioAnalysisResponse } from '../types/timeline';

interface UploadHistoryItem {
  id: string;
  audioId: string;
  fileName: string;
  uploadDate: string;
  duration: number;
  bpm: number;
  hasLyrics: boolean;
  hasStems: boolean;
  language?: string;
  thumbnail?: string; // Base64 or URL
}

interface UploadHistoryProps {
  onSelectUpload: (audioId: string, analysis: ExtendedAudioAnalysisResponse) => void;
  currentUser: { id: string; email: string; name: string } | null;
}

export const UploadHistory: React.FC<UploadHistoryProps> = ({ onSelectUpload, currentUser }) => {
  const [uploads, setUploads] = useState<UploadHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState<string | null>(null);

  useEffect(() => {
    loadUploadHistory();
  }, [currentUser]);

  const loadUploadHistory = () => {
    setLoading(true);
    try {
      const key = currentUser 
        ? `uploadHistory_${currentUser.id}` 
        : 'uploadHistory_anonymous';
      const stored = localStorage.getItem(key);
      if (stored) {
        const history = JSON.parse(stored);
        // Sort by date, newest first
        const sorted = history.sort((a: UploadHistoryItem, b: UploadHistoryItem) => 
          new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
        );
        setUploads(sorted);
      }
    } catch (err) {
      console.error('Failed to load upload history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelect = async (upload: UploadHistoryItem) => {
    setSelectedUpload(upload.id);
    try {
      // Load the analysis from storage
      const analysisKey = `analysis_${upload.audioId}`;
      const storedAnalysis = localStorage.getItem(analysisKey);
      
      if (storedAnalysis) {
        const analysis: ExtendedAudioAnalysisResponse = JSON.parse(storedAnalysis);
        onSelectUpload(upload.audioId, analysis);
      } else {
        // If analysis not found, try to reload from API
        // For now, just show an error
        alert('Analysis data not found. Please re-upload the file.');
      }
    } catch (err) {
      console.error('Failed to load analysis:', err);
      alert('Failed to load analysis data.');
    }
  };

  const handleDelete = (uploadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this upload from history?')) {
      return;
    }

    const key = currentUser 
      ? `uploadHistory_${currentUser.id}` 
      : 'uploadHistory_anonymous';
    
    const updated = uploads.filter(u => u.id !== uploadId);
    setUploads(updated);
    localStorage.setItem(key, JSON.stringify(updated));
    
    // Also remove associated analysis if needed
    const upload = uploads.find(u => u.id === uploadId);
    if (upload) {
      localStorage.removeItem(`analysis_${upload.audioId}`);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
        Loading upload history...
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
        <div style={{ color: '#888', fontSize: '14px', marginBottom: '8px' }}>
          No uploads yet
        </div>
        <div style={{ color: '#666', fontSize: '12px' }}>
          Upload your first audio file to get started!
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      maxHeight: '70vh', 
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(100, 200, 255, 0.2)'
      }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#aaa' }}>
          {uploads.length} {uploads.length === 1 ? 'upload' : 'uploads'}
        </div>
        <button
          onClick={() => {
            if (confirm('Clear all upload history?')) {
              const key = currentUser 
                ? `uploadHistory_${currentUser.id}` 
                : 'uploadHistory_anonymous';
              localStorage.removeItem(key);
              setUploads([]);
            }
          }}
          style={{
            padding: '4px 8px',
            background: 'rgba(255, 68, 68, 0.2)',
            color: '#ff4444',
            border: '1px solid rgba(255, 68, 68, 0.3)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          Clear All
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {uploads.map((upload) => (
          <div
            key={upload.id}
            onClick={() => handleSelect(upload)}
            style={{
              padding: '12px',
              background: selectedUpload === upload.id
                ? 'rgba(100, 200, 255, 0.15)'
                : 'rgba(20, 20, 30, 0.6)',
              border: selectedUpload === upload.id
                ? '1px solid rgba(100, 200, 255, 0.4)'
                : '1px solid rgba(100, 200, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (selectedUpload !== upload.id) {
                e.currentTarget.style.background = 'rgba(20, 20, 30, 0.8)';
                e.currentTarget.style.borderColor = 'rgba(100, 200, 255, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedUpload !== upload.id) {
                e.currentTarget.style.background = 'rgba(20, 20, 30, 0.6)';
                e.currentTarget.style.borderColor = 'rgba(100, 200, 255, 0.2)';
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontSize: '13px', 
                  fontWeight: '600', 
                  color: '#fff',
                  marginBottom: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {upload.fileName}
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#888', flexWrap: 'wrap' }}>
                  <span>⏱️ {formatDuration(upload.duration)}</span>
                  <span>🎵 {upload.bpm.toFixed(0)} BPM</span>
                  {upload.hasLyrics && <span>📝 Lyrics</span>}
                  {upload.hasStems && <span>🎚️ Stems</span>}
                  {upload.language && <span>🌐 {upload.language.toUpperCase()}</span>}
                </div>
                <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                  {formatDate(upload.uploadDate)}
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(upload.id, e)}
                style={{
                  padding: '4px 8px',
                  background: 'rgba(255, 68, 68, 0.1)',
                  color: '#ff4444',
                  border: '1px solid rgba(255, 68, 68, 0.2)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  marginLeft: '8px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 68, 68, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 68, 68, 0.1)';
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


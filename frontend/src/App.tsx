import { useState, useRef, useEffect } from 'react';
import { CollapsiblePanel } from './components/CollapsiblePanel';
import { AudioSourcePanel } from './components/AudioSourcePanel';
import { AudioProcessingPanel } from './components/AudioProcessingPanel';
import { VisualizerCanvas } from './components/VisualizerCanvas';
import { VisualizerControls } from './components/VisualizerControls';
import { SaveExportPanel } from './components/SaveExportPanel';
import { RenderPanel } from './components/RenderPanel';
import { UserAuth } from './components/UserAuth';
import { UploadHistory } from './components/UploadHistory';
import { ExtendedAudioAnalysisResponse, VisualizerMode } from './types/timeline';
import { VisualizerEngine } from './visualizers/VisualizerEngine';

interface User {
  id: string;
  email: string;
  name: string;
}

function App() {
  const [analysis, setAnalysis] = useState<ExtendedAudioAnalysisResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>("geometric");
  const [engine, setEngine] = useState<VisualizerEngine | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleAnalysisComplete = (
    newAnalysis: ExtendedAudioAnalysisResponse,
    url: string,
    audioElement: HTMLAudioElement,
    fileName?: string
  ) => {
    setAnalysis(newAnalysis);
    setAudioUrl(url);
    audioRef.current = audioElement;

    // Save to upload history
    const historyKey = user 
      ? `uploadHistory_${user.id}` 
      : 'uploadHistory_anonymous';
    
    const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const historyItem = {
      id: Math.random().toString(36).substr(2, 9),
      audioId: newAnalysis.audio_id,
      fileName: fileName || 'Unknown',
      uploadDate: new Date().toISOString(),
      duration: newAnalysis.duration,
      bpm: newAnalysis.bpm,
      hasLyrics: !!(newAnalysis.lyrics && newAnalysis.lyrics.length > 0),
      hasStems: newAnalysis.has_stems || false,
      language: newAnalysis.detected_language,
    };
    
    existingHistory.push(historyItem);
    localStorage.setItem(historyKey, JSON.stringify(existingHistory));
    
    // Also save the full analysis for quick reload
    localStorage.setItem(`analysis_${newAnalysis.audio_id}`, JSON.stringify(newAnalysis));
  };

  const handleSelectFromHistory = (_audioId: string, analysis: ExtendedAudioAnalysisResponse) => {
    setAnalysis(analysis);
    setShowHistory(false);
    // Note: We'd need to reload the audio file from the server
    // For now, just set the analysis and let the user know they need to re-upload
    // In a full implementation, we'd fetch the audio file from the server
  };

  const handleLiveAudioStart = (stream: MediaStream) => {
    setLiveStream(stream);
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    
    setAudioContext(ctx);
    setAnalyserNode(analyser);
  };

  const handleLiveAudioStop = () => {
    if (liveStream) {
      liveStream.getTracks().forEach(track => track.stop());
      setLiveStream(null);
    }
    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
    }
    setAnalyserNode(null);
  };

  const handleEngineReady = (eng: VisualizerEngine) => {
    setEngine(eng);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
      {/* Main Visualizer Canvas */}
      <VisualizerCanvas 
        analysis={analysis} 
        audioRef={audioRef} 
        mode={visualizerMode}
        onEngineReady={handleEngineReady}
        liveAnalyser={analyserNode}
      />
      
      {/* Top Left: Audio Source Panel */}
      <CollapsiblePanel
        title="Audio Source"
        icon="🎵"
        position="top-left"
        width={isMobile ? "calc(100vw - 20px)" : "360px"}
        defaultExpanded={false}
      >
        <AudioSourcePanel
          onAnalysisComplete={(analysis, url, audio, fileName) => 
            handleAnalysisComplete(analysis, url, audio, fileName)
          }
          onLiveAudioStart={handleLiveAudioStart}
          onLiveAudioStop={handleLiveAudioStop}
        />
      </CollapsiblePanel>

      {/* Top Right: Upload History (shown when enabled) */}
      {showHistory && (
        <CollapsiblePanel
          title="Upload History"
          icon="📚"
          position="top-right"
          width={isMobile ? "calc(100vw - 20px)" : "400px"}
          defaultExpanded={true}
        >
          <UploadHistory
            onSelectUpload={handleSelectFromHistory}
            currentUser={user}
          />
        </CollapsiblePanel>
      )}

      {/* Top Right: User Auth (or below history if shown) */}
      <CollapsiblePanel
        title="Account"
        icon="👤"
        position={showHistory && isMobile ? "top-right" : "top-right"}
        width={isMobile ? "calc(100vw - 20px)" : "280px"}
        defaultExpanded={false}
      >
        <UserAuth
          currentUser={user}
          onLogin={(u) => setUser(u)}
          onLogout={() => setUser(null)}
        />
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(100, 200, 255, 0.2)' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              width: '100%',
              padding: '10px',
              background: showHistory
                ? 'rgba(100, 200, 255, 0.2)'
                : 'rgba(20, 20, 30, 0.9)',
              color: '#fff',
              border: '1px solid rgba(100, 200, 255, 0.3)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            {showHistory ? '📚 Hide History' : '📚 View History'}
          </button>
        </div>
      </CollapsiblePanel>

      {/* Bottom Left: Audio Processing */}
      <CollapsiblePanel
        title="Audio Processing"
        icon="🎚️"
        position="bottom-left"
        width={isMobile ? "calc(100vw - 20px)" : "360px"}
        defaultExpanded={false}
      >
        <AudioProcessingPanel
          analysis={analysis}
        />
      </CollapsiblePanel>

      {/* Bottom Right: Render Video */}
      <CollapsiblePanel
        title="Render Video"
        icon="🎬"
        position="bottom-right"
        width={isMobile ? "calc(100vw - 20px)" : "400px"}
        defaultExpanded={false}
      >
        <RenderPanel
          analysis={analysis}
          audioId={analysis?.audio_id || null}
        />
      </CollapsiblePanel>

      {/* Save & Export (if still needed) */}
      {false && (
        <CollapsiblePanel
          title="Save & Export"
          icon="💾"
          position="bottom-right"
          width={isMobile ? "calc(100vw - 20px)" : "360px"}
          defaultExpanded={false}
        >
          <SaveExportPanel
            analysis={analysis}
            visualizerMode={visualizerMode}
          />
        </CollapsiblePanel>
      )}

      {/* Bottom Center: Visualizer Controls (Always visible when expanded) */}
      <CollapsiblePanel
        title="Visualizer Settings"
        icon="🎨"
        position="bottom-center"
        width={isMobile ? "calc(100vw - 40px)" : "500px"}
        defaultExpanded={false}
      >
        <VisualizerControls
          engine={engine}
          currentMode={visualizerMode}
          onModeChange={setVisualizerMode}
        />
      </CollapsiblePanel>

      {/* Audio Player (minimized when panels are collapsed) */}
      {audioUrl && !liveStream && (
        <div
          className="audio-player-container"
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999,
            width: '90%',
            maxWidth: '600px',
            background: 'rgba(10, 10, 20, 0.9)',
            backdropFilter: 'blur(10px)',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(100, 200, 255, 0.2)',
          }}
        >
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            style={{
              width: '100%',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Live Mode Indicator */}
      {liveStream && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1001,
            padding: '8px 16px',
            background: 'rgba(255, 68, 68, 0.9)',
            borderRadius: '20px',
            color: '#fff',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(255, 68, 68, 0.4)',
          }}
        >
          <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#fff', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span>
          LIVE VISUALIZATION
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

export default App;

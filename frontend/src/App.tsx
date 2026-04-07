import { useState, useEffect } from 'react';
import { CollapsiblePanel } from './components/CollapsiblePanel';
import { AudioSourcePanel } from './components/AudioSourcePanel';
import { AudioProcessingPanel } from './components/AudioProcessingPanel';
import { VisualizerCanvas } from './components/VisualizerCanvas';
import { VisualizerControls } from './components/VisualizerControls';
import { RenderPanel } from './components/RenderPanel';
import { AccountManager } from './components/AccountManager';
import { QualityIndicator } from './components/QualityIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAppHandlers } from './hooks/useAppHandlers';

/**
 * Main Application Component
 * 
 * Orchestrates the music visualizer dashboard, handling audio streams,
 * analysis state, and UI panel coordination.
 */
function App() {
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const {
    analysis,
    audioUrl,
    audioRef,
    visualizerMode,
    setVisualizerMode,
    engine,
    liveStream,
    analyserNode,
    showHistory,
    setShowHistory,
    handleAnalysisComplete,
    handleSelectFromHistory,
    handleLiveAudioStart,
    handleLiveAudioStop,
    handleEngineReady,
    handleQualityOverride
  } = useAppHandlers();

  return (
    <div className="app-container" style={{ 
      position: 'relative', 
      width: '100vw', 
      height: '100vh', 
      overflow: 'hidden', 
      background: '#000',
      touchAction: 'pan-x pan-y',
      minWidth: '320px',
      minHeight: '480px',
    }}>
      {/* Main Visualizer Canvas */}
      <ErrorBoundary name="Visualizer" fallback={
        <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
          Visualizer failed to load. Try refreshing.
        </div>
      }>
        <VisualizerCanvas
          analysis={analysis}
          audioRef={audioRef}
          mode={visualizerMode}
          onEngineReady={handleEngineReady}
          liveAnalyser={analyserNode}
        />
      </ErrorBoundary>
      
      {/* Panels for Controls and Settings */}
      <ErrorBoundary name="Controls">
      <div className="controls-layer">
        {/* Top Left: Audio Source Panel */}
        <CollapsiblePanel
          title="Audio Source"
          icon="🎵"
          position="top-left"
          width={isMobile ? "calc(100vw - 20px)" : "360px"}
          defaultExpanded={false}
        >
          <AudioSourcePanel
            onAnalysisComplete={handleAnalysisComplete}
            onLiveAudioStart={handleLiveAudioStart}
            onLiveAudioStop={handleLiveAudioStop}
          />
        </CollapsiblePanel>

        {/* Top Right: Account & History Management */}
        <CollapsiblePanel
          title="Account"
          icon="👤"
          position="top-right"
          width={isMobile ? "calc(100vw - 20px)" : "320px"}
          defaultExpanded={false}
        >
          <AccountManager
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            onSelectFromHistory={handleSelectFromHistory}
          />
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

        {/* Bottom Center: Visualizer Controls */}
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
      </div>
      </ErrorBoundary>

      {/* Persistent UI Elements */}
      {audioUrl && !liveStream && (
        <div
          className="audio-player-container"
          style={{
            position: 'fixed',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 998,
            width: isMobile ? 'calc(100vw - 40px)' : '90%',
            maxWidth: '600px',
            background: 'rgba(10, 10, 20, 0.95)',
            backdropFilter: 'blur(10px)',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(100, 200, 255, 0.2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            pointerEvents: 'auto',
          }}
        >
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            style={{ width: '100%', outline: 'none' }}
          />
        </div>
      )}

      {/* Overlay Indicators */}
      {engine && (
        <QualityIndicator
          level={engine.getQualityProfile().level}
          onOverride={handleQualityOverride}
        />
      )}

      {liveStream && (
        <div className="live-indicator">
          <span className="pulse-dot"></span>
          LIVE VISUALIZATION
          <style>{`
            .live-indicator {
              position: fixed;
              top: 20px;
              left: 50%;
              transform: translateX(-50%);
              z-index: 1001;
              padding: 8px 16px;
              background: rgba(255, 68, 68, 0.9);
              border-radius: 20px;
              color: #fff;
              font-size: 12px;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 8px;
              box-shadow: 0 4px 16px rgba(255, 68, 68, 0.4);
            }
            .pulse-dot {
              width: 8px;
              height: 8px;
              background: #fff;
              border-radius: 50%;
              animation: pulse 1s infinite;
            }
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

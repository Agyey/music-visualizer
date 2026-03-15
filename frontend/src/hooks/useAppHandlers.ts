import { useState, useRef, useCallback } from 'react';
import { ExtendedAudioAnalysisResponse, VisualizerMode } from '../types/timeline';
import { VisualizerEngine } from '../visualizers/VisualizerEngine';

interface User {
  id: string;
  email: string;
  name: string;
}

export function useAppHandlers(user: User | null) {
  const [analysis, setAnalysis] = useState<ExtendedAudioAnalysisResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>("geometric");
  const [engine, setEngine] = useState<VisualizerEngine | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const handleAnalysisComplete = useCallback((
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
  }, [user]);

  const handleSelectFromHistory = useCallback((_audioId: string, analysis: ExtendedAudioAnalysisResponse) => {
    setAnalysis(analysis);
    setShowHistory(false);
  }, []);

  const handleLiveAudioStart = useCallback((stream: MediaStream) => {
    setLiveStream(stream);
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    
    setAudioContext(ctx);
    setAnalyserNode(analyser);
  }, []);

  const handleLiveAudioStop = useCallback(() => {
    if (liveStream) {
      liveStream.getTracks().forEach(track => track.stop());
      setLiveStream(null);
    }
    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
    }
    setAnalyserNode(null);
  }, [liveStream, audioContext]);

  const handleEngineReady = useCallback((eng: VisualizerEngine) => {
    setEngine(eng);
  }, []);
  
  const handleQualityOverride = useCallback((level: "low" | "medium" | "high" | null) => {
    if (engine) {
      engine.getQualityManager().setManualOverride(level);
    }
  }, [engine]);

  return {
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
  };
}

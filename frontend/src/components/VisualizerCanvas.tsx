import React, { useEffect, useRef, useState } from 'react';
import { ExtendedAudioAnalysisResponse } from '../types/timeline';
import { VisualizerEngine } from '../visualizers/VisualizerEngine';

interface VisualizerCanvasProps {
  analysis: ExtendedAudioAnalysisResponse | null;
  audioRef: React.RefObject<HTMLAudioElement>;
  mode?: "geometric" | "psychedelic" | "particles" | "threeD";
  onEngineReady?: (engine: VisualizerEngine) => void;
  liveAnalyser?: AnalyserNode | null;
}

const BEAT_WINDOW = 0.06;

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  analysis,
  audioRef,
  mode = "geometric",
  onEngineReady,
  liveAnalyser,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const liveFrameRef = useRef<number | null>(null);
  const engineRef = useRef<VisualizerEngine | null>(null);
  // Track engine readiness so effects can react to it
  const [engineReady, setEngineReady] = useState(false);

  // ── ENGINE INITIALIZATION ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container || (!analysis && !liveAnalyser)) return;

    // Initialize engine (use container div, not canvas)
    if (!engineRef.current) {
      engineRef.current = new VisualizerEngine(container, analysis);
      setEngineReady(true);
      if (onEngineReady) {
        onEngineReady(engineRef.current);
      }
    }

    const engine = engineRef.current;
    if (analysis) {
      engine.updateAnalysis(analysis);
    }
    engine.setMode(mode);

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width || window.innerWidth;
      const height = rect.height || window.innerHeight;
      engine.resize(width, height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [analysis, mode, onEngineReady, liveAnalyser]);

  // ── LIVE AUDIO VISUALIZATION ──
  // Runs when liveAnalyser is set AND engine is ready
  useEffect(() => {
    if (!liveAnalyser || !engineRef.current) return;

    const engine = engineRef.current;
    const bufferLength = liveAnalyser.frequencyBinCount;

    const analyzeLiveAudio = () => {
      const buffer = new Uint8Array(bufferLength);
      liveAnalyser.getByteFrequencyData(buffer);
      
      // Calculate frequency bands (bass, mid, treble)
      const bassEnd = Math.floor(bufferLength * 0.1);
      const midEnd = Math.floor(bufferLength * 0.5);

      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;

      for (let i = 0; i < bassEnd; i++) {
        bassSum += buffer[i];
      }
      for (let i = bassEnd; i < midEnd; i++) {
        midSum += buffer[i];
      }
      for (let i = midEnd; i < bufferLength; i++) {
        trebleSum += buffer[i];
      }

      const bass = (bassSum / bassEnd) / 255;
      const mid = (midSum / (midEnd - bassEnd)) / 255;
      const treble = (trebleSum / (bufferLength - midEnd)) / 255;
      const energy = (bass * 0.4 + mid * 0.4 + treble * 0.2);

      const time = performance.now() / 1000;
      const beatPulse = energy > 0.5 ? energy * 0.8 : 0;

      engine.updateFeatures(time, {
        bass,
        mid,
        treble,
        energy,
        beatPulse,
        lyricIntensity: 0,
        lyricSentiment: 0,
        lyricEnergy: energy,
        currentSection: "live",
        emotion: "neutral",
      });

      engine.render(time);
      liveFrameRef.current = requestAnimationFrame(analyzeLiveAudio);
    };

    analyzeLiveAudio();

    return () => {
      if (liveFrameRef.current) {
        cancelAnimationFrame(liveFrameRef.current);
        liveFrameRef.current = null;
      }
    };
  }, [liveAnalyser, engineReady]);

  // ── FILE-BASED AUDIO VISUALIZATION ──
  useEffect(() => {
    // Skip if in live mode or no analysis
    if (liveAnalyser || !analysis || !engineRef.current) return;

    const engine = engineRef.current;

    const interpolateFeatures = (t: number) => {
      const frames = analysis.frames;
      if (!frames.length) return { bass: 0, mid: 0, treble: 0, energy: 0 };

      if (t <= frames[0].time) {
        const f = frames[0];
        return { bass: f.bass, mid: f.mid, treble: f.treble, energy: f.energy };
      }

      if (t >= frames[frames.length - 1].time) {
        const f = frames[frames.length - 1];
        return { bass: f.bass, mid: f.mid, treble: f.treble, energy: f.energy };
      }

      for (let i = 0; i < frames.length - 1; i++) {
        if (frames[i].time <= t && t <= frames[i + 1].time) {
          const f0 = frames[i];
          const f1 = frames[i + 1];
          const alpha = (t - f0.time) / (f1.time - f0.time) || 0;
          return {
            bass: f0.bass + alpha * (f1.bass - f0.bass),
            mid: f0.mid + alpha * (f1.mid - f0.mid),
            treble: f0.treble + alpha * (f1.treble - f0.treble),
            energy: f0.energy + alpha * (f1.energy - f0.energy),
          };
        }
      }

      return { bass: 0, mid: 0, treble: 0, energy: 0 };
    };

    const getBeatPulse = (t: number): number => {
      let pulse = 0;
      for (const beat of analysis.beats) {
        const dt = Math.abs(t - beat.time);
        if (dt < BEAT_WINDOW) {
          const strength = beat.strength * (1.0 - dt / BEAT_WINDOW);
          pulse = Math.max(pulse, strength);
        }
      }
      return pulse;
    };

    const getCurrentSection = (t: number): string => {
      if (!analysis.sections || analysis.sections.length === 0) {
        return "intro";
      }
      
      for (const section of analysis.sections) {
        if (t >= section.start && t <= section.end) {
          return section.type;
        }
      }
      
      return analysis.sections[analysis.sections.length - 1]?.type || "intro";
    };

    const getLyricFeatures = (t: number) => {
      if (!analysis.lyrics || analysis.lyrics.length === 0) {
        return { intensity: 0, sentiment: 0, energy: 0 };
      }

      let closest: any = analysis.lyrics[0];
      let minDist = Infinity;

      for (const lyric of analysis.lyrics) {
        const lyricTime = (lyric as any).start !== undefined ? (lyric as any).start : (lyric as any).time;
        const lyricEnd = (lyric as any).end !== undefined ? (lyric as any).end : lyricTime;
        
        if (t >= lyricTime && t <= lyricEnd) {
          closest = lyric;
          minDist = 0;
          break;
        }
        
        const dist = Math.abs(t - lyricTime);
        if (dist < minDist) {
          minDist = dist;
          closest = lyric;
        }
      }

      const windowSize = 2.0;
      const intensity = Math.max(0, 1.0 - minDist / windowSize);

      return {
        intensity: closest.intensity !== undefined ? closest.intensity : intensity,
        sentiment: closest.sentiment || 0,
        energy: closest.energy || closest.intensity || 0,
      };
    };

    const animate = () => {
      const audio = audioRef.current;
      if (!audio) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const t = audio.currentTime || 0;
      const feat = interpolateFeatures(t);
      const pulse = getBeatPulse(t);
      const section = getCurrentSection(t);
      const lyric = getLyricFeatures(t);

      const emotion = analysis?.emotion_summary?.overall_emotion || 
                     analysis?.sections?.find((s) => 
                       t >= s.start && t <= s.end
                     )?.emotion || "chill";
      
      engine.updateFeatures(t, {
        bass: feat.bass,
        mid: feat.mid,
        treble: feat.treble,
        energy: feat.energy,
        beatPulse: pulse,
        lyricIntensity: lyric.intensity,
        lyricSentiment: lyric.sentiment,
        lyricEnergy: lyric.energy,
        currentSection: section,
        emotion: emotion,
      });

      engine.render(t);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [analysis, audioRef, liveAnalyser, engineReady]);

  // Update mode when prop changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setMode(mode);
    }
  }, [mode]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    />
  );
};

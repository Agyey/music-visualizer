import React, { useEffect, useRef } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const engineRef = useRef<VisualizerEngine | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const bufferLengthRef = useRef<number>(0);

  // Initialize analyser data array for live mode
  useEffect(() => {
    if (liveAnalyser) {
      bufferLengthRef.current = liveAnalyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLengthRef.current);
    }
  }, [liveAnalyser]);

  // Live audio visualization
  useEffect(() => {
    if (!liveAnalyser || !engineRef.current) return;

    const engine = engineRef.current;
    const bufferLength = liveAnalyser.frequencyBinCount;
    let animationFrameId: number;

    const analyzeLiveAudio = () => {
      // Create a new array each frame to avoid type issues
      const buffer = new Uint8Array(bufferLength);
      liveAnalyser.getByteFrequencyData(buffer);
      
      // Calculate frequency bands (bass, mid, treble)
      const bassStart = 0;
      const bassEnd = Math.floor(buffer.length * 0.1);
      const midStart = bassEnd;
      const midEnd = Math.floor(buffer.length * 0.5);
      const trebleStart = midEnd;
      const trebleEnd = buffer.length;

      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;

      for (let i = bassStart; i < bassEnd; i++) {
        bassSum += buffer[i];
      }
      for (let i = midStart; i < midEnd; i++) {
        midSum += buffer[i];
      }
      for (let i = trebleStart; i < trebleEnd; i++) {
        trebleSum += buffer[i];
      }

      const bass = (bassSum / (bassEnd - bassStart)) / 255;
      const mid = (midSum / (midEnd - midStart)) / 255;
      const treble = (trebleSum / (trebleEnd - trebleStart)) / 255;
      const energy = (bass * 0.4 + mid * 0.4 + treble * 0.2);

      // Calculate beat pulse from energy changes
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
      animationFrameId = requestAnimationFrame(analyzeLiveAudio);
    };

    analyzeLiveAudio();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [liveAnalyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (!analysis && !liveAnalyser)) return;

    // Initialize engine (use analysis if available, otherwise create with null)
    if (!engineRef.current) {
      engineRef.current = new VisualizerEngine(canvas, analysis);
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
      engine.resize(window.innerWidth, window.innerHeight);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Skip file-based animation if in live mode
    if (liveAnalyser) {
      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }

    if (!analysis) return;

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
      if (!analysis) return 0;
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
      if (!analysis || !analysis.sections || analysis.sections.length === 0) {
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
      if (!analysis || !analysis.lyrics || analysis.lyrics.length === 0) {
        return { intensity: 0, sentiment: 0, energy: 0 };
      }

      // Find current or closest lyric (support both LyricEntry and LyricSegment)
      let closest: any = analysis.lyrics[0];
      let minDist = Infinity;

      for (const lyric of analysis.lyrics) {
        // Support both old format (time) and new format (start/end)
        const lyricTime = (lyric as any).start !== undefined ? (lyric as any).start : (lyric as any).time;
        const lyricEnd = (lyric as any).end !== undefined ? (lyric as any).end : lyricTime;
        
        // Check if current time is within lyric segment
        if (t >= lyricTime && t <= lyricEnd) {
          closest = lyric;
          minDist = 0;
          break;
        }
        
        // Otherwise find closest
        const dist = Math.abs(t - lyricTime);
        if (dist < minDist) {
          minDist = dist;
          closest = lyric;
        }
      }

      // Decay intensity based on distance
      const window = 2.0; // 2 second window
      const intensity = Math.max(0, 1.0 - minDist / window);

      // Support both old and new lyric formats
      return {
        intensity: closest.intensity !== undefined ? closest.intensity : intensity,
        sentiment: closest.sentiment || 0,
        energy: closest.energy || closest.intensity || 0,
      };
    };

    const animate = () => {
      // Skip if in live mode (handled by separate effect)
      if (liveAnalyser) {
        return;
      }

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

      // Get emotion from analysis if available
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
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analysis, audioRef, mode, onEngineReady, liveAnalyser]);

  // Update mode when prop changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setMode(mode);
    }
  }, [mode]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
};

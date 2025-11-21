export interface BeatInfo {
  time: number;
  strength: number;
}

export interface FrameFeature {
  time: number;
  bass: number;
  mid: number;
  treble: number;
  energy: number;
}

export interface LyricEntry {
  time: number;
  text: string;
  sentiment: number; // -1 to 1
  energy: number; // 0 to 1
}

export interface LyricSegment {
  start: number;
  end: number;
  text: string;
  language: string;
  sentiment: number; // -1 to 1
  emotion: string; // "happy", "sad", "angry", "chill", etc.
  intensity: number; // 0 to 1
  translated_text?: string;
}

export interface Section {
  start: number;
  end: number;
  type: "intro" | "verse" | "chorus" | "drop" | "bridge" | "outro";
}

export interface SectionInfo {
  start: number;
  end: number;
  type: string;
  energy: number; // 0 to 1
  emotion?: string;
}

export interface AudioEmotionSummary {
  overall_sentiment: number; // -1 to 1
  overall_emotion: string;
  arousal: number; // 0 to 1
  valence: number; // -1 to 1
}

export interface AudioAnalysisResponse {
  audio_id: string;
  duration: number;
  bpm: number;
  beats: BeatInfo[];
  frames: FrameFeature[];
  lyrics?: LyricEntry[];
  sections?: Section[];
}

export interface ExtendedAudioAnalysisResponse {
  audio_id: string;
  duration: number;
  bpm: number;
  beats: BeatInfo[];
  frames: FrameFeature[];
  lyrics?: LyricSegment[];
  sections?: SectionInfo[];
  emotion_summary?: AudioEmotionSummary;
  has_stems?: boolean;
  detected_language?: string;
}

export type VisualizerMode = "geometric" | "psychedelic" | "particles" | "threeD";

export type AspectRatioPreset = "16:9" | "9:16";
export type ResolutionPreset = "1080p" | "4K";

export interface AudioProcessingParams {
  use_processed: boolean;
  noise_reduction_strength: number; // 0 to 1
  low_gain_db: number;
  mid_gain_db: number;
  high_gain_db: number;
  vocal_gain_db: number;
  background_gain_db: number;
  reverb_amount: number; // 0 to 1
  normalize_lufs?: number;
}

export interface ProcessAudioRequest {
  audio_id: string;
  params: AudioProcessingParams;
}

export interface ProcessAudioResponse {
  audio_id: string;
  processed_audio_id: string;
}

export interface RenderRequest {
  audio_id: string;
  processed_audio_id?: string;
  aspect_ratio: AspectRatioPreset;
  resolution_preset: ResolutionPreset;
  visual_mode?: "geometric" | "psychedelic" | "particles" | "threeD";
  visual_variant?: string;
  use_lyrics?: boolean;
  use_emotion?: boolean;
  line_thickness?: number;
  glow_strength?: number;
  bar_count?: number;
  color_mode?: string;
}

export interface VisualStateAtTime {
  time: number;
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  beatPulse: number; // 0..1
  lyricIntensity: number; // 0..1
  lyricSentiment: number; // -1..1
  emotion: string; // dominant emotion label
  sectionType: string; // intro/verse/chorus/drop/etc.
}

export interface RenderResponse {
  video_id: string;
  video_url: string;
}


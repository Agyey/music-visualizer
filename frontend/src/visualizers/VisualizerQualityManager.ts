export type QualityLevel = "low" | "medium" | "high";

export interface QualityProfile {
  level: QualityLevel;
  maxParticles: number;
  use3D: boolean;
  useHeavyShaders: boolean;
  internalResolutionScale: number;
  postProcessingEnabled: boolean;
  allowWebGL: boolean;
}

export interface VisualizerCapabilities {
  hasWebGL2: boolean;
  hasWebGL: boolean;
  lowPowerDevice: boolean;
}

const QUALITY_PRESETS: Record<QualityLevel, Omit<QualityProfile, "level">> = {
  high: {
    maxParticles: 15000,
    use3D: true,
    useHeavyShaders: true,
    internalResolutionScale: 1.0,
    postProcessingEnabled: true,
    allowWebGL: true,
  },
  medium: {
    maxParticles: 8000,
    use3D: true,
    useHeavyShaders: true,
    internalResolutionScale: 0.8,
    postProcessingEnabled: false,
    allowWebGL: true,
  },
  low: {
    maxParticles: 3000,
    use3D: false,
    useHeavyShaders: false,
    internalResolutionScale: 0.6,
    postProcessingEnabled: false,
    allowWebGL: true,
  },
};

type QualityChangeCallback = (profile: QualityProfile) => void;

export class VisualizerQualityManager {
  private capabilities: VisualizerCapabilities;
  private profile: QualityProfile;
  private listeners: Set<QualityChangeCallback> = new Set();
  private frameTimes: number[] = [];
  private lastQualityChange = performance.now();
  private manualOverride: QualityLevel | null = null;

  constructor() {
    this.capabilities = this.detectCapabilities();
    this.profile = this.computeInitialProfile();
  }

  private detectCapabilities(): VisualizerCapabilities {
    const canvas = document.createElement('canvas');
    const hasWebGL2 = !!canvas.getContext('webgl2');
    const hasWebGL = hasWebGL2 || !!canvas.getContext('webgl') || !!canvas.getContext('experimental-webgl');
    const ua = navigator.userAgent || "";
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 900;
    const lowCores = (navigator.hardwareConcurrency || 4) <= 4;
    const lowPowerDevice = isMobile || smallScreen || lowCores;
    return { hasWebGL2, hasWebGL, lowPowerDevice };
  }

  private computeInitialProfile(): QualityProfile {
    let level: QualityLevel;
    if (!this.capabilities.hasWebGL) {
      level = "low";
    } else if (this.capabilities.hasWebGL2 && !this.capabilities.lowPowerDevice) {
      level = "high";
    } else {
      level = "medium";
    }
    return this.buildProfile(level);
  }

  private buildProfile(level: QualityLevel): QualityProfile {
    const preset = QUALITY_PRESETS[level];
    const profile: QualityProfile = {
      level,
      ...preset,
      allowWebGL: this.capabilities.hasWebGL && preset.allowWebGL,
    };

    if (!this.capabilities.hasWebGL) {
      profile.allowWebGL = false;
      profile.use3D = false;
      profile.useHeavyShaders = false;
      profile.maxParticles = Math.min(profile.maxParticles, 1200);
    } else if (this.capabilities.lowPowerDevice && level !== "low") {
      profile.maxParticles = Math.floor(profile.maxParticles * 0.75);
      profile.internalResolutionScale *= 0.85;
    }

    return profile;
  }

  getProfile(): QualityProfile {
    return this.profile;
  }

  getCapabilities(): VisualizerCapabilities {
    return this.capabilities;
  }

  onQualityChange(callback: QualityChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private emitQualityChange() {
    this.listeners.forEach((cb) => cb(this.profile));
  }

  registerFrame(timestamp: number) {
    if (this.manualOverride) return;
    this.frameTimes.push(timestamp);
    // Keep frames from last 2 seconds
    while (this.frameTimes.length > 0 && timestamp - this.frameTimes[0] > 2000) {
      this.frameTimes.shift();
    }
    if (this.frameTimes.length < 5) return;

    const elapsed = timestamp - this.frameTimes[0];
    if (elapsed <= 0) return;
    const fps = (this.frameTimes.length / elapsed) * 1000;

    const timeSinceChange = timestamp - this.lastQualityChange;
    if (fps < 28 && this.profile.level !== "low" && timeSinceChange > 4000) {
      this.stepDownQuality();
    } else if (fps > 55 && this.profile.level !== "high" && timeSinceChange > 6000) {
      this.stepUpQuality();
    }
  }

  private stepDownQuality() {
    const nextLevel = this.profile.level === "high" ? "medium" : "low";
    this.updateProfile(nextLevel);
  }

  private stepUpQuality() {
    const nextLevel = this.profile.level === "low" ? "medium" : "high";
    this.updateProfile(nextLevel);
  }

  private updateProfile(level: QualityLevel) {
    if (this.profile.level === level) return;
    this.profile = this.buildProfile(level);
    this.lastQualityChange = performance.now();
    this.emitQualityChange();
  }

  setManualOverride(level: QualityLevel | null) {
    this.manualOverride = level;
    if (level) {
      if (this.profile.level !== level) {
        this.profile = this.buildProfile(level);
        this.emitQualityChange();
      }
    } else {
      // revert to automatic based on capabilities
      const autoProfile = this.computeInitialProfile();
      if (autoProfile.level !== this.profile.level) {
        this.profile = autoProfile;
        this.emitQualityChange();
      }
    }
  }
}


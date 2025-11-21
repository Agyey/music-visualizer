import React, { useState } from 'react';
import { VisualizerMode } from '../types/timeline';
import { VisualizerEngine } from '../visualizers/VisualizerEngine';

interface VisualizerControlsProps {
  engine: VisualizerEngine | null;
  currentMode: VisualizerMode;
  onModeChange: (mode: VisualizerMode) => void;
}

export const VisualizerControls: React.FC<VisualizerControlsProps> = ({
  engine,
  currentMode,
  onModeChange,
}) => {
  const [geometricMorphSpeed, setGeometricMorphSpeed] = useState(0.5);
  const [geometricPolygonComplexity, setGeometricPolygonComplexity] = useState(6);
  const [geometricRotationSpeed, setGeometricRotationSpeed] = useState(1.0);
  
  const [shaderVariant, setShaderVariant] = useState(0);
  const [shaderIntensity, setShaderIntensity] = useState(1.0);
  
  const [particleMode, setParticleMode] = useState(0);
  const [particleCount, setParticleCount] = useState(10000);
  const [particleTurbulence, setParticleTurbulence] = useState(0.5);
  const [particleGravity, setParticleGravity] = useState(0.0);

  const [threeDShape, setThreeDShape] = useState("sphere");
  const [threeDMorphSpeed, setThreeDMorphSpeed] = useState(0.01);
  const [threeDCameraSpeed, setThreeDCameraSpeed] = useState(0.001);

  // Update geometric parameters
  React.useEffect(() => {
    if (engine && currentMode === "geometric") {
      const renderer = engine.getGeometricRenderer();
      renderer.shapeMorphSpeed = geometricMorphSpeed;
      renderer.polygonComplexity = geometricPolygonComplexity;
      renderer.rotationSpeed = geometricRotationSpeed;
    }
  }, [engine, currentMode, geometricMorphSpeed, geometricPolygonComplexity, geometricRotationSpeed]);

  // Update shader parameters
  React.useEffect(() => {
    if (engine && currentMode === "psychedelic") {
      const renderer = engine.getShaderRenderer();
      const variantMap: Record<number, string> = {
        0: "fractal_zoom",
        1: "kaleidoscope",
        2: "vortex_tunnel",
        3: "plasma",
      };
      renderer.setShaderVariant(variantMap[shaderVariant] || "fractal_zoom");
    }
  }, [engine, currentMode, shaderVariant, shaderIntensity]);

  // Update particle parameters
  React.useEffect(() => {
    if (engine && currentMode === "particles") {
      const variantMap: Record<number, "nebula" | "vortex_swarm" | "beat_fireworks" | "liquid_flow"> = {
        0: "nebula", 1: "beat_fireworks", 2: "vortex_swarm", 3: "liquid_flow"
      };
      engine.setParticleVariant(variantMap[particleMode] || "nebula");
      
      engine.setParticleCount(particleCount);
      engine.setParticleTurbulence(particleTurbulence);
      engine.setParticleGravity(particleGravity);
    }
  }, [engine, currentMode, particleMode, particleCount, particleTurbulence, particleGravity]);

  // Update 3D parameters
  React.useEffect(() => {
    if (engine && currentMode === "threeD") {
      engine.setThreeDConfig({
        shape_family: threeDShape,
        morph_speed: threeDMorphSpeed,
        camera_fly_through_speed: threeDCameraSpeed,
      });
    }
  }, [engine, currentMode, threeDShape, threeDMorphSpeed, threeDCameraSpeed]);

  return (
    <div style={{ 
      maxWidth: '100%',
      overflowX: 'hidden'
    }}>

      {/* Mode Selector */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', color: '#aaa', fontWeight: '500' }}>
          Visual Mode
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['geometric', 'psychedelic', 'particles', 'threeD'] as VisualizerMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: currentMode === mode 
                  ? 'linear-gradient(135deg, #0af, #f0a)' 
                  : 'rgba(30, 30, 40, 0.8)',
                color: '#fff',
                border: currentMode === mode ? 'none' : '1px solid rgba(100, 200, 255, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: currentMode === mode ? '600' : '400',
                textTransform: 'capitalize',
                transition: 'all 0.2s',
                boxShadow: currentMode === mode ? '0 4px 12px rgba(0, 170, 255, 0.3)' : 'none',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Geometric Controls */}
      {currentMode === "geometric" && (
        <>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#ccc' }}>
              Morph Speed: <span style={{ color: '#0af', fontWeight: '600' }}>{geometricMorphSpeed.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={geometricMorphSpeed}
              onChange={(e) => setGeometricMorphSpeed(parseFloat(e.target.value))}
              style={{ 
                width: '100%',
                accentColor: '#0af',
                cursor: 'pointer'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Polygon Complexity: {geometricPolygonComplexity}
            </label>
            <input
              type="range"
              min="3"
              max="12"
              step="1"
              value={geometricPolygonComplexity}
              onChange={(e) => setGeometricPolygonComplexity(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Rotation Speed: {geometricRotationSpeed.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={geometricRotationSpeed}
              onChange={(e) => setGeometricRotationSpeed(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </>
      )}

      {/* Psychedelic Controls */}
      {currentMode === "psychedelic" && (
        <>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              Shader Variant
            </label>
            <select
              value={shaderVariant}
              onChange={(e) => setShaderVariant(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(20, 20, 30, 0.9)',
                color: '#fff',
                border: '1px solid rgba(100, 200, 255, 0.3)',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="0">Fractal Zoom</option>
              <option value="1">Kaleidoscope</option>
              <option value="2">Vortex Tunnel</option>
              <option value="3">Plasma</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Intensity: {shaderIntensity.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={shaderIntensity}
              onChange={(e) => setShaderIntensity(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </>
      )}

      {/* Particle Controls */}
      {currentMode === "particles" && (
        <>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              Particle Behavior
            </label>
            <select
              value={particleMode}
              onChange={(e) => setParticleMode(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                background: '#222',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
              }}
            >
              <option value="0">Energy Nebula</option>
              <option value="1">Beat-Explosion Fireworks</option>
              <option value="2">Vortex Swarm</option>
              <option value="3">Flowing Liquid</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Particle Count: {particleCount}
            </label>
            <input
              type="range"
              min="1000"
              max="50000"
              step="1000"
              value={particleCount}
              onChange={(e) => setParticleCount(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Turbulence: {particleTurbulence.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={particleTurbulence}
              onChange={(e) => setParticleTurbulence(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Gravity: {particleGravity.toFixed(2)}
            </label>
            <input
              type="range"
              min="-0.5"
              max="0.5"
              step="0.01"
              value={particleGravity}
              onChange={(e) => setParticleGravity(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </>
      )}

      {/* 3D Controls */}
      {currentMode === "threeD" && (
        <>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#ccc' }}>
              Shape
            </label>
            <select
              value={threeDShape}
              onChange={(e) => setThreeDShape(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                background: 'rgba(20, 20, 30, 0.9)',
                color: '#fff',
                border: '1px solid rgba(100, 200, 255, 0.3)',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              <option value="sphere">Sphere</option>
              <option value="torus">Torus</option>
              <option value="cube">Cube</option>
              <option value="knot">Knot</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#ccc' }}>
              Morph Speed: <span style={{ color: '#0af' }}>{threeDMorphSpeed.toFixed(3)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.001"
              value={threeDMorphSpeed}
              onChange={(e) => setThreeDMorphSpeed(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#ccc' }}>
              Camera Speed: <span style={{ color: '#0af' }}>{threeDCameraSpeed.toFixed(4)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="0.01"
              step="0.0001"
              value={threeDCameraSpeed}
              onChange={(e) => setThreeDCameraSpeed(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </>
      )}
    </div>
  );
};


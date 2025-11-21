import React from 'react';
import { QualityLevel } from '../visualizers/VisualizerQualityManager';

interface QualityIndicatorProps {
  level: QualityLevel;
  onOverride?: (level: QualityLevel | null) => void;
}

export const QualityIndicator: React.FC<QualityIndicatorProps> = ({ level, onOverride }) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [override, setOverride] = React.useState<QualityLevel | null>(null);

  const levelColors: Record<QualityLevel, string> = {
    high: '#0f0',
    medium: '#ff0',
    low: '#f00',
  };

  const levelLabels: Record<QualityLevel, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  const handleOverride = (newLevel: QualityLevel | null) => {
    setOverride(newLevel);
    if (onOverride) {
      onOverride(newLevel);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 1003,
        background: 'rgba(10, 10, 20, 0.9)',
        backdropFilter: 'blur(10px)',
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid rgba(100, 200, 255, 0.2)',
        fontSize: '11px',
        color: '#fff',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={() => setShowAdvanced(!showAdvanced)}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(100, 200, 255, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(100, 200, 255, 0.2)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: levelColors[level],
            boxShadow: `0 0 8px ${levelColors[level]}`,
          }}
        />
        <span>Quality: {levelLabels[level]}</span>
        {override && <span style={{ color: '#888', fontSize: '10px' }}>(Manual)</span>}
      </div>
      
      {showAdvanced && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            background: 'rgba(10, 10, 20, 0.98)',
            backdropFilter: 'blur(10px)',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid rgba(100, 200, 255, 0.3)',
            minWidth: '180px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: '600' }}>
            Quality Override
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(['high', 'medium', 'low'] as QualityLevel[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => handleOverride(lvl === level && !override ? null : lvl)}
                style={{
                  padding: '6px 12px',
                  background: override === lvl || (lvl === level && !override)
                    ? 'rgba(100, 200, 255, 0.2)'
                    : 'rgba(20, 20, 30, 0.9)',
                  color: '#fff',
                  border: `1px solid ${lvl === level ? levelColors[lvl] : 'rgba(100, 200, 255, 0.3)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: levelColors[lvl],
                  }}
                />
                {levelLabels[lvl]}
                {lvl === level && !override && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#888' }}>Auto</span>}
              </button>
            ))}
            <button
              onClick={() => handleOverride(null)}
              style={{
                marginTop: '4px',
                padding: '6px 12px',
                background: 'rgba(20, 20, 30, 0.9)',
                color: '#fff',
                border: '1px solid rgba(100, 200, 255, 0.3)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Reset to Auto
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


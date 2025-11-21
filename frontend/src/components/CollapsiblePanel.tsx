import React, { useState, ReactNode, useEffect } from 'react';

interface CollapsiblePanelProps {
  title: string;
  icon?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-center';
  width?: string;
  maxHeight?: string;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  icon,
  defaultExpanded = false,
  children,
  position = 'top-left',
  width = '360px',
  maxHeight = '80vh',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getPositionStyles = (): Record<string, React.CSSProperties> => {
    if (isMobile) {
      // Mobile: Use full width and stack to prevent overlap
      const baseStyle = {
        left: '10px',
        right: '10px',
        width: 'calc(100vw - 20px)',
      };
      
      return {
        'top-left': { ...baseStyle, top: '10px', zIndex: 1002 },
        'top-right': { ...baseStyle, top: '70px', zIndex: 1001 }, // Offset below top-left
        'bottom-left': { ...baseStyle, bottom: '10px', zIndex: 1002 },
        'bottom-right': { ...baseStyle, bottom: '70px', zIndex: 1001 }, // Offset above bottom-left
        'bottom-center': { ...baseStyle, bottom: '130px', transform: 'none', zIndex: 1000 }, // Further offset
      };
    }
    // Desktop: Original positioning with proper z-index
    return {
      'top-left': { top: '20px', left: '20px', zIndex: 1002 },
      'top-right': { top: '20px', right: '20px', zIndex: 1001 },
      'bottom-left': { bottom: '20px', left: '20px', zIndex: 1002 },
      'bottom-right': { bottom: '20px', right: '20px', zIndex: 1001 },
      'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 },
    };
  };

  const positionStyles = getPositionStyles();

  // Responsive width calculation - use position styles width on mobile
  const responsiveWidth = isMobile && positionStyles[position]?.width 
    ? positionStyles[position].width as string
    : (isMobile ? 'calc(100vw - 20px)' : width);

  // Calculate z-index based on position to prevent overlap
  const getZIndex = () => {
    if (isMobile) {
      // On mobile, use position-based z-index
      const zIndexMap: Record<string, number> = {
        'top-left': 1002,
        'top-right': 1001,
        'bottom-left': 1002,
        'bottom-right': 1001,
        'bottom-center': 1000,
      };
      return zIndexMap[position] || 1000;
    }
    return 1000;
  };

  return (
    <div
      className={`collapsible-panel ${position} ${isExpanded ? 'expanded' : ''}`}
      style={{
        position: 'fixed',
        ...positionStyles[position],
        zIndex: positionStyles[position]?.zIndex || getZIndex(),
        width: responsiveWidth,
        maxWidth: isMobile ? 'calc(100vw - 20px)' : 'calc(100vw - 40px)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'auto',
      }}
    >
      {/* Collapsed Header */}
      <div
        className="collapsible-panel-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: 'linear-gradient(135deg, rgba(10, 10, 20, 0.95), rgba(5, 5, 15, 0.95))',
          backdropFilter: 'blur(10px)',
          padding: '12px 16px',
          borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
          border: '1px solid rgba(100, 200, 255, 0.2)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(100, 200, 255, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(100, 200, 255, 0.2)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {icon && <span style={{ fontSize: '18px' }}>{icon}</span>}
          <h3
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: '600',
              background: 'linear-gradient(90deg, #0af, #f0a)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {title}
          </h3>
        </div>
        <span
          style={{
            fontSize: '12px',
            color: '#888',
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▼
        </span>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          className="collapsible-panel-content"
          style={{
            background: 'linear-gradient(135deg, rgba(10, 10, 20, 0.98), rgba(5, 5, 15, 0.98))',
            backdropFilter: 'blur(10px)',
            padding: '20px',
            borderRadius: '0 0 12px 12px',
            border: '1px solid rgba(100, 200, 255, 0.2)',
            borderTop: 'none',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            maxHeight,
            overflowY: 'auto',
            animation: 'slideDown 0.3s ease-out',
          }}
        >
          <style>{`
            @keyframes slideDown {
              from {
                opacity: 0;
                transform: translateY(-10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
          {children}
        </div>
      )}
    </div>
  );
};

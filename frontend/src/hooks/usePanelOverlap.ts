import { useState } from 'react';

interface PanelState {
  id: string;
  position: string;
  isExpanded: boolean;
  height: number;
}

/**
 * Hook to manage panel overlap prevention on mobile
 */
export const usePanelOverlap = () => {
  const [panelStates, setPanelStates] = useState<Map<string, PanelState>>(new Map());

  const registerPanel = (id: string, position: string, isExpanded: boolean, height: number) => {
    setPanelStates(prev => {
      const next = new Map(prev);
      next.set(id, { id, position, isExpanded, height });
      return next;
    });
  };

  const getAdjustedPosition = (position: string, panelId: string): React.CSSProperties => {
    if (window.innerWidth >= 768) {
      // Desktop: use original positions
      return {};
    }

    // Mobile: calculate adjusted positions to prevent overlap
    const topPanels = Array.from(panelStates.values()).filter(
      p => p.position.startsWith('top') && p.isExpanded && p.id !== panelId
    );
    const bottomPanels = Array.from(panelStates.values()).filter(
      p => p.position.startsWith('bottom') && p.isExpanded && p.id !== panelId
    );

    let offset = 0;
    if (position === 'top-right' && topPanels.some(p => p.position === 'top-left')) {
      const topLeftPanel = topPanels.find(p => p.position === 'top-left');
      offset = topLeftPanel ? topLeftPanel.height + 10 : 0;
    }

    if (position === 'bottom-right' && bottomPanels.some(p => p.position === 'bottom-left')) {
      const bottomLeftPanel = bottomPanels.find(p => p.position === 'bottom-left');
      offset = bottomLeftPanel ? bottomLeftPanel.height + 10 : 0;
    }

    if (position === 'bottom-center') {
      const leftBottom = bottomPanels.find(p => p.position === 'bottom-left');
      const rightBottom = bottomPanels.find(p => p.position === 'bottom-right');
      const maxHeight = Math.max(
        leftBottom?.height || 0,
        rightBottom?.height || 0
      );
      offset = maxHeight > 0 ? maxHeight + 10 : 0;
    }

    return offset > 0 ? { marginTop: `${offset}px` } : {};
  };

  return { registerPanel, getAdjustedPosition };
};


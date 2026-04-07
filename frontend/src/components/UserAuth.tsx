import React from 'react';

interface UserAuthProps {
  onLogin?: () => void;
  onLogout?: () => void;
}

/**
 * Placeholder for future OAuth implementation.
 * The previous fake auth (localStorage passwords) has been removed for security.
 */
export const UserAuth: React.FC<UserAuthProps> = () => {
  return (
    <div style={{
      padding: '12px',
      background: 'rgba(100, 200, 255, 0.05)',
      borderRadius: '8px',
      border: '1px solid rgba(100, 200, 255, 0.15)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '4px' }}>
        Authentication coming soon
      </div>
      <div style={{ fontSize: '11px', color: '#666' }}>
        Google & GitHub OAuth
      </div>
    </div>
  );
};

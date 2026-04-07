/**
 * FE-006: Account settings panel with right-to-deletion support.
 */
import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL as string ?? 'http://localhost:8000';

interface AccountSettingsProps {
  userEmail: string;
  onDeleted: () => void;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({ userEmail, onDeleted }) => {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Deletion failed.');
      }
      localStorage.removeItem('access_token');
      onDeleted();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Deletion failed.');
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  const panelStyle: React.CSSProperties = {
    padding: '16px',
    background: 'rgba(20, 20, 30, 0.97)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#ddd',
    fontSize: '13px',
    minWidth: '220px',
  };

  const dangerBtn: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '8px',
    background: confirming ? 'rgba(220,40,40,0.25)' : 'rgba(255,60,60,0.1)',
    border: `1px solid ${confirming ? 'rgba(220,40,40,0.6)' : 'rgba(255,60,60,0.3)'}`,
    borderRadius: '6px',
    color: '#ff6b6b',
    cursor: deleting ? 'not-allowed' : 'pointer',
    fontSize: '12px',
    marginTop: '12px',
    transition: 'all 0.15s',
  };

  return (
    <div style={panelStyle}>
      <div style={{ marginBottom: '12px', fontWeight: 600, color: '#aaa', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Account Settings
      </div>

      <div style={{ color: '#888', wordBreak: 'break-all', marginBottom: '4px' }}>
        {userEmail}
      </div>

      {!confirming ? (
        <button style={dangerBtn} onClick={() => setConfirming(true)}>
          Delete Account
        </button>
      ) : (
        <div style={{ marginTop: '12px' }}>
          <div style={{ color: '#ff9999', fontSize: '12px', marginBottom: '10px' }}>
            This permanently deletes your account and all your data. This cannot be undone.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              style={{
                flex: 1,
                padding: '7px',
                background: 'rgba(200,30,30,0.4)',
                border: '1px solid rgba(200,30,30,0.7)',
                borderRadius: '6px',
                color: '#fff',
                cursor: deleting ? 'not-allowed' : 'pointer',
                fontSize: '12px',
              }}
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{
                flex: 1,
                padding: '7px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '8px', color: '#ff6b6b', fontSize: '11px' }}>
          {error}
        </div>
      )}
    </div>
  );
};

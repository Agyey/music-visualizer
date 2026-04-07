import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL as string ?? 'http://localhost:8000';

interface AuthUser {
  user_id: string;
  email: string;
}

interface UserAuthProps {
  onLogin?: (user: AuthUser) => void;
  onLogout?: () => void;
}

function getStoredToken(): string | null {
  return localStorage.getItem('access_token');
}

function storeToken(token: string): void {
  localStorage.setItem('access_token', token);
}

function clearToken(): void {
  localStorage.removeItem('access_token');
}

export const UserAuth: React.FC<UserAuthProps> = ({ onLogin, onLogout }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (token: string): Promise<AuthUser | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return await res.json() as AuthUser;
    } catch {
      return null;
    }
  }, []);

  // On mount: check for token in URL (callback) or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth');

    const run = async () => {
      // After OAuth callback the backend sets access_token cookie;
      // try to refresh immediately to get a fresh JWT in localStorage.
      if (authStatus === 'success') {
        // Clear the query param without reloading
        window.history.replaceState({}, '', window.location.pathname);
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          storeToken(refreshed);
          const me = await fetchMe(refreshed);
          if (me) {
            setUser(me);
            onLogin?.(me);
          }
          setLoading(false);
          return;
        }
      }

      const token = getStoredToken();
      if (token) {
        const me = await fetchMe(token);
        if (me) {
          setUser(me);
        } else {
          // Token expired — try silent refresh
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            storeToken(refreshed);
            const me2 = await fetchMe(refreshed);
            if (me2) setUser(me2);
          } else {
            clearToken();
          }
        }
      }
      setLoading(false);
    };

    run();
  }, [fetchMe, onLogin]);

  const refreshAccessToken = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.access_token ?? null;
    } catch {
      return null;
    }
  };

  const handleLogin = (provider: 'google' | 'github') => {
    window.location.href = `${API_BASE}/auth/login/${provider}`;
  };

  const handleLogout = async () => {
    clearToken();
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch { /* best-effort */ }
    setUser(null);
    onLogout?.();
  };

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    color: '#ddd',
    fontSize: '13px',
    cursor: 'pointer',
    width: '100%',
    justifyContent: 'center',
    transition: 'background 0.15s',
  };

  if (loading) {
    return (
      <div style={{ padding: '12px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
        Loading…
      </div>
    );
  }

  if (user) {
    return (
      <div style={{ padding: '10px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px', wordBreak: 'break-all' }}>
          {user.email || user.user_id.slice(0, 12) + '…'}
        </div>
        <button style={{ ...btnBase, fontSize: '12px', padding: '6px 10px' }} onClick={handleLogout}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button style={btnBase} onClick={() => handleLogin('google')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>
      <button style={btnBase} onClick={() => handleLogin('github')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
        Continue with GitHub
      </button>
    </div>
  );
};

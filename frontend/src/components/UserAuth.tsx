import React, { useState } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
}

interface UserAuthProps {
  onLogin?: (user: User) => void;
  onLogout?: () => void;
  currentUser: User | null;
}

export const UserAuth: React.FC<UserAuthProps> = ({ onLogin, onLogout, currentUser }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For now, using localStorage for simple auth (can be extended with backend)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Simulate API call (replace with actual backend auth)
    setTimeout(() => {
      if (isLogin) {
        // Login
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          if (user.email === email) {
            if (onLogin) onLogin(user);
            setLoading(false);
            return;
          }
        }
        setError('Invalid credentials');
      } else {
        // Sign up
        const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          email,
          name: name || email.split('@')[0],
        };
        localStorage.setItem('user', JSON.stringify(newUser));
        if (onLogin) onLogin(newUser);
      }
      setLoading(false);
    }, 500);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    if (onLogout) onLogout();
  };

  if (currentUser) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '12px', color: '#ccc' }}>
          <div style={{ fontWeight: '600' }}>{currentUser.name}</div>
          <div style={{ fontSize: '11px', color: '#888' }}>{currentUser.email}</div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '6px 12px',
            background: 'rgba(255, 68, 68, 0.2)',
            color: '#ff4444',
            border: '1px solid rgba(255, 68, 68, 0.3)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '1px solid rgba(100, 200, 255, 0.2)' }}>
        <button
          type="button"
          onClick={() => setIsLogin(true)}
          style={{
            flex: 1,
            padding: '6px',
            background: isLogin ? 'rgba(100, 200, 255, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: isLogin ? '2px solid #0af' : '2px solid transparent',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setIsLogin(false)}
          style={{
            flex: 1,
            padding: '6px',
            background: !isLogin ? 'rgba(100, 200, 255, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: !isLogin ? '2px solid #0af' : '2px solid transparent',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          Sign Up
        </button>
      </div>

      {!isLogin && (
        <input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '8px',
            background: 'rgba(20, 20, 30, 0.9)',
            color: '#fff',
            border: '1px solid rgba(100, 200, 255, 0.3)',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        />
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={{
          width: '100%',
          padding: '8px',
          marginBottom: '8px',
          background: 'rgba(20, 20, 30, 0.9)',
          color: '#fff',
          border: '1px solid rgba(100, 200, 255, 0.3)',
          borderRadius: '6px',
          fontSize: '12px',
        }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        style={{
          width: '100%',
          padding: '8px',
          marginBottom: '12px',
          background: 'rgba(20, 20, 30, 0.9)',
          color: '#fff',
          border: '1px solid rgba(100, 200, 255, 0.3)',
          borderRadius: '6px',
          fontSize: '12px',
        }}
      />

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px',
          background: loading
            ? 'rgba(85, 85, 85, 0.6)'
            : 'linear-gradient(135deg, #0a8, #08a)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: '600',
        }}
      >
        {loading ? '...' : isLogin ? 'Login' : 'Sign Up'}
      </button>

      {error && (
        <div
          style={{
            marginTop: '8px',
            color: '#ff4444',
            fontSize: '11px',
            padding: '6px',
            background: 'rgba(255, 68, 68, 0.1)',
            borderRadius: '4px',
            border: '1px solid rgba(255, 68, 68, 0.3)',
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
};


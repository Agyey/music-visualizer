import { UserAuth } from './UserAuth';
import { UploadHistory } from './UploadHistory';
import { ExtendedAudioAnalysisResponse } from '../types/timeline';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AccountManagerProps {
  user: User | null;
  setUser: (user: User | null) => void;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  onSelectFromHistory: (id: string, analysis: ExtendedAudioAnalysisResponse) => void;
}

export function AccountManager({
  user,
  setUser,
  showHistory,
  setShowHistory,
  onSelectFromHistory
}: AccountManagerProps) {
  return (
    <>
      <UserAuth
        currentUser={user}
        onLogin={(u) => setUser(u)}
        onLogout={() => setUser(null)}
      />
      
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(100, 200, 255, 0.2)' }}>
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            width: '100%',
            padding: '10px',
            background: showHistory
              ? 'rgba(100, 200, 255, 0.2)'
              : 'rgba(20, 20, 30, 0.9)',
            color: '#fff',
            border: '1px solid rgba(100, 200, 255, 0.3)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          {showHistory ? '📚 Hide History' : '📚 View History'}
        </button>
      </div>

      {showHistory && (
        <div style={{ marginTop: '16px' }}>
          <UploadHistory
            onSelectUpload={onSelectFromHistory}
            currentUser={user}
          />
        </div>
      )}
    </>
  );
}

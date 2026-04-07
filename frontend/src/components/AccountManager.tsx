import { UserAuth } from './UserAuth';
import { UploadHistory } from './UploadHistory';
import { ExtendedAudioAnalysisResponse } from '../types/timeline';

interface AccountManagerProps {
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  onSelectFromHistory: (id: string, analysis: ExtendedAudioAnalysisResponse) => void;
}

export function AccountManager({
  showHistory,
  setShowHistory,
  onSelectFromHistory
}: AccountManagerProps) {
  return (
    <>
      <UserAuth />

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
          {showHistory ? 'Hide History' : 'View History'}
        </button>
      </div>

      {showHistory && (
        <div style={{ marginTop: '16px' }}>
          <UploadHistory
            onSelectUpload={onSelectFromHistory}
            currentUser={null}
          />
        </div>
      )}
    </>
  );
}

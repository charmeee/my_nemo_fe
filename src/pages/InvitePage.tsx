import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { albumsApi } from '../api/albums';
import { useAuthStore } from '../store/authStore';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [info, setInfo] = useState<{ albumName: string; inviterNickname: string } | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) return;
    albumsApi.getInviteInfo(token).then(setInfo).catch(() => setError('유효하지 않은 초대 링크입니다.'));
  }, [token]);

  const handleJoin = async () => {
    if (!accessToken) {
      sessionStorage.setItem('pendingInvite', token!);
      navigate('/login');
      return;
    }
    setJoining(true);
    try {
      await albumsApi.joinByInvite(token!);
      navigate('/albums');
    } catch {
      setError('앨범 참여에 실패했습니다.');
    } finally {
      setJoining(false);
    }
  };

  if (error) return <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>{error}</div>;
  if (!info) return <div style={{ padding: '2rem', textAlign: 'center' }}>초대 링크 확인 중...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
      <h2>{info.albumName}</h2>
      <p style={{ color: '#666' }}>{info.inviterNickname}님이 앨범에 초대했습니다.</p>
      <button onClick={handleJoin} disabled={joining} style={{ padding: '12px 24px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}>
        {joining ? '참여 중...' : '앨범 참여하기'}
      </button>
    </div>
  );
}

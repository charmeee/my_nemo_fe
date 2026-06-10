import { useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
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
  const [pending, setPending] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

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
      const result = await albumsApi.joinByInvite(token!);
      if (result?.status === 'PENDING') {
        setPending(true);
      } else {
        navigate('/albums');
      }
    } catch {
      setError('앨범 참여에 실패했습니다.');
    } finally {
      setJoining(false);
    }
  };

  // N-CORE-13: 게스트 미리보기 — 비로그인 상태에서 read-only로 앨범 열람
  const handleGuestPreview = async () => {
    if (!token) return;
    setGuestLoading(true);
    try {
      const { guestToken, albumId } = await albumsApi.getGuestSession(token);
      sessionStorage.setItem('guestToken', guestToken);
      sessionStorage.setItem('guestAlbumId', albumId);
      sessionStorage.setItem('guestInviteCode', token);
      sessionStorage.setItem('pendingInvite', token); // 로그인 후 초대 링크로 돌아오기
      navigate(`/albums/${albumId}/guest`);
    } catch {
      setError('게스트 접근에 실패했습니다.');
    } finally {
      setGuestLoading(false);
    }
  };

  if (error) return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF0F5, #F5EEFF)', padding: '24px',
    }}>
      <div style={{ marginBottom: '16px', color: '#FF6B9D' }}><Link2 size={48} /></div>
      <p style={{ color: '#FF6B9D', fontWeight: 600, fontSize: '1rem' }}>{error}</p>
      <button className="nemo-btn nemo-btn-ghost" style={{ marginTop: '20px' }} onClick={() => navigate('/albums')}>
        홈으로 돌아가기
      </button>
    </div>
  );

  if (pending) return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF0F5, #F5EEFF)', padding: '24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1C1017', marginBottom: '8px' }}>
        관리자 승인 대기 중
      </h2>
      <p style={{ color: '#9C8BA6', fontSize: '0.9rem', marginBottom: '24px' }}>
        앨범 관리자가 참여 요청을 승인하면 알림이 발송됩니다.
      </p>
      <button className="nemo-btn nemo-btn-ghost" onClick={() => navigate('/albums')}>
        홈으로 돌아가기
      </button>
    </div>
  );

  if (!info) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF0F5, #F5EEFF)',
    }}>
      <div className="nemo-spinner" style={{ height: 'auto' }}>
        <p style={{ color: '#9C8BA6', fontSize: '0.9rem' }}>초대 링크 확인 중...</p>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF0F5 0%, #F5EEFF 50%, #FFF9F5 100%)',
      padding: '24px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(20px)',
        borderRadius: '28px',
        border: '1px solid rgba(255,107,157,0.12)',
        boxShadow: '0 8px 40px rgba(132,94,247,0.12)',
        padding: '44px 40px',
        maxWidth: '380px',
        width: '100%',
        textAlign: 'center',
        animation: 'nemoFadeIn 0.3s ease',
      }}>
        <div style={{
          width: '72px', height: '72px',
          background: 'linear-gradient(135deg, #FF6B9D, #845EF7)',
          borderRadius: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', margin: '0 auto 20px',
          boxShadow: '0 4px 16px rgba(255,107,157,0.3)',
        }}>📷</div>

        <p style={{ fontSize: '0.85rem', color: '#9C8BA6', marginBottom: '4px' }}>
          {info.inviterNickname}님이 초대했어요
        </p>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1C1017', marginBottom: '8px' }}>
          {info.albumName}
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#9C8BA6', marginBottom: '32px' }}>
          이 앨범에 참여해 추억을 함께 꾸며보세요
        </p>

        <button
          className="nemo-btn nemo-btn-primary"
          onClick={handleJoin}
          disabled={joining}
          style={{ width: '100%', padding: '14px', fontSize: '1rem', borderRadius: '14px' }}
        >
          {joining ? '참여 중...' : accessToken ? '앨범 참여하기' : '로그인 후 참여하기'}
        </button>

        {/* N-CORE-13: 비로그인 사용자에게 게스트 미리보기 제공 */}
        {!accessToken && (
          <button
            className="nemo-btn nemo-btn-ghost"
            onClick={handleGuestPreview}
            disabled={guestLoading}
            style={{ width: '100%', padding: '12px', fontSize: '0.9rem', borderRadius: '14px', marginTop: '10px' }}
          >
            {guestLoading ? '불러오는 중...' : '게스트로 먼저 보기'}
          </button>
        )}
      </div>
    </div>
  );
}

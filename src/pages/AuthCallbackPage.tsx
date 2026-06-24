import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// OAuth 콜백 페이지: 토큰 쿼리를 받아 저장 후 /albums (또는 보류된 초대) 로 이동
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setToken = useAuthStore((s) => s.setToken);
  const handled = useRef(false);

  // StrictMode 이중 실행 가드 (useRef) + sessionStorage의 pendingInvite 우선 처리
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get('token');
    if (token) {
      setToken(token);
      const pendingInvite = sessionStorage.getItem('pendingInvite');
      if (pendingInvite) {
        sessionStorage.removeItem('pendingInvite');
        navigate(`/invite/${pendingInvite}`, { replace: true });
      } else {
        navigate('/albums', { replace: true });
      }
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate, searchParams, setToken]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      로그인 처리 중...
    </div>
  );
}

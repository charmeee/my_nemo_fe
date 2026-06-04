import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setToken = useAuthStore((s) => s.setToken);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get('token');
    if (token) {
      setToken(token);
      navigate('/albums', { replace: true });
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

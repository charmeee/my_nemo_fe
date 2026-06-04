import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      navigate('/albums', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate, setToken]);

  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>로그인 처리 중...</div>;
}

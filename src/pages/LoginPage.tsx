import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #FFF0F5 0%, #F5EEFF 50%, #FFF9F5 100%)',
    padding: '24px',
  } as React.CSSProperties,

  card: {
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(20px)',
    borderRadius: '28px',
    border: '1px solid rgba(255,107,157,0.12)',
    boxShadow: '0 8px 40px rgba(132,94,247,0.12), 0 2px 8px rgba(0,0,0,0.04)',
    padding: '52px 44px',
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    animation: 'nemoFadeIn 0.35s cubic-bezier(0.4,0,0.2,1)',
  } as React.CSSProperties,

  logoWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    marginBottom: '28px',
    gap: '8px',
  } as React.CSSProperties,

  logoIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #FF6B9D, #845EF7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    marginBottom: '4px',
    boxShadow: '0 4px 16px rgba(255,107,157,0.3)',
  } as React.CSSProperties,

  logoText: {
    fontFamily: "'Nunito', sans-serif",
    fontSize: '2rem',
    fontWeight: 900,
    background: 'linear-gradient(135deg, #FF6B9D, #845EF7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-0.03em',
  } as React.CSSProperties,

  tagline: {
    color: '#9C8BA6',
    fontSize: '0.9rem',
    fontWeight: 400,
    letterSpacing: '0.01em',
    marginBottom: '28px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  tabRow: {
    display: 'flex',
    width: '100%',
    background: '#F8F4FC',
    borderRadius: '12px',
    padding: '4px',
    marginBottom: '24px',
    gap: '4px',
  } as React.CSSProperties,

  divider: {
    width: '100%',
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #E8E0EC, transparent)',
    margin: '20px 0',
  } as React.CSSProperties,

  btnKakao: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '14px 20px',
    background: '#FEE500',
    color: '#3C1E1E',
    borderRadius: '14px',
    textDecoration: 'none',
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: 700,
    fontSize: '0.95rem',
    transition: 'all 180ms ease',
    border: 'none',
    cursor: 'pointer',
    marginBottom: '10px',
    boxShadow: '0 2px 8px rgba(254,229,0,0.4)',
  } as React.CSSProperties,

  btnGoogle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '14px 20px',
    background: '#fff',
    color: '#3C3C3C',
    borderRadius: '14px',
    textDecoration: 'none',
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: 700,
    fontSize: '0.95rem',
    transition: 'all 180ms ease',
    border: '1.5px solid #E8E0EC',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  } as React.CSSProperties,

  footer: {
    marginTop: '28px',
    fontSize: '0.75rem',
    color: '#B8AAC0',
    textAlign: 'center' as const,
    lineHeight: 1.6,
  } as React.CSSProperties,
};

type Tab = 'oauth' | 'email';
type EmailMode = 'login' | 'register';

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('oauth');
  const [mode, setMode] = useState<EmailMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setToken = useAuthStore((s) => s.setToken);
  const navigate = useNavigate();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login'
        ? { email, password }
        : { email, password, nickname };
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? '로그인에 실패했습니다.');
        return;
      }
      setToken(json.data.accessToken);
      navigate('/albums', { replace: true });
    } catch {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const tabBtn = (label: string, value: Tab) => (
    <button
      onClick={() => setTab(value)}
      style={{
        flex: 1,
        padding: '8px 0',
        borderRadius: '9px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: '0.85rem',
        transition: 'all 180ms ease',
        background: tab === value ? '#fff' : 'transparent',
        color: tab === value ? '#845EF7' : '#9C8BA6',
        boxShadow: tab === value ? '0 1px 4px rgba(132,94,247,0.15)' : 'none',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>📷</div>
          <div style={styles.logoText}>nemo</div>
        </div>

        <p style={styles.tagline}>함께 찍고, 함께 꾸미고, 함께 간직하세요</p>

        {/* 탭 */}
        <div style={styles.tabRow}>
          {tabBtn('소셜 로그인', 'oauth')}
          {tabBtn('이메일 로그인', 'email')}
        </div>

        {tab === 'oauth' ? (
          <>
            <a
              href={`${API_URL}/oauth2/authorization/kakao`}
              style={styles.btnKakao}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(0.96)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; (e.currentTarget as HTMLElement).style.transform = ''; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E">
                <path d="M12 3C7.03 3 3 6.14 3 10c0 2.5 1.6 4.71 4 6.07L6 20l4.23-2.24C10.8 17.91 11.39 18 12 18c4.97 0 9-3.14 9-7s-4.03-7-9-7z"/>
              </svg>
              카카오로 시작하기
            </a>

            <a
              href={`${API_URL}/oauth2/authorization/google`}
              style={styles.btnGoogle}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8f8f8'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.transform = ''; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 시작하기
            </a>
          </>
        ) : (
          <form onSubmit={handleEmailSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* login / register 토글 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                style={{
                  flex: 1, padding: '8px', border: 'none', borderRadius: '10px', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.85rem',
                  background: mode === 'login' ? 'linear-gradient(135deg,#FF6B9D,#845EF7)' : '#F8F4FC',
                  color: mode === 'login' ? '#fff' : '#9C8BA6',
                  transition: 'all 180ms ease',
                }}
              >로그인</button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                style={{
                  flex: 1, padding: '8px', border: 'none', borderRadius: '10px', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.85rem',
                  background: mode === 'register' ? 'linear-gradient(135deg,#FF6B9D,#845EF7)' : '#F8F4FC',
                  color: mode === 'register' ? '#fff' : '#9C8BA6',
                  transition: 'all 180ms ease',
                }}
              >회원가입</button>
            </div>

            <input
              className="nemo-input"
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              className="nemo-input"
              type="password"
              placeholder="비밀번호 (8자 이상)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && (
              <input
                className="nemo-input"
                type="text"
                placeholder="닉네임"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
              />
            )}

            {error && (
              <p style={{ color: '#FF6B9D', fontSize: '0.82rem', fontWeight: 600, textAlign: 'center', margin: 0 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="nemo-btn nemo-btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '14px', fontSize: '0.95rem', borderRadius: '14px', marginTop: '4px' }}
            >
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
            </button>
          </form>
        )}

        <p style={styles.footer}>
          로그인 시 서비스 이용약관 및 개인정보처리방침에<br />동의하는 것으로 간주합니다.
        </p>
      </div>
    </div>
  );
}

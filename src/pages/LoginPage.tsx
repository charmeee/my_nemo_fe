const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export default function LoginPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>NEMO</h1>
      <p style={{ color: '#666' }}>소중한 추억을 함께 그려보세요</p>
      <a
        href={`${API_URL}/oauth2/authorization/kakao`}
        style={{
          display: 'block',
          padding: '12px 24px',
          background: '#FEE500',
          color: '#000',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '1rem',
        }}
      >
        카카오로 시작하기
      </a>
      <a
        href={`${API_URL}/oauth2/authorization/google`}
        style={{
          display: 'block',
          padding: '12px 24px',
          background: '#fff',
          color: '#333',
          border: '1px solid #ccc',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '1rem',
        }}
      >
        Google로 시작하기
      </a>
    </div>
  );
}

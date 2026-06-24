import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// 인증 필요 라우트 가드: Zustand persist 하이드레이션 완료 후 token 검사
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  if (!hasHydrated) return <div className="nemo-spinner" />; // 하이드레이션 완료 전 스피너

  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

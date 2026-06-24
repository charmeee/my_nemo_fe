import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const AlbumListPage = lazy(() => import('./pages/AlbumListPage'));
const AlbumEditorPage = lazy(() => import('./pages/AlbumEditorPage'));
const InvitePage = lazy(() => import('./pages/InvitePage'));
const TrashPage = lazy(() => import('./pages/TrashPage'));

// 라우트 lazy 로딩 중 표시할 스피너
function RouteFallback() {
  return <div className="nemo-spinner" />;
}

// 앱 라우팅 정의 (로그인/콜백/앨범/에디터/초대/휴지통)
export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/albums" element={<ProtectedRoute><AlbumListPage /></ProtectedRoute>} />
        <Route path="/albums/:albumId" element={<ProtectedRoute><AlbumEditorPage /></ProtectedRoute>} />
        {/* N-CORE-13: 게스트 에디터 (읽기 전용, 비인증) */}
        <Route path="/albums/:albumId/guest" element={<AlbumEditorPage />} />
        <Route path="/trash" element={<ProtectedRoute><TrashPage /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/albums" replace />} />
      </Routes>
    </Suspense>
  );
}

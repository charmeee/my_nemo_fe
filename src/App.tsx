import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import AlbumListPage from './pages/AlbumListPage';
import AlbumEditorPage from './pages/AlbumEditorPage';
import InvitePage from './pages/InvitePage';
import TrashPage from './pages/TrashPage';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="/albums" element={<ProtectedRoute><AlbumListPage /></ProtectedRoute>} />
      <Route path="/albums/:albumId" element={<ProtectedRoute><AlbumEditorPage /></ProtectedRoute>} />
      <Route path="/trash" element={<ProtectedRoute><TrashPage /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/albums" replace />} />
    </Routes>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notificationsApi, notifLabel, type NotificationItem } from '../api/notifications';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

// 알림 종 컴포넌트: SSE 실시간 수신 + 안읽음 카운트 뱃지 + 패널
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);

  const { data: count = 0 } = useQuery({
    queryKey: ['notif-count'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 30_000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getAll,
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notif-count'] });
    },
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notif-count'] });
    },
  });

  // SSE 연결 — 서버 알림 실시간 수신
  useEffect(() => {
    if (!token) return;
    const url = `${API_URL}/notifications/stream`;
    const es = new EventSource(url + `?token=${token}`);
    es.addEventListener('notification', () => {
      queryClient.invalidateQueries({ queryKey: ['notif-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => es.close();
  }, [token, queryClient]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px',
          borderRadius: '10px',
          fontSize: '1.3rem',
          lineHeight: 1,
          transition: 'background 150ms',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F0EBFF'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
        title="알림"
        aria-label={count > 0 ? `알림 ${count}개` : '알림'}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell size={20} aria-hidden="true" />
        {count > 0 && (
          <span style={{
            position: 'absolute', top: '2px', right: '2px',
            background: '#FF6B9D', color: '#fff',
            fontSize: '0.6rem', fontWeight: 700,
            borderRadius: '50%', minWidth: '16px', height: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 2px',
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: '320px', maxHeight: '420px',
          background: '#fff', borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(28,16,23,0.15)',
          border: '1px solid #F0E8F0',
          overflow: 'hidden',
          zIndex: 500,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid #F5EFF5',
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1C1017' }}>알림</span>
            {count > 0 && (
              <button
                onClick={() => markAll.mutate()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#845EF7', fontWeight: 600 }}
              >
                모두 읽음
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#B8AAC0', fontSize: '0.85rem' }}>
                새 알림이 없습니다
              </div>
            ) : (
              notifications.map((n) => (
                <NotifRow key={n.id} n={n} onRead={() => !n.isRead && markRead.mutate(n.id)} onClose={() => setOpen(false)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 알림 한 줄 (클릭 시 읽음 처리 + 해당 앨범 이동)
function NotifRow({ n, onRead, onClose }: { n: NotificationItem; onRead: () => void; onClose: () => void }) {
  const navigate = useNavigate();
  const albumId = n.payload?.albumId as string | undefined;

  // 읽음 처리 후 앨범 ID가 있으면 해당 앨범으로 이동
  const handleClick = () => {
    onRead();
    if (albumId) {
      onClose();
      navigate(`/albums/${albumId}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid #FAF5FA',
        cursor: 'pointer',
        background: n.isRead ? 'transparent' : '#FFF9FC',
        display: 'flex', gap: '10px', alignItems: 'flex-start',
      }}
    >
      {!n.isRead && (
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF6B9D', marginTop: '5px', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: n.isRead ? 400 : 600, color: '#1C1017' }}>
          {notifLabel(n.type)}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#B8AAC0', marginTop: '2px' }}>
          {new Date(n.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

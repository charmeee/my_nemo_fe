import api from './client';

export interface NotificationItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  getAll: () =>
    api.get<{ data: NotificationItem[] }>('/notifications').then((r) => r.data.data),

  getUnreadCount: () =>
    api.get<{ data: number }>('/notifications/unread-count').then((r) => r.data.data),

  markRead: (id: string) => api.patch(`/notifications/${id}/read`),

  markAllRead: () => api.patch('/notifications/read-all'),
};

const NOTIF_LABEL: Record<string, string> = {
  NEW_MEMBER_JOINED: '새 멤버가 참여했습니다',
  JOIN_REQUEST: '참여 요청이 있습니다',
  JOIN_APPROVED: '참여 요청이 승인됐습니다',
  JOIN_REJECTED: '참여 요청이 거절됐습니다',
  NEW_PAGE_ADDED: '새 페이지가 추가됐습니다',
  ALBUM_UPDATED: '앨범 정보가 변경됐습니다',
  MEMBER_LEFT: '멤버가 앨범을 나갔습니다',
  ROLE_CHANGED: '역할이 변경됐습니다',
  ALBUM_LOCKED: '앨범이 잠금됐습니다',
  ALBUM_UNLOCKED: '앨범 잠금이 해제됐습니다',
  ALBUM_INVITATION: '앨범에 초대됐습니다',
};

export function notifLabel(type: string): string {
  return NOTIF_LABEL[type] ?? type;
}

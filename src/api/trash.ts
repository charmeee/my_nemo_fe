import api from './client';

export interface TrashItem {
  id: string;
  type: 'ALBUM' | 'PAGE';
  referenceId: string;
  expiresAt: string;
  createdAt: string;
}

// 휴지통 목록/복원/영구삭제 API
export const trashApi = {
  getAll: () =>
    api.get<{ data: TrashItem[] }>('/trash').then((r) => r.data.data),

  restore: (id: string) => api.post(`/trash/${id}/restore`),

  permanentDelete: (id: string) => api.delete(`/trash/${id}`),
};

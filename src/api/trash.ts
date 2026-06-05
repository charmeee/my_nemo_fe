import api from './client';

export interface TrashItem {
  id: string;
  type: 'ALBUM' | 'PAGE';
  referenceId: string;
  expiresAt: string;
  createdAt: string;
}

export const trashApi = {
  getAll: () =>
    api.get<{ data: TrashItem[] }>('/trash').then((r) => r.data.data),

  restore: (id: string) => api.post(`/trash/${id}/restore`),

  permanentDelete: (id: string) => api.delete(`/trash/${id}`),
};

import api from './client';

export interface Album {
  id: string;
  name: string;
  coverImage?: string;
  memberCount: number;
  isLocked: boolean;
  createdAt: string;
}

export interface AlbumMember {
  userId: string;
  nickname: string;
  profileImage?: string;
  role: string;
}

export const albumsApi = {
  list: () => api.get<{ data: Album[] }>('/albums').then((r) => r.data.data),

  create: (name: string, coverImage?: string) =>
    api.post<{ data: Album }>('/albums', { name, coverImage }).then((r) => r.data.data),

  get: (id: string) =>
    api.get<{ data: Album }>(`/albums/${id}`).then((r) => r.data.data),

  update: (id: string, name: string) =>
    api.put(`/albums/${id}`, { name }),

  delete: (id: string) =>
    api.delete(`/albums/${id}`),

  getMembers: (id: string) =>
    api.get<{ data: AlbumMember[] }>(`/albums/${id}/members`).then((r) => r.data.data),

  removeMember: (albumId: string, userId: string) =>
    api.delete(`/albums/${albumId}/members/${userId}`),

  leave: (id: string) =>
    api.post(`/albums/${id}/leave`),

  generateInviteLink: (id: string) =>
    api.post<{ data: { token: string; expiresAt: string } }>(`/invite?albumId=${id}`).then((r) => r.data.data),

  getInviteInfo: (token: string) =>
    api.get<{ data: { albumName: string; inviterNickname: string } }>(`/invite/${token}/info`).then((r) => r.data.data),

  joinByInvite: (token: string) =>
    api.post(`/invite/${token}/join`),
};

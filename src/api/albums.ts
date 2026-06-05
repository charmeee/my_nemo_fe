import api from './client';

export interface Album {
  id: string;
  name: string;
  coverImage?: string;
  memberCount: number;
  isLocked: boolean;
  createdAt: string;
  myRole?: string;
}

export interface AlbumMember {
  id: string;
  userId: string;
  nickname: string;
  profileImage?: string;
  role: string;
  status: string;
  joinedAt?: string;
}

export interface InviteLink {
  id: string;
  code: string;
  role: string;
  approvalRequired: boolean;
  isActive: boolean;
}

export interface AlbumListResponse {
  owned: Album[];
  joined: Album[];
}

export const albumsApi = {
  list: () => api.get<{ data: AlbumListResponse }>('/albums').then((r) => r.data.data),

  create: (name: string, coverImage?: string) =>
    api.post<{ data: Album }>('/albums', { name, coverImage }).then((r) => r.data.data),

  get: (id: string) =>
    api.get<{ data: Album }>(`/albums/${id}`).then((r) => r.data.data),

  delete: (id: string) =>
    api.delete(`/albums/${id}`),

  update: (id: string, body: { name?: string; isLocked?: boolean; coverImage?: string }) =>
    api.patch<{ data: Album }>(`/albums/${id}`, body).then((r) => r.data.data),

  getMembers: (id: string) =>
    api.get<{ data: AlbumMember[] }>(`/albums/${id}/members`).then((r) => r.data.data),

  getPendingMembers: (id: string) =>
    api.get<{ data: AlbumMember[] }>(`/albums/${id}/members?status=pending`).then((r) => r.data.data),

  changeRole: (albumId: string, targetUserId: string, role: string) =>
    api.patch(`/albums/${albumId}/members/${targetUserId}`, { role }),

  kickMember: (albumId: string, targetUserId: string) =>
    api.delete(`/albums/${albumId}/members/${targetUserId}`),

  approveMember: (albumId: string, targetUserId: string) =>
    api.post(`/albums/${albumId}/members/${targetUserId}/approve`),

  rejectMember: (albumId: string, targetUserId: string) =>
    api.post(`/albums/${albumId}/members/${targetUserId}/reject`),

  leave: (id: string) =>
    api.delete(`/albums/${id}/members/me`),

  getInviteLinks: (id: string) =>
    api.get<{ data: InviteLink[] }>(`/albums/${id}/invite`).then((r) => r.data.data),

  createInviteLink: (id: string, role = 'EDITOR', approvalRequired = false) =>
    api.post<{ data: InviteLink }>(`/albums/${id}/invite`, { role, approvalRequired }).then((r) => r.data.data),

  reissueInviteLink: (id: string) =>
    api.post<{ data: InviteLink }>(`/albums/${id}/invite/reissue`).then((r) => r.data.data),

  toggleInviteLink: (albumId: string, linkId: string, active: boolean) =>
    api.patch(`/albums/${albumId}/invite/${linkId}?active=${active}`),

  getInviteInfo: (token: string) =>
    api.get<{ data: { albumName: string; inviterNickname: string } }>(`/invite/${token}/info`).then((r) => r.data.data),

  joinByInvite: (token: string) =>
    api.post(`/invite/${token}/join`),
};

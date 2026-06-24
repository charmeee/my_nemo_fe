import api from './client';

export interface ImageItem {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl?: string;
  size: number;
  uploadedAt: string;
}

// 앨범 이미지 업로드/조회/삭제 API
export const imagesApi = {
  list: (albumId: string) =>
    api.get<{ data: ImageItem[] }>(`/albums/${albumId}/images`).then((r) => r.data.data),

  upload: (albumId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ data: ImageItem }>(`/albums/${albumId}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.data);
  },

  delete: (albumId: string, imageId: string) =>
    api.delete(`/albums/${albumId}/images/${imageId}`),
};

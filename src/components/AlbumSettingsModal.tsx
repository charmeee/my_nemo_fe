import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { albumsApi, type Album } from '../api/albums';

interface Props {
  album: Album;
  onClose: () => void;
}

// 앨범 설정 모달 (ADMIN 전용): 이름 변경, 잠금 토글, 삭제(휴지통 이동)
export default function AlbumSettingsModal({ album, onClose }: Props) {
  const [name, setName] = useState(album.name);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const updateMutation = useMutation({
    mutationFn: (body: { name?: string; isLocked?: boolean }) =>
      albumsApi.update(album.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['album', album.id] });
      queryClient.invalidateQueries({ queryKey: ['albums'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => albumsApi.delete(album.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      navigate('/albums');
    },
  });

  // 이름이 비어있지 않고 변경됐을 때만 저장 호출
  const handleSaveName = () => {
    if (name.trim() && name.trim() !== album.name) {
      updateMutation.mutate({ name: name.trim() });
    }
  };

  // 잠금 토글 (잠금 시 편집자 세션 종료됨)
  const handleToggleLock = () => {
    updateMutation.mutate({ isLocked: !album.isLocked });
  };

  // 앨범 삭제: confirm 후 휴지통 이동 (30일 보관)
  const handleDelete = () => {
    if (window.confirm(`"${album.name}" 앨범을 삭제하시겠습니까? 30일간 휴지통에 보관됩니다.`)) {
      deleteMutation.mutate();
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(28,16,23,0.4)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 600, padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '24px', padding: '32px',
          width: '100%', maxWidth: '400px',
          boxShadow: '0 16px 60px rgba(28,16,23,0.2)',
        }}
      >
        <h2 style={{ fontSize: '1.1rem', color: '#1C1017', marginBottom: '24px', fontWeight: 700 }}>
          앨범 설정
        </h2>

        {/* 앨범 이름 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5C4470', display: 'block', marginBottom: '6px' }}>
            앨범 이름
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              className="nemo-input"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="nemo-btn nemo-btn-primary"
              onClick={handleSaveName}
              disabled={!name.trim() || name.trim() === album.name || updateMutation.isPending}
              style={{ padding: '8px 16px', fontSize: '0.82rem', flexShrink: 0 }}
            >
              저장
            </button>
          </div>
        </div>

        {/* 잠금 토글 */}
        <div style={{
          marginBottom: '20px', padding: '14px 16px',
          background: '#FFF9F5', borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1C1017' }}>앨범 잠금</div>
            <div style={{ fontSize: '0.75rem', color: '#9C8BA6', marginTop: '2px' }}>
              잠금 시 편집이 제한되고 모든 편집자 세션이 종료됩니다
            </div>
          </div>
          <button
            onClick={handleToggleLock}
            disabled={updateMutation.isPending}
            style={{
              width: '44px', height: '24px', borderRadius: '12px', border: 'none',
              cursor: 'pointer', transition: 'background 200ms',
              background: album.isLocked ? '#845EF7' : '#D8C8F0',
              position: 'relative',
            }}
          >
            <span style={{
              position: 'absolute', top: '3px',
              left: album.isLocked ? '23px' : '3px',
              width: '18px', height: '18px', borderRadius: '50%',
              background: '#fff', transition: 'left 200ms',
            }} />
          </button>
        </div>

        {/* 앨범 삭제 */}
        <div style={{ borderTop: '1px solid #F5EFF5', paddingTop: '16px' }}>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            style={{
              width: '100%', padding: '10px',
              background: 'none', border: '1px solid #FECDD3',
              borderRadius: '12px', color: '#E11D48',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            }}
          >
            앨범 삭제 (휴지통으로 이동)
          </button>
        </div>

        <button
          className="nemo-btn nemo-btn-ghost"
          onClick={onClose}
          style={{ width: '100%', marginTop: '12px' }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

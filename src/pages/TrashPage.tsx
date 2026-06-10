import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { trashApi, type TrashItem } from '../api/trash';

export default function TrashPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['trash'],
    queryFn: trashApi.getAll,
  });

  const restore = useMutation({
    mutationFn: (id: string) => trashApi.restore(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trash'] }),
  });

  const deletePerm = useMutation({
    mutationFn: (id: string) => trashApi.permanentDelete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trash'] }),
  });

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9F5' }}>
      <header style={{
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #F0E8F0', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/albums')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#845EF7', fontWeight: 600, fontSize: '0.82rem', padding: '6px 12px', borderRadius: '10px' }}
          >
            <ArrowLeft size={15} style={{ flexShrink: 0 }} /> 앨범 목록
          </button>
          <div style={{ width: '1px', height: '22px', background: '#D8C8F0' }} />
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1C1017' }}>휴지통</span>
          <span style={{ fontSize: '0.75rem', color: '#9C8BA6' }}>삭제 후 30일 이내 복원 가능</span>
        </div>
      </header>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
        {isLoading && <div className="nemo-spinner" />}

        {!isLoading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9C8BA6' }}>
            <div style={{ marginBottom: '12px', color: '#C8B8D8' }}><Trash2 size={48} /></div>
            <p>휴지통이 비어 있습니다</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item) => (
            <TrashCard
              key={item.id}
              item={item}
              onRestore={() => {
                if (window.confirm('앨범을 복원하시겠습니까?')) {
                  restore.mutate(item.id);
                }
              }}
              onDelete={() => {
                if (window.confirm('영구 삭제하면 복원할 수 없습니다. 계속하시겠습니까?')) {
                  deletePerm.mutate(item.id);
                }
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function TrashCard({ item, onRestore, onDelete }: { item: TrashItem; onRestore: () => void; onDelete: () => void }) {
  const expires = new Date(item.expiresAt);
  const daysLeft = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div style={{
      background: '#fff', borderRadius: '16px', border: '1px solid #F0E8F0',
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px',
      boxShadow: '0 2px 8px rgba(28,16,23,0.04)',
    }}>
      <div style={{ fontSize: '1.5rem' }}>{item.type === 'ALBUM' ? '📷' : '📄'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1C1017' }}>
          {item.type === 'ALBUM' ? '앨범' : '페이지'}
        </div>
        <div style={{ fontSize: '0.75rem', color: daysLeft <= 3 ? '#E11D48' : '#9C8BA6', marginTop: '2px' }}>
          {daysLeft > 0 ? `${daysLeft}일 후 영구 삭제` : '오늘 영구 삭제 예정'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="nemo-btn nemo-btn-ghost"
          onClick={onRestore}
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          복원
        </button>
        <button
          onClick={onDelete}
          style={{
            fontSize: '0.8rem', padding: '6px 14px',
            background: 'none', border: '1px solid #FECDD3', borderRadius: '10px',
            color: '#E11D48', cursor: 'pointer', fontWeight: 600,
          }}
        >
          영구 삭제
        </button>
      </div>
    </div>
  );
}

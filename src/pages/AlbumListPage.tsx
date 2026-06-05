import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { albumsApi, type Album, type MemberAvatar } from '../api/albums';
import { useAuthStore } from '../store/authStore';
import NotificationBell from '../components/NotificationBell';

/* ─── Album Cover Colors (기본 커버 팔레트) ─── */
const COVER_COLORS = [
  'linear-gradient(135deg, #FF6B9D, #FF8CC8)',
  'linear-gradient(135deg, #845EF7, #B197FC)',
  'linear-gradient(135deg, #FF9A3C, #FFB347)',
  'linear-gradient(135deg, #20C997, #63E6BE)',
  'linear-gradient(135deg, #339AF0, #74C0FC)',
  'linear-gradient(135deg, #F06595, #FFA8D0)',
];
const getCoverColor = (id: string) =>
  COVER_COLORS[parseInt(id.replace(/-/g, '').slice(0, 4), 16) % COVER_COLORS.length];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

/* ─── AlbumCard ─── */
function AlbumCard({ album, owned }: { album: Album; owned: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={`/albums/${album.id}`}
      style={{ textDecoration: 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        border: '1px solid #F0E8F0',
        boxShadow: hovered
          ? '0 8px 32px rgba(132,94,247,0.14)'
          : '0 2px 12px rgba(28,16,23,0.06)',
        overflow: 'hidden',
        transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
        transform: hovered ? 'translateY(-4px)' : 'none',
        cursor: 'pointer',
      }}>
        {/* Cover */}
        <div style={{
          height: '140px',
          background: album.coverImage ? `url(${album.coverImage}) center/cover` : getCoverColor(album.id),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          {!album.coverImage && (
            <span style={{ fontSize: '3rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>📷</span>
          )}
          {owned && (
            <div style={{
              position: 'absolute', top: '10px', right: '10px',
              background: 'rgba(255,255,255,0.92)',
              borderRadius: '20px', padding: '2px 10px',
              fontSize: '0.7rem', fontWeight: 700, color: '#FF6B9D',
            }}>내 앨범</div>
          )}
          {album.isLocked && (
            <div style={{
              position: 'absolute', top: '10px', left: '10px',
              background: 'rgba(0,0,0,0.5)',
              borderRadius: '20px', padding: '2px 10px',
              fontSize: '0.7rem', fontWeight: 600, color: '#fff',
            }}>잠금</div>
          )}
        </div>
        {/* Info */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{
            fontWeight: 700, fontSize: '0.95rem', color: '#1C1017',
            marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{album.name}</div>
          {album.recentMembers && album.recentMembers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
              {album.recentMembers.map((m: MemberAvatar, i: number) => (
                <div key={i} style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: m.profileImage ? `url(${m.profileImage}) center/cover` : `hsl(${(m.nickname.charCodeAt(0) * 37) % 360}, 60%, 70%)`,
                  border: '1.5px solid #fff',
                  marginLeft: i > 0 ? '-6px' : 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 700, color: '#fff',
                  flexShrink: 0,
                  title: m.nickname,
                } as React.CSSProperties}>
                  {!m.profileImage && m.nickname.charAt(0).toUpperCase()}
                </div>
              ))}
              {album.memberCount > 4 && (
                <span style={{ fontSize: '0.65rem', color: '#9C8BA6', marginLeft: '2px' }}>+{album.memberCount - 4}</span>
              )}
            </div>
          )}
          <div style={{ fontSize: '0.8rem', color: '#9C8BA6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>멤버 {album.memberCount}명</span>
            {album.updatedAt && (
              <span style={{ fontSize: '0.72rem', color: '#C0B0CC' }}>
                {relativeTime(album.updatedAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── Create Album Modal ─── */
function CreateAlbumModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => albumsApi.create(name.trim()),
    onSuccess: (album) => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      onCreated(album.id);
    },
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(28,16,23,0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '24px',
        animation: 'nemoFadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '24px',
          padding: '32px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 16px 60px rgba(28,16,23,0.2)',
          animation: 'nemoFadeIn 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <h2 style={{ fontSize: '1.2rem', color: '#1C1017', marginBottom: '8px' }}>새 앨범 만들기</h2>
        <p style={{ fontSize: '0.85rem', color: '#9C8BA6', marginBottom: '24px' }}>앨범 이름을 입력하세요 (최대 30자)</p>

        <input
          className="nemo-input"
          autoFocus
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) mutation.mutate();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="앨범 이름"
        />
        <div style={{ fontSize: '0.75rem', color: '#B8AAC0', textAlign: 'right', marginTop: '4px', marginBottom: '20px' }}>
          {name.length}/30
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="nemo-btn nemo-btn-ghost"
            onClick={onClose}
            style={{ flex: 1 }}
          >취소</button>
          <button
            className="nemo-btn nemo-btn-primary"
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            style={{ flex: 2 }}
          >
            {mutation.isPending ? '만드는 중...' : '만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── AlbumListPage ─── */
export default function AlbumListPage() {
  const { data, isLoading } = useQuery({ queryKey: ['albums'], queryFn: albumsApi.list });
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const owned = data?.owned ?? [];
  const joined = data?.joined ?? [];

  const handleCreated = (id: string) => {
    setShowCreate(false);
    navigate(`/albums/${id}`);
  };

  if (isLoading) {
    return <div className="nemo-spinner" />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9F5' }}>
      {/* Header */}
      <header style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #F0E8F0',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: '900px', margin: '0 auto', padding: '0 24px',
          height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            fontFamily: "'Nunito', sans-serif",
            fontSize: '1.5rem', fontWeight: 900,
            background: 'linear-gradient(135deg, #FF6B9D, #845EF7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>nemo</div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <NotificationBell />
            <button
              className="nemo-btn nemo-btn-ghost"
              onClick={() => navigate('/trash')}
              style={{ padding: '8px 14px', fontSize: '0.875rem' }}
            >
              🗑️ 휴지통
            </button>
            <button
              className="nemo-btn nemo-btn-primary"
              onClick={() => setShowCreate(true)}
              style={{ padding: '8px 16px', fontSize: '0.875rem' }}
            >
              + 새 앨범
            </button>
            <button
              className="nemo-btn nemo-btn-ghost"
              onClick={() => { logout(); navigate('/login'); }}
              style={{ padding: '8px 14px', fontSize: '0.875rem' }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Empty State */}
        {owned.length === 0 && joined.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '80px 0',
            animation: 'nemoFadeIn 0.3s ease',
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📷</div>
            <h2 style={{ fontSize: '1.2rem', color: '#1C1017', marginBottom: '8px', fontWeight: 700 }}>
              아직 앨범이 없어요
            </h2>
            <p style={{ color: '#9C8BA6', fontSize: '0.9rem', marginBottom: '24px' }}>
              새 앨범을 만들어 소중한 순간을 함께 담아보세요
            </p>
            <button className="nemo-btn nemo-btn-primary" onClick={() => setShowCreate(true)}>
              첫 앨범 만들기
            </button>
          </div>
        )}

        {/* Owned Albums */}
        {owned.length > 0 && (
          <section style={{ marginBottom: '40px', animation: 'nemoFadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1C1017' }}>내가 만든 앨범</h2>
              <span style={{
                background: '#FFE4F0', color: '#FF6B9D',
                fontSize: '0.75rem', fontWeight: 700,
                padding: '2px 8px', borderRadius: '20px',
              }}>{owned.length}</span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px',
            }}>
              {owned.map((album: Album) => (
                <AlbumCard key={album.id} album={album} owned />
              ))}
            </div>
          </section>
        )}

        {/* Joined Albums */}
        {joined.length > 0 && (
          <section style={{ animation: 'nemoFadeIn 0.35s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1C1017' }}>참여 중인 앨범</h2>
              <span style={{
                background: '#F0EBFF', color: '#845EF7',
                fontSize: '0.75rem', fontWeight: 700,
                padding: '2px 8px', borderRadius: '20px',
              }}>{joined.length}</span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px',
            }}>
              {joined.map((album: Album) => (
                <AlbumCard key={album.id} album={album} owned={false} />
              ))}
            </div>
          </section>
        )}
      </main>

      {showCreate && (
        <CreateAlbumModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}

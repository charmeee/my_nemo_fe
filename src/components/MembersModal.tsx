import { useState } from 'react';
import { X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { albumsApi, type AlbumMember, type InviteLink } from '../api/albums';

interface Props {
  albumId: string;
  myRole: string;
  onClose: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: '관리자',
  EDITOR: '편집자',
  VIEWER: '뷰어',
};

// 멤버 관리 모달: 멤버 목록/역할 변경/추방/승인대기/초대 링크 관리 (ADMIN만 초대 탭 노출)
export default function MembersModal({ albumId, myRole, onClose }: Props) {
  const [tab, setTab] = useState<'members' | 'invite'>('members');
  const isAdmin = myRole === 'ADMIN';
  const queryClient = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ['members', albumId],
    queryFn: () => albumsApi.getMembers(albumId),
  });

  const { data: pending = [] } = useQuery({
    queryKey: ['pending', albumId],
    queryFn: () => albumsApi.getPendingMembers(albumId),
    enabled: isAdmin,
  });

  const { data: inviteLinks = [] } = useQuery({
    queryKey: ['invite-links', albumId],
    queryFn: () => albumsApi.getInviteLinks(albumId),
    enabled: isAdmin && tab === 'invite',
  });

  const kickMutation = useMutation({
    mutationFn: (userId: string) => albumsApi.kickMember(albumId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', albumId] }),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      albumsApi.changeRole(albumId, userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', albumId] }),
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => albumsApi.approveMember(albumId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', albumId] });
      queryClient.invalidateQueries({ queryKey: ['pending', albumId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: string) => albumsApi.rejectMember(albumId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pending', albumId] }),
  });

  const reissueMutation = useMutation({
    mutationFn: () => albumsApi.reissueInviteLink(albumId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invite-links', albumId] }),
  });

  const toggleLinkMutation = useMutation({
    mutationFn: ({ linkId, active }: { linkId: string; active: boolean }) =>
      albumsApi.toggleInviteLink(albumId, linkId, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invite-links', albumId] }),
  });

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
          background: '#fff', borderRadius: '24px',
          width: '100%', maxWidth: '460px', maxHeight: '80vh',
          boxShadow: '0 16px 60px rgba(28,16,23,0.2)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #F5EFF5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1C1017' }}>멤버 관리</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9C8BA6', display: 'flex', alignItems: 'center', padding: '4px' }}><X size={18} /></button>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '0' }}>
              {(['members', 'invite'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '8px 16px', border: 'none', cursor: 'pointer',
                    background: 'none', fontSize: '0.85rem', fontWeight: tab === t ? 700 : 400,
                    color: tab === t ? '#845EF7' : '#9C8BA6',
                    borderBottom: tab === t ? '2px solid #845EF7' : '2px solid transparent',
                  }}
                >
                  {t === 'members' ? '멤버' : '초대 링크'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 0' }}>
          {tab === 'members' && (
            <>
              {/* 승인 대기 */}
              {isAdmin && pending.length > 0 && (
                <div>
                  <div style={{ padding: '8px 20px 4px', fontSize: '0.72rem', fontWeight: 700, color: '#FF6B9D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    참여 대기 중 ({pending.length})
                  </div>
                  {pending.map((m) => (
                    <MemberRow key={m.id} member={m} isAdmin={isAdmin} isPending
                      onApprove={() => approveMutation.mutate(m.userId)}
                      onReject={() => rejectMutation.mutate(m.userId)}
                      onKick={() => {}}
                      onChangeRole={() => {}}
                    />
                  ))}
                  <div style={{ height: '1px', background: '#F5EFF5', margin: '8px 0' }} />
                </div>
              )}

              {/* 활성 멤버 */}
              <div style={{ padding: '8px 20px 4px', fontSize: '0.72rem', fontWeight: 700, color: '#9C8BA6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                멤버 ({members.length})
              </div>
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isAdmin={isAdmin}
                  onKick={() => {
                    if (window.confirm(`${m.nickname}님을 추방하시겠습니까?`)) {
                      kickMutation.mutate(m.userId);
                    }
                  }}
                  onChangeRole={(role) => changeRoleMutation.mutate({ userId: m.userId, role })}
                />
              ))}
            </>
          )}

          {tab === 'invite' && isAdmin && (
            <InviteTab
              links={inviteLinks}
              onReissue={() => reissueMutation.mutate()}
              onToggle={(linkId, active) => toggleLinkMutation.mutate({ linkId, active })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// 멤버 한 줄 (승인 대기 시 승인/거절 버튼, 일반 멤버는 역할 변경/추방 버튼)
function MemberRow({
  member, isAdmin, isPending,
  onKick, onChangeRole, onApprove, onReject,
}: {
  member: AlbumMember;
  isAdmin: boolean;
  isPending?: boolean;
  onKick: () => void;
  onChangeRole: (role: string) => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  return (
    <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #845EF7, #FF6B9D)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: '0.9rem',
      }}>
        {member.nickname?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1C1017', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member.nickname}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#9C8BA6' }}>
          {isPending ? '참여 승인 대기 중' : ROLE_LABEL[member.role] ?? member.role}
        </div>
      </div>

      {isPending && isAdmin ? (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onApprove} style={{ padding: '4px 12px', background: '#F0EBFF', border: 'none', borderRadius: '8px', color: '#845EF7', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>승인</button>
          <button onClick={onReject} style={{ padding: '4px 12px', background: '#FFF1F2', border: 'none', borderRadius: '8px', color: '#E11D48', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>거절</button>
        </div>
      ) : isAdmin && member.role !== 'ADMIN' ? (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <select
            value={member.role}
            onChange={(e) => onChangeRole(e.target.value)}
            style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: '8px', border: '1px solid #D8C8F0', color: '#5C4470', cursor: 'pointer', background: '#fff' }}
          >
            <option value="EDITOR">편집자</option>
            <option value="VIEWER">뷰어</option>
          </select>
          <button onClick={onKick} style={{ padding: '4px 10px', background: 'none', border: '1px solid #FECDD3', borderRadius: '8px', color: '#E11D48', fontSize: '0.75rem', cursor: 'pointer' }}>추방</button>
        </div>
      ) : (
        <span style={{ fontSize: '0.72rem', color: '#9C8BA6', padding: '4px 8px', background: '#F5EFF5', borderRadius: '8px' }}>
          {ROLE_LABEL[member.role] ?? member.role}
        </span>
      )}
    </div>
  );
}

// 초대 링크 탭: 활성 링크 복사/비활성화, 새 링크 발급, 과거 비활성 링크 재활성화
function InviteTab({ links, onReissue, onToggle }: {
  links: InviteLink[];
  onReissue: () => void;
  onToggle: (linkId: string, active: boolean) => void;
}) {
  const appUrl = window.location.origin;
  const activeLink = links.find((l) => l.isActive);

  // 초대 링크 클립보드 복사
  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${appUrl}/invite/${code}`);
  };

  return (
    <div style={{ padding: '16px 20px' }}>
      {activeLink ? (
        <div style={{ background: '#F5F0FF', borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#845EF7', marginBottom: '8px' }}>활성 초대 링크</div>
          <div style={{
            background: '#fff', borderRadius: '10px', padding: '10px 14px',
            fontSize: '0.75rem', color: '#5C4470', wordBreak: 'break-all',
            border: '1px solid #D8C8F0', marginBottom: '10px',
          }}>
            {`${appUrl}/invite/${activeLink.code}`}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => copyLink(activeLink.code)}
              style={{ flex: 1, padding: '8px', background: '#845EF7', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              링크 복사
            </button>
            <button
              onClick={() => onToggle(activeLink.id, false)}
              style={{ padding: '8px 14px', background: 'none', border: '1px solid #D8C8F0', borderRadius: '10px', color: '#9C8BA6', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              비활성화
            </button>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#9C8BA6' }}>
            역할: {activeLink.role === 'EDITOR' ? '편집자' : '뷰어'} {activeLink.approvalRequired ? '(승인 필요)' : '(자동 참여)'}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px', color: '#9C8BA6', fontSize: '0.85rem' }}>
          활성화된 초대 링크가 없습니다
        </div>
      )}

      <button
        onClick={onReissue}
        style={{
          width: '100%', marginTop: '12px', padding: '10px',
          background: 'none', border: '1px dashed #D8C8F0',
          borderRadius: '12px', color: '#845EF7',
          cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
        }}
      >
        새 링크 발급 (기존 링크 비활성화)
      </button>

      {links.filter((l) => !l.isActive).length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9C8BA6', marginBottom: '8px' }}>비활성 링크</div>
          {links.filter((l) => !l.isActive).map((l) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
              <span style={{ flex: 1, fontSize: '0.72rem', color: '#B8AAC0', fontFamily: 'monospace' }}>{l.code}</span>
              <button
                onClick={() => onToggle(l.id, true)}
                style={{ padding: '3px 10px', background: 'none', border: '1px solid #D8C8F0', borderRadius: '8px', color: '#9C8BA6', fontSize: '0.72rem', cursor: 'pointer' }}
              >
                활성화
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

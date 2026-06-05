import { useState } from 'react';

export interface PageInfo {
  pageId: string;
  name: string;
  pageOrder: number;
}

interface PageTabsProps {
  pages: PageInfo[];
  currentPageId: string | null;
  onSelect: (pageId: string) => void;
  onAdd: () => void;
  onDelete: (pageId: string) => void;
  canEdit: boolean;
}

export default function PageTabs({
  pages,
  currentPageId,
  onSelect,
  onAdd,
  onDelete,
  canEdit,
}: PageTabsProps) {
  const sorted = [...pages].sort((a, b) => a.pageOrder - b.pageOrder);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '0 12px',
        background: 'rgba(255,255,255,0.92)',
        borderTop: '1px solid rgba(132,94,247,0.12)',
        height: '40px',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {sorted.map((page) => (
        <div
          key={page.pageId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontWeight: currentPageId === page.pageId ? 700 : 500,
            background:
              currentPageId === page.pageId
                ? 'linear-gradient(135deg, #845EF7, #FF6B9D)'
                : 'transparent',
            color: currentPageId === page.pageId ? '#fff' : '#6741D9',
            border: currentPageId === page.pageId ? 'none' : '1px solid #D8C8F0',
            transition: 'all 150ms ease',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          onClick={() => onSelect(page.pageId)}
        >
          {page.name}
          {canEdit && currentPageId === page.pageId && sorted.length > 1 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onDelete(page.pageId);
              }}
              style={{
                marginLeft: '4px',
                fontSize: '10px',
                opacity: 0.7,
                cursor: 'pointer',
              }}
            >
              ✕
            </span>
          )}
        </div>
      ))}

      {canEdit && (
        <button
          onClick={onAdd}
          style={{
            flexShrink: 0,
            padding: '4px 10px',
            borderRadius: '8px',
            border: '1px dashed #D8C8F0',
            background: 'none',
            color: '#845EF7',
            fontSize: '0.78rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          + 페이지
        </button>
      )}
    </div>
  );
}

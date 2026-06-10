import { X } from 'lucide-react';

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
        alignItems: 'flex-end',
        gap: '2px',
        paddingLeft: '2px',
        paddingTop: '8px',
      }}
    >
      {sorted.map((page) => {
        const isActive = currentPageId === page.pageId;
        return (
          <div
            key={page.pageId}
            onClick={() => onSelect(page.pageId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: isActive ? '6px 14px' : '5px 12px',
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: isActive ? 700 : 500,
              background: isActive ? 'var(--editor-canvas-bg)' : 'var(--editor-tab-inactive-bg)',
              color: isActive ? 'var(--editor-tab-active-text)' : 'var(--editor-tab-inactive-text)',
              border: '1px solid var(--editor-border)',
              borderBottom: isActive ? '1px solid var(--editor-canvas-bg)' : '1px solid var(--editor-border)',
              position: 'relative',
              zIndex: isActive ? 1 : 0,
              marginBottom: isActive ? '-1px' : '0',
              transition: 'background 120ms ease, color 120ms ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              userSelect: 'none',
            }}
          >
            {page.name}
            {canEdit && isActive && sorted.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(page.pageId);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.6,
                  cursor: 'pointer',
                  borderRadius: '3px',
                  padding: '1px',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
              >
                <X size={10} />
              </span>
            )}
          </div>
        );
      })}

      {canEdit && (
        <button
          onClick={onAdd}
          style={{
            flexShrink: 0,
            padding: '5px 10px',
            borderRadius: '6px 6px 0 0',
            border: '1px dashed var(--editor-border)',
            background: 'transparent',
            color: 'var(--editor-back-color)',
            fontSize: '0.78rem',
            cursor: 'pointer',
            fontWeight: 600,
            marginBottom: '0',
          }}
        >
          + 페이지
        </button>
      )}
    </div>
  );
}

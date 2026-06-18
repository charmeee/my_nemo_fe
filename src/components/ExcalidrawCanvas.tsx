import { useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';

export const PAGE_WIDTH = 1200;
export const PAGE_HEIGHT = 600;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 2.5;

const Excalidraw = lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw }))
);

let reconcileElements: ((local: readonly ExcalidrawElement[], remote: readonly ExcalidrawElement[], appState: AppState) => ExcalidrawElement[]) | null = null;
import('@excalidraw/excalidraw').then((mod) => {
  reconcileElements = (mod as any).reconcileElements ?? null;
});

export interface ExcalidrawAPI {
  getSceneElements: () => readonly ExcalidrawElement[];
  getAppState: () => AppState;
  updateScene: (update: { elements?: ExcalidrawElement[]; appState?: Partial<AppState>; files?: BinaryFiles; captureUpdate?: string }) => void;
}

export interface ExcalidrawCanvasProps {
  pageId: string;
  initialElements: readonly ExcalidrawElement[];
  remoteElements: readonly ExcalidrawElement[] | null;
  onAPI: (api: ExcalidrawAPI) => void;
  onChange: (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => void;
  isReadonly: boolean;
  isDark?: boolean;
  collaborators?: Map<string, any>;
  onPointerUpdate?: (payload: { pointer: { x: number; y: number } }) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
}

export default function ExcalidrawCanvas({
  pageId,
  initialElements,
  remoteElements,
  onAPI,
  onChange,
  isReadonly,
  isDark = false,
  collaborators,
  onPointerUpdate,
  onSelectionChange,
}: ExcalidrawCanvasProps) {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const prevSelectedIdsRef = useRef<Record<string, boolean>>({});
  const pendingRemoteRef = useRef<readonly ExcalidrawElement[] | null>(null);

  // Wheel capture: block zoom below MIN or above MAX
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const zoom = apiRef.current?.getAppState().zoom.value ?? MIN_ZOOM;
      if (e.deltaY > 0 && zoom <= MIN_ZOOM) e.stopPropagation();
      if (e.deltaY < 0 && zoom >= MAX_ZOOM) e.stopPropagation();
    };
    el.addEventListener('wheel', handler, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', handler, { capture: true });
  }, []);

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      const zoomVal = appState.zoom.value;
      if (zoomVal < MIN_ZOOM) {
        (apiRef.current as any)?.updateScene({ appState: { zoom: { value: MIN_ZOOM } }, captureUpdate: 'NEVER' });
        return;
      }
      if (zoomVal > MAX_ZOOM) {
        (apiRef.current as any)?.updateScene({ appState: { zoom: { value: MAX_ZOOM } }, captureUpdate: 'NEVER' });
        return;
      }
      // 캔버스 경계 밖으로 패닝 제한
      const minScrollX = PAGE_WIDTH * (1 - zoomVal);
      const minScrollY = PAGE_HEIGHT * (1 - zoomVal);
      const clampedScrollX = Math.max(minScrollX, Math.min(0, appState.scrollX));
      const clampedScrollY = Math.max(minScrollY, Math.min(0, appState.scrollY));
      if (clampedScrollX !== appState.scrollX || clampedScrollY !== appState.scrollY) {
        (apiRef.current as any)?.updateScene({ appState: { scrollX: clampedScrollX, scrollY: clampedScrollY }, captureUpdate: 'NEVER' });
        return;
      }
      if (onSelectionChange) {
        const currentSelectedIds = appState.selectedElementIds ?? {};
        const prevKeys = Object.keys(prevSelectedIdsRef.current).sort().join(',');
        const currKeys = Object.keys(currentSelectedIds).sort().join(',');
        if (prevKeys !== currKeys) {
          prevSelectedIdsRef.current = currentSelectedIds;
          onSelectionChange(Object.keys(currentSelectedIds));
        }
      }
      onChange(elements, appState, files);
    },
    [onChange, onSelectionChange]
  );

  // collaborators는 ExcalidrawProps에 없음 → updateScene API로 업데이트
  const collaboratorsRef = useRef(collaborators);
  collaboratorsRef.current = collaborators;
  useEffect(() => {
    if (!apiRef.current) return;
    (apiRef.current as any).updateScene({ collaborators: collaborators ?? new Map() });
  }, [collaborators]);

  const applyRemote = useCallback((api: ExcalidrawAPI, elements: readonly ExcalidrawElement[]) => {
    const appState = api.getAppState();
    let merged: ExcalidrawElement[];
    if (reconcileElements) {
      merged = reconcileElements(api.getSceneElements(), elements, appState);
    } else {
      const map = new Map<string, ExcalidrawElement>();
      for (const el of api.getSceneElements()) map.set(el.id, el as ExcalidrawElement);
      for (const el of elements) {
        const cur = map.get(el.id);
        if (!cur || el.version > cur.version) map.set(el.id, el as ExcalidrawElement);
      }
      merged = Array.from(map.values());
    }
    api.updateScene({ elements: merged, captureUpdate: 'NEVER' });
  }, []);

  useEffect(() => {
    if (!remoteElements) return;
    if (!apiRef.current) {
      pendingRemoteRef.current = remoteElements;
      return;
    }
    applyRemote(apiRef.current, remoteElements);
  }, [remoteElements, applyRemote]);

  return (
    <Suspense
      fallback={
        <div style={{
          width: PAGE_WIDTH, height: PAGE_HEIGHT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--editor-canvas-bg)',
          border: '1px solid var(--editor-border)',
          borderRadius: '6px', color: 'var(--nemo-text-3)',
        }}>
          캔버스 로드 중...
        </div>
      }
    >
      <div
        ref={wrapperRef}
        className="excalidraw-wrapper"
        style={{
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          flexShrink: 0,
          borderRadius: '6px',
          overflow: 'hidden',
          boxShadow: isDark
            ? '0 4px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)'
            : '0 4px 32px rgba(132,94,247,0.20), 0 2px 8px rgba(0,0,0,0.10)',
          border: '1px solid var(--editor-border)',
          position: 'relative',
        }}
      >
        <style>{`
          .excalidraw-wrapper .shapes-section {
            position: absolute !important;
            bottom: 0 !important;
            top: auto !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
          }
          .excalidraw-wrapper .layer-ui__wrapper__top-right {
            position: absolute !important;
            top: 8px !important;
            right: 8px !important;
            width: auto !important;
          }
        `}</style>
        <Excalidraw
          key={pageId}
          theme={isDark ? 'dark' : 'light'}
          initialData={{
            elements: initialElements,
            appState: {
              viewBackgroundColor: isDark ? '#1E1B2E' : '#FFFCFE',
              zoom: { value: MIN_ZOOM as any },
              scrollX: 0,
              scrollY: 0,
            },
          }}
          onChange={handleChange}
          excalidrawAPI={(api: any) => {
            apiRef.current = api;
            onAPI(api);
            if (import.meta.env.DEV) {
              (window as unknown as { excalidrawAPI?: unknown }).excalidrawAPI = api;
            }
            // API 초기화 시 최신 collaborators 즉시 반영
            if (collaboratorsRef.current) {
              api.updateScene({ collaborators: collaboratorsRef.current });
            }
            // apiRef가 null이었을 때 수신된 remoteElements 즉시 반영
            if (pendingRemoteRef.current) {
              applyRemote(api, pendingRemoteRef.current);
              pendingRemoteRef.current = null;
            }
          }}
          onPointerUpdate={onPointerUpdate as any}
          isCollaborating={true}
          viewModeEnabled={isReadonly}
        />
      </div>
    </Suspense>
  );
}

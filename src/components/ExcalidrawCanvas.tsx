import { useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';

const PAGE_WIDTH = 1200;
const PAGE_HEIGHT = 600;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 2.5;

// Lazy import to avoid SSR issues
const Excalidraw = lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw }))
);

// reconcileElements for client-side LWW merge
let reconcileElements: ((local: readonly ExcalidrawElement[], remote: readonly ExcalidrawElement[], appState: AppState) => ExcalidrawElement[]) | null = null;
import('@excalidraw/excalidraw').then((mod) => {
  reconcileElements = (mod as any).reconcileElements ?? null;
});

export interface ExcalidrawAPI {
  getSceneElements: () => readonly ExcalidrawElement[];
  getAppState: () => AppState;
  updateScene: (update: { elements?: ExcalidrawElement[]; files?: BinaryFiles; captureUpdate?: string }) => void;
}

export interface ExcalidrawCanvasProps {
  pageId: string;
  initialElements: readonly ExcalidrawElement[];
  remoteElements: readonly ExcalidrawElement[] | null;
  onAPI: (api: ExcalidrawAPI) => void;
  onChange: (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => void;
  isReadonly: boolean;
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
  collaborators,
  onPointerUpdate,
  onSelectionChange,
}: ExcalidrawCanvasProps) {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const prevSelectedIdsRef = useRef<Record<string, boolean>>({});

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

  // Clamp zoom from keyboard shortcuts / toolbar
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

  // Apply remote patch via LWW merge
  useEffect(() => {
    if (!remoteElements || !apiRef.current) return;
    const api = apiRef.current;
    const appState = api.getAppState();

    let merged: ExcalidrawElement[];
    if (reconcileElements) {
      merged = reconcileElements(api.getSceneElements(), remoteElements, appState);
    } else {
      const map = new Map<string, ExcalidrawElement>();
      for (const el of api.getSceneElements()) map.set(el.id, el as ExcalidrawElement);
      for (const el of remoteElements) {
        const cur = map.get(el.id);
        if (!cur || el.version > cur.version) map.set(el.id, el as ExcalidrawElement);
      }
      merged = Array.from(map.values());
    }

    api.updateScene({ elements: merged, captureUpdate: 'NEVER' });
  }, [remoteElements]);

  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9C8BA6' }}>
          캔버스 로드 중...
        </div>
      }
    >
      {/* Outer: gray margin area */}
      <div
        ref={wrapperRef}
        style={{
          height: '100%',
          overflow: 'auto',
          background: '#DDD8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
        }}
      >
        {/* Inner: fixed-size page */}
        <div
          className="excalidraw-wrapper"
          style={{
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            flexShrink: 0,
            borderRadius: '6px',
            overflow: 'hidden',
            boxShadow: '0 4px 32px rgba(132,94,247,0.20), 0 2px 8px rgba(0,0,0,0.10)',
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
            initialData={{
              elements: initialElements,
              appState: {
                viewBackgroundColor: '#FFFCFE',
                zoom: { value: MIN_ZOOM as any },
              },
            }}
            onChange={handleChange}
            excalidrawAPI={(api: any) => {
              apiRef.current = api;
              onAPI(api);
            }}
            collaborators={collaborators}
            onPointerUpdate={onPointerUpdate as any}
            isCollaborating={true}
            viewModeEnabled={isReadonly}
          />
        </div>
      </div>
    </Suspense>
  );
}

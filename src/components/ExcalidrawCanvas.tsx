import { useEffect, useRef, lazy, Suspense } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';

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
}

export default function ExcalidrawCanvas({
  pageId,
  initialElements,
  remoteElements,
  onAPI,
  onChange,
  isReadonly,
}: ExcalidrawCanvasProps) {
  const apiRef = useRef<ExcalidrawAPI | null>(null);

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
      <div style={{ height: '100%', position: 'relative' }} className="excalidraw-wrapper">
        <style>{`
          .excalidraw-wrapper .shapes-section {
            position: absolute !important;
            bottom: 0 !important;
            top: auto !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
          }
        `}</style>
        <Excalidraw
          key={pageId}
          initialData={{
            elements: initialElements,
            appState: { viewBackgroundColor: '#F7F3FF' },
          }}
          onChange={onChange}
          excalidrawAPI={(api: any) => {
            apiRef.current = api;
            onAPI(api);
          }}
          isCollaborating={!isReadonly}
          viewModeEnabled={isReadonly}
        />
      </div>
    </Suspense>
  );
}

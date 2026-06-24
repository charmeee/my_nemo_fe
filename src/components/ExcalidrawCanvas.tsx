import { useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
// `?url` 쿼리: CSS를 JS bundle/entry HTML에 포함시키지 않고, 빌드 산출물 URL 문자열만 받는다.
// 캔버스가 mount될 때 <link>를 동적으로 주입해서 로그인 화면에서는 받지 않게 한다.
import excalidrawCssUrl from '@excalidraw/excalidraw/index.css?url';

export const PAGE_WIDTH = 1200;
export const PAGE_HEIGHT = 600;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 2.5;

// Excalidraw 본체는 캔버스 컴포넌트가 실제 mount될 때까지 로드 지연.
// (이전엔 top-level import로 즉시 평가되어 lazy의 의미가 사라졌음.)
// CSS도 함께 동적으로 주입해서 entry HTML이 미리 받지 않도록 한다.
let reconcileElements: ((local: readonly ExcalidrawElement[], remote: readonly ExcalidrawElement[], appState: AppState) => ExcalidrawElement[]) | null = null;

const Excalidraw = lazy(async () => {
  injectExcalidrawStyles();
  const mod = await import('@excalidraw/excalidraw');
  reconcileElements = (mod as any).reconcileElements ?? null;
  return { default: mod.Excalidraw };
});

let stylesInjected = false;
// Excalidraw CSS를 <link> 동적 주입 (로그인 등 캔버스 없는 화면이 미리 받지 않게)
function injectExcalidrawStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = excalidrawCssUrl;
  document.head.appendChild(link);
}

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

// Excalidraw 캔버스 래퍼: zoom/pan 제한, 원격 엘리먼트 LWW 머지, collaborators presence 반영
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

  // 변경 핸들러: zoom clamp, 스크롤 경계 clamp, 선택 변경 감지 후 상위로 위임
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

  // 원격 엘리먼트를 로컬과 LWW(version 큰 쪽 채택)로 머지 후 씬에 반영
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

  // remoteElements 도착 시 즉시 적용 (API 미초기화면 pending에 보관 후 init에서 flush)
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
            // Excalidraw 의 _App 은 자기 constructor 안에서 이 콜백을 동기로 호출한다.
            // 그 시점에 updateScene 을 부르면 _App.setState 가 mount 전 호출되어
            // "setState on unmounted component" 경고가 뜬다. mount 이후로 미룬다.
            queueMicrotask(() => {
              const a = apiRef.current;
              if (!a) return;
              if (collaboratorsRef.current) {
                a.updateScene({ collaborators: collaboratorsRef.current });
              }
              if (pendingRemoteRef.current) {
                applyRemote(a, pendingRemoteRef.current);
                pendingRemoteRef.current = null;
              }
            });
          }}
          onPointerUpdate={onPointerUpdate as any}
          isCollaborating={true}
          viewModeEnabled={isReadonly}
        />
      </div>
    </Suspense>
  );
}

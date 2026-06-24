import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1500,
    // 라우트 단위 lazy import의 효과를 살리려면 entry에서 모든 chunk를
    // modulepreload로 hint하지 않는 게 좋다. 로그인 페이지에서 4.5MB Excalidraw
    // 청크가 미리 다운로드되는 걸 막는다. 라우트 전환 시점에 자연스럽게 다운로드된다.
    modulePreload: false,
    // rollup manualChunks를 잘못 설정하면 공통 의존성(React 등)이 lazy 청크 안으로
    // 끌려 들어가서 entry가 그 lazy 청크를 static import 하게 되는 역효과가 난다.
    // Vite/rolldown 기본 청킹이 dynamic import 경계를 잘 잡으므로 위임한다.
  },
})

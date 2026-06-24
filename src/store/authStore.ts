import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  user: { id: string; nickname: string; profileImage?: string } | null;
  _hasHydrated: boolean;
  setToken: (token: string) => void;
  setUser: (user: AuthState['user']) => void;
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
}

// 인증 상태 store: Zustand persist로 localStorage 영속화, _hasHydrated로 라우팅 가드와 동기화
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      _hasHydrated: false,
      // Zustand state와 localStorage('accessToken')에 동시 반영 (api/client.ts가 후자를 직접 읽음)
      setToken: (token) => {
        localStorage.setItem('accessToken', token);
        set({ accessToken: token });
      },
      setUser: (user) => set({ user }),
      // 로그아웃: 토큰 제거 + 상태 초기화
      logout: () => {
        localStorage.removeItem('accessToken');
        set({ accessToken: null, user: null });
      },
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'auth',
      // persist 복원 완료 시점 표시 (ProtectedRoute에서 _hasHydrated 확인 후 라우팅)
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      _hasHydrated: false,
      setToken: (token) => {
        localStorage.setItem('accessToken', token);
        set({ accessToken: token });
      },
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('accessToken');
        set({ accessToken: null, user: null });
      },
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

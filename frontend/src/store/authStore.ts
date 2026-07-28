import { create } from 'zustand';
import type { User } from '@/types';
import { authApi } from '@/api';
import { apiErrorMessage, mapBackendUser } from '@/api/mappers';
import { useAppStore } from '@/store/appStore';
import { useNavigationStore } from '@/store/navigationStore';
import { clearCache } from '@/utils/geoCache';
import { hydrateUserGeoFromServer } from '@/utils/hydrateUserGeo';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBootstrapping: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

function clearClientSession() {
  useAppStore.getState().resetSession();
  void useAppStore.persist.clearStorage();
  clearCache();
  useNavigationStore.setState({
    algorithmsBackRoute: null,
    materialsBackRoute: null,
    step1BackRoute: null,
  });
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isBootstrapping: true,
  error: null,

  bootstrap: async () => {
    set({ isBootstrapping: true, error: null });
    try {
      const { data } = await authApi.getCurrentUser();
      if (data.authenticated && data.user) {
        await hydrateUserGeoFromServer();
        set({
          user: mapBackendUser(data.user),
          isAuthenticated: true,
          isBootstrapping: false,
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isBootstrapping: false,
        });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isBootstrapping: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      clearClientSession();
      const { data } = await authApi.login(email, password);
      await hydrateUserGeoFromServer();
      set({
        user: mapBackendUser(data.user),
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: apiErrorMessage(error, 'Ошибка входа'),
      });
      throw error;
    }
  },

  register: async (fullName, email, password) => {
    set({ isLoading: true, error: null });
    try {
      clearClientSession();
      const { data } = await authApi.register(fullName, email, password);
      await hydrateUserGeoFromServer();
      set({
        user: mapBackendUser(data.user),
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: apiErrorMessage(error, 'Ошибка регистрации'),
      });
      throw error;
    }
  },

  loginAsGuest: async () => {
    clearClientSession();
    try {
      await authApi.guestLogin();
    } catch {
      // guest mode works without server
    }
    set({
      user: {
        id: 'guest',
        email: '',
        fullName: 'Гость',
        isAuthenticated: false,
        isGuest: true,
      },
      isAuthenticated: false,
      error: null,
    });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // local logout anyway
    }
    clearClientSession();
    set({ user: null, isAuthenticated: false, error: null });
  },

  clearError: () => set({ error: null }),
}));

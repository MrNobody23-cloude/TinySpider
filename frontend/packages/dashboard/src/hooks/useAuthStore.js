import { create } from 'zustand';
import { authApi } from '../api/auth.js';

export const useAuthStore = create((set, get) => ({
    user: null,
    isAuthenticated: !!localStorage.getItem('auth_token'),
    isLoading: false,
    isInitialized: false,
    error: null,

    init: async () => {
        const token = localStorage.getItem('auth_token');
        if (!token || token === 'undefined') {
            set({ isInitialized: true, isAuthenticated: false, user: null });
            return;
        }

        try {
            const data = await authApi.getProfile();
            set({ user: data.user, isAuthenticated: true, isInitialized: true });
        } catch (error) {
            // Log error for debugging but don't set error state that might confuse user
            console.debug('Profile initialization failed:', error.response?.status, error.message);
            
            // If 401, let the interceptor handle logout
            // Otherwise just mark as initialized and let user retry
            set({ isInitialized: true });
        }
    },

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const data = await authApi.login(email, password);
            
            // Validate token before storing
            if (!data.token) {
                throw new Error('No token received from server');
            }
            
            localStorage.setItem('auth_token', data.token);
            if (data.refreshToken) {
                localStorage.setItem('refresh_token', data.refreshToken);
            }
            set({ user: data.user, isAuthenticated: true, isLoading: false, error: null });
            return data;
        } catch (error) {
            const message = error.response?.data?.error || error.message || 'Login failed';
            set({ error: message, isLoading: false, isAuthenticated: false });
            throw new Error(message);
        }
    },

    register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
            const data = await authApi.register(userData);
            
            // Validate token before storing
            if (!data.token) {
                throw new Error('No token received from server');
            }
            
            localStorage.setItem('auth_token', data.token);
            if (data.refreshToken) {
                localStorage.setItem('refresh_token', data.refreshToken);
            }
            set({ user: data.user, isAuthenticated: true, isLoading: false, error: null });
            return data;
        } catch (error) {
            const message = error.response?.data?.error || error.message || 'Registration failed';
            set({ error: message, isLoading: false, isAuthenticated: false });
            throw new Error(message);
        }
    },

    logout: async () => {
        set({ isLoading: true });
        try {
            // Only attempt logout call if there's still a token
            if (localStorage.getItem('auth_token')) {
                try {
                    await authApi.logout();
                } catch (error) {
                    // Logout may fail (e.g., invalid/expired token), but we still clear local state
                    console.debug('Logout API call failed:', error.response?.status);
                }
            }
        } finally {
            set({ user: null, isAuthenticated: false, isLoading: false, error: null });
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
        }
    },

    updateProfile: async (data) => {
        try {
            const response = await authApi.updateProfile(data);
            set({ user: response.user });
            return response;
        } catch (error) {
            const message = error.response?.data?.error || error.message || 'Update failed';
            throw new Error(message);
        }
    },

    setError: (error) => set({ error })
}));

// Listen for logout events originating from api client interceptors
window.addEventListener('auth:logout', () => {
    useAuthStore.getState().logout();
});

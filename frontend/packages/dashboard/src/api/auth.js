import api from './client.js';

export const authApi = {
    login: async (email, password) => {
        const response = await api.post('/api/auth/login', { email, password });
        return response.data;
    },

    register: async (data) => {
        const response = await api.post('/api/auth/register', data);
        return response.data;
    },

    logout: async () => {
        try {
            await api.post('/api/auth/logout');
        } catch (e) {
            // Ignore errors on logout
        }
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
    },

    getProfile: async () => {
        const response = await api.get('/api/auth/profile');
        return response.data;
    },

    updateProfile: async (data) => {
        const response = await api.put('/api/auth/profile', data);
        return response.data;
    },

    changePassword: async (data) => {
        const response = await api.post('/api/auth/change-password', data);
        return response.data;
    },

    forgotPassword: async (email) => {
        const response = await api.post('/api/auth/forgot-password', { email });
        return response.data;
    },

    resetPassword: async (token, password) => {
        const response = await api.post('/api/auth/reset-password', { token, password });
        return response.data;
    },

    deleteAccount: async () => {
        const response = await api.delete('/api/auth/account');
        return response.data;
    }
};

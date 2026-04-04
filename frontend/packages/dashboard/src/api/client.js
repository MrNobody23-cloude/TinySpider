import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add the auth token header to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token');
        if (token && token !== 'undefined') {
            // Ensure headers object exists
            if (!config.headers) {
                config.headers = {};
            }
            config.headers.Authorization = `Bearer ${token}`;
            config.headers['X-Token-Present'] = 'true'; // Debug header
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

// Response interceptor to handle 401 errors and refreshing the token
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401) {
            // Check if it's a token expiration that we can refresh
            const isTokenExpired = error.response?.data?.error === 'Token expired' || error.response?.data?.code === 'TOKEN_EXPIRED';
            
            if (!originalRequest._retry && isTokenExpired) {
                if (isRefreshing) {
                    return new Promise(function (resolve, reject) {
                        failedQueue.push({ resolve, reject });
                    }).then(token => {
                        originalRequest.headers.Authorization = 'Bearer ' + token;
                        return api(originalRequest);
                    }).catch(err => {
                        return Promise.reject(err);
                    });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                const refreshToken = localStorage.getItem('refresh_token');
                if (!refreshToken) {
                    isRefreshing = false;
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('refresh_token');
                    window.dispatchEvent(new Event('auth:logout'));
                    return Promise.reject(error);
                }

                try {
                    const res = await axios.post(`${api.defaults.baseURL}/api/auth/refresh`, { refreshToken });
                    const { token: newToken, refreshToken: newRefreshToken } = res.data;

                    localStorage.setItem('auth_token', newToken);
                    localStorage.setItem('refresh_token', newRefreshToken);

                    api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;

                    processQueue(null, newToken);

                    return api(originalRequest);
                } catch (err) {
                    processQueue(err, null);
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('refresh_token');
                    window.dispatchEvent(new Event('auth:logout'));
                    return Promise.reject(err);
                } finally {
                    isRefreshing = false;
                }
            } else {
                // Any other 401 (e.g. Invalid token, Authentication required) that couldn't be refreshed
                localStorage.removeItem('auth_token');
                localStorage.removeItem('refresh_token');
                window.dispatchEvent(new Event('auth:logout'));
            }
        }

        return Promise.reject(error);
    }
);

// Backward compatibility for existing hooks
export const requestJson = async (url, options = {}) => {
    const { method = 'GET', body, ...rest } = options;
    const response = await api({
        url,
        method,
        data: body ? JSON.parse(body) : undefined,
        ...rest
    });
    return response.data;
};

export default api;

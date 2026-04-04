import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Response interceptor to handle any generic errors
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
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

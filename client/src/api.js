import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
});

// Add a request interceptor to inject headers
api.interceptors.request.use((config) => {
    try {
        const userStr = localStorage.getItem('military_db_user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user?.role) {
                config.headers['X-Role'] = user.role;
            }
            if (user?.base_id) {
                config.headers['X-Base-ID'] = user.base_id;
            }
        }
    } catch (error) {
        console.error("Error reading user from storage", error);
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;

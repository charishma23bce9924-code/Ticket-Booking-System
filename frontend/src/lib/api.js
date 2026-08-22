import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Surface real error info instead of failing silently / blank-screening pages.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.code === 'ECONNABORTED' || err.message === 'Network Error' || !err.response) {
      console.error(
        `[API] Could not reach backend at ${api.defaults.baseURL}. ` +
        `Is the backend running, and does VITE_API_URL match its actual port?`,
        err
      );
      err.friendlyMessage = `Can't reach the server at ${api.defaults.baseURL}. Make sure the backend is running and the port matches your frontend .env.`;
    } else {
      err.friendlyMessage = err.response?.data?.error || 'Something went wrong. Please try again.';
    }
    return Promise.reject(err);
  }
);

export default api;

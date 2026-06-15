import axios from 'axios';

// In production (Vercel), VITE_API_URL will be set to the Render backend URL.
// In development, it falls back to '/api' which is proxied to localhost:3000 by Vite.
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
});

// Automatically attach the JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

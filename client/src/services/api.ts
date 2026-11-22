import axios from 'axios';

export const getBaseServerUrl = (): string => {
  const saved = localStorage.getItem('server_url');
  if (saved) return saved;

  const hostname = window.location.hostname;
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '') {
    // В облачном деплое (порт стандартный 80/443) используем текущий домен сайта
    if (window.location.port === '' || window.location.port === '80' || window.location.port === '443') {
      return window.location.origin;
    }
    return `http://${hostname}:5000`;
  }
  return 'http://192.168.1.38:5000';
};

export const API_BASE_URL = `${getBaseServerUrl()}/api`;

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  config.baseURL = `${getBaseServerUrl()}/api`;
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

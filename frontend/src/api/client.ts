import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const DEFAULT_API_URL = '/api';

const normalizeApiUrl = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_API_URL;
  return trimmed.replace(/\/+$/, '') || DEFAULT_API_URL;
};

const getAssetBaseUrl = (apiBaseUrl: string) => {
  if (!/^https?:\/\//i.test(apiBaseUrl)) return '';
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return '';
  }
};

export const API_BASE_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

const ASSET_BASE_URL = getAssetBaseUrl(API_BASE_URL);

const joinUrl = (base: string, path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
};

export const buildApiUrl = (path: string) => joinUrl(API_BASE_URL, path);

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export const getImageUrl = (path: string | null | undefined) => {
  if (!path) return '';

  const value = path.trim();
  if (!value) return '';

  // Preserve colors such as #131315 used by background preferences.
  if (value.startsWith('#')) return value;

  // Preserve legacy absolute URLs and in-memory previews.
  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  return joinUrl(ASSET_BASE_URL, value);
};


// Shared HTTP client.
//
// Every page used to build its own axios instance and repeat the auth +
// business interceptors, which is how seven copies of the base URL and the
// header logic drifted apart. There is now exactly one client, and the origin
// comes from `VITE_API_BASE_URL` so the same build can target any backend.

import axios from 'axios';
import { applyBusinessHeader } from './session';

/** API origin; override per environment with VITE_API_BASE_URL. */
export const API_BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://127.0.0.1:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Token ${token}`;
  return applyBusinessHeader(config);
});

/** DRF wraps collections in {results}; unwrap so callers can treat both alike. */
export const records = (response) => response.data?.results ?? response.data;

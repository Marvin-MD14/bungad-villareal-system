// Shared session + request helpers.
//
// The backend decides which Business a request operates on from the `X-Business`
// header (resolved once per request in backend/api/access/middleware.py, falling back
// to the user's primary grant). App.jsx stores the slug the user last picked under
// 'activeBusiness' so every axios instance - each page creates its own - can attach it
// without prop drilling, and switching business is just a localStorage write.

const ACTIVE_BUSINESS_KEY = 'activeBusiness';
const GRANTED_BUSINESSES_KEY = 'authBusinesses';

export const getActiveBusinessSlug = () => localStorage.getItem(ACTIVE_BUSINESS_KEY) || '';

/** The businesses the signed-in account was granted, from the login payload. */
export const getGrantedBusinesses = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(GRANTED_BUSINESSES_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

export const setActiveBusiness = (slug) => {
  if (slug) localStorage.setItem(ACTIVE_BUSINESS_KEY, slug);
  else localStorage.removeItem(ACTIVE_BUSINESS_KEY);
};

/** Called on login with the `businesses` / `primary_business` fields of the response. */
export const rememberBusinesses = (businesses, primarySlug) => {
  localStorage.setItem(GRANTED_BUSINESSES_KEY, JSON.stringify(businesses));
  setActiveBusiness(primarySlug);
};

/** Called on logout so the next sign-in cannot inherit a stale business grant. */
export const forgetBusinessContext = () => {
  localStorage.removeItem(ACTIVE_BUSINESS_KEY);
  localStorage.removeItem(GRANTED_BUSINESSES_KEY);
};

/**
 * Adds `X-Business` to an axios request config; used by every axios instance.
 */
export const applyBusinessHeader = (config) => {
  const slug = getActiveBusinessSlug();
  if (slug) config.headers['X-Business'] = slug;
  return config;
};

/**
 * The API origin. Configurable per environment via `VITE_API_BASE_URL`
 * (put it in `.env`, or `.env.local` for a local override) so the same build
 * can point at a dev backend or a deployed one without a code change.
 * The fallback only exists so a fresh clone runs with no env file at all.
 */
export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'http://127.0.0.1:8000/api';



/**
 * One key per sale attempt. The backend replays a checkout that carries a key it has
 * already recorded, so re-sending the same key on retry can never create a second sale.
 */
export const newIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

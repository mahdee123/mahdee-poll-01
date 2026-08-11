const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const API_BASE_URL = API_BASE;

/** Thrown when the request never reached the server (API down, no network, DNS). */
export class NetworkError extends Error {
  constructor() {
    super("Can't reach the server. Check that the API is running, then try again.");
    this.name = 'NetworkError';
    this.isNetworkError = true;
  }
}

export const apiRequest = async (path, { method = 'GET', token, body, signal } = {}) => {
  let res;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    // fetch() rejects only when the request never completed — the server is
    // unreachable. A raw "Failed to fetch" tells the user nothing actionable.
    if (err?.name === 'AbortError') throw err;
    throw new NetworkError();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    // 502/503/504 come from the dev proxy (or a load balancer) when the API
    // itself is not answering — same root cause as a failed fetch.
    const apiUnreachable = res.status === 502 || res.status === 503 || res.status === 504;

    const message =
      data?.message ||
      data?.error ||
      (apiUnreachable
        ? "Can't reach the server. Check that the API is running, then try again."
        : res.status === 401
          ? 'Your session has expired. Please sign in again.'
          : res.status === 403
            ? "You don't have permission to do that."
            : res.status >= 500
              ? 'The server ran into a problem. Please try again.'
              : `Request failed (${res.status}).`);

    const error = new Error(message);
    error.statusCode = res.status;
    error.responseData = data;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
};

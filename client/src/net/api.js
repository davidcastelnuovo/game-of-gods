/**
 * REST helper for /api/auth and /api/worlds.
 * Extracted from minecraft-chaluton.html (api function).
 */

/**
 * @param {() => string | null | undefined} getToken
 * @returns {(method: string, urlPath: string, body?: unknown) => Promise<unknown>}
 */
export function createApiClient(getToken = () => null) {
  return async function api(method, urlPath, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(urlPath, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  };
}

/** Singleton-style client; setToken / clearToken mirror legacy `currentUser.token`. */
let _token = null;
export const api = createApiClient(() => _token);

export function setApiToken(token) {
  _token = token;
}

export function clearApiToken() {
  _token = null;
}

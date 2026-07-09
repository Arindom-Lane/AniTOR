/**
 * Thin wrapper around fetch() shared by every API module below.
 * Centralises JSON handling and error-message extraction so
 * components don't each need their own try/catch boilerplate.
 */

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    // NestJS error responses are JSON: { message, statusCode, error }
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
    } catch {
      // response wasn't JSON — fall back to the raw text
    }
    throw new Error(message || `Request failed with status ${res.status}`);
  }

  // Guard against endpoints that return 200 with an empty body.
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export const httpClient = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
};

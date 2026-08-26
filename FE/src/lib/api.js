import { API_ROOT } from "./session";

// Thrown for any response the server rejected, so callers can show the real
// message instead of a generic failure.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// One place that knows how to call the API as the signed-in user. A network
// failure and a rejected request look different on purpose: the first means
// the backend is unreachable, the second means it answered and said no.
export async function apiFetch(path, { token, method = "GET", body } = {}) {
  let response;

  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError("Cannot reach the server. Is the backend running?", 0);
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error || `Request failed (${response.status})`, response.status);
  }

  return data;
}

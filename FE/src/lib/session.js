// The deployed frontend and API live on different hosts, so this is a
// build-time setting: Vite inlines it into the bundle. The fallback keeps
// `npm run dev` working with no .env file at all.
export const API_ROOT =
  import.meta.env.VITE_API_ROOT ?? "http://localhost:3000/api";
export const API_BASE = `${API_ROOT}/auth`;

const TOKEN_KEY = "stools-token";
const USER_KEY = "stools-user";

export function readSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const stored = localStorage.getItem(USER_KEY);

  if (!token || !stored) return null;

  try {
    return { token, user: JSON.parse(stored) };
  } catch {
    // A half-written or hand-edited entry is worth nothing; start clean.
    clearSession();
    return null;
  }
}

export function saveSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

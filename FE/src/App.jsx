import { useEffect, useState } from "react";
import Logo from "./components/Logo";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import { API_BASE, clearSession, readSession, saveSession } from "./lib/session";
import "./App.css";

function App() {
  const [session, setSession] = useState(() => readSession());
  // A stored token can outlive its account or simply expire, so verify it
  // against the server before showing the workspace.
  const [isVerifying, setIsVerifying] = useState(() => Boolean(readSession()));

  useEffect(() => {
    const stored = readSession();
    if (!stored) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/me`, {
          headers: { Authorization: `Bearer ${stored.token}` },
        });

        if (!response.ok) throw new Error("Session expired");

        const data = await response.json();
        if (cancelled) return;

        const fresh = { token: stored.token, user: data.data };
        saveSession(fresh);
        setSession(fresh);
      } catch {
        if (cancelled) return;
        clearSession();
        setSession(null);
      } finally {
        if (!cancelled) setIsVerifying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = () => {
    clearSession();
    setSession(null);
  };

  if (isVerifying) {
    return (
      <div className="boot-screen">
        <Logo size={64} variant="boot" />
        <span className="spinner dark" />
      </div>
    );
  }

  return session ? (
    <HomePage user={session.user} token={session.token} onSignOut={handleSignOut} />
  ) : (
    <AuthPage onAuthenticated={setSession} />
  );
}

export default App;

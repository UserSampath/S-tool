import { useMemo, useState } from "react";
import Logo from "../components/Logo";
import PinInput, { PIN_LENGTH } from "../components/PinInput";
import { EyeIcon } from "../components/icons";
import { API_BASE, saveSession } from "../lib/session";

const initialLoginState = {
  pin: "",
  email: "",
  password: "",
};

const initialRegisterState = {
  username: "",
  email: "",
  password: "",
  pin: "",
  // Ignored by the API unless the server has SIGNUP_CODE set, which is how
  // the hosted app stays closed while local development stays open.
  signupCode: "",
};

function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [loginMode, setLoginMode] = useState("pin");
  const [loginForm, setLoginForm] = useState(initialLoginState);
  const [registerForm, setRegisterForm] = useState(initialRegisterState);
  const [revealPin, setRevealPin] = useState(false);
  const [revealPassword, setRevealPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const pageTitle = useMemo(
    () => (mode === "login" ? "Welcome back" : "Create your account"),
    [mode],
  );

  const pinReady =
    mode === "login"
      ? loginForm.pin.length === PIN_LENGTH
      : registerForm.pin.length === PIN_LENGTH;

  const updateLoginField = (field) => (event) => {
    setLoginForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const updateRegisterField = (field) => (event) => {
    setRegisterForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const resetStatus = () => {
    setStatus({ type: "", message: "" });
  };

  const switchMode = (next) => {
    setMode(next);
    resetStatus();
  };

  // Takes the payload rather than reading state, so the PIN boxes can submit the
  // code they just completed without waiting for a re-render.
  const submitLogin = async (payload) => {
    if (isLoading) return;

    resetStatus();

    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to log in right now.");
      }

      const session = { token: data.token, user: data.user };
      saveSession(session);
      onAuthenticated(session);
    } catch (error) {
      setStatus({ type: "error", message: error.message });

      // Wipe the boxes so the next attempt starts clean, with the caret back on
      // the first digit.
      if (payload.pin) {
        setLoginForm((current) => ({ ...current, pin: "" }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (event) => {
    event.preventDefault();
    submitLogin(
      loginMode === "pin"
        ? { pin: loginForm.pin }
        : { email: loginForm.email, password: loginForm.password },
    );
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    resetStatus();

    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerForm),
      });

      const data = await response.json();

      if (!response.ok) {
        const details = Array.isArray(data.details)
          ? data.details.join(" • ")
          : data.error;
        throw new Error(details || "Unable to create your account.");
      }

      // Registering already returns a token, so there is nothing to log into -
      // go straight through to the workspace.
      const session = { token: data.token, user: data.user };
      saveSession(session);
      setRegisterForm(initialRegisterState);
      onAuthenticated(session);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <aside className="brand-panel">
        <div className="brand-glow" aria-hidden="true" />

        <header className="brand-head">
          <Logo size={62} variant="brand" />
          <div>
            <p className="eyebrow">Secure workspace</p>
            <h1>S tools</h1>
          </div>
        </header>

        <div className="brand-copy">
          <span className="purple-pill">
            <span className="dot" aria-hidden="true" />
            PIN-first access
          </span>
          <p>
            Keep your workflows moving with fast, safe authentication built
            around a 4-digit PIN — no password to type on trusted devices.
          </p>
        </div>

        <ul className="brand-points">
          <li>
            <strong>4-digit PIN</strong>
            <span>One tap-fast credential, hashed and rate limited.</span>
          </li>
          <li>
            <strong>Email fallback</strong>
            <span>Full email and password sign-in whenever you need it.</span>
          </li>
        </ul>
      </aside>

      <section className="auth-card">
        <div className="auth-card-inner">
          <div
            className={`mode-switcher ${mode}`}
            role="tablist"
            aria-label="Authentication mode"
          >
            <span className="mode-indicator" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>

          <div className="heading-wrap">
            <h2>{pageTitle}</h2>
            <p>
              {mode === "login"
                ? "Enter your 4-digit PIN, or switch to email login."
                : "Create your account with a password and a 4-digit PIN."}
            </p>
          </div>

          {status.message && (
            <div className={`status-banner ${status.type}`} role="status">
              {status.message}
            </div>
          )}

          {mode === "login" ? (
            <form className="auth-form" onSubmit={handleLogin}>
              {loginMode === "pin" ? (
                <>
                  <div className="field pin-field">
                    <div className="field-head">
                      <span>PIN</span>
                      <button
                        type="button"
                        className="reveal-toggle"
                        onClick={() => setRevealPin((current) => !current)}
                        aria-pressed={revealPin}
                      >
                        <EyeIcon open={revealPin} />
                        {revealPin ? "Hide" : "Show"}
                      </button>
                    </div>
                    <PinInput
                      value={loginForm.pin}
                      onChange={(pin) =>
                        setLoginForm((current) => ({ ...current, pin }))
                      }
                      onComplete={(pin) => submitLogin({ pin })}
                      masked={!revealPin}
                      disabled={isLoading}
                      autoFocus
                    />
                    <small className="field-hint">
                      Type or paste your {PIN_LENGTH}-digit PIN — it signs you in
                      automatically.
                    </small>
                  </div>

                  <button
                    type="button"
                    className="secondary-link"
                    onClick={() => setLoginMode("password")}
                  >
                    Use email and password instead
                  </button>
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={loginForm.email}
                      onChange={updateLoginField("email")}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Password</span>
                    <div className="input-wrap">
                      <input
                        type={revealPassword ? "text" : "password"}
                        value={loginForm.password}
                        onChange={updateLoginField("password")}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        className="input-action"
                        onClick={() => setRevealPassword((current) => !current)}
                        aria-label={
                          revealPassword ? "Hide password" : "Show password"
                        }
                      >
                        <EyeIcon open={revealPassword} />
                      </button>
                    </div>
                  </label>

                  <button
                    type="button"
                    className="secondary-link"
                    onClick={() => setLoginMode("pin")}
                  >
                    Back to PIN login
                  </button>
                </>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={isLoading || (loginMode === "pin" && !pinReady)}
              >
                {isLoading ? <span className="spinner" /> : null}
                {isLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegister}>
              <label className="field">
                <span>Invite code</span>
                <input
                  type="text"
                  value={registerForm.signupCode}
                  onChange={updateRegisterField("signupCode")}
                  placeholder="Only needed on the hosted app"
                  autoComplete="off"
                />
              </label>

              <label className="field">
                <span>Username</span>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={updateRegisterField("username")}
                  placeholder="Choose a username"
                  autoComplete="username"
                  required
                />
              </label>

              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={updateRegisterField("email")}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="field">
                <span>Password</span>
                <div className="input-wrap">
                  <input
                    type={revealPassword ? "text" : "password"}
                    value={registerForm.password}
                    onChange={updateRegisterField("password")}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="input-action"
                    onClick={() => setRevealPassword((current) => !current)}
                    aria-label={
                      revealPassword ? "Hide password" : "Show password"
                    }
                  >
                    <EyeIcon open={revealPassword} />
                  </button>
                </div>
              </label>

              <div className="field pin-field">
                <div className="field-head">
                  <span>PIN</span>
                  <button
                    type="button"
                    className="reveal-toggle"
                    onClick={() => setRevealPin((current) => !current)}
                    aria-pressed={revealPin}
                  >
                    <EyeIcon open={revealPin} />
                    {revealPin ? "Hide" : "Show"}
                  </button>
                </div>
                <PinInput
                  value={registerForm.pin}
                  onChange={(pin) =>
                    setRegisterForm((current) => ({ ...current, pin }))
                  }
                  masked={!revealPin}
                  disabled={isLoading}
                />
                <small className="field-hint">
                  Pick {PIN_LENGTH} digits you will remember — it becomes your
                  quick login.
                </small>
              </div>

              <button
                type="submit"
                className="primary-button"
                disabled={isLoading || !pinReady}
              >
                {isLoading ? <span className="spinner" /> : null}
                {isLoading ? "Creating account..." : "Create account"}
              </button>
            </form>
          )}

          <p className="card-footnote">
            {mode === "login"
              ? "New here? Switch to Register to set up your PIN."
              : "Already have an account? Switch to Login."}
          </p>
        </div>
      </section>
    </main>
  );
}

export default AuthPage;

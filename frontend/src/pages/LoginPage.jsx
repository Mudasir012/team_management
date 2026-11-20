import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { ROLES, useAuth } from "../auth";

export default function LoginPage({ onBack, onEnter, initialMode = "login" }) {
  const { login, register, needsSetup, serverError } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const isSignup = mode === "signup";
  const isFirstAccount = isSignup && needsSetup;

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setStatus("idle");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    try {
      if (isSignup) {
        const result = await register({ name, email, password });
        if (result?.needsConfirmation) {
          setStatus("idle");
          setError("Check your inbox to confirm your email, then log in.");
          return;
        }
      } else {
        await login({ email, password });
      }
      setStatus("success");
      onEnter();
    } catch (submitError) {
      const message = submitError instanceof TypeError
        ? "We couldn't reach the server. Check that the service is running and try again."
        : submitError.message;
      setError(message);
      setStatus("error");
    }
  }

  return (
    <div className="glass-site login-site">
      <div className="glass-grain" aria-hidden="true" />

      <div className="login-shell">
        <aside className="login-preview" aria-label="Acme Studio">
          <div className="aurora aurora--borealis aurora--soft" aria-hidden="true">
            <span className="aurora-ribbon ribbon-one" />
            <span className="aurora-ribbon ribbon-two" />
            <span className="aurora-ribbon ribbon-three" />
            <span className="aurora-veil" />
          </div>
          <div className="login-preview__inner">
            <div className="login-brand">acme<span>.</span></div>
            <div className="login-preview__copy">
              <h1>Work feels lighter when everyone can <em>see it.</em></h1>
              <p>One calm place for the brief, the next task, the right person, and the conversation that explains it.</p>
            </div>
            <div className="auth-focus">
              <div className="float-card__label"><Sparkles size={12} aria-hidden="true" /> Workspace roles</div>
              {ROLES.slice(0, 3).map(item => (
                <div className="role-preview-row" key={item.id}>
                  <span className="check-box on" aria-hidden="true"><Check aria-hidden="true" /></span>
                  <span><b>{item.label}</b><small>{item.note}</small></span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="login-panel">
          <div className="login-top">
            <button className="glass-btn text" type="button" onClick={onBack}>
              <ArrowLeft aria-hidden="true" /> Back
            </button>
            <span className="access-pill">Acme Studio</span>
          </div>

          <div className="login-content">
            <div className="auth-tabs" role="group" aria-label="Account access">
              <button
                className={`auth-tab${!isSignup ? " active" : ""}`}
                type="button"
                aria-pressed={!isSignup}
                onClick={() => switchMode("login")}
              >
                Log in
              </button>
              <button
                className={`auth-tab${isSignup ? " active" : ""}`}
                type="button"
                aria-pressed={isSignup}
                onClick={() => switchMode("signup")}
              >
                Create account
              </button>
            </div>

            <h2>{isSignup ? "Create your account." : "Welcome back."}</h2>
            <p>
              {isSignup
                ? "New accounts start as Viewer until an owner or admin assigns a role or adds you to a project."
                : "Sign in with the email and password linked to your workspace account."}
            </p>

            {isFirstAccount && (
              <div className="glass-note" role="status">
                This is the first account, so it becomes the workspace owner.
              </div>
            )}

            {(serverError || error) && <div className="glass-error" role="alert">{error || serverError}</div>}

            <form className="glass-form" onSubmit={handleSubmit}>
              {isSignup && (
                <label className="glass-field">
                  <span>Full name</span>
                  <span className="glass-input-wrap">
                    <UserRound aria-hidden="true" />
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      placeholder="Your name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </span>
                </label>
              )}

              <label className="glass-field">
                <span>Work email</span>
                <span className="glass-input-wrap">
                  <Mail aria-hidden="true" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@studio.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </span>
              </label>

              <label className="glass-field">
                <span>Password</span>
                <span className="glass-input-wrap">
                  <LockKeyhole aria-hidden="true" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    placeholder={isSignup ? "At least 8 characters" : "Enter your password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={isSignup ? 8 : undefined}
                    required
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} strokeWidth={1.6} /> : <Eye size={17} strokeWidth={1.6} />}
                  </button>
                </span>
              </label>

              <button
                className="glass-btn primary glass-submit"
                type="submit"
                disabled={status === "loading"}
              >
                {status === "loading"
                  ? isSignup ? "Creating…" : "Signing in…"
                  : isSignup ? "Create account" : "Log in"}
                <ArrowRight aria-hidden="true" />
              </button>
            </form>

            <div className="login-foot-note">
              <span><ShieldCheck aria-hidden="true" /> Sessions stay signed in across visits on this device.</span>
              <button className="glass-btn text" type="button" onClick={() => switchMode(isSignup ? "login" : "signup")}>
                {isSignup ? "Already have an account? Log in" : "New here? Create an account"}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

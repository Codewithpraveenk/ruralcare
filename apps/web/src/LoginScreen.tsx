import { useState } from "react";
import {
  CloudOff,
  HeartPulse,
  Hospital,
  Languages,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { useAuth } from "./AuthContext.tsx";
import { GoogleSignInButton } from "./GoogleSignInButton.tsx";
import { prototypeAccount, prototypePassword } from "./prototype-accounts.ts";
import { portalIntentKey, type PortalIntent } from "./portal.ts";

export default function LoginScreen() {
  const { login, register, error, clearError } = useAuth();
  const [portal, setPortal] = useState<PortalIntent>(() => {
      const saved = localStorage.getItem(portalIntentKey) as PortalIntent | null;
      localStorage.removeItem(portalIntentKey);
      return saved && ["PATIENT", "ASHA", "STAFF", "DOCTOR"].includes(saved)
        ? saved
        : "PATIENT";
    }),
    [mode, setMode] = useState<"login" | "register">("login"),
    [busy, setBusy] = useState(false),
    [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [confirmPassword, setConfirmPassword] = useState("");

  const choose = (next: PortalIntent) => {
    setPortal(next);
    setMode("login");
    setIdentifier("");
    setPassword("");
    clearError();
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "login") await login(identifier, password);
      else await register({ name, email: identifier, password, confirmPassword });
    } catch {
      // AuthContext exposes a safe user-facing error.
    } finally {
      setBusy(false);
    }
  };

  const title =
    portal === "PATIENT"
      ? "Patient & family portal"
      : portal === "ASHA"
        ? "ASHA assisted-care portal"
        : portal === "DOCTOR"
          ? "Doctor referral workspace"
          : "Staff coordination dashboard";

  const usePrototypeAccount = async () => {
    const account = prototypeAccount(portal);
    if (!account) return;
    setIdentifier(account.email);
    setPassword(prototypePassword);
    setMode("login");
    clearError();
    setBusy(true);
    try {
      await login(account.email, prototypePassword);
    } catch {
      // AuthContext exposes a safe user-facing error.
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="portal-auth-page">
      <section className="portal-auth-brand">
        <div className="auth-logo">
          <HeartPulse />
          <b>RuralCare <span>Connect</span></b>
        </div>
        <div>
          <p className="kicker">SIH PROTOTYPE</p>
          <h1>Find suitable public care.</h1>
          <p>Describe the need, complete a safety check, compare facilities, and carry one referral through follow-up.</p>
        </div>
        <div className="auth-trust">
          <span><ShieldCheck /> Not a diagnosis</span>
          <span><Languages /> Tamil · English · Tanglish</span>
          <span><CloudOff /> Core flow works offline</span>
        </div>
      </section>
      <section className="portal-auth-panel">
        <div className="portal-choice" aria-label="Choose sign in portal">
          <button className={portal === "PATIENT" ? "selected" : ""} onClick={() => choose("PATIENT")}>
            <UsersRound /><span><b>Patient / Family</b><small>Start and track my care journey</small></span>
          </button>
          <button className={portal === "ASHA" ? "selected" : ""} onClick={() => choose("ASHA")}>
            <Stethoscope /><span><b>ASHA Worker</b><small>Assist a citizen safely</small></span>
          </button>
          <button className={portal === "STAFF" ? "selected" : ""} onClick={() => choose("STAFF")}>
            <UsersRound /><span><b>Staff / Facility Admin</b><small>Coordinate referrals and capacity</small></span>
          </button>
          <button className={portal === "DOCTOR" ? "selected" : ""} onClick={() => choose("DOCTOR")}>
            <Hospital /><span><b>Doctor</b><small>Review assigned care hand-offs</small></span>
          </button>
        </div>
        <div className="portal-form">
          <p className="kicker">{portal} ACCESS</p>
          <h2>{mode === "register" ? "Create your patient account" : title}</h2>
          <p>
            {portal === "PATIENT"
              ? "Your referrals remain visible only to your account and the receiving facility."
              : portal === "ASHA"
                ? "Use your assigned frontline-worker account."
                : "Use your facility-issued doctor or administrator account."}
          </p>
          {portal === "PATIENT" && (
            <div className="auth-tabs">
              <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); clearError(); }}>Patient sign in</button>
              <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setIdentifier(""); setPassword(""); clearError(); }}>Create account</button>
            </div>
          )}
          {mode === "register" && (
            <label>Patient name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Your name" /></label>
          )}
          <label>Email<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="name@example.com" /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" /></label>
          {mode === "register" && (
            <label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></label>
          )}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" disabled={busy || !identifier.trim() || !password} onClick={submit}>
            {busy ? "Please wait…" : mode === "register" ? "Create patient account" : `Sign in to ${portal === "PATIENT" ? "patient portal" : portal === "ASHA" ? "ASHA portal" : portal === "DOCTOR" ? "doctor workspace" : "staff dashboard"}`}
          </button>
          {portal === "PATIENT" && mode === "login" && <><div className="auth-divider"><span>OR</span></div><GoogleSignInButton /></>}
          {portal !== "PATIENT" && mode === "login" && (
            <button className="prototype-account-button" onClick={() => void usePrototypeAccount()} disabled={busy}>
              Use prototype {portal === "ASHA" ? "ASHA" : portal === "DOCTOR" ? "doctor" : "staff"} account
            </button>
          )}
          <p className="auth-note">Secure role-based access · no ABHA or government identity claim</p>
        </div>
      </section>
    </main>
  );
}

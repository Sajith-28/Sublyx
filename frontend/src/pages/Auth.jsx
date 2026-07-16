import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Film, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

import { Background3D } from "../components/Background3D";
import { useToast } from "../components/Toast";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const authTabs = [
  { id: "signin", label: "Sign In" },
  { id: "signup", label: "Create Account" },
];

const GoogleIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
    />
  </svg>
);

const getFriendlyError = (error) => {
  const message = error?.message || "";
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login")) return "Invalid email or password.";
  if (normalized.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (normalized.includes("already registered")) return "An account already exists for this email.";
  if (normalized.includes("password")) return message;
  if (normalized.includes("network")) return "Network error. Please check your connection and try again.";

  return message || "Something went wrong. Please try again.";
};

const AuthInput = ({ autoComplete, disabled, icon: Icon, id, label, onChange, type, value }) => (
  <label htmlFor={id} className="block">
    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
    </span>
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        id={id}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={onChange}
        required
        type={type}
        value={value}
        className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-11 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-primary-400/60 focus:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  </label>
);

export const Auth = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("signin");
  const [mode, setMode] = useState("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isBusy = loading || googleLoading;
  const isSignup = activeTab === "signup";

  const title = useMemo(() => {
    if (mode === "reset") return "Reset password";
    return isSignup ? "Create your account" : "Welcome back";
  }, [isSignup, mode]);

  const subtitle = useMemo(() => {
    if (mode === "reset") return "We will send a reset link to your email.";
    return isSignup ? "Save projects and keep every caption timeline in sync." : "Sign in to continue to your Sublyx dashboard.";
  }, [isSignup, mode]);

  const validateConfig = () => {
    if (supabase && isSupabaseConfigured) return true;
    setError("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your frontend environment.");
    return false;
  };

  const handleGoogle = async () => {
    setError("");
    setNotice("");
    if (!validateConfig()) return;

    setGoogleLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (oauthError) throw oauthError;
    } catch (oauthError) {
      setError(getFriendlyError(oauthError));
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!validateConfig()) return;

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    if (mode === "auth" && !password) {
      setError("Enter your password.");
      return;
    }

    if (isSignup && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });

        if (resetError) throw resetError;

        addToast("Password reset link sent!", "success");
        setNotice("Check your inbox for the reset link.");
        setMode("auth");
        setActiveTab("signin");
        return;
      }

      if (activeTab === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        addToast("Signed in successfully.", "success");
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (signUpError) throw signUpError;

      if (!data.session) {
        setNotice("Account created. Check your email to confirm before signing in.");
        addToast("Confirmation email sent.", "success");
      } else {
        addToast("Account created.", "success");
      }
    } catch (authError) {
      setError(getFriendlyError(authError));
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tabId) => {
    if (isBusy || activeTab === tabId) return;
    setActiveTab(tabId);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
  };

  const showReset = () => {
    if (isBusy) return;
    setMode("reset");
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
  };

  const backToAuth = () => {
    if (isBusy) return;
    setMode("auth");
    setError("");
    setNotice("");
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Background3D />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8"
        >
          <div className="mb-7 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-cyan-500 shadow-lg shadow-primary-500/20">
                <Film className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold gradient-text-brand">Sublyx</p>
                <p className="text-xs text-slate-500">AI Captioning</p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure
            </div>
          </div>

          {mode === "auth" ? (
            <div className="mb-6 grid grid-cols-2 rounded-2xl border border-white/[0.06] bg-black/20 p-1">
              {authTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => switchTab(tab.id)}
                  className={`relative rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${
                    activeTab === tab.id ? "text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.span
                      layoutId="auth-tab"
                      className="absolute inset-0 rounded-xl bg-white/[0.08] shadow-sm"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              disabled={isBusy}
              onClick={backToAuth}
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </button>
          )}

          <div className="mb-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={`${mode}-${activeTab}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {mode === "auth" && (
                <>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleGoogle}
                    className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-bold text-slate-950 shadow-lg shadow-white/5 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/[0.08]" />
                    <span className="text-xs font-medium text-slate-500">or continue with email</span>
                    <div className="h-px flex-1 bg-white/[0.08]" />
                  </div>
                </>
              )}

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {notice && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200"
                  >
                    {notice}
                  </motion.div>
                )}
              </AnimatePresence>

              <AuthInput
                id="email"
                autoComplete="email"
                disabled={isBusy}
                icon={Mail}
                label="Email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />

              {mode === "auth" && (
                <>
                  <AuthInput
                    id="password"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    disabled={isBusy}
                    icon={Lock}
                    label="Password"
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    value={password}
                  />

                  {isSignup && (
                    <AuthInput
                      id="confirm-password"
                      autoComplete="new-password"
                      disabled={isBusy}
                      icon={Lock}
                      label="Confirm Password"
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      type="password"
                      value={confirmPassword}
                    />
                  )}

                  {!isSignup && (
                    <div className="-mt-2 flex justify-end">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={showReset}
                        className="text-sm font-medium text-slate-500 transition hover:text-primary-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-cyan-600 text-sm font-bold text-white shadow-lg shadow-primary-500/20 transition hover:from-primary-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                {mode === "reset" ? "Send reset link" : isSignup ? "Create Account" : "Sign In"}
              </button>
            </motion.form>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

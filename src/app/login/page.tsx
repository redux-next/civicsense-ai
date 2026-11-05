
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
  Leaf,
  MessageSquare,
  BrainCircuit,
} from "lucide-react";

import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/auth-provider";
import ThemeToggle from "@/components/ui/theme-toggle";

type UserProfile = {
  role?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Role-based navigation.
  const redirectAfterLogin = (profile: UserProfile) => {
    const destination =
      profile.role?.toLowerCase() === "admin"
        ? "/admin"
        : "/dashboard";

    router.replace(destination);
    router.refresh();
  };

  // Redirect already authenticated users.
  useEffect(() => {
    let cancelled = false;

    async function redirectAuthenticatedUser() {
      if (loading || !user || submitting) return;

      try {
        const token = await user.getIdToken(true);

        const response = await fetch("/api/users/profile", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.profile) {
          throw new Error("Unable to load your account profile.");
        }

        if (!cancelled) {
          redirectAfterLogin(data.profile as UserProfile);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Unable to verify your account. Please sign in again."
          );
        }
      }
    }

    void redirectAuthenticatedUser();

    return () => {
      cancelled = true;
    };
  }, [user, loading, submitting]);

  // Load profile and establish secure server session.
  async function saveProfile(): Promise<UserProfile> {
    const token = await auth.currentUser?.getIdToken(true);

    if (!token) {
      throw new Error("Unable to verify your account.");
    }

    const response = await fetch("/api/users/profile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.profile) {
      throw new Error(
        data?.error ||
          "Your account profile could not be loaded. Please sign in again."
      );
    }

    const sessionResponse = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!sessionResponse.ok) {
      const sessionError = await sessionResponse.json().catch(() => null);

      throw new Error(
        sessionError?.error ||
          "Unable to establish your secure session. Please sign in again."
      );
    }

    return data.profile as UserProfile;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      if (isRegister) {
        if (name.trim().length < 2) {
          throw new Error("Please enter your full name.");
        }

        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        await updateProfile(credential.user, {
          displayName: name.trim(),
        });
      } else {
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
      }

      const profile = await saveProfile();

      redirectAfterLogin(profile);
    } catch (err) {
      const firebaseError = err as {
        code?: string;
        message?: string;
      };

      const messages: Record<string, string> = {
        "auth/email-already-in-use":
          "An account with this email already exists.",
        "auth/invalid-email":
          "Please enter a valid email address.",
        "auth/invalid-credential":
          "Incorrect email or password.",
        "auth/user-not-found":
          "No account found with this email.",
        "auth/wrong-password":
          "Incorrect password.",
        "auth/weak-password":
          "Please use a stronger password.",
        "auth/too-many-requests":
          "Too many attempts. Please try again later.",
        "auth/network-request-failed":
          "Network error. Check your internet connection.",
      };

      setError(
        messages[firebaseError.code || ""] ||
          firebaseError.message ||
          "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setSubmitting(true);

    try {
      const provider = new GoogleAuthProvider();

      provider.setCustomParameters({
        prompt: "select_account",
      });

      await signInWithPopup(auth, provider);

      const profile = await saveProfile();

      redirectAfterLogin(profile);
    } catch (err) {
      const firebaseError = err as {
        code?: string;
        message?: string;
      };

      const messages: Record<string, string> = {
        "auth/popup-closed-by-user":
          "Google sign-in was cancelled.",
        "auth/popup-blocked":
          "Your browser blocked the Google sign-in popup. Allow popups and try again.",
        "auth/unauthorized-domain":
          "This domain is not authorized in Firebase Authentication.",
        "auth/operation-not-allowed":
          "Google sign-in is not enabled in Firebase Authentication.",
        "auth/network-request-failed":
          "Network error. Check your internet connection and try again.",
        "auth/account-exists-with-different-credential":
          "An account already exists with this email using another sign-in method.",
      };

      setError(
        messages[firebaseError.code || ""] ||
          firebaseError.message ||
          "Google sign-in failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || (user && !error) || (submitting && !error)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7f4] text-sm text-[#718078] dark:bg-[#101713] dark:text-[#a3b3a8]">
        <span className="mr-3 h-2.5 w-2.5 animate-pulse rounded-full bg-[#27845e]" />
        Preparing your campus space...
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7f3] px-4 py-5 text-[#20372e] selection:bg-[#b8e4c5] selection:text-[#173f32] dark:bg-[#101713] dark:text-[#edf5ef] sm:px-6 sm:py-8">

      {/* Ambient background */}
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-[#c8e6cf]/40 blur-[100px] dark:bg-[#245b3c]/15" />

      <div className="pointer-events-none absolute -bottom-40 right-0 h-[500px] w-[500px] rounded-full bg-[#d8e9dc]/50 blur-[120px] dark:bg-[#214e35]/15" />

      <ThemeToggle className="absolute right-6 top-6 z-30 md:right-10 md:top-10" />

      <div className="relative mx-auto grid min-h-[calc(100svh-2.5rem)] w-full max-w-7xl overflow-hidden rounded-[28px] border border-[#e2eae2] bg-white shadow-[0_35px_100px_-45px_rgba(25,62,39,0.25)] dark:border-white/[0.08] dark:bg-[#17221b] dark:shadow-[0_35px_100px_-45px_rgba(0,0,0,0.7)] md:min-h-[calc(100svh-4rem)] md:grid-cols-[1.05fr_0.95fr]">

        {/* LEFT PANEL */}
        <section className="relative isolate flex min-h-[360px] flex-col justify-between overflow-hidden bg-[#173f32] p-7 text-white sm:p-10 lg:p-14">

          {/* Decorative elements */}
          <div className="pointer-events-none absolute -right-32 -top-32 -z-10 h-[450px] w-[450px] rounded-full border border-white/[0.07]" />

          <div className="pointer-events-none absolute -right-16 -top-16 -z-10 h-[320px] w-[320px] rounded-full border border-white/[0.07]" />

          <div className="pointer-events-none absolute -bottom-40 -left-28 -z-10 h-[430px] w-[430px] rounded-full bg-[#65b982]/20 blur-[90px]" />

          <div className="pointer-events-none absolute bottom-0 right-0 -z-10 h-80 w-80 bg-gradient-to-tl from-[#8bd4a1]/10 to-transparent" />

          {/* Brand */}
          <a href="/" className="group flex w-fit items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.09] text-[#b8edc7] shadow-lg backdrop-blur-xl transition duration-300 group-hover:scale-105 group-hover:bg-white/[0.15]">
              <ShieldCheck size={24} strokeWidth={1.8} />
            </div>

            <div>
              <p className="text-xl font-extrabold tracking-[-0.055em]">
                CivicSense <span className="text-[#9bd6ad]">AI</span>
              </p>

              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-[#b7d6c1]">
                Campus, heard.
              </p>
            </div>
          </a>

          {/* Main message */}
          <div className="relative mt-14 max-w-xl md:mt-20">

            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#b2e6c1]/20 bg-[#b2e6c1]/10 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d6f3de] backdrop-blur-md">
              <Sparkles size={13} className="text-[#a6e7b8]" />
              One platform. A stronger campus.
            </div>

            <h1 className="text-[2.8rem] font-semibold leading-[1.08] tracking-[-0.065em] sm:text-6xl lg:text-[4.5rem]">
              One campus.
              <br />
              Two ways to
              <br />
              <span className="text-[#9bd6ad]">
                make change.
              </span>
            </h1>

            <p className="mt-6 max-w-md text-sm leading-7 text-[#c5dbcb] sm:text-base">
              CivicSense AI brings students together through CivicSpace
              and intelligent campus issue management. Connect, speak up,
              and turn shared concerns into meaningful action.
            </p>

            {/* Platform features */}
            <div className="mt-9 space-y-6">

              {/* CivicSpace */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.09] text-[#a7e2b9]">
                  <MessageSquare size={19} />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">
                    CivicSpace
                  </h3>

                  <p className="mt-1 max-w-sm text-xs leading-6 text-[#c5dbcb]">
                    Your campus community. Discover concerns, join
                    discussions, support complaints, and vote on what matters.
                  </p>
                </div>
              </div>

              {/* AI Issue Management */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.09] text-[#a7e2b9]">
                  <BrainCircuit size={19} />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">
                    AI-powered issue management
                  </h3>

                  <p className="mt-1 max-w-sm text-xs leading-6 text-[#c5dbcb]">
                    Submit campus complaints, get AI-assisted analysis,
                    detect duplicate reports, and follow resolution progress.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom footer */}
          <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">

            <div className="flex items-center gap-2 text-xs text-[#b9d5c1]">
              <CheckCircle2 size={15} className="text-[#9bd6ad]" />
              Your campus. Your community. Your voice.
            </div>

            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9ebba7]">
              <Leaf size={13} />
              Powered by community
            </div>

          </div>
        </section>

        {/* RIGHT PANEL */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14 xl:px-16">

          <div className="w-full max-w-[410px]">

            {/* Login heading */}
            <div className="mb-9">

              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#dcebe0] bg-[#f0f7f1] text-[#286747] dark:border-[#335342] dark:bg-[#21382a] dark:text-[#a7dfb6]">
                {isRegister ? (
                  <UserRound size={22} strokeWidth={1.8} />
                ) : (
                  <Fingerprint size={22} strokeWidth={1.8} />
                )}
              </div>

              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6b9a7c] dark:text-[#a0c9aa]">
                {isRegister
                  ? "Join the community"
                  : "Your campus community awaits"}
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.055em] text-[#203c30] dark:text-[#eff8f0] sm:text-[2.55rem]">
                {isRegister ? "Create account." : "Welcome back."}
              </h2>

              <p className="mt-3 text-sm leading-6 text-[#87948b] dark:text-[#a3b1a7]">
                {isRegister
                  ? "Join CivicSpace, connect with your campus, and help create meaningful change."
                  : "Access CivicSpace, report campus concerns, and stay connected with every update."}
              </p>
            </div>

            {/* Authentication form */}
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Full name */}
              {isRegister && (
                <div>
                  <label
                    htmlFor="name"
                    className="mb-2 block text-xs font-semibold text-[#43594b] dark:text-[#d1e0d4]"
                  >
                    Full name
                  </label>

                  <div className="group flex items-center rounded-xl border border-[#e2eae2] bg-[#fafcf9] px-3.5 transition-all duration-200 focus-within:border-[#70a987] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#e8f3ea] dark:border-white/10 dark:bg-white/[0.04] dark:focus-within:border-[#659a76] dark:focus-within:bg-white/[0.07] dark:focus-within:ring-[#4b805a]/15">

                    <UserRound
                      size={17}
                      className="shrink-0 text-[#91a095] transition-colors group-focus-within:text-[#36764f]"
                    />

                    <input
                      id="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      autoComplete="name"
                      className="min-w-0 w-full bg-transparent px-3 py-3.5 text-sm text-[#263d30] outline-none placeholder:text-[#a4afa7] dark:text-white dark:placeholder:text-[#718078]"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-semibold text-[#43594b] dark:text-[#d1e0d4]"
                >
                  Email address
                </label>

                <div className="group flex items-center rounded-xl border border-[#e2eae2] bg-[#fafcf9] px-3.5 transition-all duration-200 focus-within:border-[#70a987] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#e8f3ea] dark:border-white/10 dark:bg-white/[0.04] dark:focus-within:border-[#659a76] dark:focus-within:bg-white/[0.07] dark:focus-within:ring-[#4b805a]/15">

                  <Mail
                    size={17}
                    className="shrink-0 text-[#91a095] transition-colors group-focus-within:text-[#36764f]"
                  />

                  <input
                    id="email"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@university.edu"
                    autoComplete="email"
                    className="min-w-0 w-full bg-transparent px-3 py-3.5 text-sm text-[#263d30] outline-none placeholder:text-[#a4afa7] dark:text-white dark:placeholder:text-[#718078]"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-xs font-semibold text-[#43594b] dark:text-[#d1e0d4]"
                >
                  Password
                </label>

                <div className="group flex items-center rounded-xl border border-[#e2eae2] bg-[#fafcf9] px-3.5 transition-all duration-200 focus-within:border-[#70a987] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#e8f3ea] dark:border-white/10 dark:bg-white/[0.04] dark:focus-within:border-[#659a76] dark:focus-within:bg-white/[0.07] dark:focus-within:ring-[#4b805a]/15">

                  <LockKeyhole
                    size={17}
                    className="shrink-0 text-[#91a095] transition-colors group-focus-within:text-[#36764f]"
                  />

                  <input
                    id="password"
                    required
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete={
                      isRegister ? "new-password" : "current-password"
                    }
                    className="min-w-0 w-full bg-transparent px-3 py-3.5 text-sm text-[#263d30] outline-none placeholder:text-[#a4afa7] dark:text-white dark:placeholder:text-[#718078]"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="shrink-0 rounded-lg p-1.5 text-[#8b9a8f] transition hover:bg-[#edf4ee] hover:text-[#315d42] dark:hover:bg-white/10"
                  >
                    {showPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
                >
                  <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                  <span className="break-words">{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="group relative mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#246647] px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(36,102,71,0.8)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1b5539] hover:shadow-[0_14px_30px_-12px_rgba(36,102,71,0.75)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="relative z-10">
                  {submitting
                    ? "Please wait..."
                    : isRegister
                      ? "Create your account"
                      : "Sign in to CivicSense"}
                </span>

                {!submitting && (
                  <ArrowRight
                    size={17}
                    className="relative z-10 transition-transform duration-200 group-hover:translate-x-1"
                  />
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-[#e9eee9] dark:bg-white/10" />

              <span className="text-[9px] font-bold tracking-[0.18em] text-[#a1aca3]">
                OR CONTINUE WITH
              </span>

              <div className="h-px flex-1 bg-[#e9eee9] dark:bg-white/10" />
            </div>

            {/* Google sign-in */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting || loading}
              className="group flex min-h-[51px] w-full items-center justify-center gap-3 rounded-xl border border-[#e1e8e1] bg-white px-5 py-3.5 text-sm font-semibold text-[#46564b] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c4d4c6] hover:bg-[#fafcf9] hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-[#e0ebe2] dark:hover:bg-white/[0.08]"
            >
              <svg
                viewBox="0 0 48 48"
                className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.02 13.22l7.98 6.19C11.88 13.72 17.46 9.5 24 9.5Z"
                />

                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.72 7.18l7.62 5.91c4.44-4.1 7.14-10.14 7.14-17.56Z"
                />

                <path
                  fill="#FBBC05"
                  d="M9.99 28.59A14.4 14.4 0 0 1 9.2 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.57 10.78l7.42-6.19Z"
                />

                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.91-5.89l-7.62-5.91c-2.12 1.42-4.84 2.26-8.29 2.26-6.54 0-12.12-4.22-14-9.91l-7.42 6.19C6.51 42.62 14.62 48 24 48Z"
                />
              </svg>

              Continue with Google
            </button>

            {/* Register / Login switch */}
            <div className="mt-8 text-center text-sm text-[#87948b] dark:text-[#9eada2]">
              {isRegister
                ? "Already have an account?"
                : "New to CivicSense?"}{" "}

              <button
                type="button"
                onClick={() => {
                  setIsRegister((current) => !current);
                  setError("");
                }}
                className="font-bold text-[#2b704b] transition hover:text-[#194b32] dark:text-[#a5d8b2] dark:hover:text-[#c3ebcb]"
              >
                {isRegister ? "Sign in" : "Create an account"}
              </button>
            </div>

            {/* Security footer */}
            <div className="mt-9 flex items-center justify-center gap-2 text-center text-[10px] leading-5 text-[#a0aaa2] dark:text-[#819087]">
              <LockKeyhole size={12} />
              Secure authentication · Your information stays protected
            </div>

          </div>
        </section>
      </div>

      {/* Copyright */}
      <p className="relative mt-5 text-center text-[10px] tracking-wide text-[#9aa79d] dark:text-[#728077]">
        © {new Date().getFullYear()} CivicSense AI. Built for better campuses.
      </p>
    </main>
  );
}

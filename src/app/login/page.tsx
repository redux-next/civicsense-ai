"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/auth-provider";
import ThemeToggle from "@/components/ui/theme-toggle";

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

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function saveProfile() {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) throw new Error("Unable to verify your account.");
    const response = await fetch("/api/users/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error("Your account was created, but profile setup failed. Please sign in again.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isRegister) {
        if (name.trim().length < 2) throw new Error("Please enter your full name.");
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await saveProfile();
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        await saveProfile();
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7f4] text-sm text-[#718078]">
        <span className="mr-3 h-2.5 w-2.5 animate-pulse rounded-full bg-[#27845e]" />
        Preparing your campus space...
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#f5f7f4] px-4 py-5 text-[#20372e] sm:px-6 sm:py-8">
      <ThemeToggle className="absolute right-6 top-6 z-20 md:right-10 md:top-10" />
      <div className="mx-auto grid min-h-[calc(100svh-2.5rem)] w-full max-w-6xl overflow-hidden rounded-[30px] border border-[#e3ebe3] bg-white shadow-[0_30px_90px_-50px_rgba(27,62,42,0.35)] md:min-h-[calc(100svh-4rem)] md:grid-cols-[1.02fr_0.98fr]">
        <section className="relative isolate flex min-h-[240px] flex-col justify-between overflow-hidden bg-[#173f32] p-6 text-white sm:p-9 md:min-h-full md:p-12 lg:p-14">
          <div className="pointer-events-none absolute -right-24 -top-28 -z-10 h-80 w-80 rounded-full border-[48px] border-white/[0.05]" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 -z-10 h-80 w-80 rounded-full bg-[#4d9a70]/25 blur-3xl" />
          <a href="/" className="flex w-fit items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#c9f0d6] ring-1 ring-white/15">
              <ShieldCheck size={23} />
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-[-0.04em]">CivicSense <span className="text-[#9bd6ad]">AI</span></p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#b8d5c2]">Campus, heard.</p>
            </div>
          </a>

          <div className="relative mt-10 max-w-lg md:mt-16">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#d4eadb]">
              <Sparkles size={13} className="text-[#a7e2b9]" /> A smarter way to care for campus
            </div>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-[-0.055em] sm:text-5xl lg:text-[3.5rem]">
              Small reports.<br />Meaningful change.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#d0e2d6] sm:text-base">
              Make your voice part of a better campus. Report issues in Assamese or English, understand what needs attention, and follow progress from one place.
            </p>
            <div className="mt-7 flex flex-wrap gap-2 text-[11px] font-semibold text-[#d4eadb]">
              <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-2">অসমীয়া + English</span>
              <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-2">AI-assisted insights</span>
              <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-2">Transparent tracking</span>
            </div>
          </div>

          <div className="mt-10 hidden items-center gap-2 text-xs text-[#b8d5c2] md:flex">
            <CheckCircle2 size={15} className="text-[#9bd6ad]" />
            Your campus. Your voice. Shared progress.
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-9 sm:px-10 md:px-9 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b9a7c]">{isRegister ? "Join the community" : "Student portal"}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-[#203c30] sm:text-[2.15rem]">
                {isRegister ? "Create your account" : "Welcome back"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#849188]">
                {isRegister ? "Set up your account and help improve campus life." : "Sign in to report issues and keep track of your campus reports."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div>
                  <label htmlFor="name" className="mb-2 block text-xs font-bold text-[#43594b]">Full name</label>
                  <div className="flex items-center rounded-xl border border-[#e2e9e2] bg-[#fbfcfa] px-3.5 transition focus-within:border-[#76a98a] focus-within:ring-4 focus-within:ring-[#e7f2e9]">
                    <UserRound size={17} className="shrink-0 text-[#91a095]" />
                    <input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="name" className="min-w-0 w-full bg-transparent px-3 py-3.5 text-sm text-[#263d30] outline-none placeholder:text-[#a4afa7]" />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-2 block text-xs font-bold text-[#43594b]">Email address</label>
                <div className="flex items-center rounded-xl border border-[#e2e9e2] bg-[#fbfcfa] px-3.5 transition focus-within:border-[#76a98a] focus-within:ring-4 focus-within:ring-[#e7f2e9]">
                  <Mail size={17} className="shrink-0 text-[#91a095]" />
                  <input id="email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" autoComplete="email" className="min-w-0 w-full bg-transparent px-3 py-3.5 text-sm text-[#263d30] outline-none placeholder:text-[#a4afa7]" />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-xs font-bold text-[#43594b]">Password</label>
                <div className="flex items-center rounded-xl border border-[#e2e9e2] bg-[#fbfcfa] px-3.5 transition focus-within:border-[#76a98a] focus-within:ring-4 focus-within:ring-[#e7f2e9]">
                  <LockKeyhole size={17} className="shrink-0 text-[#91a095]" />
                  <input id="password" required type={showPassword ? "text" : "password"} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={isRegister ? "new-password" : "current-password"} className="min-w-0 w-full bg-transparent px-3 py-3.5 text-sm text-[#263d30] outline-none placeholder:text-[#a4afa7]" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="shrink-0 p-1 text-[#8b9a8f] hover:text-[#315d42]">
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && <p role="alert" className="break-words rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">{error}</p>}

              <button type="submit" disabled={submitting} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#246647] px-4 py-3.5 text-sm font-bold text-white shadow-[0_8px_18px_-10px_rgba(36,102,71,0.8)] transition hover:-translate-y-0.5 hover:bg-[#1b5539] disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>

            <div className="my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#edf1ed]" />
              <span className="text-[10px] font-medium text-[#a1aca3]">CIVICSENSE AI</span>
              <div className="h-px flex-1 bg-[#edf1ed]" />
            </div>

            <p className="text-center text-sm text-[#819087]">
              {isRegister ? "Already have an account?" : "New to CivicSense?"}{" "}
              <button type="button" onClick={() => { setIsRegister(!isRegister); setError(""); }} className="font-bold text-[#2b704b] hover:text-[#194b32]">
                {isRegister ? "Sign in" : "Create an account"}
              </button>
            </p>

            <p className="mt-8 text-center text-[10px] leading-5 text-[#a2ada4]">
              By continuing, you agree to use CivicSense responsibly and provide accurate campus information.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

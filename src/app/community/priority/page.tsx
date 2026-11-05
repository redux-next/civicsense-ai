
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  MapPin,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { auth } from "@/lib/firebase/client";

type Complaint = {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  department: string;
  status: string;
  image: { secureUrl: string } | null;
  voteCount: number;
  upvoteCount: number;
  downvoteCount: number;
  myVote: number;
  createdAt: string | null;
};

type Sort = "priority" | "trending" | "latest";

const categories = [
  "all",
  "uncategorized",
  "infrastructure",
  "electricity",
  "water",
  "cleanliness",
  "hostel",
  "internet",
  "other",
];

const statuses = [
  "all",
  "submitted",
  "under_review",
  "in_progress",
  "resolved",
];

const label = (value: string) =>
  (value || "Uncategorized")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const timestamp = (value: string | null) => {
  if (!value) return 0;
  const result = new Date(value).getTime();
  return Number.isNaN(result) ? 0 : result;
};

const dateLabel = (value: string | null) => {
  if (!value || !timestamp(value)) return "Recently submitted";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const statusStyle = (status: string) => {
  switch (status) {
    case "resolved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300";
    case "in_progress":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300";
    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
};

const surface =
  "border border-[var(--border)] bg-[var(--surface)] shadow-sm";

const mutedText = "text-[var(--muted)]";

function VoteButton({
  direction,
  active,
  count,
  disabled,
  onClick,
}: {
  direction: "up" | "down";
  active: boolean;
  count: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;

  const activeStyle =
    direction === "up"
      ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300"
      : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${direction === "up" ? "Upvote" : "Downvote"} complaint`}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? activeStyle
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 dark:hover:border-violet-800 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
      }`}
    >
      <Icon size={15} />
      {count}
    </button>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number;
  description: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <div
      className={`${surface} group rounded-2xl p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-medium ${mutedText}`}>{title}</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
            {value}
          </p>
          <p className={`mt-1 text-xs ${mutedText}`}>{description}</p>
        </div>

        <div className={`rounded-xl p-3 ${accent}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600 dark:border-violet-950 dark:border-t-violet-400" />
        <p className="text-sm font-semibold text-[var(--muted)]">
          Loading CivicSpace...
        </p>
      </div>
    </main>
  );
}

export default function CommunityPriorityPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<Sort>("priority");
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
  }, []);

  const loadComplaints = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");

    try {
      const token = await currentUser.getIdToken();

      const response = await fetch("/api/community", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load community issues.");
      }

      setComplaints(data.complaints ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadComplaints(user);
    } else if (!authLoading) {
      setComplaints([]);
      setLoading(false);
    }
  }, [user, authLoading, loadComplaints]);

  async function handleVote(complaint: Complaint, value: 1 | -1) {
    if (!user || votingId) return;

    setVotingId(complaint.id);
    setError("");

    try {
      const token = await user.getIdToken();

      const response = await fetch(
        `/api/community/${encodeURIComponent(complaint.id)}/vote`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ value }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to submit vote.");
      }

      setComplaints((previous) =>
        previous.map((item) =>
          item.id === complaint.id ? { ...item, ...data } : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to vote.");
    } finally {
      setVotingId(null);
    }
  }

  const metrics = useMemo(() => {
    const total = complaints.length;
    const resolved = complaints.filter(
      (item) => item.status === "resolved"
    ).length;
    const inProgress = complaints.filter(
      (item) => item.status === "in_progress"
    ).length;
    const open = complaints.filter(
      (item) => item.status !== "resolved"
    ).length;

    return { total, resolved, inProgress, open };
  }, [complaints]);

  const totalVotes = useMemo(
    () =>
      complaints.reduce(
        (sum, item) =>
          sum + (item.upvoteCount || 0) + (item.downvoteCount || 0),
        0
      ),
    [complaints]
  );

  const filtered = useMemo(() => {
    let result = [...complaints];

    if (category !== "all") {
      result = result.filter((item) => item.category === category);
    }

    if (status !== "all") {
      result = result.filter((item) => item.status === status);
    }

    if (search.trim()) {
      const query = search.toLowerCase();

      result = result.filter((item) =>
        [
          item.title,
          item.description,
          item.location,
          item.department,
          item.category,
        ].some((value) => value?.toLowerCase().includes(query))
      );
    }

    if (sort === "latest") {
      result.sort(
        (a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)
      );
    } else if (sort === "trending") {
      result.sort(
        (a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0)
      );
    } else {
      result.sort(
        (a, b) => (b.voteCount || 0) - (a.voteCount || 0)
      );
    }

    return result;
  }, [complaints, category, status, search, sort]);

  const insights = useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    const locationCounts: Record<string, number> = {};

    complaints.forEach((item) => {
      const categoryName = item.category || "uncategorized";
      categoryCounts[categoryName] =
        (categoryCounts[categoryName] || 0) + 1;

      if (item.location?.trim()) {
        locationCounts[item.location] =
          (locationCounts[item.location] || 0) + 1;
      }
    });

    const topCategory = Object.entries(categoryCounts).sort(
      (a, b) => b[1] - a[1]
    )[0];

    const topLocation = Object.entries(locationCounts).sort(
      (a, b) => b[1] - a[1]
    )[0];

    const topComplaint = [...complaints].sort(
      (a, b) => (b.voteCount || 0) - (a.voteCount || 0)
    )[0];

    return { topCategory, topLocation, topComplaint };
  }, [complaints]);

  const resolutionRate =
    metrics.total > 0
      ? Math.round((metrics.resolved / metrics.total) * 100)
      : 0;

  if (authLoading || loading) return <LoadingScreen />;

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
        <div className={`${surface} w-full max-w-md rounded-3xl p-8 text-center`}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <Users size={28} />
          </div>

          <h1 className="mt-5 text-2xl font-extrabold text-[var(--foreground)]">
            Welcome to CivicSpace
          </h1>

          <p className={`mt-3 text-sm leading-6 ${mutedText}`}>
            Sign in to explore community issues, share your voice and
            support the problems that need attention.
          </p>

          <a
            href="/login"
            className="mt-6 inline-flex rounded-xl bg-violet-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/10 transition hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-500"
          >
            Sign in to continue
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-5 py-7 lg:flex">
          <a href="/community" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-700 text-xl font-extrabold text-white shadow-lg shadow-violet-900/15 dark:bg-violet-600">
              C
            </div>

            <div>
              <p className="text-lg font-extrabold tracking-tight">
                CivicSpace
              </p>
              <p className={`text-xs ${mutedText}`}>
                Community platform
              </p>
            </div>
          </a>

          <p className={`mb-3 mt-10 px-3 text-[10px] font-bold uppercase tracking-[0.18em] ${mutedText}`}>
            Community
          </p>

          <nav className="space-y-1">
            <a
              href="/community"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[var(--muted)] transition hover:bg-violet-50 hover:text-violet-800 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
            >
              <Users size={18} />
              Community feed
            </a>

            <a
              href="/community/priority"
              aria-current="page"
              className="flex items-center gap-3 rounded-xl bg-violet-50 px-3 py-3 text-sm font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-300"
            >
              <ShieldAlert size={18} />
              Community Priority
              <span className="ml-auto h-2 w-2 rounded-full bg-violet-600 dark:bg-violet-400" />
            </a>
          </nav>

          <div className="mt-auto overflow-hidden rounded-2xl bg-gradient-to-br from-violet-950 via-violet-900 to-violet-700 p-4 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
              <Sparkles size={18} />
            </div>

            <p className="mt-3 text-sm font-bold">
              Your voice matters.
            </p>

            <p className="mt-2 text-xs leading-5 text-violet-100/75">
              Community feedback helps bring important issues into focus
              and encourages meaningful change.
            </p>
          </div>

          <a
            href="/dashboard"
            className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-3 text-sm font-semibold text-[var(--muted)] transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
          >
            <Activity size={18} />
            CivicSense AI
            <ChevronRight size={15} className="ml-auto" />
          </a>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1 pb-24 lg:pb-0">
          <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 py-4 backdrop-blur-xl sm:px-7">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <div>
                <p className="text-lg font-extrabold lg:hidden">
                  CivicSpace
                </p>

                <p className="hidden text-sm font-semibold text-[var(--muted)] lg:block">
                  CivicSpace / Community Priority
                </p>

                <p className={`text-xs ${mutedText}`}>
                  Community-powered campus issue prioritisation
                </p>
              </div>

              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-xs font-bold text-[var(--muted)] transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
              >
                CivicSense AI
                <ChevronRight size={14} />
              </a>
            </div>
          </header>

          <div className="mx-auto max-w-6xl space-y-8 px-4 py-7 sm:px-7">
            {/* Hero */}
            <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-violet-900 to-violet-700 p-6 text-white shadow-xl shadow-violet-950/10 sm:p-9">
              <div className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full border-[35px] border-white/[0.05]" />
              <div className="pointer-events-none absolute -bottom-32 right-32 -z-10 h-64 w-64 rounded-full bg-violet-300/15 blur-3xl" />
              <div className="pointer-events-none absolute right-0 top-0 -z-10 h-full w-1/2 bg-gradient-to-l from-white/[0.04] to-transparent" />

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-100 backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
                  CivicSpace · Community Priority
                </div>

                <div className="mt-6 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                  <div>
                    <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                      Community voices.
                      <br />
                      <span className="text-violet-200">
                        Real priorities.
                      </span>
                    </h1>

                    <p className="mt-4 max-w-xl text-sm leading-6 text-violet-100/80">
                      Discover reported campus problems, understand
                      community support, and follow their resolution
                      progress together.
                    </p>
                  </div>

                  <a
                    href="/dashboard"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-violet-900 shadow-lg transition hover:bg-violet-50"
                  >
                    Report an issue
                    <ArrowUp size={16} />
                  </a>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-white/10 pt-5 text-xs text-violet-100/75">
                  <span className="inline-flex items-center gap-2">
                    <Activity size={14} />
                    {metrics.total} community reports
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Users size={14} />
                    {totalVotes} community votes
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    {resolutionRate}% resolved
                  </span>
                </div>
              </div>
            </section>

            {/* Overview */}
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                    Community overview
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold">
                    Issue summary
                  </h2>
                </div>

                <span className={`text-xs ${mutedText}`}>
                  Based on loaded reports
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <MetricCard
                  title="Total reports"
                  value={metrics.total}
                  description="All submitted community issues"
                  icon={MessageSquare}
                  accent="bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
                />

                <MetricCard
                  title="Needs attention"
                  value={metrics.open}
                  description="Not yet resolved"
                  icon={ShieldAlert}
                  accent="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                />

                <MetricCard
                  title="In progress"
                  value={metrics.inProgress}
                  description="Currently being addressed"
                  icon={Clock3}
                  accent="bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                />

                <MetricCard
                  title="Resolved"
                  value={metrics.resolved}
                  description={`${resolutionRate}% resolution rate`}
                  icon={CheckCircle2}
                  accent="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                />
              </div>
            </section>

            {/* Community pulse and insights */}
            <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className={`${surface} rounded-2xl p-5 sm:p-6`}>
                <div className="flex items-center gap-2">
                  <TrendingUp size={19} className="text-violet-700 dark:text-violet-400" />
                  <h2 className="font-bold">Community pulse</h2>
                </div>

                <p className={`mt-1 text-xs ${mutedText}`}>
                  How the community is engaging with reported issues.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-[var(--surface-secondary)] p-4">
                    <p className={`text-xs font-medium ${mutedText}`}>
                      Total community votes
                    </p>
                    <p className="mt-2 text-2xl font-extrabold tabular-nums">
                      {totalVotes}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[var(--surface-secondary)] p-4">
                    <p className={`text-xs font-medium ${mutedText}`}>
                      Resolution progress
                    </p>
                    <p className="mt-2 text-2xl font-extrabold tabular-nums">
                      {resolutionRate}%
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-xs">
                    <span className={`font-semibold ${mutedText}`}>
                      Resolved reports
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {metrics.resolved}/{metrics.total}
                    </span>
                  </div>

                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950"
                    role="progressbar"
                    aria-valuenow={resolutionRate}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Resolution progress"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-emerald-400 transition-all duration-500"
                      style={{ width: `${resolutionRate}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className={`${surface} rounded-2xl p-5 sm:p-6`}>
                <div className="flex items-center gap-2">
                  <Sparkles size={19} className="text-violet-700 dark:text-violet-400" />
                  <h2 className="font-bold">Community insights</h2>
                </div>

                <p className={`mt-1 text-xs ${mutedText}`}>
                  Patterns calculated from the available complaint data.
                </p>

                <div className="mt-5 space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-violet-50 p-2 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                      <Activity size={17} />
                    </div>

                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${mutedText}`}>
                        Most reported category
                      </p>
                      <p className="mt-1 truncate text-sm font-bold">
                        {insights.topCategory
                          ? label(insights.topCategory[0])
                          : "No data yet"}
                      </p>
                      {insights.topCategory && (
                        <p className={`mt-0.5 text-xs ${mutedText}`}>
                          {insights.topCategory[1]} reports
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      <MapPin size={17} />
                    </div>

                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${mutedText}`}>
                        Most reported location
                      </p>
                      <p className="mt-1 truncate text-sm font-bold">
                        {insights.topLocation?.[0] ?? "No location data"}
                      </p>
                      {insights.topLocation && (
                        <p className={`mt-0.5 text-xs ${mutedText}`}>
                          {insights.topLocation[1]} reports
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-violet-50 p-2 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                      <TrendingUp size={17} />
                    </div>

                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${mutedText}`}>
                        Highest community support
                      </p>
                      <p className="mt-1 truncate text-sm font-bold">
                        {insights.topComplaint?.title ?? "No reports yet"}
                      </p>
                      {insights.topComplaint && (
                        <p className={`mt-0.5 text-xs ${mutedText}`}>
                          {insights.topComplaint.voteCount} priority votes
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Priority list */}
            <section id="priority-list" className="scroll-mt-24">
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                    Community-driven ranking
                  </p>

                  <h2 className="mt-1 text-2xl font-extrabold">
                    Community issues
                  </h2>

                  <p className={`mt-1 text-sm ${mutedText}`}>
                    Explore reports and support the issues that matter.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => user && void loadComplaints(user)}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs font-bold text-[var(--muted)] transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50 dark:hover:border-violet-800 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
                >
                  <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                  Refresh reports
                </button>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => setError("")}
                    aria-label="Dismiss error"
                  >
                    <X size={17} />
                  </button>
                </div>
              )}

              {/* Filters */}
              <div className={`${surface} rounded-2xl p-4 sm:p-5`}>
                <div className="grid gap-3 md:grid-cols-[1fr_190px_190px]">
                  <div className="relative">
                    <Search
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                    />

                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search title, location or issue..."
                      className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-background)] py-3 pl-11 pr-4 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                    />
                  </div>

                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    aria-label="Filter by category"
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-background)] px-3 py-3 text-sm text-[var(--foreground)] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                  >
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item === "all" ? "All categories" : label(item)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    aria-label="Filter by status"
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-background)] px-3 py-3 text-sm text-[var(--foreground)] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                  >
                    {statuses.map((item) => (
                      <option key={item} value={item}>
                        {item === "all" ? "All statuses" : label(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={`mr-1 inline-flex items-center gap-1 text-xs font-semibold ${mutedText}`}>
                    <Filter size={13} />
                    Sort:
                  </span>

                  {(
                    [
                      ["priority", "Top priority"],
                      ["trending", "Most supported"],
                      ["latest", "Latest"],
                    ] as [Sort, string][]
                  ).map(([value, text]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSort(value)}
                      className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                        sort === value
                          ? "bg-violet-700 text-white shadow-md shadow-violet-900/10 dark:bg-violet-600"
                          : "bg-[var(--surface-secondary)] text-[var(--muted)] hover:bg-violet-50 hover:text-violet-800 dark:hover:bg-violet-950/50 dark:hover:text-violet-300"
                      }`}
                    >
                      {text}
                    </button>
                  ))}

                  <span className={`ml-auto text-xs font-medium ${mutedText}`}>
                    {filtered.length} of {complaints.length} reports
                  </span>
                </div>
              </div>

              {/* Complaint cards */}
              <div className="mt-5 space-y-4">
                {filtered.length === 0 ? (
                  <div className={`${surface} rounded-2xl border-dashed px-6 py-16 text-center`}>
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                      <Search size={24} />
                    </div>

                    <h3 className="mt-4 font-bold">
                      No community issues found
                    </h3>

                    <p className={`mt-2 text-sm ${mutedText}`}>
                      Try a different search or adjust your filters.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setCategory("all");
                        setStatus("all");
                      }}
                      className="mt-4 text-xs font-bold text-violet-700 hover:underline dark:text-violet-400"
                    >
                      Clear all filters
                    </button>
                  </div>
                ) : (
                  filtered.map((item, index) => (
                    <article
                      key={item.id}
                      className={`${surface} overflow-hidden rounded-2xl transition duration-200 hover:-translate-y-0.5 hover:shadow-md`}
                    >
                      {item.image?.secureUrl && (
                        <img
                          src={item.image.secureUrl}
                          alt={`Evidence for ${item.title}`}
                          className="max-h-72 w-full object-cover"
                          loading="lazy"
                        />
                      )}

                      <div className="p-5 sm:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                              {label(item.category)}
                            </span>

                            <span
                              className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${statusStyle(item.status)}`}
                            >
                              {label(item.status)}
                            </span>
                          </div>

                          <span className={`text-xs font-semibold ${mutedText}`}>
                            #{index + 1} in this view
                          </span>
                        </div>

                        <div className="mt-4">
                          <h3 className="text-lg font-extrabold leading-snug">
                            {item.title}
                          </h3>

                          <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${mutedText}`}>
                            {item.description}
                          </p>
                        </div>

                        <div className={`mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs ${mutedText}`}>
                          {item.location && (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin size={14} />
                              {item.location}
                            </span>
                          )}

                          {item.department && (
                            <span className="inline-flex items-center gap-1.5">
                              <Users size={14} />
                              {label(item.department)}
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 size={14} />
                            {dateLabel(item.createdAt)}
                          </span>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <VoteButton
                              direction="up"
                              count={item.upvoteCount || 0}
                              active={item.myVote === 1}
                              disabled={votingId !== null}
                              onClick={() => handleVote(item, 1)}
                            />

                            <VoteButton
                              direction="down"
                              count={item.downvoteCount || 0}
                              active={item.myVote === -1}
                              disabled={votingId !== null}
                              onClick={() => handleVote(item, -1)}
                            />

                            {votingId === item.id && (
                              <span className={`text-xs ${mutedText}`}>
                                Saving vote...
                              </span>
                            )}
                          </div>

                          <div className="text-right">
                            <p className="text-2xl font-extrabold tabular-nums text-violet-700 dark:text-violet-400">
                              {item.voteCount || 0}
                            </p>

                            <p className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>
                              Community priority
                            </p>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <footer className={`border-t border-[var(--border)] py-7 text-center text-xs ${mutedText}`}>
              CivicSpace · Making community voices count.
            </footer>
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-[var(--border)] bg-[var(--surface)]/95 px-2 py-2 backdrop-blur-xl lg:hidden">
        <a
          href="/community"
          className="flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold text-[var(--muted)] transition hover:text-violet-700 dark:hover:text-violet-400"
        >
          <Users size={19} />
          Community
        </a>

        <a
          href="/community/priority"
          aria-current="page"
          className="flex flex-col items-center gap-1 rounded-xl bg-violet-50 py-2 text-xs font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-300"
        >
          <ShieldAlert size={19} />
          Priority
        </a>

        <a
          href="/dashboard"
          className="flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold text-[var(--muted)] transition hover:text-emerald-700 dark:hover:text-emerald-400"
        >
          <Activity size={19} />
          CivicSense
        </a>
      </nav>
    </main>
  );
}

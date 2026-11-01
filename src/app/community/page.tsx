
"use client";

import { unstable_rethrow } from "next/navigation";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

type Complaint = {
  id: string;
  title: string;
  description: string;
  language: string;
  location: string;
  category: string;
  priority: string;
  department: string;
  status: string;
  image: { secureUrl: string } | null;
  voteCount: number;
  upvoteCount: number;
  downvoteCount: number;
  myVote: number;
  createdAt: string | null;
};

type Filter = "all" | "trending" | "latest";

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

const statusOptions = [
  "all",
  "submitted",
  "under_review",
  "in_progress",
  "resolved",
];

function formatDate(date: string | null) {
  if (!date) return "Recently submitted";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) =>
    char.toUpperCase()
  );
}

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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${direction === "up" ? "Upvote" : "Downvote"} (${count})`}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? direction === "up"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
            : "border-rose-500/40 bg-rose-500/10 text-rose-600"
          : "border-[var(--community-border)] text-[var(--community-muted)] hover:border-emerald-500/40 hover:text-emerald-600"
      }`}
    >
      <span className="text-lg leading-none">
        {direction === "up" ? "↑" : "↓"}
      </span>
      {count}
    </button>
  );
}

export default function CommunityPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
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
        throw new Error(data.error ?? "Unable to load complaints.");
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
      setLoading(false);
      setComplaints([]);
    }
  }, [user, authLoading, loadComplaints]);

  async function handleVote(
    complaint: Complaint,
    value: 1 | -1
  ) {
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
        throw new Error(data.error ?? "Unable to submit your vote.");
      }

      setComplaints((previous) =>
        previous.map((item) =>
          item.id === complaint.id
            ? {
                ...item,
                myVote: data.myVote,
                voteCount: data.voteCount,
                upvoteCount: data.upvoteCount,
                downvoteCount: data.downvoteCount,
              }
            : item
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to submit your vote."
      );
    } finally {
      setVotingId(null);
    }
  }

  const filteredComplaints = useMemo(() => {
    let result = [...complaints];

    if (category !== "all") {
      result = result.filter((item) => item.category === category);
    }

    if (status !== "all") {
      result = result.filter((item) => item.status === status);
    }

    if (search.trim()) {
      const query = search.toLowerCase();

      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.location.toLowerCase().includes(query)
      );
    }

    if (filter === "trending") {
      result.sort((a, b) => b.voteCount - a.voteCount);
    } else if (filter === "latest") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      );
    } else {
      result.sort((a, b) => b.voteCount - a.voteCount);
    }

    return result;
  }, [complaints, category, status, search, filter]);

  const totalVotes = complaints.reduce(
    (sum, item) => sum + item.upvoteCount + item.downvoteCount,
    0
  );

  const resolvedCount = complaints.filter(
    (item) => item.status === "resolved"
  ).length;

  const topComplaint = [...complaints].sort(
    (a, b) => b.voteCount - a.voteCount
  )[0];

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--community-bg,#f7f9f7)] text-[var(--community-text,#183b2b)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-emerald-500/20 border-t-emerald-600" />
          <p className="text-sm font-medium">Loading campus community...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f9f7] p-6 text-[#183b2b]">
        <div className="w-full max-w-md rounded-3xl border border-[#e2eae3] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">
            🗳️
          </div>
          <h1 className="text-2xl font-bold">Join the campus conversation</h1>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            Sign in to view campus issues, support important reports, and
            help your community decide what needs attention first.
          </p>
          <a
            href="/login"
            className="mt-7 inline-flex rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Sign in to continue
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--community-bg,#f7f9f7)] text-[var(--community-text,#183b2b)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-9 flex flex-wrap items-center justify-between gap-4">
          <div>
            <a
              href="/dashboard"
              className="text-sm font-medium text-[var(--community-muted,#718078)] hover:text-emerald-700"
            >
              ← Back to dashboard
            </a>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-2xl text-white">
                🗳️
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Community Priority
                </h1>
                <p className="mt-1 text-sm text-[var(--community-muted,#718078)]">
                  Your voice helps shape a better campus.
                </p>
              </div>
            </div>
          </div>

          <a
            href="/dashboard"
            className="rounded-xl border border-[var(--community-border,#e0e8e1)] bg-[var(--community-card,#fff)] px-4 py-2.5 text-sm font-semibold transition hover:border-emerald-500"
          >
            My dashboard
          </a>
        </header>

        {/* Hero */}
        <section className="relative mb-7 overflow-hidden rounded-3xl bg-[#123c2a] p-6 text-white sm:p-9">
          <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[35px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-32 right-40 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative max-w-2xl">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-100">
              Student-powered campus improvement
            </span>
            <h2 className="mt-5 text-3xl font-extrabold leading-tight sm:text-4xl">
              What should we
              <br />
              <span className="text-emerald-300">fix first?</span>
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-emerald-50/80 sm:text-base">
              Support issues that matter to you. Every vote helps highlight
              the problems students want addressed.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Campus reports",
              value: complaints.length,
              icon: "📋",
            },
            {
              label: "Community votes",
              value: totalVotes,
              icon: "🗳️",
            },
            {
              label: "Resolved reports",
              value: resolvedCount,
              icon: "✓",
            },
            {
              label: "Top priority score",
              value: topComplaint?.voteCount ?? 0,
              icon: "🔥",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[var(--community-border,#e0e8e1)] bg-[var(--community-card,#fff)] p-4 sm:p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--community-muted,#718078)] sm:text-sm">
                  {stat.label}
                </span>
                <span className="text-xl">{stat.icon}</span>
              </div>
              <p className="mt-3 text-2xl font-extrabold tabular-nums">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filters */}
        <section className="mb-6 rounded-2xl border border-[var(--community-border,#e0e8e1)] bg-[var(--community-card,#fff)] p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_190px_190px]">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search campus issues..."
              className="w-full rounded-xl border border-[var(--community-border,#e0e8e1)] bg-[var(--community-bg,#f7f9f7)] px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
            />

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-xl border border-[var(--community-border,#e0e8e1)] bg-[var(--community-bg,#f7f9f7)] px-3 py-3 text-sm outline-none focus:border-emerald-500"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All categories" : formatLabel(item)}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-[var(--community-border,#e0e8e1)] bg-[var(--community-bg,#f7f9f7)] px-3 py-3 text-sm outline-none focus:border-emerald-500"
            >
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All statuses" : formatLabel(item)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "All issues"],
                ["trending", "🔥 Top priority"],
                ["latest", "Latest"],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  filter === value
                    ? "bg-emerald-700 text-white"
                    : "bg-[var(--community-bg,#f7f9f7)] text-[var(--community-muted,#718078)] hover:text-emerald-700"
                }`}
              >
                {label}
              </button>
            ))}

            <span className="ml-auto text-xs text-[var(--community-muted,#718078)]">
              {filteredComplaints.length} issues found
            </span>
          </div>
        </section>

        {/* Complaint list */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Campus issues</h2>
              <p className="mt-1 text-sm text-[var(--community-muted,#718078)]">
                Vote for the problems that deserve attention.
              </p>
            </div>
            <span className="hidden rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 sm:inline-flex">
              Live voting
            </span>
          </div>

          {filteredComplaints.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--community-border,#e0e8e1)] bg-[var(--community-card,#fff)] px-6 py-16 text-center">
              <div className="text-4xl">🌱</div>
              <h3 className="mt-4 text-lg font-bold">
                No campus issues found
              </h3>
              <p className="mt-2 text-sm text-[var(--community-muted,#718078)]">
                Try changing your filters or search for another issue.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredComplaints.map((complaint, index) => (
                <article
                  key={complaint.id}
                  className="overflow-hidden rounded-2xl border border-[var(--community-border,#e0e8e1)] bg-[var(--community-card,#fff)] transition hover:border-emerald-500/40 hover:shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row">
                    {complaint.image && (
                      <div className="h-48 shrink-0 overflow-hidden bg-[var(--community-bg,#f7f9f7)] sm:h-auto sm:w-48">
                        <img
                          src={complaint.image.secureUrl}
                          alt="Evidence submitted with complaint"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 p-5 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        {filter === "trending" && index === 0 && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                            #1 community priority
                          </span>
                        )}

                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                          {formatLabel(complaint.category)}
                        </span>

                        <span className="rounded-full bg-[var(--community-bg,#f7f9f7)] px-2.5 py-1 text-[10px] font-semibold text-[var(--community-muted,#718078)]">
                          {formatLabel(complaint.status)}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold leading-snug">
                        {complaint.title}
                      </h3>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--community-muted,#718078)]">
                        {complaint.description}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--community-muted,#718078)]">
                        {complaint.location && (
                          <span>📍 {complaint.location}</span>
                        )}
                        <span>🏢 {formatLabel(complaint.department)}</span>
                        <span>📅 {formatDate(complaint.createdAt)}</span>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--community-border,#e0e8e1)] pt-4">
                        <div className="flex items-center gap-2">
                          <VoteButton
                            direction="up"
                            count={complaint.upvoteCount}
                            active={complaint.myVote === 1}
                            disabled={votingId !== null}
                            onClick={() => handleVote(complaint, 1)}
                          />

                          <VoteButton
                            direction="down"
                            count={complaint.downvoteCount}
                            active={complaint.myVote === -1}
                            disabled={votingId !== null}
                            onClick={() => handleVote(complaint, -1)}
                          />

                          {votingId === complaint.id && (
                            <span className="text-xs text-[var(--community-muted,#718078)]">
                              Saving...
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="text-xl font-extrabold tabular-nums">
                            {complaint.voteCount}
                          </p>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--community-muted,#718078)]">
                            Net priority score
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 border-t border-[var(--community-border,#e0e8e1)] py-6 text-center text-xs text-[var(--community-muted,#718078)]">
          CivicSense AI · A better campus starts with your voice.
        </footer>
      </div>
    </main>
  );
}

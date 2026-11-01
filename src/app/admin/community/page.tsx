
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";

type AdminComplaint = {
  id: string;
  title: string;
  category: string;
  status: string;
  location?: string;
  upvoteCount?: number;
  downvoteCount?: number;
  voteCount?: number;
};

export default function CommunityAdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const loadVotingData = useCallback(async () => {
    if (!user) return;

    setFetching(true);
    setError("");

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/admin/complaints", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load voting data.");
      }

      setComplaints(
        Array.isArray(data.complaints) ? data.complaints : []
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user) void loadVotingData();
  }, [loading, user, loadVotingData]);

  const stats = useMemo(() => {
    const upvotes = complaints.reduce(
      (sum, item) => sum + Math.max(0, Number(item.upvoteCount ?? 0)),
      0
    );

    const downvotes = complaints.reduce(
      (sum, item) => sum + Math.max(0, Number(item.downvoteCount ?? 0)),
      0
    );

    return {
      upvotes,
      downvotes,
      total: upvotes + downvotes,
      net: complaints.reduce(
        (sum, item) => sum + Number(item.voteCount ?? 0),
        0
      ),
    };
  }, [complaints]);

  const rankedComplaints = useMemo(
    () =>
      [...complaints]
        .sort(
          (a, b) =>
            Number(b.voteCount ?? 0) - Number(a.voteCount ?? 0)
        ),
    [complaints]
  );

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1711] text-sm text-[#9db2a3]">
        <RefreshCw size={16} className="mr-2 animate-spin" />
        Loading community voting...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1711] px-4 py-6 text-[#e8f1eb] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/admin")}
              className="mb-4 inline-flex items-center gap-2 text-xs text-[#91a79a] hover:text-emerald-300"
            >
              <ArrowLeft size={14} />
              Back to Admin Dashboard
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300">
                <Users size={23} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                  Student participation
                </p>
                <h1 className="mt-1 text-2xl font-semibold">
                  Community Voting
                </h1>
              </div>
            </div>

            <p className="mt-3 text-xs text-[#82998b]">
              Track voting activity and identify the most supported campus issues.
            </p>
          </div>

          <button
            onClick={() => void loadVotingData()}
            disabled={fetching}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold hover:bg-white/[0.08] disabled:opacity-50"
          >
            <RefreshCw size={14} className={fetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total votes",
              value: stats.total,
              icon: Users,
            },
            {
              label: "Upvotes",
              value: stats.upvotes,
              icon: ThumbsUp,
            },
            {
              label: "Downvotes",
              value: stats.downvotes,
              icon: ThumbsDown,
            },
            {
              label: "Net votes",
              value: stats.net,
              icon: Activity,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="rounded-2xl border border-white/[0.08] bg-[#12231a] p-5"
              >
                <Icon size={19} className="text-emerald-300" />
                <p className="mt-4 text-2xl font-semibold">{item.value}</p>
                <p className="mt-1 text-xs text-[#82998b]">{item.label}</p>
              </div>
            );
          })}
        </div>

        <section className="rounded-2xl border border-white/[0.08] bg-[#12231a] p-4 sm:p-6">
          <div className="mb-5">
            <h2 className="text-sm font-semibold">
              Community-supported complaints
            </h2>
            <p className="mt-1 text-[11px] text-[#82998b]">
              Reports ranked by net votes: upvotes minus downvotes.
            </p>
          </div>

          {fetching && complaints.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#91a79a]">
              <RefreshCw className="mx-auto mb-3 animate-spin" size={18} />
              Loading voting records...
            </div>
          ) : rankedComplaints.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#82998b]">
              No community complaints available.
            </div>
          ) : (
            <div className="space-y-3">
              {rankedComplaints.map((item, index) => (
                <article
                  key={item.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-white/[0.07] bg-[#0d1b13] p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-xs font-bold text-emerald-300">
                      {index + 1}
                    </span>

                    <div className="min-w-0">
                      <h3 className="break-words text-xs font-semibold text-[#e4eee7]">
                        {item.title}
                      </h3>

                      <p className="mt-1 text-[10px] text-[#82998b]">
                        {item.category?.replaceAll("_", " ")} ·{" "}
                        {item.status?.replaceAll("_", " ")}
                      </p>

                      {item.location && (
                        <p className="mt-1 text-[10px] text-[#718b7b]">
                          {item.location}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 text-[10px]">
                    <span className="rounded-lg bg-emerald-400/10 px-3 py-2 text-emerald-300">
                      ↑ {Number(item.upvoteCount ?? 0)}
                    </span>

                    <span className="rounded-lg bg-rose-400/10 px-3 py-2 text-rose-300">
                      ↓ {Number(item.downvoteCount ?? 0)}
                    </span>

                    <span className="rounded-lg bg-white/[0.06] px-3 py-2 text-[#d5e3d9]">
                      Net: {Number(item.voteCount ?? 0)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="text-[10px] leading-5 text-[#718b7b]">
          Voting statistics use the latest complaints returned by the
          admin API (up to 250). Individual student vote records are
          not exposed in this dashboard.
        </p>

        <footer className="border-t border-white/[0.07] pt-5 text-[10px] text-[#718b7b]">
          <ShieldCheck size={13} className="mr-2 inline text-emerald-400" />
          CivicSense AI · Community voting administration
        </footer>
      </div>
    </main>
  );
}

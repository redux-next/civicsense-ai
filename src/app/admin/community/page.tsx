
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Clock,
  FileText,
  Flag,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";

type Report = {
  id: string;
  postId: string;
  commentId: string | null;
  reporterUid: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string | null;
  targetExists: boolean;
  targetType: "post" | "comment";
  targetContent: string;
  targetTitle: string;
  targetCategory: string;
  targetAuthor: string;
  targetModerationStatus: string;
  resolution?: string;
};

type Filter = "pending" | "resolved" | "all";

const reasonLabels: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate: "Inappropriate content",
  misinformation: "Misinformation",
  other: "Other",
};

function formatDate(value: string | null) {
  if (!value) return "Unknown date";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function CommunityAdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadReports = useCallback(async () => {
    if (!user) return;

    setFetching(true);
    setError("");

    try {
      const token = await user.getIdToken();

      const response = await fetch(
        `/api/admin/civicspace?status=${filter}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load reports.");
      }

      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setFetching(false);
    }
  }, [user, filter]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user) {
      void loadReports();
    }
  }, [loading, user, loadReports]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return reports;

    return reports.filter((report) =>
      [
        report.targetTitle,
        report.targetContent,
        report.targetAuthor,
        report.reason,
        report.details,
        report.targetCategory,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [reports, search]);

  const pendingCount = reports.filter(
    (report) => report.status === "pending"
  ).length;

  const resolvedCount = reports.filter(
    (report) => report.status === "resolved"
  ).length;

  async function moderate(
    reportId: string,
    action: "dismiss" | "remove_content"
  ) {
    if (!user || processing) return;

    const message =
      action === "remove_content"
        ? "Remove this content from the student-facing CivicSpace feed?"
        : "Dismiss this report without removing its content?";

    if (!window.confirm(message)) return;

    setProcessing(reportId);
    setError("");
    setSuccess("");

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/admin/civicspace", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reportId, action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Moderation action failed.");
      }

      setSuccess(
        action === "remove_content"
          ? "Content removed and report resolved."
          : "Report dismissed successfully."
      );

      await loadReports();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to process report."
      );
    } finally {
      setProcessing(null);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1711] text-sm text-[#9db2a3]">
        <RefreshCw size={16} className="mr-2 animate-spin" />
        Loading moderation workspace...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1711] px-4 py-6 text-[#e8f1eb] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-7">
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
                <ShieldCheck size={24} />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                  CivicSense AI · Administration
                </p>

                <h1 className="mt-1 text-2xl font-semibold">
                  CivicSpace Moderation
                </h1>
              </div>
            </div>

            <p className="mt-3 max-w-xl text-xs leading-6 text-[#82998b]">
              Review community reports, protect student discussions,
              and maintain a safe campus environment.
            </p>
          </div>

          <button
            onClick={() => void loadReports()}
            disabled={fetching}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold hover:bg-white/[0.08] disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={fetching ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </header>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-xs text-rose-200">
            <X size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-xs text-emerald-200">
            <Check size={16} />
            {success}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "Pending reports",
              value: pendingCount,
              icon: Clock,
            },
            {
              label: "Resolved reports",
              value: resolvedCount,
              icon: ShieldCheck,
            },
            {
              label: "Reports displayed",
              value: reports.length,
              icon: Flag,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-2xl border border-white/[0.08] bg-[#12231a] p-5"
              >
                <Icon size={19} className="text-emerald-300" />
                <p className="mt-4 text-2xl font-semibold">
                  {item.value}
                </p>
                <p className="mt-1 text-xs text-[#82998b]">
                  {item.label}
                </p>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#12231a] p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-sm font-semibold">
                Community reports
              </h2>
              <p className="mt-1 text-[11px] text-[#82998b]">
                Review reported discussions and comments.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718b7b]"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search reports..."
                  className="w-full rounded-xl border border-white/10 bg-[#0d1b13] py-3 pl-9 pr-3 text-xs outline-none placeholder:text-[#718b7b] focus:border-emerald-400/40 sm:w-56"
                />
              </div>

              <div className="flex rounded-xl border border-white/10 bg-[#0d1b13] p-1">
                {(["pending", "resolved", "all"] as Filter[]).map(
                  (value) => (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      className={`rounded-lg px-3 py-2 text-[10px] font-semibold capitalize transition ${
                        filter === value
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "text-[#82998b] hover:text-white"
                      }`}
                    >
                      {value}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {fetching && reports.length === 0 ? (
              <div className="py-14 text-center text-xs text-[#91a79a]">
                <RefreshCw
                  className="mx-auto mb-3 animate-spin"
                  size={19}
                />
                Loading reports...
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 py-14 text-center">
                <ShieldCheck
                  size={28}
                  className="mx-auto mb-3 text-emerald-400"
                />
                <p className="text-sm font-medium">
                  No reports found
                </p>
                <p className="mt-2 text-xs text-[#82998b]">
                  There are no reports matching this filter.
                </p>
              </div>
            ) : (
              filteredReports.map((report) => (
                <article
                  key={report.id}
                  className="rounded-xl border border-white/[0.08] bg-[#0d1b13] p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-400/10 px-3 py-2 text-[10px] font-semibold text-rose-300">
                        <Flag size={12} />
                        {reasonLabels[report.reason] ?? "Other"}
                      </span>

                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-[10px] text-[#c2d2c7]">
                        {report.targetType === "comment" ? (
                          <MessageSquare size={12} />
                        ) : (
                          <FileText size={12} />
                        )}
                        {report.targetType}
                      </span>

                      <span className="rounded-lg bg-white/[0.06] px-3 py-2 text-[10px] text-[#82998b]">
                        {report.status}
                      </span>
                    </div>

                    <span className="text-[10px] text-[#718b7b]">
                      {formatDate(report.createdAt)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      Reported content
                    </p>

                    <h3 className="mt-2 text-sm font-semibold">
                      {report.targetTitle}
                    </h3>

                    <p className="mt-1 text-[10px] text-[#82998b]">
                      {report.targetCategory.replaceAll("_", " ")}
                      {" · "}
                      By {report.targetAuthor}
                    </p>

                    <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#12231a] p-4">
                      <p className="whitespace-pre-wrap break-words text-xs leading-6 text-[#c4d4c9]">
                        {report.targetContent ||
                          "The reported content is unavailable."}
                      </p>
                    </div>

                    {report.details && (
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold text-[#82998b]">
                          REPORTER'S DETAILS
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#c4d4c9]">
                          {report.details}
                        </p>
                      </div>
                    )}

                    <p className="mt-3 text-[10px] text-[#718b7b]">
                      Report ID: {report.id}
                    </p>
                  </div>

                  {report.status === "pending" && (
                    <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-white/[0.07] pt-4">
                      <button
                        onClick={() =>
                          void moderate(report.id, "dismiss")
                        }
                        disabled={
                          processing !== null || !report.targetExists
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-[10px] font-semibold text-[#b7c8bc] hover:bg-white/[0.06] disabled:opacity-40"
                      >
                        <Check size={13} />
                        Dismiss report
                      </button>

                      <button
                        onClick={() =>
                          void moderate(report.id, "remove_content")
                        }
                        disabled={
                          processing !== null || !report.targetExists
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-rose-400/10 px-4 py-3 text-[10px] font-semibold text-rose-300 hover:bg-rose-400/20 disabled:opacity-40"
                      >
                        {processing === report.id ? (
                          <RefreshCw
                            size={13}
                            className="animate-spin"
                          />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        Remove content
                      </button>
                    </div>
                  )}

                  {report.status === "resolved" && (
                    <p className="mt-4 border-t border-white/[0.07] pt-4 text-[10px] text-emerald-300">
                      <Check size={13} className="mr-2 inline" />
                      This report has been reviewed.
                      {report.resolution === "remove_content"
                        ? " Content was removed."
                        : ""}
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
        </section>

        <footer className="border-t border-white/[0.07] pt-5 text-[10px] leading-5 text-[#718b7b]">
          <ShieldCheck
            size={13}
            className="mr-2 inline text-emerald-400"
          />
          CivicSpace Moderation · Protected by administrator
          authentication.
        </footer>
      </div>
    </main>
  );
}

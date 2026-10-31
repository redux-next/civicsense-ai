"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Languages,
  Menu,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
  AlertTriangle,
  LogOut,
} from "lucide-react";

import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/auth-provider";
import ThemeToggle from "@/components/ui/theme-toggle";
import type { Complaint } from "@/types/complaint";

type AdminComplaint = Complaint;

type InsightItem = {
  label: string;
  count: number;
};

const panel = "rounded-2xl border border-white/[0.08] bg-[#12231a]";

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function InsightBars({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: InsightItem[];
}) {
  const maximum = Math.max(...items.map((item) => item.count), 1);

  return (
    <section className={`${panel} p-5`}>
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[#e4eee7]">
          {title}
        </h3>
        <p className="mt-1 text-xs text-[#82998b]">
          {description}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-xs text-[#82998b]">
          No data available yet.
        </p>
      ) : (
        <div className="space-y-5">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="truncate text-xs text-[#b6c8bc]">
                  {item.label}
                </span>
                <span className="text-xs font-semibold tabular-nums text-[#e4eee7]">
                  {item.count}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#263a2e]">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{
                    width: `${(item.count / maximum) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  description,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: typeof ClipboardList;
  accent: string;
}) {
  return (
    <div className={`${panel} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[#91a79a]">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#edf5ef]">
            {value}
          </p>
          <p className="mt-1 text-[11px] text-[#789083]">
            {description}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${accent}`}>
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

export default function CampusIntelligencePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const loadComplaints = useCallback(async () => {
    if (!user) return;

    setFetching(true);
    setError("");

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/admin/complaints", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load analytics.");
      }

      setComplaints(
        Array.isArray(data.complaints) ? data.complaints : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load campus intelligence."
      );
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && user) {
      void loadComplaints();
    }
  }, [loading, user, loadComplaints]);

  const stats = useMemo(() => {
    const total = complaints.length;

    const resolved = complaints.filter(
      (item) => item.status === "resolved"
    ).length;

    const active = complaints.filter(
      (item) => !["resolved", "rejected"].includes(item.status)
    ).length;

    const critical = complaints.filter(
      (item) => item.priority?.toLowerCase() === "critical"
    ).length;

    const highPriority = complaints.filter((item) =>
      ["critical", "high"].includes(
        (item.priority || "").toLowerCase()
      )
    ).length;

    const unassigned = complaints.filter(
      (item) =>
        !item.department || item.department === "unassigned"
    ).length;

    return {
      total,
      resolved,
      active,
      critical,
      highPriority,
      unassigned,
      resolutionRate: total
        ? Math.round((resolved / total) * 100)
        : 0,
    };
  }, [complaints]);

  const insights = useMemo(() => {
    function countBy(values: string[]): InsightItem[] {
      const counts = new Map<string, number>();

      values.forEach((value) => {
        const label = value?.trim() || "Unassigned";
        counts.set(label, (counts.get(label) || 0) + 1);
      });

      return Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);
    }

    const trend = currentDate
      ? Array.from({ length: 7 }, (_, index) => {
          const date = new Date(currentDate.getTime());

          date.setHours(0, 0, 0, 0);
          date.setDate(currentDate.getDate() - (6 - index));

          return {
            key: localDateKey(date),
            label: date.toLocaleDateString(undefined, {
              weekday: "short",
            }),
            count: 0,
          };
        })
      : [];

    const trendMap = new Map(
      trend.map((day) => [day.key, day])
    );

    complaints.forEach((complaint) => {
      if (!complaint.createdAt) return;

      const date = new Date(complaint.createdAt);
      if (Number.isNaN(date.getTime())) return;

      const day = trendMap.get(localDateKey(date));
      if (day) day.count += 1;
    });

    return {
      trend,

      categories: countBy(
        complaints.map((item) => item.category || "Uncategorized")
      ).slice(0, 8),

      departments: countBy(
        complaints.map((item) => item.department || "Unassigned")
      ).slice(0, 8),

      statuses: [
        {
          label: "Submitted",
          count: complaints.filter(
            (item) => item.status === "submitted"
          ).length,
        },
        {
          label: "Under review",
          count: complaints.filter(
            (item) => item.status === "under_review"
          ).length,
        },
        {
          label: "In progress",
          count: complaints.filter(
            (item) => item.status === "in_progress"
          ).length,
        },
        {
          label: "Resolved",
          count: complaints.filter(
            (item) => item.status === "resolved"
          ).length,
        },
        {
          label: "Rejected",
          count: complaints.filter(
            (item) => item.status === "rejected"
          ).length,
        },
      ],

      languages: [
        {
          label: "English",
          count: complaints.filter(
            (item) => item.language === "en"
          ).length,
        },
        {
          label: "অসমীয়া",
          count: complaints.filter(
            (item) => item.language === "as"
          ).length,
        },
        {
          label: "Other / unknown",
          count: complaints.filter(
            (item) => !["en", "as"].includes(item.language)
          ).length,
        },
      ],
    };
  }, [complaints, currentDate]);

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch {
      setError("Unable to sign out. Please try again.");
    }
  }

  if (loading || !user) {
    return (
      <main className="admin-console flex min-h-screen items-center justify-center bg-[#0b1711] text-sm text-[#9db2a3]">
        <RefreshCw
          size={17}
          className="mr-3 animate-spin text-emerald-400"
        />
        Preparing campus intelligence...
      </main>
    );
  }

  const maximumTrend = Math.max(
    ...insights.trend.map((day) => day.count),
    1
  );

  return (
    <main className="admin-console min-h-screen bg-[#0b1711] text-[#e8f1eb]">
      {mobileMenuOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[265px] flex-col border-r border-white/[0.07] bg-[#101f16] transition-transform duration-300 lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.07] px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
            <ShieldCheck size={21} />
          </div>

          <div>
            <p className="text-sm font-bold text-white">
              CivicSense <span className="text-emerald-400">AI</span>
            </p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82998b]">
              Admin console
            </p>
          </div>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="ml-auto rounded-lg p-2 text-[#82998b] lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[#657c6c]">
            Workspace
          </p>

          <nav className="space-y-1">
            <button
              onClick={() => router.push("/admin")}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold text-[#9db2a3] transition hover:bg-white/[0.04] hover:text-white"
            >
              <ClipboardList size={17} />
              Overview
            </button>

            <button
              onClick={() => router.push("/admin#reports")}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold text-[#9db2a3] transition hover:bg-white/[0.04] hover:text-white"
            >
              <Users size={17} />
              Campus reports
            </button>

            <div className="flex w-full items-center gap-3 rounded-xl bg-emerald-400/10 px-3 py-3 text-xs font-semibold text-emerald-300">
              <BarChart3 size={17} />
              Campus intelligence
            </div>
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.06] p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <Activity size={15} />
              <span className="text-xs font-semibold">
                Live campus overview
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-5 text-[#91a79a]">
              Insights are calculated from reports returned by the admin API.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-sm font-bold text-emerald-300">
              {(user.displayName || user.email || "A")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[#e4eee7]">
                {user.displayName || "Administrator"}
              </p>
              <p className="truncate text-[10px] text-[#82998b]">
                {user.email}
              </p>
            </div>

            <button
              onClick={() => void handleSignOut()}
              aria-label="Sign out"
              className="rounded-lg p-2 text-[#91a79a] hover:bg-rose-400/10 hover:text-rose-300"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[265px]">
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0b1711]/90 backdrop-blur-xl">
          <div className="flex h-[76px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation"
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-[#b5c7ba] lg:hidden"
              >
                <Menu size={18} />
              </button>

              <div>
                <p className="text-sm font-semibold text-[#e8f1eb]">
                  Campus intelligence
                </p>
                <p className="mt-0.5 hidden text-[10px] text-[#82998b] sm:block">
                  Reporting patterns and campus insights
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />

              <button
                onClick={() => void loadComplaints()}
                disabled={fetching}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-[#b5c7ba] transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={fetching ? "animate-spin" : ""}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                onClick={() => router.push("/admin")}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-300 px-3 text-xs font-bold text-[#10271d] transition hover:bg-emerald-200"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] space-y-7 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <section className="relative overflow-hidden rounded-[26px] border border-emerald-400/10 bg-gradient-to-br from-[#183d2d] via-[#143526] to-[#10271d] p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/[0.06]" />

            <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/15 bg-white/[0.06] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.17em] text-emerald-200">
                  <TrendingUp size={12} />
                  Data-driven campus overview
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Campus intelligence.
                  <span className="block text-emerald-300">
                    See the bigger picture.
                  </span>
                </h1>

                <p className="mt-3 max-w-xl text-xs leading-6 text-[#c0d5c7] sm:text-sm">
                  Understand student concerns, identify recurring issues,
                  monitor department workloads and track campus resolutions
                  through bilingual reporting data.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-[10px] text-[#b5cbbd]">
                  Reports currently analysed
                </p>
                <p className="mt-1 text-3xl font-semibold text-white">
                  {stats.total}
                </p>
                <p className="mt-1 text-[10px] text-emerald-200">
                  Firestore-backed data
                </p>
              </div>
            </div>
          </section>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-xs text-rose-200"
            >
              {error}
            </div>
          )}

          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#e8f1eb]">
                  Campus at a glance
                </h2>
                <p className="mt-1 text-xs text-[#82998b]">
                  Key indicators from the loaded reports
                </p>
              </div>

              {fetching && (
                <span className="inline-flex items-center gap-2 text-[10px] text-emerald-300">
                  <RefreshCw size={12} className="animate-spin" />
                  Updating
                </span>
              )}
            </div>

            <div className="grid gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Total reports"
                value={stats.total}
                description="Reports currently loaded"
                icon={ClipboardList}
                accent="bg-sky-400/10 text-sky-300"
              />

              <Metric
                label="Active issues"
                value={stats.active}
                description="Awaiting final closure"
                icon={Clock3}
                accent="bg-amber-400/10 text-amber-300"
              />

              <Metric
                label="High priority"
                value={stats.highPriority}
                description="High and critical reports"
                icon={AlertTriangle}
                accent="bg-rose-400/10 text-rose-300"
              />

              <Metric
                label="Resolution rate"
                value={`${stats.resolutionRate}%`}
                description={`${stats.resolved} resolved reports`}
                icon={CheckCircle2}
                accent="bg-emerald-400/10 text-emerald-300"
              />
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className={`${panel} flex items-center gap-4 p-5`}>
              <div className="rounded-xl bg-rose-400/10 p-3 text-rose-300">
                <AlertTriangle size={19} />
              </div>

              <div>
                <p className="text-xs text-[#82998b]">Critical reports</p>
                <p className="mt-1 text-2xl font-semibold text-[#e8f1eb]">
                  {stats.critical}
                </p>
              </div>
            </div>

            <div className={`${panel} flex items-center gap-4 p-5`}>
              <div className="rounded-xl bg-amber-400/10 p-3 text-amber-300">
                <Users size={19} />
              </div>

              <div>
                <p className="text-xs text-[#82998b]">Unassigned reports</p>
                <p className="mt-1 text-2xl font-semibold text-[#e8f1eb]">
                  {stats.unassigned}
                </p>
              </div>
            </div>

            <div
              className={`${panel} flex items-center gap-4 p-5 sm:col-span-2 xl:col-span-1`}
            >
              <div className="rounded-xl bg-violet-400/10 p-3 text-violet-300">
                <Languages size={19} />
              </div>

              <div>
                <p className="text-xs text-[#82998b]">
                  Assamese submissions
                </p>
                <p className="mt-1 text-2xl font-semibold text-[#e8f1eb]">
                  {complaints.filter((item) => item.language === "as").length}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className={`${panel} p-5`}>
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[#e4eee7]">
                  Submission activity
                </h3>
                <p className="mt-1 text-xs text-[#82998b]">
                  Daily reports over the last seven days
                </p>
              </div>

              {insights.trend.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#82998b]">
                  Preparing activity chart...
                </p>
              ) : (
                <div className="flex h-44 items-end justify-between gap-2">
                  {insights.trend.map((day) => {
                    const height = day.count
                      ? Math.max(
                          (day.count / maximumTrend) * 100,
                          8
                        )
                      : 3;

                    return (
                      <div
                        key={day.key}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                      >
                        <span className="text-[10px] font-semibold text-[#c0d2c6]">
                          {day.count}
                        </span>

                        <div className="flex h-32 w-full items-end justify-center">
                          <div
                            className="w-full max-w-10 rounded-t-lg bg-emerald-400 transition-all duration-500"
                            style={{ height: `${height}%` }}
                            title={`${day.label}: ${day.count} reports`}
                          />
                        </div>

                        <span className="text-[10px] text-[#82998b]">
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <InsightBars
              title="Complaint categories"
              description="Most frequently reported campus issues"
              items={insights.categories}
            />

            <InsightBars
              title="Department workload"
              description="Reports grouped by assigned department"
              items={insights.departments}
            />

            <InsightBars
              title="Complaint status"
              description="Current progress across loaded reports"
              items={insights.statuses}
            />

            <InsightBars
              title="Language distribution"
              description="Language selected when submitting reports"
              items={insights.languages}
            />
          </section>

          <section className={`${panel} p-5`}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-semibold text-[#e4eee7]">
                  What these insights mean
                </h3>

                <p className="mt-1 text-xs leading-5 text-[#82998b]">
                  Use these indicators to identify areas that may need
                  administrative attention.
                </p>
              </div>

              <button
                onClick={() => router.push("/admin#reports")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-xs font-bold text-[#10271d] transition hover:bg-emerald-200"
              >
                Review campus reports
                <ArrowUpRight size={14} />
              </button>
            </div>
          </section>

          <p className="border-t border-white/[0.07] py-5 text-[10px] leading-5 text-[#718b7b]">
            Analytics represent the reports returned by the admin API
            (maximum 250), not necessarily lifetime campus totals.
            Counts are descriptive and do not establish causes or
            independently verify reported issues.
          </p>
        </div>
      </div>
    </main>
  );
}
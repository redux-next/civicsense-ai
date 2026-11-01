
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Filter,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  RefreshCw,
  Search,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/auth-provider";
import ThemeToggle from "@/components/ui/theme-toggle";
import type { Complaint, ComplaintStatus } from "@/types/complaint";

type AdminComplaint = Complaint & {
  aiModel?: string;
  aiProvider?: string;
  statusUpdatedAt?: string | null;
  upvoteCount?: number;
  downvoteCount?: number;
  voteCount?: number;
};

type DuplicateMatch = {
  complaintId: string;
  similarity: number;
  reasonEnglish: string;
  reasonAssamese: string;
};

type DuplicateMatchState = {
  matches: DuplicateMatch[];
  candidatesCompared?: number;
};

type Analysis = {
  summaryEnglish?: string;
  summaryAssamese?: string;
  category?: string;
  priority?: string;
  priorityReason?: string;
  recommendedDepartment?: string;
  recommendedAction?: string;
  locationDetected?: string;
  imageFindings?: string;
  confidence?: number;
};

type FilterStatus = "all" | ComplaintStatus;
type Section = "overview" | "reports";

const statuses: ComplaintStatus[] = [
  "submitted",
  "under_review",
  "in_progress",
  "resolved",
  "rejected",
];

const statusLabels: Record<ComplaintStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

const statusColors: Record<ComplaintStatus, string> = {
  submitted: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  under_review: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  in_progress: "border-violet-400/20 bg-violet-400/10 text-violet-300",
  resolved: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  rejected: "border-rose-400/20 bg-rose-400/10 text-rose-300",
};

const priorityColors: Record<string, string> = {
  critical: "bg-rose-400/10 text-rose-300 border-rose-400/20",
  high: "bg-orange-400/10 text-orange-300 border-orange-400/20",
  medium: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  low: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  normal: "bg-slate-400/10 text-slate-300 border-slate-400/20",
};

const panel =
  "rounded-2xl border border-white/[0.08] bg-[#12231a]";

function getAnalysis(value: unknown): Analysis | null {
  if (!value || typeof value !== "object") return null;
  return value as Analysis;
}

function humanize(value: string | undefined | null) {
  if (!value) return "Unclassified";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRelativeDate(value: string | null | undefined) {
  if (!value) return "Unknown date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: typeof ClipboardList;
  accent: string;
}) {
  return (
    <div className={`${panel} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#91a79a]">
            {title}
          </p>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#edf5ef]">
            {value}
          </p>

          <p className="mt-1 text-[11px] text-[#789083]">
            {description}
          </p>
        </div>

        <div className={`rounded-xl p-2.5 ${accent}`}>
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.19em] text-emerald-400">
        {eyebrow}
      </p>

      <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#e8f1eb] sm:text-2xl">
        {title}
      </h2>

      <p className="mt-1 text-xs leading-5 text-[#82998b]">
        {description}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={`${panel} flex min-h-64 flex-col items-center justify-center px-5 text-center`}>
      <div className="mb-4 rounded-2xl bg-emerald-400/10 p-4 text-emerald-400">
        <ClipboardList size={25} />
      </div>

      <h3 className="text-sm font-semibold text-[#e4eee7]">
        {title}
      </h3>

      <p className="mt-2 max-w-sm text-xs leading-5 text-[#82998b]">
        {description}
      </p>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [fetching, setFetching] = useState(true);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("overview");

  const [duplicateResults, setDuplicateResults] = useState<
    Record<string, DuplicateMatchState>
  >({});

  const [duplicateErrors, setDuplicateErrors] = useState<
    Record<string, string>
  >({});

  // Load administrator-protected complaint data.
  const loadDashboard = useCallback(async () => {
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
        throw new Error(data.error || "Unable to load reports.");
      }

      setComplaints(
        Array.isArray(data.complaints)
          ? data.complaints
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard data."
      );
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user) {
      void loadDashboard();
    }
  }, [loading, user, loadDashboard]);

  // Categories available for filtering.
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          complaints
            .map((item) => item.category)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [complaints]
  );

  // Main complaint statistics.
  const stats = useMemo(() => {
    const resolved = complaints.filter(
      (item) => item.status === "resolved"
    ).length;

    return {
      total: complaints.length,
      active: complaints.filter(
        (item) => !["resolved", "rejected"].includes(item.status)
      ).length,
      urgent: complaints.filter((item) =>
        ["critical", "high"].includes(
          (item.priority || "").toLowerCase()
        )
      ).length,
      resolved,
      critical: complaints.filter(
        (item) => item.priority?.toLowerCase() === "critical"
      ).length,
      unassigned: complaints.filter(
        (item) =>
          !item.department ||
          item.department === "unassigned"
      ).length,
      resolutionRate: complaints.length
        ? Math.round((resolved / complaints.length) * 100)
        : 0,
    };
  }, [complaints]);

  // Complaint search, filters and sorting.
  const filteredComplaints = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = complaints.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.title,
          item.description,
          item.userName,
          item.userEmail ?? "",
          item.location,
          item.category,
          item.department,
        ].some((value) =>
          value?.toLowerCase().includes(query)
        );

      return (
        matchesSearch &&
        (statusFilter === "all" || item.status === statusFilter) &&
        (priorityFilter === "all" ||
          item.priority?.toLowerCase() === priorityFilter) &&
        (categoryFilter === "all" ||
          item.category === categoryFilter)
      );
    });

    return result.sort((a, b) => {
      const dateA = a.createdAt
        ? new Date(a.createdAt).getTime()
        : 0;

      const dateB = b.createdAt
        ? new Date(b.createdAt).getTime()
        : 0;

      if (sortOrder === "oldest") return dateA - dateB;

      if (sortOrder === "priority") {
        const rank: Record<string, number> = {
          critical: 4,
          high: 3,
          medium: 2,
          normal: 1,
          low: 0,
        };

        return (
          (rank[(b.priority || "").toLowerCase()] ?? 0) -
          (rank[(a.priority || "").toLowerCase()] ?? 0)
        );
      }

      return dateB - dateA;
    });
  }, [
    complaints,
    search,
    statusFilter,
    priorityFilter,
    categoryFilter,
    sortOrder,
  ]);

  async function updateStatus(
    complaintId: string,
    status: ComplaintStatus
  ) {
    if (!user) return;

    setUpdatingId(complaintId);
    setError("");
    setNotice("");

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/admin/complaints", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ complaintId, status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update status.");
      }

      setComplaints((current) =>
        current.map((item) =>
          item.id === complaintId
            ? {
                ...item,
                status,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );

      setNotice(
        data.changed
          ? "Report status successfully updated."
          : "This report already has that status."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function scanForDuplicates(complaintId: string) {
    if (!user) return;

    setScanningId(complaintId);

    setDuplicateErrors((current) => ({
      ...current,
      [complaintId]: "",
    }));

    setNotice("");

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/admin/duplicates", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ complaintId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to scan for duplicates."
        );
      }

      setDuplicateResults((current) => ({
        ...current,
        [complaintId]: {
          matches: Array.isArray(data.matches)
            ? data.matches
            : [],
          candidatesCompared: data.candidatesCompared,
        },
      }));
    } catch (err) {
      setDuplicateErrors((current) => ({
        ...current,
        [complaintId]:
          err instanceof Error
            ? err.message
            : "Duplicate scan failed.",
      }));
    } finally {
      setScanningId(null);
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch {
      setError("Unable to sign out. Please try again.");
    }
  }

  function navigateTo(section: Section) {
    setActiveSection(section);
    setMobileMenuOpen(false);

    document.getElementById(section)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setSortOrder("newest");
  }

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    categoryFilter !== "all";

  if (loading || !user) {
    return (
      <main className="admin-console flex min-h-screen items-center justify-center bg-[#0b1711] text-sm text-[#9db2a3]">
        <RefreshCw
          size={17}
          className="mr-3 animate-spin text-emerald-400"
        />
        Preparing administrator workspace...
      </main>
    );
  }

  return (
    <main className="admin-console min-h-screen bg-[#0b1711] text-[#e8f1eb]">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[265px] flex-col border-r border-white/[0.07] bg-[#101f16] transition-transform duration-300 lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-white/[0.07] px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <ShieldCheck size={21} />
            </div>

            <div>
              <p className="text-sm font-bold tracking-tight text-white">
                CivicSense <span className="text-emerald-400">AI</span>
              </p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#82998b]">
                Admin console
              </p>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-2 text-[#82998b] hover:bg-white/5 lg:hidden"
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
              onClick={() => navigateTo("overview")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold transition ${
                activeSection === "overview"
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "text-[#9db2a3] hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <LayoutDashboard size={17} />
              Overview
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                router.push("/admin/civic-map");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold text-[#9db2a3] transition hover:bg-white/[0.04] hover:text-white"
            >
              <MapPin size={17} />
              CivicMap management
              <ArrowUpRight size={13} className="ml-auto" />
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                router.push("/admin/community");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold text-[#9db2a3] transition hover:bg-white/[0.04] hover:text-white"
            >
              <Activity size={17} />
              Community voting
              <ArrowUpRight size={13} className="ml-auto" />
            </button>

            <button
              onClick={() => navigateTo("reports")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold transition ${
                activeSection === "reports"
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "text-[#9db2a3] hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <ClipboardList size={17} />
              Campus reports
              <span className="ml-auto rounded-lg bg-white/[0.07] px-2 py-1 text-[10px] tabular-nums">
                {stats.total}
              </span>
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                router.push("/admin/analytics");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold text-[#9db2a3] transition hover:bg-white/[0.04] hover:text-white"
            >
              <BarChart3 size={17} />
              Campus intelligence
              <ArrowUpRight size={13} className="ml-auto" />
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.06] p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <Sparkles size={15} />
              <span className="text-xs font-semibold">
                AI-assisted workspace
              </span>
            </div>

            <p className="mt-2 text-[10px] leading-5 text-[#91a79a]">
              AI recommendations support administrators. Final decisions
              remain human-reviewed.
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
              title="Sign out"
              className="rounded-lg p-2 text-[#91a79a] transition hover:bg-rose-400/10 hover:text-rose-300"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-h-screen lg:pl-[265px]">
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0b1711]/90 backdrop-blur-xl">
          <div className="flex h-[76px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation"
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-[#b5c7ba] lg:hidden"
              >
                <Menu size={18} />
              </button>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#e8f1eb]">
                  Administrator workspace
                </p>
                <p className="mt-0.5 hidden text-[10px] text-[#82998b] sm:block">
                  Campus operations and reporting
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-2 text-[10px] font-semibold text-emerald-300 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Session active
              </span>

              <ThemeToggle />

              <button
                onClick={() => router.push("/dashboard")}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-[#b5c7ba] transition hover:bg-white/[0.08] hover:text-white"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">
                  Student portal
                </span>
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] space-y-10 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

          {/* Global notifications */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-xs text-rose-200"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={15} />
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-xs text-emerald-200"
            >
              <Check size={16} />
              <span className="flex-1">{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss notice">
                <X size={15} />
              </button>
            </div>
          )}

          {/* OVERVIEW */}
          <section id="overview" className="scroll-mt-24 space-y-4">
            <div className="relative overflow-hidden rounded-[26px] border border-emerald-400/10 bg-gradient-to-br from-[#183d2d] via-[#143526] to-[#10271d] p-5 sm:p-8">
              <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border border-white/[0.06]" />
              <div className="pointer-events-none absolute -right-8 -top-16 h-52 w-52 rounded-full border border-white/[0.06]" />

              <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
                <div className="max-w-2xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/15 bg-white/[0.06] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.17em] text-emerald-200">
                    <Activity size={12} />
                    Campus issue intelligence
                  </div>

                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-[38px]">
                    Campus operations,
                    <br className="hidden sm:block" />
                    <span className="text-emerald-300">
                      {" "}made clearer.
                    </span>
                  </h1>

                  <p className="mt-3 max-w-xl text-xs leading-6 text-[#c0d5c7] sm:text-sm">
                    Monitor student concerns, review bilingual AI
                    assessments, identify duplicate reports and manage
                    campus issue resolution.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void loadDashboard()}
                    disabled={fetching}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-4 text-xs font-semibold text-white transition hover:bg-white/[0.14] disabled:opacity-50"
                  >
                    <RefreshCw
                      size={14}
                      className={fetching ? "animate-spin" : ""}
                    />
                    Refresh data
                  </button>

                  <button
                    onClick={() => navigateTo("reports")}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-xs font-bold text-[#10271d] transition hover:bg-emerald-200"
                  >
                    View reports
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Total reports"
                value={stats.total}
                description="Latest reports loaded"
                icon={ClipboardList}
                accent="bg-sky-400/10 text-sky-300"
              />

              <MetricCard
                title="Active issues"
                value={stats.active}
                description="Awaiting final closure"
                icon={Clock3}
                accent="bg-amber-400/10 text-amber-300"
              />

              <MetricCard
                title="High priority"
                value={stats.urgent}
                description="High or critical reports"
                icon={AlertTriangle}
                accent="bg-rose-400/10 text-rose-300"
              />

              <MetricCard
                title="Resolved"
                value={stats.resolved}
                description={`${stats.resolutionRate}% resolution rate`}
                icon={CheckCircle2}
                accent="bg-emerald-400/10 text-emerald-300"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className={`${panel} flex items-center gap-3 p-4`}>
                <div className="rounded-xl bg-rose-400/10 p-2.5 text-rose-300">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <p className="text-[11px] text-[#82998b]">
                    Critical reports
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#e8f1eb]">
                    {stats.critical}
                  </p>
                </div>
              </div>

              <div className={`${panel} flex items-center gap-3 p-4`}>
                <div className="rounded-xl bg-amber-400/10 p-2.5 text-amber-300">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-[11px] text-[#82998b]">
                    Unassigned reports
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#e8f1eb]">
                    {stats.unassigned}
                  </p>
                </div>
              </div>

              <div className={`${panel} flex items-center gap-3 p-4`}>
                <div className="rounded-xl bg-violet-400/10 p-2.5 text-violet-300">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <p className="text-[11px] text-[#82998b]">
                    Assamese submissions
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#e8f1eb]">
                    {complaints.filter((item) => item.language === "as").length}
                  </p>
                </div>
              </div>
            </div>

            {/* Separate management page shortcuts */}
            <div className="grid gap-3 md:grid-cols-2">
              <button
                onClick={() => router.push("/admin/civic-map")}
                className={`${panel} group flex items-center gap-4 p-5 text-left transition hover:border-emerald-400/30 hover:bg-[#172d20]`}
              >
                <div className="rounded-xl bg-sky-400/10 p-3 text-sky-300">
                  <MapPin size={21} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#e8f1eb]">
                    CivicMap Management
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-[#82998b]">
                    Review mapped campus reports and inspect their locations.
                  </p>
                </div>

                <ArrowUpRight
                  size={17}
                  className="shrink-0 text-[#82998b] transition group-hover:text-emerald-300"
                />
              </button>

              <button
                onClick={() => router.push("/admin/community")}
                className={`${panel} group flex items-center gap-4 p-5 text-left transition hover:border-emerald-400/30 hover:bg-[#172d20]`}
              >
                <div className="rounded-xl bg-violet-400/10 p-3 text-violet-300">
                  <Activity size={21} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#e8f1eb]">
                    Community Voting
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-[#82998b]">
                    Monitor upvotes, downvotes and community-supported reports.
                  </p>
                </div>

                <ArrowUpRight
                  size={17}
                  className="shrink-0 text-[#82998b] transition group-hover:text-emerald-300"
                />
              </button>
            </div>
          </section>

          {/* CAMPUS REPORTS */}
          <section id="reports" className="scroll-mt-24">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <SectionHeading
                eyebrow="Manage campus concerns"
                title="Campus reports"
                description="Search submissions, review evidence and manage complaint progress."
              />

              <div className="flex items-center gap-2 text-[11px] text-[#82998b]">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {complaints.length} reports loaded
              </div>
            </div>

            {/* Filters */}
            <div className={`${panel} mt-5 p-4 sm:p-5`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#c6d6cb]">
                  <Filter size={14} className="text-emerald-400" />
                  Find and filter reports
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="relative sm:col-span-2 xl:col-span-1">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718b7b]"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search title, student, location..."
                    className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#0d1b13] pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-[#6f8576] focus:border-emerald-400/50"
                  />
                </label>

                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as FilterStatus)
                  }
                  className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#0d1b13] px-3 text-xs text-[#c4d4c9] outline-none focus:border-emerald-400/50"
                >
                  <option value="all">All statuses</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by priority"
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#0d1b13] px-3 text-xs text-[#c4d4c9] outline-none focus:border-emerald-400/50"
                >
                  <option value="all">All priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>

                <select
                  aria-label="Filter by category"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#0d1b13] px-3 text-xs text-[#c4d4c9] outline-none focus:border-emerald-400/50"
                >
                  <option value="all">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {humanize(category)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 flex flex-col gap-3 border-t border-white/[0.07] pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all", label: "All" },
                    { value: "submitted", label: "New" },
                    { value: "under_review", label: "Review" },
                    { value: "in_progress", label: "In progress" },
                    { value: "resolved", label: "Resolved" },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() =>
                        setStatusFilter(filter.value as FilterStatus)
                      }
                      className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition ${
                        statusFilter === filter.value
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-white/[0.04] text-[#91a79a] hover:bg-white/[0.08]"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-[11px] text-[#91a79a]">
                  <ArrowDownUp size={13} />
                  Sort:
                  <select
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                    className="rounded-lg border border-white/[0.08] bg-[#0d1b13] px-2 py-2 text-[11px] text-[#c4d4c9] outline-none"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="priority">Highest priority</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mb-3 mt-5 flex items-center justify-between gap-3">
              <p className="text-xs text-[#91a79a]">
                Showing{" "}
                <span className="font-semibold text-[#e4eee7]">
                  {filteredComplaints.length}
                </span>{" "}
                of {complaints.length} reports
              </p>

              {fetching && (
                <span className="inline-flex items-center gap-2 text-[10px] text-emerald-300">
                  <RefreshCw size={12} className="animate-spin" />
                  Updating...
                </span>
              )}
            </div>

            {fetching && complaints.length === 0 ? (
              <div className={`${panel} flex min-h-64 items-center justify-center text-xs text-[#91a79a]`}>
                <RefreshCw
                  size={16}
                  className="mr-3 animate-spin text-emerald-400"
                />
                Loading campus reports...
              </div>
            ) : filteredComplaints.length === 0 ? (
              <EmptyState
                title="No reports found"
                description="Try another search term or clear your filters. New student submissions will appear here."
              />
            ) : (
              <div className="space-y-3">
                {filteredComplaints.map((complaint) => {
                  const analysis = getAnalysis(complaint.aiAnalysis);

                  const status = statuses.includes(complaint.status)
                    ? complaint.status
                    : "submitted";

                  const priority = (
                    complaint.priority || "normal"
                  ).toLowerCase();

                  const duplicateState =
                    duplicateResults[complaint.id];

                  return (
                    <article
                      key={complaint.id}
                      className={`${panel} overflow-hidden transition hover:border-white/[0.13]`}
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                          {/* Complaint content */}
                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${statusColors[status]}`}
                              >
                                {statusLabels[status]}
                              </span>

                              <span
                                className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${
                                  priorityColors[priority] || priorityColors.normal
                                }`}
                              >
                                {priority} priority
                              </span>

                              <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[9px] font-semibold text-[#9db2a3]">
                                {humanize(complaint.category)}
                              </span>

                              <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[9px] font-semibold text-[#9db2a3]">
                                {complaint.language === "as"
                                  ? "অসমীয়া"
                                  : complaint.language === "en"
                                    ? "English"
                                    : "Other"}
                              </span>
                            </div>

                            <h3 className="break-words text-base font-semibold leading-6 text-[#e8f1eb] sm:text-lg">
                              {complaint.title}
                            </h3>

                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-[#9db2a3] sm:text-sm">
                              {complaint.description}
                            </p>

                            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-[#82998b]">
                              <span className="inline-flex items-center gap-1.5">
                                <Users size={12} />
                                {complaint.userName || "Student"}
                              </span>

                              {complaint.userEmail && (
                                <span className="break-all">
                                  {complaint.userEmail}
                                </span>
                              )}

                              {complaint.location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={12} />
                                  {complaint.location}
                                </span>
                              )}

                              <span className="inline-flex items-center gap-1">
                                <Clock3 size={12} />
                                {getRelativeDate(complaint.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="w-full shrink-0 rounded-xl border border-white/[0.07] bg-[#0d1b13] p-3 xl:w-[225px]">
                            <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.15em] text-[#82998b]">
                              Manage status
                            </label>

                            <div className="relative">
                              <select
                                value={status}
                                disabled={updatingId === complaint.id}
                                onChange={(event) =>
                                  void updateStatus(
                                    complaint.id,
                                    event.target.value as ComplaintStatus
                                  )
                                }
                                className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-[#14271b] px-3 pr-9 text-xs font-semibold text-[#d9e8dd] outline-none focus:border-emerald-400/50 disabled:opacity-50"
                              >
                                {statuses.map((item) => (
                                  <option key={item} value={item}>
                                    {statusLabels[item]}
                                  </option>
                                ))}
                              </select>

                              <ChevronDown
                                size={14}
                                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#82998b]"
                              />
                            </div>

                            {updatingId === complaint.id && (
                              <p className="mt-2 text-[10px] text-emerald-300">
                                Saving changes...
                              </p>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                void scanForDuplicates(complaint.id)
                              }
                              disabled={scanningId === complaint.id}
                              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <ScanSearch
                                size={14}
                                className={
                                  scanningId === complaint.id
                                    ? "animate-pulse"
                                    : ""
                                }
                              />
                              {scanningId === complaint.id
                                ? "Scanning..."
                                : "Scan duplicates"}
                            </button>

                            <p className="mt-2 text-center text-[9px] leading-4 text-[#718b7b]">
                              AI suggestions require admin review.
                            </p>
                          </div>
                        </div>

                        {/* Duplicate errors */}
                        {duplicateErrors[complaint.id] && (
                          <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-200">
                            {duplicateErrors[complaint.id]}
                          </div>
                        )}

                        {/* Duplicate results */}
                        {duplicateState && (
                          <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                                <ScanSearch size={15} />
                                Duplicate detection results
                              </div>

                              <span className="text-[10px] text-[#91a79a]">
                                {duplicateState.candidatesCompared ?? 0} reports compared
                              </span>
                            </div>

                            {duplicateState.matches.length === 0 ? (
                              <p className="mt-3 text-xs text-[#9db2a3]">
                                No likely duplicates found for this report.
                              </p>
                            ) : (
                              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                {duplicateState.matches.map((match) => {
                                  const matchedComplaint = complaints.find(
                                    (item) => item.id === match.complaintId
                                  );

                                  return (
                                    <div
                                      key={match.complaintId}
                                      className="rounded-xl border border-white/[0.08] bg-[#102119] p-3"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <p className="text-xs font-semibold leading-5 text-[#e4eee7]">
                                          {matchedComplaint?.title ||
                                            `Report ${match.complaintId.slice(0, 8)}`}
                                        </p>

                                        <span className="shrink-0 rounded-lg bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
                                          {Math.round(match.similarity * 100)}%
                                        </span>
                                      </div>

                                      <p className="mt-2 text-[11px] leading-5 text-[#9db2a3]">
                                        {match.reasonEnglish}
                                      </p>

                                      <p
                                        lang="as"
                                        className="mt-2 text-[11px] leading-5 text-[#9db2a3]"
                                      >
                                        {match.reasonAssamese}
                                      </p>

                                      <p className="mt-2 break-all font-mono text-[9px] text-[#718b7b]">
                                        {match.complaintId}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Complaint details and AI assessment */}
                      <details className="group border-t border-white/[0.07]">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-xs font-semibold text-[#a9c1b0] transition hover:bg-white/[0.025] sm:px-5">
                          <span className="inline-flex items-center gap-2">
                            <Sparkles size={14} className="text-emerald-400" />
                            Complaint details and AI assessment
                          </span>

                          <ChevronDown
                            size={15}
                            className="text-[#82998b] transition group-open:rotate-180"
                          />
                        </summary>

                        <div className="grid gap-4 border-t border-white/[0.06] bg-[#0e1b13]/70 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_250px]">
                          <div className="min-w-0">
                            {analysis ? (
                              <div className="space-y-4">
                                <div>
                                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-emerald-300">
                                    <Sparkles size={14} />
                                    Gemini AI assessment
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-xl border border-white/[0.07] bg-[#14271b] p-4">
                                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#82998b]">
                                        English summary
                                      </p>
                                      <p className="mt-2 text-xs leading-6 text-[#c0d2c6]">
                                        {analysis.summaryEnglish || "Not available"}
                                      </p>
                                    </div>

                                    <div className="rounded-xl border border-white/[0.07] bg-[#14271b] p-4">
                                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#82998b]">
                                        অসমীয়া সাৰাংশ
                                      </p>
                                      <p
                                        lang="as"
                                        className="mt-2 text-xs leading-6 text-[#c0d2c6]"
                                      >
                                        {analysis.summaryAssamese || "উপলব্ধ নহয়"}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="rounded-xl border border-white/[0.07] bg-[#14271b] p-3">
                                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#82998b]">
                                      Recommended department
                                    </p>
                                    <p className="mt-2 text-xs font-semibold text-[#d8e6dc]">
                                      {analysis.recommendedDepartment ||
                                        complaint.department ||
                                        "Unassigned"}
                                    </p>
                                  </div>

                                  <div className="rounded-xl border border-white/[0.07] bg-[#14271b] p-3">
                                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#82998b]">
                                      Suggested action
                                    </p>
                                    <p className="mt-2 text-xs leading-5 text-[#c0d2c6]">
                                      {analysis.recommendedAction ||
                                        "No recommendation available."}
                                    </p>
                                  </div>

                                  {analysis.priorityReason && (
                                    <div className="rounded-xl border border-white/[0.07] bg-[#14271b] p-3 sm:col-span-2">
                                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#82998b]">
                                        Priority reasoning
                                      </p>
                                      <p className="mt-2 text-xs leading-5 text-[#c0d2c6]">
                                        {analysis.priorityReason}
                                      </p>
                                    </div>
                                  )}

                                  {analysis.imageFindings && (
                                    <div className="rounded-xl border border-white/[0.07] bg-[#14271b] p-3 sm:col-span-2">
                                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#82998b]">
                                        Image findings
                                      </p>
                                      <p className="mt-2 text-xs leading-5 text-[#c0d2c6]">
                                        {analysis.imageFindings}
                                      </p>
                                    </div>
                                  )}

                                  {analysis.locationDetected && (
                                    <div className="rounded-xl border border-white/[0.07] bg-[#14271b] p-3 sm:col-span-2">
                                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#82998b]">
                                        AI-detected location
                                      </p>
                                      <p className="mt-2 text-xs text-[#c0d2c6]">
                                        {analysis.locationDetected}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                <p className="text-[10px] leading-5 text-[#718b7b]">
                                  AI-generated assessment is advisory.
                                  Administrators must verify the information
                                  before making decisions.
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-[#82998b]">
                                <Sparkles
                                  size={19}
                                  className="mx-auto mb-2 text-[#718b7b]"
                                />
                                AI analysis has not been generated for this
                                report yet.
                              </div>
                            )}
                          </div>

                          <div className="space-y-3">
                            {complaint.image?.secureUrl ? (
                              <a
                                href={complaint.image.secureUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group/image block overflow-hidden rounded-xl border border-white/[0.08] bg-[#14271b]"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={complaint.image.secureUrl}
                                  alt="Student attached complaint evidence"
                                  className="h-44 w-full object-cover transition duration-300 group-hover/image:scale-[1.03]"
                                />

                                <span className="flex items-center justify-between px-3 py-3 text-[10px] font-semibold text-[#b9ccbf]">
                                  View attached evidence
                                  <ArrowUpRight size={13} />
                                </span>
                              </a>
                            ) : (
                              <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#14271b] text-xs text-[#718b7b]">
                                No image attached
                              </div>
                            )}

                            <div className="rounded-xl border border-white/[0.07] bg-[#14271b] p-3">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-[#82998b]">
                                Complaint ID
                              </p>
                              <p className="mt-2 break-all font-mono text-[10px] leading-5 text-[#b8cbbd]">
                                {complaint.id}
                              </p>

                              <div className="my-3 border-t border-white/[0.07]" />

                              <p className="text-[9px] font-bold uppercase tracking-wide text-[#82998b]">
                                Assigned department
                              </p>
                              <p className="mt-2 text-xs text-[#c0d2c6]">
                                {complaint.department || "Unassigned"}
                              </p>

                              <div className="my-3 border-t border-white/[0.07]" />

                              <p className="text-[9px] font-bold uppercase tracking-wide text-[#82998b]">
                                Submitted
                              </p>
                              <p className="mt-2 text-xs leading-5 text-[#c0d2c6]">
                                {formatDate(complaint.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Footer */}
          <footer className="flex flex-col justify-between gap-3 border-t border-white/[0.07] py-5 text-[10px] text-[#718b7b] sm:flex-row sm:items-center">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={13} className="text-emerald-400" />
              CivicSense AI · Human-reviewed campus issue management
            </span>

            <span>
              Administrator workspace · Bilingual campus reporting
            </span>
          </footer>
        </div>
      </div>
    </main>
  );
}

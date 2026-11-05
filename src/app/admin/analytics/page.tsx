
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Languages,
  LogOut,
  MapPin,
  MapPinned,
  Menu,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  Vote,
  X,
} from "lucide-react";

import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/auth-provider";
import ThemeToggle from "@/components/ui/theme-toggle";
import type { Complaint } from "@/types/complaint";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type DuplicateMatch = {
  complaintId: string;
  similarity: number;
  reasonEnglish: string;
  reasonAssamese: string;
};

type AdminComplaint = Complaint & {
  possibleDuplicates?: DuplicateMatch[];
  duplicateScanAt?: string | null;
};

type CivicSpaceReport = {
  id: string;
  postId: string;
  commentId: string | null;
  reporterUid: string;
  reason: string;
  details: string;
  status: "pending" | "resolved";
  resolution: "dismiss" | "remove_content" | null;
  createdAt: string | null;
  reviewedAt: string | null;
  targetExists: boolean;
  targetType: "post" | "comment";
  targetContent: string;
  targetTitle: string;
  targetCategory: string;
  targetAuthor: string;
  targetModerationStatus: string;
};

type InsightItem = {
  label: string;
  count: number;
};

type RecurringIssue = {
  id: string;
  complaints: AdminComplaint[];
  averageSimilarity: number;
  reasons: string[];
  reasonsAssamese: string[];
};

type CampusHotspot = {
  id: string;
  reports: AdminComplaint[];
  latitude: number;
  longitude: number;
  unresolvedCount: number;
  highPriorityCount: number;
  categories: InsightItem[];
  location: string;
};

type TrendItem = {
  key: string;
  label: string;
  count: number;
};

const panel =
  "rounded-2xl border border-white/[0.08] bg-[#12231a]";

/* -------------------------------------------------------------------------- */
/*                                UTILITIES                                   */
/* -------------------------------------------------------------------------- */

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getDistanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const earthRadius = 6371000;
  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

function countBy(values: string[]): InsightItem[] {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const label = value?.trim() || "Other";
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/* -------------------------------------------------------------------------- */
/*                              SHARED COMPONENTS                            */
/* -------------------------------------------------------------------------- */

function InsightBars({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: InsightItem[];
}) {
  const maximum = Math.max(
    ...items.map((item) => item.count),
    1
  );

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

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-xl font-semibold text-[#e8f1eb] sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1 text-xs leading-5 text-[#82998b] sm:text-sm">
        {description}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              MAIN ANALYTICS                                */
/* -------------------------------------------------------------------------- */

export default function CampusIntelligencePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [civicReports, setCivicReports] = useState<CivicSpaceReport[]>([]);

  const [fetching, setFetching] = useState(true);
  const [civicFetching, setCivicFetching] = useState(false);

  const [error, setError] = useState("");
  const [civicError, setCivicError] = useState("");

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

  /* ------------------------------------------------------------------------ */
  /*                              DATA FETCHING                               */
  /* ------------------------------------------------------------------------ */

  const loadAnalytics = useCallback(async () => {
    if (!user) return;

    setFetching(true);
    setCivicFetching(true);
    setError("");
    setCivicError("");

    try {
      const token = await user.getIdToken();

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [complaintResponse, civicResponse] =
        await Promise.all([
          fetch("/api/admin/complaints", {
            method: "GET",
            headers,
            cache: "no-store",
          }),
          fetch("/api/admin/civicspace?status=all", {
            method: "GET",
            headers,
            cache: "no-store",
          }),
        ]);

      const [complaintData, civicData] = await Promise.all([
        complaintResponse.json(),
        civicResponse.json(),
      ]);

      if (!complaintResponse.ok) {
        throw new Error(
          complaintData.error ||
            "Unable to load campus analytics."
        );
      }

      setComplaints(
        Array.isArray(complaintData.complaints)
          ? complaintData.complaints
          : []
      );

      if (!civicResponse.ok) {
        setCivicReports([]);
        setCivicError(
          civicData.error ||
            "Unable to load CivicSpace analytics."
        );
      } else {
        setCivicReports(
          Array.isArray(civicData.reports)
            ? civicData.reports
            : []
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load campus intelligence."
      );
    } finally {
      setFetching(false);
      setCivicFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && user) {
      void loadAnalytics();
    }
  }, [loading, user, loadAnalytics]);

  /* ------------------------------------------------------------------------ */
  /*                          CAMPUS COMPLAINT STATS                          */
  /* ------------------------------------------------------------------------ */

  const stats = useMemo(() => {
    const total = complaints.length;

    const resolved = complaints.filter(
      (item) => item.status === "resolved"
    ).length;

    const active = complaints.filter(
      (item) =>
        !["resolved", "rejected"].includes(item.status)
    ).length;

    const critical = complaints.filter(
      (item) =>
        item.priority?.toLowerCase() === "critical"
    ).length;

    const highPriority = complaints.filter((item) =>
      ["critical", "high"].includes(
        (item.priority || "").toLowerCase()
      )
    ).length;

    const unassigned = complaints.filter(
      (item) =>
        !item.department ||
        item.department === "unassigned"
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

  /* ------------------------------------------------------------------------ */
  /*                          CIVICSPACE MODERATION                           */
  /* ------------------------------------------------------------------------ */

  const civicStats = useMemo(() => {
    const total = civicReports.length;

    const pending = civicReports.filter(
      (report) => report.status === "pending"
    ).length;

    const resolved = civicReports.filter(
      (report) => report.status === "resolved"
    ).length;

    const dismissed = civicReports.filter(
      (report) => report.resolution === "dismiss"
    ).length;

    const removed = civicReports.filter(
      (report) =>
        report.resolution === "remove_content"
    ).length;

    const postReports = civicReports.filter(
      (report) => report.targetType === "post"
    ).length;

    const commentReports = civicReports.filter(
      (report) => report.targetType === "comment"
    ).length;

    const missingTargets = civicReports.filter(
      (report) => !report.targetExists
    ).length;

    return {
      total,
      pending,
      resolved,
      dismissed,
      removed,
      postReports,
      commentReports,
      missingTargets,
      resolutionRate: total
        ? Math.round((resolved / total) * 100)
        : 0,
    };
  }, [civicReports]);

  const civicInsights = useMemo(() => {
    return {
      reasons: countBy(
        civicReports.map((report) => report.reason)
      ),

      categories: countBy(
        civicReports.map(
          (report) => report.targetCategory
        )
      ),

      targetTypes: [
        {
          label: "Community posts",
          count: civicStats.postReports,
        },
        {
          label: "Comments",
          count: civicStats.commentReports,
        },
      ],

      resolutions: [
        {
          label: "Content removed",
          count: civicStats.removed,
        },
        {
          label: "Reports dismissed",
          count: civicStats.dismissed,
        },
        {
          label: "Awaiting review",
          count: civicStats.pending,
        },
      ],
    };
  }, [civicReports, civicStats]);

  /* ------------------------------------------------------------------------ */
  /*                         CAMPUS COMPLAINT INSIGHTS                        */
  /* ------------------------------------------------------------------------ */

  const insights = useMemo(() => {
    const trend: TrendItem[] = currentDate
      ? Array.from({ length: 7 }, (_, index) => {
          const date = new Date(currentDate.getTime());

          date.setHours(0, 0, 0, 0);
          date.setDate(
            currentDate.getDate() - (6 - index)
          );

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
        complaints.map(
          (item) => item.category || "Uncategorized"
        )
      ).slice(0, 8),

      departments: countBy(
        complaints.map(
          (item) => item.department || "Unassigned"
        )
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
            (item) =>
              !["en", "as"].includes(item.language)
          ).length,
        },
      ],
    };
  }, [complaints, currentDate]);

  /* ------------------------------------------------------------------------ */
  /*                         RECURRING ISSUE DETECTION                         */
  /* ------------------------------------------------------------------------ */

  const recurringIssues = useMemo<RecurringIssue[]>(() => {
    const complaintMap = new Map(
      complaints.map((complaint) => [
        complaint.id,
        complaint,
      ])
    );

    const edges = new Map<
      string,
      {
        firstId: string;
        secondId: string;
        similarity: number;
        reasonEnglish: string;
        reasonAssamese: string;
      }
    >();

    for (const complaint of complaints) {
      for (const match of complaint.possibleDuplicates || []) {
        if (!complaintMap.has(match.complaintId)) continue;
        if (match.complaintId === complaint.id) continue;

        const [firstId, secondId] = [
          complaint.id,
          match.complaintId,
        ].sort();

        const key = `${firstId}:${secondId}`;
        const existing = edges.get(key);

        if (
          !existing ||
          match.similarity > existing.similarity
        ) {
          edges.set(key, {
            firstId,
            secondId,
            similarity: match.similarity,
            reasonEnglish: match.reasonEnglish,
            reasonAssamese: match.reasonAssamese,
          });
        }
      }
    }

    const adjacency = new Map<string, Set<string>>();

    for (const edge of edges.values()) {
      if (!adjacency.has(edge.firstId)) {
        adjacency.set(edge.firstId, new Set());
      }

      if (!adjacency.has(edge.secondId)) {
        adjacency.set(edge.secondId, new Set());
      }

      adjacency.get(edge.firstId)!.add(edge.secondId);
      adjacency.get(edge.secondId)!.add(edge.firstId);
    }

    const visited = new Set<string>();
    const groups: RecurringIssue[] = [];

    for (const startId of adjacency.keys()) {
      if (visited.has(startId)) continue;

      const stack = [startId];
      const groupIds: string[] = [];

      visited.add(startId);

      while (stack.length) {
        const currentId = stack.pop()!;
        groupIds.push(currentId);

        for (const neighbour of adjacency.get(currentId) || []) {
          if (visited.has(neighbour)) continue;

          visited.add(neighbour);
          stack.push(neighbour);
        }
      }

      if (groupIds.length < 2) continue;

      const groupSet = new Set(groupIds);

      const groupEdges = Array.from(edges.values()).filter(
        (edge) =>
          groupSet.has(edge.firstId) &&
          groupSet.has(edge.secondId)
      );

      const groupComplaints = groupIds
        .map((id) => complaintMap.get(id))
        .filter(
          (item): item is AdminComplaint => Boolean(item)
        )
        .sort((a, b) =>
          (b.createdAt || "").localeCompare(
            a.createdAt || ""
          )
        );

      if (
        groupComplaints.length < 2 ||
        groupEdges.length === 0
      ) {
        continue;
      }

      groups.push({
        id: groupIds.slice().sort()[0],
        complaints: groupComplaints,
        averageSimilarity:
          groupEdges.reduce(
            (total, edge) => total + edge.similarity,
            0
          ) / groupEdges.length,
        reasons: groupEdges.map(
          (edge) => edge.reasonEnglish
        ),
        reasonsAssamese: groupEdges.map(
          (edge) => edge.reasonAssamese
        ),
      });
    }

    return groups.sort(
      (a, b) =>
        b.complaints.length - a.complaints.length ||
        b.averageSimilarity - a.averageSimilarity
    );
  }, [complaints]);

  /* ------------------------------------------------------------------------ */
  /*                           GEOGRAPHIC HOTSPOTS                             */
  /* ------------------------------------------------------------------------ */

  const campusHotspots = useMemo<CampusHotspot[]>(() => {
    const reportsWithCoordinates = complaints
      .filter(
        (report) =>
          report.status !== "rejected" &&
          report.coordinates &&
          Number.isFinite(report.coordinates.lat) &&
          Number.isFinite(report.coordinates.lng)
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      );

    const clusters: {
      id: string;
      reports: AdminComplaint[];
      latitude: number;
      longitude: number;
    }[] = [];

    const HOTSPOT_RADIUS_METERS = 100;

    for (const report of reportsWithCoordinates) {
      const coordinates = report.coordinates;

      if (!coordinates) continue;

      let nearestCluster:
        | (typeof clusters)[number]
        | undefined;

      let nearestDistance = HOTSPOT_RADIUS_METERS;

      for (const cluster of clusters) {
        const distance = getDistanceInMeters(
          coordinates.lat,
          coordinates.lng,
          cluster.latitude,
          cluster.longitude
        );

        if (distance <= nearestDistance) {
          nearestDistance = distance;
          nearestCluster = cluster;
        }
      }

      if (nearestCluster) {
        nearestCluster.reports.push(report);

        const total = nearestCluster.reports.length;

        nearestCluster.latitude =
          nearestCluster.reports.reduce(
            (sum, item) =>
              sum + (item.coordinates?.lat ?? 0),
            0
          ) / total;

        nearestCluster.longitude =
          nearestCluster.reports.reduce(
            (sum, item) =>
              sum + (item.coordinates?.lng ?? 0),
            0
          ) / total;
      } else {
        clusters.push({
          id: report.id,
          reports: [report],
          latitude: coordinates.lat,
          longitude: coordinates.lng,
        });
      }
    }

    return clusters
      .filter((cluster) => cluster.reports.length >= 2)
      .map((cluster) => {
        const categoryCounts = new Map<string, number>();
        const locationCounts = new Map<string, number>();

        for (const report of cluster.reports) {
          categoryCounts.set(
            report.category || "Uncategorized",
            (categoryCounts.get(
              report.category || "Uncategorized"
            ) ?? 0) + 1
          );

          locationCounts.set(
            report.location || "Campus area",
            (locationCounts.get(
              report.location || "Campus area"
            ) ?? 0) + 1
          );
        }

        const categories = Array.from(
          categoryCounts.entries()
        )
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count);

        const location =
          Array.from(locationCounts.entries()).sort(
            (a, b) => b[1] - a[1]
          )[0]?.[0] ?? "Campus area";

        return {
          id: cluster.id,
          reports: cluster.reports,
          latitude: cluster.latitude,
          longitude: cluster.longitude,
          unresolvedCount: cluster.reports.filter(
            (report) =>
              report.status !== "resolved" &&
              report.status !== "rejected"
          ).length,
          highPriorityCount: cluster.reports.filter(
            (report) =>
              ["high", "critical"].includes(
                (report.priority || "").toLowerCase()
              )
          ).length,
          categories,
          location,
        };
      })
      .sort(
        (a, b) =>
          b.reports.length - a.reports.length ||
          b.unresolvedCount - a.unresolvedCount
      );
  }, [complaints]);

  /* ------------------------------------------------------------------------ */
  /*                                ACTIONS                                   */
  /* ------------------------------------------------------------------------ */

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch {
      setError("Unable to sign out. Please try again.");
    }
  }

  function navigateTo(path: string) {
    setMobileMenuOpen(false);
    router.push(path);
  }

  /* ------------------------------------------------------------------------ */
  /*                              LOADING STATE                               */
  /* ------------------------------------------------------------------------ */

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

  const navItemClass =
    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold text-[#9db2a3] transition hover:bg-white/[0.04] hover:text-white";

  /* ------------------------------------------------------------------------ */
  /*                                   UI                                     */
  /* ------------------------------------------------------------------------ */

  return (
    <main className="admin-console min-h-screen bg-[#0b1711] text-[#e8f1eb]">
      {mobileMenuOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[265px] flex-col border-r border-white/[0.07] bg-[#101f16] transition-transform duration-300 lg:translate-x-0 ${
          mobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full"
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

        <div className="flex-1 overflow-y-auto px-4 pt-7">
          <p className="mb-3 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[#657c6c]">
            Workspace
          </p>

          <nav className="space-y-1">
            <button
              onClick={() => navigateTo("/admin")}
              className={navItemClass}
            >
              <ClipboardList size={17} />
              Overview
            </button>

            <button
              onClick={() => navigateTo("/admin#reports")}
              className={navItemClass}
            >
              <Users size={17} />
              Campus reports
            </button>

            <button
              onClick={() => navigateTo("/admin/civic-map")}
              className={navItemClass}
            >
              <MapPinned size={17} />
              Civic Map
              <ArrowUpRight
                size={13}
                className="ml-auto opacity-50"
              />
            </button>

            <button
              onClick={() => navigateTo("/admin/community")}
              className={navItemClass}
            >
              <Vote size={17} />
              CivicSpace Moderation
              <ArrowUpRight
                size={13}
                className="ml-auto opacity-50"
              />
            </button>

            <button
              onClick={() => navigateTo("/admin/analytics")}
              className="flex w-full items-center gap-3 rounded-xl bg-emerald-400/10 px-3 py-3 text-left text-xs font-semibold text-emerald-300"
            >
              <BarChart3 size={17} />
              Campus intelligence
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-300" />
            </button>
          </nav>
        </div>

        <div className="p-4">
          <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.06] p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <Activity size={15} />
              <span className="text-xs font-semibold">
                Live campus overview
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-5 text-[#91a79a]">
              Analytics combine campus reports and CivicSpace
              moderation data.
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

      {/* MAIN CONTENT */}

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
                  Reporting patterns and community insights
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />

              <button
                onClick={() => void loadAnalytics()}
                disabled={fetching || civicFetching}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-[#b5c7ba] transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={
                    fetching || civicFetching
                      ? "animate-spin"
                      : ""
                  }
                />
                <span className="hidden sm:inline">
                  Refresh
                </span>
              </button>

              <button
                onClick={() => navigateTo("/admin")}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-300 px-3 text-xs font-bold text-[#10271d] transition hover:bg-emerald-200"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">
                  Dashboard
                </span>
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] space-y-9 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

          {/* HERO */}

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
                  Understand student concerns, identify recurring
                  issues, monitor department workloads and track
                  community moderation through campus reporting data.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-[10px] text-[#b5cbbd]">
                  Campus reports analysed
                </p>
                <p className="mt-1 text-3xl font-semibold text-white">
                  {stats.total}
                </p>
                <p className="mt-1 text-[10px] text-emerald-200">
                  Admin API data
                </p>
              </div>
            </div>
          </section>

          {/* ERRORS */}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-xs text-rose-200"
            >
              Campus reports: {error}
            </div>
          )}

          {/* CAMPUS OVERVIEW */}

          <section className="space-y-4">
            <SectionHeading
              eyebrow="Campus reporting"
              title="Campus at a glance"
              description="Key indicators from the loaded campus reports."
            />

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

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className={`${panel} flex items-center gap-4 p-5`}>
                <div className="rounded-xl bg-rose-400/10 p-3 text-rose-300">
                  <AlertTriangle size={19} />
                </div>
                <div>
                  <p className="text-xs text-[#82998b]">
                    Critical reports
                  </p>
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
                  <p className="text-xs text-[#82998b]">
                    Unassigned reports
                  </p>
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
                    {complaints.filter(
                      (item) => item.language === "as"
                    ).length}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CAMPUS CHARTS */}

          <section className="space-y-4">
            <SectionHeading
              eyebrow="Reporting insights"
              title="Campus reporting patterns"
              description="Explore report activity, categories, departments, status and language."
            />

            <div className="grid gap-4 xl:grid-cols-2">
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
            </div>
          </section>

          {/* GEOGRAPHIC HOTSPOTS */}

          <section className="space-y-5">
            <SectionHeading
              eyebrow="Geographic intelligence"
              title="Campus hotspot intelligence"
              description="Identify campus areas with multiple nearby complaints."
            />

            <div className={`${panel} inline-flex items-center gap-4 p-4`}>
              <div className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300">
                <MapPinned size={20} />
              </div>
              <div>
                <p className="text-xs text-[#82998b]">
                  Potential hotspots
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {campusHotspots.length}
                </p>
              </div>
            </div>

            {campusHotspots.length === 0 ? (
              <div className={`${panel} p-8 text-center`}>
                <MapPin
                  size={25}
                  className="mx-auto text-[#82998b]"
                />
                <p className="mt-3 font-medium text-white">
                  No recurring geographic hotspots yet
                </p>
                <p className="mt-2 text-sm text-white/50">
                  At least two reports with valid coordinates must
                  be within approximately 100 metres of one another.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {campusHotspots.map((hotspot, index) => (
                  <article
                    key={hotspot.id}
                    className={`${panel} p-5`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-emerald-400">
                          HOTSPOT #{index + 1}
                        </p>

                        <h3 className="mt-2 text-lg font-semibold text-white">
                          {hotspot.location}
                        </h3>

                        <p className="mt-1 text-xs text-white/40">
                          {hotspot.latitude.toFixed(4)},{" "}
                          {hotspot.longitude.toFixed(4)}
                        </p>
                      </div>

                      <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                        {hotspot.reports.length} reports
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white/[0.04] p-3">
                        <p className="text-xs text-white/45">
                          Unresolved
                        </p>
                        <p className="mt-1 text-xl font-semibold text-white">
                          {hotspot.unresolvedCount}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/[0.04] p-3">
                        <p className="text-xs text-white/45">
                          High / critical priority
                        </p>
                        <p className="mt-1 text-xl font-semibold text-white">
                          {hotspot.highPriorityCount}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                        Report categories
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {hotspot.categories.map((category) => (
                          <span
                            key={category.label}
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75"
                          >
                            {category.label} · {category.count}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 border-t border-white/10 pt-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/45">
                        Recent reports
                      </p>

                      <div className="space-y-3">
                        {hotspot.reports.slice(0, 3).map((report) => (
                          <div
                            key={report.id}
                            className="flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-white/85">
                                {report.title}
                              </p>
                              <p className="mt-1 text-xs text-white/40">
                                {report.category} · {report.department}
                              </p>
                            </div>

                            <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] text-white/65">
                              {report.status.replaceAll("_", " ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <a
                      href="/campus-map"
                      className="mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/20"
                    >
                      <MapPin size={16} />
                      View all issues on Civic Map
                    </a>
                  </article>
                ))}
              </div>
            )}

            <p className="text-xs leading-relaxed text-white/35">
              Hotspots are approximate geographic clusters based on
              report coordinates within a 100-metre radius. They
              indicate areas with multiple reports, not confirmed
              causes or verified incidents.
            </p>
          </section>

          {/* RECURRING ISSUE INTELLIGENCE */}

          <section className={`${panel} p-5 sm:p-6`}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Activity size={17} className="text-emerald-300" />
                  <h2 className="text-lg font-semibold text-[#e8f1eb]">
                    Recurring issue intelligence
                  </h2>
                </div>

                <p className="mt-2 text-xs leading-5 text-[#82998b]">
                  Related complaints identified by bilingual AI
                  duplicate detection.
                </p>
              </div>

              <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3">
                <p className="text-[10px] text-[#91a79a]">
                  Potential issue groups
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-300">
                  {recurringIssues.length}
                </p>
              </div>
            </div>

            {recurringIssues.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
                <Activity
                  size={25}
                  className="mx-auto text-[#82998b]"
                />
                <p className="mt-3 text-sm font-medium text-[#dce9df]">
                  No recurring issue groups found
                </p>
                <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#82998b]">
                  Run duplicate detection on campus reports to
                  identify potentially related complaints here.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {recurringIssues.map((group, index) => (
                  <article
                    key={group.id}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          Potential recurring pattern {index + 1}
                        </p>
                        <h3 className="mt-2 text-sm font-semibold text-[#e8f1eb]">
                          {group.complaints.length} related reports
                        </h3>
                      </div>

                      <div className="rounded-lg bg-emerald-400/10 px-3 py-2">
                        <p className="text-[9px] text-[#91a79a]">
                          Average similarity
                        </p>
                        <p className="mt-1 text-sm font-semibold text-emerald-300">
                          {Math.round(
                            group.averageSimilarity * 100
                          )}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {group.complaints.map((complaint) => (
                        <div
                          key={complaint.id}
                          className="rounded-xl border border-white/[0.06] bg-[#0b1711]/60 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#dce9df]">
                              {complaint.title}
                            </span>

                            <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[9px] text-[#a9bdb0]">
                              {complaint.status.replaceAll("_", " ")}
                            </span>
                          </div>

                          <p className="mt-2 text-[11px] leading-5 text-[#91a79a]">
                            {complaint.location ||
                              "Location unavailable"}
                          </p>

                          <p className="mt-1 text-[10px] text-[#718b7b]">
                            {complaint.language === "as"
                              ? "অসমীয়া"
                              : "English"}
                            {" · "}
                            {complaint.category || "Uncategorized"}
                          </p>
                        </div>
                      ))}
                    </div>

                    {group.reasons.length > 0 && (
                      <div className="mt-4 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-3">
                        <p className="text-[10px] font-semibold text-emerald-300">
                          AI comparison
                        </p>

                        <p className="mt-2 text-xs leading-5 text-[#b6c8bc]">
                          {group.reasons[0]}
                        </p>

                        {group.reasonsAssamese[0] && (
                          <p className="mt-2 text-xs leading-5 text-[#b6c8bc]">
                            {group.reasonsAssamese[0]}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() =>
                        navigateTo("/admin#reports")
                      }
                      className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-300 transition hover:text-emerald-200"
                    >
                      Review reports
                      <ArrowUpRight size={13} />
                    </button>
                  </article>
                ))}
              </div>
            )}

            <p className="mt-4 text-[10px] leading-5 text-[#718b7b]">
              AI-identified relationships are potential patterns,
              not confirmed duplicates. Administrators must verify
              whether reports describe the same real-world issue.
            </p>
          </section>

          {/* CIVICSPACE MODERATION ANALYTICS */}

          <section className="space-y-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
                  CivicSpace intelligence
                </p>

                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Community moderation analytics
                </h2>

                <p className="mt-1 text-sm text-white/50">
                  Understand reported posts, comments and moderation outcomes.
                </p>
              </div>

              <button
                onClick={() => navigateTo("/admin/community")}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/10 px-4 py-2.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/20"
              >
                Open moderation dashboard
                <ArrowUpRight size={14} />
              </button>
            </div>

            {civicError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-xs text-rose-200"
              >
                CivicSpace: {civicError}
              </div>
            )}

            <div className="grid gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Total community reports"
                value={civicStats.total}
                description="Moderation reports received"
                icon={ClipboardList}
                accent="bg-violet-400/10 text-violet-300"
              />

              <Metric
                label="Pending review"
                value={civicStats.pending}
                description="Awaiting administrator action"
                icon={Clock3}
                accent="bg-amber-400/10 text-amber-300"
              />

              <Metric
                label="Content removed"
                value={civicStats.removed}
                description="Posts or comments moderated"
                icon={ShieldCheck}
                accent="bg-rose-400/10 text-rose-300"
              />

              <Metric
                label="Moderation resolution"
                value={`${civicStats.resolutionRate}%`}
                description={`${civicStats.resolved} reports reviewed`}
                icon={CheckCircle2}
                accent="bg-emerald-400/10 text-emerald-300"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className={`${panel} p-5`}>
                <p className="text-xs text-[#82998b]">
                  Reports dismissed
                </p>
                <p className="mt-2 text-3xl font-semibold text-[#e8f1eb]">
                  {civicStats.dismissed}
                </p>
                <p className="mt-1 text-[11px] text-[#718b7b]">
                  No content removal performed
                </p>
              </div>

              <div className={`${panel} p-5`}>
                <p className="text-xs text-[#82998b]">
                  Post reports
                </p>
                <p className="mt-2 text-3xl font-semibold text-[#e8f1eb]">
                  {civicStats.postReports}
                </p>
                <p className="mt-1 text-[11px] text-[#718b7b]">
                  Reports targeting community posts
                </p>
              </div>

              <div className={`${panel} p-5`}>
                <p className="text-xs text-[#82998b]">
                  Comment reports
                </p>
                <p className="mt-2 text-3xl font-semibold text-[#e8f1eb]">
                  {civicStats.commentReports}
                </p>
                <p className="mt-1 text-[11px] text-[#718b7b]">
                  Reports targeting comments
                </p>
              </div>
            </div>

            {civicFetching && (
              <p className="flex items-center gap-2 text-xs text-violet-300">
                <RefreshCw
                  size={13}
                  className="animate-spin"
                />
                Updating CivicSpace analytics...
              </p>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              <InsightBars
                title="Moderation report reasons"
                description="Most frequently selected report reasons"
                items={civicInsights.reasons}
              />

              <InsightBars
                title="Reported content categories"
                description="Categories of reported community posts"
                items={civicInsights.categories}
              />

              <InsightBars
                title="Moderation outcomes"
                description="How administrators handled reports"
                items={civicInsights.resolutions}
              />

              <InsightBars
                title="Reported content types"
                description="Posts compared with comments"
                items={civicInsights.targetTypes}
              />
            </div>

            <div className={`${panel} p-5`}>
              <div className="flex items-center gap-2">
                <AlertTriangle
                  size={17}
                  className="text-amber-300"
                />
                <h3 className="text-sm font-semibold text-[#e4eee7]">
                  Moderation data quality
                </h3>
              </div>

              <p className="mt-2 text-xs leading-5 text-[#82998b]">
                {civicStats.missingTargets} reports currently reference
                content that no longer exists. These reports remain
                included in moderation totals but cannot be treated
                as successful content removals.
              </p>

              <p className="mt-3 text-[10px] text-[#718b7b]">
                Statistics are calculated from the latest 200 reports
                returned by the CivicSpace admin API.
              </p>
            </div>
          </section>

          {/* SUMMARY */}

          <section className={`${panel} p-5`}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-semibold text-[#e4eee7]">
                  What these insights mean
                </h3>

                <p className="mt-1 text-xs leading-5 text-[#82998b]">
                  Use these indicators to identify areas that may need
                  administrative attention across campus reporting
                  and community moderation.
                </p>
              </div>

              <button
                onClick={() => navigateTo("/admin#reports")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-xs font-bold text-[#10271d] transition hover:bg-emerald-200"
              >
                Review campus reports
                <ArrowUpRight size={14} />
              </button>
            </div>
          </section>

          {/* FOOTER */}

          <p className="border-t border-white/[0.07] py-5 text-[10px] leading-5 text-[#718b7b]">
            Campus analytics represent reports returned by the
            campus admin API (maximum 250). CivicSpace moderation
            analytics represent the latest 200 moderation reports.
            Counts are descriptive and do not establish causes or
            independently verify reported issues.
          </p>
        </div>
      </div>
    </main>
  );
}

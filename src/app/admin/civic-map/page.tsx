
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  ClipboardList,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";

type MapReport = {
  id: string;
  coordinates: { lat: number; lng: number };
  category: string;
  priority: string;
  department: string;
  status: string;
  location: string;
  voteCount: number;
  createdAt: string | null;
};

function humanize(value?: string) {
  return value
    ? value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Unclassified";
}

function formatDate(value: string | null) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString();
}

export default function CivicMapAdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [reports, setReports] = useState<MapReport[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    if (!user) return;

    setFetching(true);
    setError("");

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/civic-map", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load map reports.");
      }

      setReports(Array.isArray(data.reports) ? data.reports : []);
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
    if (!loading && user) void loadReports();
  }, [loading, user, loadReports]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1711] text-sm text-[#9db2a3]">
        <RefreshCw className="mr-2 animate-spin" size={16} />
        Loading CivicMap...
      </main>
    );
  }

  const critical = reports.filter(
    (report) => report.priority.toLowerCase() === "critical"
  ).length;

  const active = reports.filter(
    (report) => !["resolved", "rejected"].includes(report.status)
  ).length;

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
                <MapPin size={23} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                  Geospatial management
                </p>
                <h1 className="mt-1 text-2xl font-semibold">
                  CivicMap Management
                </h1>
              </div>
            </div>

            <p className="mt-3 text-xs text-[#82998b]">
              Review mapped campus reports and inspect their locations.
            </p>
          </div>

          <button
            onClick={() => void loadReports()}
            disabled={fetching}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold hover:bg-white/[0.08] disabled:opacity-50"
          >
            <RefreshCw size={14} className={fetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "Mapped reports",
              value: reports.length,
              icon: ClipboardList,
            },
            {
              label: "Active reports",
              value: active,
              icon: Activity,
            },
            {
              label: "Critical reports",
              value: critical,
              icon: AlertCircle,
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

        {error && (
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-xs text-rose-200">
            {error}
          </div>
        )}

        {fetching && reports.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#12231a] p-12 text-center text-sm text-[#91a79a]">
            <RefreshCw className="mx-auto mb-3 animate-spin" size={20} />
            Loading mapped reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#12231a] p-12 text-center">
            <MapPin className="mx-auto mb-3 text-[#718b7b]" size={26} />
            <h2 className="text-sm font-semibold">No mapped reports</h2>
            <p className="mt-2 text-xs text-[#82998b]">
              Reports with valid coordinates will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <article
                key={report.id}
                className="rounded-2xl border border-white/[0.08] bg-[#12231a] p-5"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold text-emerald-300">
                        {humanize(report.priority)} priority
                      </span>
                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[10px] text-[#b5c7ba]">
                        {humanize(report.status)}
                      </span>
                    </div>

                    <h2 className="text-sm font-semibold">
                      {humanize(report.category)}
                    </h2>

                    <p className="mt-2 text-xs text-[#9db2a3]">
                      <MapPin size={13} className="mr-1 inline" />
                      {report.location}
                    </p>

                    <p className="mt-2 text-xs text-[#82998b]">
                      Department: {humanize(report.department)}
                    </p>

                    <p className="mt-2 break-all font-mono text-[10px] text-[#718b7b]">
                      {report.coordinates.lat}, {report.coordinates.lng}
                    </p>

                    <p className="mt-2 text-[10px] text-[#82998b]">
                      Submitted: {formatDate(report.createdAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-white/[0.05] px-3 py-2 text-[10px] text-[#b5c7ba]">
                      {report.voteCount} net votes
                    </span>

                    <a
                      href={`https://www.openstreetmap.org/?mlat=${report.coordinates.lat}&mlon=${report.coordinates.lng}#map=18/${report.coordinates.lat}/${report.coordinates.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-400/15"
                    >
                      Open location
                      <ArrowUpRight size={12} />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <footer className="border-t border-white/[0.07] pt-5 text-[10px] text-[#718b7b]">
          <ShieldCheck size={13} className="mr-2 inline text-emerald-400" />
          CivicSense AI · CivicMap administration
        </footer>
      </div>
    </main>
  );
}

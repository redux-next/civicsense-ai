
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Clock3,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Target,
  ThumbsUp,
} from "lucide-react";

import { auth } from "@/lib/firebase/client";

type CampusReport = {
  id: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  category: string;
  priority: string;
  department: string;
  status: string;
  location: string;
  voteCount: number;
  createdAt: string | null;
};

type MapFilter = "all" | "active" | "resolved";

const DEFAULT_CENTER: [number, number] = [27.47, 94.90];

function priorityColor(priority: string) {
  switch (priority.toLowerCase()) {
    case "critical":
      return "#dc2626";
    case "high":
      return "#ea580c";
    case "medium":
      return "#d69e23";
    case "low":
      return "#16a34a";
    default:
      return "#64748b";
  }
}

function formatDate(value: string | null) {
  if (!value) return "Recently reported";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently reported";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export default function CampusMapPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerLayerRef = useRef<import("leaflet").LayerGroup | null>(null);

  const [reports, setReports] = useState<CampusReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<MapFilter>("all");

  async function fetchReports(token: string, isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch("/api/civic-map", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load campus reports.");
      }

      setReports(data.reports ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading the map.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Wait for Firebase authentication before requesting map data.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        setError("Please sign in to view the campus map.");
        return;
      }

      const token = await user.getIdToken();
      await fetchReports(token);
    });

    return unsubscribe;
  }, []);

  // Initialize Leaflet only in the browser.
  useEffect(() => {
    let cancelled = false;
    let createdMap: import("leaflet").Map | null = null;

    async function initializeMap() {
      if (!mapContainerRef.current || mapRef.current) return;

      const L = await import("leaflet");

      if (cancelled || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView(DEFAULT_CENTER, 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const markerLayer = L.layerGroup().addTo(map);

      mapRef.current = map;
      markerLayerRef.current = markerLayer;
      createdMap = map;

      setMapReady(true);

      setTimeout(() => {
        if (!cancelled) map.invalidateSize();
      }, 150);
    }

    void initializeMap();

    return () => {
      cancelled = true;

      if (createdMap) {
        createdMap.remove();
      }

      mapRef.current = null;
      markerLayerRef.current = null;
      setMapReady(false);
    };
  }, []);

  const visibleReports = useMemo(() => {
    if (filter === "active") {
      return reports.filter(
        (report) =>
          report.status !== "resolved" &&
          report.status !== "rejected",
      );
    }

    if (filter === "resolved") {
      return reports.filter((report) => report.status === "resolved");
    }

    return reports;
  }, [reports, filter]);

  // Update map markers whenever reports or filters change.
  useEffect(() => {
    let cancelled = false;

    async function updateMarkers() {
      const L = await import("leaflet");

      if (cancelled || !mapRef.current || !markerLayerRef.current) {
        return;
      }

      const map = mapRef.current;
      const markerLayer = markerLayerRef.current;

      markerLayer.clearLayers();

      const bounds: [number, number][] = [];

      for (const report of visibleReports) {
        const { lat, lng } = report.coordinates;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const color = priorityColor(report.priority);

        const marker = L.circleMarker([lat, lng], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: color,
          fillOpacity: 1,
        });

        // Build popup with textContent to avoid injecting report text as HTML.
        const popup = document.createElement("div");
        popup.className = "civic-map-popup";

        const heading = document.createElement("strong");
        heading.textContent = report.category;
        heading.className = "civic-map-popup-title";

        const location = document.createElement("p");
        location.textContent = report.location;

        const priority = document.createElement("p");
        priority.textContent = `Priority: ${report.priority}`;

        const status = document.createElement("p");
        status.textContent = `Status: ${statusLabel(report.status)}`;

        const votes = document.createElement("p");
        votes.textContent = `Community votes: ${report.voteCount}`;

        popup.append(heading, location, priority, status, votes);

        marker.bindPopup(popup);
        marker.addTo(markerLayer);

        bounds.push([lat, lng]);
      }

      if (bounds.length === 1) {
        map.setView(bounds[0], 16);
      } else if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds), {
          padding: [40, 40],
          maxZoom: 16,
        });
      }
    }

    if (mapReady) {
      void updateMarkers();
    }

    return () => {
      cancelled = true;
    };
  }, [visibleReports, mapReady]);

  async function handleRefresh() {
    const user = auth.currentUser;

    if (!user) {
      setError("Please sign in again.");
      return;
    }

    const token = await user.getIdToken();
    await fetchReports(token, true);
  }

  const activeCount = reports.filter(
    (report) =>
      report.status !== "resolved" &&
      report.status !== "rejected",
  ).length;

  const resolvedCount = reports.filter(
    (report) => report.status === "resolved",
  ).length;

  const criticalCount = reports.filter(
    (report) => report.priority.toLowerCase() === "critical",
  ).length;

  return (
    <main className="min-h-screen bg-[#f4f7f1] text-[#1c3225]">
      <header className="sticky top-0 z-30 border-b border-[#e1e9dd] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
          <a
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-bold text-[#64806b] transition hover:text-[#1f5836]"
          >
            <ArrowLeft size={17} />
            <span className="hidden sm:inline">Back to dashboard</span>
            <span className="sm:hidden">Dashboard</span>
          </a>

          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f3e1] text-[#347347]">
              <ShieldCheck size={19} />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight text-[#23432f]">
                CivicSense<span className="text-[#65a74f]">.</span>
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#91a092]">
                CivicMap
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex h-10 items-center gap-2 rounded-xl border border-[#dce7d8] bg-white px-3 text-xs font-bold text-[#54745b] transition hover:bg-[#f1f7ed] disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
        <section className="mb-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d8e8d0] bg-[#eaf4e4] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#47794a]">
                <Target size={13} />
                Campus issue intelligence
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-[-0.055em] text-[#203d2a] sm:text-4xl lg:text-5xl">
                CivicMap<span className="text-[#69a955]">.</span>
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#78897c]">
                Explore reported campus issues, understand their urgency,
                and see where attention is needed most.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#dce8d8] bg-white px-3 py-2 text-[10px] font-semibold text-[#718575]">
              <span className="h-2 w-2 rounded-full bg-[#5eb56c]" />
              Authenticated campus view
            </div>
          </div>
        </section>

        {/* Statistics */}
        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <MapStat
            label="Mapped reports"
            value={reports.length}
            icon={<MapPin size={18} />}
          />
          <MapStat
            label="Active issues"
            value={activeCount}
            icon={<Activity size={18} />}
          />
          <MapStat
            label="Resolved"
            value={resolvedCount}
            icon={<ShieldCheck size={18} />}
          />
        </section>

        {criticalCount > 0 && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-xs font-bold">
              {criticalCount} critical-priority{" "}
              {criticalCount === 1 ? "issue needs" : "issues need"} attention.
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#294534]">
              Campus map
            </h2>
            <p className="mt-1 text-xs text-[#8a988d]">
              {visibleReports.length} mapped{" "}
              {visibleReports.length === 1 ? "issue" : "issues"}
            </p>
          </div>

          <div className="flex rounded-xl border border-[#e0e9dc] bg-white p-1">
            {(
              [
                ["all", "All"],
                ["active", "Active"],
                ["resolved", "Resolved"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-2 text-[10px] font-black transition ${
                  filter === value
                    ? "bg-[#1e5938] text-white"
                    : "text-[#829084] hover:bg-[#f2f6ef]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Map */}
        <section className="overflow-hidden rounded-[24px] border border-[#dce7d8] bg-white shadow-[0_15px_45px_-35px_rgba(30,70,40,0.35)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eee5] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 text-xs font-black text-[#3b5944]">
              <MapPin size={16} />
              Interactive issue map
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[9px] font-bold text-[#77877a]">
              <Legend color="#dc2626" label="Critical" />
              <Legend color="#ea580c" label="High" />
              <Legend color="#d69e23" label="Medium" />
              <Legend color="#16a34a" label="Low" />
            </div>
          </div>

          <div className="relative">
            <div
              ref={mapContainerRef}
              className="civic-map-container h-[430px] w-full sm:h-[540px] lg:h-[620px]"
              aria-label="Interactive map showing reported campus issues"
            />

            {(loading || !mapReady) && (
              <div className="absolute inset-0 z-[500] flex items-center justify-center bg-[#f4f7f1]/90">
                <div className="flex items-center gap-3 rounded-xl border border-[#dfe9dc] bg-white px-4 py-3 text-xs font-bold text-[#64806b] shadow-sm">
                  <RefreshCw size={16} className="animate-spin" />
                  Preparing CivicMap...
                </div>
              </div>
            )}

            {!loading && mapReady && visibleReports.length === 0 && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 z-[400] w-[calc(100%-32px)] max-w-sm -translate-x-1/2 rounded-xl border border-[#dce8d8] bg-white/95 p-3 text-center shadow-lg backdrop-blur">
                <p className="text-xs font-black text-[#365740]">
                  No mapped reports in this filter
                </p>
                <p className="mt-1 text-[10px] text-[#829084]">
                  Reports need GPS coordinates to appear on CivicMap.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Report list */}
        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#769477]">
                Explore reports
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-[#294534]">
                Mapped issues
              </h2>
            </div>
            <span className="text-[10px] font-semibold text-[#8b998e]">
              Newest first
            </span>
          </div>

          {visibleReports.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#d6e3d2] bg-white p-10 text-center">
              <MapPin size={25} className="mx-auto text-[#83a17e]" />
              <p className="mt-3 text-sm font-black text-[#3c5944]">
                No geolocated issues yet
              </p>
              <p className="mt-2 text-xs leading-5 text-[#87958a]">
                Submit a report using the GPS location button to add it to
                CivicMap.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleReports.map((report) => (
                <article
                  key={report.id}
                  className="rounded-2xl border border-[#e1e9dd] bg-white p-4 transition hover:border-[#c5d9bd]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor: priorityColor(report.priority),
                        }}
                      />
                      <h3 className="truncate text-sm font-black capitalize text-[#34513c]">
                        {report.category}
                      </h3>
                    </div>

                    <span className="shrink-0 rounded-full bg-[#f1f5ef] px-2 py-1 text-[9px] font-bold capitalize text-[#708171]">
                      {statusLabel(report.status)}
                    </span>
                  </div>

                  <p className="mt-3 flex items-center gap-2 text-xs text-[#829084]">
                    <MapPin size={13} />
                    <span className="truncate">{report.location}</span>
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf1eb] pt-3">
                    <span
                      className="text-[10px] font-black capitalize"
                      style={{ color: priorityColor(report.priority) }}
                    >
                      {report.priority} priority
                    </span>

                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#829084]">
                      <ThumbsUp size={12} />
                      {report.voteCount} votes
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[10px] text-[#9aa59b]">
                    <span className="truncate">
                      {report.department}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Clock3 size={11} />
                      {formatDate(report.createdAt)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 flex flex-col gap-2 border-t border-[#e0e9dc] py-6 text-center text-[10px] text-[#93a093] sm:flex-row sm:justify-between sm:text-left">
          <span>CivicSense AI · CivicMap</span>
          <span>
            Map data © OpenStreetMap contributors
          </span>
        </footer>
      </div>
    </main>
  );
}

function MapStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#e1e9dd] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-[#839185] sm:text-xs">
          {label}
        </p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf5e8] text-[#4e8051]">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-3xl font-black tracking-tight text-[#294534]">
        {value}
      </p>
    </div>
  );
}

function Legend({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

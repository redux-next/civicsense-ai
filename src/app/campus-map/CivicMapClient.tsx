
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Layers,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
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

type LeafletMap = import("leaflet").Map;
type LeafletLayerGroup = import("leaflet").LayerGroup;

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) =>
    c.toUpperCase()
  );
}

function markerColor(priority: string) {
  switch (priority.toLowerCase()) {
    case "critical":
      return "#ef4444";
    case "high":
      return "#f97316";
    case "medium":
      return "#eab308";
    default:
      return "#10b981";
  }
}

function formatDate(value: string | null) {
  if (!value) return "Unavailable";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString();
}

export default function CivicMapClient() {
  const { user, loading } = useAuth();

  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const markerLayer = useRef<LeafletLayerGroup | null>(null);
  // const initialized = useRef(false);

  const [reports, setReports] = useState<MapReport[]>([]);
  const [selectedReport, setSelectedReport] =
    useState<MapReport | null>(null);
  const [fetching, setFetching] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState<string | null>(null);

  // Fetch authenticated reports.
  const loadReports = useCallback(async () => {
    if (!user) return;

    setFetching(true);
    setError("");

    try {
      const token = await user.getIdToken(true);

      const response = await fetch("/api/civic-map", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to load campus reports."
        );
      }

      setReports(
        Array.isArray(data.reports) ? data.reports : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load campus reports."
      );
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && user) {
      void loadReports();
    }
  }, [loading, user, loadReports]);

  // Initialize Leaflet once the browser has mounted the component.
useEffect(() => {
  let cancelled = false;
  let localMap: import("leaflet").Map | null = null;

  async function initializeMap() {
    try {
      setMapReady(false);
      setMapError(null);

      const leafletModule = await import("leaflet");

      if (cancelled || !mapElement.current) return;

      const L = leafletModule.default;

      // Prevent duplicate maps during React Strict Mode remounts.
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }

      const map = L.map(mapElement.current, {
        center: [27.4788, 95.1813],
        zoom: 15,
        zoomControl: true,
        preferCanvas: true,
      });

      localMap = map;
      mapInstance.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      markerLayer.current = L.layerGroup().addTo(map);

      // The map exists now. Do not wait for map tiles to load.
      if (!cancelled) {
        setMapReady(true);

        requestAnimationFrame(() => {
          if (!cancelled) {
            map.invalidateSize();
          }
        });
      }
    } catch (error) {
      console.error("Leaflet initialization failed:", error);

      if (!cancelled) {
        setMapError(
          error instanceof Error
            ? error.message
            : "Unable to initialize the interactive map."
        );
      }
    }
  }

  void initializeMap();

  return () => {
    cancelled = true;

    if (localMap) {
      localMap.remove();

      if (mapInstance.current === localMap) {
        mapInstance.current = null;
        markerLayer.current = null;
      }
    }
  };
}, []);

  // Render markers after both the map and reports are available.
  useEffect(() => {
    let cancelled = false;

    async function renderMarkers() {
      if (!mapReady || !mapInstance.current || !markerLayer.current) {
        return;
      }

      try {
        const L = await import("leaflet");

        if (
          cancelled ||
          !mapInstance.current ||
          !markerLayer.current
        ) {
          return;
        }

        const layer = markerLayer.current;
        const map = mapInstance.current;

        layer.clearLayers();

        const validReports = reports.filter((report) => {
          const { lat, lng } = report.coordinates || {};

          return (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180
          );
        });

        const bounds: [number, number][] = [];

        validReports.forEach((report) => {
          const { lat, lng } = report.coordinates;
          const color = markerColor(report.priority);

          const icon = L.divIcon({
            className: "civic-map-marker-wrapper",
            html: `
              <div style="
                width: 22px;
                height: 22px;
                background: ${color};
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 12px rgba(0,0,0,.55);
              "></div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });

          const marker = L.marker([lat, lng], { icon });

          marker.bindPopup(`
            <div style="min-width:150px">
              <strong>${humanize(report.category)}</strong>
              <br/>
              <span>${humanize(report.priority)} priority</span>
              <br/>
              <span>${humanize(report.status)}</span>
            </div>
          `);

          marker.on("click", () => {
            setSelectedReport(report);
          });

          marker.addTo(layer);
          bounds.push([lat, lng]);
        });

        if (bounds.length === 1) {
          map.setView(bounds[0], 16);
        } else if (bounds.length > 1) {
          map.fitBounds(bounds, {
            padding: [60, 60],
            maxZoom: 17,
          });
        } else {
          map.setView([27.4788, 95.1813], 15);
        }

        requestAnimationFrame(() => {
          map.invalidateSize();
        });
      } catch (err) {
        console.error("CivicMap: marker rendering failed", err);
        setMapError("Unable to display campus complaint markers.");
      }
    }

    void renderMarkers();

    return () => {
      cancelled = true;
    };
  }, [reports, mapReady]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1711] text-sm text-[#9db2a3]">
        <RefreshCw className="mr-2 animate-spin" size={16} />
        Verifying administrator access...
      </main>
    );
  }

  const critical = reports.filter(
    (report) => report.priority.toLowerCase() === "critical"
  ).length;

  const active = reports.filter(
    (report) =>
      !["resolved", "rejected"].includes(report.status)
  ).length;

  return (
    <main className="min-h-screen bg-[#0b1711] px-4 py-6 text-[#e8f1eb] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-6">

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/admin/analytics"
              className="mb-4 inline-flex items-center gap-2 text-xs text-[#91a79a] hover:text-emerald-300"
            >
              <ArrowLeft size={14} />
              Back to Campus Intelligence
            </Link>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300">
                <MapPin size={23} />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                  Geographic intelligence
                </p>
                <h1 className="mt-1 text-2xl font-semibold">
                  Campus Civic Map
                </h1>
              </div>
            </div>

            <p className="mt-3 text-xs text-[#82998b]">
              Explore campus complaints through an interactive geographic view.
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
            Refresh reports
          </button>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Mapped reports", value: reports.length, icon: MapPin },
            { label: "Active reports", value: active, icon: Activity },
            { label: "Critical reports", value: critical, icon: AlertCircle },
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
        </section>

        {error && (
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-xs text-rose-200">
            {error}
          </div>
        )}

        {mapError && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-xs text-amber-200">
            {mapError}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#12231a]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-emerald-300" />
              <h2 className="text-sm font-semibold">All campus issues</h2>
            </div>

            <div className="flex flex-wrap gap-3 text-[10px] text-[#b5c7ba]">
              {[
                ["Critical", "#ef4444"],
                ["High", "#f97316"],
                ["Medium", "#eab308"],
                ["Normal", "#10b981"],
              ].map(([label, color]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative bg-[#182a20]">
            <div
              ref={mapElement}
              className="civic-map-container relative z-0 w-full"
              style={{
                height: "620px",
                minHeight: "480px",
                width: "100%",
                background: "#dbe5df",
              }}
            />

            {!mapReady && (
              <div className="absolute inset-0 z-[500] flex items-center justify-center bg-[#0b1711]/90 text-xs text-[#b5c7ba]">
                <RefreshCw size={16} className="mr-2 animate-spin" />
                Initializing interactive map...
              </div>
            )}

            {fetching && (
              <div className="absolute left-3 top-3 z-[600] flex items-center gap-2 rounded-lg bg-[#0b1711]/90 px-3 py-2 text-xs text-white">
                <RefreshCw size={13} className="animate-spin" />
                Updating reports...
              </div>
            )}

            {reports.length === 0 && !fetching && mapReady && (
              <div className="absolute bottom-4 left-4 z-[500] rounded-xl border border-white/10 bg-[#12231a] p-4 text-xs text-white">
                No reports with coordinates are available.
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.08] px-5 py-3 text-[10px] text-[#82998b]">
            Select a marker to inspect its complaint details. Data is limited to the latest 300 records returned by the API.
          </div>
        </section>

        {selectedReport && (
          <section className="rounded-2xl border border-emerald-400/20 bg-[#12231a] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Selected complaint
                </p>

                <h2 className="mt-2 text-lg font-semibold">
                  {humanize(selectedReport.category)}
                </h2>

                <p className="mt-1 text-xs text-[#9db2a3]">
                  {selectedReport.location}
                </p>
              </div>

              <button
                onClick={() => setSelectedReport(null)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#b5c7ba] hover:bg-white/5"
              >
                Close details
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Priority", humanize(selectedReport.priority)],
                ["Status", humanize(selectedReport.status)],
                ["Department", humanize(selectedReport.department)],
                ["Community votes", String(selectedReport.voteCount)],
                ["Latitude", selectedReport.coordinates.lat.toFixed(5)],
                ["Longitude", selectedReport.coordinates.lng.toFixed(5)],
                ["Submitted", formatDate(selectedReport.createdAt)],
                ["Report ID", selectedReport.id],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl bg-white/[0.04] p-3"
                >
                  <p className="text-[10px] text-[#82998b]">{label}</p>
                  <p className="mt-1 break-words text-xs font-medium text-white">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="border-t border-white/[0.07] pt-5 text-[10px] text-[#718b7b]">
          <ShieldCheck
            size={13}
            className="mr-2 inline text-emerald-400"
          />
          CivicSense AI · Administrator-only campus intelligence
        </footer>
      </div>
    </main>
  );
}

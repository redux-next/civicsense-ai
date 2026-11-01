
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/auth-provider";
import ImageUpload, {
  type UploadedImage,
} from "@/components/complaints/image-upload";
import ThemeToggle from "@/components/ui/theme-toggle";
import type {
  Complaint,
  ComplaintLanguage,
  ComplaintStatus,
} from "@/types/complaint";

/* --------------------------------
   Types and configuration
--------------------------------- */

type ComplaintAnalysis = {
  detectedLanguage: "en" | "as" | "other";
  translatedTitle: string;
  summaryEnglish: string;
  summaryAssamese: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  priorityReason: string;
  recommendedDepartment: string;
  locationDetected: string;
  imageFindings: string;
  recommendedAction: string;
  confidence: number;
};

type ComplaintCoordinates = {
  lat: number;
  lng: number;
};

const statusLabels: Record<ComplaintStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

const statusStyles: Record<ComplaintStatus, string> = {
  submitted: "bg-sky-50 text-sky-700 ring-sky-200",
  under_review: "bg-amber-50 text-amber-700 ring-amber-200",
  in_progress: "bg-violet-50 text-violet-700 ring-violet-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
};

const priorityStyles: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-sky-50 text-sky-700",
  high: "bg-amber-50 text-amber-700",
  critical: "bg-rose-50 text-rose-700",
};

function getComplaintAnalysis(value: unknown): ComplaintAnalysis | null {
  if (!value || typeof value !== "object") return null;
  return value as ComplaintAnalysis;
}

function formatDate(value: string | null) {
  if (!value) return "Recently submitted";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently submitted";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* --------------------------------
   Main dashboard
--------------------------------- */

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [language, setLanguage] = useState<ComplaintLanguage>("en");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const [coordinates, setCoordinates] =
    useState<ComplaintCoordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  const [image, setImage] = useState<UploadedImage | null>(null);

  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisErrorId, setAnalysisErrorId] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState("overview");

  const fetchComplaints = useCallback(async () => {
    if (!auth.currentUser) {
      setFetching(false);
      return;
    }

    setFetching(true);

    try {
      const token = await auth.currentUser.getIdToken();

      const response = await fetch("/api/complaints", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load your reports.");
      }

      setComplaints(data.complaints ?? []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (user) {
      void fetchComplaints();
    }
  }, [user, loading, router, fetchComplaints]);

  function navigateTo(section: string) {
    setActiveSection(section);

    document.getElementById(section)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function navigateToPage(path: string) {
    router.push(path);
  }

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  function handleGetLocation() {
    setLocationMessage("");

    if (!navigator.geolocation) {
      setLocationMessage(
        "Your browser does not support location services.",
      );
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        setLocationMessage(
          "Your location has been attached successfully.",
        );
        setLocating(false);
      },
      (geoError) => {
        let message = "Unable to get your location.";

        if (geoError.code === geoError.PERMISSION_DENIED) {
          message =
            "Location permission denied. Please allow location access in your browser.";
        } else if (
          geoError.code === geoError.POSITION_UNAVAILABLE
        ) {
          message = "Your current location is unavailable.";
        } else if (geoError.code === geoError.TIMEOUT) {
          message = "Location request timed out. Please try again.";
        }

        setLocationMessage(message);
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }

  function removeCoordinates() {
    setCoordinates(null);
    setLocationMessage("Location coordinates removed.");
  }

  async function handleAnalyze(complaintId: string) {
    setAnalysisError("");
    setAnalysisErrorId(null);
    setAnalyzingId(complaintId);

    try {
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ complaintId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI analysis failed.");
      }

      setComplaints((current) =>
        current.map((item) =>
          item.id === complaintId
            ? {
              ...item,
              aiAnalysis: data.analysis,
              category: data.analysis.category,
              priority: data.analysis.priority,
              department: data.analysis.recommendedDepartment,
            }
            : item,
        ),
      );
    } catch (err) {
      setAnalysisError(
        err instanceof Error
          ? err.message
          : "Something went wrong during AI analysis.",
      );
      setAnalysisErrorId(complaintId);
    } finally {
      setAnalyzingId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (title.trim().length < 5) {
      setError("Your issue title must contain at least 5 characters.");
      return;
    }

    if (description.trim().length < 10) {
      setError("Please describe the issue in at least 10 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          language,
          location: location.trim(),
          coordinates,
          image,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Complaint submission failed.");
      }

      setTitle("");
      setDescription("");
      setLocation("");
      setCoordinates(null);
      setLocationMessage("");
      setImage(null);

      setSuccess(
        `Your report has been submitted. Reference: ${data.complaintId}`,
      );

      await fetchComplaints();
      setActiveSection("my-reports");

      setTimeout(() => {
        document.getElementById("my-reports")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7f2]">
        <div className="flex items-center gap-3 text-sm font-medium text-[#617368]">
          <RefreshCw className="animate-spin text-[#39865b]" size={19} />
          Preparing your campus dashboard...
        </div>
      </main>
    );
  }

  const total = complaints.length;

  const active = complaints.filter((item) =>
    ["submitted", "under_review", "in_progress"].includes(item.status),
  ).length;

  const resolved = complaints.filter(
    (item) => item.status === "resolved",
  ).length;

  const firstName = (user.displayName || "Student")
    .trim()
    .split(/\s+/)[0];

  const displayName = user.displayName || "Student";

  const initials = displayName
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="min-h-screen bg-[#f4f6f1] text-[#192b20]">
      <div className="min-h-screen lg:flex">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[258px] flex-col bg-[#102d22] text-white lg:flex">
          <BrandHeader />

          <div className="px-5 pt-8">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#769383]">
              Workspace
            </p>

            <div className="space-y-1">
              <SidebarLink
                active={activeSection === "overview"}
                icon={<LayoutDashboard size={18} />}
                onClick={() => navigateTo("overview")}
              >
                Overview
              </SidebarLink>

              <SidebarLink
                active={activeSection === "report"}
                icon={<Plus size={19} />}
                onClick={() => navigateTo("report")}
              >
                Submit a report
              </SidebarLink>

              <SidebarLink
                active={activeSection === "my-reports"}
                icon={<FileText size={18} />}
                onClick={() => navigateTo("my-reports")}
              >
                My reports
                {total > 0 && (
                  <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-[#c6d9cb]">
                    {total}
                  </span>
                )}
              </SidebarLink>
            </div>

<p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#769383]">
  Community
</p>

            <div className="space-y-1">
              {/* <SidebarLink
                active={false}
                icon={<Map size={18} />}
                onClick={() => navigateToPage("/campus-map")}
              >
                CivicMap
                <ArrowUpRight size={14} className="ml-auto opacity-60" />
              </SidebarLink> */}

              <SidebarLink
                active={false}
                icon={<Users size={18} />}
                onClick={() => navigateToPage("/community")}
              >
                Community voting
                <ArrowUpRight size={14} className="ml-auto opacity-60" />
              </SidebarLink>
            </div>
          </div>

          <div className="mx-5 mt-8 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-center gap-2 text-[#b5f184]">
              <Sparkles size={15} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Powered by AI
              </span>
            </div>

            <p className="mt-3 text-sm font-bold leading-6 text-white">
              Every voice can make a difference.
            </p>

            <p className="mt-2 text-xs leading-5 text-[#9bb3a4]">
              Report campus issues in English or Assamese and follow their
              progress.
            </p>

            <button
              onClick={() => navigateTo("report")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#a9f16c] px-3 py-2.5 text-xs font-black text-[#173522] transition hover:bg-[#c0ff89]"
            >
              <Plus size={15} />
              Create report
            </button>
          </div>

          <div className="mt-auto border-t border-white/10 p-5">
            <UserAccount
              initials={initials}
              displayName={displayName}
              onLogout={handleLogout}
            />
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0 flex-1 lg:ml-[258px]">
          <header className="sticky top-0 z-30 border-b border-[#e4e9e1] bg-[#f8faf6]/95 backdrop-blur-xl">
            <div className="flex h-[70px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e5f0df] text-[#326a45] lg:hidden">
                  <ShieldCheck size={20} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#718076]">
                    Student workspace
                  </p>
                  <p className="truncate text-sm font-black text-[#20392b]">
                    {activeSection === "report"
                      ? "Create a report"
                      : activeSection === "my-reports"
                        ? "Your reports"
                        : "Dashboard overview"}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <div className="hidden items-center gap-2 rounded-full border border-[#e2e9df] bg-white px-3 py-2 text-[11px] font-semibold text-[#617568] sm:flex">
                  <span className="h-2 w-2 rounded-full bg-[#62b77a]" />
                  Campus reporting active
                </div>

                <ThemeToggle className="h-9 w-9" />

                <button
                  onClick={handleLogout}
                  className="flex h-9 items-center gap-2 rounded-xl border border-[#e1e8df] bg-white px-3 text-xs font-bold text-[#53675a] transition hover:bg-[#edf3ea] lg:hidden"
                >
                  <LogOut size={15} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>

                <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-[#173f2e] text-xs font-black text-[#c4f49b] lg:flex">
                  {initials || "S"}
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1480px] px-4 pb-28 pt-6 sm:px-7 sm:pt-8 lg:px-10 lg:pb-10">
            {/* Overview */}
            <section id="overview" className="scroll-mt-24">
              <div className="relative overflow-hidden rounded-[28px] bg-[#173f2e] p-6 text-white sm:p-9 lg:p-11">
                <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full border-[55px] border-white/[0.045]" />
                <div className="pointer-events-none absolute -bottom-36 right-[25%] h-72 w-72 rounded-full bg-[#8ce35d]/15 blur-3xl" />

                <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#a9f16c]/25 bg-[#a9f16c]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.17em] text-[#c4f49b]">
                      <Sparkles size={13} />
                      Your campus. Your voice.
                    </div>

                    <h1 className="mt-5 max-w-xl text-4xl font-black leading-[1.04] tracking-[-0.055em] sm:text-5xl lg:text-[3.65rem]">
                      Make your
                      <span className="block text-[#a9f16c]">
                        campus better.
                      </span>
                    </h1>

                    <p className="mt-5 max-w-lg text-sm leading-7 text-[#c8d9ce] sm:text-base">
                      Welcome back, {firstName}. Have something that needs
                      attention? Speak up, submit a report, and stay updated
                      until it is resolved.
                    </p>

                    <div className="mt-7 flex flex-wrap gap-3">
                      <button
                        onClick={() => navigateTo("report")}
                        className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#a9f16c] px-5 text-sm font-black text-[#173522] transition hover:-translate-y-0.5 hover:bg-[#c3ff91]"
                      >
                        <Plus size={18} />
                        Report an issue
                        <ArrowUpRight size={16} />
                      </button>

                      <button
                        onClick={() => navigateTo("my-reports")}
                        className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-5 text-sm font-bold text-white transition hover:bg-white/10"
                      >
                        <FileText size={16} />
                        Track my reports
                      </button>
                    </div>
                  </div>

                  <div className="hidden min-w-[190px] border-l border-white/15 pl-7 lg:block">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9ab7a5]">
                      Your contribution
                    </p>
                    <p className="mt-3 text-5xl font-black tracking-tight text-[#a9f16c]">
                      {total}
                    </p>
                    <p className="mt-1 text-xs text-[#c8d9ce]">
                      Reports submitted
                    </p>
                    <div className="mt-5 flex items-center gap-2 text-[11px] font-semibold text-[#b8e6a0]">
                      <Activity size={14} />
                      Every report matters
                    </div>
                  </div>
                </div>

                <div className="relative mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/15 pt-5 text-xs font-medium text-[#c5d8ca]">
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[#a9f16c]" />
                    AI-assisted insights
                  </span>
                  <span className="flex items-center gap-2">
                    <BadgeCheck size={14} className="text-[#a9f16c]" />
                    Human-reviewed resolution
                  </span>
                  <span>অসমীয়া / English</span>
                </div>
              </div>


              {/* Statistics */}
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#719078]">
                    Your activity
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-[#20392b]">
                    At a glance<span className="text-[#5d9b51]">.</span>
                  </h2>
                </div>
                <p className="text-xs text-[#87948a]">
                  Your personal reporting overview
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatCard
                  label="Total reports"
                  value={total}
                  note="Your submitted issues"
                  icon={<FileText size={20} />}
                  tone="green"
                />
                <StatCard
                  label="In progress"
                  value={active}
                  note="Currently being addressed"
                  icon={<Clock3 size={20} />}
                  tone="amber"
                />
                <StatCard
                  label="Resolved"
                  value={resolved}
                  note="Marked as complete"
                  icon={<CheckCircle2 size={20} />}
                  tone="blue"
                />
              </div>
            </section>

            {/* Reporting and reports */}
            <div className="mt-10 grid min-w-0 items-start gap-7 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              {/* New report */}
              <section id="report" className="min-w-0 scroll-mt-24">
                <SectionTitle
                  eyebrow="Take action"
                  title="Raise your voice."
                  description="Give us the details. We'll help get your issue to the right people."
                  number="01"
                />

                <div className="mt-5 overflow-hidden rounded-[24px] border border-[#e3e9df] bg-white shadow-[0_12px_40px_-30px_rgba(26,58,37,0.25)]">
                  <div className="flex items-center justify-between gap-3 border-b border-[#edf1eb] px-5 py-4 sm:px-6">
                    <div>
                      <p className="text-sm font-black text-[#294534]">
                        New campus report
                      </p>
                      <p className="mt-1 text-xs text-[#89968b]">
                        Fields marked * are required.
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf4e4] text-[#43814d]">
                      <MessageSquareText size={19} />
                    </div>
                  </div>

                  <form
                    onSubmit={handleSubmit}
                    className="space-y-5 p-5 sm:p-6"
                  >
                    <div>
                      <FieldLabel
                        label="Report language"
                        helper="ভাষা বাছনি কৰক"
                      />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <LanguageButton
                          active={language === "en"}
                          onClick={() => setLanguage("en")}
                        >
                          English
                        </LanguageButton>
                        <LanguageButton
                          active={language === "as"}
                          onClick={() => setLanguage("as")}
                        >
                          অসমীয়া
                        </LanguageButton>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <FieldLabel label="Issue title" required />
                        <span className="text-[10px] font-semibold text-[#96a198]">
                          {title.length}/120
                        </span>
                      </div>

                      <input
                        id="complaint-title"
                        required
                        minLength={5}
                        maxLength={120}
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder={
                          language === "as"
                            ? "সমস্যাটোৰ শিৰোনাম লিখক"
                            : "e.g. Broken lights in the library"
                        }
                        className="form-input"
                      />
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <FieldLabel label="What happened?" required />
                        <span className="text-[10px] font-semibold text-[#96a198]">
                          {description.length}/3000
                        </span>
                      </div>

                      <textarea
                        id="complaint-description"
                        required
                        minLength={10}
                        maxLength={3000}
                        rows={5}
                        value={description}
                        onChange={(event) =>
                          setDescription(event.target.value)
                        }
                        placeholder={
                          language === "as"
                            ? "কি ঘটিছে, ক'ত ঘটিছে আৰু ইয়াৰ প্ৰভাৱ কি — বৰ্ণনা কৰক..."
                            : "Describe the issue, where it happened, and how it affects students..."
                        }
                        className="form-input min-h-36 resize-y leading-6"
                      />
                    </div>

                    <div>
                      <FieldLabel
                        label="Where is it happening?"
                        helper="Optional"
                      />
                      <div className="relative mt-2">
                        <MapPin
                          size={17}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#79927d]"
                        />
                        <input
                          id="complaint-location"
                          maxLength={200}
                          value={location}
                          onChange={(event) =>
                            setLocation(event.target.value)
                          }
                          placeholder={
                            language === "as"
                              ? "যেনে: পুথিভঁৰাল, ছাত্ৰাবাস..."
                              : "Library, hostel block, science building..."
                          }
                          className="form-input pl-10"
                        />
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleGetLocation}
                          disabled={locating || submitting}
                          className="flex min-h-10 items-center gap-2 rounded-xl border border-[#cfe1c8] bg-[#f0f7ec] px-4 py-2.5 text-xs font-black text-[#397347] transition hover:bg-[#e5f2dd] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {locating ? (
                            <RefreshCw size={15} className="animate-spin" />
                          ) : (
                            <MapPin size={15} />
                          )}

                          {locating
                            ? "Getting location..."
                            : coordinates
                              ? "Update my location"
                              : "Use my current location"}
                        </button>

                        {coordinates && (
                          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                                <CheckCircle2 size={16} />
                                Location attached
                              </div>

                              <button
                                type="button"
                                onClick={removeCoordinates}
                                disabled={submitting}
                                className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700"
                              >
                                <X size={14} />
                                Remove
                              </button>
                            </div>

                            <p className="mt-2 break-all text-[10px] text-emerald-700">
                              Latitude: {coordinates.lat.toFixed(6)}
                              {" · "}
                              Longitude: {coordinates.lng.toFixed(6)}
                            </p>
                          </div>
                        )}

                        {locationMessage && (
                          <p
                            role="status"
                            className={`mt-2 text-xs ${coordinates
                                ? "text-emerald-700"
                                : "text-[#829087]"
                              }`}
                          >
                            {locationMessage}
                          </p>
                        )}

                        <p className="mt-2 text-[10px] leading-5 text-[#98a399]">
                          GPS is optional. Attaching your location helps
                          administrators identify where the issue occurred.
                        </p>
                      </div>
                    </div>

                    <div>
                      <FieldLabel
                        label="Attach a photo"
                        helper="Optional"
                      />
                      <div className="mt-2 rounded-2xl border border-dashed border-[#d6e2d2] bg-[#f8faf6] p-4">
                        <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#607867]">
                          <ImageIcon size={16} />
                          Add visual evidence
                        </div>
                        <ImageUpload
                          image={image}
                          onImageChange={setImage}
                        />
                      </div>
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
                      >
                        <AlertCircle size={17} className="mt-0.5 shrink-0" />
                        <span className="break-words">{error}</span>
                      </div>
                    )}

                    {success && (
                      <div
                        role="status"
                        className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                      >
                        <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                        <span className="break-words">{success}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || locating}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1e5b38] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#16472c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#65a85c]/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? (
                        <RefreshCw size={17} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                      {submitting ? "Submitting report..." : "Submit report"}
                      {!submitting && <ArrowUpRight size={16} />}
                    </button>

                    <p className="text-center text-[10px] leading-5 text-[#98a399]">
                      AI suggestions are advisory. University staff review
                      reports and approve actions.
                    </p>
                  </form>
                </div>
              </section>

              {/* My reports */}
              <section id="my-reports" className="min-w-0 scroll-mt-24">
                <SectionTitle
                  eyebrow="Stay informed"
                  title="Your reports."
                  description="Follow the progress of every issue you've raised."
                  number="02"
                />

                <div className="mt-5 overflow-hidden rounded-[24px] border border-[#e3e9df] bg-white shadow-[0_12px_40px_-30px_rgba(26,58,37,0.25)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1eb] px-5 py-4 sm:px-6">
                    <div>
                      <p className="text-sm font-black text-[#294534]">
                        Report activity
                      </p>
                      <p className="mt-1 text-xs text-[#89968b]">
                        {total} {total === 1 ? "report" : "reports"} in your
                        account
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void fetchComplaints()}
                      disabled={fetching}
                      aria-label="Refresh reports"
                      className="flex h-10 items-center gap-2 rounded-xl border border-[#e2e9df] px-3 text-xs font-bold text-[#587362] transition hover:bg-[#f4f8f1] disabled:opacity-50"
                    >
                      <RefreshCw
                        size={15}
                        className={fetching ? "animate-spin" : ""}
                      />
                      Refresh
                    </button>
                  </div>

                  <div className="p-4 sm:p-5">
                    {fetching ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <RefreshCw
                          size={25}
                          className="animate-spin text-[#5f9673]"
                        />
                        <p className="mt-3 text-sm font-semibold text-[#75877a]">
                          Loading your reports...
                        </p>
                      </div>
                    ) : complaints.length === 0 ? (
                      <EmptyReports onCreate={() => navigateTo("report")} />
                    ) : (
                      <div className="space-y-3">
                        {complaints.map((complaint) => (
                          <ComplaintCard
                            key={complaint.id}
                            complaint={complaint}
                            analyzing={analyzingId === complaint.id}
                            analysisError={
                              analysisErrorId === complaint.id
                                ? analysisError
                                : ""
                            }
                            onAnalyze={() =>
                              void handleAnalyze(complaint.id)
                            }
                          />
                        ))}
                      </div>
                    )}

                    {!fetching && complaints.length > 0 && (
                      <p className="mt-5 text-center text-[10px] text-[#99a39a]">
                        All reports shown belong to your account.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <footer className="mt-12 flex flex-col justify-between gap-3 border-t border-[#e1e8dc] py-6 text-center text-[11px] text-[#8d9a8f] sm:flex-row sm:text-left">
              <p>
                CivicSense AI <span className="mx-1">·</span> Campus, heard.
              </p>
              <p className="flex items-center justify-center gap-2">
                <ShieldCheck size={14} />
                Built for a safer, better-connected campus.
              </p>
            </footer>
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e0e8dc] bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-1">
          <MobileNavItem
            active={activeSection === "overview"}
            icon={<LayoutDashboard size={18} />}
            label="Overview"
            onClick={() => navigateTo("overview")}
          />

          <MobileNavItem
            active={activeSection === "report"}
            icon={<Plus size={19} />}
            label="Report"
            onClick={() => navigateTo("report")}
          />

          <MobileNavItem
            active={activeSection === "my-reports"}
            icon={<FileText size={18} />}
            label="My reports"
            onClick={() => navigateTo("my-reports")}
          />

          <MobileNavItem
            active={false}
            icon={<Users size={18} />}
            label="Community"
            onClick={() => navigateToPage("/community")}
          />
        </div>
      </nav>
    </main>
  );
}

/* --------------------------------
   Reusable layout components
--------------------------------- */

function BrandHeader() {
  return (
    <div className="flex h-[88px] items-center gap-3 border-b border-white/10 px-7">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#a9f16c] text-[#143522]">
        <ShieldCheck size={23} strokeWidth={2.4} />
      </div>
      <div>
        <p className="text-[19px] font-black tracking-tight">
          CivicSense<span className="text-[#a9f16c]">.</span>
        </p>
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#9bb3a4]">
          Campus intelligence
        </p>
      </div>
    </div>
  );
}

function UserAccount({
  initials,
  displayName,
  onLogout,
}: {
  initials: string;
  displayName: string;
  onLogout: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#315c43] text-xs font-black text-[#c7f3a4]">
        {initials || "S"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-white">
          {displayName}
        </p>
        <p className="truncate text-[10px] text-[#91aa9a]">
          Student account
        </p>
      </div>
      <button
        onClick={onLogout}
        aria-label="Sign out"
        title="Sign out"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#9bb3a4] transition hover:bg-white/10 hover:text-white"
      >
        <LogOut size={17} />
      </button>
    </div>
  );
}

function SidebarLink({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-xs font-bold transition ${active
          ? "bg-[#a9f16c] text-[#173522] shadow-lg shadow-black/10"
          : "text-[#a9bdb0] hover:bg-white/[0.07] hover:text-white"
        }`}
    >
      {icon}
      {children}
    </button>
  );
}

function MobileNavItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold transition ${active
          ? "bg-[#eaf4e4] text-[#28643d]"
          : "text-[#809083] hover:bg-[#f4f7f2]"
        }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function FeatureCard({
  icon,
  eyebrow,
  title,
  description,
  action,
  onClick,
  tone,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
  tone: "green" | "blue";
}) {
  const styles = {
    green: {
      icon: "bg-[#eaf4e4] text-[#3f814c]",
      button: "text-[#397347]",
    },
    blue: {
      icon: "bg-[#eaf1f8] text-[#527a9b]",
      button: "text-[#426e91]",
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-start gap-4 rounded-2xl border border-[#e2e9de] bg-white p-5 text-left shadow-[0_8px_30px_-26px_rgba(26,58,37,0.35)] transition hover:-translate-y-0.5 hover:border-[#c9ddc2] hover:shadow-md"
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles[tone].icon}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8b9a8d]">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-base font-black text-[#294534]">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-5 text-[#849187]">
          {description}
        </p>
        <span
          className={`mt-3 inline-flex items-center gap-1 text-[11px] font-black ${styles[tone].button}`}
        >
          {action}
          <ArrowUpRight
            size={14}
            className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </span>
      </div>
    </button>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  number,
}: {
  eyebrow: string;
  title: string;
  description: string;
  number: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#dfe9da] bg-[#eaf3e4] text-sm font-black text-[#477b4e] sm:flex">
        {number}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#729376]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.045em] text-[#20392b] sm:text-[1.8rem]">
          {title}
        </h2>
        <p className="mt-1 max-w-lg text-xs leading-5 text-[#839087] sm:text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  helper,
  required,
}: {
  label: string;
  helper?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label className="text-xs font-black text-[#405b48]">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {helper && (
        <span className="text-[10px] font-medium text-[#9aa69e]">
          {helper}
        </span>
      )}
    </div>
  );
}

function LanguageButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75a66a] ${active
          ? "border-[#b9d8ad] bg-[#eaf4e4] text-[#28643d]"
          : "border-[#e6ece3] bg-white text-[#879389] hover:bg-[#f8faf6]"
        }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  icon: ReactNode;
  tone: "green" | "amber" | "blue";
}) {
  const styles = {
    green: {
      icon: "bg-[#eaf4e4] text-[#3f814c]",
      number: "text-[#214e32]",
      accent: "bg-[#8cc66b]",
    },
    amber: {
      icon: "bg-[#fff3df] text-[#a77935]",
      number: "text-[#79521c]",
      accent: "bg-[#e9b65d]",
    },
    blue: {
      icon: "bg-[#eaf1f8] text-[#527a9b]",
      number: "text-[#315b7c]",
      accent: "bg-[#78a8ce]",
    },
  };

  const style = styles[tone];

  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#e2e9de] bg-white p-5 shadow-[0_8px_30px_-26px_rgba(26,58,37,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#7c8a7e]">{label}</p>
          <p className={`mt-3 text-4xl font-black tracking-[-0.06em] ${style.number}`}>
            {value}
          </p>
          <p className="mt-1 text-[10px] text-[#98a299]">{note}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${style.icon}`}>
          {icon}
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${style.accent}`} />
    </article>
  );
}

/* --------------------------------
   Empty state
--------------------------------- */

function EmptyReports({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d6e2d2] bg-[#f8faf6] px-5 py-14 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f2e3] text-[#56845a]">
        <FileText size={27} />
      </div>
      <p className="mt-5 text-lg font-black tracking-tight text-[#304c37]">
        Nothing here. Yet.
      </p>
      <p className="mx-auto mt-2 max-w-xs text-xs leading-6 text-[#87958a]">
        You haven't submitted a campus report. Start by telling us about
        something that needs attention.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1e5b38] px-5 text-xs font-black text-white transition hover:bg-[#16472c]"
      >
        <Plus size={16} />
        Create your first report
      </button>
    </div>
  );
}

/* --------------------------------
   Complaint card
--------------------------------- */

function ComplaintCard({
  complaint,
  analyzing,
  analysisError,
  onAnalyze,
}: {
  complaint: Complaint;
  analyzing: boolean;
  analysisError: string;
  onAnalyze: () => void;
}) {
  const analysis = getComplaintAnalysis(complaint.aiAnalysis);
  const priority = analysis?.priority || complaint.priority;

  const statusStyle =
    statusStyles[complaint.status] ??
    "bg-slate-50 text-slate-600 ring-slate-200";

  const priorityStyle = priority
    ? priorityStyles[priority.toLowerCase()] ??
    "bg-[#f1f4ef] text-[#667569]"
    : "";

  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-[#e4ebe1] bg-white transition hover:border-[#c9ddc2]">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="max-w-[65%] truncate text-[10px] font-bold uppercase tracking-wider text-[#9aa69e]">
            REF / {complaint.id}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset ${statusStyle}`}
          >
            {statusLabels[complaint.status] ?? complaint.status}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-black leading-6 text-[#294638]">
              {complaint.title}
            </h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-[#78887c]">
              {complaint.description}
            </p>
          </div>

          {priority && priority !== "uncategorized" && (
            <span
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-black capitalize ${priorityStyle}`}
            >
              {priority}
            </span>
          )}
        </div>

        {complaint.image?.secureUrl && (
          <a
            href={complaint.image.secureUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block w-full overflow-hidden rounded-xl border border-[#e5ece3] sm:max-w-xs"
          >
            <img
              src={complaint.image.secureUrl}
              alt="Photo attached to this report"
              className="max-h-48 w-full object-cover"
            />
            <span className="block bg-[#f8faf6] px-3 py-2 text-[10px] font-bold text-[#568064]">
              View attached photo ↗
            </span>
          </a>
        )}

        {complaint.location && (
          <p className="mt-3 flex items-center gap-2 break-words text-xs text-[#829087]">
            <MapPin size={13} className="shrink-0" />
            {complaint.location}
          </p>
        )}

        {analysis?.locationDetected && (
          <p className="mt-2 flex items-center gap-2 break-words text-xs text-[#829087]">
            <MapPin size={13} className="shrink-0" />
            AI detected location: {analysis.locationDetected}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-3 border-t border-[#edf1eb] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-[#98a399]">
            <span>
              {complaint.language === "as" ? "অসমীয়া" : "English"}
            </span>
            <span className="h-1 w-1 rounded-full bg-[#c3cec4]" />
            <span>{formatDate(complaint.createdAt)}</span>
          </div>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={analyzing}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d1e4c9] bg-[#f0f7ec] px-3.5 py-2 text-[11px] font-black text-[#3b7546] transition hover:bg-[#e5f2dd] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles
              size={14}
              className={analyzing ? "animate-pulse" : ""}
            />
            {analyzing
              ? "Analysing..."
              : analysis
                ? "Analyse again"
                : "Analyse with AI"}
          </button>
        </div>

        {analysisError && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
          >
            {analysisError}
          </p>
        )}

        {analysis && <AnalysisPanel analysis={analysis} />}
      </div>
    </article>
  );
}

/* --------------------------------
   AI analysis
--------------------------------- */

function AnalysisPanel({ analysis }: { analysis: ComplaintAnalysis }) {
  const priority = analysis.priority.toLowerCase();

  const confidence = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        analysis.confidence <= 1
          ? analysis.confidence * 100
          : analysis.confidence,
      ),
    ),
  );

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#dce9d7] bg-[#f6faf3]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3ecdf] bg-[#edf5e8] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-black text-[#315c38]">
          <Sparkles size={16} />
          CivicSense AI insight
        </div>
        <span
          className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase ${priorityStyles[priority] ?? "bg-slate-100 text-slate-600"
            }`}
        >
          {priority} priority
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {analysis.translatedTitle && (
          <AnalysisText
            label="Translated title"
            value={analysis.translatedTitle}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <AnalysisField
            label="Category"
            value={analysis.category.replaceAll("_", " ")}
          />
          <AnalysisField
            label="Suggested department"
            value={analysis.recommendedDepartment}
          />
        </div>

        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#709175]">
            English summary
          </p>
          <p className="text-xs leading-6 text-[#5f7162]">
            {analysis.summaryEnglish}
          </p>
        </div>

        <div className="rounded-xl border border-[#e4ece0] bg-white p-3">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#709175]">
            অসমীয়া সাৰাংশ
          </p>
          <p lang="as" className="text-sm leading-7 text-[#5f7162]">
            {analysis.summaryAssamese}
          </p>
        </div>

        <AnalysisText
          label="Why this priority?"
          value={analysis.priorityReason}
        />

        {analysis.imageFindings && (
          <AnalysisText
            label="Image observations"
            value={analysis.imageFindings}
          />
        )}

        <AnalysisText
          label="Recommended action"
          value={analysis.recommendedAction}
        />

        <div className="border-t border-[#e1eadc] pt-3">
          <div className="flex items-center justify-between text-[10px] font-semibold text-[#809083]">
            <span>AI confidence estimate</span>
            <span>{confidence}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e3ebdf]">
            <div
              className="h-full rounded-full bg-[#66a65c] transition-all"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        <p className="text-[10px] leading-5 text-[#92a093]">
          AI recommendations are advisory. University administrators must
          verify findings and approve actions.
        </p>
      </div>
    </div>
  );
}

function AnalysisField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#e3ebdf] bg-white p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-[#93a096]">
        {label}
      </p>
      <p className="mt-1 break-words text-xs font-black capitalize text-[#3c5947]">
        {value}
      </p>
    </div>
  );
}

function AnalysisText({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-[#829187]">
        {label}
      </p>
      <p className="mt-1 text-xs leading-6 text-[#617166]">{value}</p>
    </div>
  );
}

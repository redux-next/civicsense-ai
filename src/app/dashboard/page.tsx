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
    ArrowUpRight,
    BadgeCheck,
    CheckCircle2,
    Clock3,
    FileText,
    ImageIcon,
    LogOut,
    MapPin,
    Plus,
    RefreshCw,
    Send,
    ShieldCheck,
    Sparkles,
    ClipboardList,
    CircleHelp,
} from "lucide-react";

import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/auth-provider";
import ImageUpload, { type UploadedImage } from "@/components/complaints/image-upload";
import ThemeToggle from "@/components/ui/theme-toggle";
import type { Complaint, ComplaintLanguage, ComplaintStatus } from "@/types/complaint";

const statusLabels: Record<ComplaintStatus, string> = {
    submitted: "Submitted",
    under_review: "Under review",
    in_progress: "In progress",
    resolved: "Resolved",
    rejected: "Rejected",
};

const statusStyles: Record<ComplaintStatus, string> = {
    submitted: "border-sky-200 bg-sky-50 text-sky-700",
    under_review: "border-amber-200 bg-amber-50 text-amber-700",
    in_progress: "border-violet-200 bg-violet-50 text-violet-700",
    resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rejected: "border-rose-200 bg-rose-50 text-rose-700",
};

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

function getComplaintAnalysis(value: unknown): ComplaintAnalysis | null {
    if (!value || typeof value !== "object") return null;
    return value as ComplaintAnalysis;
}

function formatDate(value: string | null) {
    if (!value) return "Recently submitted";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently submitted";
    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

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
    const [image, setImage] = useState<UploadedImage | null>(null);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [analysisError, setAnalysisError] = useState("");
    const [analysisErrorId, setAnalysisErrorId] = useState<string | null>(null);

    const fetchComplaints = useCallback(async () => {
        if (!auth.currentUser) return;
        setFetching(true);
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch("/api/complaints", {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? "Could not load complaints.");
            setComplaints(data.complaints ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setFetching(false);
        }
    }, []);

    useEffect(() => {
        if (!loading && !user) {
            router.replace("/login");
            return;
        }
        if (user) void fetchComplaints();
    }, [user, loading, router, fetchComplaints]);

    async function handleAnalyze(complaintId: string) {
        setAnalysisError("");
        setAnalysisErrorId(null);
        setAnalyzingId(complaintId);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Please sign in again.");
            const response = await fetch("/api/ai/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ complaintId }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "AI analysis failed.");
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
                err instanceof Error ? err.message : "Something went wrong during AI analysis.",
            );
            setAnalysisErrorId(complaintId);
        } finally {
            setAnalyzingId(null);
        }
    }

    async function handleLogout() {
        await signOut(auth);
        router.replace("/login");
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSuccess("");
        setSubmitting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Please sign in again.");
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
                    image,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? "Complaint submission failed.");
            setTitle("");
            setDescription("");
            setLocation("");
            setImage(null);
            setSuccess(`Your report has been submitted. Reference: ${data.complaintId}`);
            await fetchComplaints();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading || !user) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f5f7f4] px-4 text-center text-[#20372e]">
                <div className="flex items-center gap-3 text-sm text-[#718078]">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#27845e]" />
                    Loading your campus space...
                </div>
            </main>
        );
    }

    const stats = {
        total: complaints.length,
        active: complaints.filter((item) =>
            ["submitted", "under_review", "in_progress"].includes(item.status),
        ).length,
        resolved: complaints.filter((item) => item.status === "resolved").length,
    };

    const firstName = (user.displayName || "Student").trim().split(/\s+/)[0];

    return (
        <main className="min-h-screen overflow-x-clip bg-[#f5f7f4] pb-24 text-[#20372e] md:pb-10">
            <header className="sticky top-0 z-40 border-b border-[#e5ebe5] bg-white/90 backdrop-blur-xl">
                <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
                    <a href="#top" className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#173f32] text-[#c5efd7] shadow-sm">
                            <ShieldCheck size={21} strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-[17px] font-extrabold tracking-[-0.04em] text-[#193b2f]">
                                CivicSense <span className="font-semibold text-[#388765]">AI</span>
                            </p>
                            <p className="hidden text-[10px] font-semibold uppercase tracking-[0.17em] text-[#8a9a90] sm:block">
                                Campus, heard.
                            </p>
                        </div>
                    </a>

                    <nav className="hidden items-center gap-1 md:flex">
                        <a href="#overview" className="rounded-full bg-[#edf5ef] px-4 py-2 text-sm font-semibold text-[#276448]">Overview</a>
                        <a href="#report" className="rounded-full px-4 py-2 text-sm font-medium text-[#75847b] transition hover:bg-[#f2f6f2] hover:text-[#20372e]">New report</a>
                        <a href="#my-reports" className="rounded-full px-4 py-2 text-sm font-medium text-[#75847b] transition hover:bg-[#f2f6f2] hover:text-[#20372e]">My reports</a>
                    </nav>

                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <div className="hidden text-right sm:block">
                            <p className="max-w-36 truncate text-xs font-bold text-[#294638]">{user.displayName || "Student"}</p>
                            <p className="max-w-36 truncate text-[11px] text-[#8a9a90]">Student account</p>
                        </div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e5f0e8] text-sm font-bold text-[#286448]">
                            {(user.displayName || user.email || "S").charAt(0).toUpperCase()}
                        </div>
                        <ThemeToggle className="h-9 w-9" />
                        <button
                            onClick={handleLogout}
                            aria-label="Log out"
                            title="Log out"
                            className="inline-flex h-9 items-center gap-2 rounded-full border border-[#e4eae4] px-3 text-xs font-semibold text-[#65766c] transition hover:border-[#d2dfd4] hover:bg-[#f6f9f6] hover:text-[#244b38]"
                        >
                            <LogOut size={15} />
                            <span className="hidden sm:inline">Sign out</span>
                        </button>
                    </div>
                </div>
            </header>

            <div id="top" className="mx-auto max-w-[1440px] px-4 pt-7 sm:px-6 sm:pt-10 lg:px-10">
                <section id="overview" className="relative isolate overflow-hidden rounded-[28px] bg-[#173f32] px-5 py-7 text-white shadow-[0_18px_50px_-32px_rgba(22,63,49,0.7)] sm:px-8 sm:py-9 lg:px-11 lg:py-11">
                    <div className="pointer-events-none absolute -right-14 -top-24 -z-10 h-72 w-72 rounded-full border-[44px] border-white/[0.045]" />
                    <div className="pointer-events-none absolute -bottom-36 right-[18%] -z-10 h-72 w-72 rounded-full bg-[#4f9a72]/20 blur-3xl" />
                    <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
                        <div className="max-w-2xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#c9e8d4]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#8fe0ad]" />
                                Your campus, your voice
                            </div>
                            <h1 className="text-[clamp(2rem,5vw,3.65rem)] font-bold leading-[1.06] tracking-[-0.055em]">
                                A better campus<br className="hidden sm:block" /> starts with being heard.
                            </h1>
                            <p className="mt-4 max-w-xl text-sm leading-7 text-[#d1e2d7] sm:text-base">
                                Hello, {firstName}. Share what needs attention, follow every update, and help make campus life better for everyone.
                            </p>
                        </div>
                        <a href="#report" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d7f2df] px-5 py-3.5 text-sm font-bold text-[#194331] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-white sm:w-auto">
                            <Plus size={17} /> Report an issue <ArrowUpRight size={16} />
                        </a>
                    </div>
                    <div className="relative mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/15 pt-5 text-xs text-[#c5dbce]">
                        <span className="inline-flex items-center gap-2"><Sparkles size={14} className="text-[#9ce1b4]" /> AI-assisted issue intelligence</span>
                        <span className="inline-flex items-center gap-2"><BadgeCheck size={14} className="text-[#9ce1b4]" /> Human-reviewed resolution</span>
                        <span className="inline-flex items-center gap-2">অসমীয়া <span className="text-white/40">/</span> English</span>
                    </div>
                </section>

                <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                    <StatCard label="Reports submitted" value={stats.total} icon={<FileText size={19} />} note="Your total contributions" tone="green" />
                    <StatCard label="Being addressed" value={stats.active} icon={<Clock3 size={19} />} note="In the resolution pipeline" tone="amber" />
                    <StatCard label="Resolved" value={stats.resolved} icon={<CheckCircle2 size={19} />} note="Issues marked complete" tone="blue" />
                </section>

                <div className="mt-7 grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:gap-6">
                    <section id="report" className="min-w-0 scroll-mt-24 overflow-hidden rounded-[24px] border border-[#e4ebe4] bg-white shadow-[0_12px_40px_-32px_rgba(30,60,43,0.28)]">
                        <div className="border-b border-[#edf1ed] px-5 py-5 sm:px-7">
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf4ec] text-[#28714e]">
                                    <ClipboardList size={21} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b9a7c]">Make a difference</p>
                                    <h2 className="mt-1 text-xl font-bold tracking-[-0.035em] text-[#203c30] sm:text-2xl">Report a campus issue</h2>
                                    <p className="mt-1 text-xs leading-5 text-[#839087] sm:text-sm">Tell us what happened. You can write in Assamese or English.</p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
                            <div>
                                <div className="mb-2.5 flex items-center justify-between gap-3">
                                    <label className="text-xs font-bold text-[#43594b]">Choose your language</label>
                                    <span className="text-[10px] font-medium text-[#9aa69e]">ভাষা বাছনি কৰক</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f3f6f2] p-1">
                                    <button type="button" onClick={() => setLanguage("en")} aria-pressed={language === "en"} className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition ${language === "en" ? "bg-white text-[#245c40] shadow-sm ring-1 ring-[#e6ece6]" : "text-[#819087] hover:text-[#385b46]"}`}>
                                        English
                                    </button>
                                    <button type="button" onClick={() => setLanguage("as")} aria-pressed={language === "as"} className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition ${language === "as" ? "bg-white text-[#245c40] shadow-sm ring-1 ring-[#e6ece6]" : "text-[#819087] hover:text-[#385b46]"}`}>
                                        অসমীয়া
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="complaint-title" className="mb-2 block text-xs font-bold text-[#43594b]">Issue title <span className="text-[#d16c5b]">*</span></label>
                                <input id="complaint-title" required minLength={5} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={language === "as" ? "সমস্যাটোৰ শিৰোনাম লিখক" : "e.g. Broken lights in the library"} className="w-full rounded-xl border border-[#e2e9e2] bg-[#fbfcfa] px-4 py-3.5 text-sm text-[#263d30] outline-none transition placeholder:text-[#a4afa7] focus:border-[#76a98a] focus:bg-white focus:ring-4 focus:ring-[#e7f2e9]" />
                                <p className="mt-1.5 text-right text-[10px] text-[#a0aaa2]">{title.length}/120</p>
                            </div>

                            <div>
                                <label htmlFor="complaint-description" className="mb-2 block text-xs font-bold text-[#43594b]">Describe the issue <span className="text-[#d16c5b]">*</span></label>
                                <textarea id="complaint-description" required minLength={10} maxLength={3000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={language === "as" ? "কি ঘটিছে, ক'ত ঘটিছে আৰু ইয়াৰ প্ৰভাৱ কি — বৰ্ণনা কৰক..." : "What happened, where did it happen, and how does it affect students?"} className="w-full resize-y rounded-xl border border-[#e2e9e2] bg-[#fbfcfa] px-4 py-3.5 text-sm leading-6 text-[#263d30] outline-none transition placeholder:text-[#a4afa7] focus:border-[#76a98a] focus:bg-white focus:ring-4 focus:ring-[#e7f2e9]" />
                                <p className="mt-1.5 text-right text-[10px] text-[#a0aaa2]">{description.length}/3000</p>
                            </div>

                            <div>
                                <label htmlFor="complaint-location" className="mb-2 flex items-center gap-2 text-xs font-bold text-[#43594b]"><MapPin size={14} className="text-[#6e9d7c}" /> Campus location <span className="font-normal text-[#9aa69e]">(optional)</span></label>
                                <input id="complaint-location" maxLength={200} value={location} onChange={(event) => setLocation(event.target.value)} placeholder={language === "as" ? "যেনে: পুথিভঁৰাল, ছাত্ৰাবাস..." : "e.g. Library, hostel block, science building"} className="w-full rounded-xl border border-[#e2e9e2] bg-[#fbfcfa] px-4 py-3.5 text-sm text-[#263d30] outline-none transition placeholder:text-[#a4afa7] focus:border-[#76a98a] focus:bg-white focus:ring-4 focus:ring-[#e7f2e9]" />
                            </div>

                            <div className="rounded-2xl border border-[#e5ece5] bg-[#f8faf7] p-3.5 sm:p-4">
                                <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#43594b]">
                                    <ImageIcon size={15} className="text-[#6e9d7c]" /> Add a photo <span className="font-normal text-[#9aa69e]">(optional)</span>
                                </div>
                                <ImageUpload image={image} onImageChange={setImage} />
                            </div>

                            {error && <p role="alert" className="break-words rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
                            {success && <p role="status" className="break-words rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}

                            <button type="submit" disabled={submitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#246647] px-4 py-3.5 text-sm font-bold text-white shadow-[0_8px_18px_-10px_rgba(36,102,71,0.8)] transition hover:-translate-y-0.5 hover:bg-[#1b5539] disabled:cursor-not-allowed disabled:opacity-60">
                                {submitting ? <RefreshCw size={17} className="animate-spin" /> : <Send size={16} />}
                                {submitting ? "Submitting your report..." : "Submit report"}
                            </button>
                            <p className="text-center text-[10px] leading-5 text-[#9aa69e]">Your report is linked to your account. AI suggestions are advisory and reviewed by university staff.</p>
                        </form>
                    </section>

                    <section id="my-reports" className="min-w-0 scroll-mt-24 rounded-[24px] border border-[#e4ebe4] bg-white shadow-[0_12px_40px_-32px_rgba(30,60,43,0.28)]">
                        <div className="flex items-center justify-between gap-3 border-b border-[#edf1ed] px-5 py-5 sm:px-7">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b9a7c]">Stay in the loop</p>
                                <h2 className="mt-1 text-xl font-bold tracking-[-0.035em] text-[#203c30] sm:text-2xl">Your reports</h2>
                                <p className="mt-1 text-xs text-[#839087] sm:text-sm">Track the progress of every issue you raise.</p>
                            </div>
                            <button type="button" onClick={() => void fetchComplaints()} disabled={fetching} aria-label="Refresh reports" title="Refresh reports" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e4ebe4] text-[#658071] transition hover:bg-[#f3f7f3] disabled:opacity-50">
                                <RefreshCw size={17} className={fetching ? "animate-spin" : ""} />
                            </button>
                        </div>

                        <div className="max-h-[55vh] min-h-[180px] overflow-y-auto overscroll-contain p-4 sm:max-h-[560px] sm:p-6">
                            {fetching ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <RefreshCw size={22} className="animate-spin text-[#5f9673]" />
                                    <p className="mt-3 text-sm text-[#89968d]">Loading your reports...</p>
                                </div>
                            ) : complaints.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[#dce6dc] bg-[#fafcf9] px-5 py-12 text-center">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf3eb] text-[#6b9a7c]"><CircleHelp size={25} /></div>
                                    <h3 className="mt-4 text-sm font-bold text-[#385343]">Your voice belongs here</h3>
                                    <p className="mx-auto mt-2 max-w-xs text-xs leading-6 text-[#89968d]">You haven't submitted a report yet. Start by telling us about something on campus that needs attention.</p>
                                    <a href="#report" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#e8f2e9] px-4 py-2.5 text-xs font-bold text-[#286448] hover:bg-[#dcecdf]"><Plus size={14} /> Create your first report</a>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {complaints.map((complaint) => (
                                        <ComplaintCard
                                            key={complaint.id}
                                            complaint={complaint}
                                            analyzing={analyzingId === complaint.id}
                                            analysisError={analysisErrorId === complaint.id ? analysisError : ""}
                                            onAnalyze={() => void handleAnalyze(complaint.id)}
                                        />
                                    ))}
                                </div>
                            )}
                            {!fetching && complaints.length > 0 && (
                                <p className="mt-4 text-center text-[10px] text-[#9aa69e]">Showing {complaints.length} {complaints.length === 1 ? "report" : "reports"} associated with your account.</p>
                            )}
                        </div>
                    </section>
                </div>

                <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-[#e3eae3] py-6 text-center text-[11px] text-[#91a096] sm:flex-row sm:text-left">
                    <p>© {new Date().getFullYear()} CivicSense AI · A more responsive campus starts here.</p>
                    <p className="flex items-center gap-2"><ShieldCheck size={13} /> Built for a safer, better-connected campus</p>
                </footer>
            </div>

            <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e2e9e2] bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur-xl md:hidden">
                <div className="mx-auto grid max-w-md grid-cols-3 gap-1">
                    <a href="#overview" className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-[#52715d]"><FileText size={17} /> Overview</a>
                    <a href="#report" className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-[#52715d]"><Plus size={18} /> New report</a>
                    <a href="#my-reports" className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-[#52715d]"><ClipboardList size={17} /> My reports</a>
                </div>
            </nav>
        </main>
    );
}

function StatCard({
    label,
    value,
    icon,
    note,
    tone,
}: {
    label: string;
    value: number;
    icon: ReactNode;
    note: string;
    tone: "green" | "amber" | "blue";
}) {
    const tones = {
        green: "bg-[#eaf3eb] text-[#37764f]",
        amber: "bg-[#fbf1df] text-[#a8782d]",
        blue: "bg-[#eaf1f7] text-[#527a9b]",
    };
    return (
        <div className="rounded-[20px] border border-[#e4ebe4] bg-white p-4 shadow-[0_10px_30px_-28px_rgba(30,60,43,0.3)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold text-[#77867c]">{label}</p>
                    <p className="mt-2 text-3xl font-bold tracking-[-0.06em] text-[#203c30] sm:text-[2rem]">{value}</p>
                    <p className="mt-1 text-[10px] text-[#9aa69e]">{note}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}>{icon}</div>
            </div>
        </div>
    );
}

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
    const priorityTone: Record<string, string> = {
        low: "bg-emerald-50 text-emerald-700 border-emerald-100",
        medium: "bg-sky-50 text-sky-700 border-sky-100",
        high: "bg-amber-50 text-amber-700 border-amber-100",
        critical: "bg-rose-50 text-rose-700 border-rose-100",
    };
    return (
        <article className="min-w-0 rounded-2xl border border-[#e8eee8] bg-[#fcfdfb] p-4 transition hover:border-[#d7e4d8] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="max-w-[65%] truncate text-[10px] font-medium text-[#9aa69e]">REF · {complaint.id}</span>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyles[complaint.status] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}>
                    {statusLabels[complaint.status] ?? complaint.status}
                </span>
            </div>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h3 className="break-words text-[15px] font-bold leading-6 text-[#294638]">{complaint.title}</h3>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-6 text-[#7b8980]">{complaint.description}</p>
                </div>
                {priority && priority !== "uncategorized" && (
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${priorityTone[priority.toLowerCase()] ?? "border-[#e6ebe6] bg-[#f4f6f3] text-[#65766b]"}`}>
                        {priority} priority
                    </span>
                )}
            </div>

            {complaint.image?.secureUrl && (
                <a href={complaint.image.secureUrl} target="_blank" rel="noreferrer" className="mt-3 block w-full overflow-hidden rounded-xl border border-[#e7ede7] sm:max-w-xs">
                    <img src={complaint.image.secureUrl} alt="Complaint attachment" className="max-h-48 w-full object-cover" />
                    <span className="block bg-white px-3 py-2 text-[10px] font-semibold text-[#568064]">View attached photo ↗</span>
                </a>
            )}

            {complaint.location && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#8b988f]"><MapPin size={12} /> {complaint.location}</p>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1ed] pt-3">
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#9aa69e]">
                    <span>{complaint.language === "as" ? "অসমীয়া" : "English"}</span>
                    <span className="h-1 w-1 rounded-full bg-[#c3cec4]" />
                    <span>{formatDate(complaint.createdAt)}</span>
                </div>
                <button type="button" onClick={onAnalyze} disabled={analyzing} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-[#cfe2d2] bg-[#eef6ef] px-3.5 py-2 text-[11px] font-bold text-[#2b704b] transition hover:bg-[#e1f0e3] disabled:cursor-not-allowed disabled:opacity-60">
                    <Sparkles size={13} className={analyzing ? "animate-pulse" : ""} />
                    {analyzing ? "Analysing..." : analysis ? "Run AI analysis again" : "Analyse with AI"}
                </button>
            </div>

            {analysisError && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{analysisError}</p>}
            {analysis && <AnalysisPanel analysis={analysis} />}
        </article>
    );
}

function AnalysisPanel({ analysis }: { analysis: ComplaintAnalysis }) {
    const priorityColors: Record<string, string> = {
        low: "bg-emerald-50 text-emerald-700",
        medium: "bg-sky-50 text-sky-700",
        high: "bg-amber-50 text-amber-700",
        critical: "bg-rose-50 text-rose-700",
    };
    const priority = analysis.priority.toLowerCase();
    return (
        <div className="mt-4 space-y-4 rounded-2xl border border-[#dce9df] bg-[#f5faf5] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#28583d]"><Sparkles size={16} /> CivicSense AI insight</div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${priorityColors[priority] ?? "bg-slate-100 text-slate-600"}`}>{priority} priority</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-[#e5eee5] bg-white p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#93a096]">Category</p>
                    <p className="mt-1 break-words text-xs font-bold capitalize text-[#3c5947]">{analysis.category.replaceAll("_", " ")}</p>
                </div>
                <div className="rounded-xl border border-[#e5eee5] bg-white p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#93a096]">Suggested department</p>
                    <p className="mt-1 break-words text-xs font-bold text-[#3c5947]">{analysis.recommendedDepartment}</p>
                </div>
            </div>
            <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#63866c]">English summary</p>
                <p className="text-xs leading-6 text-[#617166]">{analysis.summaryEnglish}</p>
            </div>
            <div className="rounded-xl border border-[#e5eee5] bg-white p-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#63866c]">অসমীয়া সাৰাংশ</p>
                <p lang="as" className="text-sm leading-7 text-[#617166]">{analysis.summaryAssamese}</p>
            </div>
            <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#829187]">Why this priority?</p>
                <p className="mt-1 text-xs leading-6 text-[#617166]">{analysis.priorityReason}</p>
            </div>
            {analysis.imageFindings && <div><p className="text-[10px] font-bold uppercase tracking-wider text-[#829187]">Image observations</p><p className="mt-1 text-xs leading-6 text-[#617166]">{analysis.imageFindings}</p></div>}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#829187]">Recommended action</p>
                <p className="mt-1 text-xs leading-6 text-[#617166]">{analysis.recommendedAction}</p>
            </div>
            <div className="border-t border-[#e2ebe2] pt-3">
                <div className="flex items-center justify-between text-[10px] text-[#8b998e]"><span>AI confidence estimate</span><span>{Math.round(analysis.confidence * 100)}%</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e4ece4]"><div className="h-full rounded-full bg-[#4d9669]" style={{ width: `${Math.round(analysis.confidence * 100)}%` }} /></div>
            </div>
            <p className="text-[10px] leading-5 text-[#96a198]">AI recommendations are advisory. University administrators must verify findings and approve actions.</p>
        </div>
    );
}

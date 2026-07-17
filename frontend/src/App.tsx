import React, { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Film, Loader2, LogOut, Zap } from "lucide-react";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { Background3D } from "./components/Background3D";
import { UploadZone } from "./components/UploadZone";
import { ConfigPanel } from "./components/ConfigPanel";
import { ProcessingView } from "./components/ProcessingView";
import { Workspace } from "./components/Workspace";
import { ToastProvider, useToast } from "./components/Toast";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { supabase } from "./lib/supabase";

import type { CaptionSegment } from "./types";

type AppPhase = "dashboard" | "upload" | "processing" | "workspace";
type ExportFormat = "srt" | "vtt" | "txt";

type ProjectCaptionData = {
  end?: number;
  id?: string;
  index?: number;
  start?: number;
  text?: string;
};

type SavedProjectRecord = {
  captions_data: ProjectCaptionData[] | null;
  created_at: string;
  id: string;
  project_name: string;
  user_id?: string;
  video_url: string | null;
};

type AppUser = {
  email?: string;
  id: string;
};

type AppAuth = {
  loading: boolean;
  signOut: () => Promise<{ error: unknown | null }>;
  user: AppUser | null;
};

const API_BASE = import.meta.env.VITE_API_BASE || "";

const toProjectCaptions = (items: CaptionSegment[]) =>
  items.map((segment) => ({
    end: segment.end,
    start: segment.start,
    text: segment.text,
  }));

const normalizeProjectSegments = (project: SavedProjectRecord): CaptionSegment[] => {
  const captions = Array.isArray(project.captions_data) ? project.captions_data : [];

  return captions.map((segment, index) => ({
    end: Number(segment.end ?? 0),
    id: String(segment.id ?? `${project.id}-${index}`),
    index: Number(segment.index ?? index),
    start: Number(segment.start ?? 0),
    text: String(segment.text ?? ""),
  }));
};

const formatExportTimestamp = (seconds: number, format: ExportFormat) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(seconds, 0) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = Math.floor(safeSeconds % 60);
  const millis = Math.floor((safeSeconds % 1) * 1000);
  const separator = format === "srt" ? "," : ".";

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${separator}${String(millis).padStart(3, "0")}`;
};

const buildExportFile = (format: ExportFormat, segments: CaptionSegment[]) => {
  if (format === "txt") {
    return segments.map((segment) => segment.text).join("\n");
  }

  if (format === "vtt") {
    const body = segments
      .map(
        (segment) =>
          `${formatExportTimestamp(segment.start, format)} --> ${formatExportTimestamp(segment.end, format)}\n${segment.text}`
      )
      .join("\n\n");

    return `WEBVTT\n\n${body}\n`;
  }

  return segments
    .map(
      (segment, index) =>
        `${index + 1}\n${formatExportTimestamp(segment.start, format)} --> ${formatExportTimestamp(segment.end, format)}\n${segment.text}`
    )
    .join("\n\n");
};

const downloadTextFile = (name: string, format: ExportFormat, content: string) => {
  const mimeTypes: Record<ExportFormat, string> = {
    srt: "application/x-subrip",
    txt: "text/plain",
    vtt: "text/vtt",
  };
  const blob = new Blob([content], { type: `${mimeTypes[format]};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${name}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const LoadingScreen: React.FC = () => (
  <div className="relative min-h-screen overflow-hidden">
    <Background3D />
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/5 px-5 py-4 shadow-2xl backdrop-blur-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500">
          <Film className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Sublyx</p>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading session
          </p>
        </div>
      </div>
    </div>
  </div>
);

const AppInner: React.FC = () => {
  const { addToast } = useToast();
  const { signOut, user } = useAuth() as AppAuth;
  const supabaseClient = supabase as any;

  const [phase, setPhase] = useState<AppPhase>("dashboard");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState("ta");
  const [targetLang, setTargetLang] = useState("tanglish");
  const [processingStep, setProcessingStep] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("sublyx-captions");
  const [isSigningOut, setIsSigningOut] = useState(false);

  const clearWorkspaceState = useCallback(() => {
    setSelectedFile(null);
    setSegments([]);
    setVideoUrl("");
    setActiveJobId(null);
    setSavedProjectId(null);
    setProjectName("sublyx-captions");
    setProcessingStep(0);
    setProgressPct(0);
  }, []);

  const startNewProject = useCallback(() => {
    clearWorkspaceState();
    setPhase("upload");
  }, [clearWorkspaceState]);

  const resetApp = useCallback(() => {
    clearWorkspaceState();
    setPhase("dashboard");
  }, [clearWorkspaceState]);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setProjectName(file.name.replace(/\.[^/.]+$/, "") || file.name);
  }, []);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setProjectName("sublyx-captions");
  }, []);

  const saveProjectToMemory = useCallback(
    async (name: string, projectVideoUrl: string, projectSegments: CaptionSegment[]) => {
      if (!supabaseClient || !user) return null;

      try {
        const { data, error } = await supabaseClient
          .from("projects")
          .insert({
            captions_data: toProjectCaptions(projectSegments),
            project_name: name,
            user_id: user.id,
            video_url: projectVideoUrl,
          })
          .select("id")
          .single();

        if (error) throw error;

        setSavedProjectId(data.id);
        return data.id as string;
      } catch (error) {
        console.error("Failed to save project memory:", error);
        addToast("Captions generated, but project memory could not be saved.", "error");
        return null;
      }
    },
    [addToast, supabaseClient, user]
  );

  const handleGenerate = useCallback(async () => {
    if (!selectedFile) return;

    setPhase("processing");
    setProcessingStep(0);
    setProgressPct(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("source_lang", sourceLang);
      formData.append("target_lang", targetLang);

      const response = await fetch(`${API_BASE}/api/jobs`, {
        body: formData,
        method: "POST",
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      const jobId = data.job_id;
      setActiveJobId(jobId);

      let stepIdx = 0;

      const pollInterval = window.setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
          if (!res.ok) throw new Error("Poll failed");
          const jobData = await res.json();

          const pct = jobData.progress_pct || 0;
          setProgressPct(pct);

          if (pct >= 25 && stepIdx < 1) {
            stepIdx = 1;
            setProcessingStep(1);
          }
          if (pct >= 50 && stepIdx < 2) {
            stepIdx = 2;
            setProcessingStep(2);
          }
          if (pct >= 75 && stepIdx < 3) {
            stepIdx = 3;
            setProcessingStep(3);
          }

          if (jobData.status === "done") {
            window.clearInterval(pollInterval);
            setProcessingStep(4);
            setProgressPct(100);

            const segRes = await fetch(`${API_BASE}/api/jobs/${jobId}/segments`);
            if (!segRes.ok) throw new Error("Segments failed");
            const segData = await segRes.json();

            const mappedSegments: CaptionSegment[] = segData.map((seg: any) => ({
              end: seg.end_ms / 1000,
              id: seg.id,
              index: seg.index,
              start: seg.start_ms / 1000,
              text: seg.caption_text,
            }));

            const generatedVideoUrl = `${API_BASE}/api/jobs/${jobId}/audio`;
            setSegments(mappedSegments);
            setVideoUrl(generatedVideoUrl);
            await saveProjectToMemory(projectName, generatedVideoUrl, mappedSegments);

            window.setTimeout(() => {
              setPhase("workspace");
              addToast("Captions generated successfully.", "success");
            }, 600);
          } else if (jobData.status === "failed") {
            window.clearInterval(pollInterval);
            addToast(`Processing failed: ${jobData.error || "Unknown error"}`, "error");
            setPhase("upload");
          }
        } catch (pollErr) {
          console.error("Polling error:", pollErr);
        }
      }, 2000);
    } catch (error: any) {
      console.error("Failed to generate:", error);
      addToast(error.message || "Failed to connect to the server. Please ensure the backend is running.", "error");
      setPhase("upload");
    }
  }, [addToast, projectName, saveProjectToMemory, selectedFile, sourceLang, targetLang]);

  const handleOpenSavedProject = useCallback(
    (project: SavedProjectRecord) => {
      const mappedSegments = normalizeProjectSegments(project);
      setSelectedFile(null);
      setSegments(mappedSegments);
      setVideoUrl(project.video_url ?? "");
      setActiveJobId(null);
      setSavedProjectId(project.id);
      setProjectName(project.project_name || "sublyx-captions");
      setPhase("workspace");
      addToast("Loaded saved project.", "success");
    },
    [addToast]
  );

  const handleUpdateSegment = useCallback(
    async (id: string, newText: string) => {
      const nextSegments = segments.map((segment) => (segment.id === id ? { ...segment, text: newText } : segment));
      setSegments(nextSegments);

      if (activeJobId) {
        try {
          await fetch(`${API_BASE}/api/jobs/${activeJobId}/segments/${id}`, {
            body: JSON.stringify({ caption_text: newText }),
            headers: { "Content-Type": "application/json" },
            method: "PUT",
          });
        } catch (error) {
          console.error("Backend caption update failed:", error);
        }
      }

      if (savedProjectId && supabaseClient && user) {
        try {
          const { error } = await supabaseClient
            .from("projects")
            .update({ captions_data: toProjectCaptions(nextSegments) })
            .eq("id", savedProjectId)
            .eq("user_id", user.id);

          if (error) throw error;
        } catch (error) {
          console.error("Project memory update failed:", error);
        }
      }
    },
    [activeJobId, savedProjectId, segments, supabaseClient, user]
  );

  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (activeJobId) {
        window.location.href = `${API_BASE}/api/jobs/${activeJobId}/export?format=${format}`;
        addToast(`Downloading ${format.toUpperCase()} file...`, "success");
        return;
      }

      if (segments.length === 0) {
        addToast("Cannot export an empty project.", "error");
        return;
      }

      downloadTextFile(projectName || "sublyx-captions", format, buildExportFile(format, segments));
      addToast(`Downloading ${format.toUpperCase()} file...`, "success");
    },
    [activeJobId, addToast, projectName, segments]
  );

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    const { error } = await signOut();

    if (error) {
      addToast("Could not sign out. Please try again.", "error");
      setIsSigningOut(false);
    }
  }, [addToast, signOut]);

  const getTargetLabel = (val: string) => {
    const map: Record<string, string> = {
      english: "English",
      french: "French",
      german: "German",
      hindi: "Hindi",
      kannada: "Kannada",
      spanish: "Spanish",
      tamil: "Tamil",
      tanglish: "Tanglish",
      telugu: "Telugu",
    };
    return map[val] || val;
  };

  if (phase === "dashboard") {
    return <Dashboard onNewProject={startNewProject} onOpenProject={handleOpenSavedProject} />;
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Background3D />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="glass-strong sticky top-0 z-50 border-b border-white/[0.06]">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <motion.div
              className="group flex cursor-pointer items-center space-x-3"
              onClick={resetApp}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 shadow-lg shadow-primary-500/20 transition-shadow duration-300 group-hover:shadow-primary-500/40">
                <Film className="text-white" size={18} />
              </div>
              <h1 className="text-lg font-bold gradient-text-brand tracking-tight">Sublyx</h1>
              <span className="hidden items-center rounded-full border border-primary-500/20 bg-primary-500/10 px-2 py-0.5 text-[10px] font-semibold text-primary-400 sm:inline-flex">
                <Zap className="mr-1" size={10} />
                BETA
              </span>
            </motion.div>

            <div className="flex items-center gap-2">
              <AnimatePresence>
                {phase === "upload" && (
                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-white/5 hover:text-white cursor-pointer"
                    onClick={() => setPhase("dashboard")}
                  >
                    <ArrowLeft size={16} />
                    <span className="hidden sm:inline">Back to Dashboard</span>
                  </motion.button>
                )}
                {phase !== "upload" && (
                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-white/5 hover:text-white cursor-pointer"
                    onClick={startNewProject}
                  >
                    <ArrowLeft size={16} />
                    <span className="hidden sm:inline">New Project</span>
                  </motion.button>
                )}
              </AnimatePresence>

              <div className="hidden max-w-[220px] truncate text-xs text-slate-500 md:block">
                {user?.email}
              </div>
              <button
                type="button"
                disabled={isSigningOut}
                onClick={handleSignOut}
                title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col">
          <AnimatePresence mode="wait">
            {phase === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
              >
                <div className="mx-auto w-full max-w-2xl space-y-6">
                  <div className="mb-8 space-y-3 text-center">
                    <motion.h2
                      className="text-4xl font-extrabold gradient-text leading-tight sm:text-5xl"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      AI Video Captions
                    </motion.h2>
                    <motion.p
                      className="mx-auto max-w-md text-lg text-slate-400"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      Upload a video, choose your language, and get precise captions powered by Whisper AI.
                    </motion.p>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <UploadZone selectedFile={selectedFile} onFileSelect={handleFileSelect} onRemoveFile={handleRemoveFile} />
                  </motion.div>

                  <AnimatePresence>
                    {selectedFile && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      >
                        <ConfigPanel
                          sourceLang={sourceLang}
                          targetLang={targetLang}
                          onSourceLangChange={setSourceLang}
                          onTargetLangChange={setTargetLang}
                          onGenerate={handleGenerate}
                          isGenerating={false}
                          hasFile={!!selectedFile}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {phase === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
              >
                <div className="mx-auto w-full max-w-lg">
                  <ProcessingView currentStep={processingStep} targetLanguage={getTargetLabel(targetLang)} progressPct={progressPct} />
                </div>
              </motion.div>
            )}

            {phase === "workspace" && (
              <motion.div
                key="workspace"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex-1"
              >
                <Workspace
                  videoUrl={videoUrl}
                  segments={segments}
                  onUpdateSegment={handleUpdateSegment}
                  onExport={handleExport}
                  onBack={resetApp}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-auto border-t border-white/[0.04] py-6">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <p className="flex items-center justify-center space-x-2 text-sm text-slate-600">
              <span className="font-semibold gradient-text-brand">Sublyx</span>
              <span className="h-1 w-1 rounded-full bg-slate-700" />
              <span>AI-Powered Multi-Language Video Captioning</span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

const AuthGate: React.FC = () => {
  const { loading, user } = useAuth() as AppAuth;

  if (loading) return <LoadingScreen />;
  return user ? <AppInner /> : <Auth />;
};

const App: React.FC = () => (
  <ToastProvider>
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  </ToastProvider>
);

export default App;
